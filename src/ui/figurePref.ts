// Qué figura muestra el mapa muscular. Por defecto sigue al sexo del perfil; se puede fijar a mano en este dispositivo.
import { useSyncExternalStore } from 'react';
import type { Profile } from '../domain/types';

export type FigureChoice = 'auto' | 'male' | 'female';
const KEY = 'ii_figure';
const listeners = new Set<() => void>();

export function getFigureChoice(): FigureChoice {
  try { const v = localStorage.getItem(KEY); return v === 'male' || v === 'female' ? v : 'auto'; } catch { return 'auto'; }
}
export function setFigureChoice(v: FigureChoice) {
  try { if (v === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch { /* sin almacenamiento: vale solo para esta visita */ }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useFigureChoice = () => useSyncExternalStore(subscribe, getFigureChoice, getFigureChoice);

/** Figura efectiva: la elegida a mano o, en automático, femenina solo si el perfil indica «Mujer». */
export const figureFor = (choice: FigureChoice, sex: Profile['sex']): 'male' | 'female' => (choice !== 'auto' ? choice : sex === 'f' ? 'female' : 'male');

/**
 * Aspecto de la figura que hace los ejercicios: el modelo anatómico (músculo por músculo, sin piel) o el atleta con
 * piel, pantalón corto y zapatillas. El atleta está en prueba: se elige a mano y se guarda en este dispositivo.
 */
export type FigureLook = 'anatomia' | 'piel';
const LOOK_KEY = 'ii_look';
export function getFigureLook(): FigureLook {
  try { return localStorage.getItem(LOOK_KEY) === 'piel' ? 'piel' : 'anatomia'; } catch { return 'anatomia'; }
}
export function setFigureLook(v: FigureLook) {
  try { if (v === 'anatomia') localStorage.removeItem(LOOK_KEY); else localStorage.setItem(LOOK_KEY, v); } catch { /* sin almacenamiento: vale solo para esta visita */ }
  listeners.forEach((l) => l());
}
export const useFigureLook = () => useSyncExternalStore(subscribe, getFigureLook, getFigureLook);
