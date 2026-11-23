# Paquete Android (Google Play)

La app de Google Play es un envoltorio de la web (Trusted Web Activity): muestra `https://app.ironintelligence.app`
a pantalla completa, sin barra del navegador, y se actualiza sola cada vez que se publica la web.

## Decidido

- Nombre del paquete: `app.ironintelligence` (confirmado por Oscar el 21-11-2026; no se puede cambiar después).
- Dirección de arranque: `/?origen=play`. Con eso la app sabe que corre dentro del paquete de Google Play y no ofrece
  el pago por Mercado Pago (ahí las suscripciones van por el cobro de Google).
- Cobro de Google Play activado en el paquete (`features.playBilling`).
- Firma: Play App Signing. Google guarda la clave con la que firma lo que reciben los usuarios; nosotros solo
  guardamos la clave de subida.

`twa-manifest.json` tiene estos valores en el formato de Bubblewrap. Sirve tal cual con `bubblewrap build`, y
como referencia si el paquete se genera con otra herramienta.

## Hecho

- 21-11-2026: paquete 1.0.0.0 (código 1) generado con PWABuilder, con clave de subida nueva. El `.zip` original,
  con la clave y sus contraseñas, está solo en el computador de Oscar
  (`Claude Herramientas\Iron Intelligence\android`), no en este repositorio.
- `public/.well-known/assetlinks.json` publica la huella de la clave de subida: sirve para probar el `.apk`
  instalado directo en un teléfono. Falta agregar la huella de la clave con la que firma Google Play.

- 23-11-2026: `.aab` 1 (1.0.0.0) subido a la prueba cerrada (canal Alpha) como borrador, y huella de la clave de
  firma de Google Play agregada a `public/.well-known/assetlinks.json`.

## Lo que falta, en orden

1. En Play Console: crear la app, subir el `.aab` a la prueba cerrada y copiar la huella SHA-256 de
   «Certificado de la clave de firma de la app» (Integridad de la app).
2. Agregar esa huella a `public/.well-known/assetlinks.json`, junto a la de subida. Sin ella, Android muestra la barra del
   navegador dentro de la app.
3. Prueba cerrada y, mientras corre, conectar el cobro de Google Play (productos de suscripción en Play Console,
   Digital Goods API en la app y verificación de compras en el servidor).

## No va al repositorio

`*.keystore`, `*.jks`, `*.aab`, `*.apk` y cualquier archivo con contraseñas.
