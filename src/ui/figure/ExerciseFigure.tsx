// Icono de ejercicio: un maniquí en la postura característica del movimiento, con el implemento que se usa
// y los músculos que trabajan encendidos. En la ficha se anima entre la postura inicial y la final.
import { memo, useEffect, useRef, useState } from 'react';
import { db } from '../../data/db';
import { patternOf } from '../../domain/exerciseLibrary';
import type { Equipment, ExerciseDef, Muscle } from '../../domain/types';
import { add, DIM, mix, sameLimb, solve, type Joints, type Limb, type V } from './rig';
import { sceneFor, type Prop, type Scene } from './scenes';
import { getFigureLook, useFigureLook, type FigureLook } from '../figurePref';

const C = { near: '#d0d5dc', far: '#7b828d', gear: '#474d57', gearHi: '#69707b', tool: '#f3f1ec', toolFill: '#2a2e35', hot: '#ff6a1a', warm: '#b24a2c' };
const FLOOR = 67.4;
type FigureEx = Pick<ExerciseDef, 'id' | 'primary' | 'secondary' | 'type' | 'equipment'>;

const L = (p: V, q: V, w: number, color: string, key: string, extra: Record<string, unknown> = {}) =>
  <line key={key} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={color} strokeWidth={w} strokeLinecap="round" {...extra} />;
const O = (c: V, r: number, fill: string, key: string, extra: Record<string, unknown> = {}) => <circle key={key} cx={c[0]} cy={c[1]} r={r} fill={fill} {...extra} />;
const unit = (p: V, q: V): V => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [(q[0] - p[0]) / d, (q[1] - p[1]) / d]; };
/** Normal hacia el frente del cuerpo: el tronco y las extremidades giran en sentidos opuestos. */
const frontOf = (p: V, q: V, trunk = false): V => { const u = unit(p, q); return trunk ? [-u[1], u[0]] : [u[1], -u[0]]; };
const part = (p: V, q: V, t0: number, t1: number, n: V = [0, 0], off = 0): [V, V] => [add(mix(p, q, t0), n, off), add(mix(p, q, t1), n, off)];

// ---------- Cuerpo ----------
function limbEls(l: Limb, arm: boolean, color: string, key: string) {
  const [w1, w2] = arm ? [4.2, 3.5] : [5.4, 4.2];
  return [L(l.a, l.b, w1, color, key + 'u'), L(l.b, l.c, w2, color, key + 'l'),
    arm ? (l.d ? L(l.c, l.d, 2.8, color, key + 'h') : O(l.c, 1.95, color, key + 'h')) : L(l.c, l.d!, 2.9, color, key + 'f')];
}

function body(j: Joints, key: string) {
  const side = j.view === 'side';
  const els: JSX.Element[] = [];
  if (side) {
    if (!sameLimb(j.arms[0], j.arms[1])) els.push(...limbEls(j.arms[1], true, C.far, key + 'a2'));
    if (!sameLimb(j.legs[0], j.legs[1])) els.push(...limbEls(j.legs[1], false, C.far, key + 'g2'));
    els.push(L(j.hip, j.sh, 7.2, C.near, key + 't'));
  } else {
    const [sr, sl] = [j.arms[0].a, j.arms[1].a], [hr, hl] = [j.legs[0].a, j.legs[1].a];
    els.push(<path key={key + 't'} d={`M${sl} L${sr} L${hr} L${hl} Z`} fill={C.near} stroke={C.near} strokeWidth={4.4} strokeLinejoin="round" />);
  }
  els.push(L(j.sh, j.head, 3, C.near, key + 'n'), O(j.head, DIM.HEAD, C.near, key + 'hd'));
  if (!side) els.push(...limbEls(j.legs[1], false, C.near, key + 'g2'), ...limbEls(j.arms[1], true, C.near, key + 'a2'));
  els.push(...limbEls(j.legs[0], false, C.near, key + 'g1'), ...limbEls(j.arms[0], true, C.near, key + 'a1'));
  return els;
}

