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
export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cx('block w-full text-left rounded-2xl bg-card border border-line p-4', onClick && 'active:scale-[.99] transition-transform hover:border-mute/40', className)}>
      {children}
    </Tag>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger' | 'go'; size?: 'sm' | 'md' | 'lg'; icon?: string };
export function Btn({ variant = 'soft', size = 'md', icon, className, children, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-fire text-black font-bold hover:brightness-110',
    go: 'bg-go text-black font-bold hover:brightness-110',
    soft: 'bg-card2 text-white border border-line hover:border-mute/50',
    ghost: 'text-mute hover:text-white',
    danger: 'bg-ember/15 text-ember border border-ember/30',
  }[variant];
  const s = { sm: 'h-9 px-3 text-sm rounded-xl', md: 'h-11 px-4 text-sm rounded-xl', lg: 'h-14 px-6 text-base rounded-2xl tracking-wide' }[size];
  return (
    <button type="button" {...rest} className={cx('inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none', v, s, className)}>
      {icon && <Icon name={icon} size={size === 'lg' ? 22 : 18} />}
      {children}
    </button>
  );
}

export function Title({ children, sub, right }: { children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight truncate">{children}</h1>
        {sub && <p className="text-sm text-mute mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
export const H2 = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="flex items-center justify-between mb-2 mt-1"><h2 className="text-xs font-bold uppercase tracking-widest text-mute">{children}</h2>{right}</div>
);

export function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-mute truncate">{label}</div>
      <div className="text-2xl font-extrabold tnum leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-mute truncate">{sub}</div>}
    </div>
  );
}

export function Empty({ icon = 'info', title, text, children }: { icon?: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-6 text-center">
      <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-card2 text-mute"><Icon name={icon} /></div>
      <div className="font-semibold">{title}</div>
      {text && <p className="mt-1 text-sm text-mute">{text}</p>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function Chip({ active, children, onClick, color }: { active?: boolean; children: ReactNode; onClick?: () => void; color?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cx('h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition', active ? 'border-transparent bg-white text-black' : 'border-line bg-card2 text-mute hover:text-white')}
      style={active && color ? { background: color, color: '#000' } : undefined}>
      {children}
    </button>
  );
}

export function Seg<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-card2 p-1 border border-line">
      {options.map((o) => (
        <button type="button" key={String(o.value)} onClick={() => onChange(o.value)} aria-pressed={o.value === value}
          className={cx('flex-1 h-9 rounded-lg text-sm font-semibold transition px-2', o.value === value ? 'bg-white text-black' : 'text-mute')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-mute">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-mute">{hint}</span>}
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
  const h = compact ? 'h-10' : 'h-12';
  return (
    <div className="min-w-0">
      {!compact && <div className="mb-1 text-[11px] uppercase tracking-wider text-mute">{label}</div>}
      <div className={cx('flex items-stretch rounded-xl border border-line bg-card2 overflow-hidden', h)}>
        <button type="button" aria-label={`Disminuir ${label}`} onClick={() => onChange(fix(value - step))} className="w-10 shrink-0 grid place-items-center text-mute active:bg-line"><Icon name="minus" size={16} /></button>
        <div className="relative flex-1 min-w-0">
          <input aria-label={label} inputMode="decimal" value={text ?? String(value)} onFocus={(e) => { setText(String(value)); e.target.select(); }} onChange={(e) => setText(e.target.value)} onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="!h-full !w-full !border-0 !bg-transparent !px-0 !py-0 text-center font-bold tnum !rounded-none" style={{ fontSize: 17 }} />
          {unit && text == null && <span className="pointer-events-none absolute bottom-0.5 left-0 right-0 text-center text-[9px] uppercase tracking-wider text-mute">{unit}</span>}
        </div>
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => onChange(fix(value + step))} className="w-10 shrink-0 grid place-items-center text-mute active:bg-line"><Icon name="plus" size={16} /></button>
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('relative w-full max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-graphite border border-line p-5 safe-b animate-rise', wide ? 'md:max-w-2xl' : 'md:max-w-md')}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold min-w-0 truncate">{title}</h3>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card2 text-mute"><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Bar({ value, max, color = '#3b9dff', height = 8 }: { value: number; max: number; color?: string; height?: number }) {
  return (
    <div className="w-full rounded-full bg-card2 overflow-hidden" style={{ height }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

export function Spark({ values, color = '#3b9dff', width = 120, height = 36 }: { values: number[]; color?: string; width?: number; height?: number }) {
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
          <div key={t.id} role="status" className={cx('pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-xl animate-pop', t.kind === 'error' ? 'bg-ember text-white' : 'bg-white text-black')}>{t.text}</div>
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
        <h1 className="text-xl font-bold mb-2">Algo salió mal en esta pantalla</h1>
        <p className="text-sm text-mute mb-1">Tus datos están guardados en el dispositivo y no se han perdido.</p>
        <p className="text-xs text-mute mb-5 break-words">{this.state.error.message}</p>
        <Btn variant="primary" onClick={() => { this.setState({ error: null }); window.location.hash = '#/'; window.location.reload(); }}>Volver al inicio</Btn>
      </div>
    );
  }
}
