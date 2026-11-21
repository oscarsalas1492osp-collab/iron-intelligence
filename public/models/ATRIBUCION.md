# musculos.glb

Modelo anatómico 3D usado por Iron Intelligence.

- **Origen:** Z-Anatomy (https://www.z-anatomy.com/), en la versión optimizada para navegador de
  hpfrei/body-anatomy-3d-viewer (https://github.com/hpfrei/body-anatomy-3d-viewer), archivo `public/body.glb`.
- **Licencia:** Creative Commons Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0),
  https://creativecommons.org/licenses/by-sa/4.0/
- **Cambios realizados en el archivo:** se eliminaron metadatos y estructuras internas (bolsas sinoviales, músculos
  profundos de cabeza, cuello y pelvis), se unieron las mallas en 18 grupos musculares más una malla base y otra de
  esqueleto, y se recomprimió la geometría con Meshopt. La forma anatómica del archivo no se modificó.
- **Corrección posterior** (`tools/modelo/orientar.mjs`): la mitad reflejada del modelo traía los triángulos enrollados al
  revés; se les dio la vuelta para que todas las caras miren hacia fuera. No se movió ningún vértice.
- **Cambios que la app aplica al mostrarlo** (`src/ui/bodyModel.ts`): cada grupo muscular se engrosa unos milímetros
  para darle relieve y toda la malla se deforma hacia las proporciones de la figura elegida. La figura femenina es una
  adaptación de proporciones de esta misma anatomía (hombros y tórax más estrechos, cintura, cadera, busto), no un
  modelo anatómico femenino independiente.
- **Este archivo derivado se distribuye bajo la misma licencia CC BY-SA 4.0.**

El guion de conversión está en `tools/modelo/build.mjs`.

El mismo modelo, articulado por sus articulaciones, se usa también en las figuras de ejercicio (`src/ui/figure/render3d.ts`).

# piel.glb

Piel continua para la figura «Atleta» de los ejercicios. Es una obra derivada del mismo modelo: se obtiene envolviendo
los músculos y huesos de `musculos.glb` (voxelización, cierre de surcos y extracción de superficie), y lleva por vértice
los pesos de articulación, el grupo muscular que cubre y una sombra propia. No es un cuerpo escaneado ni una fotografía.

- **Origen y licencia:** los de `musculos.glb` (Z-Anatomy, CC BY-SA 4.0). **Este archivo derivado se distribuye bajo la
  misma licencia CC BY-SA 4.0.**
- El guion está en `tools/modelo/piel/`.
