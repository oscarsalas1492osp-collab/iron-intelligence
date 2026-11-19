// Biblioteca de ejercicios. Los ids son estables: el historial los referencia.
// BASE reúne los ejercicios escritos a mano; el catálogo ampliado (catalog/) hereda sus indicaciones del patrón de movimiento.
// El usuario puede ajustar cualquiera (incremento, máquina, foto) o crear los suyos.
import { CATALOG, type CatalogRow } from './catalog/exercises';
import { MACHINES } from './catalog/machines';
import { PATTERNS, type Pattern, type PatternId } from './catalog/patterns';
import type { Category, Equipment, ExerciseDef, ExerciseRow, ExType, Measure, Muscle } from './types';

const SAFETY: Record<Equipment, string> = {
  machine: 'Ajusta asiento y topes antes de cargar. Si aparece dolor articular (no la fatiga muscular normal), detén la serie.',
  cable: 'Comprueba el pasador y el agarre antes de empezar. Controla el retorno: no dejes caer las placas.',
  dumbbell: 'Usa una carga que puedas llevar a la posición inicial con control. No sueltes las mancuernas sobre el cuerpo.',
  barbell: 'Usa seguros y, en cargas altas, soportes de seguridad o un asistente. No lleves al fallo sin protección.',
  smith: 'Fija los topes de seguridad a la altura adecuada y practica el giro de bloqueo antes de cargar.',
  bodyweight: 'Calienta hombros y codos. Si no controlas la bajada, usa asistencia o reduce el rango.',
  lever: 'Carga los discos de forma simétrica y asegura el asiento. Evita bloquear la articulación con violencia.',
  convergent: 'Ajusta el asiento para que las empuñaduras queden alineadas con la articulación objetivo.',
  isolation_machine: 'Alinea el eje de la máquina con tu articulación. Evita impulsos: el objetivo es tensión controlada.',
  ez_bar: 'Coloca seguros en ambos lados. Si baja hacia la cara o la cabeza, usa una carga que controles en todo el recorrido.',
  trap_bar: 'Párate centrado dentro de la barra y carga ambos lados por igual. Apoya la barra en el suelo con control.',
  landmine: 'Comprueba que el extremo de la barra esté bien encajado en el anclaje y despeja el arco por donde se mueve.',
  kettlebell: 'Deja espacio libre delante y detrás. Si pierdes el control, suelta la pesa lejos del cuerpo en vez de forzar la muñeca o la espalda.',
  plate: 'Sujeta el disco con ambas manos por el borde y no lo dejes caer sobre los pies.',
  band: 'Revisa que la banda no tenga cortes y que el anclaje sea firme. No la estires hacia la cara.',
  suspension: 'Comprueba el anclaje antes de cargar tu peso. Mientras más inclinado el cuerpo, más difícil: avanza de a poco.',
  medball: 'Usa un balón que no rebote para los azotes y deja espacio libre alrededor. Recoge el balón flexionando piernas, no la espalda.',
  sled: 'Usa un carril despejado y calzado con agarre. Aumenta la carga de a poco: el esfuerzo sube rápido.',
  other: 'Revisa el estado del implemento y el espacio disponible antes de empezar. Empieza con una versión fácil y progresa.',
};

const EXEC: Record<ExType, string> = {
  compound: 'Fase excéntrica controlada (2–3 s), sin rebote en el punto bajo, y fase concéntrica decidida manteniendo la técnica.',
  isolation: 'Movimiento controlado en todo el recorrido, sin impulso del tronco; breve pausa en el punto de máxima contracción o estiramiento.',
};
const EXEC_TIME = 'Mantén la posición o el trabajo continuo durante el tiempo marcado. En cada serie se anotan segundos en lugar de repeticiones.';
const EXEC_DISTANCE = 'Recorre la distancia a ritmo constante. En cada serie se anotan metros en lugar de repeticiones.';
const EXEC_POWER = 'Cada repetición a máxima velocidad y con técnica limpia. Termina la serie cuando la velocidad cae: aquí no se busca llegar cerca del fallo.';

function execOf(type: ExType, measure: Measure, category: Category): string {
  if (measure === 'time') return EXEC_TIME;
  if (measure === 'distance') return EXEC_DISTANCE;
  if (category === 'power') return EXEC_POWER;
  return EXEC[type];
}

function x(
  id: string, name: string, primary: Muscle, secondary: Muscle[], type: ExType, equipment: Equipment, increment: number,
  cues: string[], mistakes: string[], rom: string, machine = '',
): ExerciseDef {
  return { id, name, primary, secondary, type, equipment, machine, focus: '', aka: '', measure: 'reps', category: 'strength', cues, mistakes, rom, execution: EXEC[type], safety: SAFETY[equipment], increment, photo: null, custom: false };
}

