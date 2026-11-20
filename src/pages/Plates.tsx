// Discos: calculadora de discos por lado con su propio espacio, fuera del entrenamiento en curso.
import { useState } from 'react';
import { updateSettings } from '../data/repo';
import { fmtKg } from '../domain/calc';
import { PLATES } from '../domain/tools';
import { useProfile } from '../hooks';
import { Card, cx, H2, Title, useAction } from '../ui/components';
import { PlateCalc } from '../ui/plates';

const KEY = 'ii_plates_w';

export default function Plates() {
  const st = useProfile().settings ?? {}; const run = useAction();
  const [w, setW] = useState(() => { try { const v = Number(localStorage.getItem(KEY)); return v > 0 ? v : 60; } catch { return 60; } });
  const set = (v: number) => { setW(v); try { localStorage.setItem(KEY, String(v)); } catch { /* sin almacenamiento, el peso solo dura la visita */ } };
  const avail = st.plates?.length ? st.plates : PLATES;
  const toggle = (p: number) => {
    const next = avail.includes(p) ? avail.filter((x) => x !== p) : [...avail, p].sort((a, b) => b - a);
    if (next.length) void run(() => updateSettings({ plates: next }));
  };
  return (
    <div>
      <Title sub="Qué discos van por lado para el peso que elijas">Discos</Title>
      <Card><PlateCalc weight={w} onWeight={set} /></Card>
      <H2>Discos de tu gimnasio</H2>
      <Card>
        <div className="flex flex-wrap gap-2">
          {PLATES.map((p) => {
            const on = avail.includes(p);
            return (
              <button type="button" key={p} aria-pressed={on} onClick={() => toggle(p)} aria-label={`Disco de ${fmtKg(p)} kg ${on ? 'disponible' : 'no disponible'}`}
                className={cx('num h-11 min-w-[64px] rounded-full px-4 text-[15px] transition-colors', on ? 'bg-chalk text-ink' : 'bg-card2 text-mute')}>
                {fmtKg(p)}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-mute">Deja marcados solo los discos que hay donde entrenas. La calculadora los usa aquí y dentro de cada ejercicio.</p>
      </Card>
    </div>
  );
}
