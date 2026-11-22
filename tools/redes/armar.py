# Arma las piezas del aviso de lanzamiento (publicación 1080x1350 e historia 1080x1920) con pantallas reales de la app.
# Requiere `npx vite preview --port 4173 --strictPort` corriendo sobre un `npm run build` reciente.
# Uso: python3 tools/redes/armar.py   ->  tienda/redes-aviso-post.png y tienda/redes-aviso-historia.png
import datetime, os, shutil
from playwright.sync_api import sync_playwright
B = 'http://localhost:4173/'; TMP = 'dist/_piezas/'; AQUI = os.path.dirname(os.path.abspath(__file__))
os.makedirs(TMP, exist_ok=True)
for f in ('aviso-post.html', 'aviso-historia.html'): shutil.copy(os.path.join(AQUI, f), TMP + f)
GPU = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=GPU)
    ctx = b.new_context(viewport={'width': 393, 'height': 560}, device_scale_factor=3, locale='es-CL', timezone_id='America/Santiago', has_touch=True, is_mobile=True)
    ctx.set_default_timeout(15000); ctx.route('https://*.supabase.co/**', lambda r: r.abort())
    pg = ctx.new_page(); pg.clock.install(time=datetime.datetime(2026, 11, 20, 18, 30, 0))
    pg.add_init_script("localStorage.setItem('ii_lang','es')")
    pg.goto(B); pg.tap('text=Continuar sin cuenta'); pg.wait_for_selector('text=CREAR RUTINA')
    pg.goto(B + '#/perfil'); pg.wait_for_timeout(700)
    pg.locator('[aria-label="Archivo de copia de seguridad"]').set_input_files('tools/auditoria/demo.json')
    pg.locator('[role=dialog]').last.locator('button:has-text("Restaurar")').tap()
    pg.wait_for_selector('[role=status]:has-text("registros restaurados")', timeout=10000); pg.wait_for_timeout(800)
    pg.evaluate("localStorage.setItem('ii_hint_gestures','1')")
    # Inicio (historia)
    pg.goto(B + '#/'); pg.wait_for_timeout(1500); pg.evaluate("window.scrollTo({top:0, behavior:'instant'})"); pg.wait_for_timeout(300)
    pg.screenshot(path=TMP + 'inicio.png')
    # Sesión en curso con la recomendación (publicación)
    pg.goto(B + '#/entrenar'); pg.wait_for_timeout(1200)
    pg.locator('main button:has-text("Iniciar")').nth(3).tap(); pg.wait_for_selector('text=/0\\/\\d+ series/'); pg.wait_for_timeout(4000)
    pg.evaluate("window.scrollTo({top:0, behavior:'instant'})"); pg.wait_for_timeout(300)
    pg.screenshot(path=TMP + 'sesion.jpg', type='jpeg', quality=93)
    b.close()
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for html, w, h, out in (('aviso-post.html', 1080, 1350, 'tienda/redes-aviso-post.png'), ('aviso-historia.html', 1080, 1920, 'tienda/redes-aviso-historia.png')):
        pg = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1).new_page()
        pg.goto(B + '_piezas/' + html); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(700)
        pg.screenshot(path=out); print(out)
    b.close()
