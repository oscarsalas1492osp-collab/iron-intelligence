# Videos verticales para redes

Videos de 1080 × 1920 a 30 cuadros por segundo hechos con pantallas reales de la app: gancho en texto, escenas de la app
con su rótulo y marcas de toque, y cierre con la marca. No llevan música; se agrega al subir.

    npm run build && npx vite preview --port 4173 --strictPort &
    mkdir -p dist/_video && cp tools/video/composicion.html dist/_video/index.html
    python3 tools/video/capturar.py                                   # estados reales de la app → dist/_video/*.jpg y meta.json
    python3 tools/video/render.py tools/video/v1.json prueba 2,6,11   # cuadros sueltos para revisar antes de codificar
    python3 tools/video/render.py tools/video/v1.json video /tmp/v1.mp4
    # une las escenas (/tmp/v1.partes.json) con el demuxer concat y -c copy; después agrega la pista de sonido con -c:v copy

- `capturar.py` usa los datos de demostración (`tools/auditoria/demo.json`, sin nombre de persona) con la fecha fija del 20 de
  noviembre de 2026 y guarda la caja de cada control que se va a tocar.
- `composicion.html` dibuja todo a partir de `render(t)`: nada se mueve por su cuenta, así cada cuadro sale igual siempre.
- `v1.json` es el guion: gancho, escenas (`de`, `a`, `rotulo`, `estados`, `toques` con la caja del control en px de la app),
  cierre y `cortes` (un archivo por escena). `omitir` reutiliza escenas ya codificadas.
- Zonas libres: 250 px arriba y 340 px abajo, que es donde TikTok e Instagram ponen sus botones y textos.
