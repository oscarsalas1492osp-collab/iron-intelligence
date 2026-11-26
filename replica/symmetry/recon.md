# Symmetry: mapa de reconocimiento (24-11-2026)

Objetivo: no es clonar. Es ver qué hace bien Symmetry en diseño y funciones para mejorar IRON INTELLIGENCE con soluciones propias.
Método: solo fuentes públicas, leídas una vez. Sin cuenta, sin código, sin capturas guardadas.

## Fuentes

| Fuente | URL | Qué aporta | Sesgo |
| --- | --- | --- | --- |
| Ficha App Store (México) | https://apps.apple.com/mx/app/symmetry-rutinas-gimnasio-pro/id6474446718 | Funciones declaradas, compras, novedades de versión, reseñas visibles | Texto del propio desarrollador |
| Comparación publicada por Hevy | https://www.hevyapp.com/?p=17943 | Registro, rangos, plan gratis y Pro, precios, carencias | Es un competidor directo |
| Análisis de onboarding (screensdesign) | https://screensdesign.com/showcase/symmetry-ai-gym-workout-log | 38 pasos, firma de compromiso, muro de pago, ventas dentro del entrenamiento | Estimaciones de ingresos no verificadas |

No se leyeron: ficha de Google Play, Reddit ni el sitio symmetry.club. Las reseñas visibles fueron cuatro, así que no hay base para rankear quejas.

## Bucle central

Responder el cuestionario, recibir un plan, registrar la sesión con el peso sugerido y ver subir el rango de cada ejercicio y músculo.

## Pantallas (inferidas, confianza media)

| ID | Pantalla | Propósito | Evidencia |
| --- | --- | --- | --- |
| S01 | Onboarding de 38 pasos | Perfil, equipo disponible, compromiso | screensdesign |
| S02 | Muro de pago con prueba gratis y oferta con reloj al cerrar | Convertir a Pro | screensdesign |
| S03 | Registro de la sesión | Peso y repeticiones en 2 toques, video del ejercicio de fondo, tipo de serie, RPE | Hevy |
| S04 | Biblioteca de ejercicios (más de 300) | Video, instrucciones, músculos, equipo | Hevy, App Store |
| S05 | Programas y rutinas | Hasta 5 rutinas gratis, más de 30 rutinas listas | Hevy |
| S06 | Progreso por ejercicio | Series, volumen, peso máximo, 1RM, por mes, año y total | Hevy |
| S07 | Rangos | Por ejercicio, músculo, grupo y global; mapa corporal de rangos | Hevy, App Store |
| S08 | Escaneo corporal con IA (Pro) | Valora partes del cuerpo desde una foto | App Store |
| S09 | Chat con IA (Pro) | Responde con los datos de entrenamiento | Hevy |
| S10 | Feed social y descubrimiento | Publicar, comparar y guardar entrenamientos, etiquetar amigos | Hevy, novedades 7.17 y 7.18 |
| S11 | Medidas | Peso, medidas corporales y fotos de progreso | novedades 7.17 |
| S12 | Importación | Desde Hevy, Strong y Liftoff, con coincidencias de ejercicios ya aceptadas | Hevy, novedades 7.19 |

## Lo que no se toma

Marca, nombres de rangos, textos, videos, capturas, el escaneo corporal desde una foto (IRON INTELLIGENCE no pide fotos) y las tácticas de presión del muro de pago (reloj de oferta, firma de compromiso antes del precio).

## Tamaño

No aplica: no se reconstruye la app. Ver `features.csv` para la comparación con IRON INTELLIGENCE.

## Diseño e interfaz (26-11-2026)

Fuentes nuevas, todas públicas y en texto: notas de versión 7.0 a 7.20 en la App Store de México, análisis de screensdesign (registro, rangos, muro de pago), resumen de capturas de mwm.ai, comparación de Hevy. Las capturas no se pudieron ver (Chrome no estaba conectado), así que colores, tipografía y disposición de Symmetry quedan sin medir. Pendiente: revisión visual con capturas.

Lo que se sabe de su interfaz:

- Registro en capas: video del ejercicio de fondo, peso y repeticiones abajo en dos toques, peso anterior a la vista, tipo de serie y RPE. Hevy lo considera más cargado que el suyo.
- Pestañas Train (el plan), Library (programas en carpetas, desde la 7.12 en la barra inferior), inicio con racha y una página de rangos.
- Rangos de Iron a Symmetric con tres divisiones, por ejercicio, músculo, grupo y global; animación al subir y calculadora de rangos.
- Récords nuevos en cada entrenamiento (7.20), tarjetas y stickers para historias (7.20), widgets de racha (7.4), Live Activity (7.11).
- Videos de técnica desde varios ángulos y sin conexión, con botón para silenciar.
- Reseña visible: valoran que enseña qué músculos trabaja cada ejercicio y cuántas repeticiones hacer.

Respuesta de IRON en esta fecha: tarjetas de rutina con figura de frente y espalda, foco en palabras, duración estimada y última vez, en Rutinas, Entrenar, la rutina de hoy del inicio y el bloque «Qué trabaja» del editor. Diseño propio: brasa sobre petróleo, sin rangos ni medallas.
