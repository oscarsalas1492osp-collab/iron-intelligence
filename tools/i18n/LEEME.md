# Idiomas

La app está escrita en español. El inglés y el portugués salen de dos diccionarios, `src/i18n/en.json` y `src/i18n/pt.json`,
que van de texto en español a su traducción. El motor (`src/i18n/index.ts`) traduce cada texto que aparece en pantalla
(`src/i18n/dom.ts`) y los pocos que no pasan por la pantalla (avisos, tarjeta para compartir) con `tr()`.

## Agregar o cambiar textos

    node tools/i18n/extraer.mjs en,pt     # lista lo que falta: tools/i18n/pendiente.txt («número|texto»)
    # escribir tools/i18n/lotes/NN.txt con líneas «número|inglés|portugués»
    node tools/i18n/armar.mjs             # junta lotes y extras en los diccionarios

- Los números de un lote valen solo para el `pendiente.json` con que se escribió: aplicar los lotes y borrarlos antes de extraer de nuevo.
- `{*}` marca un valor (número, nombre de ejercicio). La traducción debe llevar la misma cantidad y en el mismo orden.
- `tools/i18n/extras.txt` guarda, como «español|inglés|portugués», lo que el extractor no ve: palabras sueltas en minúsculas
  y rótulos para lectores de pantalla que se arman por partes.
- Para dejar un texto sin traducir en pantalla (un nombre propio, el selector de idioma), poner `data-notr` en su elemento.

## Revisar

    npm run build && npx vite preview --port 4173 --strictPort &
    IDIOMAS=en,pt python3 tools/auditoria/pantallas.py    # cada pantalla en los tres idiomas, a 360 y 393 px
    node tools/i18n/revisar.mjs en                        # textos vistos en pantalla que siguen en español
    npx vitest run src/tests/i18n.test.ts                 # motor y diccionarios

## Límites conocidos

- Las fechas y los números se calculan al dibujar, así que el cambio de idioma recarga la app.
- Un nombre escrito por la persona que coincida con una palabra del español de la app se muestra traducido.
- Las traducciones no tienen revisión de un hablante nativo.