/** Incremento mínimo habitual de cada implemento; el usuario puede ajustarlo por ejercicio. */
function defaultIncrement(eq: Equipment, type: ExType): number {
  switch (eq) {
    case 'machine': case 'convergent': case 'lever': case 'isolation_machine': case 'trap_bar': case 'sled': return 5;
    case 'cable': return type === 'compound' ? 5 : 2.5;
    case 'smith': case 'barbell': case 'ez_bar': case 'landmine': case 'plate': case 'bodyweight': return 2.5;
    case 'dumbbell': return type === 'compound' ? 2 : 1;
    case 'kettlebell': return 4;
    default: return 1;
  }
}

const MACHINE_OF = new Map<string, string>();
for (const mc of MACHINES) for (const id of mc.ex) if (!MACHINE_OF.has(id)) MACHINE_OF.set(id, mc.name);

function fromCatalog(r: CatalogRow): ExerciseDef {
  const pt: Pattern = PATTERNS[r.pattern];
  const type = r.x.t ?? pt.type;
  const measure = r.x.m ?? pt.measure ?? 'reps';
  const category = r.x.c ?? pt.category ?? 'strength';
  return {
    id: r.id, name: r.name, primary: r.primary, secondary: r.secondary, type, equipment: r.equipment,
    machine: MACHINE_OF.get(r.id) ?? '', focus: r.x.f ?? '', aka: r.x.a ?? '', measure, category,
    cues: pt.cues, mistakes: pt.mistakes, rom: pt.rom, execution: execOf(type, measure, category), safety: SAFETY[r.equipment],
    increment: r.x.i ?? defaultIncrement(r.equipment, type), photo: null, custom: false,
  };
}

// Ajustes sobre la base al ampliar los grupos musculares (trapecio, lumbares, aductores, abductores…) y añadir énfasis y otros nombres.
const PATCH: Record<string, Partial<ExerciseDef>> = {
  bench_press: { aka: 'bench press' }, incline_bench_press: { focus: 'Pectoral superior', aka: 'incline bench press' },
  incline_db_press: { focus: 'Pectoral superior' }, smith_incline_press: { focus: 'Pectoral superior' },
  pec_deck: { aka: 'butterfly pec fly contractora' }, cable_crossover: { aka: 'cable crossover' },
  push_up: { category: 'calisthenics', aka: 'push up lagartijas' }, dips: { category: 'calisthenics', aka: 'dips' },
  lat_pulldown: { aka: 'lat pulldown' }, pull_up: { category: 'calisthenics', aka: 'pull up' },
  seated_cable_row: { secondary: ['biceps', 'traps', 'forearms'], aka: 'seated cable row' }, machine_row: { secondary: ['biceps', 'traps', 'forearms'] },
  lever_row: { secondary: ['biceps', 'traps', 'forearms'], aka: 'iso-lateral row hammer' }, db_row: { secondary: ['biceps', 'traps', 'forearms'] },
  barbell_row: { secondary: ['biceps', 'traps', 'lowerback', 'forearms'], aka: 'bent over row' },
  straight_arm_pulldown: { aka: 'straight arm pulldown' },
  back_extension: { primary: 'lowerback', secondary: ['glutes', 'hamstrings'], aka: 'hiperextensiones hyperextension' },
  shoulder_press_machine: { secondary: ['triceps', 'traps'] }, db_shoulder_press: { secondary: ['triceps', 'traps'] },
  overhead_press: { secondary: ['triceps', 'traps', 'abs'], aka: 'ohp military press overhead press' },
  lateral_raise_db: { secondary: ['traps'], focus: 'Deltoides lateral', aka: 'lateral raise' },
  lateral_raise_cable: { secondary: ['traps'], focus: 'Deltoides lateral' }, lateral_raise_machine: { secondary: ['traps'], focus: 'Deltoides lateral' },
  reverse_pec_deck: { secondary: ['traps', 'back'], focus: 'Deltoides posterior', aka: 'reverse fly rear delt' },
  face_pull: { secondary: ['traps', 'back'], focus: 'Deltoides posterior', aka: 'face pull' },
  hammer_curl: { focus: 'Braquial', aka: 'hammer curl' }, preacher_curl_machine: { aka: 'preacher curl scott' },
  overhead_triceps_cable: { focus: 'Cabeza larga' }, skullcrusher: { aka: 'skull crusher rompecráneos' }, triceps_pushdown: { aka: 'pushdown' },
  squat: { secondary: ['glutes', 'adductors', 'lowerback'], aka: 'back squat' }, hack_squat: { aka: 'hack squat' },
  leg_press: { secondary: ['glutes', 'adductors'], aka: 'leg press' }, smith_squat: { secondary: ['glutes', 'adductors'] },
  bulgarian_split_squat: { secondary: ['glutes', 'adductors'], aka: 'bulgarian split squat' }, leg_extension: { aka: 'leg extension' },
  romanian_deadlift: { secondary: ['glutes', 'lowerback'], aka: 'rdl romanian deadlift' },
  seated_leg_curl: { aka: 'seated leg curl' }, lying_leg_curl: { aka: 'lying prone leg curl' },
  hip_thrust: { aka: 'hip thrust' }, glute_kickback_cable: { aka: 'cable kickback' },
  hip_abduction_machine: { primary: 'abductors', secondary: ['glutes'], aka: 'hip abduction outer thigh' },
  seated_calf_raise: { focus: 'Sóleo' }, hanging_leg_raise: { category: 'calisthenics' },
  plank: { name: 'Plancha frontal', measure: 'time', execution: EXEC_TIME, aka: 'plank' },
};

