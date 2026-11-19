# Iron Intelligence

**Registra. Analiza. Progresa.** — Plataforma de registro y progresión para entrenamiento de fuerza e hipertrofia.

Aplicación web (PWA) local-first: funciona sin conexión, guarda cada serie al instante en el dispositivo y, si configuras Supabase, añade cuenta, respaldo en la nube y sincronización entre dispositivos.

## Puesta en marcha

```bash
npm install
npm run dev        # desarrollo en http://localhost:5173
npm test           # 53 pruebas (unitarias, integración e interfaz)
npm run build      # genera dist/ lista para desplegar (Vercel, Netlify, Cloudflare Pages, etc.)
```

Sin más configuración la app corre en **modo local**: datos persistentes en IndexedDB, sin cuenta.

### Activar cuenta y sincronización (Supabase)

1. Crea un proyecto en supabase.com.
2. En *SQL Editor*, ejecuta `supabase/schema.sql` (tablas, relaciones, RLS y triggers).
3. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. `npm run build` y despliega. La app mostrará la pantalla de inicio de sesión.

> **Estado de verificación:** el esquema está aplicado en el proyecto Supabase `iron-intelligence` (São Paulo) y se comprobó
> que cada columna que envía la app existe, con RLS, política y trigger en las 8 tablas. La lógica de sincronización está
> probada contra un servidor simulado. El primer inicio de sesión y la primera sincronización reales desde un navegador
> quedan por confirmar.

### APK Android

El proyecto es compatible con Capacitor (`npx cap init`, `npx cap add android`, `webDir: dist`). No está incluido.

## Qué está implementado

| Módulo | Estado |
|---|---|
| Registro por serie (peso, reps, RIR, RPE, fallo, motivo de fin, descanso real, nota) | Completo |
| Recuperación de sesión tras cerrar la app, pausa/reanudar, temporizador de descanso | Completo |
| Motor de doble progresión con explicación, factores y confianza | Completo |
| Constructor de rutinas + plantillas PPL, Torso/Pierna, Full Body | Completo |
| Biblioteca (más de 60 ejercicios), ejercicios propios, máquina del gimnasio, foto propia | Completo |
| Volumen por músculo (directas/indirectas con coeficiente), distribución por RIR, tendencias | Completo |
| Historial, calendario, edición/eliminación, gráficos por ejercicio, récords, 1RM estimado | Completo |
| Recuperación y fatiga, peso corporal | Completo |
| Asistente de análisis sobre el historial | Completo (motor determinista, no un modelo de lenguaje) |
| Copia de seguridad JSON, restauración, exportación CSV | Completo |
| Autenticación y sincronización con Supabase | Implementado; esquema aplicado y verificado; falta confirmar el primer inicio de sesión real |
| Ilustraciones | Una ilustración por **tipo de equipamiento** + mapa muscular por ejercicio + foto propia. No hay ilustración anatómica ni animación individual por ejercicio (el campo `photo` ya lo soporta) |
| Pruebas de interfaz | Con Testing Library sobre la app completa; no hay suite E2E en navegador dentro del repo |

## Arquitectura

Ver `docs/ARQUITECTURA.md`. Fundamento científico en `docs/EVIDENCIA.md` (y en la pantalla *Fundamento*).

```
src/domain   Lógica pura y probada: progresión, volumen, recuperación, asistente, validación
src/data     IndexedDB (Dexie), repositorio, sincronización, copias de seguridad
src/ui       Componentes, mapa corporal, ilustraciones, gráficos
src/pages    Pantallas
src/tests    Pruebas
supabase     Esquema SQL con Row Level Security
```
