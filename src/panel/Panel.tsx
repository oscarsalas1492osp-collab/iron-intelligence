// Panel interno: inscritos al aviso de lanzamiento, cuentas y accesos de testers.
// Solo en español y solo para quien administra la app; el servidor rechaza a cualquier otra cuenta.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useUserId } from '../hooks';
import { Bar, Btn, Card, cx, Empty, Field, H2, Icon, Seg, Sheet, Stat, Stepper, Title, useAction, useUi } from '../ui/components';
import { FEATURES, parseBilling, type Feature } from '../domain/plan';
import * as api from './api';

const APP = 'https://app.ironintelligence.app', WEB = 'https://ironintelligence.app';
const TEL: Record<string, string> = { android: 'Android', iphone: 'iPhone' };
const DIAS: Record<string, string> = { '1-2': '1 a 2 días', '3-4': '3 a 4 días', '5+': '5 días o más' };
const ANOTA: Record<string, string> = { notas: 'notas del teléfono', papel: 'papel', otra_app: 'otra app', ninguna: 'en ninguna parte' };
const ACCION: Record<string, string> = { dar_acceso: 'Acceso dado a', plan_pro: 'Plan Pro de', planes: 'Planes configurados', quitar_acceso: 'Acceso quitado a', borrar_del_aviso: 'Borrado del aviso', marcar_avisados: 'Marcados como avisados', modo_de_acceso: 'Entrada a la app' };
const TIPO: Record<api.Kind, string> = { tester: 'Tester', guest: 'Invitado' };
// Plan Pro que se le da a una persona con acceso: 0 no lleva Pro, -1 no vence, N son días desde hoy.
const PRO_OPC = [{ value: '0', label: 'Sin Pro' }, { value: '14', label: '14 días' }, { value: '30', label: '30 días' }, { value: '90', label: '90 días' }, { value: '-1', label: 'Sin vencimiento' }];
const fVence = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
const proDe = (g: api.GrantRow): string => {
  if (g.pro_forever) return 'Pro sin vencimiento';
  if (!g.pro_until) return 'sin Pro';
  const t = new Date(g.pro_until).getTime(), dias = Math.ceil((t - Date.now()) / 86400000);
  return dias <= 0 ? `Pro vencido el ${fVence.format(t)}` : `Pro hasta el ${fVence.format(t)} (${plural(dias, 'día', 'días')})`;
};
const proVigente = (g: api.GrantRow) => !!g.pro_forever || (!!g.pro_until && new Date(g.pro_until).getTime() > Date.now());
const MODO: Record<string, string> = { invite: 'solo invitados', open: 'abierta para todos' };
const dado = (tieneCuenta: boolean) => (tieneCuenta ? 'Acceso dado. Ya puede entrar con su cuenta.' : 'Acceso dado. Ya puede crear su cuenta con ese correo.');
type Mail = { status: api.MailStatus | null; reload: () => void };

const fDia = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' });
const fHora = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const cuando = (v: string | number | null) => (v === null ? 'nunca' : fHora.format(new Date(v)));
function hace(v: string | number | null): string {
  if (v === null) return 'nunca';
  const a = new Date(v), b = new Date();
  const d = Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 86400000);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : d < 30 ? `hace ${d} días` : fDia.format(a);
}
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

async function copiar(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copia este texto', text); }
}
function descargar(nombre: string, filas: (string | null)[][]): void {
  const csv = filas.map((f) => f.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const mensajeAcceso = (email: string, kind: api.Kind = 'tester') => [
  kind === 'tester' ? 'Hola. Ya tienes acceso a IRON INTELLIGENCE como tester.' : 'Hola. Ya tienes acceso a IRON INTELLIGENCE antes del lanzamiento.',
  `Entra desde tu teléfono: ${APP}`,
  `Por ahora se entra solo con invitación, así que crea tu cuenta con este mismo correo (${email}).`,
  'En Android: ábrela en Chrome, toca el menú de los tres puntos y elige Instalar app.',
  'En iPhone: ábrela en Safari, toca Compartir y elige Añadir a pantalla de inicio.',
  'Si algo falla o te confunde, cuéntamelo por aquí.',
].join('\n');

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let on = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => { if (on) setState({ data, error: null, loading: false }); },
      (e: unknown) => { if (on) setState((s) => ({ data: s.data, error: e instanceof Error ? e.message : 'No se pudo cargar.', loading: false })); },
    );
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...state, reload: useCallback(() => setN((x) => x + 1), []) };
}
function useLento(valor: string, ms = 350): string {
  const [v, setV] = useState(valor);
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t); }, [valor, ms]);
  return v;
}

const TONO = { go: 'bg-go/15 text-go', data: 'bg-data/15 text-data', amber: 'bg-amber/15 text-amber', mute: 'bg-card2 text-mute', ember: 'bg-ember/15 text-[#ff7a70]' } as const;
const Marca = ({ tono, children }: { tono: keyof typeof TONO; children: ReactNode }) => (
  <span className={cx('wd-c shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', TONO[tono])}>{children}</span>
);
const Lista = ({ children }: { children: ReactNode }) => <div className="divide-y divide-line overflow-hidden rounded-panel bg-card">{children}</div>;
function Fila({ titulo, linea, marcas, onClick }: { titulo: string; linea: ReactNode; marcas?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-card2 active:bg-card2">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{titulo}</span>
        <span className="wd-c block truncate text-sm text-mute">{linea}</span>
      </span>
      {marcas && <span className="flex shrink-0 flex-col items-end gap-1">{marcas}</span>}
      <Icon name="right" size={16} className="shrink-0 text-mute" />
    </button>
  );
}
const Dato = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
    <span className="label shrink-0">{k}</span><span className="min-w-0 break-words text-right text-sm">{children}</span>
  </div>
);
function Estado({ loading, error, reload }: { loading: boolean; error: string | null; reload: () => void }) {
  if (error) return <Empty icon="info" title="No se pudo cargar" text={error}><Btn onClick={reload}>Reintentar</Btn></Empty>;
  return <p className="py-8 text-center text-sm text-mute">{loading ? 'Cargando…' : 'Sin datos.'}</p>;
}
function Buscar({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <input type="search" inputMode="email" autoComplete="off" aria-label={label} placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} />;
}

