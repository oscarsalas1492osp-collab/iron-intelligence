// Discos y rueda de peso: la cinta deslizable de carga, la barra dibujada con sus discos y la calculadora completa.
import { useEffect, useMemo, useRef, useState } from 'react';
import { updateSettings } from '../data/repo';
import { fmtKg } from '../domain/calc';
import { BARS, PLATES, platesPerSide } from '../domain/tools';
import { useProfile } from '../hooks';
import { cx, Icon, Seg, useAction } from './components';

/**
 * Rueda de peso: una cinta horizontal que se desliza con el pulgar y se detiene en cada carga posible.
 * Complementa a los botones; el valor se guarda cuando la cinta se queda quieta.
 */
export function WeightWheel({ value, step, onChange, label }: { value: number; step: number; onChange: (v: number) => void; label: string }) {
  const W = 60;
  const ref = useRef<HTMLDivElement>(null);
  const inc = step > 0 ? step : 2.5;
  const top = Math.max(300, Math.ceil((value + 100) / 100) * 100);
  const onGrid = Math.abs(value / inc - Math.round(value / inc)) < 1e-6;
  const extra = onGrid ? null : value;
  const vals = useMemo(() => {
    const xs: number[] = [];
    for (let i = 0; i * inc <= top + 1e-9; i++) xs.push(Math.round(i * inc * 100) / 100);
    if (extra != null) { xs.push(extra); xs.sort((a, b) => a - b); }
    return xs;
  }, [inc, top, extra]);
  const idx = Math.max(0, vals.indexOf(value));
  const [mid, setMid] = useState(idx);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef({ value, vals, onChange }); latest.current = { value, vals, onChange };
  // Si el peso cambia por los botones o por otra serie, la cinta se coloca sola en ese valor.
  useEffect(() => {
    const el = ref.current;
    if (el && Math.abs(el.scrollLeft - idx * W) > 2) el.scrollLeft = idx * W;
    setMid(idx);
  }, [idx]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onScroll = () => {
    const el = ref.current; if (!el) return;
    const i = Math.min(vals.length - 1, Math.max(0, Math.round(el.scrollLeft / W)));
    setMid(i);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { const l = latest.current; const v = l.vals[Math.min(l.vals.length - 1, Math.max(0, Math.round((ref.current?.scrollLeft ?? 0) / W)))]; if (v != null && v !== l.value) l.onChange(v); }, 160);
  };
  return (
    <div className="mt-2.5" data-noswipe>
      <div className="relative">
        <div ref={ref} onScroll={onScroll} role="group" aria-label={label} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-ctl bg-ink/50" style={{ paddingInline: `calc(50% - ${W / 2}px)`, touchAction: 'pan-x pan-y' }}>
          {vals.map((v, i) => (
            <button type="button" key={v} tabIndex={-1} aria-hidden onClick={() => ref.current?.scrollTo({ left: i * W, behavior: 'smooth' })}
              className={cx('num shrink-0 snap-center text-center transition-colors', i === mid ? 'text-xl text-chalk' : Math.abs(i - mid) === 1 ? 'text-base text-chalk/55' : 'text-sm text-chalk/25')} style={{ width: W, height: 46 }}>
              {fmtKg(v)}
            </button>
          ))}
        </div>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-[60px] -translate-x-1/2 rounded-ctl border-2 border-fire/70" />
      </div>
      <div className="wd-c mt-1 text-center text-xs text-mute">Desliza para cambiar el peso</div>
    </div>
  );
}

// Alto, ancho y color de cada disco. Los colores siguen el código habitual de los discos de competición
// (25 rojo, 20 azul, 15 amarillo, 10 verde, 5 blanco) con la paleta de la app.
const LOOK: Record<number, [number, number, string]> = {
  25: [128, 18, '#ff6a1a'], 20: [118, 18, '#58c7ff'], 15: [104, 16, '#ffb054'], 10: [90, 14, '#34e0a1'],
  5: [72, 12, '#f2f6f6'], 2.5: [56, 10, '#949fb8'], 1.25: [44, 8, '#5d7178'],
};
const lookOf = (p: number): [number, number, string] => LOOK[p] ?? [Math.round(40 + Math.min(25, p) * 3.5), p >= 15 ? 18 : p >= 5 ? 13 : 9, '#949fb8'];

