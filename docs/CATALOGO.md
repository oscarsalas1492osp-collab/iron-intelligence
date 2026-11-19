# Catálogo de entrenamiento

Estado a noviembre de 2026: **448 ejercicios** y **76 equipos** (máquinas, estaciones, peso libre, implementos funcionales y cardio).

## Cómo está organizado

| Dimensión | Valores |
|---|---|
| Grupos musculares (18) | Pecho, espalda, trapecio, hombros, bíceps, tríceps, antebrazos, abdominales, oblicuos, lumbares, glúteos, abductores, aductores, cuádriceps, isquiotibiales, gemelos, tibial y cuello |
| Implementos (19) | Máquina guiada, de aislamiento, convergente y de discos; polea; Smith; barra, barra Z, barra hexagonal y landmine; mancuernas, pesa rusa y disco; banda elástica; peso corporal; suspensión; balón medicinal; trineo; otros implementos |
| Familias | Fuerza, funcional, potencia y calistenia |
| Qué se anota por serie | Repeticiones, segundos (planchas, colgarse, cuerdas) o metros (paseos, trineo) |

Cada ejercicio indica músculo principal, secundarios, énfasis (por ejemplo «pectoral superior» o «deltoides posterior»), tipo (multiarticular o monoarticular), máquina asociada, indicaciones técnicas, errores frecuentes, rango de movimiento y seguridad.

- `src/domain/exerciseLibrary.ts`: 62 ejercicios base escritos a mano.
- `src/domain/catalog/exercises.ts`: catálogo ampliado. Cada fila hereda sus indicaciones de un patrón de movimiento.
- `src/domain/catalog/patterns.ts`: 67 patrones (press horizontal, remo, bisagra de cadera, curl nórdico, acarreo…).
- `src/domain/catalog/machines.ts`: equipos, con músculos, modelos comerciales de ejemplo y ejercicios vinculados; fabricantes y líneas.

Los grupos que se avisan como «pendientes» en el panel siguen siendo los 11 principales. Trapecio, lumbares, oblicuos, abductores, aductores, tibial y cuello aparecen en el análisis solo cuando se entrenan.

## Cambios sobre datos existentes

- Varios ejercicios base cambiaron de grupo al separar los nuevos músculos: la extensión lumbar pasa de espalda a lumbares; la abducción en máquina, de glúteos a abductores; la sentadilla y la prensa cuentan aductores en vez de isquiotibiales como secundario. El volumen semanal de sesiones ya registradas se recalcula con esta asignación.
- La plancha frontal ahora se anota en segundos. Antes se usaba la convención «repeticiones = segundos ÷ 5».
- Los ajustes del usuario sobre un ejercicio de la biblioteca (máquina, incremento, foto) se conservan; el resto de la ficha sigue al catálogo vigente.
- Base de datos: la tabla `exercises` suma las columnas `focus`, `aka`, `measure` y `category` (con valores por defecto).

## Fuentes

Los modelos comerciales se tomaron de catálogos y notas públicas de los fabricantes, consultados el 19 de noviembre de 2026. Son ejemplos; no es un listado cerrado ni una recomendación de compra.

- Hammer Strength y Life Fitness: <https://www.lifefitness.com/en-us/brands/hammer-strength>, <https://www.lifefitness.com/en-us/catalog/strength-training/plate-loaded>, <https://www.lifefitness.com/en-eu/catalog/strength-training/selectorized/insignia-series>, <https://www.lifefitness.com/en-us/catalog/strength-training/selectorized/axiom-series>, catálogo Hammer Strength 2024.
- Technogym: catálogos Selection, Pure y Biostrength; <https://www.healthclubmanagement.co.uk/health-club-management-features/Specifier-Show-of-strength/37852>.
- Matrix: folleto Strength 2025; línea Magnum de carga de discos (<https://athletechnews.com/matrixs-plate-loaded-machines-help-gyms-meet-the-strength-demand/>).
- Precor: catálogo 2026 y Glutebuilder (<https://www.precor.com/all-about-glutebuilder>).
- Panatta: líneas Monolith, Fit Evo, SEC y Freeweight (<https://www.medicalexpo.com/prod/panatta-113146.html>).
- Nautilus, Hoist, Prime, Atlantis, gym80, Arsenal Strength y Freemotion: páginas y folletos de cada marca y de sus distribuidores.
- Barras especiales: <https://repfitness.com/blogs/guides/specialty-barbells-how-to-use-them-and-why>.
- Estaciones de carreras híbridas (trineo, paseo del granjero, zancadas con saco, balón a la pared): guía de equipamiento de Rogue para HYROX.
- Cobertura de ejercicios: se contrastó con `yuhonas/free-exercise-db` (dominio público, Unlicense) para detectar ausencias. No se copiaron sus textos ni sus imágenes.

La asignación de músculos principales y secundarios sigue la anatomía funcional habitual de cada patrón. Es una clasificación práctica para contar volumen, no una medición de activación muscular.
