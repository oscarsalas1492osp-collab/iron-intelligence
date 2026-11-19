// Copias de seguridad y exportación de datos.
import type { Base } from '../domain/types';
import { schemas, TABLES, type TableName } from '../domain/validation';
import { db, getUserId } from './db';
import { getExercises } from './repo';

export interface Backup { app: 'iron-intelligence'; version: 1; exportedAt: string; tables: Record<TableName, Base[]> }

export async function exportBackup(): Promise<Backup> {
  const uid = getUserId();
  const tables = {} as Record<TableName, Base[]>;
  for (const t of TABLES) tables[t] = (await db.table<Base, string>(t).toArray()).filter((r) => r.userId === uid && !r.deleted);
  await db.meta.put({ key: `lastBackup:${uid}`, value: Date.now() });
  return { app: 'iron-intelligence', version: 1, exportedAt: new Date().toISOString(), tables };
}

/** Restaura una copia. Valida cada fila; las inválidas se omiten y se informan. */
export async function importBackup(text: string): Promise<{ imported: number; skipped: number }> {
  let data: Backup;
  try { data = JSON.parse(text); } catch { throw new Error('El archivo no es un JSON válido'); }
  if (data?.app !== 'iron-intelligence' || !data.tables) throw new Error('El archivo no es una copia de Iron Intelligence');
  const uid = getUserId();
  let imported = 0, skipped = 0;
  for (const t of TABLES) {
    for (const raw of data.tables[t] ?? []) {
      const row = { ...raw, userId: uid, dirty: 1 as const, updatedAt: Date.now(), ...(t === 'profiles' ? { id: uid } : {}) };
      if (schemas[t].safeParse(row).success) { await db.table(t).put(row); imported++; } else skipped++;
    }
  }
  return { imported, skipped };
}

// Formato para Excel en español: separador ";" y coma decimal.
const csvCell = (v: unknown) => {
  const s = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Una fila por serie completada. */
export async function exportCsv(): Promise<string> {
  const uid = getUserId();
  const ex = new Map((await getExercises()).map((e) => [e.id, e.name]));
  const sessions = new Map((await db.sessions.toArray()).filter((s) => s.userId === uid && !s.deleted).map((s) => [s.id, s]));
  const sets = (await db.sets.toArray()).filter((s) => s.userId === uid && !s.deleted && s.done && sessions.has(s.sessionId));
  sets.sort((a, b) => sessions.get(a.sessionId)!.startedAt - sessions.get(b.sessionId)!.startedAt || a.exerciseId.localeCompare(b.exerciseId) || a.order - b.order);
  const head = ['fecha', 'sesion', 'ejercicio', 'serie', 'peso_kg', 'repeticiones', 'rir', 'rpe', 'fallo', 'motivo_fin', 'descanso_s', 'cumplio_minimo', 'nota'];
  const rows = sets.map((s) => {
    const se = sessions.get(s.sessionId)!;
    return [fmtLocal(se.startedAt), se.name, ex.get(s.exerciseId) ?? s.exerciseId, s.order + 1, s.weight, s.reps, s.rir ?? '', s.rpe ?? '', s.failure ? 'si' : 'no', s.endReason, s.restSec ?? '', s.metTarget ? 'si' : 'no', s.note].map(csvCell).join(';');
  });
  return [head.join(';'), ...rows].join('\r\n');
}

const fmtLocal = (ts: number) => { const d = new Date(ts); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
