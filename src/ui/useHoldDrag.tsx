// Mantener presionado y arrastrar un elemento sobre otro (para unir ejercicios en biserie).
// Los destinos se marcan con `data-drop-id`. Funciona con dedo y con ratón; quien no pueda usar el gesto
// tiene siempre un botón equivalente en pantalla.
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';

const HOLD_MS = 380, SLOP = 10, EDGE = 44;

export interface HoldDrag {
  /** Propiedades para el elemento arrastrable. */
  bind: (id: string, label: string) => { onPointerDown: (e: RPointerEvent) => void; onContextMenu: (e: { preventDefault(): void }) => void; style: React.CSSProperties };
  dragging: string | null;
  over: string | null;
  /** Envuelve un onClick para que no se dispare al soltar tras arrastrar. */
  guard: <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => void;
  ghost: JSX.Element | null;
}

export function useHoldDrag(onDrop: (dragId: string, targetId: string) => void, canDropOn?: (dragId: string, targetId: string) => boolean): HoldDrag {
  const [state, setState] = useState<{ id: string; label: string; x: number; y: number; over: string | null } | null>(null);
  const ref = useRef<{ id: string; label: string; x0: number; y0: number; x: number; y: number; timer: number; active: boolean; raf: number } | null>(null);
  const lastDrag = useRef(0);
  const cb = useRef({ onDrop, canDropOn }); cb.current = { onDrop, canDropOn };

  const stop = useCallback(() => {
    const r = ref.current; if (!r) return;
    clearTimeout(r.timer); cancelAnimationFrame(r.raf);
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel);
    document.removeEventListener('touchmove', block);
    ref.current = null; setState(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const targetAt = (x: number, y: number, dragId: string): string | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-id]');
    const id = el?.dataset.dropId;
    return id && id !== dragId && (cb.current.canDropOn?.(dragId, id) ?? true) ? id : null;
  };
  // Mientras se arrastra, la página no debe desplazarse con el dedo.
  const block = (e: TouchEvent) => { if (ref.current?.active && e.cancelable) e.preventDefault(); };
  // Cerca de un borde, la lista se desplaza sola para alcanzar destinos fuera de la vista.
  const autoscroll = () => {
    const r = ref.current; if (!r?.active) return;
    const row = document.elementFromPoint(r.x, r.y)?.closest<HTMLElement>('[data-drop-scroll]');
    if (row) { const b = row.getBoundingClientRect(); if (r.x < b.left + EDGE) row.scrollLeft -= 9; else if (r.x > b.right - EDGE) row.scrollLeft += 9; }
    if (r.y < EDGE + 60) window.scrollBy(0, -9); else if (r.y > window.innerHeight - EDGE - 90) window.scrollBy(0, 9);
    setState((s) => (s ? { ...s, over: targetAt(r.x, r.y, r.id) } : s));
    r.raf = requestAnimationFrame(autoscroll);
  };
  const move = (e: PointerEvent) => {
    const r = ref.current; if (!r) return;
    r.x = e.clientX; r.y = e.clientY;
    if (!r.active) { if (Math.hypot(r.x - r.x0, r.y - r.y0) > SLOP) stop(); return; }
    setState({ id: r.id, label: r.label, x: r.x, y: r.y, over: targetAt(r.x, r.y, r.id) });
  };
  const up = (e: PointerEvent) => {
    const r = ref.current;
    if (r?.active) {
      lastDrag.current = Date.now();
      const t = targetAt(e.clientX, e.clientY, r.id);
      if (t) cb.current.onDrop(r.id, t);
    }
    stop();
  };
  const cancel = () => stop();

  useEffect(() => stop, [stop]);

  const bind: HoldDrag['bind'] = (id, label) => ({
    onPointerDown: (e) => {
      if (e.button > 0 || ref.current) return;
      const r = { id, label, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false, raf: 0, timer: 0 };
      r.timer = window.setTimeout(() => {
        if (ref.current !== r) return;
        r.active = true;
        try { navigator.vibrate?.(18); } catch { /* sin vibración */ }
        setState({ id, label, x: r.x, y: r.y, over: null });
        r.raf = requestAnimationFrame(autoscroll);
      }, HOLD_MS);
      ref.current = r;
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
      document.addEventListener('touchmove', block, { passive: false });
    },
    onContextMenu: (e) => e.preventDefault(),
    style: { WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' },
  });

  const guard: HoldDrag['guard'] = (fn) => (...a) => { if (Date.now() - lastDrag.current > 80) fn(...a); };

  const ghost = state ? (
    <div aria-hidden className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[140%] rounded-full bg-chalk px-3.5 py-2 text-sm font-bold text-ink shadow-[0_10px_30px_rgba(0,0,0,.6)]" style={{ left: state.x, top: state.y }}>
      {state.over ? 'Soltar para unir' : state.label}
    </div>
  ) : null;

  return { bind, dragging: state?.id ?? null, over: state?.over ?? null, guard, ghost };
}
