// Panel interno: inscritos al aviso de lanzamiento, cuentas y accesos de testers.
// Solo en español y solo para quien administra la app; el servidor rechaza a cualquier otra cuenta.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useUserId } from '../hooks';
import { Bar, Btn, Card, cx, Empty, Field, H2, Icon, Seg, Sheet, Stat, Title, useAction, useUi } from '../ui/components';
import * as api from './api';

const APP = 'https://app.ironintelligence.app', WEB = 'https://ironintelligence.app';
const TEL: Record<string, string> = { android: 'Android', iphone: 'iPhone' };
const DIAS: Record<string, string> = { '1-2': '1 a 2 días', '3-4': '3 a 4 días', '5+': '5 días o más' };
const ANOTA: Record<string, string> = { notas: 'notas del teléfono', papel: 'papel', otra_app: 'otra app', ninguna: 'en ninguna parte' };
const ACCION: Record<string, string> = { dar_acceso: 'Acceso dado a', quitar_acceso: 'Acceso quitado a', borrar_del_aviso: 'Borrado del aviso', marcar_avisados: 'Marcados como avisados' };

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
const mensajeTester = (email: string) => [
  'Hola. Ya tienes acceso a IRON INTELLIGENCE como tester.',
  `Entra desde tu teléfono: ${APP}`,
  `Crea tu cuenta con este mismo correo (${email}) para que se active tu acceso.`,
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

// ───────────────────────── Resumen ─────────────────────────
function Resumen() {
  const { data, error, loading, reload } = useLoad(api.overview, []);
  const { toast } = useUi();
  if (!data) return <Estado loading={loading} error={error} reload={reload} />;
  const l = data.launch, max = Math.max(1, ...data.by_day.map((x) => x.n)), top = Math.max(1, ...data.by_source.map((x) => x.n));
  const links = [{ red: 'TikTok', url: `${WEB}/?o=tiktok` }, { red: 'Instagram', url: `${WEB}/?o=instagram` }];
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><Stat label="Inscritos al aviso" value={l.total} sub={`${l.today} hoy, ${l.week} en 7 días`} color="#ff6a1a" /></Card>
        <Card><Stat label="Cuentas creadas" value={data.users.total} sub={`${data.users.active_week} entraron esta semana`} /></Card>
        <Card><Stat label="Con entrenamientos" value={data.training} sub="ya guardaron sesiones" /></Card>
        <Card><Stat label="Testers con acceso" value={data.testers.access} sub={`${data.testers.with_account} ya tienen cuenta`} /></Card>
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
    </div>
  );
}

