// Biseries y triseries: dos o tres ejercicios que se hacen uno tras otro sin descanso. Una serie es la ronda completa.
// Funciones puras sobre una lista ordenada de ids y los grupos formados entre ellos.
export const MAX_GROUP = 3;
export const groupLabel = (n: number) => (n >= 3 ? 'Triserie' : 'Biserie');

export interface Arrangement { ids: string[]; groups: string[][] }

/** Limpia los grupos: solo ids presentes, sin repetidos, de 2 a 3 miembros. */
export function cleanGroups(ids: string[], groups: string[][] | undefined | null): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const g of groups ?? []) {
    const m: string[] = [];
    for (const id of g) if (ids.includes(id) && !seen.has(id) && !m.includes(id) && m.length < MAX_GROUP) m.push(id);
    if (m.length >= 2) { m.forEach((id) => seen.add(id)); out.push(m); }
  }
  return out;
}

/** Unidades de trabajo en orden: cada una es un ejercicio suelto o un grupo. El grupo ocupa el lugar de su primer miembro. */
export function unitsOf(ids: string[], groups: string[][] | undefined | null): string[][] {
  const gs = cleanGroups(ids, groups);
  const of = new Map<string, string[]>();
  for (const g of gs) for (const id of g) of.set(id, g);
  const done = new Set<string>();
  const units: string[][] = [];
  for (const id of ids) {
    if (done.has(id)) continue;
    const g = of.get(id) ?? [id];
    g.forEach((x) => done.add(x));
    units.push(g);
  }
  return units;
}

const rebuild = (units: string[][]): Arrangement => ({ ids: units.flat(), groups: units.filter((u) => u.length >= 2) });

/** Une `drag` al ejercicio o grupo de `target`. Lanza un error si el grupo quedaría con más de tres. */
export function joinGroup(ids: string[], groups: string[][] | undefined | null, drag: string, target: string): Arrangement {
  if (drag === target || !ids.includes(drag) || !ids.includes(target)) return { ids, groups: cleanGroups(ids, groups) };
  const units = unitsOf(ids, groups).map((u) => u.filter((id) => id !== drag)).filter((u) => u.length);
  const t = units.find((u) => u.includes(target));
  if (!t) return { ids, groups: cleanGroups(ids, groups) };
  if (t.length >= MAX_GROUP) throw new Error('Una triserie admite como máximo tres ejercicios');
  t.push(drag);
  return rebuild(units);
}

/** Saca un ejercicio de su grupo; queda suelto justo después del grupo. Si el grupo queda con uno, se disuelve. */
export function leaveGroup(ids: string[], groups: string[][] | undefined | null, id: string): Arrangement {
  const units = unitsOf(ids, groups);
  const i = units.findIndex((u) => u.length >= 2 && u.includes(id));
  if (i < 0) return { ids, groups: cleanGroups(ids, groups) };
  const rest = units[i].filter((x) => x !== id);
  units.splice(i, 1, ...rest.length >= 2 ? [rest, [id]] : [...rest.map((x) => [x]), [id]]);
  return rebuild(units);
}

/** Mueve la unidad que contiene `id` un lugar hacia arriba o hacia abajo, sin partir grupos. */
export function moveUnit(ids: string[], groups: string[][] | undefined | null, id: string, dir: -1 | 1): Arrangement {
  const units = unitsOf(ids, groups);
  const i = units.findIndex((u) => u.includes(id)); const j = i + dir;
  if (i < 0 || j < 0 || j >= units.length) return rebuild(units);
  [units[i], units[j]] = [units[j], units[i]];
  return rebuild(units);
}
