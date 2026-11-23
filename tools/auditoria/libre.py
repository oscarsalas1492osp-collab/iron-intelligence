# Entrenamiento libre (sin rutina) de punta a punta, con toques de dedo: iniciar, agregar ejercicios, anotar,
# finalizar, cancelar y descartar. Comprueba que cada botón del cierre quede a la vista, lejos del borde de
# abajo y que responda al toque.
# Uso: python3 tools/auditoria/libre.py   (con `npx vite preview --port 4173 --strictPort` corriendo)
import os, sys
from playwright.sync_api import sync_playwright
import abierta   # la app en pruebas abre sin invitación (tools/auditoria/abierta.py)

B = 'http://localhost:4173/'
OUT = '/tmp/libre'; os.makedirs(OUT, exist_ok=True)
R = []
def ok(name, cond, extra=''):
    R.append(('OK    ' if cond else 'FALLA ') + name + (' :: ' + str(extra) if extra and not cond else ''))

HIT = '''(sel) => { const d=[...document.querySelectorAll('[role=dialog]')].pop(); const root=d||document;
  const b=[...root.querySelectorAll('button')].find(x => x.innerText.trim()===sel); if(!b) return null;
  const r=b.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2; const t=document.elementFromPoint(cx,cy);
  return {x:cx,y:cy,top:r.top,bottom:r.bottom,h:r.height,vh:innerHeight,hit:!!t&&(t===b||b.contains(t)),over:t?t.tagName+'.'+String(t.className).slice(0,60):null}; }'''

