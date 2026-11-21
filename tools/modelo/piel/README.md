# Piel del modelo anatómico

`public/models/piel.glb` es una piel continua construida sobre `musculos.glb`: la figura «Atleta» de los ejercicios.
Se genera en cuatro pasos (Python con numpy, scipy, scikit-image, fast-simplification y playwright; Node con
gltf-transform):

```bash
npx vite --port 5199 --strictPort &                       # sirve lab/dump.html
python3 tools/modelo/piel/volcar.py                       # modelo sin deformar + pesos de hueso → $PIEL_TMP
python3 tools/modelo/piel/piel.py neutral 0.0025 64000 0.004
python3 tools/modelo/piel/atributos.py neutral public/models/piel.glb
node tools/modelo/piel/comprimir.mjs public/models/piel.glb
```

- `piel.py` voxeliza los músculos (2,5 mm), cierra los surcos entre ellos, rellena el interior y extrae la superficie
  por partes (tronco, cabeza, brazos, piernas). Las partes se solapan y quedan cerradas, así al doblar una
  articulación no aparecen membranas ni huecos. También calcula la sombra propia de cada vértice.
- `atributos.py` da a cada vértice sus pesos de hueso (los mismos del modelo anatómico, promediados) y el mapa de
  músculos: los dos grupos más cercanos, la mezcla entre ambos y cuánto se apaga con la distancia.
- La piel se hace sobre el modelo sin deformar; cada figura (masculina o femenina) la lleva a sus proporciones al
  cargarla, con la misma función que usan los músculos (`reshape` en `src/ui/bodyModel.ts`).

Antes de todo esto, `tools/modelo/orientar.mjs` corrige el sentido de los triángulos de `musculos.glb` (ya aplicado).

Pendiente: manos (hoy son un guante liso), cara, y la unión del hombro con los brazos arriba o al frente.