// ---------- Músculos encendidos ----------
function marks(j: Joints, m: Muscle, color: string, key: string): JSX.Element[] {
  const side = j.view === 'side';
  const out: JSX.Element[] = [];
  const ln = (pq: [V, V], w: number) => out.push(L(pq[0], pq[1], w, color, `${key}${out.length}`));
  const dot = (c: V, r: number) => out.push(O(c, r, color, `${key}${out.length}`));
  const limbs = (arm: boolean) => (side ? [arm ? j.arms[0] : j.legs[0]] : arm ? j.arms : j.legs);
  const onLimb = (arm: boolean, upper: boolean, t0: number, t1: number, off: number, w: number) => {
    for (const l of limbs(arm)) { const [p, q] = upper ? [l.a, l.b] : [l.b, l.c]; ln(part(p, q, t0, t1, frontOf(p, q), side ? off : 0), w); }
  };
  const tn = frontOf(j.hip, j.sh, true);
  const torso = (t0: number, t1: number, off: number, w: number) => ln(part(j.hip, j.sh, t0, t1, tn, off), w);
  const across: V = side ? [0, 0] : unit(j.arms[1].a, j.arms[0].a);
  const at = (t: number, x: number): V => add(mix(j.hip, j.sh, t), across, x);
  switch (m) {
    case 'chest': if (side) torso(0.62, 0.94, 2.1, 3.2); else { ln([at(0.78, 1.3), at(0.8, 5.6)], 3.6); ln([at(0.78, -1.3), at(0.8, -5.6)], 3.6); } break;
    case 'abs': if (side) torso(0.1, 0.52, 2.2, 2.9); else ln([at(0.08, 0), at(0.55, 0)], 4.2); break;
    case 'obliques': if (side) torso(0.12, 0.5, 0, 3.4); else { ln([at(0.12, 3.9), at(0.5, 4.6)], 2.3); ln([at(0.12, -3.9), at(0.5, -4.6)], 2.3); } break;
    case 'back': if (side) torso(0.4, 0.92, -2.2, 3.2); else { ln([at(0.34, 2.6), at(0.84, 6)], 3.2); ln([at(0.34, -2.6), at(0.84, -6)], 3.2); } break;
    case 'lowerback': if (side) torso(0.04, 0.38, -2.3, 2.9); else ln([at(0.04, 0), at(0.36, 0)], 4.2); break;
    case 'traps': if (side) torso(0.88, 1.1, -1.7, 2.9); else { ln([at(1.06, 1), at(0.99, 5.4)], 2.6); ln([at(1.06, -1), at(0.99, -5.4)], 2.6); } break;
    case 'neck': ln(part(j.sh, j.head, 0.05, 0.5), 2.6); break;
    case 'shoulders': for (const l of limbs(true)) dot(l.a, 2.9); break;
    case 'biceps': onLimb(true, true, 0.2, 0.9, 0.85, side ? 2.5 : 2.9); break;
    case 'triceps': onLimb(true, true, 0.2, 0.9, -0.85, side ? 2.5 : 2.9); break;
    case 'forearms': onLimb(true, false, 0.05, 0.8, 0, 2.6); break;
    case 'glutes': if (side) dot(add(j.hip, tn, -1.5), 3.5); else for (const l of j.legs) dot(add(l.a, [0, 0.6]), 2.9); break;
    case 'abductors': if (side) dot(add(j.hip, [0, 0.4]), 2.6); else { dot(add(j.legs[0].a, across, 2.3), 2.3); dot(add(j.legs[1].a, across, -2.3), 2.3); } break;
    case 'adductors': onLimb(false, true, 0.08, 0.62, 0, side ? 2.6 : 3); break;
    case 'quads': onLimb(false, true, 0.12, 0.92, 1.15, side ? 2.9 : 3.6); break;
    case 'hamstrings': onLimb(false, true, 0.12, 0.92, -1.15, side ? 2.9 : 3.6); break;
    case 'calves': onLimb(false, false, 0.04, 0.62, -0.8, side ? 2.6 : 3); break;
    case 'tibialis': onLimb(false, false, 0.1, 0.8, 0.9, 2); break;
  }
  return out;
}