const BASE: ExerciseDef[] = [
  // ---- Pecho ----
  x('chest_press_machine', 'Press de pecho en máquina', 'chest', ['triceps', 'shoulders'], 'compound', 'machine', 5, ['Escápulas atrás y abajo contra el respaldo', 'Empuñaduras a la altura media del pecho'], ['Despegar la espalda del respaldo', 'Acortar el recorrido al subir la carga'], 'Desde un estiramiento cómodo del pecho hasta casi extender los codos.', 'Press de pecho sentado'),
  x('chest_press_convergent', 'Press convergente de pecho', 'chest', ['triceps', 'shoulders'], 'compound', 'convergent', 5, ['Deja que las manos se acerquen al final', 'Codos a unos 45–60° del torso'], ['Encoger los hombros', 'Rebotar en el punto bajo'], 'Estiramiento profundo abajo; manos convergen sin chocar arriba.', 'Press convergente'),
  x('bench_press', 'Press de banca con barra', 'chest', ['triceps', 'shoulders'], 'compound', 'barbell', 2.5, ['Pies firmes, escápulas retraídas', 'Baja la barra a la parte media-baja del pecho'], ['Rebotar la barra en el pecho', 'Levantar la cadera del banco'], 'La barra toca el pecho con control y sube hasta extender codos.'),
  x('incline_bench_press', 'Press inclinado con barra', 'chest', ['shoulders', 'triceps'], 'compound', 'barbell', 2.5, ['Banco a 30–45°', 'Barra hacia la parte alta del pecho'], ['Inclinar demasiado el banco (pasa a hombros)', 'Abrir los codos a 90°'], 'Hasta la parte alta del pecho y extensión completa.'),
  x('db_bench_press', 'Press de banca con mancuernas', 'chest', ['triceps', 'shoulders'], 'compound', 'dumbbell', 2, ['Mancuernas alineadas con el pecho', 'Baja hasta sentir estiramiento'], ['Chocar las mancuernas arriba', 'Perder la retracción escapular'], 'Estiramiento profundo abajo; arriba sin bloquear bruscamente.'),
  x('incline_db_press', 'Press inclinado con mancuernas', 'chest', ['shoulders', 'triceps'], 'compound', 'dumbbell', 2, ['Banco a 30°', 'Muñecas sobre los codos'], ['Arquear en exceso para “aplanar” el ángulo', 'Recorrido corto'], 'Estiramiento profundo del pecho superior hasta casi extender.'),
  x('smith_incline_press', 'Press inclinado en Smith', 'chest', ['shoulders', 'triceps'], 'compound', 'smith', 2.5, ['Coloca el banco para que la barra baje a la clavícula', 'Codos bajo la barra'], ['Banco mal centrado', 'Rebote abajo'], 'Barra hasta la parte alta del pecho y extensión.'),
  x('pec_deck', 'Aperturas en máquina (pec deck)', 'chest', ['shoulders'], 'isolation', 'isolation_machine', 5, ['Codos ligeramente flexionados y fijos', 'Pecho alto durante todo el recorrido'], ['Adelantar los hombros al cerrar', 'Usar inercia'], 'Desde un estiramiento amplio hasta juntar las manos al frente.', 'Pec deck / contractora'),
  x('cable_crossover', 'Cruce de poleas', 'chest', ['shoulders'], 'isolation', 'cable', 2.5, ['Un pie adelante, torso estable', 'Lleva las manos en arco hacia el centro'], ['Convertirlo en un press doblando los codos', 'Balancear el torso'], 'Brazos abiertos con estiramiento hasta cruzar levemente las manos.'),
  x('push_up', 'Flexiones de brazos', 'chest', ['triceps', 'shoulders', 'abs'], 'compound', 'bodyweight', 1, ['Cuerpo en línea de cabeza a talones', 'Manos algo más anchas que los hombros'], ['Hundir la cadera', 'Medio recorrido'], 'Pecho cerca del suelo hasta extensión de codos.'),
  x('dips', 'Fondos en paralelas', 'chest', ['triceps', 'shoulders'], 'compound', 'bodyweight', 2.5, ['Torso levemente inclinado adelante', 'Baja con control'], ['Bajar más allá de lo que toleran tus hombros', 'Encoger hombros'], 'Hombros a la altura de los codos (o lo que tolere el hombro) hasta extender.'),
  // ---- Espalda ----
  x('lat_pulldown', 'Jalón al pecho en polea', 'back', ['biceps', 'forearms'], 'compound', 'cable', 5, ['Pecho arriba, lleva los codos hacia las costillas', 'Inicia el movimiento deprimiendo las escápulas'], ['Tirarse hacia atrás con impulso', 'Llevar la barra detrás de la nuca'], 'Brazos extendidos arriba hasta la barra en la parte alta del pecho.', 'Polea alta'),
  x('pull_up', 'Dominadas', 'back', ['biceps', 'forearms'], 'compound', 'bodyweight', 2.5, ['Empieza colgado con brazos extendidos', 'Lleva el pecho hacia la barra'], ['Medio recorrido', 'Balanceo (kipping) involuntario'], 'Desde colgado completo hasta la barbilla sobre la barra.'),
  x('seated_cable_row', 'Remo sentado en polea', 'back', ['biceps', 'forearms'], 'compound', 'cable', 5, ['Torso erguido, tira con los codos', 'Deja que las escápulas se abran adelante'], ['Balancear el torso', 'Encoger los hombros'], 'Estiramiento adelante con escápulas abiertas hasta el agarre al abdomen.', 'Polea baja'),
  x('machine_row', 'Remo en máquina', 'back', ['biceps', 'forearms'], 'compound', 'machine', 5, ['Pecho apoyado en el soporte', 'Codos atrás, pegados o abiertos según el agarre'], ['Despegar el pecho del apoyo', 'Recorrido corto'], 'Brazos extendidos hasta codos detrás del torso.', 'Remo con apoyo de pecho'),
  x('lever_row', 'Remo en máquina de palanca', 'back', ['biceps', 'forearms'], 'compound', 'lever', 5, ['Pecho firme contra el apoyo', 'Pausa breve atrás'], ['Tirar con la zona lumbar', 'Soltar la carga al volver'], 'Estiramiento completo adelante hasta máxima retracción.', 'Remo de palanca (discos)'),
  x('barbell_row', 'Remo con barra', 'back', ['biceps', 'forearms', 'hamstrings'], 'compound', 'barbell', 2.5, ['Bisagra de cadera, espalda neutra', 'Barra hacia el abdomen'], ['Redondear la zona lumbar', 'Erguirse en cada repetición'], 'Brazos extendidos hasta la barra tocando el abdomen.'),
  x('db_row', 'Remo con mancuerna a una mano', 'back', ['biceps', 'forearms'], 'compound', 'dumbbell', 2, ['Apoya mano y rodilla en el banco', 'Lleva el codo hacia la cadera'], ['Rotar el torso para subir', 'Tirar solo con el brazo'], 'Brazo extendido con estiramiento hasta el codo por detrás del torso.'),
  x('straight_arm_pulldown', 'Pullover en polea (brazos rectos)', 'back', ['triceps'], 'isolation', 'cable', 2.5, ['Codos casi extendidos y fijos', 'Lleva la barra a los muslos'], ['Flexionar los codos', 'Usar el peso del cuerpo'], 'Brazos sobre la cabeza hasta la barra en los muslos.'),
  x('back_extension', 'Extensión lumbar en banco', 'back', ['glutes', 'hamstrings'], 'isolation', 'bodyweight', 2.5, ['Bisagra desde la cadera', 'Sube hasta alinear el cuerpo'], ['Hiperextender la zona lumbar', 'Subir con impulso'], 'Flexión de cadera completa hasta cuerpo alineado.'),
  // ---- Hombros ----
  x('shoulder_press_machine', 'Press de hombros en máquina', 'shoulders', ['triceps'], 'compound', 'machine', 5, ['Espalda apoyada, abdomen firme', 'Codos bajo las muñecas'], ['Arquear la espalda', 'Recorrido parcial arriba'], 'Manos a la altura de las orejas hasta casi extender.', 'Press de hombros sentado'),
  x('db_shoulder_press', 'Press de hombros con mancuernas', 'shoulders', ['triceps'], 'compound', 'dumbbell', 2, ['Banco casi vertical', 'Sube en línea, sin chocar'], ['Arqueo lumbar excesivo', 'Bajar poco'], 'Mancuernas a la altura de las orejas hasta extensión.'),
  x('overhead_press', 'Press militar con barra', 'shoulders', ['triceps', 'abs'], 'compound', 'barbell', 2.5, ['Glúteos y abdomen apretados', 'La barra sube cerca de la cara'], ['Inclinarse atrás', 'Empujar con las piernas'], 'Barra desde la clavícula hasta extensión sobre la cabeza.'),
  x('lateral_raise_db', 'Elevaciones laterales con mancuernas', 'shoulders', [], 'isolation', 'dumbbell', 1, ['Leve inclinación adelante', 'Sube con los codos, no con las manos'], ['Balanceo del torso', 'Encoger los trapecios'], 'Brazos al costado hasta la altura de los hombros.'),
  x('lateral_raise_cable', 'Elevaciones laterales en polea', 'shoulders', [], 'isolation', 'cable', 1.25, ['Polea a la altura de la mano o más baja', 'Tensión constante'], ['Tirar con el trapecio', 'Rotar el torso'], 'Mano cruzada frente al cuerpo hasta la altura del hombro.'),
  x('lateral_raise_machine', 'Elevaciones laterales en máquina', 'shoulders', [], 'isolation', 'isolation_machine', 2.5, ['Codos contra las almohadillas', 'Sube hasta la horizontal'], ['Impulso', 'Hombros encogidos'], 'Brazos abajo hasta la horizontal.', 'Máquina de laterales'),
  x('reverse_pec_deck', 'Deltoides posterior en máquina', 'shoulders', ['back'], 'isolation', 'isolation_machine', 5, ['Pecho apoyado, brazos casi extendidos', 'Abre en arco amplio'], ['Juntar las escápulas en exceso', 'Doblar los codos'], 'Manos al frente hasta brazos alineados con los hombros.', 'Pec deck inverso'),
  x('face_pull', 'Face pull en polea', 'shoulders', ['back'], 'isolation', 'cable', 2.5, ['Cuerda hacia la cara, codos altos', 'Rota externamente al final'], ['Demasiada carga', 'Tirar hacia el pecho'], 'Brazos extendidos hasta manos junto a las orejas.'),
  // ---- Bíceps ----
  x('barbell_curl', 'Curl de bíceps con barra', 'biceps', ['forearms'], 'isolation', 'barbell', 2.5, ['Codos pegados al torso', 'Baja completamente'], ['Balancear el torso', 'Adelantar los codos'], 'Extensión completa hasta flexión máxima sin mover los codos.'),
  x('db_curl', 'Curl con mancuernas', 'biceps', ['forearms'], 'isolation', 'dumbbell', 1, ['Supina mientras subes', 'Controla la bajada'], ['Usar impulso', 'Recorrido parcial'], 'Brazo extendido hasta flexión completa.'),
  x('incline_db_curl', 'Curl inclinado con mancuernas', 'biceps', ['forearms'], 'isolation', 'dumbbell', 1, ['Banco a 45–60°, brazos colgando atrás', 'Codos quietos'], ['Adelantar los codos', 'Despegar la espalda'], 'Estiramiento completo atrás hasta flexión máxima.'),
  x('preacher_curl_machine', 'Curl predicador en máquina', 'biceps', ['forearms'], 'isolation', 'isolation_machine', 2.5, ['Axilas contra el apoyo', 'Extiende casi por completo abajo'], ['Levantar los codos del apoyo', 'Rebote abajo'], 'Casi extensión hasta flexión completa.', 'Banco Scott / máquina de curl'),
  x('cable_curl', 'Curl en polea baja', 'biceps', ['forearms'], 'isolation', 'cable', 2.5, ['Codos fijos al costado', 'Tensión constante'], ['Inclinarse atrás', 'Mover los hombros'], 'Extensión completa hasta flexión máxima.'),
  x('hammer_curl', 'Curl martillo', 'biceps', ['forearms'], 'isolation', 'dumbbell', 1, ['Agarre neutro', 'Codos pegados'], ['Balanceo', 'Subir en diagonal con impulso'], 'Brazo extendido hasta flexión completa.'),
  // ---- Tríceps ----
  x('triceps_pushdown', 'Extensión de tríceps en polea', 'triceps', [], 'isolation', 'cable', 2.5, ['Codos pegados al costado', 'Extiende por completo abajo'], ['Abrir los codos', 'Inclinar el cuerpo sobre la carga'], 'Antebrazos sobre la horizontal hasta extensión completa.', 'Polea alta con cuerda o barra'),
  x('overhead_triceps_cable', 'Extensión de tríceps sobre la cabeza en polea', 'triceps', [], 'isolation', 'cable', 2.5, ['Codos apuntando al frente', 'Busca el estiramiento atrás'], ['Abrir mucho los codos', 'Arquear la espalda'], 'Manos detrás de la cabeza hasta extensión completa.'),
  x('skullcrusher', 'Press francés', 'triceps', [], 'isolation', 'barbell', 2.5, ['Baja la barra detrás de la cabeza', 'Brazos algo inclinados atrás'], ['Abrir los codos', 'Convertirlo en press'], 'Estiramiento profundo hasta extensión.'),
  x('triceps_machine', 'Extensión de tríceps en máquina', 'triceps', [], 'isolation', 'isolation_machine', 5, ['Codos apoyados y alineados con el eje', 'Extiende sin despegar los brazos'], ['Encoger los hombros', 'Recorrido corto'], 'Flexión completa hasta extensión.', 'Máquina de tríceps'),
  x('close_grip_bench', 'Press de banca agarre cerrado', 'triceps', ['chest', 'shoulders'], 'compound', 'barbell', 2.5, ['Agarre al ancho de hombros', 'Codos cerca del torso'], ['Agarre demasiado estrecho', 'Rebote'], 'Barra al pecho bajo hasta extensión.'),
  x('dips_machine', 'Fondos en máquina', 'triceps', ['chest', 'shoulders'], 'compound', 'machine', 5, ['Torso erguido', 'Empuja hasta extender'], ['Encoger hombros', 'Subir demasiado las manos'], 'Codos a ~90° hasta extensión.', 'Máquina de fondos sentado'),
  // ---- Antebrazos ----
  x('wrist_curl', 'Curl de muñeca', 'forearms', [], 'isolation', 'dumbbell', 1, ['Antebrazos apoyados', 'Deja rodar la barra a los dedos'], ['Mover el antebrazo', 'Rango corto'], 'Extensión completa de muñeca hasta flexión máxima.'),
  x('reverse_curl', 'Curl invertido', 'forearms', ['biceps'], 'isolation', 'barbell', 2.5, ['Agarre prono', 'Muñecas neutras'], ['Doblar las muñecas', 'Balanceo'], 'Extensión completa hasta flexión.'),
  // ---- Cuádriceps ----
  x('squat', 'Sentadilla con barra', 'quads', ['glutes', 'hamstrings', 'abs'], 'compound', 'barbell', 2.5, ['Pies al ancho de hombros, rodillas siguen la punta', 'Abdomen firme antes de bajar'], ['Colapso de rodillas hacia dentro', 'Perder la neutralidad lumbar abajo'], 'Hasta que la cadera baje al menos a la altura de la rodilla, según movilidad.'),
  x('hack_squat', 'Sentadilla hack', 'quads', ['glutes'], 'compound', 'lever', 5, ['Espalda y cadera contra el respaldo', 'Baja profundo con control'], ['Despegar la cadera', 'Bloquear rodillas con violencia'], 'Flexión profunda de rodilla hasta casi extender.', 'Máquina hack'),
  x('leg_press', 'Prensa de piernas', 'quads', ['glutes', 'hamstrings'], 'compound', 'lever', 10, ['Pies al ancho de caderas', 'Baja hasta donde la pelvis siga apoyada'], ['Despegar la cadera del asiento', 'Bloquear las rodillas'], 'Rodillas hacia el pecho sin retroversión pélvica hasta casi extender.', 'Prensa 45°'),
  x('smith_squat', 'Sentadilla en Smith', 'quads', ['glutes'], 'compound', 'smith', 2.5, ['Pies algo adelantados', 'Torso erguido'], ['Pies demasiado atrás', 'Medio recorrido'], 'Profundidad paralela o mayor hasta casi extender.'),
  x('bulgarian_split_squat', 'Sentadilla búlgara', 'quads', ['glutes', 'hamstrings'], 'compound', 'dumbbell', 2, ['Pie trasero apoyado en banco', 'Baja vertical'], ['Paso demasiado corto', 'Rodilla hacia dentro'], 'Rodilla trasera cerca del suelo hasta extensión.'),
  x('leg_extension', 'Extensión de cuádriceps', 'quads', [], 'isolation', 'isolation_machine', 5, ['Rodilla alineada con el eje', 'Extiende por completo y controla la bajada'], ['Levantar la cadera', 'Patear la carga'], 'Flexión profunda hasta extensión completa.', 'Máquina de extensiones'),
  // ---- Isquiotibiales ----
  x('romanian_deadlift', 'Peso muerto rumano', 'hamstrings', ['glutes', 'back'], 'compound', 'barbell', 2.5, ['Cadera atrás, rodillas levemente flexionadas', 'Barra pegada a las piernas'], ['Redondear la espalda', 'Convertirlo en sentadilla'], 'Hasta sentir estiramiento máximo de isquios con espalda neutra.'),
  x('seated_leg_curl', 'Curl femoral sentado', 'hamstrings', ['calves'], 'isolation', 'isolation_machine', 5, ['Almohadilla sobre los muslos bien ajustada', 'Flexiona por completo'], ['Levantar la cadera', 'Soltar la carga al volver'], 'Rodilla casi extendida hasta flexión máxima.', 'Curl femoral sentado'),
  x('lying_leg_curl', 'Curl femoral tumbado', 'hamstrings', ['calves'], 'isolation', 'isolation_machine', 5, ['Cadera pegada al banco', 'Talones hacia los glúteos'], ['Elevar la cadera', 'Recorrido parcial'], 'Extensión casi completa hasta flexión máxima.', 'Curl femoral tumbado'),
  // ---- Glúteos ----
  x('hip_thrust', 'Hip thrust con barra', 'glutes', ['hamstrings', 'quads'], 'compound', 'barbell', 5, ['Mentón al pecho, costillas abajo', 'Pausa arriba con cadera extendida'], ['Hiperextender la zona lumbar', 'Pies demasiado lejos'], 'Cadera abajo hasta extensión completa.'),
  x('hip_thrust_machine', 'Hip thrust en máquina', 'glutes', ['hamstrings'], 'compound', 'machine', 5, ['Cinturón sobre la cadera', 'Empuja con los talones'], ['Arquear la espalda', 'Rebote abajo'], 'Cadera flexionada hasta extensión completa.', 'Máquina de hip thrust'),
  x('glute_kickback_cable', 'Patada de glúteo en polea', 'glutes', ['hamstrings'], 'isolation', 'cable', 2.5, ['Torso inclinado y estable', 'Extiende la cadera sin arquear'], ['Girar la pelvis', 'Impulso'], 'Cadera flexionada hasta extensión.'),
  x('hip_abduction_machine', 'Abducción de cadera en máquina', 'glutes', [], 'isolation', 'isolation_machine', 5, ['Espalda apoyada', 'Abre controlando el retorno'], ['Rebote', 'Rango corto'], 'Piernas juntas hasta abducción máxima cómoda.', 'Máquina abductora'),
  // ---- Gemelos ----
  x('standing_calf_raise', 'Elevación de talones de pie', 'calves', [], 'isolation', 'machine', 5, ['Pausa abajo en estiramiento', 'Sube lo máximo posible'], ['Rebotar', 'Doblar las rodillas'], 'Talón bien abajo hasta máxima elevación.', 'Máquina de gemelos de pie'),
  x('seated_calf_raise', 'Elevación de talones sentado', 'calves', [], 'isolation', 'lever', 5, ['Almohadilla sobre las rodillas', 'Pausa en el estiramiento'], ['Rebote', 'Rango corto'], 'Estiramiento completo hasta contracción máxima.', 'Máquina de gemelos sentado'),
  x('leg_press_calf', 'Gemelos en prensa', 'calves', [], 'isolation', 'lever', 10, ['Solo el antepié en la plataforma', 'Rodillas casi extendidas'], ['Flexionar rodillas', 'Soltar los seguros sin control'], 'Estiramiento completo hasta extensión del tobillo.', 'Prensa 45°'),
  // ---- Abdominales ----
  x('cable_crunch', 'Crunch en polea', 'abs', [], 'isolation', 'cable', 2.5, ['Flexiona la columna, no la cadera', 'Costillas hacia la pelvis'], ['Tirar con los brazos', 'Sentarse sobre los talones'], 'Torso erguido hasta flexión completa de columna.'),
  x('ab_crunch_machine', 'Crunch en máquina', 'abs', [], 'isolation', 'isolation_machine', 5, ['Exhala al contraer', 'Movimiento corto y controlado'], ['Tirar con los brazos', 'Impulso'], 'Extensión cómoda hasta flexión completa.', 'Máquina de abdominales'),
  x('hanging_leg_raise', 'Elevación de piernas colgado', 'abs', ['forearms'], 'isolation', 'bodyweight', 1, ['Retroversión pélvica al subir', 'Baja sin balancearte'], ['Balanceo', 'Subir solo con flexores de cadera'], 'Piernas abajo hasta elevar la pelvis.'),
  x('plank', 'Plancha (reps = segundos ÷ 5)', 'abs', ['shoulders'], 'isolation', 'bodyweight', 1, ['Cuerpo en línea', 'Glúteos y abdomen apretados'], ['Cadera caída', 'Aguantar la respiración'], 'Isométrico: mantener la alineación.'),
];

