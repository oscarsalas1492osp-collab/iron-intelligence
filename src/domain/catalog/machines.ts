// Catálogo de equipamiento: qué máquinas e implementos hay hoy en los gimnasios, qué músculos trabaja cada uno,
// ejemplos de modelos comerciales vigentes y qué ejercicios de la biblioteca se hacen con ellos.
// Los modelos provienen de los catálogos públicos de cada fabricante (ver docs/CATALOGO.md); son ejemplos, no un listado cerrado.
import type { Equipment, Muscle } from '../types';

export type Load = 'stack' | 'plates' | 'cable' | 'free' | 'body' | 'electronic' | 'cardio';
export type Zone = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'glutes' | 'core' | 'stations' | 'free' | 'functional' | 'cardio';

export const LOAD_LABEL: Record<Load, string> = {
  stack: 'Selectorizada (placas con pasador)', plates: 'Carga de discos', cable: 'Polea', free: 'Peso libre',
  body: 'Peso corporal', electronic: 'Resistencia electrónica', cardio: 'Acondicionamiento',
};
export const ZONES: Zone[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core', 'stations', 'free', 'functional', 'cardio'];
export const ZONE_LABEL: Record<Zone, string> = {
  chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros', arms: 'Brazos', legs: 'Piernas', glutes: 'Glúteos y cadera',
  core: 'Zona media y cuello', stations: 'Poleas y estaciones', free: 'Peso libre', functional: 'Funcional', cardio: 'Cardio',
};

export interface Machine {
  id: string; name: string; aka: string; zone: Zone; load: Load;
  /** El primero es el músculo principal. Vacío cuando depende del ejercicio. */
  muscles: Muscle[];
  note: string;
  models: string[];
  /** Ejercicios de la biblioteca que se hacen en esta máquina. */
  ex: string[];
  /** Implemento de la biblioteca al que corresponde (para listar todos sus ejercicios). */
  eq?: Equipment;
}

const m = (id: string, name: string, aka: string, zone: Zone, load: Load, muscles: string, note: string, models: string[], ex = '', eq?: Equipment): Machine =>
  ({ id, name, aka, zone, load, muscles: (muscles ? muscles.split(' ') : []) as Muscle[], note, models, ex: ex ? ex.split(' ') : [], eq });

export const MACHINES: Machine[] = [
  // ---------------- Pecho ----------------
  m('chest_press', 'Press de pecho sentado', 'chest press', 'chest', 'stack', 'chest triceps shoulders', 'Empuje horizontal guiado. Ajusta el asiento para que las empuñaduras queden a media altura del pecho.',
    ['Life Fitness Insignia Chest Press', 'Hammer Strength Select Chest Press', 'Technogym Artis Chest Press', 'Hoist CL-3301 Chest Press'], 'chest_press_machine'),
  m('chest_press_converging', 'Press de pecho convergente', 'converging chest press, dual axis', 'chest', 'stack', 'chest triceps shoulders', 'Los brazos se acercan al empujar, como con mancuernas, y cada lado trabaja por separado.',
    ['Matrix Ultra Converging Chest Press', 'Life Fitness Insignia Dual Axis Chest Press'], 'chest_press_convergent incline_press_convergent'),
  m('iso_bench', 'Press de banca de palancas', 'iso-lateral bench press, wide chest', 'chest', 'plates', 'chest triceps shoulders', 'Palancas independientes cargadas con discos. Hay versiones horizontal, de agarre abierto y de banca.',
    ['Hammer Strength Iso-Lateral Bench Press', 'Hammer Strength Iso-Lateral Horizontal Bench Press', 'Hammer Strength Iso-Lateral Wide Chest'], 'iso_bench_press_lever wide_chest_lever'),
  m('incline_press', 'Press inclinado', 'incline press', 'chest', 'plates', 'chest shoulders triceps', 'Empuje en ángulo ascendente que da más trabajo a la porción superior del pectoral.',
    ['Hammer Strength Iso-Lateral Incline Press', 'Hammer Strength Iso-Lateral Super Incline Press', 'Hammer Strength MTS Iso-Lateral Incline Press'], 'incline_press_machine iso_incline_press_lever incline_press_convergent'),
  m('decline_press', 'Press declinado', 'decline chest press', 'chest', 'plates', 'chest triceps shoulders', 'Empuje descendente con énfasis en la porción inferior del pectoral.',
    ['Hammer Strength Iso-Lateral Decline Chest Press', 'Panatta Super Declined Chest Press', 'Precor Discovery Decline Chest Press'], 'decline_press_machine iso_decline_press_lever'),
  m('pec_fly', 'Contractora de pecho', 'pec deck, pectoral fly, butterfly', 'chest', 'stack', 'chest shoulders', 'Aperturas guiadas. Muchas son dobles: girando los brazos sirve también para el deltoides posterior.',
    ['Life Fitness Insignia Pectoral Fly/Rear Deltoid', 'Hammer Strength Select Pectoral Fly', 'Technogym Selection 900 Pectoral', 'Hoist CL-3309 Pec Fly/Rear Delt', 'Hammer Strength Super Fly (discos)'], 'pec_deck pec_fly_lever reverse_pec_deck'),
  m('multi_flight', 'Multi flight de pie', 'standing multi flight', 'chest', 'stack', 'shoulders chest back', 'Brazos giratorios con muchos ángulos de partida: elevaciones laterales, aperturas de pecho y aperturas posteriores en una sola máquina.',
    ['Panatta Monolith Standing Multi Flight', 'Technogym Selection 900 Multi Flight'], 'lateral_raise_machine pec_deck reverse_pec_deck'),
  m('seated_dip', 'Fondos sentado', 'seated dip, triceps press', 'chest', 'plates', 'triceps chest shoulders', 'Reproduce los fondos en paralelas sin cargar el peso corporal.',
    ['Hammer Strength Plate Loaded Seated Dip', 'Hoist ROC-IT Seated Dip', 'Life Fitness Insignia Triceps Press'], 'dips_machine triceps_dip_lever'),
  m('assist_dip_chin', 'Dominadas y fondos asistidos', 'assist dip chin', 'back', 'stack', 'back biceps chest triceps', 'Una plataforma descuenta parte del peso corporal: más placas es más ayuda.',
    ['Life Fitness Insignia Assist Dip Chin', 'Hammer Strength Select Assist Dip Chin', 'Nautilus Assisted Pull-Up'], 'assisted_pull_up_machine assisted_dip_machine'),
  // ---------------- Espalda ----------------
  m('lat_pulldown', 'Jalón al pecho', 'lat pulldown, polea alta', 'back', 'stack', 'back biceps forearms', 'Tirón vertical con barra o agarres intercambiables. El rodillo sujeta los muslos.',
    ['Life Fitness Insignia Pulldown', 'Hammer Strength Select Lat Pulldown', 'Hammer Strength Select Fixed Pulldown', 'Life Fitness Axiom Lat Pulldown', 'Hoist CL-3201 Lat Pulldown'], 'lat_pulldown lat_pulldown_neutral lat_pulldown_supinated lat_pulldown_wide lat_pulldown_single pulldown_machine'),
  m('pulldown_diverging', 'Jalón divergente o de palancas', 'dual axis pulldown, iso-lateral pulldown, vertical traction', 'back', 'plates', 'back biceps forearms', 'Brazos independientes que se abren al bajar; permite trabajar un lado a la vez.',
    ['Life Fitness Insignia Dual Axis Pulldown', 'Hammer Strength Iso-Lateral Front Lat Pulldown', 'Hammer Strength Iso-Lateral Wide Pulldown', 'Technogym Selection 900 Vertical Traction'], 'pulldown_convergent iso_pulldown_lever'),
  m('seated_row', 'Remo sentado', 'seated row, low row, mid row', 'back', 'stack', 'back biceps traps', 'Tirón horizontal, casi siempre con apoyo de pecho para no cargar la zona lumbar.',
    ['Life Fitness Insignia Row', 'Hammer Strength Select Seated Row', 'Technogym Selection 900 Low Row', 'Hoist CL-3203 Mid Row', 'Prime Seated Row'], 'machine_row low_row_machine seated_cable_row'),
  m('iso_row', 'Remo de palancas', 'iso-lateral row, low row, d.y. row', 'back', 'plates', 'back biceps traps', 'Remo cargado con discos y brazos independientes. El ángulo del tirón cambia entre modelos (horizontal, bajo, circular).',
    ['Hammer Strength Iso-Lateral Row', 'Hammer Strength Iso-Lateral Low Row', 'Hammer Strength Iso-Lateral D.Y. Row', 'Panatta Super Rowing Machine', 'Matrix Magnum Incline Lever Row'], 'lever_row low_row_lever'),
  m('high_row', 'Remo alto', 'high row', 'back', 'plates', 'back biceps traps', 'Tirón en diagonal de arriba hacia abajo, a medio camino entre el jalón y el remo.',
    ['Hammer Strength Iso-Lateral High Row', 'Matrix Magnum High Row', 'Life Fitness Plate Loaded High Row'], 'high_row_lever'),
  m('t_bar', 'Remo en barra T', 't-bar row', 'back', 'plates', 'back biceps traps lowerback', 'Barra pivotante con discos; con apoyo de pecho la zona lumbar descansa.',
    ['Hammer Strength T-Bar Row', 'Hammer Strength Iso-Lateral T-Bar Row', 'Matrix Magnum T-Bar Row'], 't_bar_row_supported t_bar_row_landmine'),
  m('pullover', 'Pullover', 'pullover', 'back', 'plates', 'back chest triceps', 'Lleva los brazos en arco desde arriba de la cabeza hasta la cadera; aísla el dorsal sin limitarse por el bíceps.',
    ['Hammer Strength Plate Loaded Pullover', 'Technogym Pure Strength Pullover'], 'pullover_machine'),
  m('shrug_machine', 'Encogimientos', 'seated/standing shrug', 'back', 'plates', 'traps forearms', 'Empuñaduras a los lados del cuerpo para encoger hombros sentado o de pie.',
    ['Hammer Strength Seated/Standing Shrug'], 'shrug_machine'),
  m('back_extension', 'Extensión lumbar', 'back extension', 'back', 'stack', 'lowerback glutes hamstrings', 'Extensión del tronco contra un rodillo, sentado.',
    ['Life Fitness Insignia Back Extension', 'Life Fitness Axiom Abdominal/Back Extension'], 'back_extension_machine'),
  m('roman_chair', 'Banco de hiperextensiones y GHD', 'roman chair, 45° hyperextension, glute ham developer', 'back', 'body', 'lowerback glutes hamstrings', 'Banco a 45° u horizontal para extensiones de espalda y cadera. El GHD añade elevaciones glúteo-isquiotibiales y abdominales.',
    ['Precor Discovery GHD Bench', 'Precor Glutebuilder Dual 45 Hip Extension', 'Hammer Strength Glute Ham / Reverse Hyper'], 'back_extension back_extension_glute ghd_back_extension glute_ham_raise ghd_sit_up side_bend_45'),
  // ---------------- Hombros ----------------
  m('shoulder_press', 'Press de hombros', 'shoulder press', 'shoulders', 'stack', 'shoulders triceps traps', 'Empuje vertical guiado. Existe selectorizado, convergente y de palancas con discos.',
    ['Life Fitness Insignia Shoulder Press', 'Hammer Strength Iso-Lateral Shoulder Press', 'Matrix Aura Shoulder Press', 'Technogym Pure Strength Shoulder Press', 'Hoist CL-3501 Shoulder Press', 'Panatta Super Vertical Multi Press'], 'shoulder_press_machine iso_shoulder_press_lever shoulder_press_convergent'),
  m('lateral_raise', 'Elevaciones laterales', 'lateral raise', 'shoulders', 'stack', 'shoulders traps', 'Las almohadillas empujan desde los codos, así el antebrazo no limita la carga.',
    ['Life Fitness Insignia Lateral Raise', 'Hammer Strength Plate Loaded Lateral Raise', 'Matrix Ultra Lateral Raise', 'Hoist CL-3502 Lateral Raise'], 'lateral_raise_machine lateral_raise_lever'),
  m('rear_delt', 'Deltoides posterior', 'rear deltoid, reverse fly', 'shoulders', 'stack', 'shoulders traps back', 'Normalmente es la contractora de pecho usada al revés, mirando al respaldo.',
    ['Life Fitness Insignia Pectoral Fly/Rear Deltoid', 'Hammer Strength Select Pectoral Fly/Rear Deltoid', 'Hoist CL-3309 Pec Fly/Rear Delt'], 'reverse_pec_deck'),
  // ---------------- Brazos ----------------
  m('biceps_curl', 'Curl de bíceps', 'arm curl, preacher curl', 'arms', 'stack', 'biceps forearms', 'Brazos apoyados en un cojín tipo predicador, con el codo alineado al eje.',
    ['Life Fitness Insignia Biceps Curl', 'Technogym Selection 900 Arm Curl', 'Hoist CL-3102 Preacher Curl', 'Hammer Strength Plate Loaded Seated Biceps', 'Matrix Magnum Elevated Biceps Curl'], 'preacher_curl_machine biceps_curl_machine preacher_curl_lever'),
  m('triceps_extension', 'Extensión de tríceps', 'arm extension, triceps extension', 'arms', 'stack', 'triceps', 'Extensión de codo con los brazos apoyados.',
    ['Life Fitness Insignia Triceps Extension', 'Technogym Selection 900 Arm Extension', 'Hoist CL-3103 Triceps Press', 'Hammer Strength MTS Iso-Lateral Triceps Extension'], 'triceps_machine triceps_extension_lever'),
  m('total_arms', 'Brazos de pie', 'standing total arms, biceps/triceps', 'arms', 'stack', 'biceps triceps', 'Máquina doble: curl de bíceps y extensión de tríceps en el mismo puesto.',
    ['Panatta Standing Total Arms', 'Life Fitness Axiom Biceps/Triceps'], 'biceps_curl_machine triceps_machine'),
  m('gripper_machine', 'Agarre', 'gripper', 'arms', 'plates', 'forearms', 'Cierre de mano contra carga de discos.',
    ['Hammer Strength Plate Loaded Gripper'], 'gripper_machine'),
  // ---------------- Piernas ----------------
  m('leg_press_45', 'Prensa a 45°', 'linear leg press', 'legs', 'plates', 'quads glutes adductors', 'Carro sobre rieles inclinados. La posición de los pies cambia el énfasis: bajos para cuádriceps, altos para glúteos.',
    ['Hammer Strength Plate Loaded Linear Leg Press', 'gym80 Pure Kraft 45° Linear Leg Press', 'Arsenal Strength Leg Press'], 'leg_press leg_press_single leg_press_high_feet leg_press_calf'),
  m('leg_press_seated', 'Prensa sentado', 'seated leg press, arc leg press', 'legs', 'stack', 'quads glutes adductors', 'Prensa horizontal con pasador; cómoda para empezar y para series a una pierna.',
    ['Life Fitness Insignia Arc Leg Press', 'Hammer Strength Select Seated Leg Press', 'Matrix Ultra Leg Press', 'Hoist CL-3403 Leg Press'], 'leg_press_horizontal'),
  m('leg_press_vertical', 'Prensa vertical', 'vertical leg press', 'legs', 'plates', 'quads glutes adductors', 'Tumbado boca arriba, se empuja la plataforma hacia el techo.',
    ['gym80 Pure Kraft Vertical Leg Press'], 'leg_press_vertical'),
  m('hack_squat', 'Sentadilla hack', 'hack squat', 'legs', 'plates', 'quads glutes', 'Sentadilla guiada con la espalda apoyada en un carro inclinado.',
    ['Hammer Strength Plate Loaded Hack Squat', 'Atlantis Hack Squat'], 'hack_squat hack_calf_raise'),
  m('pendulum_squat', 'Sentadilla péndulo', 'pendulum squat', 'legs', 'plates', 'quads glutes', 'El carro describe un arco: permite bajar muy profundo con el torso apoyado.',
    ['Hammer Strength Plate Loaded Pendulum-X Squat', 'Matrix Magnum Pendulum Squat', 'Panatta Super Pendulum Squat'], 'pendulum_squat'),
  m('v_squat', 'Sentadilla en V', 'v-squat, super squat', 'legs', 'plates', 'quads glutes adductors', 'Palanca con hombreras; de espaldas trabaja como sentadilla y de frente carga más la cadena posterior.',
    ['Hammer Strength Plate Loaded V-Squat', 'Hammer Strength Plate Loaded Reverse V-Squat', 'Hammer Strength Plate Loaded Super Squat Press'], 'v_squat reverse_hack_squat'),
  m('belt_squat', 'Sentadilla con cinturón', 'belt squat', 'legs', 'plates', 'quads glutes adductors', 'La carga cuelga de la cadera: piernas pesadas sin comprimir la columna.',
    ['Hammer Strength Plate Loaded Belt Squat', 'Nautilus Belt Squat', 'Matrix Magnum Belt Squat', 'gym80 Pure Kraft Belt Squat'], 'belt_squat'),
  m('leg_extension', 'Extensión de cuádriceps', 'leg extension', 'legs', 'stack', 'quads', 'Extensión de rodilla sentado. Alinea la rodilla con el eje y ajusta el rodillo sobre el tobillo.',
    ['Life Fitness Insignia Leg Extension', 'Hammer Strength Iso-Lateral Leg Extension', 'Matrix Ultra Leg Extension', 'Matrix Magnum Reclining Leg Extension', 'Hoist CL-3401 Leg Extension'], 'leg_extension leg_extension_single leg_extension_lever'),
  m('seated_leg_curl', 'Curl femoral sentado', 'seated leg curl', 'legs', 'stack', 'hamstrings calves', 'Flexión de rodilla sentado; la cadera flexionada estira más los isquiotibiales.',
    ['Life Fitness Insignia Seated Leg Curl', 'Hammer Strength Select Seated Leg Curl', 'Matrix Ultra Seated Leg Curl'], 'seated_leg_curl'),
  m('prone_leg_curl', 'Curl femoral tumbado', 'prone/lying leg curl', 'legs', 'stack', 'hamstrings calves', 'Flexión de rodilla boca abajo sobre un banco angulado.',
    ['Life Fitness Insignia Leg Curl', 'Matrix Ultra Prone Leg Curl', 'Hoist CL-3402 Leg Curl', 'Panatta Fit Evo Leg Curl'], 'lying_leg_curl leg_curl_lever'),
  m('standing_leg_curl', 'Curl femoral de pie o arrodillado', 'standing/kneeling leg curl', 'legs', 'plates', 'hamstrings calves', 'Trabaja una pierna a la vez, de pie o con una rodilla apoyada.',
    ['Hammer Strength Iso-Lateral Kneeling Leg Curl', 'Matrix Magnum Kneeling Leg Curl', 'Hoist CL-3408 Standing/Prone Leg Curl'], 'standing_leg_curl kneeling_leg_curl'),
  m('nordic_machine', 'Curl nórdico asistido', 'assisted nordic ham', 'legs', 'plates', 'hamstrings glutes calves', 'Sujeta los tobillos y un contrapeso ayuda a controlar la bajada del curl nórdico.',
    ['Hammer Strength Plate Loaded Assisted Nordic Ham'], 'nordic_assisted_machine nordic_curl'),
  m('standing_calf', 'Gemelos de pie', 'standing calf raise', 'legs', 'stack', 'calves', 'Hombreras sobre los hombros y plataforma para bajar el talón.',
    ['Hammer Strength Select Standing Calf', 'Technogym Selection 900 Standing Calf', 'Life Fitness Plate Loaded Calf Raise'], 'standing_calf_raise'),
  m('seated_calf', 'Gemelos sentado', 'seated calf raise', 'legs', 'plates', 'calves', 'Con la rodilla flexionada el trabajo recae más en el sóleo.',
    ['Hammer Strength Plate Loaded Seated Calf Raise'], 'seated_calf_raise'),
  m('calf_extension', 'Extensión de gemelos', 'calf extension, calf press', 'legs', 'stack', 'calves', 'Sentado con las piernas extendidas, se empuja una plataforma con el antepié.',
    ['Life Fitness Insignia Calf Extension', 'Matrix Ultra Calf Extension'], 'calf_extension_machine'),
  m('tibia_machine', 'Flexión dorsal de tobillo', 'tibia dorsi-flexion', 'legs', 'plates', 'tibialis', 'Levanta la punta del pie contra carga; trabaja el tibial anterior.',
    ['Hammer Strength Plate Loaded Tibia Dorsi-Flexion'], 'tibialis_raise_machine'),
  // ---------------- Glúteos y cadera ----------------
  m('hip_thrust_machine', 'Hip thrust', 'hip thrust, glute drive, glute bridge', 'glutes', 'plates', 'glutes hamstrings', 'Empuje de cadera con cinturón o rodillo acolchado, sin montar la barra. Hay versiones tumbadas y de pie.',
    ['Hammer Strength Plate Loaded Glute Drive', 'Technogym Selection 900 Hip Thrust', 'Precor Glutebuilder Hip Thrust Elite', 'Life Fitness Insignia Glute Bridge', 'Matrix Magnum Standing Hip Thrust'], 'hip_thrust_machine glute_drive_lever standing_hip_thrust_machine'),
  m('glute_kickback', 'Patada de glúteo', 'glute, glute press, rear kick', 'glutes', 'stack', 'glutes hamstrings', 'Extensión de cadera empujando una plataforma hacia atrás, de pie o apoyado.',
    ['Life Fitness Insignia Glute', 'Technogym Selection 900 Glute Press', 'Precor Glutebuilder Glute Press'], 'glute_kickback_machine'),
  m('multi_hip', 'Multicadera', 'rotary hip, multi hip', 'glutes', 'stack', 'glutes abductors adductors', 'Un brazo giratorio permite extensión, flexión, abducción y aducción de cadera de pie.',
    ['Matrix Aura Rotary Hip'], 'multi_hip_extension'),
  m('hip_abductor', 'Abductores', 'hip abduction, outer thigh', 'glutes', 'stack', 'abductors glutes', 'Abre las piernas contra las almohadillas. Hay versiones sentadas, de pie y combinadas con aductores.',
    ['Life Fitness Insignia Hip Abduction', 'Life Fitness Insignia Sit/Stand Hip Abductor', 'Hammer Strength Select Hip Abduction', 'Technogym Selection 900 Abductor', 'Hoist CL-3800 Inner/Outer Thigh'], 'hip_abduction_machine hip_abduction_standing_machine'),
  m('hip_adductor', 'Aductores', 'hip adduction, inner thigh', 'glutes', 'stack', 'adductors', 'Cierra las piernas contra las almohadillas. Regula la apertura inicial según tu movilidad.',
    ['Life Fitness Insignia Hip Adduction', 'Hammer Strength Select Hip Adduction', 'Technogym Selection 900 Adductor', 'Life Fitness Insignia Hip Abductor/Adductor'], 'hip_adduction_machine'),
  m('reverse_hyper', 'Hiperextensión inversa', 'reverse hyper', 'glutes', 'plates', 'glutes hamstrings lowerback', 'El torso queda apoyado y las piernas se elevan hacia atrás con un péndulo cargado.',
    ['Hammer Strength Glute Ham / Reverse Hyper'], 'reverse_hyper'),
  // ---------------- Zona media y cuello ----------------
  m('ab_crunch', 'Abdominales', 'abdominal crunch', 'core', 'stack', 'abs obliques', 'Flexión del tronco contra carga, sentado.',
    ['Life Fitness Insignia Abdominal', 'Hammer Strength Select Abdominal Crunch', 'Hammer Strength Abdominal / Oblique Crunch (discos)'], 'ab_crunch_machine ab_crunch_lever'),
  m('torso_rotation', 'Rotación de torso', 'torso rotation, rotary torso', 'core', 'stack', 'obliques abs', 'Gira el tronco con la cadera fija. Empieza con poca carga y recorrido cómodo.',
    ['Life Fitness Insignia Torso Rotation', 'Prime Hybrid Rotary Torso'], 'torso_rotation_machine'),
  m('captain_chair', 'Silla romana y paralelas', 'dip/leg raise, captain’s chair', 'core', 'body', 'abs triceps chest', 'Apoyo de antebrazos para elevar rodillas o piernas, con barras para fondos.',
    ['Life Fitness Axiom Dip/Leg Raise'], 'captain_chair_raise dips'),
  m('neck_machine', 'Cuello de cuatro direcciones', '4-way neck', 'core', 'plates', 'neck traps', 'Flexión, extensión y flexión lateral del cuello contra una almohadilla.',
    ['Hammer Strength Plate Loaded 4-Way Neck'], 'neck_machine'),
  // ---------------- Poleas y estaciones ----------------
  m('functional_trainer', 'Polea doble ajustable', 'functional trainer, dual adjustable pulley', 'stations', 'cable', '', 'Dos poleas regulables en altura. Es el puesto más versátil de la sala: admite casi cualquier ejercicio de polea.',
    ['Life Fitness Axiom Dual Adjustable Pulley', 'Matrix Aura Functional Trainer', 'Matrix Versa Functional Trainer', 'Technogym Kinesis One'], '', 'cable'),
  m('high_low_pulley', 'Polea alta y baja', 'lat pulldown / low row', 'stations', 'cable', 'back biceps', 'Torre con jalón arriba y remo abajo; también sirve para tríceps, bíceps y face pull.',
    ['Life Fitness Axiom Lat Pulldown/Low Row', 'Matrix Versa Dual Lat Pulldown / Seated Row', 'Technogym Selection 900 Pulley'], 'lat_pulldown seated_cable_row triceps_pushdown cable_curl face_pull'),
  m('multi_station', 'Multiestación', 'multi-station, jungle', 'stations', 'cable', '', 'Varias torres de placas unidas: jalón, remo, poleas ajustables y cruce en un mismo bloque.',
    ['Matrix Aura 4-Stack Multi-Station', 'Precor Resolute Multi-Station'], 'cable_crossover lat_pulldown seated_cable_row'),
  m('smith_machine', 'Máquina Smith', 'smith machine, multipower', 'stations', 'plates', '', 'Barra guiada sobre rieles con ganchos de seguridad. Sirve para press, sentadilla, zancadas, hip thrust, remo y gemelos.',
    ['Hammer Strength Plate-Loaded Vertical Smith Machine', 'Matrix Magnum Smith Machine', 'Life Fitness Axiom Smith Rack'], '', 'smith'),
  m('ground_base', 'Estaciones de pie con discos', 'ground base jammer, combo twist', 'stations', 'plates', 'quads glutes shoulders', 'Palancas para empujar y tirar de pie, con los pies en el suelo; pensadas para potencia deportiva.',
    ['Hammer Strength Ground Base Jammer', 'Hammer Strength Ground Base Combo Twist', 'Hammer Strength Ground Base Squat / High Pull', 'Hammer Strength Ground Base Multi-Squat'], ''),
  m('adaptive', 'Máquinas de resistencia electrónica', 'biostrength, smart strength', 'stations', 'electronic', '', 'Un motor reemplaza las placas: ajusta sola la postura y la carga, y puede dar más resistencia en la bajada.',
    ['Technogym Biostrength', 'EGYM Smart Strength'], ''),
  // ---------------- Peso libre ----------------
  m('rack', 'Jaula y soportes de sentadilla', 'power rack, half rack', 'free', 'free', '', 'Soportes con barras de seguridad para sentadilla, press y tirones con barra; suele incluir barra de dominadas.', [], '', 'barbell'),
  m('benches', 'Bancos', 'plano, ajustable, declinado, predicador', 'free', 'free', '', 'El banco ajustable cubre de plano a vertical. El predicador fija los brazos para el curl.', [], ''),
  m('bars', 'Barras', 'olímpica, Z, hexagonal, de seguridad, multiagarre', 'free', 'free', '', 'Olímpica de 20 kg para lo general. La Z alivia muñecas en curl y press francés; la hexagonal centra la carga en peso muerto y paseos; la de seguridad y la multiagarre cuidan hombros en sentadilla y press.', [], '', 'barbell'),
  m('dumbbells', 'Mancuernas', 'dumbbells', 'free', 'free', '', 'Cada brazo trabaja por separado y con más recorrido que la barra.', [], '', 'dumbbell'),
  m('landmine_station', 'Landmine', 'mina, barra anclada', 'free', 'free', '', 'Un extremo de la barra gira en un anclaje: press, remos, sentadillas y rotaciones en arco.', [], '', 'landmine'),
  m('pull_up_station', 'Barra de dominadas y paralelas', 'pull-up bar, dip station', 'free', 'body', 'back chest triceps abs', 'Para dominadas, fondos, elevaciones de piernas y colgarse.', [], 'pull_up chin_up dips hanging_leg_raise dead_hang'),
  // ---------------- Funcional ----------------
  m('kettlebells', 'Pesas rusas', 'kettlebells', 'functional', 'free', '', 'El peso queda fuera de la mano: ideales para swings, cargadas, levantadas turcas y caminatas.', [], '', 'kettlebell'),
  m('sled_station', 'Trineo', 'sled, prowler', 'functional', 'free', 'quads glutes calves', 'Se empuja o se arrastra sobre un carril. No tiene fase de bajada, así que deja poca agujeta.', [], '', 'sled'),
  m('balls', 'Balones', 'medicinal, slam ball, wall ball', 'functional', 'free', '', 'El balón medicinal rebota y sirve para pases; el slam ball no rebota y es para azotes; el wall ball es blando y grande para lanzar a un blanco.', [], '', 'medball'),
  m('suspension_trainer', 'Suspensión y anillas', 'TRX, rings', 'functional', 'body', '', 'Correas o anillas colgadas: remos, flexiones, aperturas y core con el peso corporal; la inclinación regula la dificultad.', [], '', 'suspension'),
  m('bands', 'Bandas elásticas', 'resistance bands', 'functional', 'free', '', 'La resistencia crece al estirar. Sirven para activar, asistir dominadas o añadir tensión a barras y máquinas.', [], '', 'band'),
  m('other_tools', 'Cuerdas, sacos, cajones y accesorios', 'battle rope, sandbag, plyo box, ab wheel, fitball', 'functional', 'free', '', 'Cuerdas de batalla para trabajo continuo de hombros; sacos de arena para cargar y caminar; cajones para saltos y subidas; rueda abdominal y fitball para la zona media.', [], '', 'other'),
  // ---------------- Cardio ----------------
  m('treadmill', 'Cinta de correr', 'treadmill, cinta curva', 'cardio', 'cardio', 'quads hamstrings glutes calves', 'Caminar o correr. La cinta curva no tiene motor: la mueves tú.', [], ''),
  m('bike', 'Bicicleta y bicicleta de aire', 'bike, air bike', 'cardio', 'cardio', 'quads glutes calves', 'La bicicleta de aire suma brazos y la resistencia crece cuanto más fuerte pedaleas.', [], ''),
  m('rower', 'Remo', 'rower, ergómetro', 'cardio', 'cardio', 'back quads glutes hamstrings biceps', 'Empuje de piernas seguido de tirón de brazos; trabaja casi todo el cuerpo.', [], ''),
  m('ski_erg', 'Esquí ergómetro', 'SkiErg', 'cardio', 'cardio', 'back triceps abs', 'Tirón de arriba hacia abajo de pie, con flexión de tronco.', [], ''),
  m('elliptical', 'Elíptica', 'elliptical, crosstrainer', 'cardio', 'cardio', 'quads glutes hamstrings', 'Zancada guiada sin impacto, con o sin brazos.', [], ''),
  m('stair_climber', 'Escaladora', 'stair climber', 'cardio', 'cardio', 'glutes quads calves', 'Escalera sin fin o pedales; carga glúteos y cuádriceps.', [], ''),
];

/** Fabricantes y líneas vigentes (catálogos públicos, noviembre de 2026). */
export const BRANDS: { brand: string; lines: string }[] = [
  { brand: 'Life Fitness', lines: 'Insignia y Axiom (selectorizadas); carga de discos propia' },
  { brand: 'Hammer Strength', lines: 'Plate-Loaded (Iso-Lateral, Ground Base), Select y MTS' },
  { brand: 'Technogym', lines: 'Selection 900/700, Element, Pure, Artis, Biostrength (electrónica) y Kinesis' },
  { brand: 'Matrix', lines: 'Ultra, Versa, Aura y Go (selectorizadas); Magnum (discos y racks)' },
  { brand: 'Precor', lines: 'Resolute y Vitality (selectorizadas); Discovery (discos y bancos); Glutebuilder' },
  { brand: 'Panatta', lines: 'Fit Evo, SEC, Monolith y Freeweight HP / Special' },
  { brand: 'Nautilus', lines: 'Instinct, Inspiration e Impact' },
  { brand: 'Hoist', lines: 'ROC-IT y serie CL' },
  { brand: 'Prime', lines: 'Hybrid, con leva ajustable SmartStrength; agarres RO-T8' },
  { brand: 'Atlantis', lines: 'Precision, Power, Pro y Natural Motion' },
  { brand: 'gym80', lines: 'Sygnum, Pure Kraft y Pure Kraft Strong' },
  { brand: 'Arsenal Strength', lines: 'Reloaded (discos) y M1 (selectorizada)' },
  { brand: 'Freemotion', lines: 'Epic Plate Loaded y estaciones de polea' },
];