def run(pw, w, h, tag):
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, locale='es-CL', has_touch=True, is_mobile=True)
    ctx.set_default_timeout(8000); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and errs.append('consola: ' + m.text[:160]))   # sin red en la prueba: se ignoran las cargas fallidas
    dlg = lambda: pg.locator('[role=dialog]').last
    shot = lambda n: pg.screenshot(path=f'{OUT}/{tag}-{n}.png')
    def tap_at(label):
        i = pg.evaluate(HIT, label); assert i, f'no está el botón {label}'
        pg.touchscreen.tap(i['x'], i['y']); return i

    labels = lambda: pg.evaluate("() => [...[...document.querySelectorAll('[role=dialog]')].pop().querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean)")
    def finalizar():
        pg.tap('[data-session-head] button:has-text("Finalizar")'); pg.wait_for_selector('[role=dialog]'); pg.wait_for_timeout(450)
    def botones(donde):
        for lab in labels():
            i = pg.evaluate(HIT, lab)
            ok(f'{tag} {donde}: «{lab}» recibe el toque', i['hit'], i)
            ok(f'{tag} {donde}: «{lab}» a 88 px o más del borde de abajo', i['vh'] - i['bottom'] >= 88, f"queda a {round(i['vh']-i['bottom'])} px")
            ok(f'{tag} {donde}: «{lab}» mide 48 px o más de alto', i['h'] >= 48, i['h'])
    en_sesion = lambda: pg.locator('[data-session-head]').count() == 1

    pg.goto(B); pg.tap('text=Continuar sin cuenta'); pg.wait_for_timeout(900)
    pg.goto(B + '#/entrenar'); pg.wait_for_selector('text=Entrenamiento libre'); pg.wait_for_timeout(300); shot('1-inicio')

    # 1) Iniciar libre: llega a la sesión vacía, con su nombre completo y la invitación a agregar el primer ejercicio.
    pg.tap('button:has-text("Entrenamiento libre")'); pg.wait_for_selector('[data-session-head]'); pg.wait_for_timeout(500); shot('2-vacia')
    ok(f'{tag} sesión libre abierta y vacía', pg.locator('text=Añade tu primer ejercicio').count() == 1)
    nombre = pg.evaluate("() => { const e=document.querySelector('[data-session-head] .font-bold'); return {t:e.innerText, corta: e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1}; }")
    ok(f'{tag} el nombre de la sesión se lee completo', nombre['t'] == 'Entrenamiento libre' and not nombre['corta'], nombre)

    # 2) Finalizar sin nada anotado: solo seguir o anular, y los dos responden.
    finalizar(); shot('3-cierre-vacio'); labs = labels()
    ok(f'{tag} sin series no se ofrece guardar', 'Guardar entrenamiento' not in labs and 'Seguir entrenando' in labs and 'Anular entrenamiento' in labs, labs)
    botones('cierre vacío')
    tap_at('Seguir entrenando'); pg.wait_for_timeout(450)
    ok(f'{tag} «Seguir entrenando» cierra la pregunta y deja la sesión abierta', pg.locator('[role=dialog]').count() == 0 and en_sesion())
    finalizar(); tap_at('Anular entrenamiento'); pg.wait_for_timeout(700)
    ok(f'{tag} anular una sesión vacía la cierra de un toque', not en_sesion() and pg.locator('[role=dialog]').count() == 0, pg.url)

    # 3) Otra sesión libre: agregar un ejercicio y anotar una serie.
    pg.goto(B + '#/entrenar'); pg.wait_for_selector('text=Entrenamiento libre'); pg.tap('button:has-text("Entrenamiento libre")'); pg.wait_for_selector('[data-session-head]'); pg.wait_for_timeout(400)
    pg.tap('main button:has-text("Añadir ejercicio")'); pg.wait_for_selector('[role=dialog]'); pg.wait_for_timeout(450); shot('4-buscador')
    pad = pg.evaluate("() => parseFloat(getComputedStyle([...document.querySelectorAll('[role=dialog]')].pop().children[1]).paddingBottom)")
    ok(f'{tag} las hojas dejan 48 px o más libres abajo', pad >= 48, pad)
    dlg().locator('[aria-label="Buscar ejercicio"]').fill('Press de banca con barra')
    dlg().locator('button:has-text("Press de banca con barra")').first.tap(); pg.wait_for_selector('text=/0\\/\\d+ series/'); pg.wait_for_timeout(700); shot('5-ejercicio')
    ok(f'{tag} el ejercicio agregado queda en pantalla', pg.locator('main h2:has-text("Press de banca con barra")').count() == 1)
    wgt = pg.locator('main input[aria-label^="Peso serie 1"]'); wgt.tap(); pg.keyboard.type('60'); pg.wait_for_timeout(150)
    pg.locator('main [aria-label="Completar serie 1"]').tap(); pg.wait_for_timeout(1300)
    ok(f'{tag} la serie 1 queda hecha', pg.locator('main [data-set][data-state=done]').count() == 1)
    ok(f'{tag} parte el descanso', pg.locator('[role=timer]').count() == 1)

    # 4) Finalizar con series pendientes y con el descanso corriendo: guardar, seguir o anular.
    finalizar(); shot('6-cierre-pendientes'); labs = labels()
    ok(f'{tag} con series hechas ofrece guardar, seguir y anular', labs[-3:] == ['Guardar entrenamiento', 'Seguir entrenando', 'Anular entrenamiento'], labs)
    ok(f'{tag} avisa que lo pendiente no se guarda', dlg().locator('text=/Llevas 1 de 3 series en .*Las series sin hacer no se guardan/').count() == 1)
    botones('cierre con pendientes')
    tap_at('Seguir entrenando'); pg.wait_for_timeout(450)
    ok(f'{tag} tras seguir, la serie hecha sigue ahí', pg.locator('main [data-set][data-state=done]').count() == 1 and en_sesion())

    # 5) Anular con series hechas: pide un segundo toque, se puede volver atrás y al confirmar no queda nada.
    finalizar(); tap_at('Anular entrenamiento'); pg.wait_for_timeout(450); shot('7-anular')
    ok(f'{tag} anular con series pide confirmar', labels()[-2:] == ['Sí, anular', 'Volver'] and en_sesion(), labels())
    botones('confirmar anular')
    tap_at('Volver'); pg.wait_for_timeout(350)
    ok(f'{tag} «Volver» regresa a las tres salidas', 'Guardar entrenamiento' in labels())
    tap_at('Anular entrenamiento'); pg.wait_for_timeout(450); tap_at('Sí, anular'); pg.wait_for_timeout(800)
    ok(f'{tag} anular cierra la sesión', not en_sesion() and pg.locator('[role=dialog]').count() == 0)
    pg.goto(B + '#/historial'); pg.wait_for_timeout(600)
    ok(f'{tag} lo anulado no aparece en el historial', pg.locator('main >> text=Entrenamiento libre').count() == 0)
    pg.goto(B + '#/entrenar'); pg.wait_for_timeout(500)
    ok(f'{tag} después de anular se puede iniciar otro', pg.locator('button:has-text("Entrenamiento libre")').count() == 1)

    # 6) Otra sesión libre, ahora guardada: llega al detalle del historial.
    pg.tap('button:has-text("Entrenamiento libre")'); pg.wait_for_selector('[data-session-head]'); pg.wait_for_timeout(400)
    pg.tap('main button:has-text("Añadir ejercicio")'); dlg().locator('[aria-label="Buscar ejercicio"]').fill('Remo con barra'); dlg().locator('button:has-text("Remo con barra")').first.tap(); pg.wait_for_timeout(800)
    pg.locator('main input[aria-label^="Peso serie 1"]').tap(); pg.keyboard.type('50'); pg.wait_for_timeout(150)
    pg.locator('main [aria-label="Completar serie 1"]').tap(); pg.wait_for_timeout(1300)
    # Una pregunta cualquiera de la app (quitar el ejercicio) usa la misma tarjeta: también lejos del borde.
    pg.locator('main button:has-text("Quitar este ejercicio de la sesión")').scroll_into_view_if_needed(); pg.locator('main button:has-text("Quitar este ejercicio de la sesión")').tap(); pg.wait_for_selector('[role=dialog]'); pg.wait_for_timeout(450); shot('8-pregunta')
    botones('pregunta de quitar ejercicio'); tap_at('Cancelar'); pg.wait_for_timeout(400)
    ok(f'{tag} «Cancelar» deja el ejercicio', pg.locator('main h2:has-text("Remo con barra")').count() == 1)
    pg.evaluate('scrollTo(0,0)'); pg.wait_for_timeout(200)
    finalizar(); tap_at('Guardar entrenamiento'); pg.wait_for_timeout(1000)
    ok(f'{tag} guardar lleva al detalle en el historial', '/historial' in pg.url and pg.locator('text=Remo con barra').count() >= 1, pg.url); shot('9-guardado')
    ok(f'{tag} sin errores de la app', not errs, errs)
    b.close()

with sync_playwright() as pw:
    for (w, h, tag) in [(393, 800, '393'), (360, 640, '360')]:
        try: run(pw, w, h, tag)
        except Exception as e: R.append(f'FALLA {tag} el recorrido se cortó :: {str(e)[:300]}')
print('\n'.join(R))
sys.exit(1 if any(r.startswith('FALLA') for r in R) else 0)
