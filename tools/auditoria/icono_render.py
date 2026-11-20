# Renderiza cada SVG a PNG de 1024 px con Chrome (para que el texto use la fuente de la app).
import sys, base64
from playwright.sync_api import sync_playwright
font = base64.b64encode(open('/home/claude/iron-intelligence/node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2','rb').read()).decode()
names = sys.argv[1:]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width':1024,'height':1024})
    for n in names:
        svg = open(f'{n}.svg').read()
        pg.set_content(f'''<style>@font-face{{font-family:Archivo;src:url(data:font/woff2;base64,{font}) format("woff2");font-weight:100 900;font-stretch:62% 125%}}html,body{{margin:0;background:transparent}}svg{{display:block;width:1024px;height:1024px}}</style>{svg}''')
        pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(250)
        pg.screenshot(path=f'{n}.png', omit_background=True)
    b.close()