// Patrón de movimiento de los ejercicios base (los del catálogo ampliado ya lo declaran). Lo usan los iconos.
const BASE_PATTERN: Record<string, PatternId> = {
  chest_press_machine: 'press_h', chest_press_convergent: 'press_h', bench_press: 'press_h', incline_bench_press: 'press_incline', db_bench_press: 'press_h',
  incline_db_press: 'press_incline', smith_incline_press: 'press_incline', pec_deck: 'fly', cable_crossover: 'fly', push_up: 'pushup', dips: 'dip',
  lat_pulldown: 'pulldown', pull_up: 'pullup', seated_cable_row: 'row', machine_row: 'row', lever_row: 'row', barbell_row: 'row', db_row: 'row',
  straight_arm_pulldown: 'pullover', back_extension: 'backext', shoulder_press_machine: 'press_oh', db_shoulder_press: 'press_oh', overhead_press: 'press_oh',
  lateral_raise_db: 'raise_lat', lateral_raise_cable: 'raise_lat', lateral_raise_machine: 'raise_lat', reverse_pec_deck: 'raise_rear', face_pull: 'facepull',
  barbell_curl: 'curl', db_curl: 'curl', incline_db_curl: 'curl', preacher_curl_machine: 'curl', cable_curl: 'curl', hammer_curl: 'curl_rev',
  triceps_pushdown: 'tri_down', overhead_triceps_cable: 'tri_oh', skullcrusher: 'tri_lying', triceps_machine: 'tri_down', close_grip_bench: 'press_close',
  dips_machine: 'dip', wrist_curl: 'wrist_flex', reverse_curl: 'curl_rev', squat: 'squat', hack_squat: 'squat', leg_press: 'legpress', smith_squat: 'squat',
  bulgarian_split_squat: 'lunge', leg_extension: 'legext', romanian_deadlift: 'hinge', seated_leg_curl: 'legcurl', lying_leg_curl: 'legcurl',
  hip_thrust: 'hipthrust', hip_thrust_machine: 'hipthrust', glute_kickback_cable: 'kickback', hip_abduction_machine: 'abduction',
  standing_calf_raise: 'calf', seated_calf_raise: 'calf', leg_press_calf: 'calf', cable_crunch: 'crunch', ab_crunch_machine: 'crunch',
  hanging_leg_raise: 'legraise', plank: 'plank',
};
const PATTERN_OF = new Map<string, PatternId>([...Object.entries(BASE_PATTERN), ...CATALOG.map((r) => [r.id, r.pattern] as [string, PatternId])]);
/** Patrón de movimiento de un ejercicio de la biblioteca (indefinido en los ejercicios propios). */
export const patternOf = (id: string): PatternId | undefined => PATTERN_OF.get(id);

