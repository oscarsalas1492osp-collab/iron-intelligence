import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useActiveSession, useSyncState } from '../hooks';
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
      <svg width="30" height="30" viewBox="0 0 512 512" aria-hidden><rect width="512" height="512" rx="112" fill="#17191d" /><g fill="none" strokeWidth="40" strokeLinecap="round"><path d="M136 176v160M376 176v160M96 216v80M416 216v80" stroke="#ff6a1a" /><path d="M136 256h240" stroke="#fff" /></g></svg>
      <div className="leading-none"><div className="text-sm font-extrabold tracking-[.18em]">IRON</div><div className="text-[9px] font-semibold tracking-[.32em] text-mute">INTELLIGENCE</div></div>
    </div>
  );
}

export default function Layout() {
  const active = useActiveSession();
  const sync = useSyncState();
  const { pathname } = useLocation();
  const syncLabel = { local: 'Modo local', idle: 'Sincronizado', syncing: 'Sincronizando…', error: 'Error de sincronización', offline: 'Sin conexión' }[sync.status];
  const dot = { local: '#8b919c', idle: '#2fd17a', syncing: '#3b9dff', error: '#ff3b30', offline: '#f5c542' }[sync.status];
  return (
    <div className="min-h-full md:flex">
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:border-line md:bg-graphite md:p-4 md:sticky md:top-0 md:h-screen">
        <div className="mb-6 px-2 pt-1"><Logo /></div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-card2 text-white' : 'text-mute hover:text-white')}>
              <Icon name={n.icon} size={18} />{n.label}
              {n.to === '/entrenar' && active && <span className="ml-auto h-2 w-2 rounded-full bg-fire animate-pulse" />}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 px-2 pt-3 text-xs text-mute"><span className="h-2 w-2 rounded-full" style={{ background: dot }} />{syncLabel}</div>
      </aside>

      <main className="flex-1 min-w-0 pb-24 md:pb-10">
        <div className="mx-auto w-full max-w-5xl px-4 pt-5 md:px-8 md:pt-8"><Outlet /></div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-graphite/95 backdrop-blur md:hidden safe-b">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {[{ to: '/', label: 'Inicio', icon: 'home' }, { to: '/rutinas', label: 'Rutinas', icon: 'list' }, { to: '/entrenar', label: 'Entrenar', icon: 'dumbbell' }, { to: '/historial', label: 'Historial', icon: 'calendar' }, { to: '/mas', label: 'Más', icon: 'grid' }].map((n) => {
            const isMore = n.to === '/mas' && MORE.some((m) => pathname.startsWith(m.to));
            const main = n.to === '/entrenar';
            return (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold', isActive || isMore ? 'text-white' : 'text-mute')}>
                {main ? <span className={cx('-mt-6 grid h-12 w-12 place-items-center rounded-full bg-fire text-black shadow-lg shadow-fire/30', active && 'animate-pulse')}><Icon name="dumbbell" size={22} /></span> : <Icon name={n.icon} size={21} />}
                {n.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