// ---------- Implementos ----------
const PLATES: Equipment[] = ['barbell', 'smith', 'ez_bar', 'trap_bar'];
const MACH: Equipment[] = ['machine', 'convergent', 'lever', 'isolation_machine'];
const disc = (c: V, r: number, key: string) => [O(c, r, C.toolFill, key, { stroke: C.tool, strokeWidth: 1.3 }), O(c, r * 0.24, C.tool, key + 'c')];
const zigzag = (p: V, q: V, key: string) => {
  const n = Math.max(4, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / 3.2)); const u = unit(p, q); const nx: V = [-u[1], u[0]];
  const pts = Array.from({ length: n + 1 }, (_, i) => add(mix(p, q, i / n), nx, i === 0 || i === n ? 0 : i % 2 ? 1.5 : -1.5));
  return <polyline key={key} points={pts.map((v) => v.join(',')).join(' ')} fill="none" stroke={C.tool} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />;
};

/** Mobiliario detrás del cuerpo: suelo, banco, asiento, columna de la polea, guía de la Smith, placas. */
function furniture(sc: Scene, j: Joints, eq: Equipment): JSX.Element[] {
  const els: JSX.Element[] = [];
  const side = j.view === 'side';
  if (side && sc.bench) {
    const n = frontOf(j.hip, j.sh, true); const u = unit(j.hip, j.sh);
    const p = add(add(j.hip, u, -1.5), n, -5.4), q = add(add(j.sh, u, DIM.NECK * 0.9), n, -5.4);
    els.push(L(p, q, 3, C.gear, 'bn'));
    if (Math.abs(u[0]) > 0.55) { els.push(L(mix(p, q, 0.12), [mix(p, q, 0.12)[0], FLOOR], 2, C.gear, 'bn1'), L(mix(p, q, 0.85), [mix(p, q, 0.85)[0], FLOOR], 2, C.gear, 'bn2')); }
    else els.push(L(p, [p[0], FLOOR], 2, C.gear, 'bn1'));
  }
  if (side && sc.seat) {
    const y = j.hip[1] + 4.6;
    els.push(L([j.hip[0] - 4, y], [j.hip[0] + 9, y], 3, C.gear, 'st'), L([j.hip[0] + 2.5, y], [j.hip[0] + 2.5, FLOOR], 2, C.gear, 'st1'));
  }
  for (const [i, pr] of (sc.props ?? []).entries()) els.push(prop(pr, 'p' + i));
  const cx = side ? 0 : j.hip[0];
  if ((eq === 'cable' || (eq === 'band' && sc.anchor)) && sc.anchor) {
    const xs = side || sc.anchor[0] === 0 ? [cx + sc.anchor[0]] : [cx + sc.anchor[0], cx - sc.anchor[0]];
    for (const [i, x] of xs.entries()) {
      if (eq === 'cable') els.push(L([x, 4], [x, FLOOR], 2, C.gear, 'col' + i), O([x, sc.anchor[1]], 2, C.gearHi, 'pul' + i));
    }
  }
  if (eq === 'smith' && side) els.push(L([j.arms[0].c[0], 3], [j.arms[0].c[0], FLOOR], 1.6, C.gear, 'rail', { strokeDasharray: '1 3.4' }));
  if (MACH.includes(eq) && side) {
    const s = sc.stack ?? [3.4, 36];
    if (sc.pivot) els.push(L(sc.pivot, j.arms[0].c, 2, C.gearHi, 'lev'), O(sc.pivot, 1.8, C.gearHi, 'piv'));
    // Máquina de discos: un disco en su soporte en lugar de la torre de placas.
    if (eq === 'lever') els.push(L([s[0] + 3.3, s[1] + 12], [s[0] + 3.3, FLOOR], 2, C.gear, 'lvp'), ...disc([s[0] + 3.3, s[1] + 14], 4.4, 'lvd'));
    else els.push(<rect key="stk" x={s[0]} y={s[1]} width={6.6} height={24} rx={1.4} fill={C.gear} />, ...[0.25, 0.5, 0.75].map((t) => L([s[0] + 1, s[1] + 24 * t], [s[0] + 5.6, s[1] + 24 * t], 0.9, C.toolFill, 'stk' + t)));
  }
  return els;
}

