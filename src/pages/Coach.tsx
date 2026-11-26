// Modo entrenador: el deportista invita con un código y decide cuándo cortar el acceso.
import { useEffect, useMemo, useState } from 'react';
import { acceptInvite, clientData, createInvite, myLinks, removeLink, sendRoutine, type ClientData, type CoachLink } from '../data/coach';
import { DAY, fmtDate, fmtKg, weekStart } from '../domain/calc';
import { LIBRARY, mergeExercises } from '../domain/exerciseLibrary';
import { MUSCLE_LABEL } from '../domain/muscles';
import { exerciseProgress, fmtPct, muscleProgress, PROGRESS_COLOR, progressState } from '../domain/progress';
import { inWeek, mainSets, muscleVolume, tonnage } from '../domain/volume';
import { useProfile, useRoutines, useUserId } from '../hooks';
import { Btn, Card, Empty, Field, H2, Sheet, Title, useAction, useUi } from '../ui/components';
import { shareText } from '../ui/shareCard';

function ClientView({ link, onClose }: { link: CoachLink; onClose: () => void }) {
  const run = useAction(); const routines = useRoutines() ?? [];
  const [data, setData] = useState<ClientData | null>(null);
  useEffect(() => { void run(() => clientData(link.client_id)).then((d) => setData(d ?? { sessions: [], sets: [], custom: [], setCount: new Map() })); }, [link.client_id, run]);
  const ex = useMemo(() => new Map((data ? mergeExercises(data.custom) : LIBRARY).map((e) => [e.id, e])), [data]);
  const weeks = useMemo(() => { const cur = weekStart(Date.now()); return Array.from({ length: 8 }, (_, i) => { const st = cur - (7 - i) * 7 * DAY; return (data?.sessions ?? []).filter((s) => s.startedAt >= st && s.startedAt < st + 7 * DAY).length; }); }, [data]);
  const vol = useMemo(() => (data ? muscleVolume(inWeek(data.sets, weekStart(Date.now())), ex, 0.5).filter((v) => v.direct > 0).sort((a, b) => b.direct - a.direct).slice(0, 6) : []), [data, ex]);
  // Semana en curso frente a la anterior, y progreso de las 8 semanas que el entrenador puede ver.
  const cmp = useMemo(() => {
    const cur = weekStart(Date.now()), a = inWeek(data?.sets ?? [], cur), b = inWeek(data?.sets ?? [], cur - 7 * DAY);
    return { series: [mainSets(a).length, mainSets(b).length], carga: [tonnage(a), tonnage(b)] };
  }, [data]);
  const prog = useMemo(() => (data ? exerciseProgress(data.sets, ex) : []), [data, ex]);
  const progM = useMemo(() => muscleProgress(prog), [prog]);
  return (
    <Sheet open onClose={onClose} title={link.client_name || 'Deportista'} wide>
      {!data ? <p className="py-6 text-center text-sm text-mute">Cargando…</p> : (
        <div className="space-y-4">
          <div>
            <div className="label mb-1.5">Sesiones por semana (8 semanas)</div>
            <div className="flex h-16 items-end gap-1.5" aria-hidden>{weeks.map((n, i) => <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(6, Math.min(100, n * 20))}%`, background: n ? '#34e0a1' : 'rgba(180,205,255,.18)' }} />)}</div>
            <div className="mt-1 text-sm text-mute">Esta semana: {weeks[7]} {weeks[7] === 1 ? 'sesión' : 'sesiones'}.</div>
          </div>
          <div>
            <div className="label mb-1.5">Series directas esta semana</div>
            {vol.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">{vol.map((v) => <div key={v.muscle} className="flex justify-between gap-2"><span>{MUSCLE_LABEL[v.muscle]}</span><span className="font-semibold tnum">{v.direct}</span></div>)}</div> : <p className="text-sm text-mute">Aún no entrena esta semana.</p>}
          </div>
          <div>
            <div className="label mb-1.5">Esta semana frente a la anterior</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="flex justify-between gap-2"><span>Series</span><span className="font-semibold tnum">{cmp.series[0]} <span className="font-normal text-mute">antes {cmp.series[1]}</span></span></div>
              <div className="flex justify-between gap-2"><span>Carga movida</span><span className="font-semibold tnum">{(cmp.carga[0] / 1000).toFixed(1)} t <span className="font-normal text-mute">antes {(cmp.carga[1] / 1000).toFixed(1)} t</span></span></div>
            </div>
          </div>
          <div>
            <div className="label mb-1.5">Progreso por músculo (8 semanas)</div>
            {progM.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">{progM.map((m) => <div key={m.muscle} className="flex justify-between gap-2"><span>{MUSCLE_LABEL[m.muscle]}</span><span className="font-semibold tnum" style={{ color: PROGRESS_COLOR[progressState(m.pct)] }}>{fmtPct(m.pct)}</span></div>)}</div> : <p className="text-sm text-mute">Se necesitan 2 o más sesiones de un mismo ejercicio.</p>}
          </div>
          {prog.length > 0 && (
            <div>
              <div className="label mb-1.5">Progreso por ejercicio</div>
              <div className="space-y-1.5">
                {[...prog].sort((a, b) => b.sessions - a.sessions).slice(0, 8).map((x) => (
                  <div key={x.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0"><span className="block truncate">{x.name}</span><span className="block text-xs text-mute tnum">{fmtKg(x.from)} → {fmtKg(x.to)} kg de 1RM estimado, {x.sessions} sesiones</span></span>
                    <span className="shrink-0 font-bold tnum" style={{ color: PROGRESS_COLOR[progressState(x.pct)] }}>{fmtPct(x.pct)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-mute">Cambio del 1RM estimado entre sus primeras y sus últimas sesiones. Las series de calentamiento no cuentan.</p>
            </div>
          )}
          <div>
            <div className="label mb-1.5">Últimos entrenamientos</div>
            <div className="space-y-1.5">
              {data.sessions.slice(0, 6).map((s) => <div key={s.id} className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate font-semibold">{s.name}</span><span className="wd-c shrink-0 text-mute tnum">{fmtDate(s.startedAt)}, {data.setCount.get(s.id) ?? 0} series, {(tonnage(data.sets.filter((x) => x.sessionId === s.id)) / 1000).toFixed(1).replace('.', ',')} t</span></div>)}
              {!data.sessions.length && <p className="text-sm text-mute">Sin entrenamientos en las últimas 8 semanas.</p>}
            </div>
          </div>
          <div>
            <div className="label mb-1.5">Enviarle una de mis rutinas</div>
            <div className="space-y-1.5">
              {routines.map((r) => <Btn key={r.id} className="w-full !justify-between" onClick={() => run(() => sendRoutine(link.client_id, r.id), `“${r.name}” enviada: le llegará al sincronizar`)}>{r.name}<span className="wd-c text-sm text-mute">Enviar</span></Btn>)}
              {!routines.length && <p className="text-sm text-mute">Crea una rutina en tu cuenta para poder enviársela.</p>}
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export default function Coach() {
  const uid = useUserId(); const p = useProfile(); const run = useAction(); const { confirm, toast } = useUi();
  const [links, setLinks] = useState<{ asClient: CoachLink[]; asCoach: CoachLink[] } | null>(null);
  const [code, setCode] = useState(''); const [view, setView] = useState<CoachLink | null>(null);
  const load = () => run(myLinks).then((l) => setLinks(l ?? { asClient: [], asCoach: [] }));
  useEffect(() => { if (uid !== 'local') void load(); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps
  if (uid === 'local') return <div><Title>Entrenador</Title><Empty icon="user" title="Necesitas una cuenta" text="El modo entrenador conecta dos cuentas. Inicia sesión en Perfil para usarlo." /></div>;
  const unlink = async (l: CoachLink, text: string) => { if (await confirm(text, { confirmLabel: 'Quitar', danger: true })) { await run(() => removeLink(l.id), 'Vínculo eliminado'); void load(); } };
  return (
    <div>
      <Title sub="Tú decides quién ve tus entrenamientos">Entrenador</Title>
      <H2>Mi entrenador</H2>
      <Card className="space-y-3">
        <p className="text-sm text-mute">Tu entrenador verá tus entrenamientos, series, rutinas y ejercicios propios, y podrá enviarte rutinas. No verá tu recuperación, peso, medidas ni perfil. Puedes quitarle el acceso cuando quieras.</p>
        {links?.asClient.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 rounded-ctl bg-card2 p-3">
            {l.accepted_at ? <span className="min-w-0"><span className="block truncate font-semibold">{l.coach_name || 'Entrenador'}</span><span className="block text-sm text-mute">Con acceso desde el {fmtDate(new Date(l.accepted_at).getTime())}</span></span>
              : <span className="min-w-0"><span className="num block text-xl tracking-[.18em]">{l.code}</span><span className="block text-sm text-mute">Código sin usar, vence en 7 días</span></span>}
            <span className="flex shrink-0 gap-1.5">
              {!l.accepted_at && <Btn size="sm" onClick={async () => { if ((await shareText(`Código para entrenarme en Iron Intelligence: ${l.code}`)) === 'copied') toast('Código copiado'); }}>Enviar</Btn>}
              <Btn size="sm" variant="danger" aria-label={l.accepted_at ? `Quitar acceso a ${l.coach_name || 'entrenador'}` : 'Cancelar invitación'} onClick={() => unlink(l, l.accepted_at ? `${l.coach_name || 'Tu entrenador'} dejará de ver tus datos.` : 'El código dejará de servir.')}>Quitar</Btn>
            </span>
          </div>
        ))}
        <Btn className="w-full" icon="plus" onClick={async () => { if (await run(() => createInvite(p.name || 'Deportista'), 'Invitación creada')) void load(); }}>Invitar a mi entrenador</Btn>
      </Card>
      <H2>Mis deportistas</H2>
      <Card className="space-y-3">
        <Field label="Código que te pasó tu deportista">
          <div className="flex gap-2">
            <input aria-label="Código de invitación" value={code} maxLength={16} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="8 letras y números" />
            <Btn variant="primary" disabled={code.trim().length < 6} onClick={async () => { await run(async () => { await acceptInvite(code, p.name || 'Entrenador'); setCode(''); }, 'Deportista vinculado'); void load(); }}>Vincular</Btn>
          </div>
        </Field>
        {links?.asCoach.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 rounded-ctl bg-card2 p-3">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setView(l)}><span className="block truncate font-semibold">{l.client_name || 'Deportista'}</span><span className="block text-sm text-data">Ver entrenamientos y enviar rutina</span></button>
            <Btn size="sm" variant="danger" aria-label={`Dejar de entrenar a ${l.client_name || 'deportista'}`} onClick={() => unlink(l, `Dejarás de ver los datos de ${l.client_name || 'este deportista'}.`)}>Quitar</Btn>
          </div>
        ))}
        {links && !links.asCoach.length && <p className="text-sm text-mute">Aún no tienes deportistas vinculados.</p>}
      </Card>
      {view && <ClientView link={view} onClose={() => setView(null)} />}
    </div>
  );
}