export const LIBRARY: ExerciseDef[] = [...BASE.map((b) => ({ ...b, ...PATCH[b.id] })), ...CATALOG.map(fromCatalog)];
const BY_ID = new Map(LIBRARY.map((b) => [b.id, b]));
export const isLibraryId = (id: string) => BY_ID.has(id);

/** Combina la biblioteca con los ejercicios y ajustes del usuario. */
export function mergeExercises(rows: ExerciseRow[]): ExerciseDef[] {
  const overrides = new Map<string, ExerciseRow>();
  const customs: ExerciseDef[] = [];
  for (const r of rows) {
    if (r.deleted) continue;
    if (r.baseId) overrides.set(r.baseId, r);
    else customs.push(rowToDef(r, r.id));
  }
  // De un ejercicio de la biblioteca el usuario solo ajusta máquina, incremento y foto: el resto sigue al catálogo vigente.
  return [...LIBRARY.map((b) => { const o = overrides.get(b.id); return o ? { ...b, machine: o.machine, increment: o.increment, photo: o.photo } : b; }), ...customs];
}

function rowToDef(r: ExerciseRow, id: string): ExerciseDef {
  return {
    id, name: r.name, primary: r.primary, secondary: r.secondary, type: r.type, equipment: r.equipment, machine: r.machine,
    focus: r.focus ?? '', aka: r.aka ?? '', measure: r.measure ?? 'reps', category: r.category ?? 'strength',
    cues: r.cues, mistakes: r.mistakes, rom: r.rom, execution: r.execution, safety: r.safety, increment: r.increment, photo: r.photo, custom: r.custom,
  };
}
