import { useId } from 'react';
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
  // Identificador propio: un degradado definido dentro de un bloque oculto no se pinta en los demás.
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <radialGradient id={id} cx="32%" cy="22%" r="90%">
          <stop offset="0" stopColor="#ffc078" /><stop offset=".42" stopColor="#ff7a26" /><stop offset="1" stopColor="#d94600" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill={`url(#${id})`} />
      <circle cx="24" cy="24" r="17.5" fill="none" stroke="#3a1400" strokeOpacity=".3" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="10.5" fill="none" stroke="#3a1400" strokeOpacity=".3" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="4.6" fill="#070d10" />
      {active && <circle cx="24" cy="24" r="1.8" fill="#ffb054" />}
    </svg>
  );
}

/** Secciones de análisis: la luz de la sala pasa a fría. */
const COOL = ['/analisis', '/historial', '/recuperacion', '/asistente', '/fundamento'];

export default function Layout() {
  const active = useActiveSession();
  const sync = useSyncState();
  const { pathname } = useLocation();
  const uid = useUserId();
  const noAccount = cloudEnabled && uid === 'local';
  const syncLabel = noAccount ? 'Sin cuenta · solo este dispositivo' : { local: 'Modo local', idle: sync.lastSync ? 'Sincronizado' : 'Pendiente de sincronizar', syncing: 'Sincronizando…', error: 'Sin sincronizar', offline: 'Sin conexión' }[sync.status];
  const dot = noAccount ? '#93a4ab' : { local: '#93a4ab', idle: sync.lastSync ? '#34e0a1' : '#f5c542', syncing: '#58c7ff', error: '#ff3b30', offline: '#f5c542' }[sync.status];
  return (
    <div className="min-h-full md:flex">
      <div className="ambient" data-tone={COOL.some((c) => pathname.startsWith(c)) ? 'cool' : 'warm'} aria-hidden />
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-line md:bg-white/[.025] md:p-4">
        <div className="mb-7 px-2 pt-2"><Logo /></div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('flex items-center gap-3 rounded-ctl px-3 py-2.5 text-[15px] transition-colors', isActive ? 'bg-card2 font-semibold text-chalk' : 'text-mute hover:bg-white/[.04] hover:text-chalk')}>
              <Icon name={n.icon} size={18} />{n.label}
              {n.to === '/entrenar' && active && <span className="wd-c ml-auto rounded-full bg-fire px-2 py-0.5 text-[11px] font-bold text-ink">en curso</span>}
            </NavLink>
          ))}
        </nav>
        <div className="wd-c flex items-center gap-2 px-2 pt-3 text-sm text-mute"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />{syncLabel}</div>
      </aside>

      <main className="min-w-0 flex-1 pb-32 md:pb-12">
        <div className="mx-auto w-full max-w-5xl px-4 pt-5 md:px-10 md:pt-9"><Outlet /></div>
      </main>

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden" aria-label="Navegación principal">
        <div className="glass-bar pointer-events-auto mx-auto flex max-w-md items-end rounded-[30px] p-1.5">
          {[{ to: '/', label: 'Inicio', icon: 'home' }, { to: '/rutinas', label: 'Rutinas', icon: 'list' }, { to: '/entrenar', label: 'Entrenar', icon: 'dumbbell' }, { to: '/historial', label: 'Historial', icon: 'calendar' }, { to: '/mas', label: 'Más', icon: 'grid' }].map((n) => {
            const isMore = n.to === '/mas' && MORE.some((m) => pathname.startsWith(m.to));
            const main = n.to === '/entrenar';
            return (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('wd-c relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors',
                main ? 'h-[54px] justify-end pb-[5px]' : 'h-[54px] rounded-[24px]', !main && (isActive || isMore) && 'bg-white/[.09]', isActive || isMore ? 'text-chalk' : 'text-mute')}>
                {({ isActive }) => main ? (
                  <>
                    <span className="orb absolute -top-[42px] grid h-14 w-14 place-items-center rounded-full">
                      {active && <span className="absolute inset-0 rounded-full border-2 border-amber animate-breathe" aria-hidden />}
                      <Icon name={active ? 'play' : 'dumbbell'} size={24} className="text-ink" />
                    </span>
                    {active ? 'En curso' : n.label}
                  </>
                ) : (
                  <><Icon name={n.icon} size={21} className={isActive || isMore ? 'text-fire' : ''} />{n.label}</>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
