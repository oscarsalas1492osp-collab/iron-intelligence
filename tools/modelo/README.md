# Conversión del modelo anatómico

```bash
npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer draco3dgltf
git clone --depth 1 https://github.com/hpfrei/body-anatomy-3d-viewer
node tools/modelo/build.mjs body-anatomy-3d-viewer/public/body.glb public/models/musculos.glb 1 0.00001
```
El tercer argumento es la proporción de triángulos que se conserva (1 = sin simplificar).
