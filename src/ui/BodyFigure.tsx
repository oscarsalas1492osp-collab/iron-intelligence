// Figura corporal: muestra el mapa 2D de inmediato y lo reemplaza por el modelo 3D cuando está listo.
// Si el 3D no puede cargarse (sin WebGL, sin conexión en la primera apertura), se queda en 2D.
// La figura 3D es masculina o femenina según el perfil; el mapa 2D de respaldo es único.
import { lazy, Suspense, useState } from 'react';
import type { Muscle } from '../domain/types';
import { BodyMap, type BodyProps } from './BodyMap';
import { Btn, cx } from './components';
import { useProfile } from '../hooks';
import { figureFor, useFigureChoice } from './figurePref';

const Body3D = lazy(() => import('./Body3D'));

const canWebGL = (() => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
})();

export function BodyFigure({ tones, selected, onSelect, className, controls = true }: BodyProps & { controls?: boolean }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(canWebGL ? 'loading' : 'failed');
  const [view, setView] = useState<'front' | 'back'>('front');
  const figure = figureFor(useFigureChoice(), useProfile().sex);
  const flat = <BodyMap tones={tones} selected={selected} onSelect={onSelect as ((m: Muscle) => void) | undefined} className="mx-auto h-full max-h-full" />;
  return (
    <div className={className ?? 'relative'}>
      {state !== 'ready' && <div className="absolute inset-0 grid place-items-center p-2">{flat}</div>}
      {state !== 'failed' && (
        <Suspense fallback={null}>
          <Body3D tones={tones} selected={selected} onSelect={onSelect} view={view} figure={figure} onReady={() => setState('ready')} onError={() => setState('failed')}
            className={cx('absolute inset-0 transition-opacity duration-500', state === 'ready' ? 'opacity-100' : 'opacity-0')} />
        </Suspense>
      )}
      {controls && state === 'ready' && (
        <Btn size="sm" icon="rotate" className="absolute bottom-2 right-2 !bg-ink/70 backdrop-blur" aria-label={view === 'front' ? 'Ver espalda' : 'Ver frente'} onClick={() => setView(view === 'front' ? 'back' : 'front')}>
          {view === 'front' ? 'Espalda' : 'Frente'}
        </Btn>
      )}
    </div>
  );
}
