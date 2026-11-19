// Modelo anatómico 3D (carga diferida). Una malla por grupo muscular, coloreada desde fuera.
// Modelo: Z-Anatomy (CC BY-SA 4.0), adaptado por hpfrei/body-anatomy-3d-viewer y reagrupado para esta app.
import { useEffect, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping, Box3, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { loadFigure, type Figure } from './bodyModel';
import { COLD } from '../domain/heat';
import { MUSCLES } from '../domain/muscles';
import type { Muscle } from '../domain/types';
import type { BodyProps } from './BodyMap';

const isMuscle = (n: string): n is Muscle => (MUSCLES as string[]).includes(n);
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface Body3DProps extends BodyProps { onReady?: () => void; onError?: () => void; view?: 'front' | 'back'; figure?: Figure }

export default function Body3D({ tones, selected, onSelect, className, onReady, onError, view = 'front', figure = 'male' }: Body3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setTones(t: BodyProps['tones'], sel: Muscle | null | undefined): void; face(v: 'front' | 'back'): void } | null>(null);
  const cb = useRef({ onSelect, onReady, onError });
  cb.current = { onSelect, onReady, onError };
  const initial = useRef({ tones, selected, view });
  initial.current = { tones, selected, view };
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setFailed(true); cb.current.onError?.(); return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // suficiente nitidez sin castigar la batería
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    const canvas = renderer.domElement;
    canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab;outline:none';
    el.appendChild(canvas);

    const scene = new Scene();
    const camera = new PerspectiveCamera(26, 1, 0.1, 50);
    // Luz de taller: cenital fría, principal cálida desde delante y un contraluz azul que recorta el volumen.
    scene.add(new HemisphereLight(0xe6ecf5, 0x20242a, 1.35));
    // La principal entra alta y de costado: las sombras bajo cada vientre muscular son las que dan el relieve.
    const key = new DirectionalLight(0xfff1df, 3.3); key.position.set(2.6, 4.2, 3.2); scene.add(key);
    const rim = new DirectionalLight(0x6fb0ff, 2.4); rim.position.set(-3, 2, -4); scene.add(rim);
    const fill = new DirectionalLight(0xffffff, 0.7); fill.position.set(-3, 0.5, 3); scene.add(fill);

    const pivot = new Group();
    scene.add(pivot);
    const mats = new Map<string, { mat: MeshStandardMaterial; color: Color; glow: number }>();
    const base = { yaw: 0, pitch: 0 };
    let yaw = 0, pitch = 0.04, vel = 0, targetYaw: number | null = null;
    let raf = 0, disposed = false, dirty = true, ready = false;
    const size = new Vector3();

    const fit = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const vHalf = Math.tan((camera.fov * Math.PI) / 360);
      const dist = Math.max((size.y * 0.53) / vHalf, (size.x * 0.56) / (vHalf * camera.aspect));
      camera.position.set(0, 0, dist || 5);
      camera.updateProjectionMatrix();
      dirty = true;
    };

    const frame = () => {
      raf = 0;
      if (disposed) return;
      let moving = false;
      if (targetYaw != null) {
        const d = targetYaw - yaw;
        if (Math.abs(d) < 0.002) { yaw = targetYaw; targetYaw = null; } else { yaw += d * 0.085; moving = true; }
      } else if (Math.abs(vel) > 0.0004) { yaw += vel; vel *= 0.93; moving = true; }
      for (const m of mats.values()) {
        if (!m.mat.color.equals(m.color) || Math.abs(m.mat.emissiveIntensity - m.glow) > 0.004) {
          m.mat.color.lerp(m.color, 0.14); m.mat.emissive.copy(m.mat.color);
          m.mat.emissiveIntensity += (m.glow - m.mat.emissiveIntensity) * 0.14;
          if (Math.abs(m.mat.color.r - m.color.r) + Math.abs(m.mat.color.g - m.color.g) + Math.abs(m.mat.color.b - m.color.b) < 0.006) { m.mat.color.copy(m.color); m.mat.emissive.copy(m.color); m.mat.emissiveIntensity = m.glow; }
          moving = true;
        }
      }
      pivot.rotation.set(base.pitch + pitch, base.yaw + yaw, 0);
      renderer.render(scene, camera);
      dirty = false;
      if (moving) request();
    };
    const request = () => { if (!raf && !disposed) raf = requestAnimationFrame(frame); };

    const white = new Color(0xffffff); const next = new Color();
    const applyTones = (t: BodyProps['tones'], sel: Muscle | null | undefined, instant = false) => {
      let changed = false;
      for (const g of MUSCLES) {
        const m = mats.get(g); if (!m) continue;
        const tone = t[g] ?? COLD;
        next.set(tone.color);
        if (sel === g) next.lerp(white, 0.3);
        const glow = tone.glow * 0.32 + (sel === g ? 0.22 : 0);
        // Solo se vuelve a dibujar si el color realmente cambió (la app recalcula los tonos con cada guardado).
        if (!next.equals(m.color) || glow !== m.glow) { m.color.copy(next); m.glow = glow; changed = true; }
        if (instant) { m.mat.color.copy(m.color); m.mat.emissive.copy(m.color); m.mat.emissiveIntensity = m.glow; }
      }
      if (changed || instant) request();
    };

    loadFigure(figure).then((src) => {
      if (disposed) return;
      const model = src.clone(true);
      model.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        const name = o.name || o.parent?.name || '';
        const muscle = isMuscle(name);
        const mat = new MeshStandardMaterial({
          color: muscle ? COLD.color : name === 'bone' ? '#4a505a' : '#3a3f47',
          roughness: muscle ? 0.46 : 0.62, metalness: muscle ? 0.32 : 0.45,
          emissive: 0x000000, emissiveIntensity: 0,
          // Los grupos de la app ganan la disputa de profundidad contra las capas internas que asoman debajo.
          polygonOffset: true, polygonOffsetFactor: muscle ? -3 : 2, polygonOffsetUnits: muscle ? -3 : 2,
        });
        o.material = mat;
        o.userData.group = name;
        if (muscle) mats.set(name, { mat, color: new Color(COLD.color), glow: 0 });
      });
      const box = new Box3().setFromObject(model);
      const center = box.getCenter(new Vector3());
      box.getSize(size);
      model.position.sub(center);
      pivot.add(model);
      fit();
      applyTones(initial.current.tones, initial.current.selected, reducedMotion());
      base.yaw = initial.current.view === 'back' ? Math.PI : 0;
      // Único momento animado: la figura gira hasta su posición mientras "se calienta".
      if (reducedMotion()) yaw = -0.42; else { yaw = -1.5; targetYaw = -0.42; }
      ready = true;
      request();
      cb.current.onReady?.();
    }).catch(() => { if (!disposed) { setFailed(true); cb.current.onError?.(); } });

    // ---- Interacción: arrastrar para girar, tocar para elegir un músculo ----
    const ray = new Raycaster(); const ndc = new Vector2();
    let drag: { x: number; y: number; t: number; moved: number; last: number } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, last: e.clientX }; vel = 0; targetYaw = null; canvas.style.cursor = 'grabbing'; };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.last; drag.last = e.clientX; drag.moved += Math.abs(dx);
      if (drag.moved > 4) { try { canvas.setPointerCapture(e.pointerId); } catch { /* puntero ya liberado */ } }
      yaw += dx * 0.011; vel = dx * 0.011; request();
    };
    const up = (e: PointerEvent) => {
      const d = drag; drag = null; canvas.style.cursor = 'grab';
      if (!d || !ready) return;
      if (d.moved < 6 && Math.abs(e.clientY - d.y) < 6 && performance.now() - d.t < 450 && cb.current.onSelect) {
        vel = 0;
        const r = canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects(pivot.children, true).find((h) => isMuscle(h.object.userData.group));
        if (hit) cb.current.onSelect(hit.object.userData.group as Muscle);
      }
      request();
    };
    const cancel = () => { drag = null; canvas.style.cursor = 'grab'; };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
    const ro = new ResizeObserver(() => { fit(); request(); });
    ro.observe(el);
    const lost = (e: Event) => { e.preventDefault(); setFailed(true); cb.current.onError?.(); };
    canvas.addEventListener('webglcontextlost', lost);

    api.current = {
      setTones: (t, sel) => applyTones(t, sel),
      face: (v) => { const goal = (v === 'back' ? Math.PI : 0) - 0.42 - base.yaw; const turns = Math.round((yaw - goal) / (2 * Math.PI)); targetYaw = goal + turns * 2 * Math.PI; vel = 0; request(); },
    };
    void dirty;

    return () => {
      disposed = true; api.current = null;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('webglcontextlost', lost);
      pivot.traverse((o) => { if (o instanceof Mesh) (o.material as MeshStandardMaterial).dispose(); });
      renderer.dispose();
      canvas.remove();
    };
  }, [figure]);

  useEffect(() => { api.current?.setTones(tones, selected); }, [tones, selected]);
  useEffect(() => { api.current?.face(view); }, [view]);

  if (failed) return null;
  return <div ref={host} className={className} role="img" aria-label="Modelo anatómico 3D: arrastra para girar" />;
}
