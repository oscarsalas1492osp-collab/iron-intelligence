// Fundamento científico resumido. Cada punto distingue lo que respalda la evidencia de lo que
// es un criterio práctico de la aplicación. Texto completo en docs/EVIDENCIA.md.
export interface EvidenceItem { topic: string; finding: string; appRule: string; kind: 'evidencia' | 'estimación práctica'; refs: { label: string; url: string }[] }

export const EVIDENCE: EvidenceItem[] = [
  {
    topic: 'Proximidad al fallo e hipertrofia',
    finding: 'En las metarregresiones disponibles, la hipertrofia tiende a ser mayor cuanto más cerca del fallo terminan las series, mientras que las ganancias de fuerza son similares en un rango amplio de RIR. Los propios autores advierten que la relación exacta es incierta porque el RIR fue estimado.',
    appRule: 'Objetivos de RIR por defecto de 0–2 (aislamiento) y 1–2 (multiarticulares). La app nunca exige fallo.',
    kind: 'evidencia',
    refs: [{ label: 'Robinson et al., Sports Med 2024', url: 'https://doi.org/10.1007/s40279-024-02069-2' }],
  },
  {
    topic: 'Entrenar al fallo frente a no llegar',
    finding: 'No hay evidencia de que llegar al fallo muscular momentáneo sea superior a no llegar para la hipertrofia; la ventaja observada es trivial y depende de cómo se define “fallo”. La relación parece no lineal.',
    appRule: 'Una serie no se considera “mejor” por llegar a RIR 0. El fallo frecuente solo se señala si coincide con caída de rendimiento.',
    kind: 'evidencia',
    refs: [{ label: 'Refalo et al., Sports Med 2023', url: 'https://pubmed.ncbi.nlm.nih.gov/36334240/' }],
  },
  {
    topic: 'Precisión del RIR',
    finding: 'Las personas subestiman en promedio cerca de 1 repetición lo que les queda. La estimación mejora cerca del fallo, con cargas más pesadas y en series posteriores, y empeora con series de más de 12 repeticiones. La experiencia no elimina el error.',
    appRule: 'El RIR se trata como estimación: la confianza de cada recomendación baja si falta RIR, si las series son largas o si se termina lejos del fallo.',
    kind: 'evidencia',
    refs: [{ label: 'Halperin et al., Sports Med 2022', url: 'https://pubmed.ncbi.nlm.nih.gov/34542869/' }],
  },
  {
    topic: 'Volumen semanal y series indirectas',
    finding: 'Más series semanales se asocian con más hipertrofia, con rendimientos decrecientes. Contar las series indirectas como media serie (método “fraccional”) fue el conteo que mejor ajustó los datos.',
    appRule: 'Coeficiente por defecto 0,5 para músculos secundarios, configurable. Es una convención de conteo, no una equivalencia exacta. La app no recomienda subir volumen de forma automática.',
    kind: 'evidencia',
    refs: [{ label: 'Pelland et al., SportRxiv (metarregresión)', url: 'https://sportrxiv.org/index.php/server/preprint/view/460' }],
  },
  {
    topic: 'Carga y rango de repeticiones',
    finding: 'Con series llevadas cerca del fallo, la hipertrofia es similar con cargas bajas, moderadas y altas; la fuerza máxima mejora más con cargas moderadas y altas.',
    appRule: 'Los rangos de repeticiones son libres por ejercicio. La doble progresión funciona igual en 6–10 que en 12–20.',
    kind: 'evidencia',
    refs: [{ label: 'Lopez et al., Med Sci Sports Exerc 2021', url: 'https://pubmed.ncbi.nlm.nih.gov/33433148/' }],
  },
  {
    topic: 'Descanso entre series',
    finding: 'Descansar más de 60 s muestra un pequeño beneficio para la hipertrofia; por encima de 90 s no se detectan diferencias apreciables.',
    appRule: 'Descansos por defecto de 120 s (multiarticulares) y 90 s (aislamiento), editables. Ante caídas fuertes de repeticiones se sugiere descansar más.',
    kind: 'evidencia',
    refs: [{ label: 'Singer et al., Front Sports Act Living 2024', url: 'https://pubmed.ncbi.nlm.nih.gov/39205815/' }],
  },
  {
    topic: 'Descargas (deload)',
    finding: 'La descarga se define por consenso de entrenadores como un periodo de menor estrés de entrenamiento para mitigar la fatiga. La investigación experimental es escasa: un ensayo no encontró ventaja de una semana de descarga para el tamaño muscular.',
    appRule: 'La app solo sugiere reducir carga cuando coinciden caída de rendimiento y señales de fatiga. El −10 % y los 3–4 RIR son estimaciones prácticas. No diagnostica sobreentrenamiento.',
    kind: 'estimación práctica',
    refs: [
      { label: 'Bell et al., Sports Med Open 2023', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/' },
      { label: 'Coleman et al., PeerJ 2024', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10809978/' },
    ],
  },
  {
    topic: 'Umbrales del motor de progresión',
    finding: 'No existe un estudio que fije cuándo subir carga, cuánto es un salto “demasiado grande” o qué caída entre series es excesiva.',
    appRule: 'Subir al completar el tope del rango con el RIR objetivo; tratar como grande un salto mayor al 10 %; avisar si las repeticiones caen más de 35 % entre series; “estancado” = 3 sesiones sin sumar repeticiones. Son criterios de entrenamiento habituales, no resultados científicos.',
    kind: 'estimación práctica',
    refs: [],
  },
  {
    topic: '1RM estimado y puntaje de recuperación',
    finding: 'Las fórmulas de 1RM (aquí Epley con repeticiones + RIR) pierden precisión con muchas repeticiones. Los cuestionarios de bienestar son subjetivos.',
    appRule: 'El 1RM se muestra siempre como estimación y no se calcula por encima de 15 repeticiones hasta el fallo. El puntaje de recuperación es una ponderación propia de lo que declaras, solo como contexto.',
    kind: 'estimación práctica',
    refs: [],
  },
];
