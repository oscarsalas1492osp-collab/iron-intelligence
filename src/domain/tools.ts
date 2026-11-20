// Ayudas de gimnasio: series de calentamiento y discos por lado. Funciones puras.

export interface WarmupSet { weight: number; reps: number; pct: number }
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Series de aproximación antes de la primera serie de trabajo. Los porcentajes son una convención práctica
 * (subir en 3–4 pasos con pocas repeticiones para no acumular fatiga), no un valor medido.
 */
export function warmupSets(work: number, increment: number, bar = 0): WarmupSet[] {
  if (!(work > 0)) return [];
  const inc = increment > 0 ? increment : 2.5;
  const steps: [number, number][] = work < 30 ? [[0.5, 8], [0.75, 4]] : work < 80 ? [[0.4, 8], [0.6, 5], [0.8, 3]] : [[0.4, 8], [0.55, 5], [0.7, 3], [0.85, 2]];
  const out: WarmupSet[] = [];
  for (const [pct, reps] of steps) {
    const weight = r2(Math.max(bar, Math.round((work * pct) / inc) * inc));
    if (weight >= work || weight <= 0 || out.some((o) => o.weight === weight)) continue;
    out.push({ weight, reps, pct });
  }
  return out;
}

export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export const BARS = [20, 15, 10, 7.5, 0];

/** Discos por lado para llegar a un peso total con una barra dada. `rest` es lo que no se puede cargar con los discos disponibles. */
export function platesPerSide(total: number, bar: number, plates: number[] = PLATES): { side: number[]; rest: number } {
  let left = r2((total - bar) / 2);
  const side: number[] = [];
  if (left < 0) return { side, rest: r2(total - bar) };
  for (const p of [...plates].sort((a, b) => b - a)) while (left >= p - 1e-9) { side.push(p); left = r2(left - p); }
  return { side, rest: r2(left * 2) };
}
