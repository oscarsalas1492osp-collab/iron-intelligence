// Cálculos puros y pequeños utilitarios de fechas.

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Redondea una carga al múltiplo más cercano del incremento disponible. */
export function roundTo(weight: number, increment: number): number {
  if (!increment || increment <= 0) return Math.round(weight * 100) / 100;
  return Math.round((Math.round(weight / increment) * increment) * 100) / 100;
}

/**
 * 1RM estimado (fórmula de Epley) usando las repeticiones hasta el fallo estimadas (reps + RIR).
 * Es una ESTIMACIÓN, no una prueba real. Devuelve null fuera del rango en que la fórmula es razonable.
 */
export function e1rm(weight: number, reps: number, rir: number | null): number | null {
  if (weight <= 0 || reps < 1) return null;
  const toFailure = reps + (rir ?? 0);
  if (toFailure > 15) return null;
  if (toFailure <= 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + toFailure / 30) * 10) / 10;
}

/** RPE basado en RIR (Zourdos et al., 2016): RPE = 10 − RIR. */
export const rpeFromRir = (rir: number | null): number | null => (rir == null ? null : clamp(10 - rir, 1, 10));

export interface IntensityInfo { label: string; short: string; color: string; level: number }

/** Etiqueta visual de proximidad al fallo. Describe el esfuerzo declarado, NO mide el estímulo muscular. */
export function intensityOf(rir: number | null): IntensityInfo {
  if (rir == null) return { label: 'Sin RIR registrado', short: '—', color: '#8b919c', level: 0 };
  if (rir <= 0) return { label: 'Fallo muscular reportado', short: 'Fallo', color: '#ff3b30', level: 5 };
  if (rir <= 1) return { label: 'Proximidad muy elevada', short: 'Muy cerca', color: '#ff6a1a', level: 4 };
  if (rir <= 2) return { label: 'Proximidad elevada al fallo', short: 'Cerca', color: '#ff9f45', level: 3 };
  if (rir <= 3) return { label: 'Esfuerzo moderado-alto', short: 'Moderado-alto', color: '#f5c542', level: 2 };
  if (rir <= 4) return { label: 'Intensidad relativamente baja', short: 'Moderado', color: '#3b9dff', level: 1 };
  return { label: 'Muy lejos del fallo', short: 'Lejos', color: '#5b6472', level: 1 };
}

// ---- Fechas (hora local) ----
export const DAY = 86400000;

export function ymd(ts: number | Date): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Inicio de la semana (lunes 00:00, hora local). */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}

export function ago(ts: number, now = Date.now()): string {
  const h = Math.floor((now - ts) / 3600000);
  if (h < 1) return 'hace menos de 1 h';
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}

export const fmtKg = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '').replace(/\.$/, ''));
export const fmtDate = (ts: number): string =>
  new Date(ts).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
