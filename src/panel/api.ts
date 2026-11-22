// Panel interno: llamadas al servidor. Cada función comprueba allá que la cuenta sea de administración;
// aquí solo se decide qué mostrar.
import { supabase } from '../data/sync';

export type Phone = 'android' | 'iphone' | null;
export type Access = 'active' | 'revoked' | null;
export interface Overview {
  launch: { total: number; android: number; iphone: number; today: number; week: number; notified: number };
  by_source: { source: string; n: number }[];
  by_day: { d: string; n: number }[];
  users: { total: number; week: number; active_week: number };
  training: number;
  testers: { signups: number; access: number; with_account: number };
}
export interface LaunchRow { email: string; phone_os: Phone; lang: string | null; source: string | null; created_at: string; notified_at: string | null; has_account: boolean; access: Access }
export interface UserRow {
  id: string; email: string | null; created_at: string; last_sign_in_at: string | null; confirmed: boolean; provider: string; name: string | null;
  sessions: number; last_session: number | null; plan_status: string | null; plan_source: string | null; plan_end: string | null; access: Access; admin: boolean;
}
export interface GrantRow { email: string; status: 'active' | 'revoked'; note: string | null; granted_at: string; applied_at: string | null; revoked_at: string | null; has_account: boolean; name: string | null; phone_os: Phone }
export interface SignupRow { name: string; email: string; phone_os: 'android' | 'iphone'; days_per_week: string; logs_in: string; contact: string | null; source: string | null; created_at: string; has_account: boolean; access: Access }
export interface LogRow { at: string; action: string; target: string | null; detail: string | null }
export interface Page<T> { total: number; rows: T[] }

const MSG: Record<string, string> = {
  forbidden: 'Esta pantalla es solo para quien administra la app.',
  bad_email: 'Ese correo no parece válido.',
  not_found: 'Ese correo ya no está en la lista.',
};

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('La app no está conectada al servidor.');
  const r = await supabase.rpc(fn, args);
  if (r.error) {
    const known = Object.keys(MSG).find((k) => r.error.message.includes(k));
    throw new Error(known ? MSG[known] : 'No se pudo completar. Revisa tu conexión e inténtalo de nuevo.');
  }
  return r.data as T;
}

// Si la cuenta administra la app. Se pregunta una vez por cuenta y por visita.
const known = new Map<string, boolean>();
export const adminKnown = (uid: string): boolean => known.get(uid) ?? false;
export async function isAdmin(uid: string): Promise<boolean> {
  if (uid === 'local' || !supabase) return false;
  const k = known.get(uid);
  if (k !== undefined) return k;
  try {
    const r = await supabase.rpc('is_admin');
    if (r.error) return false;
    known.set(uid, r.data === true);
    return r.data === true;
  } catch { return false; }
}

export const overview = () => call<Overview>('admin_overview');
export const launchList = (q: string, limit: number) => call<Page<LaunchRow>>('admin_launch_list', { p_q: q || null, p_limit: limit, p_offset: 0 });
export const users = (q: string, limit: number) => call<Page<UserRow>>('admin_users', { p_q: q || null, p_limit: limit, p_offset: 0 });
export const testers = () => call<{ grants: GrantRow[]; signups: SignupRow[] }>('admin_testers');
export const activity = () => call<LogRow[]>('admin_activity');
export const grantAccess = (email: string, note?: string) => call<{ email: string; has_account: boolean }>('admin_grant_access', { p_email: email, p_note: note || null });
export const revokeAccess = (email: string) => call<null>('admin_revoke_access', { p_email: email });
export const removeLaunch = (email: string) => call<null>('admin_remove_launch', { p_email: email });
export const markNotified = () => call<number>('admin_mark_notified');
