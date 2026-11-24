// Panel interno: llamadas al servidor. Cada función comprueba allá que la cuenta sea de administración;
// aquí solo se decide qué mostrar.
import { supabase } from '../data/sync';

export type Phone = 'android' | 'iphone' | null;
export type Access = 'active' | 'revoked' | null;
export type Kind = 'tester' | 'guest';
export type Mode = 'invite' | 'open';
export interface Overview {
  mode?: Mode;
  launch: { total: number; android: number; iphone: number; today: number; week: number; notified: number };
  by_source: { source: string; n: number }[];
  by_day: { d: string; n: number }[];
  users: { total: number; week: number; active_week: number };
  training: number;
  testers: { signups: number; access: number; guests?: number; with_account: number };
}
export interface LaunchRow { email: string; phone_os: Phone; lang: string | null; source: string | null; created_at: string; notified_at: string | null; has_account: boolean; access: Access }
export interface UserRow {
  id: string; email: string | null; created_at: string; last_sign_in_at: string | null; confirmed: boolean; provider: string; name: string | null;
  sessions: number; last_session: number | null; plan_status: string | null; plan_source: string | null; plan_end: string | null; access: Access; admin: boolean;
}
export interface GrantRow { email: string; kind: Kind; pro_forever?: boolean; pro_until?: string | null; invited_at: string | null; status: 'active' | 'revoked'; note: string | null; granted_at: string; applied_at: string | null; revoked_at: string | null; has_account: boolean; name: string | null; phone_os: Phone }
export interface SignupRow { name: string; email: string; phone_os: 'android' | 'iphone'; days_per_week: string; logs_in: string; contact: string | null; source: string | null; created_at: string; has_account: boolean; access: Access }
export interface LogRow { at: string; action: string; target: string | null; detail: string | null }
export interface Page<T> { total: number; rows: T[] }

const MSG: Record<string, string> = {
  forbidden: 'Esta pantalla es solo para quien administra la app.',
  bad_email: 'Ese correo no parece válido.',
  not_found: 'Ese correo ya no está en la lista.',
  bad_plans: 'Algún valor de los planes no es válido. Revísalos e inténtalo de nuevo.',
};
const MAIL_MSG: Record<string, string> = {
  forbidden: MSG.forbidden,
  sin_sesion: 'La sesión caducó. Vuelve a iniciar sesión.',
  sin_configurar: 'El correo de la app todavía no está conectado.',
  sin_acceso: 'Ese correo ya no tiene acceso vigente.',
  correo: 'Ese correo no parece válido.',
  link: 'Pega el link de descarga completo, con https://.',
  tope_diario: 'Hoy ya se envió el máximo de correos del plan. Mañana puedes seguir.',
};
export interface MailStatus { configured: boolean; from: string; replies: string | null; today: number; cap: number; pending: number }
export interface MailPreview { subject: string; text: string; from: string }

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
export const grantAccess = (email: string, note?: string, kind: Kind = 'tester') => call<{ email: string; has_account: boolean }>('admin_invite', { p_email: email, p_note: note || null, p_kind: kind });
/** Plan Pro de una persona con acceso. `days`: 0 lo quita, -1 sin vencimiento, N días desde ahora. */
export const setPro = (email: string, days: number) => call<{ email: string; pro_forever: boolean; pro_until: string | null }>('admin_set_pro', { p_email: email, p_days: days });
export const setAccessMode = (mode: Mode) => call<Mode>('admin_set_access_mode', { p_mode: mode });
export const revokeAccess = (email: string) => call<null>('admin_revoke_access', { p_email: email });
export const removeLaunch = (email: string) => call<null>('admin_remove_launch', { p_email: email });
export const markNotified = () => call<number>('admin_mark_notified');

// Correos de la app: los envía una función del servidor, que también comprueba que la cuenta administre.
async function mail<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('La app no está conectada al servidor.');
  const r = await supabase.functions.invoke('correo', { body });
  if (r.error) {
    let code = '', detail = '';
    try {
      const j = (await (r.error as { context?: Response }).context?.json()) as { error?: string; detail?: string } | undefined;
      code = j?.error ?? ''; detail = j?.detail ?? '';
    } catch { /* sin detalle */ }
    throw new Error(code === 'resend' ? `El servicio de correo no aceptó el envío${detail ? `: ${detail}` : '.'}` : MAIL_MSG[code] ?? 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.');
  }
  return r.data as T;
}
export const mailStatus = () => mail<MailStatus>({ action: 'status' });
export const mailPreview = (which: 'invitacion' | 'lanzamiento', o: { email?: string; kind?: Kind; link?: string } = {}) => mail<MailPreview>({ action: 'preview', mail: which, ...o });
export const mailTest = () => mail<{ sent: number; to: string }>({ action: 'test' });
export const mailInvite = (email: string) => mail<{ sent: number; to: string }>({ action: 'invite', email });
export const mailLaunch = (link: string) => mail<{ sent: number; remaining: number }>({ action: 'launch', link });

// Planes: el ajuste `billing` es de lectura pública (la app lo lee igual); guardarlo pide administración.
export type PlanCfg = Record<string, unknown>;
export async function plans(): Promise<PlanCfg> {
  if (!supabase) throw new Error('La app no está conectada al servidor.');
  const r = await supabase.from('app_flags').select('value').eq('key', 'billing').maybeSingle();
  if (r.error || !r.data) throw new Error('No se pudo cargar. Revisa tu conexión e inténtalo de nuevo.');
  return r.data.value as PlanCfg;
}
export const setPlans = (cfg: PlanCfg) => call<PlanCfg>('admin_set_plans', { p_cfg: cfg });
