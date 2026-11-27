# Animaciones 3D de ejercicios

Los movimientos no se graban: salen de reglas de técnica escritas en código y se revisan cuadro por cuadro antes de renderizar. Blender arma el maniquí, la máquina, la luz y las cámaras con esos datos.

| Archivo | Qué hace |
| --- | --- |
| `biomecanica.py` | Proporciones del cuerpo (Winter) y las reglas de cada ejercicio. Calcula cada articulación en cada cuadro. Solo usa Python y numpy. |
| `validar.py` | Mide cada regla en todos los cuadros y deja `salida/<ejercicio>/validacion.json`. |
| `modelo.py` | Maniquí de placas (los 18 grupos musculares de la app) y los equipos: barra con discos, jaula, banco con soportes y prensa 45°. |
| `escena.py` | Estudio con la luz de la marca, dos cámaras por ejercicio, animación, render y exportación. |
| `generar.py` | Junta todo y deja `.blend`, `.glb`, imágenes y video en `salida/<ejercicio>/`. |

Ejercicios piloto: `squat` (sentadilla con barra), `bench_press` (press de banca con barra) y `leg_press` (prensa de piernas 45°). Las claves son las mismas de la app.

## Render final en el PC (RTX 5080)

1. Instala Blender 5.3 desde blender.org y ffmpeg (`winget install Gyan.FFmpeg`).
2. En una terminal, desde la carpeta del repositorio:

```bat
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b -P tools\anim\generar.py -- --ejercicio squat --final --gpu --cuadro 70
```

   Eso renderiza un solo cuadro en calidad final. Mira la imagen y el tiempo que tardó antes de lanzar el video completo:

```bat
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b -P tools\anim\generar.py -- --ejercicio squat --final --gpu --animacion
```

3. El video queda en `tools\anim\salida\squat\squat_frente_final.mp4` (1080 × 1920, 30 cuadros por segundo, una repetición que se repite sin corte).

Opciones:

- `--vista lado` cambia a la cámara lateral.
- `--formato horizontal` hace 1920 × 1080.
- Sin `--ejercicio` hace los tres.
- `--gpu` activa OptiX con la tarjeta. Si no la encuentra, avisa y usa el procesador.

También puedes abrir `salida\<ejercicio>\<ejercicio>.blend` en Blender: viene con 1080 × 1920, 256 muestras, desenfoque de movimiento y la GPU elegida. Falta activar OptiX una vez en Edición > Preferencias > Sistema > Dispositivos de render de Cycles. Render > Renderizar animación deja los cuadros en una carpeta `cuadros` junto al archivo.

## Lo que se valida

`python tools/anim/validar.py` revisa en todos los cuadros:

- Sentadilla: barra sobre el medio pie, cadera al menos a la altura de la rodilla, rodillas en la dirección de la punta del pie, inclinación del tronco, flexión de tobillo y cadera, espalda neutra y centro de masa (cuerpo más barra) sobre el pie.
- Press de banca: antebrazo vertical abajo (vista lateral y frontal), contacto en la parte media-baja del pecho sin atravesarlo, barra sobre los hombros arriba, trayectoria en J, codos entre 45° y 70° del tronco, codos casi extendidos arriba, pausa en el pecho, llegada frenando, cadera y pies quietos.
- Prensa 45°: pelvis fija, flexión de cadera hasta 115°, rodillas sin bloquear arriba, rodilla entre 80° y 95° abajo, rodillas en la dirección del pie, flexión de tobillo y pies al ancho de caderas.
- En todos: largo de huesos constante, simetría, aceleraciones sin saltos y ritmo (bajada de 2 s, pausa de 0,3 s, subida de 1,2 s).

Los límites son criterios de entrenamiento escritos en `validar.py`, no una norma. Antes de publicar, un entrenador o kinesiólogo debe mirar los videos y ajustar lo que haga falta.

## Agregar un ejercicio

1. En `biomecanica.py`, una función que devuelva un `Ejercicio`: dónde van los pies, qué queda fijo, qué trayectoria sigue la carga y qué se resuelve en cada cuadro (rodillas y codos salen de `ik2`). Agrégala a `EJERCICIOS` con la clave de la app.
2. En `validar.py`, las reglas del ejercicio.
3. En `escena.py`, las cámaras en `VISTAS`; en `modelo.py`, el equipo si es nuevo.
4. `python tools/anim/validar.py <clave>` hasta que cumpla, y después una imagen de prueba con `generar.py --ejercicio <clave> --cuadro 70`.

## Sin Blender instalado

Para trabajar en el código sin abrir Blender:

```bash
python -m venv bl && bl/bin/pip install bpy==5.3.0
bl/bin/python tools/anim/generar.py --ejercicio squat --cuadro 70
```

Ese Blender corre solo con el procesador: sirve para revisar, no para el render final.

## Estilo

Maniquí de acero con placas por músculo; las del músculo principal se encienden en brasa `#ff6a1a` y las secundarias en `#6b3324`, los mismos tonos de la figura de la app. Sin personas realistas ni fotos de cuerpos. Equipos genéricos sin marca; los discos llevan tres agarres, como el ícono.
