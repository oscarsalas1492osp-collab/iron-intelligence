# Fundamento científico

Cada regla se marca como **evidencia** o **estimación práctica**. La app trabaja con lo que el usuario registra: no mide el estímulo muscular real.

## Proximidad al fallo e hipertrofia
*evidencia*

**Hallazgo.** En las metarregresiones disponibles, la hipertrofia tiende a ser mayor cuanto más cerca del fallo terminan las series, mientras que las ganancias de fuerza son similares en un rango amplio de RIR. Los propios autores advierten que la relación exacta es incierta porque el RIR fue estimado.

**En la app.** Objetivos de RIR por defecto de 0–2 (aislamiento) y 1–2 (multiarticulares). La app nunca exige fallo.

Fuentes: [Robinson et al., Sports Med 2024](https://doi.org/10.1007/s40279-024-02069-2)

## Entrenar al fallo frente a no llegar
*evidencia*

**Hallazgo.** No hay evidencia de que llegar al fallo muscular momentáneo sea superior a no llegar para la hipertrofia; la ventaja observada es trivial y depende de cómo se define “fallo”. La relación parece no lineal.

**En la app.** Una serie no se considera “mejor” por llegar a RIR 0. El fallo frecuente solo se señala si coincide con caída de rendimiento.

Fuentes: [Refalo et al., Sports Med 2023](https://pubmed.ncbi.nlm.nih.gov/36334240/)

## Precisión del RIR
*evidencia*

**Hallazgo.** Las personas subestiman en promedio cerca de 1 repetición lo que les queda. La estimación mejora cerca del fallo, con cargas más pesadas y en series posteriores, y empeora con series de más de 12 repeticiones. La experiencia no elimina el error.

**En la app.** El RIR se trata como estimación: la confianza de cada recomendación baja si falta RIR, si las series son largas o si se termina lejos del fallo.

Fuentes: [Halperin et al., Sports Med 2022](https://pubmed.ncbi.nlm.nih.gov/34542869/)

## Volumen semanal y series indirectas
*evidencia*

**Hallazgo.** Más series semanales se asocian con más hipertrofia, con rendimientos decrecientes. Contar las series indirectas como media serie (método “fraccional”) fue el conteo que mejor ajustó los datos.

**En la app.** Coeficiente por defecto 0,5 para músculos secundarios, configurable. Es una convención de conteo, no una equivalencia exacta. La app no recomienda subir volumen de forma automática.

Fuentes: [Pelland et al., SportRxiv (metarregresión)](https://sportrxiv.org/index.php/server/preprint/view/460)

## Carga y rango de repeticiones
*evidencia*

**Hallazgo.** Con series llevadas cerca del fallo, la hipertrofia es similar con cargas bajas, moderadas y altas; la fuerza máxima mejora más con cargas moderadas y altas.

**En la app.** Los rangos de repeticiones son libres por ejercicio. La doble progresión funciona igual en 6–10 que en 12–20.

Fuentes: [Lopez et al., Med Sci Sports Exerc 2021](https://pubmed.ncbi.nlm.nih.gov/33433148/)

## Descanso entre series
*evidencia*

**Hallazgo.** Descansar más de 60 s muestra un pequeño beneficio para la hipertrofia; por encima de 90 s no se detectan diferencias apreciables.

**En la app.** Descansos por defecto de 120 s (multiarticulares) y 90 s (aislamiento), editables. Ante caídas fuertes de repeticiones se sugiere descansar más.

Fuentes: [Singer et al., Front Sports Act Living 2024](https://pubmed.ncbi.nlm.nih.gov/39205815/)

## Descargas (deload)
*estimación práctica*

**Hallazgo.** La descarga se define por consenso de entrenadores como un periodo de menor estrés de entrenamiento para mitigar la fatiga. La investigación experimental es escasa: un ensayo no encontró ventaja de una semana de descarga para el tamaño muscular.

**En la app.** La app solo sugiere reducir carga cuando coinciden caída de rendimiento y señales de fatiga. El −10 % y los 3–4 RIR son estimaciones prácticas. No diagnostica sobreentrenamiento.

Fuentes: [Bell et al., Sports Med Open 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/) · [Coleman et al., PeerJ 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10809978/)

## Umbrales del motor de progresión
*estimación práctica*

**Hallazgo.** No existe un estudio que fije cuándo subir carga, cuánto es un salto “demasiado grande” o qué caída entre series es excesiva.

**En la app.** Subir al completar el tope del rango con el RIR objetivo; tratar como grande un salto mayor al 10 %; avisar si las repeticiones caen más de 35 % entre series; “estancado” = 3 sesiones sin sumar repeticiones. Son criterios de entrenamiento habituales, no resultados científicos.

## 1RM estimado y puntaje de recuperación
*estimación práctica*

**Hallazgo.** Las fórmulas de 1RM (aquí Epley con repeticiones + RIR) pierden precisión con muchas repeticiones. Los cuestionarios de bienestar son subjetivos.

**En la app.** El 1RM se muestra siempre como estimación y no se calcula por encima de 15 repeticiones hasta el fallo. El puntaje de recuperación es una ponderación propia de lo que declaras, solo como contexto.

## Técnicas avanzadas: dropset, descanso-pausa, myo-reps y cluster
*evidencia*

**Hallazgo.** Dos metaanálisis de dropsets (Sødal et al. 2023; Coleman et al. 2022) no encontraron diferencias de hipertrofia frente a las series tradicionales; en los estudios que midieron la duración, las sesiones con dropsets tomaron entre la mitad y un tercio del tiempo. Un metaanálisis de 2026 sobre sistemas avanzados (Tsartsapakis et al.) concluye que dropsets y clusters rinden parecido a las series tradicionales cuando se igualan volumen y esfuerzo, y atribuye al descanso-pausa una ventaja pequeña. Los clusters atenúan la pérdida de velocidad dentro de la serie (Latella et al. 2019) y, con series y esfuerzo igualados, dieron hipertrofia similar (Vargas-Molina et al. 2025). Las myo-reps son una variante del descanso-pausa sin estudios propios.

**En la app.** En cada serie, el botón «Técnica» añade un tramo: la bajada de un dropset parte con un 20 % menos de carga, redondeada al paso de la máquina; el descanso-pausa, las myo-reps y el cluster mantienen la carga e inician una pausa corta (15–20 s). Los tramos suman tonelaje y aparecen en el historial bajo su serie, pero cuentan como parte de esa misma serie en el volumen semanal y no entran en la recomendación de carga. Esa forma de contar es una convención práctica, no un valor medido.

## Biseries y triseries
*evidencia*

**Hallazgo.** Un metaanálisis de 19 estudios (Zhang et al., Sports Medicine 2025) encontró que las biseries permiten un número de repeticiones y un volumen similares a las series tradicionales con sesiones más cortas, con más lactato y esfuerzo percibido, y adaptaciones a largo plazo comparables en fuerza máxima, resistencia e hipertrofia. Las biseries de músculos opuestos permitieron incluso más repeticiones.

**En la app.** Dos o tres ejercicios se unen manteniendo presionado uno y arrastrándolo sobre otro, o con el botón equivalente. Una serie es la ronda completa; dentro de la ronda no hay descanso y, al terminarla, corre el descanso más largo de los ejercicios unidos. Cada ejercicio conserva su registro, su objetivo y su recomendación.

