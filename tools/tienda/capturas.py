# Capturas de la ficha de Play Store (1080 x 1920): pantallas reales de la app con titular, sobre el fondo de la marca.
# Requiere `npx vite preview --port 4173 --strictPort` sobre un `npm run build` reciente.
# Uso: python3 tools/tienda/capturas.py [carpeta de salida]   (por defecto public/tienda)
import base64, datetime, io, os, sys
from playwright.sync_api import sync_playwright
from PIL import Image
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
sys.path.insert(0, os.path.join(RAIZ, 'tools', 'auditoria')); import abierta   # la app en pruebas abre sin invitación
B = 'http://localhost:4173/'
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'public', 'tienda'); os.makedirs(OUT, exist_ok=True)

# Titulares de la ficha: los mismos que ya están publicados; la 6 suma la figura de la rutina de hoy.
PIEZAS = [
    ('sesion', 'Registra cada serie en segundos', 'Peso, repeticiones y cercanía al fallo, con la carga sugerida a partir de tu última sesión.'),
    ('analisis', 'Tu volumen semanal, músculo por músculo', 'Series directas e indirectas sobre un mapa corporal en 3D.'),
    ('progresion', 'Mira cómo suben tus cargas', 'Progresión por ejercicio en peso, repeticiones, volumen y 1RM estimado.'),
    ('biserie', 'Biseries, triseries y dropsets', 'Une ejercicios arrastrándolos y registra el circuito por rondas.'),
    ('ejercicio', '448 ejercicios y 76 equipos', 'Técnica, errores frecuentes y músculos de cada movimiento.'),
    ('inicio', 'Sabes qué toca hoy', 'Rutina del día con los músculos que trabaja, recuperación y récords recientes al abrir la app.'),
]

def pantallas(pw):
    """Toma las pantallas a 360 x 780 con densidad 3 (1080 x 2340), con la fecha fija del 20 de noviembre."""
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 360, 'height': 780}, device_scale_factor=3, locale='es-CL', timezone_id='America/Santiago', has_touch=True, is_mobile=True)
    ctx.set_default_timeout(15000); ctx.route('https://*.supabase.co/**', lambda r: r.abort())
    pg = ctx.new_page(); pg.clock.install(time=datetime.datetime(2026, 11, 20, 18, 30, 0))
    pg.add_init_script("localStorage.setItem('ii_lang','es')")
    dlg = lambda: pg.locator('[role=dialog]').last
    top = lambda: pg.evaluate("window.scrollTo({top:0, behavior:'instant'})")
    out = {}
    def shot(name, wait=700):
        pg.wait_for_timeout(wait); out[name] = pg.screenshot(); print('pantalla', name)

    pg.goto(B); pg.wait_for_timeout(1200)
    if pg.locator('text=Continuar sin cuenta').count(): pg.tap('text=Continuar sin cuenta'); pg.wait_for_timeout(800)
    pg.goto(B + '#/perfil'); pg.wait_for_timeout(700)
    pg.locator('[aria-label="Archivo de copia de seguridad"]').set_input_files(os.path.join(RAIZ, 'tools', 'auditoria', 'demo.json'))
    dlg().locator('button:has-text("Restaurar")').tap()
    pg.wait_for_selector('[role=status]:has-text("registros restaurados")', timeout=10000)
    pg.evaluate("localStorage.setItem('ii_hint_gestures','1')"); pg.wait_for_timeout(3800)

    pg.goto(B); shot('inicio', 2500)
    pg.goto(B + '#/analisis'); shot('analisis', 3500)
    pg.goto(B + '#/historial'); pg.wait_for_timeout(900); pg.locator('main button:has-text("Progresión")').tap(); pg.wait_for_timeout(600)
    pg.locator('main select').first.select_option(label='Press de banca con barra'); shot('progresion', 1200)
    pg.goto(B + '#/ejercicios'); pg.wait_for_timeout(900); pg.locator('[aria-label="Buscar ejercicio"]').fill('Prensa de piernas'); pg.wait_for_timeout(700)
    pg.locator('main button', has_text='Prensa de piernas').first.tap(); shot('ejercicio', 2500)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.goto(B + '#/entrenar'); pg.wait_for_timeout(900); pg.locator('main [aria-label="Iniciar Torso B"]').tap()
    pg.wait_for_selector('text=/0\\/\\d+ series/'); pg.wait_for_timeout(2500)
    pg.locator('main [aria-label="Completar serie 1"]').tap(); pg.wait_for_timeout(1400)
    pg.locator('main [role=group][aria-label^="RIR de la serie 1"] [aria-label^="RIR 2"]').tap(); pg.wait_for_timeout(600)
    if pg.locator('[role=timer]').count(): pg.locator('[role=timer] button:has-text("Omitir")').tap()
    top(); shot('sesion', 1200)
    pg.locator('main button', has_text='Biserie').first.tap(); pg.wait_for_timeout(900); top(); shot('biserie', 1200)
    b.close()
    return out

