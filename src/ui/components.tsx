import { Component, createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ');
export { cx };

// ---------- Iconos ----------
const PATHS: Record<string, string> = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  dumbbell: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z',
  chat: 'M4 5h16v11H9l-5 4z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12l5 5 9-10',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4v16M17 4v16',
  x: 'M6 6l12 12M18 6L6 18',
  right: 'M9 5l7 7-7 7',
  left: 'M15 5l-7 7 7 7',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  book: 'M5 4h13v16H5zM9 4v16M12 9h3',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  flask: 'M9 3h6M10 3v6l-5 10a1 1 0 001 1.5h12a1 1 0 001-1.5L14 9V3',
  cloud: 'M7 18a4 4 0 010-8 6 6 0 0111.5 1.5A3.5 3.5 0 0118 18z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  edit: 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4',
  timer: 'M12 8v5l3 2M12 21a8 8 0 100-16 8 8 0 000 16zM9 2h6',
  rotate: 'M4 12a8 8 0 0113.7-5.7L20 9M20 4v5h-5M20 12a8 8 0 01-13.7 5.7L4 15M4 20v-5h5',
  star: 'M12 4l2.4 5 5.6.8-4 3.9.9 5.5L12 16.6 7.1 19.2l.9-5.5-4-3.9 5.6-.8z',
  trophy: 'M8 4h8v5a4 4 0 01-8 0zM8 6H4a4 4 0 004 4M16 6h4a4 4 0 01-4 4M12 13v4M8 20h8',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7h.01',
};
export function Icon({ name, size = 20, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

// ---------- Básicos ----------
/** Panel para agrupar un objeto con el que se interactúa. No es el contenedor por defecto de cada sección. */
export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cx('block w-full text-left rounded-panel bg-card p-4', onClick && 'transition-colors hover:bg-card2 active:bg-card2', className)}>
      {children}
    </Tag>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger' | 'go'; size?: 'sm' | 'md' | 'lg'; icon?: string };
export function Btn({ variant = 'soft', size = 'md', icon, className, children, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-fire text-ink hover:brightness-110',
    go: 'bg-go text-ink hover:brightness-110',
    soft: 'bg-card2 text-chalk hover:bg-line',
    ghost: 'text-mute hover:text-chalk',
    danger: 'bg-ember/15 text-[#ff7a70] hover:bg-ember/25',
  }[variant];
  const s = {
    sm: 'h-9 px-3 text-sm rounded-ctl font-semibold',
    md: 'h-11 px-4 text-[15px] rounded-ctl font-semibold',
    lg: 'h-14 px-10 text-[15px] rounded-2xl font-extrabold wd-w tracking-wide',
  }[size];
  return (
    <button type="button" {...rest} className={cx('inline-flex items-center justify-center gap-2 transition active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none', v, s, size === 'lg' && variant === 'primary' && 'knurl', className)}>
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : 18} />}
      {children}
    </button>
  );
}

export function Title({ children, sub, right }: { children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="wd-x truncate text-[1.75rem] font-extrabold leading-tight tracking-tight">{children}</h1>
        {sub && <p className="wd-c mt-0.5 text-[15px] text-mute">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
/** Título de sección: una línea, en minúsculas, con el filete que separa la sección de la anterior. */
export const H2 = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mb-3 mt-7 flex items-baseline justify-between gap-3 border-t border-line pt-3 first:mt-0 first:border-0 first:pt-0">
    <h2 className="wd-w text-[15px] font-bold">{children}</h2>{right}
  </div>
);

export function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="min-w-0">
      <div className="label truncate">{label}</div>
      <div className="num text-2xl leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="wd-c truncate text-xs text-mute">{sub}</div>}
    </div>
  );
}

