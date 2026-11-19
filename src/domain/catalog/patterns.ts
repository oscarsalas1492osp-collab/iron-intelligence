// Patrones de movimiento. Cada ejercicio del catálogo ampliado pertenece a uno y hereda de él
// las indicaciones técnicas, los errores frecuentes y el rango de movimiento recomendado.
import type { Category, ExType, Measure } from '../types';

export interface Pattern {
  type: ExType;
  cues: string[];
  mistakes: string[];
  rom: string;
  measure?: Measure;
  category?: Category;
}

const p = (type: ExType, cues: string[], mistakes: string[], rom: string, extra: Partial<Pattern> = {}): Pattern => ({ type, cues, mistakes, rom, ...extra });

export const PATTERNS = {
  // ---- Empujes ----
  press_h: p('compound', ['Escápulas atrás y abajo, pecho alto', 'Codos a unos 45–60° del torso'], ['Rebotar en el punto bajo', 'Adelantar los hombros al empujar'], 'Desde un estiramiento cómodo del pecho hasta casi extender los codos.'),
  press_incline: p('compound', ['Inclinación de 30–45°', 'Lleva la carga hacia la parte alta del pecho'], ['Inclinar tanto que el trabajo pasa a los hombros', 'Arquear la espalda para aplanar el ángulo'], 'Manos a la altura de la clavícula hasta casi extender los codos.'),
  press_decline: p('compound', ['Baja hacia la parte inferior del pecho', 'Hombros lejos de las orejas'], ['Recorrido corto por exceso de carga', 'Abrir los codos a 90°'], 'Estiramiento cómodo del pecho hasta casi extender los codos.'),
  fly: p('isolation', ['Codos ligeramente flexionados y fijos', 'Mueve los brazos en arco, como abrazando'], ['Convertirlo en un press doblando los codos', 'Abrir más de lo que toleran los hombros'], 'Brazos abiertos con estiramiento del pecho hasta juntar las manos al frente.'),
  pushup: p('compound', ['Cuerpo en línea de la cabeza a los talones', 'Baja el pecho entre las manos'], ['Hundir la cadera', 'Medio recorrido'], 'Pecho cerca del suelo o del apoyo hasta extender los codos.'),
  dip: p('compound', ['Hombros abajo, lejos de las orejas', 'Baja con control'], ['Bajar más de lo que toleran tus hombros', 'Balancear las piernas'], 'Hombros a la altura de los codos, o lo que tolere el hombro, hasta extender.'),
  press_oh: p('compound', ['Abdomen y glúteos firmes', 'Antebrazos verticales bajo la carga'], ['Arquear la zona lumbar', 'Quedarse corto arriba'], 'Manos a la altura de las orejas o la clavícula hasta extender sobre la cabeza.'),
  press_close: p('compound', ['Codos cerca del torso', 'Extiende por completo arriba'], ['Agarre tan cerrado que molesta la muñeca', 'Abrir los codos'], 'Carga hasta el pecho y extensión completa de codos.'),
  // ---- Hombros ----
  raise_lat: p('isolation', ['Sube con los codos, no con las manos', 'Leve inclinación del torso al frente'], ['Balancear el cuerpo', 'Encoger los trapecios'], 'Brazo junto al cuerpo hasta la altura del hombro.'),
  raise_front: p('isolation', ['Brazo casi extendido', 'Sube hasta la altura de los ojos'], ['Echar el torso atrás', 'Subir con impulso'], 'Desde el muslo hasta la altura de los hombros o los ojos.'),
  raise_rear: p('isolation', ['Abre los brazos en arco amplio', 'Piensa en llevar las manos lejos, no atrás'], ['Tirar con el trapecio juntando las escápulas', 'Demasiada carga'], 'Manos al frente hasta brazos alineados con los hombros.'),
  facepull: p('isolation', ['Codos altos, tira hacia la cara', 'Rota las manos hacia atrás al final'], ['Tirar hacia el pecho', 'Inclinar el torso atrás'], 'Brazos extendidos al frente hasta manos junto a las orejas.'),
  upright_row: p('compound', ['Codos por encima de las manos', 'Agarre al ancho de hombros o más'], ['Subir más allá de lo que tolera el hombro', 'Agarre muy cerrado'], 'Desde los muslos hasta que los codos lleguen a la altura de los hombros.'),
  rot_ext: p('isolation', ['Codo pegado al costado y a 90°', 'Movimiento lento, carga ligera'], ['Separar el codo del cuerpo', 'Girar el torso'], 'Antebrazo frente al abdomen hasta rotar hacia fuera lo que permita el hombro.'),
  rot_int: p('isolation', ['Codo pegado al costado y a 90°', 'Controla el retorno'], ['Usar el torso', 'Carga excesiva'], 'Antebrazo hacia fuera hasta cruzar frente al abdomen.'),
  shrug: p('isolation', ['Sube los hombros hacia las orejas', 'Pausa arriba y baja lento'], ['Rodar los hombros en círculo', 'Flexionar los codos'], 'Hombros totalmente descendidos hasta la máxima elevación.'),
  // ---- Tirones ----
  pulldown: p('compound', ['Pecho arriba, codos hacia las costillas', 'Empieza bajando las escápulas'], ['Echarse atrás con impulso', 'Tirar por detrás de la nuca'], 'Brazos extendidos arriba hasta la carga en la parte alta del pecho.'),
  pullup: p('compound', ['Empieza colgado con brazos extendidos', 'Lleva el pecho hacia la barra'], ['Medio recorrido', 'Balanceo involuntario'], 'Desde colgado completo hasta la barbilla sobre la barra.'),
  row: p('compound', ['Tira con los codos, no con las manos', 'Deja que las escápulas se abran adelante'], ['Balancear el torso', 'Encoger los hombros'], 'Brazos extendidos con estiramiento hasta los codos detrás del torso.'),
  pullover: p('isolation', ['Codos casi extendidos y fijos', 'Costillas abajo, sin arquear'], ['Flexionar los codos para ayudarse', 'Perder el control en el estiramiento'], 'Brazos sobre la cabeza con estiramiento del dorsal hasta la altura de la cadera.'),
  scap: p('isolation', ['Brazos extendidos todo el tiempo', 'Mueve solo las escápulas'], ['Doblar los codos', 'Movimiento brusco'], 'Escápulas elevadas o separadas hasta deprimidas y juntas.'),
  // ---- Brazos ----
  curl: p('isolation', ['Codos quietos junto al torso', 'Baja hasta extender casi por completo'], ['Balancear el cuerpo', 'Adelantar los codos al subir'], 'Brazo extendido hasta la flexión completa del codo.'),
  curl_rev: p('isolation', ['Agarre prono o neutro, muñecas firmes', 'Codos pegados'], ['Doblar las muñecas', 'Usar impulso'], 'Brazo extendido hasta la flexión completa del codo.'),
  tri_down: p('isolation', ['Codos pegados al costado', 'Extiende por completo abajo'], ['Mover los codos adelante y atrás', 'Inclinarse sobre la carga'], 'Antebrazos por encima de la horizontal hasta la extensión completa.'),
  tri_oh: p('isolation', ['Codos apuntando al frente o arriba', 'Baja hasta sentir el estiramiento'], ['Abrir mucho los codos', 'Arquear la espalda'], 'Estiramiento profundo detrás de la cabeza hasta extender los codos.'),
  tri_lying: p('isolation', ['Brazos algo inclinados hacia atrás', 'Solo se mueven los antebrazos'], ['Convertirlo en un press', 'Bajar hacia la frente sin control'], 'Carga detrás o a la altura de la cabeza hasta extender los codos.'),
  tri_kick: p('isolation', ['Brazo paralelo al suelo y quieto', 'Pausa con el codo extendido'], ['Balancear el brazo', 'Bajar el codo'], 'Codo a 90° hasta la extensión completa.'),
  wrist_flex: p('isolation', ['Antebrazos apoyados', 'Deja rodar la carga hasta los dedos'], ['Mover el codo', 'Rango corto'], 'Muñeca extendida hasta la flexión completa.'),
  wrist_ext: p('isolation', ['Antebrazos apoyados, palmas abajo', 'Carga ligera'], ['Levantar el antebrazo', 'Tirones'], 'Muñeca flexionada hasta la extensión completa.'),
  grip: p('isolation', ['Aprieta con toda la mano', 'Hombros activos, sin colgarte de las articulaciones'], ['Soltar de golpe', 'Aguantar la respiración'], 'Isométrico: mantener el agarre sin perder la postura.', { measure: 'time' }),
  // ---- Piernas ----
  squat: p('compound', ['Rodillas en la dirección de los pies', 'Torso firme, pies completos en el suelo'], ['Levantar los talones', 'Hundir las rodillas hacia dentro'], 'Baja hasta donde mantengas la espalda neutra, idealmente muslos paralelos o más.'),
  legpress: p('compound', ['Espalda y cadera pegadas al respaldo', 'Baja hasta donde la pelvis no se despegue'], ['Bloquear las rodillas con violencia', 'Recorrido corto con mucha carga'], 'Rodillas hacia el pecho sin levantar la cadera hasta casi extender.'),
  lunge: p('compound', ['Paso largo, torso estable', 'Baja en vertical, sin irte adelante'], ['Rodilla delantera hacia dentro', 'Impulsarte con la pierna de atrás'], 'Rodilla trasera cerca del suelo hasta extender la pierna delantera.'),
  stepup: p('compound', ['Todo el pie sobre el cajón', 'Sube empujando con la pierna de arriba'], ['Impulsarte con la pierna del suelo', 'Dejarte caer al bajar'], 'Desde el pie de abajo apenas apoyado hasta la extensión completa arriba.'),
  hinge: p('compound', ['Cadera atrás, rodillas levemente flexionadas', 'Carga pegada a las piernas, espalda neutra'], ['Redondear la zona lumbar', 'Convertirlo en una sentadilla'], 'Hasta sentir estiramiento en los isquiotibiales sin perder la espalda neutra, y extensión completa de cadera.'),
  deadlift: p('compound', ['Barra sobre el medio pie, espalda neutra', 'Empuja el suelo y lleva la cadera a la barra'], ['Redondear la espalda al despegar', 'Hiperextender arriba'], 'Desde el suelo o los soportes hasta la extensión completa de cadera y rodillas.'),
  hipthrust: p('compound', ['Mentón al pecho, costillas abajo', 'Pausa arriba apretando los glúteos'], ['Arquear la zona lumbar arriba', 'Empujar con las puntas de los pies'], 'Cadera abajo hasta alinear hombros, cadera y rodillas.'),
  kickback: p('isolation', ['Torso estable, abdomen firme', 'Extiende la cadera sin arquear la espalda'], ['Balancear la pierna', 'Rotar la pelvis'], 'Muslo bajo la cadera hasta la extensión completa de cadera.'),
  backext: p('isolation', ['Bisagra desde la cadera', 'Sube hasta alinear el cuerpo'], ['Hiperextender la zona lumbar', 'Subir con impulso'], 'Flexión completa de cadera hasta el cuerpo alineado.'),
  legext: p('isolation', ['Rodilla alineada con el eje de la máquina', 'Pausa breve arriba'], ['Patear la carga', 'Levantar la cadera del asiento'], 'Rodilla flexionada más de 90° hasta la extensión completa.'),
  legcurl: p('isolation', ['Cadera quieta', 'Lleva los talones hacia los glúteos'], ['Levantar la cadera', 'Soltar la carga al volver'], 'Pierna casi extendida hasta la flexión máxima de rodilla.'),
  nordic: p('isolation', ['Cuerpo recto de rodillas a hombros', 'Baja lo más lento posible'], ['Doblar la cadera', 'Dejarse caer'], 'Desde arrodillado erguido hasta donde controles la bajada; vuelve con ayuda si hace falta.'),
  abduction: p('isolation', ['Pelvis quieta', 'Abre con control y pausa fuera'], ['Balancear el torso', 'Rebote al cerrar'], 'Piernas juntas hasta la apertura máxima cómoda.'),
  adduction: p('isolation', ['Espalda apoyada, pelvis quieta', 'Cierra con control'], ['Abrir más de lo que tolera la ingle', 'Soltar la carga al abrir'], 'Apertura cómoda con estiramiento hasta juntar las piernas.'),
  calf: p('isolation', ['Pausa abajo en el estiramiento', 'Sube lo máximo posible'], ['Rebotar', 'Rango corto'], 'Talón bien abajo hasta la máxima elevación.'),
  tibia: p('isolation', ['Talones fijos, sube las puntas', 'Baja lento'], ['Mover las rodillas', 'Recorrido corto'], 'Punta del pie extendida hasta la flexión dorsal máxima.'),
  // ---- Zona media ----
  crunch: p('isolation', ['Flexiona la columna: costillas hacia la pelvis', 'Exhala al contraer'], ['Tirar del cuello', 'Subir con los flexores de cadera'], 'Torso extendido hasta la flexión completa de la columna.'),
  situp: p('isolation', ['Sube enrollando la columna', 'Baja con control'], ['Tirones del cuello', 'Impulso con los brazos'], 'Espalda en el apoyo hasta el torso erguido.'),
  legraise: p('isolation', ['Lleva la pelvis hacia las costillas', 'Baja sin balancearte'], ['Subir solo con los flexores de cadera', 'Arquear la zona lumbar al bajar'], 'Piernas abajo hasta elevar la pelvis.'),
  rollout: p('isolation', ['Glúteos apretados, costillas abajo', 'Avanza solo hasta donde no se hunda la espalda'], ['Hundir la zona lumbar', 'Volver tirando con la cadera'], 'Desde recogido hasta el cuerpo extendido sin perder la postura.'),
  plank: p('isolation', ['Cuerpo en línea', 'Glúteos y abdomen apretados'], ['Cadera caída o demasiado alta', 'Aguantar la respiración'], 'Isométrico: mantener la alineación.', { measure: 'time' }),
  rotation: p('isolation', ['Gira desde el torso, cadera estable', 'Brazos casi extendidos'], ['Tirar solo con los brazos', 'Girar con brusquedad'], 'Rotación cómoda a un lado hasta la rotación completa al otro.'),
  antirot: p('isolation', ['Torso quieto: resiste el giro', 'Extiende los brazos al frente con control'], ['Dejar que la carga te gire', 'Encoger los hombros'], 'Manos en el pecho hasta los brazos extendidos, sin que el torso rote.'),
  sidebend: p('isolation', ['Inclínate solo hacia el costado', 'Movimiento lento'], ['Inclinarse adelante o atrás', 'Demasiada carga'], 'Inclinación lateral cómoda hasta pasar levemente la vertical.'),
  neck: p('isolation', ['Movimiento lento y carga ligera', 'Hombros quietos'], ['Tirones', 'Rango forzado'], 'Recorrido cómodo, sin llegar a los extremos.'),
  // ---- Funcional y potencia ----
  carry: p('compound', ['Camina erguido, pasos cortos', 'Hombros atrás, abdomen firme'], ['Inclinarse hacia un lado', 'Soltar la carga sin control'], 'Recorrido caminando a ritmo constante.', { measure: 'distance', category: 'functional' }),
  sled: p('compound', ['Cuerpo inclinado, espalda neutra', 'Pasos potentes y continuos'], ['Redondear la espalda', 'Pasos cortos y entrecortados'], 'Recorrido continuo sin detener el trineo.', { measure: 'distance', category: 'functional' }),
  swing: p('compound', ['Bisagra de cadera, no sentadilla', 'La cadera impulsa; los brazos solo guían'], ['Subir la carga con los hombros', 'Redondear la espalda abajo'], 'Carga entre las piernas hasta la altura del pecho, con la cadera extendida.', { category: 'functional' }),
  oly: p('compound', ['Carga pegada al cuerpo', 'Extiende cadera y rodillas con fuerza antes de tirar con los brazos'], ['Tirar con los brazos demasiado pronto', 'Recibir con la espalda redondeada'], 'Recorrido completo del levantamiento con recepción estable.', { category: 'power' }),
  thruster: p('compound', ['Baja en sentadilla con la carga al frente', 'Usa el impulso de las piernas para empujar arriba'], ['Separar el empuje de la sentadilla', 'Arquear la espalda arriba'], 'Sentadilla completa hasta los brazos extendidos sobre la cabeza.', { category: 'functional' }),
  throw: p('compound', ['La fuerza nace en las piernas y la cadera', 'Suelta el balón con el cuerpo extendido'], ['Lanzar solo con los brazos', 'Redondear la espalda al recoger'], 'Movimiento explosivo completo en cada repetición.', { category: 'power' }),
  jump: p('compound', ['Aterriza suave, rodillas alineadas con los pies', 'Reinicia la postura antes de cada salto'], ['Aterrizar con las rodillas hacia dentro', 'Encadenar saltos con mala técnica por fatiga'], 'Salto máximo con aterrizaje controlado.', { category: 'power' }),
  getup: p('compound', ['Mira la carga durante todo el movimiento', 'Brazo vertical y hombro encajado'], ['Apurar las transiciones', 'Doblar el codo del brazo que sostiene'], 'Desde tumbado hasta de pie y regreso por los mismos pasos.', { category: 'functional' }),
  crawl: p('compound', ['Cadera baja y estable', 'Mueve mano y pie contrarios'], ['Balancear la cadera', 'Hundir la zona lumbar'], 'Desplazamiento continuo.', { measure: 'distance', category: 'functional' }),
  ropes: p('compound', ['Rodillas flexionadas, torso firme', 'Ondas amplias y continuas'], ['Encorvarse', 'Perder el ritmo'], 'Trabajo continuo durante el tiempo marcado.', { measure: 'time', category: 'functional' }),
  conditioning: p('compound', ['Ritmo constante que puedas sostener', 'Técnica completa en cada repetición'], ['Acortar el recorrido por fatiga', 'Aterrizajes bruscos'], 'Recorrido completo en cada repetición.', { category: 'functional' }),
  hold: p('isolation', ['Postura firme desde el primer segundo', 'Respira sin perder la tensión'], ['Perder la alineación al cansarte', 'Aguantar la respiración'], 'Isométrico: mantener la posición.', { measure: 'time' }),
} satisfies Record<string, Pattern>;

export type PatternId = keyof typeof PATTERNS;
