# iPhone y reloj: qué funciona hoy y qué falta

## iPhone, hoy (sin App Store)
La app es una aplicación web instalable. En Safari: **Compartir → Añadir a pantalla de inicio**. Abre a pantalla
completa, funciona sin conexión, mantiene la pantalla encendida durante el entrenamiento y, desde iOS 16.4,
puede enviar notificaciones. La propia app muestra esta instrucción la primera vez que se abre en un iPhone.

Diferencias con Android: el iPhone no vibra desde una app web (el aviso de descanso usa sonido) y las
notificaciones solo existen con la app instalada en la pantalla de inicio.

## iPhone en la App Store
Requisitos que no se pueden cumplir desde este entorno:
- Cuenta de Apple Developer (99 USD al año).
- Un Mac con Xcode para compilar y firmar.

Camino recomendado: empaquetar esta misma app con Capacitor.
1. `npm i @capacitor/core @capacitor/ios && npx cap init "Iron Intelligence" com.ironintelligence.app --web-dir dist`
2. `npm run build && npx cap add ios && npx cap sync`
3. Abrir `ios/App` en Xcode, configurar el equipo de firma, iconos y pantalla de inicio.
4. Inicio de sesión con Google: registrar el esquema de retorno de la app en Supabase y en Google Cloud.
5. Apple exige ofrecer también «Iniciar sesión con Apple» si existe inicio con Google.
6. Subir con Xcode a App Store Connect, completar privacidad (datos de salud y forma física) y enviar a revisión.

## Reloj, hoy
Con «Notificación con la app en segundo plano» activada en Perfil, el aviso de fin de descanso llega al
teléfono y, por el reflejo normal de notificaciones, al reloj enlazado (Wear OS, Galaxy Watch, Apple Watch):
muestra qué serie sigue, con peso y repeticiones.

Límite: el aviso lo dispara la app abierta en segundo plano. Si el sistema la suspende con la pantalla
bloqueada durante mucho rato, puede llegar tarde. La pantalla se mantiene encendida mientras se entrena
precisamente para evitarlo.

## Reloj, app propia (pendiente)
Registrar series desde la muñeca requiere una app nativa por plataforma:
- **Wear OS:** proyecto Android (Kotlin, Compose for Wear) que hable con el teléfono por la Data Layer.
  Necesita Android Studio; se publica junto con la app de Play Store.
- **Apple Watch:** destino watchOS en el proyecto de Xcode (SwiftUI + WatchConnectivity). Necesita el Mac.
- **Salud:** Health Connect (Android) y HealthKit (iOS) para escribir los entrenamientos; solo existen en
  apps nativas, por lo que llegan con el empaquetado de Capacitor.

Orden sugerido: Play Store → empaquetado iOS → Health Connect y HealthKit → apps de reloj.
