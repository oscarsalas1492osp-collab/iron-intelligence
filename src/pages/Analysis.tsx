import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DAY, e1rm, weekStart } from '../domain/calc';
import { hotTone, type Tones } from '../domain/heat';
import { MUSCLES, MUSCLE_LABEL } from '../domain/muscles';
import { trendOf } from '../domain/progression';
import type { Muscle } from '../domain/types';
import { inWeek, muscleVolume, rirDistribution, sessionsOf, tonnage, topContributors, weeklySeries } from '../domain/volume';
import { useDoneSets, useExMap, useProfile } from '../hooks';
import { BarC } from '../ui/charts';
import { BodyFigure } from '../ui/BodyFigure';
import { Btn, Card, Chip, Empty, H2, Icon, Stat, Title } from '../ui/components';

// Misma escala de incandescencia que el selector de RIR.
const RIR_COLORS = ['#ffe2a8', '#ffa63d', '#ff6a1a', '#c2412d', '#8a4a3a', '#4a505a'];

export default function Analysis() {
  const sets = useDoneSets(); const ex = useExMap(); const profile = useProfile();
  const [offset, setOffset] = useState(0);
  const [muscle, setMuscle] = useState<Muscle>('chest');
  const coef = profile.indirectCoef;
  const now = Date.now();
  const start = weekStart(now) - offset * 7 * DAY;
  const all = sets ?? [];
  const week = useMemo(() => inWeek(all, start), [all, start]);
  const prev = useMemo(() => inWeek(all, start - 7 * DAY), [all, start]);
  const vol = useMemo(() => muscleVolume(week, ex, coef), [week, ex, coef]);
  const max = Math.max(1, ...vol.map((v) => v.fractional));
  // En el análisis el color indica solo volumen de la semana elegida: más claro, más series.
  const tones = useMemo(() => { const t: Tones = {}; for (const v of vol) if (v.fractional > 0) t[v.muscle] = hotTone(v.fractional / max); return t; }, [vol, max]);
  const dist = useMemo(() => rirDistribution(week), [week]);
  const evo = useMemo(() => weeklySeries(all, ex, coef, muscle, 8, now), [all, ex, coef, muscle]); // eslint-disable-line react-hooks/exhaustive-deps
  const top = useMemo(() => topContributors(week, ex, coef, muscle), [week, ex, coef, muscle]);
  const trends = useMemo(() => [...new Set(all.map((s) => s.exerciseId))].map((id) => {
    const best = sessionsOf(all, id).map((s) => Math.max(0, ...s.sets.map((x) => e1rm(x.weight, x.reps, x.rir) ?? 0)));
    return { id, name: ex.get(id)?.name ?? id, ...trendOf(best) };
  }).filter((t) => t.trend !== 'insufficient').sort((a, b) => b.pct - a.pct), [all, ex]);

  if (sets && !sets.length) return <div><Title>Análisis</Title><Empty icon="chart" title="Sin datos para analizar" text="El análisis de volumen y proximidad al fallo se construye con tus sesiones completadas."><Link to="/entrenar"><Btn variant="primary">Ir a entrenar</Btn></Link></Empty></div>;

  const label = `${new Date(start).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} – ${new Date(start + 6 * DAY).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`;
  const sessionsN = new Set(week.map((s) => s.sessionId)).size;
  const delta = prev.length ? Math.round(((week.length - prev.length) / prev.length) * 100) : null;

  return (
    <div>
      <Title sub="Volumen, frecuencia y proximidad al fallo">Análisis</Title>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Btn size="sm" icon="left" aria-label="Semana anterior" onClick={() => setOffset(offset + 1)} />
        <div className="text-center"><div className="font-bold">{offset === 0 ? 'Esta semana' : offset === 1 ? 'Semana pasada' : `Hace ${offset} semanas`}</div><div className="text-xs text-mute">{label}</div></div>
        <Btn size="sm" icon="right" aria-label="Semana siguiente" disabled={offset === 0} onClick={() => setOffset(offset - 1)} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Sesiones" value={sessionsN} />
          <Stat label="Series" value={week.length} sub={delta != null ? `${delta > 0 ? '+' : ''}${delta} % vs. semana previa` : undefined} />
          <Stat label="Carga movida" value={`${(tonnage(week) / 1000).toFixed(1)} t`} color="#5aa9ff" />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <div className="relative h-[320px] md:sticky md:top-6 md:h-[520px]">
            <BodyFigure tones={tones} selected={muscle} onSelect={setMuscle} className="absolute inset-0" />
          </div>
          <p className="wd-c mt-1 text-center text-sm text-mute">Más claro, más series. Toca un músculo para elegirlo; arrastra para girar.</p>
        </div>
        <div>
          <H2>Series por grupo muscular</H2>
          <Card>
            <div className="space-y-2.5">
              {vol.map((v) => (
                <button type="button" key={v.muscle} onClick={() => setMuscle(v.muscle)} className="block w-full text-left" aria-label={`${MUSCLE_LABEL[v.muscle]}: ${v.direct} directas, ${v.indirect} indirectas`}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className={v.muscle === muscle ? 'font-bold text-chalk' : 'text-mute'}>{MUSCLE_LABEL[v.muscle]}{profile.priorityMuscles.includes(v.muscle) && <Icon name="star" size={13} className="ml-1.5 inline -translate-y-px text-fire" />}</span>
                    <span className="tnum text-xs text-mute"><b className="text-chalk">{v.direct}</b> directas, {v.indirect} indirectas, {v.days} día{v.days === 1 ? '' : 's'}</span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-card2">
                    <div className="h-full bg-data transition-all duration-500" style={{ width: `${(v.direct / max) * 100}%` }} />
                    <div className="h-full bg-data/40 transition-all duration-500" style={{ width: `${((v.indirect * coef) / max) * 100}%` }} />
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-mute">Azul sólido: series directas. Azul tenue: series indirectas × {coef} (coeficiente configurable en <Link to="/perfil" className="text-data underline">Perfil</Link>). Es una convención de conteo, no una equivalencia exacta. La estrella marca tus grupos prioritarios.</p>
          </Card>

          <H2>Distribución por proximidad al fallo</H2>
          <Card>
            <div className="space-y-2">
              {dist.map((d, i) => (
                <div key={d.bucket} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 text-mute">RIR {d.bucket.replace('Sin RIR', '—')}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-card2"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${week.length ? (d.count / week.length) * 100 : 0}%`, background: RIR_COLORS[i] }} /></div>
                  <span className="w-14 shrink-0 text-right tnum text-xs"><b>{d.count}</b> <span className="text-mute">{week.length ? Math.round((d.count / week.length) * 100) : 0} %</span></span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-mute">Describe el esfuerzo que declaraste, no el estímulo muscular real. Llegar al fallo no ha mostrado ser superior a quedarse a 1–2 repeticiones para hipertrofia.</p>
          </Card>

          <H2>Tendencia de rendimiento</H2>
          <Card>
            {trends.length ? <div className="space-y-1.5">{trends.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{t.name}</span>
                <span className="shrink-0 font-bold tnum" style={{ color: t.trend === 'improving' ? '#3ddc84' : t.trend === 'declining' ? '#ff6a1a' : '#9299a3' }}>{t.pct > 0 ? '+' : ''}{t.pct.toFixed(1)} % · {t.trend === 'improving' ? 'mejora' : t.trend === 'declining' ? 'baja' : 'estable'}</span>
              </div>
            ))}</div> : <p className="text-sm text-mute">Se necesitan 3 o más sesiones por ejercicio.</p>}
            <p className="mt-3 text-xs text-mute">Cambio del 1RM estimado: últimas 2 sesiones frente a las 3 anteriores.</p>
          </Card>
        </div>
      </div>

      <H2>Evolución semanal</H2>
      <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">{MUSCLES.map((m) => <Chip key={m} active={m === muscle} color="#5aa9ff" onClick={() => setMuscle(m)}>{MUSCLE_LABEL[m]}</Chip>)}</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
        <Card>
          <BarC data={evo} x="label" bars={[{ key: 'direct', color: '#5aa9ff', name: 'Directas', stack: 'a' }, { key: 'indirect', color: '#5aa9ff66', name: `Indirectas × ${coef}`, stack: 'a' }]} />
          <p className="mt-2 text-xs text-mute">Últimas 8 semanas de {MUSCLE_LABEL[muscle].toLowerCase()}. Más volumen se asocia con más hipertrofia con rendimientos decrecientes; súbelo de forma gradual y solo si te recuperas bien.</p>
        </Card>
        <Card>
          <div className="label mb-2">Qué ejercicios aportan {offset === 0 ? 'esta semana' : `(${label})`}</div>
          {top.length ? <div className="space-y-2">{top.map((t) => <div key={t.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{t.name}</span><b className="tnum shrink-0">{t.sets}</b></div>)}</div> : <p className="text-sm text-mute">Sin series para este grupo en la semana seleccionada.</p>}
        </Card>
      </div>
    </div>
  );
}
