# Capturas reales de la app para la sección «Así se usa» de la página (public/web/img/uso/*.webp).
# Requiere `npx vite preview --port 4173 --strictPort` corriendo sobre un `npm run build` reciente.
# Uso: python3 tools/web/capturas.py [carpeta de salida]   (por defecto public/web/img/uso)
import datetime, io, os, sys
from playwright.sync_api import sync_playwright
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'auditoria')); import abierta   # la app en pruebas abre sin invitación
B = 'http://localhost:4173/'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/web/img/uso'; os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    # 360 x 720: la misma proporción 1:2 del marco de teléfono de la página.
    ctx = b.new_context(viewport={'width': 360, 'height': 720}, device_scale_factor=2, locale='es-CL', timezone_id='America/Santiago', has_touch=True, is_mobile=True)
    ctx.set_default_timeout(15000); ctx.route('https://*.supabase.co/**', lambda r: r.abort())
    pg = ctx.new_page(); pg.clock.install(time=datetime.datetime(2026, 11, 20, 18, 30, 0))
    pg.add_init_script("localStorage.setItem('ii_lang','es')")
    dlg = lambda: pg.locator('[role=dialog]').last
    def shot(name, at=None, sel=None, up=36):
        """Recorte 4:5 (720 x 900) de la pantalla. `at`: 'top', 'bottom' o los píxeles desde arriba; `sel`: parte en ese elemento."""
        pg.wait_for_timeout(500)
        im = Image.open(io.BytesIO(pg.screenshot())).convert('RGB'); W, H = im.size; h = W * 5 // 4
        if sel:
            y = int(pg.locator(sel).first.bounding_box()['y'] * 2) - up          # el elemento arriba, con un respiro
        else:
            y = at if isinstance(at, int) else (H - h if at == 'bottom' else 0)
        y = max(0, min(H - h, y))
        im.crop((0, y, W, y + h)).save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=80, method=6); print(name, y)
    top = lambda: pg.evaluate("window.scrollTo({top:0, behavior:'instant'})")

    pg.goto(B); pg.tap('text=Continuar sin cuenta'); pg.wait_for_selector('text=CREAR RUTINA')
    pg.goto(B + '#/perfil'); pg.wait_for_timeout(700)
    pg.locator('[aria-label="Archivo de copia de seguridad"]').set_input_files('tools/auditoria/demo.json')
    dlg().locator('button:has-text("Restaurar")').tap()
    pg.wait_for_selector('[role=status]:has-text("registros restaurados")', timeout=10000); pg.wait_for_timeout(800)
    pg.evaluate("localStorage.setItem('ii_hint_gestures','1')")

    pg.wait_for_timeout(3800)   # que se vaya el aviso de la restauración

    # 1) Armar la rutina: nombre, ejercicios de la biblioteca y objetivos de cada uno.
    pg.goto(B + '#/rutinas'); pg.wait_for_timeout(900)
    pg.locator('main button:has-text("Nueva")').first.tap(); dlg().locator('input').fill('Pecho y tríceps'); shot('rutina-nombre', 'bottom')
    dlg().locator('button:has-text("Crear y añadir")').tap(); pg.wait_for_selector('text=Rutina vacía')
    pg.tap('button:has-text("Añadir ejercicio")'); dlg().locator('[aria-label="Buscar ejercicio"]').fill('press'); pg.wait_for_timeout(600); shot('rutina-ejercicios', 150)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    for name in ['Press de banca con barra', 'Press inclinado con mancuernas', 'Cruce de poleas', 'Extensión de tríceps en polea']:
        pg.tap('button:has-text("Añadir ejercicio")'); dlg().locator('[aria-label="Buscar ejercicio"]').fill(name); pg.wait_for_timeout(500)
        dlg().locator('button', has_text=name).first.tap(); pg.wait_for_timeout(400)
    pg.locator('[aria-label="Editar objetivos"]').first.tap(); pg.wait_for_timeout(500); shot('rutina-objetivos', 280)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)

    # 2) En el gimnasio: marcar la serie, decir cuántas quedaban y dejar correr el descanso.
    pg.tap('button:has-text("Iniciar esta rutina")'); pg.wait_for_selector('text=/0\\/\\d+ series/'); pg.wait_for_timeout(2500)
    pg.evaluate("document.querySelector('main [data-set][data-state=active]').scrollIntoView({block:'center', behavior:'instant'})")
    shot('descanso-serie', sel='main [data-set][data-state=active]')
    pg.locator('main [aria-label="Completar serie 1"]').tap(); pg.wait_for_timeout(1600); shot('descanso-rir', 'top')
    pg.locator('main [role=group][aria-label^="RIR de la serie 1"] [aria-label^="RIR 2"]').tap(); pg.wait_for_timeout(700); shot('descanso-reloj', 'bottom')

    # 3) Técnicas: las cuatro explicadas, un dropset con su carga calculada y una biserie.
    pg.locator('main button[aria-label^="Serie 1 completada"]').tap(); dlg().locator('button:has-text("Alargar con una técnica")').tap(); pg.wait_for_timeout(600); shot('tecnicas-lista', 130)
    dlg().locator('[aria-label="Añadir Dropset"]').tap(); pg.wait_for_timeout(900); shot('tecnicas-dropset', 'top')
    pg.locator('[role=timer] button:has-text("Omitir")').tap() if pg.locator('[role=timer]').count() else None
    pg.locator('main button', has_text='3. Cruce de poleas').tap(); pg.wait_for_timeout(700)
    pg.locator('main [aria-label="Unir en biserie con otro ejercicio"]').tap(); pg.wait_for_timeout(500)
    dlg().locator('button', has_text='Extensión de tríceps en polea').first.tap(); pg.wait_for_timeout(4200); top(); shot('tecnicas-biserie', sel='main >> text=Haz los 2 ejercicios seguidos', up=110)   # sin el aviso «Biserie creada»
    b.close()