/** La barra cargada, vista de frente: los discos de cada lado en el orden en que se ponen. */
export function PlateBar({ side, bar }: { side: number[]; bar: number }) {
  const sig = side.join('_');
  const plate = (p: number, i: number, where: string) => {
    const [h, w, bg] = lookOf(p);
    return <b key={`${sig}-${where}${i}`} className="plate-in block shrink-0 rounded-[5px]" style={{ height: h, width: w, background: bg, animationDelay: `${i * 35}ms`, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / .35), inset 0 2px 0 rgb(255 255 255 / .22)' }} />;
  };
  const rod = { background: 'linear-gradient(180deg, #c9d6da, #7d8a90)' };
  const label = `${bar ? `Barra de ${fmtKg(bar)} kg` : 'Sin barra'} con ${side.length ? `${side.map(fmtKg).join(', ')} kg por lado` : 'ningún disco'}`;
  return (
    <div role="img" aria-label={label} className="flex h-[140px] items-center justify-center gap-[3px]">
      <span className="h-2 w-4 shrink-0 rounded" style={rod} />
      {[...side].reverse().map((p, i) => plate(p, side.length - 1 - i, 'L'))}
      <span className="h-[26px] w-[9px] shrink-0 rounded-[3px] bg-[#9aa7ad]" />
      <span className="h-2 w-[clamp(40px,12vw,110px)] shrink-0 rounded" style={rod} />
      <span className="h-[26px] w-[9px] shrink-0 rounded-[3px] bg-[#9aa7ad]" />
      {side.map((p, i) => plate(p, i, 'R'))}
      <span className="h-2 w-4 shrink-0 rounded" style={rod} />
    </div>
  );
}

/**
 * Calculadora de discos: peso total con botones y rueda, la barra dibujada y el detalle por lado.
 * La barra elegida se guarda en los ajustes; los discos disponibles salen de ahí también.
 */
export function PlateCalc({ weight, onWeight, step = 2.5, barDefault = 20 }: { weight: number; onWeight: (v: number) => void; step?: number; barDefault?: number }) {
  const st = useProfile().settings ?? {}; const run = useAction();
  const bar = st.bar ?? barDefault;
  const inc = step > 0 ? step : 2.5;
  const pl = platesPerSide(weight, bar, st.plates?.length ? st.plates : PLATES);
  const bump = (d: number) => onWeight(Math.min(1000, Math.max(0, Math.round((weight + d) * 100) / 100)));
  const text = weight < bar ? 'menos que la barra' : pl.side.length ? pl.side.map(fmtKg).join(' + ') : bar ? 'solo la barra' : 'sin discos';
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" aria-label={`Bajar ${fmtKg(inc)} kg`} onClick={() => bump(-inc)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card2 text-chalk"><Icon name="minus" size={18} /></button>
        <div className="min-w-0 text-center">
          <div className="num text-[3.25rem] leading-none" aria-live="polite">{fmtKg(weight)}</div>
          <div className="wd-c mt-1 text-sm text-mute">kilos en total</div>
        </div>
        <button type="button" aria-label={`Subir ${fmtKg(inc)} kg`} onClick={() => bump(inc)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card2 text-chalk"><Icon name="plus" size={18} /></button>
      </div>
      <WeightWheel label="Rueda de peso total" value={weight} step={inc} onChange={onWeight} />
      <PlateBar side={pl.side} bar={bar} />
      <p className="text-center"><span className="text-mute">Por lado: </span><b className="num text-lg">{text}</b></p>
      {pl.rest > 0 && <p className="text-center text-sm text-amber">Faltan {fmtKg(pl.rest)} kg que no se pueden cargar con estos discos.</p>}
      <div>
        <div className="label mb-1.5">Barra</div>
        <Seg options={BARS.map((b) => ({ value: b, label: b ? `${fmtKg(b)} kg` : 'Sin barra' }))} value={bar} onChange={(b) => run(() => updateSettings({ bar: b }))} />
      </div>
    </div>
  );
}
