# Auditoría en navegador

Guiones de Playwright (Python) que recorren la app compilada como lo haría una persona en el teléfono.

    npm run build && npx vite preview --port 4173 --strictPort &
    python3 tools/auditoria/flujos.py      # 39 flujos completos (unos 5 minutos)
    python3 tools/auditoria/tactil.py      # gestos con el dedo
    python3 tools/auditoria/google.py      # inicio con Google y eliminación de cuenta (servidor simulado)
    python3 tools/auditoria/series.py      # registro de series: toques repetidos, RIR después de completar, valores heredados
    python3 tools/auditoria/pantallas.py   # 29 pantallas a 360 y 393 px: textos partidos, recortes, controles tapados
    python3 tools/auditoria/libre.py       # entrenamiento libre de punta a punta: cierre con guardar, seguir y anular; botones lejos del borde de abajo
    python3 tools/auditoria/figuras.py     # figuras de ejercicio: dibujo, memoria entre aperturas y animación

Usan Chrome con render por software, así que los tiempos de las figuras 3D no representan a un teléfono real.
Las capturas se escriben en /tmp.
