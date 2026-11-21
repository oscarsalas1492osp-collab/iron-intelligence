# Pagos (Mercado Pago)

Función de Supabase que cobra Pro en la web. La app la llama con la sesión del usuario (`checkout`, `sync`, `cancel`)
y Mercado Pago le envía sus avisos. El estado siempre se vuelve a pedir a Mercado Pago; nunca se confía en lo que llega.

## Para encenderla

1. En Mercado Pago Developers → Tus integraciones: crear la aplicación (producto: Suscripciones).
2. En Supabase → Edge Functions → Secrets, agregar:
   - `MP_ACCESS_TOKEN`: el Access Token **de producción** de esa aplicación.
   - `MP_WEBHOOK_SECRET`: la clave secreta que Mercado Pago muestra al configurar los Webhooks.
   - `MP_FIRMA_ESTRICTA=1` (opcional): rechaza los avisos cuya firma no coincide. Encenderlo solo después de ver
     avisos reales procesados.
3. En la aplicación de Mercado Pago → Webhooks (modo productivo):
   - URL: `https://<proyecto>.supabase.co/functions/v1/pagos`
   - Eventos: «Planes y suscripciones».
4. En el ajuste `billing` (tabla `app_flags`): `checkout.mp = true`. Para probar antes del lanzamiento, agregar el
   id de la cuenta a `preview`: esa cuenta ve los planes y puede pagar aunque `enabled` siga en `false`.

## Pruebas

`node tools/pagos/prueba.mjs` ejercita la función completa con dobles de Supabase y de Mercado Pago.
Las reglas de fechas están en `periodo.ts` y se prueban también con `npx vitest run`.

Desplegar: los dos archivos (`index.ts`, `periodo.ts`), con la verificación de JWT apagada, porque los avisos de
Mercado Pago llegan sin sesión; los pedidos de la app se validan dentro de la función.
