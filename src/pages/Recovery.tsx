import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../data/db';
import { mine, saveBodyWeight, saveRecovery, softDelete } from '../data/repo';
import { fmtKg, ymd } from '../domain/calc';
import { fatigueStatus, LEVEL_COLOR, readinessOf } from '../domain/recovery';
import { useDoneSets, useUserId } from '../hooks';
import { LineC } from '../ui/charts';
import { Btn, Card, Empty, H2, Icon, Stepper, Title, useAction } from '../ui/components';

const SCALES = [
  { key: 'sleepQuality', label: 'Calidad del sueño', lo: 'Muy mala', hi: 'Excelente' },
  { key: 'fatigue', label: 'Fatiga general', lo: 'Fresco', hi: 'Agotado' },
  { key: 'soreness', label: 'Dolor muscular', lo: 'Nada', hi: 'Mucho' },
  { key: 'motivation', label: 'Motivación', lo: 'Baja', hi: 'Alta' },
  { key: 'stress', label: 'Estrés', lo: 'Bajo', hi: 'Alto' },
] as const;
type Vals = { sleepHours: number; sleepQuality: number; fatigue: number; soreness: number; motivation: number; stress: number };
const DEFAULTS: Vals = { sleepHours: 7, sleepQuality: 3, fatigue: 3, soreness: 2, motivation: 3, stress: 3 };

export default function Recovery() {
  const uid = useUserId(); const run = useAction();
  const logs = useLiveQuery(async () => mine(await db.recovery.toArray()).sort((a, b) => b.date.localeCompare(a.date)), [uid]);
  const weights = useLiveQuery(async () => mine(await db.bodyWeights.toArray()).sort((a, b) => a.date.localeCompare(b.date)), [uid]);
  const sets = useDoneSets() ?? [];
  const today = ymd(Date.now());
  const todayLog = logs?.find((l) => l.date === today);
  const [v, setV] = useState<Vals>(DEFAULTS);
  const [kg, setKg] = useState(75);
  useEffect(() => { if (todayLog) setV({ sleepHours: todayLog.sleepHours, sleepQuality: todayLog.sleepQuality, fatigue: todayLog.fatigue, soreness: todayLog.soreness, motivation: todayLog.motivation, stress: todayLog.stress }); }, [todayLog?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const last = weights?.[weights.length - 1]; if (last) setKg(last.kg); }, [weights?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const status = useMemo(() => fatigueStatus(sets, logs ?? [], Date.now()), [sets, logs]);

  return (
    <div>
      <Title sub="Contexto para tus recomendaciones">Recuperación</Title>
      <Card className="mb-4" >
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 text-xl font-extrabold tnum" style={{ borderColor: LEVEL_COLOR[status.level], color: LEVEL_COLOR[status.level] }}>{status.readiness ?? '—'}</div>
          <div className="min-w-0">
            <div className="font-bold" style={{ color: LEVEL_COLOR[status.level] }}>{status.label}</div>
            <ul className="text-xs text-mute">{status.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        </div>
        <p className="mt-3 text-xs text-mute">El puntaje (0–100) pondera lo que declaras; es una estimación práctica, no una medición ni un diagnóstico. Si tienes dolor articular o una lesión, no entrenes ignorándolo: consulta a un profesional de salud.</p>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <H2>{todayLog ? 'Registro de hoy (guardado)' : 'Registro de hoy'}</H2>
          <Card>
            <Stepper label="Horas de sueño" value={v.sleepHours} step={0.5} min={0} max={16} onChange={(sleepHours) => setV({ ...v, sleepHours })} />
            <div className="mt-3 space-y-3">
              {SCALES.map((s) => (
                <div key={s.key}>
                  <div className="mb-1 flex items-baseline justify-between text-sm"><span>{s.label}</span><span className="wd-c text-sm text-mute">1 = {s.lo.toLowerCase()}, 5 = {s.hi.toLowerCase()}</span></div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button type="button" key={n} aria-label={`${s.label}: ${n}`} aria-pressed={v[s.key] === n} onClick={() => setV({ ...v, [s.key]: n })}
                        className={`h-10 rounded-xl text-sm font-bold transition ${v[s.key] === n ? 'bg-chalk text-ink' : 'bg-card2 text-mute'}`}>{n}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Btn variant="primary" className="mt-4 w-full" onClick={() => run(() => saveRecovery(v), 'Recuperación registrada')}>{todayLog ? 'Actualizar registro' : 'Guardar registro'}</Btn>
          </Card>
        </div>

        <div>
          <H2>Peso corporal</H2>
          <Card>
            <div className="flex items-end gap-2">
              <div className="flex-1"><Stepper label="Peso de hoy (kg)" value={kg} step={0.1} min={25} max={300} onChange={setKg} /></div>
              <Btn variant="primary" className="h-12" onClick={() => run(() => saveBodyWeight(kg), 'Peso registrado')}>Guardar</Btn>
            </div>
            {weights && weights.length >= 2 ? <div className="mt-3"><LineC data={weights.map((w) => ({ label: w.date.slice(5), kg: w.kg }))} x="label" y="kg" unit=" kg" color="#5aa9ff" height={170} /></div>
              : <p className="mt-3 text-xs text-mute">Registra tu peso al menos dos días para ver la evolución.</p>}
            {!!weights?.length && <div className="mt-2 space-y-1">{[...weights].reverse().slice(0, 5).map((w) => (
              <div key={w.id} className="flex items-center justify-between text-sm"><span className="text-mute">{w.date}</span><span className="flex items-center gap-2 font-semibold tnum">{fmtKg(w.kg)} kg<button type="button" aria-label={`Eliminar peso del ${w.date}`} className="text-mute" onClick={() => run(() => softDelete('bodyWeights', w.id))}><Icon name="x" size={14} /></button></span></div>
            ))}</div>}
          </Card>

          <H2>Últimos registros</H2>
          {logs?.length ? <div className="space-y-1.5">{logs.slice(0, 7).map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 rounded-ctl bg-card px-3 py-2 text-sm">
              <span className="text-mute">{l.date}</span>
              <span className="text-xs text-mute tnum">{l.sleepHours} h, fatiga {l.fatigue}, dolor {l.soreness}, estrés {l.stress}</span>
              <span className="flex items-center gap-2"><b className="tnum">{readinessOf(l)}</b><button type="button" aria-label={`Eliminar registro del ${l.date}`} className="text-mute" onClick={() => run(() => softDelete('recovery', l.id))}><Icon name="x" size={14} /></button></span>
            </div>
          ))}</div> : <Empty icon="heart" title="Sin registros" text="Un registro diario de 20 segundos mejora el contexto de las recomendaciones." />}
        </div>
      </div>
    </div>
  );
}