function prop(p: Prop, key: string) {
  if (p[0] === 'l') return L([p[1], p[2]], [p[3], p[4]], p[5] ?? 2, C.gear, key);
  if (p[0] === 'r') return <rect key={key} x={p[1]} y={p[2]} width={p[3]} height={p[4]} rx={1.6} fill={C.gear} />;
  return O([p[1], p[2]], p[3], C.gear, key);
}

/** Lo que se sostiene o se empuja, por encima del cuerpo. */
function gear(sc: Scene, j: Joints, eq: Equipment): JSX.Element[] {
  const els: JSX.Element[] = [];
  const side = j.view === 'side';
  const load = sc.load ?? 'hand';
  const hands = side ? (sameLimb(j.arms[0], j.arms[1]) ? [j.arms[0].c] : [j.arms[1].c, j.arms[0].c]) : [j.arms[0].c, j.arms[1].c];
  const cx = j.hip[0];
  if (load === 'none') return els;
  if (load === 'wheel') return [O(j.arms[0].c, 3.6, C.toolFill, 'wh', { stroke: C.tool, strokeWidth: 1.4 }), O(j.arms[0].c, 0.9, C.tool, 'whc')];
  if (load === 'rope') return hands.map((h, i) => <path key={'rp' + i} d={`M${h} q5 ${i ? 5 : -5} 10 ${4 + i * 2} t9 ${FLOOR - h[1] - 6 - i * 3}`} fill="none" stroke={C.tool} strokeWidth={1.5} strokeLinecap="round" />);
  if (load === 'ankle') {
    const l = j.legs[0]; const n = frontOf(l.b, l.c);
    if (MACH.includes(eq)) els.push(L(l.b, add(mix(l.b, l.c, 0.9), n, 3), 1.6, C.gearHi, 'la'), O(l.b, 1.6, C.gearHi, 'lp'));
    if (eq === 'cable' && sc.anchor) els.push(L(mix(l.b, l.c, 0.9), sc.anchor, 1.1, C.tool, 'lc'));
    els.push(O(add(mix(l.b, l.c, 0.9), n, MACH.includes(eq) ? 3 : 0), MACH.includes(eq) ? 2.5 : 1.9, C.tool, 'lr'));
    return els;
  }
  if (load === 'feet') {
    const l = j.legs[0]; const u = unit(l.c, l.d!); const push = unit(j.hip, l.c);
    const c = add(mix(l.c, l.d!, 0.5), push, 2.6);
    els.push(L(add(c, u, -6.5), add(c, u, 6.5), 2.4, C.gearHi, 'pf'), ...disc(add(add(c, u, 5), push, 4.2), 3.6, 'pd'));
    return els;
  }
  if (load === 'knee') {
    const out = (sc.b.kT ?? 0) > (sc.a.kT ?? 0) ? 1 : -1;
    return j.legs.map((l, i) => L(add(l.b, [(i ? -1 : 1) * out * 3.4, -2.4]), add(l.b, [(i ? -1 : 1) * out * 3.4, 3]), 2.4, C.tool, 'kp' + i));
  }
  if (load === 'hip') {
    if (eq === 'bodyweight' || eq === 'band') return els;
    const n = frontOf(j.hip, j.sh, true); const c = add(j.hip, n, 5.4);
    return PLATES.includes(eq) || eq === 'lever' ? disc(c, 4.4, 'hp') : eq === 'dumbbell' || eq === 'kettlebell' || eq === 'plate' ? [O(c, 2.9, C.tool, 'hp')] : [L(add(c, [-4, 0]), add(c, [4, 0]), 2.6, C.tool, 'hp')];
  }
  // ---- En las manos ----
  const mid = mix(hands[0], hands[hands.length - 1], 0.5);
  const anchorOf = (h: V): V | null => {
    if (!sc.anchor) return null;
    if (side) return sc.anchor;
    if (sc.anchor[0] === 0) return [cx, sc.anchor[1]];
    return [cx + (h[0] >= cx ? 1 : -1) * sc.anchor[0], sc.anchor[1]];
  };
  if (sc.bar && !side) els.push(L([hands[1][0] - 3.5, hands[1][1]], [hands[0][0] + 3.5, hands[0][1]], 1.9, C.tool, 'bar'));
  if (PLATES.includes(eq)) {
    if (side) els.push(...disc(hands[hands.length - 1], 4.6, 'pl'));
    else if (!sc.bar) {
      const y = mid[1]; const x0 = Math.min(hands[0][0], hands[1][0]) - 9, x1 = Math.max(hands[0][0], hands[1][0]) + 9;
      els.push(L([x0, y], [x1, y], 1.7, C.tool, 'bb'), ...[x0 + 1.6, x1 - 1.6].map((x) => <rect key={'bp' + x} x={x - 1.3} y={y - 4.4} width={2.6} height={8.8} rx={1} fill={C.toolFill} stroke={C.tool} strokeWidth={1.1} />));
    }
  } else if (eq === 'dumbbell') {
    for (const [i, h] of hands.entries()) els.push(side ? O(h, 2.8, C.tool, 'db' + i, { stroke: C.toolFill, strokeWidth: 0.8 }) : <g key={'db' + i}>{L([h[0] - 3.4, h[1]], [h[0] + 3.4, h[1]], 1.5, C.tool, 'x')}<rect x={h[0] - 4.4} y={h[1] - 2.2} width={2.2} height={4.4} rx={0.7} fill={C.tool} /><rect x={h[0] + 2.2} y={h[1] - 2.2} width={2.2} height={4.4} rx={0.7} fill={C.tool} /></g>);
  } else if (eq === 'kettlebell') {
    for (const [i, h] of hands.entries()) els.push(O(add(h, [0, 3.6]), 3, C.tool, 'kb' + i, { stroke: C.toolFill, strokeWidth: 0.8 }));
  } else if (eq === 'plate' || eq === 'medball') {
    const close = Math.hypot(hands[0][0] - hands[hands.length - 1][0], hands[0][1] - hands[hands.length - 1][1]) < 9;
    for (const [i, c] of (close ? [mid] : hands).entries()) els.push(...(eq === 'plate' ? disc(c, 4, 'pt' + i) : [O(c, 4.2, C.toolFill, 'mb' + i, { stroke: C.tool, strokeWidth: 1.3 }), <path key={'mbs' + i} d={`M${c[0] - 3.6} ${c[1] - 1} q3.6 3 7.2 0`} fill="none" stroke={C.tool} strokeWidth={0.9} />]));
  } else if (eq === 'cable' || eq === 'band') {
    const from = sc.bar && !side ? [mid] : hands;
    for (const [i, h] of from.entries()) {
      const a = anchorOf(h) ?? (eq === 'band' ? [h[0], FLOOR - 1] as V : null);
      if (!a) continue;
      els.push(eq === 'band' ? zigzag(a, h, 'bd' + i) : L(a, h, 1.1, C.tool, 'cb' + i));
    }
  } else if (eq === 'landmine') {
    const base: V = [64, FLOOR - 1];
    els.push(L(base, hands[hands.length - 1], 1.8, C.tool, 'lm'), ...disc(mix(base, hands[hands.length - 1], 0.84), 3.5, 'lmd'), O(base, 1.8, C.gearHi, 'lmb'));
  } else if (eq === 'suspension') {
    for (const [i, h] of hands.entries()) els.push(L(sc.anchor && side ? sc.anchor : [side ? h[0] : cx + (h[0] >= cx ? 5 : -5), 3], h, 1.1, C.tool, 'sp' + i));
  } else if (MACH.includes(eq)) {
    // Empuñaduras, solo cuando las manos sujetan la máquina (sentado o con barra).
    if (sc.seat || sc.bench || sc.bar) for (const [i, h] of hands.entries()) {
      const l = side ? j.arms[0] : j.arms[i]; const n = frontOf(l.b, l.c);
      els.push(L(add(h, n, -1.9), add(h, n, 1.9), 1.7, C.tool, 'gr' + i));
    }
    if (sc.bar && !side && sc.anchor) els.push(L([cx, sc.anchor[1]], mid, 1.1, C.tool, 'mc'));
  }
  return els;
}