// ───────────────────────── Aviso de lanzamiento ─────────────────────────
function Aviso() {
  const [q, setQ] = useState(''), [limit, setLimit] = useState(200), [sel, setSel] = useState<api.LaunchRow | null>(null);
  const lento = useLento(q);
  const { data, error, loading, reload } = useLoad(() => api.launchList(lento, limit), [lento, limit]);
  const { toast, confirm } = useUi(), run = useAction();
  const rows = data?.rows ?? [], pendientes = rows.filter((r) => !r.notified_at);

  const cerrar = () => { setSel(null); reload(); };
  const dar = (r: api.LaunchRow) => run(async () => {
    const x = await api.grantAccess(r.email, 'desde la lista de aviso');
    toast(x.has_account ? 'Acceso dado. Su cuenta ya quedó como tester.' : 'Acceso dado. Se activa cuando cree su cuenta con ese correo.');
    cerrar();
  });
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
                marcas={<>{r.notified_at && <Marca tono="go">Avisado</Marca>}{r.access === 'active' && <Marca tono="amber">Tester</Marca>}{r.has_account && <Marca tono="data">Con cuenta</Marca>}</>} />
            ))}
          </Lista>
        )}
        {data && rows.length < data.total && <Btn className="mt-3 w-full" onClick={() => setLimit((x) => x + 200)}>Ver más</Btn>}
      </div>

      <H2>El día del lanzamiento</H2>
      <p className="mb-3 text-sm text-mute">El envío del correo con el link todavía no está conectado a este panel. Ese día puedes copiar los correos pendientes, escribirles desde tu correo y dejarlos marcados aquí.</p>
      <Btn disabled={!pendientes.length} onClick={() => void marcar()}>Marcar pendientes como avisados</Btn>

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.email}>
        {sel && (
          <>
            <div className="mb-5">
              <Dato k="Se inscribió">{cuando(sel.created_at)}</Dato>
              <Dato k="Teléfono">{sel.phone_os ? TEL[sel.phone_os] : 'no dijo'}</Dato>
              <Dato k="Llegó desde">{sel.source ?? 'entró directo a la página'}</Dato>
              <Dato k="Aviso de lanzamiento">{sel.notified_at ? `enviado el ${cuando(sel.notified_at)}` : 'pendiente'}</Dato>
              <Dato k="Cuenta en la app">{sel.has_account ? 'sí' : 'todavía no'}</Dato>
              <Dato k="Acceso de tester">{sel.access === 'active' ? 'sí' : sel.access === 'revoked' ? 'se lo quitaste' : 'no'}</Dato>
            </div>
            <div className="grid gap-2">
              {sel.access !== 'active' && <Btn variant="primary" onClick={() => void dar(sel)}>Dar acceso de tester</Btn>}
              <Btn icon="copy" onClick={() => void copiar(sel.email).then(() => toast('Correo copiado'))}>Copiar correo</Btn>
              <Btn variant="danger" icon="trash" onClick={() => void borrar(sel)}>Borrar de la lista</Btn>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

// ───────────────────────── Testers y accesos ─────────────────────────
function Testers() {
  const { data, error, loading, reload } = useLoad(api.testers, []);
  const log = useLoad(api.activity, []);
  const [email, setEmail] = useState(''), [nota, setNota] = useState('');
  const [sel, setSel] = useState<api.GrantRow | null>(null), [post, setPost] = useState<api.SignupRow | null>(null);
  const { toast, confirm } = useUi(), run = useAction();
  const grants = data?.grants ?? [], signups = data?.signups ?? [];
  const activos = grants.filter((g) => g.status === 'active'), paraPlay = activos.filter((g) => g.phone_os !== 'iphone');

  const refrescar = () => { setSel(null); setPost(null); reload(); log.reload(); };
  const dar = (correo: string, n?: string) => run(async () => {
    const x = await api.grantAccess(correo, n);
    toast(x.has_account ? 'Acceso dado. Su cuenta ya quedó como tester.' : 'Acceso dado. Se activa cuando cree su cuenta con ese correo.');
    setEmail(''); setNota(''); refrescar();
  });
  const enviar = (e: FormEvent) => { e.preventDefault(); if (email.trim()) void dar(email.trim(), nota.trim()); };
  const quitar = async (g: api.GrantRow) => {
    if (!(await confirm(`Vas a quitarle el acceso de tester a ${g.email}. Su cuenta y sus entrenamientos no se tocan.`, { confirmLabel: 'Quitar acceso', danger: true }))) return;
    await run(async () => { await api.revokeAccess(g.email); refrescar(); }, 'Acceso quitado');
  };

  return (
    <div>
      <Card>
        <form onSubmit={enviar} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Field label="Correo de la persona"><input type="email" required inputMode="email" autoComplete="off" placeholder="nombre@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Nota (opcional)"><input type="text" maxLength={200} placeholder="de dónde la conoces" value={nota} onChange={(e) => setNota(e.target.value)} /></Field>
          <Btn type="submit" variant="primary" disabled={!email.trim()}>Dar acceso</Btn>
        </form>
        <p className="mt-3 text-sm text-mute">Queda como tester y con el plan Pro sin costo. Si todavía no tiene cuenta, el acceso espera y se activa cuando la cree con ese correo.</p>
      </Card>

      <H2 right={<span className="wd-c text-sm text-mute">{plural(activos.length, 'persona', 'personas')}</span>}>Con acceso</H2>
      {!data ? <Estado loading={loading} error={error} reload={reload} /> : grants.length === 0 ? (
        <Empty icon="user" title="Todavía no le has dado acceso a nadie" text="Escribe un correo arriba, o dale acceso a alguien desde la lista de aviso o desde las cuentas." />
      ) : (
        <>
          <Lista>
            {grants.map((g) => (
              <Fila key={g.email} titulo={g.email} onClick={() => setSel(g)}
                linea={g.status === 'revoked' ? `le quitaste el acceso ${hace(g.revoked_at)}` : g.has_account ? `con cuenta, acceso ${hace(g.granted_at)}` : 'esperando que cree su cuenta'}
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
              <Dato k="Acceso">{sel.status === 'active' ? `dado el ${cuando(sel.granted_at)}` : `quitado el ${cuando(sel.revoked_at)}`}</Dato>
              <Dato k="Cuenta en la app">{sel.has_account ? 'sí' : 'todavía no'}</Dato>
              <Dato k="Teléfono">{sel.phone_os ? TEL[sel.phone_os] : 'no se sabe'}</Dato>
              {sel.note && <Dato k="Nota">{sel.note}</Dato>}
            </div>
            <div className="grid gap-2">
              {sel.status === 'active' ? (
                <>
                  <Btn variant="primary" icon="copy" onClick={() => void copiar(mensajeTester(sel.email)).then(() => toast('Mensaje copiado. Pégalo donde le escribas.'))}>Copiar mensaje con el link</Btn>
                  <Btn variant="danger" onClick={() => void quitar(sel)}>Quitar acceso</Btn>
                </>
              ) : <Btn variant="primary" onClick={() => void dar(sel.email)}>Volver a dar acceso</Btn>}
            </div>
          </>
        )}
      </Sheet>

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
              {post.access !== 'active' && <Btn variant="primary" onClick={() => void dar(post.email, `postuló como ${post.name}`)}>Dar acceso de tester</Btn>}
              <Btn icon="copy" onClick={() => void copiar(mensajeTester(post.email)).then(() => toast('Mensaje copiado. Pégalo donde le escribas.'))}>Copiar mensaje con el link</Btn>
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
  const dar = (u: api.UserRow) => run(async () => { if (!u.email) return; await api.grantAccess(u.email, 'desde las cuentas'); toast('Acceso dado. Su cuenta ya quedó como tester.'); cerrar(); });
  const quitar = async (u: api.UserRow) => {
    if (!u.email || !(await confirm(`Vas a quitarle el acceso de tester a ${u.email}. Su cuenta y sus entrenamientos no se tocan.`, { confirmLabel: 'Quitar acceso', danger: true }))) return;
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
                marcas={<>{u.admin && <Marca tono="amber">Tú</Marca>}{u.access === 'active' && <Marca tono="go">Tester</Marca>}{!u.confirmed && <Marca tono="mute">Sin confirmar</Marca>}</>} />
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
              <Dato k="Acceso de tester">{sel.access === 'active' ? 'sí' : sel.access === 'revoked' ? 'se lo quitaste' : 'no'}</Dato>
            </div>
            <div className="grid gap-2">
              {sel.email && sel.access !== 'active' && <Btn variant="primary" onClick={() => void dar(sel)}>Dar acceso de tester</Btn>}
              {sel.email && sel.access === 'active' && <Btn variant="danger" onClick={() => void quitar(sel)}>Quitar acceso de tester</Btn>}
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
type Tab = 'resumen' | 'aviso' | 'testers' | 'cuentas';
const TABS: { value: Tab; label: string }[] = [{ value: 'resumen', label: 'Resumen' }, { value: 'aviso', label: 'Aviso' }, { value: 'testers', label: 'Testers' }, { value: 'cuentas', label: 'Cuentas' }];

export default function Panel() {
  const uid = useUserId();
  const [ok, setOk] = useState<boolean | null>(api.adminKnown(uid) ? true : null);
  const [tab, setTab] = useState<Tab>('resumen');
  useEffect(() => { let on = true; void api.isAdmin(uid).then((v) => { if (on) setOk(v); }); return () => { on = false; }; }, [uid]);

  if (ok === null) return <p className="py-8 text-center text-sm text-mute">Cargando…</p>;
  if (!ok) return <div data-notr><Empty icon="info" title="Esta pantalla es de administración" text="Solo la ve la cuenta que administra la app. Si eres tú, inicia sesión con esa cuenta." /></div>;
  return (
    <div data-notr>
      <Title sub="Solo tú ves esta pantalla.">Panel</Title>
      <div className="mb-5"><Seg options={TABS} value={tab} onChange={setTab} /></div>
      {tab === 'resumen' ? <Resumen /> : tab === 'aviso' ? <Aviso /> : tab === 'testers' ? <Testers /> : <Cuentas />}
    </div>
  );
}
