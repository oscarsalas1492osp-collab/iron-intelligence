import { LIBRARY, patternOf } from '../src/domain/exerciseLibrary';
import { sceneFor } from '../src/ui/figure/scenes';
import { Figure3D, prepare, setLook } from '../src/ui/figure/render3d';
setLook('piel');
(window as any).ids = () => LIBRARY.map((e) => [e.id, e.name, e.primary, e.equipment]);
(window as any).shot = async (id: string, t: number, px: number, figure: 'male' | 'female' = 'male', cam: any = {}) => {
  await prepare(figure);
  const ex = LIBRARY.find((e) => e.id === id)!;
  const f = new Figure3D(ex, sceneFor(ex, patternOf(ex.id)), true, figure);
  return f.draw(t, px, cam).toDataURL('image/png');
};
(window as any).ready = true;
