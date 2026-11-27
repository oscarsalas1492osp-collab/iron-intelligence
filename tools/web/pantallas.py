# Pantallas reales de la app para la portada y el recorrido de la página (public/web/img/*.webp y public/web/img/s/*.webp).
# Cada pantalla sale en dos tamaños: el normal y uno chico «-sm» para teléfonos (srcset en la página).
# Requiere `npx vite preview --port 4173 --strictPort` sobre un `npm run build` reciente.
# Uso: python3 tools/web/pantallas.py [carpeta de salida]   (por defecto public/web/img)
import datetime, io, os, sys
from playwright.sync_api import sync_playwright
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'auditoria')); import abierta   # la app en pruebas abre sin invitación
B = 'http://localhost:4173/'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/web/img'; os.makedirs(os.path.join(OUT, 's'), exist_ok=True)
GRANDE = {'serie', 'analisis', 'progresion'}   # además van en la portada a 702 x 1404

def guardar(png, name):
    im = Image.open(io.BytesIO(png)).convert('RGB')          # 1080 x 2160 (360 x 720 a densidad 3)
    for w, path in [(540, f's/{name}.webp'), (300, f's/{name}-sm.webp')] + ([(702, f'{name}.webp'), (420, f'{name}-sm.webp')] if name in GRANDE else []):
        im.resize((w, w * 2), Image.LANCZOS).save(os.path.join(OUT, path), 'WEBP', quality=80, method=6)
    print('lista', name)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 360, 'height': 720}, device_scale_factor=3, locale='es-CL', timezone_id='America/Santiago', has_touch=True, is_mobile=True)
    ctx.set_default_timeout(15000); ctx.route('https://*.supabase.co/**', lambda r: r.abort())
    pg = ctx.new_page(); pg.clock.install(time=datetime.datetime(2026, 11, 20, 18, 30, 0))
    pg.add_init_script("localStorage.setItem('ii_lang','es')")
    dlg = lambda: pg.locator('[role=dialog]').last
    def shot(name, wait=900): pg.wait_for_timeout(wait); guardar(pg.screenshot(), name)
    def scroll_to(text, up=90):
        pg.evaluate("([t, up]) => { const el = [...document.querySelectorAll('main h2, main h3, main p, main span')].find(e => e.textContent.trim().startsWith(t)); if (el) window.scrollTo({top: el.getBoundingClientRect().top + scrollY - up, behavior: 'instant'}); }", [text, up])

    pg.goto(B); pg.wait_for_timeout(1200)
    if pg.locator('text=Continuar sin cuenta').count(): pg.tap('text=Continuar sin cuenta'); pg.wait_for_timeout(800)
    pg.goto(B + '#/perfil'); pg.wait_for_timeout(700)
    pg.locator('[aria-label="Archivo de copia de seguridad"]').set_input_files('tools/auditoria/demo.json')
    dlg().locator('button:has-text("Restaurar")').tap()
    pg.wait_for_selector('[role=status]:has-text("registros restaurados")', timeout=10000)
    pg.evaluate("localStorage.setItem('ii_hint_gestures','1')"); pg.wait_for_timeout(3800)

    pg.goto(B); shot('inicio', 2500)
    scroll_to('Mapa muscular', 70); shot('mapa', 2500)
    pg.goto(B + '#/analisis'); shot('analisis', 3500)
    scroll_to('Series por grupo muscular', 70); shot('volumen', 1500)
    pg.goto(B + '#/historial'); shot('historial', 1200)
    pg.locator('main button:has-text("Progresión")').tap(); pg.wait_for_timeout(600)
    pg.locator('main select').first.select_option(label='Press de banca con barra'); shot('progresion', 1200)
    pg.locator('main button:has-text("Récords")').tap(); shot('records', 1000)
    pg.goto(B + '#/ejercicios'); shot('biblioteca', 1500)
    pg.locator('[aria-label="Buscar ejercicio"]').fill('Prensa de piernas'); pg.wait_for_timeout(700)
    pg.locator('main button', has_text='Prensa de piernas').first.tap(); shot('ficha', 2500)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.goto(B + '#/rutinas'); shot('rutinas', 1500)
    pg.goto(B + '#/entrenar'); pg.wait_for_timeout(900); pg.locator('main [aria-label="Iniciar Torso B"]').tap()
    pg.wait_for_selector('text=/0\\/\\d+ series/'); shot('ejercicio-en-curso', 3000)
    pg.locator('main [aria-label="Completar serie 1"]').tap(); pg.wait_for_timeout(1400)
    pg.locator('main [role=group][aria-label^="RIR de la serie 1"] [aria-label^="RIR 1"]').tap(); pg.wait_for_timeout(600)
    pg.evaluate("document.querySelector('main [data-set][data-state=active]').scrollIntoView({block:'center', behavior:'instant'})")
    shot('serie', 1500)
    if pg.locator('[role=timer]').count(): pg.locator('[role=timer] button:has-text("Omitir")').tap()
    pg.locator('main button', has_text='Biserie').first.tap(); pg.wait_for_timeout(900)
    pg.evaluate("window.scrollTo({top:0, behavior:'instant'})"); shot('biserie', 1200)
    b.close()
