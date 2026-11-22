from playwright.sync_api import sync_playwright
import abierta   # la app en pruebas abre sin invitación (tools/auditoria/abierta.py)
B='http://localhost:4173/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, locale='es-CL'); ctx.set_default_timeout(30000); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto(B); pg.click('text=Continuar sin cuenta'); pg.wait_for_selector('text=CREAR RUTINA')
    pg.goto(B+'#/ejercicios'); pg.wait_for_selector('main .grid > button [aria-label="Ilustración del movimiento"]')
    n=pg.locator('main .grid > button [aria-label="Ilustración del movimiento"]').count(); print('iconos', n)
    import time; t=time.time()
    pg.wait_for_function('document.querySelectorAll(\'main .grid > button img[aria-label="Ilustración del movimiento"]\').length>=40', timeout=150000); print('40 figuras en', round(time.time()-t), 's')
    d1=pg.locator('main .grid > button img').nth(0).get_attribute('src'); d2=pg.locator('main .grid > button img').nth(2).get_attribute('src'); print('distintas', d1!=d2 and d1.startswith('data:image'))
    # recarga: deben salir de la memoria del dispositivo, sin redibujar
    pg.reload(); t=time.time(); pg.wait_for_function('document.querySelectorAll(\'main .grid > button img[aria-label="Ilustración del movimiento"]\').length>=40', timeout=20000); print('tras recargar, 40 figuras en', round(time.time()-t,1), 's')
    pg.fill('[aria-label="Buscar ejercicio"]','sentadilla con barra'); pg.click('main >> text=Sentadilla con barra'); pg.wait_for_selector('[role=dialog] canvas[aria-label="Ilustración del movimiento"]'); pg.wait_for_timeout(2500)
    grab='document.querySelector(\'[role=dialog] canvas[aria-label="Ilustración del movimiento"]\').toDataURL().slice(-400)'
    a=pg.evaluate(grab); pg.wait_for_timeout(5000); b2=pg.evaluate(grab); print('la ficha se anima', a!=b2)
    pg.keyboard.press('Escape'); pg.click('button:has-text("Equipamiento")'); pg.wait_for_selector('main section .grid > button [aria-label="Ilustración del movimiento"]'); print('equipamiento ok')
    print('errores', errs); b.close()
