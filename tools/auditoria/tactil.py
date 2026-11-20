from playwright.sync_api import sync_playwright
B='http://localhost:4173/'
res=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, locale='es-CL', has_touch=True, is_mobile=True)
    ctx.set_default_timeout(10000); pg=ctx.new_page(); cdp=ctx.new_cdp_session(pg)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    def touch(kind, x=None, y=None):
        pts=[] if kind=='touchEnd' else [{'x':x,'y':y,'id':1}]
        cdp.send('Input.dispatchTouchEvent', {'type':kind,'touchPoints':pts})
    def center(sel):
        bx=pg.locator(sel).first.bounding_box(); return bx['x']+bx['width']/2, bx['y']+bx['height']/2
    def hold_drag(src, dst, late=False):
        ax,ay=center(src); ax=min(370,max(20,ax)); touch('touchStart',ax,ay); pg.wait_for_timeout(560)
        if late: pg.wait_for_selector(dst); pg.wait_for_timeout(350)
        dx,dy=center(dst)
        for i in range(1,11): touch('touchMove', ax+(dx-ax)*i/10, ay+(dy-ay)*i/10); pg.wait_for_timeout(35)
        pg.wait_for_timeout(150); touch('touchEnd'); pg.wait_for_timeout(400)
    def swipe(x0,x1,y):
        touch('touchStart',x0,y)
        for i in range(1,7): touch('touchMove', x0+(x1-x0)*i/6, y+2); pg.wait_for_timeout(20)
        touch('touchEnd'); pg.wait_for_timeout(500)
    dlg=lambda: pg.locator('[role=dialog]').last
    pg.goto(B); pg.tap('text=Continuar sin cuenta'); pg.wait_for_selector('text=CREAR RUTINA')
    pg.goto(B+'#/rutinas'); pg.wait_for_timeout(400); pg.locator('button:has-text("Crear rutina")').first.tap(); dlg().locator('input').fill('Táctil'); dlg().locator('button:has-text("Crear y añadir")').tap(); pg.wait_for_selector('text=Rutina vacía')
    for name in ['Press de banca con barra','Remo con barra','Curl de bíceps con barra','Sentadilla con barra']:
        pg.tap('button:has-text("Añadir ejercicio")'); dlg().locator('[aria-label="Buscar ejercicio"]').fill(name); dlg().locator(f'button:has-text("{name}")').first.tap(); pg.wait_for_timeout(300)
    # 1) Arrastre táctil en la rutina
    y0=pg.evaluate('window.scrollY')
    hold_drag('main [data-drop-id]:has-text("Remo con barra")', 'main [data-drop-id]:has-text("Press de banca con barra")')
    ok=pg.locator('main section[aria-label="Biserie"]').count()==1
    res.append(('rutina: arrastre táctil crea biserie', ok, f'scroll {y0}->{pg.evaluate("window.scrollY")}'))
    # 2) Un toque corto sigue abriendo el ejercicio y un desplazamiento vertical no arrastra
    pg.locator('main [data-drop-id]', has_text='Curl de bíceps con barra').locator('button.min-w-0').tap(); opened=pg.locator('[role=dialog]').count()==1; pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    res.append(('rutina: toque corto abre objetivos', opened, ''))
    # 3) Sesión: deslizar y arrastrar con el dedo
    pg.tap('button:has-text("Iniciar esta rutina")'); pg.wait_for_selector('text=0/12 series'); pg.wait_for_selector('text=BISERIE')
    hint=pg.locator('text=Desliza a los lados').count()
    pg.wait_for_timeout(500); sy0=pg.evaluate('window.scrollY')
    ty=lambda: pg.locator('main [aria-label^="Objetivo:"]').first.bounding_box()['y']+20
    swipe(330,60,ty()); nxt=pg.locator('main h2:has-text("Curl de bíceps con barra")').count()==1
    print('NXT', nxt, pg.locator('main h2').all_inner_texts())
    pg.evaluate("window.__l=[];for(const t of ['touchstart','touchend','touchcancel','pointercancel'])document.addEventListener(t,e=>window.__l.push(t+':'+(e.target.tagName)+':'+(e.changedTouches?Math.round(e.changedTouches[0].clientX):'')),true)")
    pg.wait_for_timeout(600); yy=ty(); print('Y', yy); swipe(60,330,yy); print(pg.evaluate('window.__l.join(" ")'), pg.locator('main h2').all_inner_texts()); back=pg.locator('main h2:has-text("Remo con barra")').count()==1
    print('scroll al entrar', sy0)
    res.append(('sesión: deslizar con el dedo cambia de ejercicio y vuelve', nxt and back, f'pista inicial {hint}, pista después {pg.locator("text=Desliza a los lados").count()}'))
    # desplazamiento vertical no cambia de ejercicio
    touch('touchStart',200,600)
    for i in range(1,7): touch('touchMove',205,600-40*i); pg.wait_for_timeout(20)
    touch('touchEnd'); pg.wait_for_timeout(400)
    res.append(('sesión: desplazar en vertical no cambia de ejercicio', pg.locator('main h2:has-text("Remo con barra")').count()==1 and pg.evaluate('window.scrollY')>50, f'scrollY {pg.evaluate("window.scrollY")}'))
    pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(300)
    for r in res: print('OK' if r[1] else 'FALLA', '|', r[0], '|', r[2])
    pg.screenshot(path='/tmp/aud/T_pre.png'); print(pg.locator('main [data-drop-id]').all_inner_texts())
    pg.locator('main [data-drop-scroll] [data-drop-id]:has-text("Curl de bíceps con barra")').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    hold_drag('main [data-drop-scroll] [data-drop-id]:has-text("Curl de bíceps con barra")', '[data-drop-zone] [data-drop-id]:has-text("Sentadilla con barra")', late=True)
    res.append(('sesión: arrastre táctil sobre la lista de destinos crea biserie', pg.locator('main [data-drop-id]', has_text='Biserie: Sentadilla con barra').count()==1, ''))
    pg.screenshot(path='/tmp/aud/T_sesion.png')
    b.close()
for r in res: print('OK' if r[1] else 'FALLA', '|', r[0], '|', r[2])
print(errs)
