# Arquitectura

## Principios
- **Local-first.** La interfaz solo lee y escribe en IndexedDB. Cada cambio (un toque en +, un RIR) se persiste en el momento; por eso una sesión interrumpida se recupera sin lógica adicional.
- **Dominio puro.** `src/domain` no conoce React ni la base de datos: recibe datos y devuelve resultados. Es donde viven las reglas y la mayor parte de las pruebas.
- **Una sola puerta de escritura.** Todo pasa por `data/repo.ts`, que valida con Zod, asigna una marca de tiempo monótona y marca la fila como pendiente de sincronizar.

## Modelo de datos
```
usuario 1─1 profiles
usuario 1─N exercises      (propios, o ajustes sobre la biblioteca vía baseId)
usuario 1─N routines 1─N routine_items ──> ejercicio
usuario 1─N sessions 1─N set_logs      ──> ejercicio     (una fila por serie)
usuario 1─N recovery_logs, body_weights
```
`sessions.targets` guarda una copia de los objetivos al iniciar: editar la rutina no reescribe el historial.

## Sincronización (`data/sync.ts`)
1. Bajar filas con `synced_at` (reloj del servidor) posterior al cursor; se aplican si `updated_at` es mayor que el local.
2. Subir las filas `dirty`; se limpia la marca solo si no cambiaron durante la subida.
- Conflictos: gana la última escritura por fila. Borrados lógicos (`deleted = 1`).
- Limitación conocida: la resolución es por fila, no por campo; dos dispositivos editando la misma serie a la vez conservan solo la última.
- Se dispara al abrir, cada 60 s, al recuperar conexión, al volver a la app y 2,5 s después de cada cambio.

## Seguridad
- Row Level Security: `user_id = auth.uid()` en todas las tablas.
- La clave `anon` es pública por diseño; la protección la dan las políticas RLS.
- Las fotos se guardan reducidas (640 px) como data URL en la fila del ejercicio.

## Extensiones preparadas
- Ilustraciones por ejercicio: poblar `photo`/añadir un campo de recurso en `exerciseLibrary.ts`.
- Asistente con modelo de lenguaje: `domain/assistant.ts` ya construye el contexto (`makeCtx`); se puede pasar ese contexto a un modelo manteniendo las respuestas actuales como base verificable.
- Capacitor para Android/iOS.
