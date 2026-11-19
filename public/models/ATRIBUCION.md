# musculos.glb

Modelo anatómico 3D usado por Iron Intelligence.

- **Origen:** Z-Anatomy (https://www.z-anatomy.com/), en la versión optimizada para navegador de
  hpfrei/body-anatomy-3d-viewer (https://github.com/hpfrei/body-anatomy-3d-viewer), archivo `public/body.glb`.
- **Licencia:** Creative Commons Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0),
  https://creativecommons.org/licenses/by-sa/4.0/
- **Cambios realizados:** se eliminaron metadatos y estructuras internas (bolsas sinoviales, músculos profundos de
  cabeza, cuello y pelvis), se unieron las mallas en 11 grupos musculares más una malla base y otra de esqueleto,
  y se recomprimió la geometría con Meshopt. No se modificó la forma anatómica.
- **Este archivo derivado se distribuye bajo la misma licencia CC BY-SA 4.0.**

El guion de conversión está en `tools/modelo/build.mjs`.