/** Muestra el asunto y el texto de un correo de la app, tal como saldría. */
function VerCorreo({ which, email, kind, onClose }: { which: 'invitacion' | 'lanzamiento' | null; email?: string; kind?: api.Kind; onClose: () => void }) {
  const [c, setC] = useState<api.MailPreview | null>(null), [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!which) return;
    let on = true; setC(null); setError(null);
    api.mailPreview(which, { email, kind }).then((r) => { if (on) setC(r); }, (e: unknown) => { if (on) setError(e instanceof Error ? e.message : 'No se pudo cargar.'); });
    return () => { on = false; };
  }, [which, email, kind]);
  return (
    <Sheet open={!!which} onClose={onClose} title={which === 'lanzamiento' ? 'Aviso de lanzamiento' : 'Correo de invitación'} wide>
      {error ? <p className="text-sm text-mute">{error}</p> : !c ? <p className="text-sm text-mute">Cargando…</p> : (
        <>
          <Dato k="De">{c.from}</Dato>
          <Dato k="Asunto">{c.subject}</Dato>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{c.text}</p>
        </>
      )}
    </Sheet>
  );
}

// ───────────────────────── Resumen ─────────────────────────
function Resumen({ mail }: { mail: Mail }) {
  const { data, error, loading, reload } = useLoad(api.overview, []);
  const { toast, confirm } = useUi(), run = useAction();
  const [ver, setVer] = useState<'invitacion' | 'lanzamiento' | null>(null);
  if (!data) return <Estado loading={loading} error={error} reload={reload} />;
  const l = data.launch, max = Math.max(1, ...data.by_day.map((x) => x.n)), top = Math.max(1, ...data.by_source.map((x) => x.n));
  const links = [{ red: 'TikTok', url: `${WEB}/?o=tiktok` }, { red: 'Instagram', url: `${WEB}/?o=instagram` }];
  const modo = data.mode ?? 'open', m = mail.status;
  const cambiar = async (nuevo: api.Mode) => {
    if (nuevo === modo) return;
    const texto = nuevo === 'invite'
      ? 'La app queda solo para invitados: entra quien tenga acceso de tester o de invitado. Nadie más puede crear una cuenta.'
      : 'La app queda abierta: cualquiera puede crear una cuenta y entrar. Úsalo el día del lanzamiento.';
    if (!(await confirm(texto, { confirmLabel: nuevo === 'invite' ? 'Dejar solo invitados' : 'Abrir para todos' }))) return;
    await run(async () => { await api.setAccessMode(nuevo); reload(); }, nuevo === 'invite' ? 'Listo. Ahora entra solo quien tenga invitación.' : 'Listo. La app quedó abierta para todos.');
  };
  const probar = () => run(async () => { const r = await api.mailTest(); toast(`Prueba enviada a ${r.to}`); mail.reload(); });
  return (
    <div>
      <Card className="mb-3">
        <div className="mb-3 flex items-baseline justify-between gap-3"><span className="font-bold">Quién puede entrar a la app</span><span className="wd-c text-sm text-mute">{MODO[modo]}</span></div>
        <Seg<api.Mode> options={[{ value: 'invite', label: 'Solo invitados' }, { value: 'open', label: 'Todos' }]} value={modo} onChange={(v) => void cambiar(v)} />
        <p className="mt-3 text-sm text-mute">{modo === 'invite' ? 'Entran los correos con acceso de tester o de invitado, y tú. Al resto la app le muestra cómo inscribirse para el lanzamiento.' : 'Cualquiera puede crear una cuenta y usar la app.'}</p>
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><Stat label="Inscritos al aviso" value={l.total} sub={`${l.today} hoy, ${l.week} en 7 días`} color="#ff6a1a" /></Card>
        <Card><Stat label="Cuentas creadas" value={data.users.total} sub={`${data.users.active_week} entraron esta semana`} /></Card>
        <Card><Stat label="Con entrenamientos" value={data.training} sub="ya guardaron sesiones" /></Card>
        <Card><Stat label="Con acceso" value={data.testers.access + (data.testers.guests ?? 0)} sub={`${plural(data.testers.access, 'tester', 'testers')}, ${plural(data.testers.guests ?? 0, 'invitado', 'invitados')}`} /></Card>
      </div>

      <H2 right={<span className="wd-c text-sm text-mute">últimos 14 días</span>}>Inscritos por día</H2>
      <Card>
        <div className="flex h-24 items-end gap-1" role="img" aria-label={`Inscritos por día en los últimos 14 días. El día más alto tuvo ${max === 1 && l.total === 0 ? 0 : max}.`}>
          {data.by_day.map((x) => (
            <div key={x.d} className="flex-1 rounded-t-[5px] bg-data" title={`${fDia.format(new Date(`${x.d}T12:00:00`))}: ${x.n}`} style={{ height: `${Math.max(4, (x.n / max) * 100)}%`, opacity: x.n ? 1 : 0.22 }} />
          ))}
        </div>
        <div className="wd-c mt-2 flex justify-between text-xs text-mute">
          <span>{data.by_day[0] ? fDia.format(new Date(`${data.by_day[0].d}T12:00:00`)) : ''}</span><span>hoy</span>
        </div>
      </Card>

      <H2>De dónde llegan</H2>
      {data.by_source.length === 0 ? (
        <p className="text-sm text-mute">Todavía no hay inscritos. Cuando lleguen, aquí se ve desde qué red entró cada uno.</p>
      ) : (
        <Card className="space-y-3">
          {data.by_source.map((s) => (
            <div key={s.source}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm"><span className="truncate font-semibold">{s.source}</span><span className="num">{s.n}</span></div>
              <Bar value={s.n} max={top} color="#ff6a1a" />
            </div>
          ))}
        </Card>
      )}

      <H2>Qué teléfono usan</H2>
      <Card className="grid grid-cols-3 gap-3">
        <Stat label="Android" value={l.android} />
        <Stat label="iPhone" value={l.iphone} />
        <Stat label="No dijeron" value={l.total - l.android - l.iphone} />
      </Card>

      <H2>Links para tus perfiles</H2>
      <p className="mb-3 text-sm text-mute">Pon cada uno en el perfil de su red. Así el panel sabe desde dónde llegó cada inscrito.</p>
      <Lista>
        {links.map((x) => (
          <div key={x.red} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1"><span className="block font-semibold">{x.red}</span><span className="wd-c block truncate text-sm text-mute">{x.url.replace('https://', '')}</span></span>
            <Btn size="sm" icon="copy" onClick={() => void copiar(x.url).then(() => toast(`Link de ${x.red} copiado`))}>Copiar</Btn>
          </div>
        ))}
      </Lista>

      <H2>Correo de la app</H2>
      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate font-semibold">{m?.from.replace(/^.*<|>$/g, '') ?? 'hola@ironintelligence.app'}</span>
          <Marca tono={m?.configured ? 'go' : 'mute'}>{m?.configured ? 'Conectado' : 'Sin conectar'}</Marca>
        </div>
        <p className="mt-2 text-sm text-mute">
          {m?.configured
            ? `Hoy van ${m.today} de ${m.cap} correos. Las invitaciones se envían desde Accesos y el aviso de lanzamiento desde Aviso.`
            : 'Desde aquí salen las invitaciones y el aviso de lanzamiento. Todavía falta conectar el servicio de envío; mientras tanto puedes copiar los mensajes y mandarlos tú.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn size="sm" onClick={() => setVer('invitacion')}>Ver la invitación</Btn>
          <Btn size="sm" onClick={() => setVer('lanzamiento')}>Ver el aviso de lanzamiento</Btn>
          {m?.configured && <Btn size="sm" variant="primary" onClick={() => void probar()}>Enviarme una prueba</Btn>}
        </div>
      </Card>
      <VerCorreo which={ver} onClose={() => setVer(null)} />
    </div>
  );
}

// ───────────────────────── Aviso de lanzamiento ─────────────────────────
function Aviso({ mail }: { mail: Mail }) {
  const [q, setQ] = useState(''), [limit, setLimit] = useState(200), [sel, setSel] = useState<api.LaunchRow | null>(null);
  const [link, setLink] = useState(''), [enviando, setEnviando] = useState(false);
  const lento = useLento(q);
  const { data, error, loading, reload } = useLoad(() => api.launchList(lento, limit), [lento, limit]);
  const { toast, confirm } = useUi(), run = useAction();
  const rows = data?.rows ?? [], pendientes = rows.filter((r) => !r.notified_at);

  const cerrar = () => { setSel(null); reload(); };
  const dar = (r: api.LaunchRow, kind: api.Kind) => run(async () => {
    const x = await api.grantAccess(r.email, 'desde la lista de aviso', kind);
    toast(dado(x.has_account));
    cerrar();
  });
  const porAvisar = mail.status?.pending ?? pendientes.length;
  const lanzar = async () => {
    if (!(await confirm(`Vas a enviar el aviso de lanzamiento a ${plural(porAvisar, 'persona', 'personas')}, con este link: ${link.trim()}. No se puede deshacer.`, { confirmLabel: 'Enviar aviso' }))) return;
    setEnviando(true);
    await run(async () => {
      const r = await api.mailLaunch(link.trim());
      toast(r.remaining ? `Enviados ${r.sent}. Quedan ${r.remaining}: vuelve a tocar Enviar.` : `Aviso enviado a ${plural(r.sent, 'persona', 'personas')}.`);
      reload(); mail.reload();
    });
    setEnviando(false);
  };
  const borrar = async (r: api.LaunchRow) => {
    if (!(await confirm(`Vas a borrar a ${r.email} de la lista de aviso. No va a recibir el correo de lanzamiento.`, { confirmLabel: 'Borrar', danger: true }))) return;
    await run(async () => { await api.removeLaunch(r.email); cerrar(); }, 'Borrado de la lista');
  };
  const marcar = async () => {
    if (!(await confirm(`Esto solo deja anotado que ya les escribiste a los ${pendientes.length} pendientes. No envía ningún correo.`, { confirmLabel: 'Marcar' }))) return;
    await run(async () => { const n = await api.markNotified(); toast(`${plural(n, 'correo marcado', 'correos marcados')} como avisados`); reload(); });
  };
  const csv = () => descargar('inscritos-aviso.csv', [['correo', 'telefono', 'origen', 'idioma', 'inscrito', 'avisado', 'tiene_cuenta'],
    ...rows.map((r) => [r.email, r.phone_os, r.source ?? 'directo', r.lang, r.created_at, r.notified_at, r.has_account ? 'si' : 'no'])]);

  return (
    <div>
      <Buscar value={q} onChange={setQ} label="Buscar un correo" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="wd-c mr-auto text-sm text-mute">{data ? plural(data.total, 'inscrito', 'inscritos') : ' '}</span>
        <Btn size="sm" icon="copy" disabled={!pendientes.length} onClick={() => void copiar(pendientes.map((r) => r.email).join(', ')).then(() => toast(`${plural(pendientes.length, 'correo copiado', 'correos copiados')}`))}>Copiar correos</Btn>
        <Btn size="sm" disabled={!rows.length} onClick={csv}>Descargar CSV</Btn>
      </div>

      <div className="mt-4">
        {!data ? <Estado loading={loading} error={error} reload={reload} /> : rows.length === 0 ? (
          <Empty icon="list" title={lento ? 'Ningún correo coincide' : 'Todavía no hay inscritos'} text={lento ? 'Prueba con otra parte del correo.' : 'Cuando alguien se inscriba en la página, aparece aquí al momento.'} />
        ) : (
          <Lista>
            {rows.map((r) => (
              <Fila key={r.email} titulo={r.email} onClick={() => setSel(r)}
                linea={<>{hace(r.created_at)}{r.phone_os ? `, ${TEL[r.phone_os]}` : ''}{r.source ? `, desde ${r.source}` : ', entró directo'}</>}
                marcas={<>{r.notified_at && <Marca tono="go">Avisado</Marca>}{r.access === 'active' && <Marca tono="amber">Con acceso</Marca>}{r.has_account && <Marca tono="data">Con cuenta</Marca>}</>} />
            ))}
          </Lista>
        )}
        {data && rows.length < data.total && <Btn className="mt-3 w-full" onClick={() => setLimit((x) => x + 200)}>Ver más</Btn>}
      </div>

      <H2>El día del lanzamiento</H2>
      {mail.status?.configured ? (
        <>
          <p className="mb-3 text-sm text-mute">Pega el link de descarga y envía el aviso. Sale por tandas de hasta 100 correos y cada persona queda marcada al enviarse, así que nadie lo recibe dos veces.</p>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <Field label="Link de descarga"><input type="url" inputMode="url" autoComplete="off" placeholder="https://play.google.com/store/apps/…" value={link} onChange={(e) => setLink(e.target.value)} /></Field>
            <Btn variant="primary" disabled={enviando || !porAvisar || !/^https:\/\/\S+$/.test(link.trim())} onClick={() => void lanzar()}>{enviando ? 'Enviando…' : `Enviar aviso a ${porAvisar}`}</Btn>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-mute">El correo de la app todavía no está conectado. Si llega el día y sigue así, copia los correos pendientes, escríbeles desde tu correo y déjalos marcados aquí.</p>
          <Btn disabled={!pendientes.length} onClick={() => void marcar()}>Marcar pendientes como avisados</Btn>
        </>
      )}

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.email}>
        {sel && (
          <>
            <div className="mb-5">
              <Dato k="Se inscribió">{cuando(sel.created_at)}</Dato>
              <Dato k="Teléfono">{sel.phone_os ? TEL[sel.phone_os] : 'no dijo'}</Dato>
              <Dato k="Llegó desde">{sel.source ?? 'entró directo a la página'}</Dato>
              <Dato k="Aviso de lanzamiento">{sel.notified_at ? `enviado el ${cuando(sel.notified_at)}` : 'pendiente'}</Dato>
              <Dato k="Cuenta en la app">{sel.has_account ? 'sí' : 'todavía no'}</Dato>
              <Dato k="Acceso a la app">{sel.access === 'active' ? 'sí' : sel.access === 'revoked' ? 'se lo quitaste' : 'no'}</Dato>
            </div>
            <div className="grid gap-2">
              {sel.access !== 'active' && <Btn variant="primary" onClick={() => void dar(sel, 'tester')}>Dar acceso como tester</Btn>}
              {sel.access !== 'active' && <Btn onClick={() => void dar(sel, 'guest')}>Dar acceso como invitado</Btn>}
              <Btn icon="copy" onClick={() => void copiar(sel.email).then(() => toast('Correo copiado'))}>Copiar correo</Btn>
              <Btn variant="danger" icon="trash" onClick={() => void borrar(sel)}>Borrar de la lista</Btn>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

// ───────────────────────── Accesos: testers e invitados ─────────────────────────
function Accesos({ mail }: { mail: Mail }) {
  const { data, error, loading, reload } = useLoad(api.testers, []);
  const log = useLoad(api.activity, []);
  const [email, setEmail] = useState(''), [nota, setNota] = useState(''), [tipo, setTipo] = useState<api.Kind>('tester');
  const [pro, setPro] = useState('30'), [proSel, setProSel] = useState('30');
  const [ver, setVer] = useState(false);
  const [sel, setSel] = useState<api.GrantRow | null>(null), [post, setPost] = useState<api.SignupRow | null>(null);
  const { toast, confirm } = useUi(), run = useAction();
  const grants = data?.grants ?? [], signups = data?.signups ?? [];
  const activos = grants.filter((g) => g.status === 'active'), paraPlay = activos.filter((g) => g.kind === 'tester' && g.phone_os !== 'iphone');

  const refrescar = () => { setSel(null); setPost(null); reload(); log.reload(); };
  const dar = (correo: string, n?: string, kind: api.Kind = 'tester', dias = 0) => run(async () => {
    const x = await api.grantAccess(correo, n, kind);
    if (dias !== 0) await api.setPro(correo, dias);
    toast(dado(x.has_account));
    setEmail(''); setNota(''); refrescar();
  });
  const enviar = (e: FormEvent) => { e.preventDefault(); if (email.trim()) void dar(email.trim(), nota.trim(), tipo, Number(pro)); };
  const darPro = (g: api.GrantRow, dias: number) => run(async () => { await api.setPro(g.email, dias); refrescar(); }, dias === 0 ? 'Plan Pro quitado' : 'Plan Pro actualizado');
  const invitar = (g: api.GrantRow) => run(async () => { const r = await api.mailInvite(g.email); toast(`Invitación enviada a ${r.to}`); refrescar(); mail.reload(); });
  const quitar = async (g: api.GrantRow) => {
    if (!(await confirm(`Vas a quitarle el acceso a ${g.email}. Su cuenta y sus entrenamientos no se tocan, pero con la app en solo invitados ya no va a poder entrar.`, { confirmLabel: 'Quitar acceso', danger: true }))) return;
    await run(async () => { await api.revokeAccess(g.email); refrescar(); }, 'Acceso quitado');
  };

  return (
    <div>
      <Card>
        <form onSubmit={enviar} className="grid gap-3 md:grid-cols-2 md:items-end">
          <Field label="Correo de la persona"><input type="email" required inputMode="email" autoComplete="off" placeholder="nombre@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Nota (opcional)"><input type="text" maxLength={200} placeholder="de dónde la conoces" value={nota} onChange={(e) => setNota(e.target.value)} /></Field>
          <Seg<api.Kind> options={[{ value: 'tester', label: 'Tester' }, { value: 'guest', label: 'Invitado' }]} value={tipo} onChange={setTipo} />
          <Field label="Plan Pro sin costo"><select value={pro} onChange={(e) => setPro(e.target.value)}>{PRO_OPC.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          <Btn type="submit" variant="primary" disabled={!email.trim()}>Dar acceso</Btn>
        </form>
        <p className="mt-3 text-sm text-mute">Tester o invitado es solo cómo lo anotas: los dos entran antes del lanzamiento. El plan Pro lo decides aparte, y los días corren desde hoy. Mientras la app esté en solo invitados, únicamente estos correos pueden crear una cuenta.</p>
      </Card>

      <H2 right={<span className="wd-c text-sm text-mute">{plural(activos.length, 'persona', 'personas')}</span>}>Con acceso</H2>
      {!data ? <Estado loading={loading} error={error} reload={reload} /> : grants.length === 0 ? (
        <Empty icon="user" title="Todavía no le has dado acceso a nadie" text="Escribe un correo arriba, o dale acceso a alguien desde la lista de aviso o desde las cuentas." />
      ) : (
        <>
          <Lista>
            {grants.map((g) => (
              <Fila key={g.email} titulo={g.email} onClick={() => setSel(g)}
                linea={`${TIPO[g.kind]}, ${g.status === 'revoked' ? '' : `${proDe(g)}, `}${g.status === 'revoked' ? `le quitaste el acceso ${hace(g.revoked_at)}` : g.has_account ? `con cuenta, acceso ${hace(g.granted_at)}` : g.invited_at ? `invitación enviada ${hace(g.invited_at)}` : 'esperando que cree su cuenta'}`}
                marcas={g.status === 'revoked' ? <Marca tono="ember">Sin acceso</Marca> : g.has_account ? <Marca tono="go">Activo</Marca> : <Marca tono="mute">En espera</Marca>} />
            ))}
          </Lista>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Btn size="sm" icon="copy" disabled={!paraPlay.length} onClick={() => void copiar(paraPlay.map((g) => g.email).join(', ')).then(() => toast(`${plural(paraPlay.length, 'correo copiado', 'correos copiados')}`))}>Copiar correos para Google Play</Btn>
            <span className="wd-c text-sm text-mute">Para pegarlos en la prueba cerrada cuando la abras.</span>
          </div>
        </>
      )}

      <H2 right={<span className="wd-c text-sm text-mute">{plural(signups.length, 'persona', 'personas')}</span>}>Postulaciones desde la página</H2>
      {data && signups.length === 0 ? (
        <p className="text-sm text-mute">La búsqueda de testers está en pausa, así que todavía no hay postulaciones. Cuando la actives, llegan aquí.</p>
      ) : (
        <Lista>
          {signups.map((s) => (
            <Fila key={s.email} titulo={s.name} onClick={() => setPost(s)}
              linea={`${s.email}, ${TEL[s.phone_os]}, ${DIAS[s.days_per_week] ?? s.days_per_week}`}
              marcas={s.access === 'active' ? <Marca tono="go">Con acceso</Marca> : <Marca tono="mute">Sin acceso</Marca>} />
          ))}
        </Lista>
      )}

      {log.data && log.data.length > 0 && (
        <>
          <H2>Últimos movimientos</H2>
          <ul className="space-y-1.5 text-sm text-mute">
            {log.data.map((x, i) => <li key={i}><span className="text-chalk">{ACCION[x.action] ?? x.action}</span>{x.target ? ` ${x.target}` : x.detail ? `: ${x.detail}` : ''}, {cuando(x.at)}</li>)}
          </ul>
        </>
      )}

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.email}>
        {sel && (
          <>
            <div className="mb-5">
              {sel.name && <Dato k="Nombre">{sel.name}</Dato>}
              <Dato k="Tipo">{TIPO[sel.kind]}</Dato>
              {sel.status === 'active' && <Dato k="Plan Pro">{proDe(sel)}</Dato>}
              <Dato k="Acceso">{sel.status === 'active' ? `dado el ${cuando(sel.granted_at)}` : `quitado el ${cuando(sel.revoked_at)}`}</Dato>
              <Dato k="Invitación por correo">{sel.invited_at ? `enviada el ${cuando(sel.invited_at)}` : 'sin enviar'}</Dato>
              <Dato k="Cuenta en la app">{sel.has_account ? 'sí' : 'todavía no'}</Dato>
              <Dato k="Teléfono">{sel.phone_os ? TEL[sel.phone_os] : 'no se sabe'}</Dato>
              {sel.note && <Dato k="Nota">{sel.note}</Dato>}
            </div>
            {sel.status === 'active' && (
              <div className="mb-5 rounded-xl bg-card2 p-3">
                <Field label={proVigente(sel) ? 'Cambiar el plan Pro' : 'Darle el plan Pro'}><select value={proSel} onChange={(e) => setProSel(e.target.value)}>{PRO_OPC.filter((o) => o.value !== '0').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                <div className="mt-2 flex gap-2">
                  <Btn className="flex-1" variant="go" onClick={() => void darPro(sel, Number(proSel))}>{proVigente(sel) ? 'Aplicar desde hoy' : 'Dar Pro'}</Btn>
                  {proVigente(sel) && <Btn className="flex-1" variant="danger" onClick={() => void darPro(sel, 0)}>Quitar Pro</Btn>}
                </div>
              </div>
            )}
            <div className="grid gap-2">
              {sel.status === 'active' ? (
                <>
                  {mail.status?.configured && <Btn variant="primary" onClick={() => void invitar(sel)}>{sel.invited_at ? 'Volver a enviar la invitación' : 'Enviar invitación por correo'}</Btn>}
                  <Btn variant={mail.status?.configured ? 'soft' : 'primary'} icon="copy" onClick={() => void copiar(mensajeAcceso(sel.email, sel.kind)).then(() => toast('Mensaje copiado. Pégalo donde le escribas.'))}>Copiar mensaje con el link</Btn>
                  <Btn onClick={() => setVer(true)}>Ver el correo de invitación</Btn>
                  <Btn variant="danger" onClick={() => void quitar(sel)}>Quitar acceso</Btn>
                </>
              ) : <Btn variant="primary" onClick={() => void dar(sel.email, undefined, sel.kind)}>Volver a dar acceso</Btn>}
            </div>
            {sel.status === 'active' && !mail.status?.configured && <p className="mt-4 text-xs text-mute">El correo de la app todavía no está conectado. Por ahora copia el mensaje y envíaselo tú.</p>}
          </>
        )}
      </Sheet>

      <VerCorreo which={ver && sel ? 'invitacion' : null} email={sel?.email} kind={sel?.kind} onClose={() => setVer(false)} />

      <Sheet open={!!post} onClose={() => setPost(null)} title={post?.name}>
        {post && (
          <>
            <div className="mb-5">
              <Dato k="Correo">{post.email}</Dato>
              <Dato k="Teléfono">{TEL[post.phone_os]}</Dato>
              <Dato k="Entrena">{DIAS[post.days_per_week] ?? post.days_per_week} por semana</Dato>
              <Dato k="Hoy anota en">{ANOTA[post.logs_in] ?? post.logs_in}</Dato>
              {post.contact && <Dato k="Prefiere que le escribas por">{post.contact}</Dato>}
              <Dato k="Postuló">{cuando(post.created_at)}</Dato>
              <Dato k="Cuenta en la app">{post.has_account ? 'sí' : 'todavía no'}</Dato>
            </div>
            <div className="grid gap-2">
              {post.access !== 'active' && <Btn variant="primary" onClick={() => void dar(post.email, `postuló como ${post.name}`, 'tester', Number(pro))}>Dar acceso como tester</Btn>}
              <Btn icon="copy" onClick={() => void copiar(mensajeAcceso(post.email)).then(() => toast('Mensaje copiado. Pégalo donde le escribas.'))}>Copiar mensaje con el link</Btn>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

// ───────────────────────── Cuentas ─────────────────────────
const PLAN: Record<string, string> = { trialing: 'Pro, en prueba gratis', active: 'Pro', grace: 'Pro, con un pago pendiente', canceled: 'Pro cancelado', expired: 'Pro vencido' };
const ORIGEN_PLAN: Record<string, string> = { trial: 'prueba gratis', founder: 'regalo de tester', manual: 'regalo', play: 'Google Play', web: 'pago en la web' };

function Cuentas() {
  const [q, setQ] = useState(''), [limit, setLimit] = useState(100), [sel, setSel] = useState<api.UserRow | null>(null);
  const lento = useLento(q);
  const { data, error, loading, reload } = useLoad(() => api.users(lento, limit), [lento, limit]);
  const { toast, confirm } = useUi(), run = useAction();
  const rows = data?.rows ?? [];

  const cerrar = () => { setSel(null); reload(); };
  const dar = (u: api.UserRow, kind: api.Kind) => run(async () => { if (!u.email) return; await api.grantAccess(u.email, 'desde las cuentas', kind); toast(dado(true)); cerrar(); });
  const quitar = async (u: api.UserRow) => {
    if (!u.email || !(await confirm(`Vas a quitarle el acceso a ${u.email}. Su cuenta y sus entrenamientos no se tocan, pero con la app en solo invitados ya no va a poder entrar.`, { confirmLabel: 'Quitar acceso', danger: true }))) return;
    await run(async () => { await api.revokeAccess(u.email!); cerrar(); }, 'Acceso quitado');
  };

  return (
    <div>
      <Buscar value={q} onChange={setQ} label="Buscar un correo" />
      <p className="wd-c mt-3 text-sm text-mute">{data ? plural(data.total, 'cuenta', 'cuentas') : ' '}</p>
      <div className="mt-3">
        {!data ? <Estado loading={loading} error={error} reload={reload} /> : rows.length === 0 ? (
          <Empty icon="user" title="Ninguna cuenta coincide" text="Prueba con otra parte del correo." />
        ) : (
          <Lista>
            {rows.map((u) => (
              <Fila key={u.id} titulo={u.email ?? 'sin correo'} onClick={() => setSel(u)}
                linea={`${plural(u.sessions, 'entrenamiento', 'entrenamientos')}, ${u.last_sign_in_at ? `entró ${hace(u.last_sign_in_at)}` : 'nunca entró'}`}
                marcas={<>{u.admin && <Marca tono="amber">Tú</Marca>}{u.access === 'active' && <Marca tono="go">Con acceso</Marca>}{!u.confirmed && <Marca tono="mute">Sin confirmar</Marca>}</>} />
            ))}
          </Lista>
        )}
        {data && rows.length < data.total && <Btn className="mt-3 w-full" onClick={() => setLimit((x) => x + 100)}>Ver más</Btn>}
      </div>

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.email ?? 'Cuenta'}>
        {sel && (
          <>
            <div className="mb-5">
              {sel.name && <Dato k="Nombre en el perfil">{sel.name}</Dato>}
              <Dato k="Creó la cuenta">{cuando(sel.created_at)}</Dato>
              <Dato k="Entra con">{sel.provider === 'google' ? 'Google' : 'correo y contraseña'}{sel.confirmed ? '' : ', sin confirmar el correo'}</Dato>
              <Dato k="Último ingreso">{cuando(sel.last_sign_in_at)}</Dato>
              <Dato k="Entrenamientos terminados">{sel.sessions}</Dato>
              <Dato k="Último entrenamiento">{sel.last_session ? hace(sel.last_session) : 'ninguno'}</Dato>
              <Dato k="Plan">{sel.plan_status ? `${PLAN[sel.plan_status] ?? sel.plan_status} (${ORIGEN_PLAN[sel.plan_source ?? ''] ?? sel.plan_source})` : 'gratis'}</Dato>
              <Dato k="Acceso a la app">{sel.admin ? 'sí, administras' : sel.access === 'active' ? 'sí' : sel.access === 'revoked' ? 'se lo quitaste' : 'no'}</Dato>
            </div>
            <div className="grid gap-2">
              {sel.email && !sel.admin && sel.access !== 'active' && <Btn variant="primary" onClick={() => void dar(sel, 'tester')}>Dar acceso como tester</Btn>}
              {sel.email && !sel.admin && sel.access !== 'active' && <Btn onClick={() => void dar(sel, 'guest')}>Dar acceso como invitado</Btn>}
              {sel.email && sel.access === 'active' && <Btn variant="danger" onClick={() => void quitar(sel)}>Quitar acceso</Btn>}
              {sel.email && <Btn icon="copy" onClick={() => void copiar(sel.email!).then(() => toast('Correo copiado'))}>Copiar correo</Btn>}
            </div>
            <p className="mt-4 text-xs text-mute">Aquí se ve cuánto usa la app cada cuenta, no lo que entrena. Borrar una cuenta lo hace cada persona desde su perfil.</p>
          </>
        )}
      </Sheet>
    </div>
  );
}

// ───────────────────────── Pantalla ─────────────────────────
// Lo que cada función significa para quien usa la app. El orden es el de la lista de beneficios de Pro.
const FUNCION: Record<Feature, { titulo: string; nota: string }> = {
  supersets: { titulo: 'Biseries y triseries', nota: 'Unir dos o tres ejercicios en una ronda.' },
  techniques: { titulo: 'Técnicas avanzadas', nota: 'Dropset, descanso-pausa, myo-reps y cluster.' },
  suggestions: { titulo: 'Recomendación de carga', nota: 'El peso sugerido para la próxima sesión, con su motivo.' },
  templates: { titulo: 'Plantillas de rutinas', nota: 'Crear una rutina desde una plantilla lista.' },
  warmup: { titulo: 'Calentamiento calculado', nota: 'Las series previas con su peso.' },
  recovery: { titulo: 'Recuperación por músculo', nota: 'Fatiga y recuperación de cada grupo muscular.' },
  assistant: { titulo: 'Asistente', nota: 'Respuestas con el historial de la persona.' },
};
interface Borrador { rutinas: number; ejercicios: number; historial: number; prueba: number; pruebaTarjeta: number; soloPro: Feature[]; clpMes: number; clpAno: number; usdMes: number; usdAno: number }
const aBorrador = (v: api.PlanCfg): Borrador => {
  const b = parseBilling(v), n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  const pr = (v.prices ?? {}) as Record<string, Record<string, unknown> | undefined>;
  return {
    rutinas: b?.freeRoutines ?? 2, ejercicios: b?.freeCustomExercises ?? 3, historial: b?.freeHistoryDays ?? 30, prueba: b?.trialDays ?? 7, pruebaTarjeta: b?.cardTrialDays ?? 21,
    soloPro: b?.proOnly ?? [...FEATURES], clpMes: n(pr.CLP?.monthly), clpAno: n(pr.CLP?.yearly), usdMes: n(pr.USD?.monthly), usdAno: n(pr.USD?.yearly),
  };
};

export function Planes() {
  const { data, error, loading, reload } = useLoad(api.plans, []);
  const [b, setB] = useState<Borrador | null>(null);
  const run = useAction();
  useEffect(() => { if (data) setB(aBorrador(data)); }, [data]);
  if (!data || !b) return <Estado loading={loading} error={error} reload={reload} />;
  const base = aBorrador(data), cambio = JSON.stringify(base) !== JSON.stringify(b);
  const set = (x: Partial<Borrador>) => setB({ ...b, ...x });
  const alternar = (f: Feature) => set({ soloPro: b.soloPro.includes(f) ? b.soloPro.filter((x) => x !== f) : FEATURES.filter((x) => x === f || b.soloPro.includes(x)) });
  const preciosOk = b.clpMes > 0 && b.clpAno > 0 && b.usdMes > 0 && b.usdAno > 0;
  const guardar = () => run(async () => {
    await api.setPlans({
      free_routines: b.rutinas, free_custom_exercises: b.ejercicios, free_history_days: b.historial, trial_days: b.prueba, card_trial_days: b.pruebaTarjeta, pro_only: b.soloPro,
      prices: { CLP: { monthly: Math.round(b.clpMes), yearly: Math.round(b.clpAno) }, USD: { monthly: b.usdMes, yearly: b.usdAno } },
    });
    reload();
  }, 'Planes guardados');
  const encendido = data.enabled === true;

  return (
    <div>
      <Card>
        <p className="font-semibold">{encendido ? 'El cobro está encendido.' : 'El cobro está apagado.'}</p>
        <p className="mt-1 text-sm text-mute">{encendido ? 'Lo que guardes aquí rige de inmediato para todas las cuentas.' : 'Hoy todo es gratis para todos. Lo que guardes aquí empieza a regir cuando se encienda el cobro; tu cuenta ya lo ve, para que puedas probarlo.'}</p>
      </Card>

      <H2>Plan gratis</H2>
      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <Stepper label="Rutinas propias" value={b.rutinas} min={1} max={50} onChange={(v) => set({ rutinas: Math.round(v) })} />
          <Stepper label="Ejercicios propios" value={b.ejercicios} min={0} max={500} onChange={(v) => set({ ejercicios: Math.round(v) })} />
          <Stepper label="Días de historial en el análisis" value={b.historial} min={7} max={3650} step={7} onChange={(v) => set({ historial: Math.round(v) })} />
        </div>
        <p className="mt-3 text-sm text-mute">Con Pro no hay límite en ninguno de los tres. Bajar un límite no borra nada: quien ya tiene más rutinas o ejercicios los conserva, pero no puede crear otros.</p>
      </Card>

      <H2 right={<span className="wd-c text-sm text-mute">{plural(b.soloPro.length, 'función solo Pro', 'funciones solo Pro')}</span>}>Qué funciones pide Pro</H2>
      <Card className="divide-y divide-line !py-1">
        {FEATURES.map((f) => (
          <label key={f} className="flex min-h-[3.25rem] items-center justify-between gap-3 py-2.5">
            <span className="min-w-0"><span className="block font-semibold">{FUNCION[f].titulo}</span><span className="block text-sm text-mute">{FUNCION[f].nota}</span></span>
            <span className="flex shrink-0 items-center gap-2 text-sm text-mute"><span>{b.soloPro.includes(f) ? 'Solo Pro' : 'Gratis'}</span><input type="checkbox" aria-label={`${FUNCION[f].titulo}: solo Pro`} checked={b.soloPro.includes(f)} onChange={() => alternar(f)} /></span>
          </label>
        ))}
      </Card>
      <p className="mt-2 text-sm text-mute">Lo que alguien creó mientras tenía Pro no se le quita: una biserie ya armada sigue funcionando.</p>

      <H2>Prueba gratis</H2>
      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <Stepper label="Días sin medio de pago" value={b.prueba} min={1} max={60} onChange={(v) => set({ prueba: Math.round(v) })} />
          <Stepper label="Días al suscribirse con medio de pago" value={b.pruebaTarjeta} min={0} max={60} onChange={(v) => set({ pruebaTarjeta: Math.round(v) })} />
        </div>
        <p className="mt-3 text-sm text-mute">Los días ya usados sin medio de pago se descuentan de los segundos. El cambio vale para las pruebas que empiecen desde ahora.</p>
      </Card>

      <H2>Precio de Pro</H2>
      <Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stepper label="Mensual en pesos" value={b.clpMes} min={0} max={1000000} step={500} onChange={(v) => set({ clpMes: Math.round(v) })} />
          <Stepper label="Anual en pesos" value={b.clpAno} min={0} max={10000000} step={1000} onChange={(v) => set({ clpAno: Math.round(v) })} />
          <Stepper label="Mensual en dólares" value={b.usdMes} min={0} max={10000} step={0.5} onChange={(v) => set({ usdMes: v })} />
          <Stepper label="Anual en dólares" value={b.usdAno} min={0} max={100000} step={1} onChange={(v) => set({ usdAno: v })} />
        </div>
        <p className="mt-3 text-sm text-mute">Es el precio que muestra la app y el que cobra Mercado Pago en pesos a quien se suscriba desde ahora. Las suscripciones ya activas siguen con su precio.</p>
      </Card>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Btn variant="primary" disabled={!cambio || !preciosOk} onClick={() => void guardar()}>Guardar planes</Btn>
        {cambio && <Btn onClick={() => setB(base)}>Descartar cambios</Btn>}
        {!preciosOk && <span className="text-sm text-ember">Los cuatro precios deben ser mayores que cero.</span>}
      </div>
    </div>
  );
}

type Tab = 'resumen' | 'aviso' | 'accesos' | 'planes' | 'cuentas';
const TABS: { value: Tab; label: string }[] = [{ value: 'resumen', label: 'Resumen' }, { value: 'aviso', label: 'Aviso' }, { value: 'accesos', label: 'Accesos' }, { value: 'planes', label: 'Planes' }, { value: 'cuentas', label: 'Cuentas' }];

export default function Panel() {
  const uid = useUserId();
  const [ok, setOk] = useState<boolean | null>(api.adminKnown(uid) ? true : null);
  const [tab, setTab] = useState<Tab>('resumen');
  useEffect(() => { let on = true; void api.isAdmin(uid).then((v) => { if (on) setOk(v); }); return () => { on = false; }; }, [uid]);

  // Estado del correo de la app. Si la función del servidor no responde, se trata como sin conectar.
  const [estado, setEstado] = useState<api.MailStatus | null>(null), [vez, setVez] = useState(0);
  useEffect(() => { if (!ok) return; let on = true; api.mailStatus().then((s) => { if (on) setEstado(s); }, () => { if (on) setEstado(null); }); return () => { on = false; }; }, [ok, vez]);
  const mail: Mail = { status: estado, reload: () => setVez((v) => v + 1) };

  if (ok === null) return <p className="py-8 text-center text-sm text-mute">Cargando…</p>;
  if (!ok) return <div data-notr><Empty icon="info" title="Esta pantalla es de administración" text="Solo la ve la cuenta que administra la app. Si eres tú, inicia sesión con esa cuenta." /></div>;
  return (
    <div data-notr>
      <Title sub="Solo tú ves esta pantalla.">Panel</Title>
      <div className="mb-5"><Seg options={TABS} value={tab} onChange={setTab} /></div>
      {tab === 'resumen' ? <Resumen mail={mail} /> : tab === 'aviso' ? <Aviso mail={mail} /> : tab === 'accesos' ? <Accesos mail={mail} /> : tab === 'planes' ? <Planes /> : <Cuentas />}
    </div>
  );
}
