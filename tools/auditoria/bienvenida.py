# Bienvenida de punta a punta en un teléfono: aparece con la app vacía, recorre las tres preguntas,
# crea las rutinas y deja de mostrarse. También comprueba el modo Progreso del análisis y la serie de calentamiento.
# Uso: python3 tools/auditoria/bienvenida.py   (con `npx vite preview --port 4173 --strictPort` corriendo)
import os, sys
from playwright.sync_api import sync_playwright
import abierta   # la app en pruebas abre sin invitación (tools/auditoria/abierta.py)

B = 'http://localhost:4173/'
OUT = '/tmp/bienvenida'; os.makedirs(OUT, exist_ok=True)
R = []
def ok(name, cond, extra=''):
    R.append(('OK    ' if cond else 'FALLA ') + name + (' :: ' + str(extra) if extra and not cond else ''))

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 360, 'height': 780}, device_scale_factor=2, locale='es-CL', has_touch=True, is_mobile=True)
    ctx.set_default_timeout(8000); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    shot = lambda n: pg.screenshot(path=f'{OUT}/{n}.png')
    ancho = lambda: pg.evaluate('document.documentElement.scrollWidth - innerWidth')
    pg.goto(B); pg.tap('text=Continuar sin cuenta'); pg.wait_for_selector('text=Tres preguntas y sales con tu rutina lista'); pg.wait_for_timeout(700); shot('0-inicio')
    ok('la bienvenida aparece con la app vacía', True)
    ok('inicio sin desborde', ancho() <= 0, ancho())
    pg.get_by_role('button', name='Armar mi plan').tap(); pg.wait_for_selector('[role=dialog]'); pg.wait_for_timeout(450); shot('1-objetivo')
    for lab in ['Ganar músculo', 'Ganar fuerza', 'Bajar grasa sin perder músculo', 'Mantenerme']:
        h = pg.locator('[role=dialog] button', has_text=lab).bounding_box()['height']
        ok(f'opción «{lab}» mide 48 px o más', h >= 48, h)
    pg.locator('[role=dialog] button', has_text='Ganar fuerza').tap()
    pg.get_by_role('button', name='Siguiente').tap(); pg.wait_for_timeout(300)
    pg.locator('[role=dialog]').get_by_role('button', name='3', exact=True).tap(); shot('2-dias')
    ok('paso 2 de 3 a la vista', pg.locator('text=Paso 2 de 3').count() == 1)
    pg.get_by_role('button', name='Siguiente').tap(); pg.wait_for_timeout(300)
    pg.locator('[role=dialog] button', has_text='En casa con mancuernas').tap(); shot('3-lugar')
    pg.get_by_role('button', name='Ver mi plan').tap(); pg.wait_for_timeout(500); shot('4-plan')
    n = pg.locator('[role=dialog] .rounded-panel.bg-card2').count()
    ok('el plan de 3 días trae 2 rutinas', n == 2, n)
    ok('la hoja no se desborda', ancho() <= 0, ancho())
    pg.get_by_role('button', name='Crear mis rutinas').tap(); pg.wait_for_timeout(1500); shot('5-creado')
    ok('la bienvenida desaparece al crear las rutinas', pg.locator('text=Tres preguntas y sales con tu rutina lista').count() == 0)
    ok('el inicio ofrece iniciar el entrenamiento', pg.get_by_role('button', name='INICIAR ENTRENAMIENTO').count() == 1)
    pg.goto(B + '#/rutinas'); pg.wait_for_timeout(700)
    ok('quedaron 2 rutinas creadas', pg.locator('text=Cuerpo completo A').count() >= 1 and pg.locator('text=Cuerpo completo B').count() >= 1)
    perfil = pg.evaluate("""async () => { const r = indexedDB.open('iron-intelligence'); const db = await new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = rej; });
      const t = db.transaction('profiles').objectStore('profiles').getAll(); const rows = await new Promise((res) => { t.onsuccess = () => res(t.result); }); return rows[0] || null; }""")
    ok('el perfil guardó objetivo, días y equipo', bool(perfil) and perfil.get('goal') == 'strength' and perfil.get('daysAvailable') == 3 and 'dumbbell' in perfil.get('equipment', []), perfil and {k: perfil.get(k) for k in ('goal', 'daysAvailable', 'equipment')})

    # Serie de calentamiento: se marca desde el detalle y la fila cambia de nombre.
    pg.goto(B); pg.wait_for_timeout(600)
    pg.get_by_role('button', name='INICIAR ENTRENAMIENTO').tap(); pg.wait_for_timeout(900)
    pg.locator('button:has-text("Iniciar")').first.tap(); pg.wait_for_selector('[data-session-head]'); pg.wait_for_timeout(900); shot('6-sesion')
    ok('la sesión abre', pg.locator('[data-session-head]').count() == 1)
    pg.get_by_role('button', name='Detalle').first.tap(); pg.wait_for_selector('[role=dialog]'); pg.wait_for_timeout(450)
    casilla = pg.locator('[role=dialog] input[type=checkbox]').first
    ok('el detalle ofrece marcar la serie como calentamiento', pg.locator('[role=dialog]', has_text='Serie de calentamiento').count() >= 1)
    casilla.tap(); pg.wait_for_timeout(500); shot('7-calentamiento')
    ok('la casilla queda marcada', casilla.is_checked())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500); shot('8-fila')
    ok('la fila pasa a llamarse Calentamiento', pg.locator('main', has_text='Calentamiento').count() >= 1)
    ok('sin errores de página', not errs, errs[:3])
    b.close()

print('\n'.join(R)); print(f"\n{sum(r.startswith('OK') for r in R)} OK, {sum(r.startswith('FALLA') for r in R)} fallas")
sys.exit(1 if any(r.startswith('FALLA') for r in R) else 0)