export function drawScene(sc: Scene, ex: FigureEx, t: number, ghost: boolean) {
  const j = solve(sc.view, sc.a, sc.b, t);
  const inner = (
    <>
      {ghost && <g opacity={0.2}>{body(solve(sc.view, sc.a, sc.b, 0), 'g')}</g>}
      {furniture(sc, j, ex.equipment)}
      {body(j, 'b')}
      {ex.secondary.flatMap((m) => marks(j, m, C.warm, 's' + m))}
      {marks(j, ex.primary, C.hot, 'p')}
      {gear(sc, j, ex.equipment)}
    </>
  );
  return (
    <>
      {sc.floor !== false && L([5, FLOOR + 1.4], [67, FLOOR + 1.4], 1.2, C.gear, 'fl')}
      {sc.flip ? <g transform="translate(0 72.8) scale(1 -1)">{inner}</g> : inner}
    </>
  );
}

/** Encuadre: el icono se ajusta a lo que ocupa la figura (una o ambas posturas), para que llene la miniatura. */
const frames = new WeakMap<Scene, Record<string, string>>();
function frameOf(sc: Scene, both: boolean): string {
  const key = both ? 'ab' : 'b';
  const hit = frames.get(sc)?.[key];
  if (hit) return hit;
  let x0 = 99, y0 = 99, x1 = -99, y1 = -99;
  const eat = (p: V, r: number) => { const y = sc.flip ? 72.8 - p[1] : p[1]; x0 = Math.min(x0, p[0] - r); x1 = Math.max(x1, p[0] + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };
  for (const t of both ? [0, 1] : [1]) {
    const j = solve(sc.view, sc.a, sc.b, t);
    eat(j.head, DIM.HEAD + 1); eat(j.hip, 4); eat(j.sh, 4);
    for (const l of j.arms) { eat(l.b, 2.5); eat(l.c, 6); }
    for (const l of j.legs) { eat(l.b, 3); eat(l.c, 3); if (l.d) eat(l.d, 2); }
  }
  if (sc.floor !== false) { y1 = Math.max(y1, FLOOR + 2.4); }
  const size = Math.min(72, Math.max(42, x1 - x0, y1 - y0) + 5);
  const cx = Math.min(72 - size / 2, Math.max(size / 2, (x0 + x1) / 2));
  // Con suelo, la figura se apoya en el borde inferior del encuadre.
  const top = sc.floor !== false ? Math.max(0, FLOOR + 3.4 - size) : Math.min(72 - size, Math.max(0, (y0 + y1) / 2 - size / 2));
  const vb = `${(cx - size / 2).toFixed(1)} ${top.toFixed(1)} ${size.toFixed(1)} ${size.toFixed(1)}`;
  frames.set(sc, { ...frames.get(sc), [key]: vb });
  return vb;
}

const noMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Figura renderizada en 3D ----------
// El pictograma de arriba se muestra al instante y queda como respaldo; cuando el render 3D está listo lo reemplaza.
// Cada combinación de postura, implemento y músculos se renderiza una sola vez y se reutiliza.
type Mod = typeof import('./render3d');
let mod: Promise<Mod> | null = null;
let broken = typeof WebGLRenderingContext === 'undefined';
const load3d = () => (mod ??= import('./render3d'));
const thumbs = new Map<string, string>();
const waiters = new Map<string, Set<() => void>>();
const queue: { key: string; ex: FigureEx; sc: Scene; fig: Fig; look: FigureLook }[] = [];
type Fig = 'male' | 'female';
/** Figura de los ejercicios: la misma que muestra el mapa muscular en este dispositivo. */
const figNow = (): Fig => { try { return localStorage.getItem('ii_fig') === 'female' ? 'female' : 'male'; } catch { return 'male'; } };
// Clave estable de cada escena (resumen de su contenido): sirve entre aperturas de la app y cambia sola si la postura cambia.
const sceneIds = new WeakMap<Scene, string>();
const hash = (t: string) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
let pumping = false;
const keyOf = (ex: FigureEx, sc: Scene) => {
  let id = sceneIds.get(sc); if (!id) { id = hash(JSON.stringify(sc)); sceneIds.set(sc, id); }
  return `${figNow()}${getFigureLook() === 'anatomia' ? '+anatomia' : ''}|${id}|${ex.equipment}|${ex.primary}|${ex.secondary.join(',')}`;
};

// Las figuras ya dibujadas se guardan en el dispositivo: al volver a abrir la app aparecen al instante, sin redibujarlas.
// El número de versión se sube cuando cambia el dibujo, para descartar las guardadas.
const STORE = 'thumb:8:';
let hydrated: Promise<void> | null = null;
const hydrate = () => (hydrated ??= (async () => {
  try {
    const rows = await db.meta.where('key').startsWith('thumb:').toArray();
    const old: string[] = [];
    for (const r of rows) { if (r.key.startsWith(STORE) && typeof r.value === 'string') thumbs.set(r.key.slice(STORE.length), r.value); else old.push(r.key); }
    if (old.length) void db.meta.bulkDelete(old).catch(() => undefined);
  } catch { /* sin almacenamiento: se dibujan en cada apertura */ }
})());
const remember = (key: string, url: string) => { thumbs.set(key, url); void db.meta.put({ key: STORE + key, value: url }).catch(() => undefined); };

// Mientras el usuario toca o desplaza la pantalla no se dibuja ninguna figura: dibujar ocupa el hilo principal
// y un toque dado en ese instante llegaría tarde.
let lastInput = 0;
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchstart', 'touchmove', 'wheel', 'scroll', 'keydown']) window.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true });
}
const QUIET_MS = 350;

