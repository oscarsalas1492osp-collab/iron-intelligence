import { db, setUserId } from '../data/db';

export async function resetDb(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
  localStorage.clear();
  setUserId('local');
}
