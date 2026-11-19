import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cloudEnabled } from '../data/sync';
import { useActiveSession, useSyncState, useUserId } from '../hooks';
import { cx, Icon } from './components';

const NAV = [
  { to: '/', label: 'Inicio', icon: 'home' },
  { to: '/entrenar', label: 'Entrenar', icon: 'dumbbell' },
  { to: '/rutinas', label: 'Rutinas', icon: 'list' },
  { to: '/ejercicios', label: 'Ejercicios', icon: 'book' },
  { to: '/historial', label: 'Historial', icon: 'calendar' },
  { to: '/analisis', label: 'Análisis', icon: 'chart' },
  { to: '/recuperacion', label: 'Recuperación', icon: 'heart' },
  { to: '/asistente', label: 'Asistente', icon: 'chat' },
  { to: '/perfil', label: 'Perfil y datos', icon: 'user' },
  { to: '/fundamento', label: 'Fundamento', icon: 'flask' },
];
const MOBILE = ['/', '/rutinas', '/entrenar', '/historial', '/mas'];
export const MORE = NAV.filter((n) => !MOBILE.includes(n.to));

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <Plate size={30} />
      <div className="leading-none">
        <div className="wd-x text-[15px] font-black tracking-[.04em]">IRON</div>
        <div className="wd-c mt-0.5 text-[11px] font-semibold tracking-[.18em] text-mute">INTELLIGENCE</div>
      </div>
    </div>
  );
}

/** Un disco de pesas visto de frente: el signo de la app y el botón de entrenar. */
export function Plate({ size = 48, active }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="23" fill="#ff6a1a" />
      <circle cx="24" cy="24" r="17.5" fill="none" stroke="#16181b" strokeOpacity=".28" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="10.5" fill="none" stroke="#16181b" strokeOpacity=".28" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="4.6" fill="#16181b" />
      {active && <circle cx="24" cy="24" r="1.8" fill="#ff6a1a" />}
    </svg>
  );
}

export default function Layout() {
  const active = useActiveSession();
  const sync = useSyncState();
  const { pathname } = useLocation();
  const uid = useUserId();
  const noAccount = cloudEnabled && uid === 'local';
  const syncLabel = noAccount ? 'Sin cuenta · solo este dispositivo' : { local: 'Modo local', idle: sync.lastSync ? 'Sincronizado' : 'Pendiente de sincronizar', syncing: 'Sincronizando…', error: 'Sin sincronizar', offline: 'Sin conexión' }[sync.status];
  const dot = noAccount ? '#9299a3' : { local: '#9299a3', idle: sync.lastSync ? '#3ddc84' : '#f5c542', syncing: '#5aa9ff', error: '#ff3b30', offline: '#f5c542' }[sync.status];
  return (
    <div className="min-h-full md:flex">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:bg-graphite md:p-4">
        <div className="mb-7 px-2 pt-2"><Logo /></div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('flex items-center gap-3 rounded-ctl px-3 py-2.5 text-[15px] transition-colors', isActive ? 'bg-card2 font-semibold text-chalk' : 'text-mute hover:text-chalk')}>
              <Icon name={n.icon} size={18} />{n.label}
              {n.to === '/entrenar' && active && <span className="wd-c ml-auto rounded-full bg-fire px-2 py-0.5 text-[11px] font-bold text-ink">en curso</span>}
            </NavLink>
          ))}
        </nav>
        <div className="wd-c flex items-center gap-2 px-2 pt-3 text-sm text-mute"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />{syncLabel}</div>
      </aside>

      <main className="min-w-0 flex-1 pb-28 md:pb-12">
        <div className="mx-auto w-full max-w-5xl px-4 pt-5 md:px-10 md:pt-9"><Outlet /></div>
      </main>

      <nav className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-graphite md:hidden" aria-label="Navegación principal">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {[{ to: '/', label: 'Inicio', icon: 'home' }, { to: '/rutinas', label: 'Rutinas', icon: 'list' }, { to: '/entrenar', label: 'Entrenar', icon: 'dumbbell' }, { to: '/historial', label: 'Historial', icon: 'calendar' }, { to: '/mas', label: 'Más', icon: 'grid' }].map((n) => {
            const isMore = n.to === '/mas' && MORE.some((m) => pathname.startsWith(m.to));
            const main = n.to === '/entrenar';
            return (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('wd-c relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-xs font-semibold', isActive || isMore ? 'text-chalk' : 'text-mute')}>
                {main ? <span className="-mt-7 rounded-full shadow-[0_6px_18px_rgba(0,0,0,.5)] ring-4 ring-graphite"><Plate size={50} active={!!active} /></span> : <Icon name={n.icon} size={21} />}
                {main && active ? 'En curso' : n.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
