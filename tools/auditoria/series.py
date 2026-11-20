from playwright.sync_api import sync_playwright
B='http://localhost:4173/'
R=[]
def ok(name, cond, extra=''): R.append(('OK ' if cond else 'FALLA')+' '+name+(' :: '+str(extra) if extra and not cond else ''))
def state(pg):
    return pg.evaluate('''() => [...document.querySelectorAll('main [aria-label^="Completar"], main [aria-label^="Desmarcar"], main button[aria-label$="tocar para editar"]')].map(e => {
      const row = e.closest('.rounded-panel') || e; const ins=[...row.querySelectorAll('input')].map(i=>i.value);
      const done = e.getAttribute('aria-label').includes('completada');
      return done ? 'HECHA '+e.innerText.replace(/\\n/g,' ') : (row.querySelector('[aria-label^="RIR"]')?'ABIERTA ':'pend ')+ins.join('x') })''')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':393,'height':800}, device_scale_factor=2, locale='es-CL', has_touch=True, is_mobile=True)
    ctx.set_default_timeout(10000); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    dlg=lambda: pg.locator('[role=dialog]').last
    pg.goto(B); pg.tap('text=Continuar sin cuenta'); pg.wait_for_selector('text=CREAR RUTINA')
    pg.goto(B+'#/rutinas'); pg.wait_for_timeout(400); pg.locator('button:has-text("Crear rutina")').first.tap(); dlg().locator('input').fill('Pecho y triceps'); dlg().locator('button:has-text("Crear y añadir")').tap(); pg.wait_for_selector('text=Rutina vacía')
    for name in ['Press de banca con barra','Remo con barra','Curl de bíceps con barra']:
        pg.tap('button:has-text("Añadir ejercicio")'); dlg().locator('[aria-label="Buscar ejercicio"]').fill(name); dlg().locator(f'button:has-text("{name}")').first.tap(); pg.wait_for_timeout(300)
    pg.tap('button:has-text("Iniciar esta rutina")'); pg.wait_for_selector('text=/0\\/\\d+ series/'); pg.wait_for_timeout(600)
    # A) escribir 60 en la serie 1: las demás lo heredan
    w=pg.locator('main input[aria-label^="Peso serie 1"]'); w.tap(); pg.keyboard.type('60'); pg.wait_for_timeout(100)
    bx=pg.locator('main [aria-label="Completar serie 1"]').bounding_box(); x,y=bx['x']+bx['width']/2, bx['y']+bx['height']/2
    # B) doble toque en el mismo punto
    pg.touchscreen.tap(x,y); pg.wait_for_timeout(130); pg.touchscreen.tap(x,y); pg.wait_for_timeout(250); pg.touchscreen.tap(x,y); pg.wait_for_timeout(1200)
    st=state(pg); print(st)
    ok('triple toque completa solo la serie 1', st[0].startswith('HECHA 60 kg × 8') and st[1].startswith('ABIERTA') and st[2].startswith('pend'), st)
    ok('las series 2 y 3 heredan 60 kg', st[1]=='ABIERTA 60x8' and st[2]=='pend 60x8', st)
    ask=pg.locator('main [role=group][aria-label^="RIR de la serie 1"]')
    ok('pregunta el RIR de la serie ya guardada', ask.count()==1)
    pg.screenshot(path='/tmp/rep/a1.png')
    ask.locator("[aria-label^=\"RIR 2\"]").tap(); pg.wait_for_timeout(500)
    st=state(pg); ok('RIR marcado después de completar', 'RIR 2' in st[0] and pg.locator('main [role=group][aria-label^="RIR de la"]').count()==0, st)
    ok('descanso iniciado', pg.locator('[role=timer]').count()==1)
    # C) completar 2 y 3: no cambia de ejercicio solo
    pg.wait_for_timeout(500)
    pg.locator('main [aria-label="RIR 1"]').first.tap(); pg.wait_for_timeout(150)
    pg.locator("main [aria-label=\"Completar serie 2\"]").tap(); pg.wait_for_timeout(1200)
    pg.locator("main [aria-label=\"Completar serie 3\"]").tap(); pg.wait_for_timeout(1300)
    st=state(pg); print(st)
    ok('tras la última serie sigue en el mismo ejercicio', len(st)==3 and all(s.startswith('HECHA') for s in st) and pg.locator('main h2:has-text("Press de banca con barra")').count()==1, st)
    ok('pregunta el RIR de la última serie', pg.locator('main [role=group][aria-label^="RIR de la serie 3"]').count()==1)
    ok('ofrece pasar al siguiente', pg.locator('main button:has-text("Siguiente ejercicio")').count()==1)
    pg.screenshot(path='/tmp/rep/a2.png')
    pg.locator('main button:has-text("Siguiente ejercicio")').tap(); pg.wait_for_timeout(700)
    ok('siguiente ejercicio abre el remo', pg.locator('main h2:has-text("Remo con barra")').count()==1)
    # D) recargar: se queda en el ejercicio elegido
    pg.reload(); pg.wait_for_selector('text=/3\\/9 series/'); pg.wait_for_timeout(500)
    ok('al recargar sigue en el remo', pg.locator('main h2:has-text("Remo con barra")').count()==1)
    # E) botones en una línea
    for sel in ['main button:has-text("Copiar anterior")','main button:has-text("Añadir serie")','main button:has-text("Unir en biserie")','main button:has-text("Detalle")','main button:has-text("Técnica")']:
        h=pg.locator(sel).first.bounding_box()['height']; ok(f'botón en una línea: {sel[20:-2]}', h<=50, h)
    pg.locator('main [aria-label="Completar serie 1"]').tap(); pg.wait_for_timeout(800)
    h=pg.locator('main button:has-text("Igual a la 1")').first.bounding_box()['height']; ok('botón Igual a la 1 en una línea', h<=44, h)
    pg.screenshot(path='/tmp/rep/a3.png', full_page=True)
    print('\n'.join(R)); print('errores', errs)
    b.close()