export function Empty({ icon = 'info', title, text, children }: { icon?: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="rounded-panel bg-card/60 px-5 py-8 text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center text-mute"><Icon name={icon} size={26} /></div>
      <div className="wd-w font-bold">{title}</div>
      {text && <p className="mx-auto mt-1 max-w-sm text-sm text-mute">{text}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function Chip({ active, children, onClick, color }: { active?: boolean; children: ReactNode; onClick?: () => void; color?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cx('wd-c h-9 shrink-0 rounded-full px-3.5 text-[15px] font-semibold transition-colors', active ? 'bg-chalk text-ink' : 'bg-card2 text-mute hover:text-chalk')}
      style={active && color ? { background: color, color: '#16181b' } : undefined}>
      {children}
    </button>
  );
}

export function Seg<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-ctl bg-card2 p-1">
      {options.map((o) => (
        <button type="button" key={String(o.value)} onClick={() => onChange(o.value)} aria-pressed={o.value === value}
          className={cx('wd-c h-9 flex-1 rounded-lg px-2 text-[15px] font-semibold transition-colors', o.value === value ? 'bg-chalk text-ink' : 'text-mute hover:text-chalk')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-mute">{hint}</span>}
    </label>
  );
}

/** Campo numérico con botones − / + y edición directa. Confirma al salir del campo. */
export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, label, unit, compact }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; label: string; unit?: string; compact?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const fix = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  const commit = () => {
    if (text == null) return;
    const n = parseFloat(text.replace(',', '.'));
    if (!Number.isNaN(n)) onChange(fix(n));
    setText(null);
  };
  // Las cifras largas (122,5 kg) reducen un poco el tamaño para caber completas.
  const shown = text ?? String(value);
  return (
    <div className="min-w-0">
      {!compact && <div className="label mb-1.5">{label}</div>}
      <div className={cx('flex items-stretch overflow-hidden rounded-ctl bg-card2', compact ? 'h-12' : 'h-12')}>
        <button type="button" aria-label={`Disminuir ${label}`} onClick={() => onChange(fix(value - step))} className={cx('grid shrink-0 place-items-center text-mute transition-colors hover:text-chalk active:bg-line', compact ? 'w-8' : 'w-10')}><Icon name="minus" size={16} /></button>
        <div className="relative min-w-0 flex-1">
          <input aria-label={label} inputMode="decimal" value={shown} onFocus={(e) => { setText(String(value)); e.target.select(); }} onChange={(e) => setText(e.target.value)} onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className={cx('num !h-full !w-full !rounded-none !border-0 !bg-transparent !px-0 text-center', unit ? '!pb-3 !pt-0' : '!py-0')} style={{ fontSize: compact ? (shown.length >= 6 ? 14 : shown.length >= 5 ? 16 : shown.length >= 3 ? 17 : 19) : 19 }} />
          {unit && text == null && <span className="wd-c pointer-events-none absolute inset-x-0 bottom-1 text-center text-[11px] font-semibold text-mute">{unit}</span>}
        </div>
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => onChange(fix(value + step))} className={cx('grid shrink-0 place-items-center text-mute transition-colors hover:text-chalk active:bg-line', compact ? 'w-8' : 'w-10')}><Icon name="plus" size={16} /></button>
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={cx('safe-b relative max-h-[92vh] w-full overflow-y-auto rounded-t-sheet bg-graphite p-5 shadow-[0_-12px_40px_rgba(0,0,0,.45)] animate-rise md:rounded-sheet', wide ? 'md:max-w-2xl' : 'md:max-w-md')}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line md:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="wd-w min-w-0 truncate text-lg font-bold">{title}</h3>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card2 text-mute hover:text-chalk"><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Bar({ value, max, color = '#5aa9ff', height = 8 }: { value: number; max: number; color?: string; height?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-card2" style={{ height }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

export function Spark({ values, color = '#5aa9ff', width = 120, height = 36 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 3 - ((v - min) / span) * (height - 6)}`).join(' ');
  return <svg width={width} height={height} aria-hidden><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// ---------- Avisos y confirmaciones ----------
interface Toast { id: number; text: string; kind: 'ok' | 'error' }
interface Ask { text: string; confirmLabel: string; danger: boolean; resolve: (v: boolean) => void }
const UiCtx = createContext<{ toast: (text: string, kind?: 'ok' | 'error') => void; confirm: (text: string, opts?: { confirmLabel?: string; danger?: boolean }) => Promise<boolean> }>({ toast: () => {}, confirm: async () => false });
export const useUi = () => useContext(UiCtx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ask, setAsk] = useState<Ask | null>(null);
  const seq = useRef(0);
  const toast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  const confirm = useCallback((text: string, opts: { confirmLabel?: string; danger?: boolean } = {}) =>
    new Promise<boolean>((resolve) => setAsk({ text, confirmLabel: opts.confirmLabel ?? 'Confirmar', danger: opts.danger ?? false, resolve })), []);
  const close = (v: boolean) => { ask?.resolve(v); setAsk(null); };
  return (
    <UiCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cx('pointer-events-auto max-w-md rounded-ctl px-4 py-2.5 text-sm font-semibold shadow-[0_8px_24px_rgba(0,0,0,.4)] animate-pop', t.kind === 'error' ? 'bg-ember text-chalk' : 'bg-chalk text-ink')}>{t.text}</div>
        ))}
      </div>
      <Sheet open={!!ask} onClose={() => close(false)} title="Confirmar">
        <p className="text-sm text-mute mb-5">{ask?.text}</p>
        <div className="flex gap-2">
          <Btn className="flex-1" onClick={() => close(false)}>Cancelar</Btn>
          <Btn className="flex-1" variant={ask?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{ask?.confirmLabel}</Btn>
        </div>
      </Sheet>
    </UiCtx.Provider>
  );
}

/** Ejecuta una acción asíncrona y muestra el error al usuario si falla. */
export function useAction() {
  const { toast } = useUi();
  return useCallback(async <T,>(fn: () => Promise<T>, okMsg?: string): Promise<T | undefined> => {
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
    catch (e) { toast(e instanceof Error ? e.message : 'Ocurrió un error inesperado', 'error'); return undefined; }
  }, [toast]);
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-6 max-w-md mx-auto mt-16 text-center">
        <h1 className="wd-x text-xl font-extrabold mb-2">Algo salió mal en esta pantalla</h1>
        <p className="text-sm text-mute mb-1">Tus datos están guardados en el dispositivo y no se han perdido.</p>
        <p className="text-xs text-mute mb-5 break-words">{this.state.error.message}</p>
        <Btn variant="primary" onClick={() => { this.setState({ error: null }); window.location.hash = '#/'; window.location.reload(); }}>Volver al inicio</Btn>
      </div>
    );
  }
}
