# Funciones nuevas: ayudas de gimnasio, ciclo, plan, compartir, importar, medidas y paneles.
from playwright.sync_api import sync_playwright
import abierta   # la app en pruebas abre sin invitación (tools/auditoria/abierta.py)
B='http://localhost:4173/'
R=[]
def ok(name, cond, extra=''): R.append(('OK ' if cond else 'FALLA')+' '+name+(' :: '+str(extra)[:160] if not cond else ''))
STRONG='Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE\n2025-03-02 18:30:00,"Push Day",1h 5m,"Bench Press (Barbell)",1,80,8,0,0,,,8\n2025-03-02 18:30:00,"Push Day",1h 5m,"Bench Press (Barbell)",2,80,7,0,0,,,\n2025-03-04 18:30:00,"Leg Day",50m,"Squat (Barbell)",1,100,5,0,0,,,9\n'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':393,'height':800}, device_scale_factor=2, locale='es-CL', timezone_id='America/Santiago', has_touch=True, is_mobile=True, accept_downloads=True, permissions=['clipboard-read','clipboard-write'])
    ctx.set_default_timeout(12000); ctx.route('https://*.supabase.co/**', lambda r: r.abort())
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    dlg=lambda: pg.locator('[role=dialog]').last
    toast=lambda t: pg.wait_for_selector(f'[role=status]:has-text("{t}")', timeout=8000)
    def go(path, wait=700): pg.goto(B+'#'+path); pg.wait_for_timeout(wait)
    pg.goto(B); pg.tap('text=Continuar sin cuenta'); pg.wait_for_selector('text=CREAR RUTINA')
    go('/perfil'); pg.locator('[aria-label="Archivo de copia de seguridad"]').set_input_files('tools/auditoria/demo.json'); dlg().locator('button:has-text("Restaurar")').tap(); toast('registros restaurados'); pg.evaluate("localStorage.setItem('ii_hint_gestures','1')"); pg.wait_for_timeout(800)
    # ciclo
    pg.locator('[aria-label="Entrenar por ciclos"]').tap(); pg.wait_for_selector('text=Semana 1 de 5'); ok('ciclo: se activa en la semana 1 de 5', True)
    # importar CSV
    open('/tmp/strong.csv','w').write(STRONG)
    pg.locator('[aria-label="Archivo CSV de otra app"]').set_input_files('/tmp/strong.csv'); dlg().locator('button:has-text("Importar")').tap(); toast('2 entrenamientos y 3 series importados'); ok('importar: historial de Strong', True)
    pg.screenshot(path='/tmp/auditoria-out/n_perfil.png', full_page=True)
    # panel
    go('/', 2500); ok('panel: racha y ciclo visibles', pg.locator('text=/Racha: \\d+ semana/').count()==1 and pg.locator('main >> text=Semana 1 de 5').count()==1)
    with pg.expect_download() as d: pg.locator('button:has-text("Compartir semana")').tap()
    d.value.save_as('/tmp/auditoria-out/tarjeta_semana.png'); ok('compartir: tarjeta de la semana', True)
    # plan
    go('/rutinas'); n0=pg.locator('main a[href*="/rutinas/"], main [href*="rutinas/"]').count()
    pg.locator('button:has-text("Generar plan según mi perfil")').tap(); dlg().locator('button[aria-pressed]:has-text("4")').tap(); pg.wait_for_timeout(300)
    ok('plan: 4 días propone Torso y Pierna', dlg().locator('text=Torso A').count()==1 and dlg().locator('text=Pierna B').count()==1)
    dlg().locator('button:has-text("Crear estas rutinas")').tap(); toast('4 rutinas creadas'); ok('plan: crea las rutinas', True)
    # compartir rutina por enlace
    pg.locator('main a, main button', has_text='Torso B').first.tap(); pg.wait_for_selector('button:has-text("Compartir rutina")'); pg.locator('button:has-text("Compartir rutina")').tap(); toast('Enlace copiado')
    url=pg.evaluate('navigator.clipboard.readText()'); ok('compartir: enlace de rutina', '#/importar?r=' in url, url[:80])
    pg.goto(url.replace(url.split('#')[0], B)); pg.wait_for_selector('text=Te compartieron esta rutina'); pg.screenshot(path='/tmp/auditoria-out/n_importar.png')
    pg.locator('button:has-text("Añadir a mis rutinas")').tap(); toast('Rutina añadida'); pg.wait_for_selector('button:has-text("Iniciar esta rutina")'); ok('compartir: la rutina recibida se añade', True)
    go('/importar?r=roto'); ok('compartir: enlace dañado avisa', pg.locator('text=El enlace no es válido').count()==1)
    # historial: tarjeta de sesión
    go('/historial', 900); pg.locator('main button', has_text='kg').first.tap(); pg.wait_for_selector('button:has-text("Compartir este entrenamiento")')
    with pg.expect_download() as d: pg.locator('button:has-text("Compartir este entrenamiento")').tap()
    d.value.save_as('/tmp/auditoria-out/tarjeta_sesion.png'); ok('compartir: tarjeta del entrenamiento', True); pg.keyboard.press('Escape')
    # análisis y medidas
    go('/analisis', 1500); ok('análisis: constancia, equilibrio y niveles', all(pg.locator(f'main >> text={t}').count()>=1 for t in ['Constancia','Equilibrio (4 semanas)','Niveles de fuerza']))
    pg.locator('text=Niveles de fuerza').scroll_into_view_if_needed(); pg.screenshot(path='/tmp/auditoria-out/n_analisis.png')
    go('/recuperacion', 900); pg.locator('[aria-label="Cintura"]').fill('84,5'); pg.locator('[aria-label="Brazo"]').fill('38'); pg.locator('button:has-text("Guardar medidas de hoy")').tap(); toast('Medidas guardadas')
    ok('medidas: se guardan y se muestran', pg.locator('text=/Cintura 84.5/').count()>=1)
    # entrenamiento: ayudas y récord
    go('/entrenar'); pg.locator('main button:has-text("Iniciar")').first.tap(); pg.wait_for_selector('text=Entrenamiento en curso'); pg.wait_for_timeout(900)
    pg.locator('[aria-label="Calentamiento y calculadora de discos"]').tap(); pg.wait_for_selector('[role=dialog] >> text=Calentamiento')
    ok('ayudas: series de calentamiento', dlg().locator('button[aria-pressed] .num').count()>=2)
    dlg().locator('button:has-text("Discos")').tap(); pg.wait_for_selector('text=Por cada lado'); pg.screenshot(path='/tmp/auditoria-out/n_discos.png'); ok('ayudas: discos por lado', True); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    w=pg.locator('main input[aria-label^="Peso serie 1"]'); w.tap(); pg.keyboard.type('400'); pg.locator('main [aria-label="Completar serie 1"]').tap(); toast('Nuevo récord de carga'); ok('récord: aviso al superar la carga', True)
    # valoración tras la sesión
    pg.wait_for_timeout(700); pg.locator('button:has-text("Finalizar")').first.tap(); dlg().locator('button:has-text("Finalizar")').tap(); pg.wait_for_selector('text=¿Cuánto trabajo sintió cada músculo?')
    g=pg.locator('[role=dialog] [role=group][aria-label^="Trabajo de"]').first; g.locator('button:has-text("Poco")').tap(); pg.wait_for_timeout(500)
    ok('valoración: se guarda la respuesta por músculo', g.locator('button:has-text("Poco")').get_attribute('aria-pressed')=='true')
    pg.screenshot(path='/tmp/auditoria-out/n_valoracion.png'); pg.keyboard.press('Escape')
    # modo entrenador: sin cuenta no aparece en el menú y la pantalla lo explica
    go('/mas'); ok('entrenador: oculto sin cuenta', pg.locator('main >> text=Entrenador').count()==0)
    go('/entrenador'); ok('entrenador: pide una cuenta', pg.locator('text=Necesitas una cuenta').count()==1)
    print('\n'.join(R)); print('errores JS', errs); b.close()
