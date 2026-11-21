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

- `piel.py` voxeliza los músculos (2,5 mm), cierra los surcos entre ellos y rellena el interior. Cada parte (tronco
  con cuello y cabeza, brazos, piernas) se cierra por separado, junto con un margen de su vecina, y luego se unen en
  una sola superficie. Donde dos partes solo se rozan en reposo (mano y muslo, un muslo con el otro, el hueco de la
  axila) se abre un surco de un centímetro para que al moverse no se estire una membrana. También calcula la sombra
  propia de cada vértice.
- `atributos.py` da a cada vértice sus pesos de hueso (los del modelo anatómico, promediados y suavizados sobre la
  malla), el mapa de músculos (los dos grupos más cercanos, la mezcla entre ambos y cuánto se apaga con la distancia)
  y tres juegos de huesos que solo usa la piel: dedos que empuñan (14 a 17) y un brazo sin giro por lado (18 y 19)
  para que la rotación del brazo no retuerza el pecho.
- La piel se hace sobre el modelo sin deformar; cada figura (masculina o femenina) la lleva a sus proporciones al
  cargarla, con la misma función que usan los músculos (`reshape` en `src/ui/bodyModel.ts`).
- Variables de entorno: `PIEL_TMP` (carpeta de trabajo), `PIEL_MANO` (cierre de la mano, m), `PIEL_SUAVE`
  (pasadas de suavizado de pesos), `PIEL_FRANJA` (franja de reparto tronco-extremidad).

Antes de todo esto, `tools/modelo/orientar.mjs` corrige el sentido de los triángulos de `musculos.glb` (ya aplicado).

Pendiente: la cara es de maniquí, sin rasgos; el pulgar se cierra junto con los demás dedos; con el brazo muy atrás
queda un pliegue pequeño delante de la axila.