function pump(): void {
  if (pumping) return;
  pumping = true;
  void load3d().then((m) => {
    // Una figura por turno y con una pausa entre ellas: los toques y el desplazamiento siempre pasan primero.
    const step = async () => {
      if (Date.now() - lastInput < QUIET_MS) { setTimeout(() => void step(), 120); return; }
      let job = queue.shift();
      // Nadie espera ya esta figura (la fila salió de pantalla): se descarta y se volverá a pedir si hace falta.
      while (job && !waiters.get(job.key)?.size) { waiters.delete(job.key); job = queue.shift(); }
      const c0 = Date.now();
      if (job) {
        try { m.setLook(job.look); await m.prepare(job.fig); m.setLook(job.look); remember(job.key, m.renderThumb(job.ex, job.sc, 192, job.fig)); } catch { broken = true; queue.length = 0; }
        waiters.get(job.key)?.forEach((cb) => cb()); waiters.delete(job.key);
      }
      // Tras cada figura se deja libre el doble de lo que tardó en dibujarse.
      if (queue.length) setTimeout(() => void step(), Math.max(40, (Date.now() - c0) * 2)); else pumping = false;
    };
    setTimeout(() => void step(), 0);
  }).catch(() => { broken = true; pumping = false; });
}
function useThumb(ex: FigureEx, sc: Scene, on: boolean): string | null {
  useFigureLook();                       // al cambiar el aspecto cambia la clave y se pide la miniatura nueva
  const key = keyOf(ex, sc);
  const [url, setUrl] = useState<string | null>(() => thumbs.get(key) ?? null);
  useEffect(() => {
    if (!on || broken) { setUrl(null); return; }
    const hit = thumbs.get(key);
    if (hit) { setUrl(hit); return; }
    setUrl(null);
    let alive = true;
    const cb = () => { if (alive) setUrl(thumbs.get(key) ?? null); };
    void hydrate().then(() => {
      if (!alive) return;
      if (thumbs.has(key)) { cb(); return; }
      if (!waiters.has(key)) { waiters.set(key, new Set()); queue.push({ key, ex, sc, fig: figNow(), look: getFigureLook() }); }
      waiters.get(key)!.add(cb);
      pump();
    });
    return () => { alive = false; waiters.get(key)?.delete(cb); };
  // La clave resume el ejercicio y la escena.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, on]);
  return url;
}

/** Movimiento en vivo: el render 3D se copia cuadro a cuadro a un lienzo visible. */
function Motion3D({ ex, sc, size, className, onFail }: { ex: FigureEx; sc: Scene; size: number; className?: string; onFail: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const look = useFigureLook();
  useEffect(() => {
    let raf = 0, dead = false, fig: InstanceType<Mod['Figure3D']> | null = null;
    const px = Math.min(520, Math.round(size * Math.min(2.5, window.devicePixelRatio || 1)));
    void load3d().then(async (m) => {
      const who = figNow(); m.setLook(look); await m.prepare(who);
      if (dead || !ref.current) return;
      m.setLook(look);
      fig = new m.Figure3D(ex, sc, !sc.still, who);
      const ctx = ref.current.getContext('2d')!;
      const paintAt = (t: number) => { ctx.clearRect(0, 0, px, px); ctx.drawImage(fig!.draw(t, px), 0, 0); };
      paintAt(1); setReady(true);
      if (sc.still || noMotion()) return;
      const t0 = performance.now(); let last = 0, gap = 33;
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (now - last < gap) return;
        last = now;
        const ph = ((now - t0) % 3000) / 3000, u = ph < 0.5 ? ph * 2 : 2 - ph * 2, e = Math.min(1, Math.max(0, (u - 0.12) / 0.76));
        const c0 = performance.now();
        paintAt(1 - (1 - Math.cos(Math.PI * e)) / 2);
        // En un equipo lento se dibujan menos cuadros: la pantalla queda libre al menos dos tercios del tiempo.
        gap = Math.max(33, (performance.now() - c0) * 3);
      };
      raf = requestAnimationFrame(tick);
    }).catch(() => { broken = true; onFail(); });
    return () => { dead = true; cancelAnimationFrame(raf); fig?.dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.id, sc, size, look]);
  const px = Math.min(520, Math.round(size * Math.min(2.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)));
  return <canvas ref={ref} width={px} height={px} role="img" aria-label="Ilustración del movimiento" className={className} style={{ width: className ? undefined : size, height: className ? undefined : size, opacity: ready ? 1 : 0, transition: 'opacity .25s' }} />;
}

/** `animate`: recorre el movimiento en bucle (solo en la ficha). Sin animar muestra la postura característica; con `ghost`, también la inicial, tenue. */
export const ExerciseFigure = memo(function ExerciseFigure({ ex, size = 56, animate = false, ghost = false, className }: { ex: FigureEx; size?: number; animate?: boolean; ghost?: boolean; className?: string }) {
  const sc = sceneFor(ex, patternOf(ex.id));
  const [fail, setFail] = useState(false);
  const live = animate && !broken && !fail;
  const url = useThumb(ex, sc, !animate);
  const moving = animate && !live && !sc.still && !noMotion();
  const [t, setT] = useState(1);
  useEffect(() => {
    if (!moving) { setT(1); return; }
    let raf = 0; const t0 = performance.now(); let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 33) return; // 30 cuadros por segundo bastan
      last = now;
      // Pausa breve en cada extremo para que se lean las dos posturas.
      const ph = ((now - t0) % 3000) / 3000; const u = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const e = Math.min(1, Math.max(0, (u - 0.12) / 0.76));
      setT(1 - (1 - Math.cos(Math.PI * e)) / 2);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [moving, ex.id]);
  if (live) return <Motion3D ex={ex} sc={sc} size={size} className={className} onFail={() => setFail(true)} />;
  if (url) return <img src={url} width={size} height={size} alt="" role="img" aria-label="Ilustración del movimiento" className={className} draggable={false} />;
  return (
    <svg width={size} height={size} viewBox={frameOf(sc, animate || ghost)} className={className} role="img" aria-label="Ilustración del movimiento" style={{ overflow: 'hidden' }}>
      {drawScene(sc, ex, moving ? t : 1, !moving && !sc.still && (ghost || animate))}
    </svg>
  );
});
