# Captura estados reales de la app (datos de demostración) para el video 1. Cada estado: JPEG 1080 px de ancho + cajas de los controles.
import datetime, json
from playwright.sync_api import sync_playwright
B='http://localhost:4173/'; OUT='dist/_video/'
import os; os.makedirs(OUT, exist_ok=True)
meta={}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':360,'height':580}, device_scale_factor=3, locale='es-CL', timezone_id='America/Santiago', has_touch=True, is_mobile=True)
    ctx.set_default_timeout(15000); ctx.route('https://*.supabase.co/**', lambda r: r.abort())
    pg=ctx.new_page()
    pg.clock.install(time=datetime.datetime(2026,11,20,18,30,0))
    pg.add_init_script("localStorage.setItem('ii_lang','es')")
    def box(sel):
        l=pg.locator(sel)
        if l.count()==0: return None
        bb=l.first.bounding_box(); return [bb['x'],bb['y'],bb['width'],bb['height']] if bb else None
    def shot(name, boxes={}):
        pg.screenshot(path=OUT+name+'.jpg', type='jpeg', quality=92)
        meta[name]={k: box(v) for k,v in boxes.items()}
        print(name, meta[name])
    def scroll_to(sel, top):
        y=pg.locator(sel).first.bounding_box()['y']; pg.evaluate("(d) => window.scrollBy({top:d, behavior:'instant'})", y-top); pg.wait_for_timeout(350)
    pg.goto(B); pg.tap('text=Continuar sin cuenta'); pg.wait_for_selector('text=CREAR RUTINA')
    pg.goto(B+'#/perfil'); pg.wait_for_timeout(700)
    pg.locator('[aria-label="Archivo de copia de seguridad"]').set_input_files('tools/auditoria/demo.json')
    pg.locator('[role=dialog]').last.locator('button:has-text("Restaurar")').tap()
    pg.wait_for_selector('[role=status]:has-text("registros restaurados")', timeout=10000); pg.wait_for_timeout(800)
    pg.evaluate("localStorage.setItem('ii_hint_gestures','1')")
    pg.goto(B+'#/entrenar'); pg.wait_for_timeout(1200)
    pg.locator('main button:has-text("Iniciar")').nth(3).tap(); pg.wait_for_selector('text=/0\\/\\d+ series/'); pg.wait_for_timeout(4000)
    REC='main button:has-text("Peso sugerido")'
    shot('a1-arriba', {'rec': REC})
    # motivo de la recomendación
    pg.locator(REC).first.tap(); pg.wait_for_timeout(900)
    shot('a2-motivo', {})
    print('MOTIVO:', pg.locator('[role=dialog]').last.inner_text()[:600].replace('\n',' / ') if pg.locator('[role=dialog]').count() else pg.locator('main').inner_text()[200:900].replace('\n',' / '))
    if pg.locator('[role=dialog]').count(): pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    else: pg.locator(REC).first.tap(); pg.wait_for_timeout(500)
    # registro de la serie
    scroll_to('main [data-set]', 132)
    B1={'masReps':'main [aria-label^="Aumentar Repeticiones serie 1"]','rir2':'main [aria-label="RIR 2"]','ok':'main [aria-label="Completar serie 1"]','set':'main [data-set]'}
    shot('b1-serie', B1)
    pg.locator(B1['masReps']).tap(); pg.wait_for_timeout(350); shot('b2-reps', B1)
    pg.locator(B1['rir2']).first.tap(); pg.wait_for_timeout(350); shot('b3-rir', B1)
    pg.locator(B1['ok']).tap(); pg.wait_for_timeout(1500); shot('b4-hecha', {'timer':'[role=timer]','set':'main [data-set]'})
    pg.wait_for_timeout(2000); shot('b5-descanso', {'timer':'[role=timer]'})
    # progresión
    pg.goto(B+'#/historial'); pg.wait_for_timeout(900)
    pg.locator('main button:has-text("Progresión")').first.tap(); pg.wait_for_timeout(1200)
    sel=pg.locator('main select').first
    print('opciones:', sel.evaluate("e => [...e.options].map(o=>o.textContent).slice(0,12)"))
    try: sel.select_option(label='Press inclinado con barra'); pg.wait_for_timeout(1200)
    except Exception as e: print('sin esa opción', str(e)[:80])
    shot('c1-progresion', {'chart':'main .recharts-wrapper','tab1rm':'main button:has-text("1RM")'})
    pg.locator('main button:has-text("1RM")').first.tap(); pg.wait_for_timeout(1200)
    shot('c2-1rm', {'chart':'main .recharts-wrapper'})
    b.close()
json.dump(meta, open(OUT+'meta.json','w'))