HTML = '''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: Archivo; src: url(data:font/woff2;base64,{font}) format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; }}
html,body {{ margin:0; width:1080px; height:1920px; overflow:hidden; }}
body {{ background: radial-gradient(70% 34% at 0% 0%, rgb(255 110 30 / .30), transparent 70%), radial-gradient(60% 40% at 105% 38%, rgb(40 95 255 / .32), transparent 70%), #060914;
  color:#f2f6f6; font-family: Archivo, sans-serif; position: relative; }}
.marca {{ position:absolute; left:84px; top:84px; display:flex; align-items:center; gap:18px; }}
.marca img {{ width:64px; height:64px; border-radius:16px; }}
.marca b {{ display:block; font-size:30px; font-weight:800; letter-spacing:.06em; line-height:1; font-stretch:115%; }}
.marca span {{ display:block; font-size:17px; font-weight:600; letter-spacing:.32em; color:#949fb8; margin-top:6px; }}
h1 {{ position:absolute; left:84px; right:84px; top:200px; margin:0; font-size:78px; line-height:1.02; font-weight:800; font-stretch:112%; letter-spacing:-.01em; }}
p {{ position:absolute; left:84px; right:110px; top:{ptop}px; margin:0; font-size:33px; line-height:1.38; color:#c3cbe0; }}
.tel {{ position:absolute; left:130px; top:{ttop}px; width:820px; border-radius:64px; overflow:hidden;
  box-shadow: 0 0 0 3px rgb(195 215 255 / .22), 0 0 0 14px rgb(6 9 20 / .9), 0 0 0 16px rgb(195 215 255 / .10), 0 60px 120px -30px rgb(0 0 0 / .9); }}
.tel img {{ display:block; width:820px; }}
</style></head><body>
<div class="marca"><img src="data:image/svg+xml;base64,{icon}"><div><b>IRON</b><span>INTELLIGENCE</span></div></div>
<h1>{titulo}</h1><p>{texto}</p>
<div class="tel"><img src="data:image/png;base64,{img}"></div>
</body></html>'''

def componer(pw, shots):
    font = base64.b64encode(open(os.path.join(RAIZ, 'node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2'), 'rb').read()).decode()
    icon = base64.b64encode(open(os.path.join(RAIZ, 'public/icon.svg'), 'rb').read()).decode()
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1080, 'height': 1920}, device_scale_factor=1)
    for i, (name, titulo, texto) in enumerate(PIEZAS, 1):
        largo = len(titulo) > 22   # dos líneas de titular
        ptop = 200 + (2 if largo else 1) * 80 + 34
        ttop = 200 + 2 * 80 + 34 + 2 * 46 + 90   # el teléfono a la misma altura en las seis
        img = base64.b64encode(shots[name]).decode()
        pg.set_content(HTML.format(font=font, icon=icon, titulo=titulo, texto=texto, img=img, ptop=ptop, ttop=ttop)); pg.wait_for_timeout(400)
        im = Image.open(io.BytesIO(pg.screenshot())).convert('RGB')
        path = os.path.join(OUT, f'play-captura-{i}.png'); im.save(path, optimize=True); print('lista', path)
    b.close()

with sync_playwright() as pw:
    componer(pw, pantallas(pw))
