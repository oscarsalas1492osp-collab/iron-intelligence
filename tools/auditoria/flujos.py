import json, traceback
from playwright.sync_api import sync_playwright, expect
B='http://localhost:4173/'
errors=[]; results=[]
def step(name, fn):
    try:
        fn(); results.append(('OK', name))
    except Exception as e:
        results.append(('FALLA', name, str(e).split('\n')[0][:300]))
        try: pg.screenshot(path=f'/tmp/aud/FALLA_{len(results)}.png')
        except Exception: pass
        try:
            # cerrar hojas abiertas para no arrastrar el fallo
            for _ in range(3):
                if pg.locator('[role=dialog]').count(): pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
        except Exception: pass
def go(path): pg.goto(B+'#'+path); pg.wait_for_timeout(350)
def shot(n): pg.screenshot(path=f'/tmp/aud/{n}.png')
def dlg(): return pg.locator('[role=dialog]').last
def toast(text): pg.wait_for_selector(f'[role=status]:has-text("{text}")', timeout=5000)

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, locale='es-CL', accept_downloads=True)
    ctx.set_default_timeout(12000)
    pg=ctx.new_page()
    _c=pg.click
    def _click(sel,*a,**k):
        _c(sel,*a,**k)
        if 'Completar serie' in sel or 'Desmarcar serie' in sel: pg.wait_for_timeout(600)
    pg.click=_click
    pg.on('console', lambda m: errors.append(m.text[:300]) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR '+str(e)[:300]))

    # ---------- A. Inicio de sesión ----------
    def a1():
        pg.goto(B); pg.wait_for_selector('text=Continuar sin cuenta'); shot('A_auth')
        pg.fill('input[type=email]','oscar@example.com'); pg.fill('input[type=password]','corta'); pg.click('button:has-text("Entrar")'); toast('al menos 8 caracteres')
    step('Auth: pantalla de inicio y validación de contraseña corta', a1)
    def a2():
        pg.fill('input[type=password]','contrasena-larga'); pg.click('button:has-text("Entrar")')
        pg.wait_for_selector('[role=status]', timeout=15000); errors.append('AUTH_TOAST: '+pg.locator('[role=status]').last.inner_text())
        pg.wait_for_selector('button:has-text("Entrar")')
    step('Auth: sin red muestra error y no se cuelga', a2)
    def a3():
        pg.click('text=Continuar sin cuenta'); pg.wait_for_selector('text=CREAR RUTINA')
        pg.reload(); pg.wait_for_selector('text=CREAR RUTINA')
    step('Auth: continuar sin cuenta y se recuerda al recargar', a3)

    # ---------- B. Perfil ----------
    def b1():
        go('/perfil'); pg.fill('input[placeholder="¿Cómo te llamas?"]','Oscar'); pg.keyboard.press('Tab'); pg.wait_for_timeout(300)
        pg.locator('label:has-text("Edad") input').fill('34'); pg.keyboard.press('Tab'); pg.wait_for_timeout(300)
        pg.locator('label:has-text("Altura") input').fill('176'); pg.keyboard.press('Tab'); pg.wait_for_timeout(300)
        pg.locator('label:has-text("Objetivo principal") select').select_option('strength'); pg.wait_for_selector('text=rangos bajos')
        pg.locator('label:has-text("Objetivo principal") select').select_option('hypertrophy')
        pg.click('button:has-text("Avanzado")'); pg.click('button:has-text("Pecho")'); pg.click('button:has-text("Polea")')
        pg.click('[aria-label="RIR con medios puntos"]'); pg.wait_for_timeout(500)
        pg.reload(); pg.wait_for_timeout(600)
        assert pg.input_value('input[placeholder="¿Cómo te llamas?"]')=='Oscar', 'nombre no persistió'
        assert pg.locator('label:has-text("Edad") input').input_value()=='34', 'edad no persistió: '+pg.locator('label:has-text("Edad") input').input_value()
        assert pg.locator('label:has-text("Altura") input').input_value()=='176', 'altura no persistió'
        assert pg.is_checked('[aria-label="RIR con medios puntos"]'), 'medios puntos no persistió'
        assert pg.get_attribute('button:has-text("Avanzado")','aria-pressed')=='true'
        assert pg.get_attribute('button:has-text("Pecho")','aria-pressed')=='true'
    step('Perfil: guardar datos y persistencia tras recargar', b1)
    def b2():
        pg.locator('label:has-text("Edad") input').fill('500'); pg.keyboard.press('Tab'); pg.wait_for_selector('[role=status]')
        pg.reload(); pg.wait_for_timeout(500)
        assert pg.locator('label:has-text("Edad") input').input_value()=='34', 'edad inválida quedó guardada o visible: '+pg.locator('label:has-text("Edad") input').input_value()
    step('Perfil: edad inválida se rechaza', b2)

    # ---------- C. Biblioteca ----------
    def c1():
        go('/ejercicios'); pg.fill('[aria-label="Buscar ejercicio"]','curl'); pg.wait_for_timeout(200)
        n=pg.locator('main button:has-text("Curl")').count(); assert n>=5, f'búsqueda curl: {n}'
        pg.fill('[aria-label="Buscar ejercicio"]',''); pg.click('button:has-text("Gemelos")'); pg.wait_for_timeout(200)
        assert pg.locator('text=Elevación de talones de pie').count()==1 and pg.locator('text=Press de banca con barra').count()==0
        pg.click('button:has-text("Todos")')
        pg.click('text=Press de pecho en máquina'); pg.wait_for_selector('text=Indicaciones técnicas'); pg.wait_for_selector('[role=dialog] canvas'); pg.wait_for_timeout(1200); shot('C_detalle')
        dlg().locator('button:has-text("Ajustar máquina")').click()
        dlg().locator('input[placeholder="Marca, modelo o ubicación"]').fill('Hammer fila 2')
        dlg().locator('[aria-label="Aumentar Incremento mínimo (kg)"]').click(click_count=10, delay=20)
        dlg().locator('button:has-text("Guardar")').click(); toast('Ejercicio guardado')
        pg.click('text=Press de pecho en máquina'); pg.wait_for_selector('text=Hammer fila 2'); pg.wait_for_selector('text=7.5 kg'); pg.keyboard.press('Escape')
    step('Biblioteca: búsqueda, filtros, detalle y ajuste de máquina/incremento', c1)
    def c2():
        go('/ejercicios'); pg.click('button:has-text("Nuevo")')
        dlg().locator('button:has-text("Guardar")').click(); toast('nombre es obligatorio')
        dlg().locator('input[placeholder="Ej.: Press de pecho Hammer"]').fill('Press Panatta')
        dlg().locator('button:has-text("Tríceps")').click()
        dlg().locator('[aria-label="Subir fotografía"]').set_input_files('/tmp/aud/foto.png'); dlg().locator('img[src^="data:image/jpeg"], img[src^="data:image/png"]').first.wait_for()
        dlg().locator('button:has-text("Guardar")').click(); toast('Ejercicio guardado')
        pg.fill('[aria-label="Buscar ejercicio"]','Panatta'); pg.wait_for_selector('main img[alt="Press Panatta"]'); pg.wait_for_selector('text=, propio')
        pg.click('main >> text=Press Panatta'); dlg().locator('button:has-text("Editar ejercicio")').click()
        dlg().locator('input[placeholder="Ej.: Press de pecho Hammer"]').fill('Press Panatta 2'); dlg().locator('button:has-text("Guardar")').click(); toast('Ejercicio guardado')
        pg.wait_for_selector('main >> text=Press Panatta 2')
    step('Biblioteca: crear ejercicio propio con foto, validar y editar', c2)

    # ---------- D. Rutinas ----------
    def d1():
        go('/rutinas'); pg.click('button:has-text("Crear rutina")'); dlg().locator('input').fill('Mi rutina'); dlg().locator('button:has-text("Crear y añadir")').click()
        pg.wait_for_selector('text=Rutina vacía')
        for name in ['Press de pecho en máquina','Extensión de tríceps en polea','Press Panatta 2']:
            pg.click('button:has-text("Añadir ejercicio")'); dlg().locator('[aria-label="Buscar ejercicio"]').fill(name); dlg().locator(f'button:has-text("{name}")').first.click(); pg.wait_for_timeout(300)
        assert pg.locator('text=3 ejercicios, 9 series').count()==1, 'conteo rutina'
        pg.click('button:has-text("Añadir ejercicio")'); assert dlg().locator('button:has-text("Press de pecho en máquina")').count()==0, 'picker no excluye los ya añadidos'; pg.keyboard.press('Escape')
        pg.locator('[aria-label="Bajar"]').first.click(); pg.wait_for_timeout(400)
        first=pg.locator('main .font-semibold.leading-tight').first.inner_text(); assert 'tríceps' in first.lower(), 'reordenar: '+first
        pg.locator('[aria-label="Editar objetivos"]').first.click()
        dlg().locator('[aria-label="Aumentar Series"]').click(); dlg().locator('[aria-label="Aumentar Reps mínimas"]').click(click_count=8, delay=20)
        assert dlg().locator('[aria-label="Reps máximas"]').input_value()=='18', 'rep máx no acompaña al mínimo: '+dlg().locator('[aria-label="Reps máximas"]').input_value()
        dlg().locator('button:has-text("Guardar")').click(); toast('Objetivos guardados'); pg.wait_for_selector('text=4 × 18–18')
        dow=['D','L','M','X','J','V','S']
        import datetime; today=dow[(datetime.datetime.now().weekday()+1)%7]
        pg.locator(f'main button[aria-pressed]:text-is("{today}")').click(); pg.wait_for_selector('text=1 por semana')
        pg.locator('label:has-text("Nombre") input').fill('Empuje A'); pg.keyboard.press('Tab'); pg.wait_for_selector('h1:has-text("Empuje A")'); shot('D_editor')
    step('Rutinas: crear, añadir ejercicios, reordenar, editar objetivos, días y nombre', d1)
    def d2():
        go('/rutinas'); pg.click('button:has-text("Añadir desde plantilla")'); dlg().locator('text=Torso / Pierna').click(); toast('creadas')
        pg.wait_for_selector('main >> text=Pierna'); assert pg.locator('main button:has-text("ejercicios")').count()==3
        pg.click('main button:has-text("Pierna")'); pg.click('button:has-text("Eliminar rutina")'); dlg().locator('button:has-text("Eliminar")').click()
        pg.wait_for_selector('h1:has-text("Rutinas")'); pg.wait_for_timeout(300); assert pg.locator('main button:has-text("ejercicios")').count()==2, 'no se eliminó la rutina'
    step('Rutinas: plantilla y eliminar rutina', d2)

    # ---------- E. Entrenamiento ----------
    def e1():
        go('/'); pg.wait_for_selector('text=Rutina de hoy'); pg.wait_for_selector('text=Empuje A'); shot('E_dashboard_programada')
        pg.click('button:has-text("INICIAR ENTRENAMIENTO")'); pg.wait_for_selector('text=Entrenamiento en curso'); pg.wait_for_selector('text=0/10 series')
    step('Entrenar: iniciar la rutina programada desde el panel', e1)
    def e2():
        w=pg.locator('[aria-label="Peso serie 1"]'); w.click(); w.fill('22,5'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
        assert w.input_value()=='22.5', 'peso tecleado: '+w.input_value()
        pg.click('[aria-label="RIR 2"]'); pg.wait_for_selector('text=Proximidad elevada al fallo')
        pg.click('text=Marcar 2.5'); pg.wait_for_selector('text=RIR 2.5 · quitar medio punto'); pg.wait_for_selector('text=RPE 7.5')
        pg.click('button:has-text("Detalle")')
        dlg().locator('select').select_option('technical'); pg.wait_for_timeout(300); dlg().locator('text=Llegó al fallo').wait_for()
        assert 'sí' in dlg().locator('p:has-text("Llegó al fallo")').inner_text(), 'fallo técnico no marca fallo'
        dlg().locator('textarea').fill('Molestia leve en el codo'); pg.keyboard.press('Tab'); pg.wait_for_timeout(300); pg.keyboard.press('Escape')
        pg.click('[aria-label="Completar serie 1"]'); pg.wait_for_selector('[role=timer]'); pg.wait_for_selector('text=1/10 series'); shot('E_serie1')
    step('Entrenar: peso tecleado con coma, RIR con medio punto, detalle (motivo y nota), completar', e2)
    def e3():
        t0=pg.locator('[role=timer] .text-2xl').inner_text(); pg.click('[aria-label="Sumar 15 segundos"]'); pg.wait_for_timeout(300)
        t1=pg.locator('[role=timer] .text-2xl').inner_text()
        def sec(t): m,s=t.split(':'); return int(m)*60+int(s)
        assert sec(t1)-sec(t0)>=13, f'+15 no suma: {t0}->{t1}'
        pg.click('[aria-label="Restar 15 segundos"]'); pg.reload(); pg.wait_for_selector('[role=timer]'); pg.wait_for_selector('text=1/10 series')
        pg.click('button:has-text("Omitir")'); pg.wait_for_timeout(300); assert pg.locator('[role=timer]').count()==0
    step('Entrenar: temporizador ±15 s, sobrevive a recarga, omitir', e3)
    def e4():
        pg.click('button:has-text("Igual a la 1")'); pg.wait_for_timeout(300); assert pg.locator('[aria-label="Peso serie 2"]').input_value()=='22.5'
        pg.click('[aria-label="RIR 1"]'); pg.wait_for_timeout(200); pg.click('[aria-label="Completar serie 2"]'); pg.wait_for_selector('text=2/10 series'); pg.click('button:has-text("Omitir")')
        pg.click('button:has-text("Añadir serie")'); pg.wait_for_selector('text=2/11 series')
        pg.click('button:has-text("Detalle")'); dlg().locator('button:has-text("Eliminar serie")').click(); pg.wait_for_selector('text=2/10 series')
        pg.click('[aria-label*="Serie 1 completada"]'); pg.click('[aria-label="Desmarcar serie 1"]'); pg.wait_for_selector('text=1/10 series')
        pg.click('[aria-label="Completar serie 1"]'); pg.wait_for_selector('text=2/10 series'); pg.click('button:has-text("Omitir")')
    step('Entrenar: copiar serie anterior, añadir/eliminar serie, desmarcar y volver a completar', e4)
    def e5():
        pg.locator('[aria-label^="Objetivo: 4 × 18–18"]').click(); dlg().locator('[aria-label="Disminuir Reps mínimas"]').click(click_count=8, delay=20); pg.wait_for_timeout(300); pg.keyboard.press('Escape')
        pg.wait_for_selector('[aria-label^="Objetivo: 4 × 10–18"]')
        pg.click('button:has-text("+ Ejercicio")'); dlg().locator('[aria-label="Buscar ejercicio"]').fill('Curl martillo'); dlg().locator('button:has-text("Curl martillo")').first.click()
        pg.wait_for_selector('h2:has-text("Curl martillo")'); pg.wait_for_selector('text=2/13 series')
        pg.click('text=Quitar este ejercicio de la sesión'); dlg().locator('button:has-text("Quitar")').click(); pg.wait_for_selector('text=2/10 series')
        pg.click('[aria-label="Pausar"]'); pg.wait_for_selector('text=En pausa'); a=pg.locator('[aria-label="Tiempo transcurrido"]').inner_text(); pg.wait_for_timeout(2200)
        assert pg.locator('[aria-label="Tiempo transcurrido"]').inner_text()==a, 'el cronómetro avanza en pausa'
        pg.click('[aria-label="Reanudar"]'); pg.wait_for_selector('text=Entrenamiento en curso')
    step('Entrenar: objetivo de hoy, añadir y quitar ejercicio, pausar y reanudar', e5)
    def finish_all(fill):
        ids=pg.locator('.no-scrollbar button[aria-pressed]').count()
        for i in range(ids):
            pg.locator('.no-scrollbar button[aria-pressed]').nth(i).click(); pg.wait_for_timeout(250)
            n=1
            while pg.locator(f'[aria-label="Completar serie {n}"]').count() or pg.locator(f'[aria-label*="Serie {n} completada"]').count():
                if pg.locator(f'[aria-label="Completar serie {n}"]').count():
                    fill(i,n)
                    pg.click(f'[aria-label="Completar serie {n}"]'); pg.wait_for_timeout(150)
                    if pg.locator('button:has-text("Omitir")').count(): pg.click('button:has-text("Omitir")')
                n+=1
        pg.click('button:has-text("Finalizar")'); dlg().locator('button:has-text("Finalizar")').click(); pg.wait_for_selector('text=Eliminar sesión')
    def e6():
        def fill(i,n):
            if pg.locator(f'[aria-label="Peso serie {n}"]').input_value()=='0':
                x=pg.locator(f'[aria-label="Peso serie {n}"]'); x.click(); x.fill('20'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
            pg.locator('[aria-label="RIR 1"]').click(); pg.wait_for_timeout(120)
        finish_all(fill); shot('E_detalle_sesion')
        assert pg.locator('text=FALLO').count()>=1, 'la serie con fallo técnico no se marca en el historial'
    step('Entrenar: completar el resto y finalizar → detalle en historial', e6)
    def e7():
        for k in range(2):
            pg.keyboard.press('Escape'); go('/entrenar'); pg.locator('main div.rounded-panel', has_text='Empuje A').locator('button:has-text("Iniciar")').click(); pg.wait_for_selector('text=Entrenamiento en curso'); pg.wait_for_timeout(300)
            if k==0:
                pg.wait_for_selector('text=Última sesión:'); assert 'sin registros' not in pg.locator('text=Última sesión:').first.locator('..').inner_text(), 'no muestra la sesión anterior'
                shot('E_segunda')
                assert pg.is_enabled('button:has-text("Copiar anterior")'); pg.click('button:has-text("Copiar anterior")'); toast('Series copiadas')
            def fill(i,n):
                for _ in range(k+1): pg.click(f'[aria-label="Aumentar Repeticiones serie {n}"]')
                pg.locator('[aria-label="RIR 2"]').click(); pg.wait_for_timeout(120)
            finish_all(fill)
        pg.keyboard.press('Escape')
    step('Entrenar: 2ª y 3ª sesión, muestra la anterior, copiar sesión anterior', e7)

    # ---------- G. Historial ----------
    def g1():
        go('/historial'); pg.wait_for_selector('text=3 sesiones registradas'); shot('G_cal')
        pg.locator('main button:has-text("Empuje A")').first.click(); dlg().locator('[aria-label="Editar serie 1"]').first.click()
        dlg().locator('[aria-label="Aumentar Reps"]').click(); dlg().locator('button:has-text("Guardar")').click(); toast('Serie actualizada')
        n0=pg.locator('[aria-label^="Editar serie"]').count()
        pg.locator('[aria-label="Editar serie 2"]').first.click(); dlg().locator('button:has-text("Eliminar")').click(); dlg().locator('button:has-text("Eliminar")').last.click(); pg.wait_for_timeout(500)
        n1=pg.locator('[aria-label^="Editar serie"]').count(); assert n1==n0-1, f'eliminar serie: {n0}->{n1}'
        pg.keyboard.press('Escape')
        pg.click('[aria-label="Mes anterior"]'); pg.wait_for_selector('text=Sin entrenamientos este mes'); pg.click('[aria-label="Mes siguiente"]')
        d=str(__import__('datetime').datetime.now().day); pg.locator(f'[aria-label^="{d}, 3 entrenamiento"]').click(); pg.wait_for_selector('text=Eliminar sesión'); pg.keyboard.press('Escape')
    step('Historial: calendario, detalle, editar y eliminar una serie', g1)
    def g2():
        pg.click('button:has-text("Progresión")'); pg.wait_for_selector('.recharts-line'); shot('G_prog')
        for m in ['Reps','Volumen','RIR','1RM','Peso']:
            pg.locator(f'main button[aria-pressed]:text-is("{m}")').click(); pg.wait_for_timeout(200); assert pg.locator('.recharts-line').count()==1, 'sin gráfico en '+m
        opts=pg.locator('main select option').count(); assert opts==3, f'ejercicios con historial: {opts}'
        pg.locator('main select').select_option(index=2); pg.wait_for_selector('.recharts-line')
        pg.click('button:has-text("Récords")'); assert pg.locator('main >> text=Mayor carga').count()==3; shot('G_pr')
    step('Historial: gráficos de progresión por métrica y récords', g2)

    # ---------- H. Análisis ----------
    def h1():
        go('/analisis'); pg.wait_for_selector('text=Series por grupo muscular'); pg.wait_for_timeout(600); shot('H_analisis')
        txt=pg.locator('[aria-label^="Pecho:"]').get_attribute('aria-label'); errors.append('VOL '+txt)
        tri=pg.locator('[aria-label^="Tríceps:"]').get_attribute('aria-label'); errors.append('VOL '+tri)
        pg.click('[aria-label^="Tríceps:"]'); pg.wait_for_selector('text=Últimas 8 semanas de tríceps')
        pg.click('[aria-label="Semana anterior"]'); pg.wait_for_selector('text=Semana pasada'); assert pg.locator('[aria-label^="Pecho: 0 directas"]').count()==1
        pg.click('[aria-label="Semana siguiente"]'); pg.wait_for_selector('text=Esta semana')
        assert pg.locator('text=mejora').count()+pg.locator('text=estable').count()+pg.locator('text=baja').count()>=1, 'sin tendencias con 3 sesiones'
    step('Análisis: volumen, distribución RIR, tendencias, navegación por semana', h1)

    # ---------- I. Recuperación ----------
    def i1():
        go('/recuperacion'); pg.click('[aria-label="Fatiga general: 5"]'); pg.click('[aria-label="Calidad del sueño: 1"]'); pg.click('[aria-label="Disminuir Horas de sueño"]', click_count=4, delay=20)
        pg.click('button:has-text("Guardar registro")'); toast('Recuperación registrada'); pg.wait_for_selector('text=Registro de hoy (guardado)')
        pg.click('[aria-label="Aumentar Peso de hoy (kg)"]', click_count=4, delay=20); pg.click('main button:has-text("Guardar"):not(:has-text("registro")):not(:has-text("medidas"))'); toast('Peso registrado'); pg.wait_for_selector('text=75.4 kg')
        pg.click('[aria-label="Aumentar Peso de hoy (kg)"]'); pg.click('main button:has-text("Guardar"):not(:has-text("registro")):not(:has-text("medidas"))'); pg.wait_for_selector('text=75.5 kg'); pg.wait_for_timeout(300)
        assert pg.locator('[aria-label^="Eliminar peso"]').count()==1, 'dos pesos el mismo día'
        pg.reload(); pg.wait_for_selector('text=Registro de hoy (guardado)'); assert pg.get_attribute('[aria-label="Fatiga general: 5"]','aria-pressed')=='true'; shot('I_recup')
        go('/'); pg.wait_for_selector('text=75.5 kg')
    step('Recuperación: registro diario, peso corporal (uno por día), persistencia y panel', i1)

    # ---------- J. Asistente ----------
    def j1():
        go('/asistente')
        from re import sub
        qs=pg.locator('.no-scrollbar button').all_inner_texts()
        for q in qs:
            pg.locator('.no-scrollbar button', has_text=q).click(); pg.wait_for_timeout(250)
        assert pg.locator('text=Basado en:').count()==len(qs), 'faltan respuestas'
        pg.fill('[aria-label="Pregunta al asistente"]','¿Estoy progresando en tríceps?'); pg.click('button:has-text("Preguntar")'); pg.wait_for_selector('text=Progreso en Tríceps')
        pg.fill('[aria-label="Pregunta al asistente"]','¿qué peso uso en Press de pecho en máquina?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
        errors.append('ASIST '+ ' | '.join(pg.locator('main .animate-rise').last.locator('li').all_inner_texts())[:400])
        shot('J_asistente')
    step('Asistente: las 8 preguntas rápidas y texto libre', j1)

    # ---------- L. Copias ----------
    def l1():
        go('/perfil')
        with pg.expect_download() as d: pg.click('button:has-text("Descargar copia completa")')
        d.value.save_as('/tmp/aud/backup.json'); j=json.load(open('/tmp/aud/backup.json')); errors.append('BACKUP '+str({k:len(v) for k,v in j['tables'].items()}))
        with pg.expect_download() as d: pg.click('button:has-text("Exportar series a CSV")')
        d.value.save_as('/tmp/aud/series.csv'); errors.append('CSV filas '+str(len(open('/tmp/aud/series.csv',encoding='utf-8-sig').read().strip().split('\n'))))
        pg.wait_for_selector('text=Última copia descargada')
        pg.locator('[aria-label="Archivo de copia de seguridad"]').set_input_files('/tmp/aud/backup.json'); dlg().locator('button:has-text("Restaurar")').click(); toast('registros restaurados')
        open('/tmp/aud/malo.json','w').write('{"x":1}'); pg.locator('[aria-label="Archivo de copia de seguridad"]').set_input_files('/tmp/aud/malo.json'); dlg().locator('button:has-text("Restaurar")').click(); toast('no es una copia')
    step('Datos: descargar copia JSON, CSV, restaurar y rechazar archivo inválido', l1)

    # ---------- K/M. Panel, navegación, escritorio, sin conexión ----------
    def k1():
        go('/'); pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_selector('text=/Buen[oa]s/'); pg.wait_for_selector('text=, Oscar'); pg.wait_for_selector('main canvas'); pg.wait_for_timeout(2500)
        pg.locator('main canvas').scroll_into_view_if_needed(); pg.evaluate('window.scrollBy(0,-120)'); pg.wait_for_timeout(300); box=pg.locator('main canvas').bounding_box(); pg.mouse.click(box['x']+box['width']*0.5, box['y']+box['height']*0.27); pg.wait_for_timeout(600)
        errors.append('TAP3D '+pg.locator('p[aria-live]').inner_text()[:90])
        pg.click('button:has-text("Espalda")'); pg.wait_for_timeout(1500); pg.wait_for_selector('button:has-text("Frente")'); pg.screenshot(path='/tmp/aud/K_dashboard.png', full_page=True)
        go('/mas'); n=pg.locator('main a').count(); assert n==6, f'enlaces en Más: {n}'
        for i in range(n):
            go('/mas'); pg.locator('main a').nth(i).click(); pg.wait_for_timeout(400); assert pg.locator('h1').count()>=1
        go('/ruta-inexistente'); pg.wait_for_selector('text=/Buen[oa]s/')
    step('Panel con datos, menú Más y ruta desconocida', k1)
    def m1():
        pg.set_viewport_size({'width':1366,'height':820}); go('/'); pg.wait_for_timeout(500); shot('M_desktop_dashboard')
        assert pg.locator('aside').is_visible(); assert 'Sin cuenta' in pg.locator('aside').inner_text(), 'etiqueta de sincronización engañosa: '+pg.locator('aside').inner_text()[-60:]; pg.click('aside >> text=Análisis'); pg.wait_for_selector('text=Series por grupo muscular'); pg.wait_for_timeout(500); shot('M_desktop_analisis')
        pg.click('aside >> text=Entrenar'); pg.locator('button:has-text("Iniciar")').first.click(); pg.wait_for_selector('text=Entrenamiento en curso'); pg.wait_for_timeout(400); shot('M_desktop_entrenar')
        pg.set_viewport_size({'width':390,'height':844})
    step('Escritorio: barra lateral y pantallas', m1)
    def n1():
        pg.wait_for_timeout(1500); ctx.set_offline(True); pg.reload(); pg.wait_for_selector('text=Entrenamiento en curso', timeout=10000)
        pg.click('[aria-label="RIR 3"]'); pg.wait_for_timeout(200); pg.click('[aria-label="Completar serie 1"]'); pg.wait_for_selector('[role=timer]')
        go('/historial'); pg.wait_for_selector('text=3 sesiones registradas'); go('/analisis'); pg.wait_for_selector('text=Series por grupo muscular')
        ctx.set_offline(False)
    step('Sin conexión: la app abre, registra series y carga pantallas con gráficos', n1)
    def n2():
        go('/entrenar'); pg.click('button:has-text("Omitir")') if pg.locator('button:has-text("Omitir")').count() else None
        pg.click('button:has-text("Finalizar")'); dlg().locator('button:has-text("Finalizar")').click(); pg.wait_for_selector('text=Eliminar sesión')
        dlg().locator('button:has-text("Eliminar sesión")').click(); dlg().locator('button:has-text("Eliminar sesión")').last.click(); toast('Sesión eliminada')
        pg.wait_for_selector('text=3 sesiones registradas')
        go('/ejercicios'); pg.fill('[aria-label="Buscar ejercicio"]','Panatta'); pg.click('main >> text=Press Panatta 2'); dlg().locator('button:has-text("Editar ejercicio")').click(); dlg().locator('button:has-text("Eliminar")').click(); dlg().locator('button:has-text("Eliminar")').last.click(); pg.wait_for_timeout(500)
        assert pg.locator('main >> text=Press Panatta 2').count()==0
        go('/historial'); pg.locator('main button:has-text("Empuje A")').first.click(); pg.wait_for_selector('text=Ejercicio eliminado'); shot('N_ej_eliminado'); pg.keyboard.press('Escape')
        go('/entrenar'); pg.locator('main div.rounded-panel', has_text='Empuje A').locator('button:has-text("Iniciar")').click(); pg.wait_for_selector('text=0/7 series')
        assert pg.locator('.no-scrollbar button[aria-pressed]').count()==2, 'la sesión incluye un ejercicio eliminado'
        pg.click('button:has-text("Finalizar")'); dlg().locator('button:has-text("Descartar")').click(); toast('Sesión descartada')
    step('Eliminar sesión; eliminar ejercicio propio conserva el historial', n2)
    # ---------- P. Catálogo ampliado ----------
    def lbl(t): pg.wait_for_selector(f'main p[aria-live]:has-text("{t}")', timeout=5000)
    def chip(group, name): pg.locator(f'main [aria-label="{group}"] button', has_text=name).first.click(); pg.wait_for_timeout(250)
    def p1():
        go('/ejercicios'); pg.wait_for_selector('text=448 ejercicios y 76 equipos'); lbl('448 ejercicios')
        assert pg.locator('main .grid > button').count()==40, 'paginación inicial'
        pg.click('button:has-text("Mostrar más")'); pg.wait_for_timeout(300); assert pg.locator('main .grid > button').count()==120, 'mostrar más'
        pg.fill('[aria-label="Buscar ejercicio"]','hip thrust'); pg.wait_for_timeout(300); n=pg.locator('main .grid > button').count(); assert n>=6, f'búsqueda por nombre en inglés: {n}'
        pg.fill('[aria-label="Buscar ejercicio"]','gluteo discos'); pg.wait_for_timeout(300); pg.wait_for_selector('main >> text=Hip thrust en máquina de discos')
        pg.fill('[aria-label="Buscar ejercicio"]','')
        chip('Filtrar por implemento','Pesa rusa'); lbl('23 de 448'); chip('Filtrar por implemento','Todo el equipo')
        chip('Filtrar por tipo de entrenamiento','Potencia'); lbl('20 de 448'); chip('Filtrar por tipo de entrenamiento','Todo tipo')
        chip('Filtrar por músculo','Cuello'); lbl('5 de 448'); pg.wait_for_selector('main >> text=Cuello en máquina de cuatro direcciones')
        chip('Filtrar por músculo','Aductores'); pg.wait_for_selector('main >> text=Aducción de cadera en máquina'); first=pg.locator('main .grid > button .font-semibold').first.inner_text()
        assert 'aducci' in first.lower() or 'copenhague' in first.lower() or 'cosaca' in first.lower(), 'el principal no va primero: '+first
        chip('Filtrar por músculo','Todos')
        pg.fill('[aria-label="Buscar ejercicio"]','péndulo'); pg.click('main >> text=Sentadilla péndulo'); pg.wait_for_selector('[role=dialog] >> text=Indicaciones técnicas'); pg.wait_for_selector('[role=dialog] canvas'); pg.wait_for_timeout(1500)
        assert dlg().locator('text=Máquina de discos').count()>=1; shot('P_detalle_pendulo'); pg.keyboard.press('Escape')
        pg.fill('[aria-label="Buscar ejercicio"]','tibial'); pg.click('main >> text=Flexión dorsal en máquina de discos'); pg.wait_for_selector('[role=dialog] canvas'); pg.wait_for_timeout(1500); shot('P_detalle_tibial'); pg.keyboard.press('Escape')
        pg.fill('[aria-label="Buscar ejercicio"]',''); pg.wait_for_timeout(200); pg.screenshot(path='/tmp/aud/P_biblioteca.png')
    step('Catálogo: 448 ejercicios, paginación, búsqueda por otros nombres y filtros nuevos', p1)
    def p2():
        go('/ejercicios'); pg.click('button:has-text("Equipamiento")'); pg.wait_for_selector('text=Fabricantes y líneas vigentes'); pg.screenshot(path='/tmp/aud/P_equipamiento.png')
        pg.fill('[aria-label="Buscar equipamiento"]','hammer'); pg.wait_for_timeout(300); n=pg.locator('main section .grid > button').count(); assert n>=25, f'máquinas con modelos Hammer: {n}'
        pg.fill('[aria-label="Buscar equipamiento"]','péndulo'); pg.wait_for_timeout(300); pg.click('main section >> text=Sentadilla péndulo')
        dlg().locator('text=Matrix Magnum Pendulum Squat').wait_for(); dlg().locator('text=Carga de discos').wait_for(); pg.wait_for_timeout(1200); shot('P_maquina')
        dlg().locator('button:has-text("Sentadilla péndulo")').click(); pg.wait_for_selector('[role=dialog] >> text=Indicaciones técnicas'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        pg.fill('[aria-label="Buscar equipamiento"]',''); chip('Filtrar por zona','Funcional'); pg.click('main section >> text=Trineo')
        dlg().locator('button:has-text("Ver los 4 ejercicios con trineo")').click(); lbl('4 de 448'); pg.wait_for_selector('main >> text=Empuje de trineo')
    step('Equipamiento: buscar por marca, ficha con modelos y músculos, saltar a los ejercicios', p2)
    def p3():
        go("/rutinas"); pg.click("button:has-text(\"Nueva\")"); dlg().locator("input").fill("Zona media"); dlg().locator('button:has-text("Crear y añadir")').click(); pg.wait_for_selector('text=Rutina vacía')
        for name in ['Plancha frontal','Paseo del granjero','Cargada de potencia']:
            pg.click('button:has-text("Añadir ejercicio")'); dlg().locator('[aria-label="Buscar ejercicio"]').fill(name); dlg().locator(f'button:has-text("{name}")').first.click(); pg.wait_for_timeout(300)
        pg.wait_for_selector('text=3 × 30–60 s'); pg.wait_for_selector('text=3 × 20–40 m'); pg.wait_for_selector('text=4 × 3–5')
        pg.locator('[aria-label="Editar objetivos"]').first.click(); dlg().locator('[aria-label="Aumentar Segundos máximos"]').click(); pg.wait_for_timeout(300); dlg().locator('button', has_text='Guardar').click() if dlg().locator('button', has_text='Guardar').count() else pg.keyboard.press('Escape')
        go('/entrenar'); pg.locator('main div.rounded-panel', has_text='Zona media').locator('button:has-text("Iniciar")').click(); pg.wait_for_selector('text=0/10 series')
        v=pg.locator('[aria-label="Segundos serie 1"]').input_value(); assert v=='30', 'segundos iniciales: '+v
        pg.click('[aria-label="Aumentar Segundos serie 1"]'); pg.wait_for_timeout(300); assert pg.locator('[aria-label="Segundos serie 1"]').input_value()=='35', 'paso de 5 s'
        pg.wait_for_selector('text=Segundos'); pg.click('[aria-label="RIR 2"]'); pg.click('[aria-label="Completar serie 1"]'); pg.wait_for_selector('text=1/10 series')
        pg.click('button:has-text("Omitir")') if pg.locator('button:has-text("Omitir")').count() else None
        pg.wait_for_selector('[aria-label="Serie 1 completada, tocar para editar"] >> text=× 35 s'); shot('P_sesion_tiempo')
        pg.click('button:has-text("Finalizar")'); dlg().locator('button:has-text("Finalizar")').click(); pg.wait_for_selector('text=Eliminar sesión'); pg.keyboard.press('Escape')
    step('Tiempo y distancia: objetivos en segundos y metros, serie anotada en segundos', p3)

    # ---------- Q. Iconos por ejercicio y figura según el perfil ----------
    def q1():
        go('/ejercicios'); pg.wait_for_selector('main .grid > button [aria-label="Ilustración del movimiento"]')
        n=pg.locator('main .grid > button [aria-label="Ilustración del movimiento"]').count(); assert n==40, f'iconos en la lista: {n}'
        pg.wait_for_function('document.querySelectorAll(\'main .grid > button img[aria-label="Ilustración del movimiento"]\').length>=40', timeout=20000)
        d1=pg.locator('main .grid > button img').nth(0).get_attribute('src'); d2=pg.locator('main .grid > button img').nth(2).get_attribute('src'); assert d1!=d2 and d1.startswith('data:image'), 'los iconos no difieren entre ejercicios'
        pg.screenshot(path='/tmp/aud/Q_lista.png')
        pg.fill('[aria-label="Buscar ejercicio"]','sentadilla con barra'); pg.click('main >> text=Sentadilla con barra'); pg.wait_for_selector('[role=dialog] canvas[aria-label="Ilustración del movimiento"]'); pg.wait_for_timeout(1500)
        grab='document.querySelector(\'[role=dialog] canvas[aria-label="Ilustración del movimiento"]\').toDataURL().length+"|"+document.querySelector(\'[role=dialog] canvas[aria-label="Ilustración del movimiento"]\').toDataURL().slice(-400)'
        a=pg.evaluate(grab); pg.wait_for_timeout(700); b2=pg.evaluate(grab); assert a!=b2 and int(a.split('|')[0])>5000, 'la figura de la ficha no se anima'
        pg.wait_for_timeout(1500); shot('Q_ficha'); pg.keyboard.press('Escape')
        pg.click('button:has-text("Equipamiento")'); pg.wait_for_selector('main section .grid > button [aria-label="Ilustración del movimiento"]'); pg.screenshot(path='/tmp/aud/Q_equipos.png')
    step('Iconos: una figura distinta por ejercicio, animada en la ficha, también en equipamiento', q1)
    def q2():
        go('/perfil'); pg.locator('[aria-label="Figura del mapa muscular"] button', has_text='Femenina').click(); pg.wait_for_timeout(300)
        assert pg.evaluate('localStorage.getItem("ii_figure")')=='female'
        go('/'); pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_selector('main canvas'); pg.wait_for_timeout(3500); pg.screenshot(path='/tmp/aud/Q_panel_f.png')
        pg.locator('main canvas').scroll_into_view_if_needed(); pg.evaluate('window.scrollBy(0,-120)'); pg.wait_for_timeout(300); box=pg.locator('main canvas').bounding_box(); pg.mouse.click(box['x']+box['width']*0.5, box['y']+box['height']*0.27); pg.wait_for_timeout(600)
        errors.append('TAP3D_F '+pg.locator('p[aria-live]').inner_text()[:60])
        go('/perfil'); pg.locator('[aria-label="Figura del mapa muscular"] button', has_text='Automática').click(); pg.wait_for_timeout(200)
        assert pg.evaluate('localStorage.getItem("ii_figure")') is None
        pg.locator('label:has-text("Sexo") select').select_option('f'); pg.wait_for_timeout(500)
        go('/'); pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_selector('main canvas'); pg.wait_for_timeout(3000); pg.screenshot(path='/tmp/aud/Q_panel_auto_f.png')
        go('/perfil'); pg.locator('label:has-text("Sexo") select').select_option('m'); pg.wait_for_timeout(400)
        go('/'); pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_selector('main canvas'); pg.wait_for_timeout(3000); pg.screenshot(path='/tmp/aud/Q_panel_m.png')
    step('Figura: femenina o masculina según el perfil o la elección manual', q2)

    # ---------- R. Biseries, técnicas avanzadas, gestos y ancho del peso ----------
    def hold_drag(src_sel, dst_sel, late=False):
        a=pg.locator(src_sel).first.bounding_box()
        ax,ay=min(380,max(10,a['x']+a['width']/2)),a['y']+a['height']/2
        pg.mouse.move(ax,ay); pg.mouse.down(); pg.wait_for_timeout(520)
        if late: pg.wait_for_selector(dst_sel); pg.wait_for_timeout(350)
        d=pg.locator(dst_sel).first.bounding_box(); dx,dy=d['x']+d['width']/2,d['y']+d['height']/2
        for i in range(1,9): pg.mouse.move(ax+(dx-ax)*i/8, ay+(dy-ay)*i/8); pg.wait_for_timeout(40)
        pg.wait_for_timeout(120); pg.mouse.up(); pg.wait_for_timeout(300)
    def swipe(dx):
        pg.evaluate('''(dx) => { const el = document.querySelector('main h2'); const r = el.getBoundingClientRect(); const x0 = dx < 0 ? 320 : 60, y = r.top + 8;
          const mk = (x) => new Touch({ identifier: 7, target: el, clientX: x, clientY: y });
          el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [mk(x0)], targetTouches: [mk(x0)], changedTouches: [mk(x0)] }));
          el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [mk(x0 + dx)] })); }''', dx); pg.wait_for_timeout(450)
    def fits(label):
        return pg.evaluate('(l) => { const el = document.querySelector(`[aria-label="${l}"]`); return el.scrollWidth <= el.clientWidth + 1; }', label)
    def r0():
        if pg.locator('text=Continuar sin cuenta').count()==0: pg.goto(B)
        if pg.locator('text=Continuar sin cuenta').count(): pg.click('text=Continuar sin cuenta')
        go('/rutinas'); pg.locator('button:has-text("Crear rutina"), button:has-text("Nueva")').first.click(); dlg().locator('input').fill('Avanzado'); dlg().locator('button:has-text("Crear y añadir")').click(); pg.wait_for_selector('text=Rutina vacía')
        for name in ['Press de banca con barra','Remo con barra','Curl de bíceps con barra']:
            pg.click('button:has-text("Añadir ejercicio")'); dlg().locator('[aria-label="Buscar ejercicio"]').fill(name); dlg().locator(f'button:has-text("{name}")').first.click(); pg.wait_for_timeout(300)
        pg.wait_for_selector('text=3 ejercicios, 9 series')
    step('Preparación: rutina con tres ejercicios', r0)
    def r1():
        hold_drag('main [data-drop-id]:has-text("Remo con barra")', 'main [data-drop-id]:has-text("Press de banca con barra")'); toast('Biserie creada')
        sec=pg.locator('main section[aria-label="Biserie"]'); sec.wait_for(); assert sec.locator('[data-drop-id]').count()==2
        assert 'Press de banca' in sec.locator('[data-drop-id]').nth(0).inner_text() and 'Remo con barra' in sec.locator('[data-drop-id]').nth(1).inner_text()
        pg.locator('main [data-drop-id]', has_text='Curl de bíceps con barra').locator('[aria-label="Editar objetivos"]').click()
        dlg().locator('select[aria-label="Unir en biserie con"]').select_option(index=1); toast('Triserie creada'); pg.wait_for_selector('main section[aria-label="Triserie"]'); shot('R_rutina_triserie')
        pg.click('[aria-label="Separar Curl de bíceps con barra de la triserie"]'); toast('Ejercicio separado'); pg.wait_for_selector('main section[aria-label="Biserie"]')
        pg.reload(); pg.wait_for_selector('main section[aria-label="Biserie"]'); shot('R_rutina_biserie')
        pg.click('[aria-label="Bajar biserie"]'); pg.wait_for_timeout(400); first=pg.locator('main [data-drop-id]').first.inner_text(); assert 'Curl' in first, 'la biserie no se movió en bloque: '+first
        pg.click('[aria-label="Subir biserie"]'); pg.wait_for_timeout(400)
    step('Rutina: arrastrar para biserie, triserie por menú, separar, mover en bloque y persistir', r1)
    def r2():
        go('/entrenar'); pg.locator('main div.rounded-panel', has_text='Avanzado').locator('button:has-text("Iniciar")').click(); pg.wait_for_selector('text=0/9 series')
        pg.wait_for_selector('main >> text=1. Biserie: Press de banca con barra + Remo con barra'); pg.wait_for_selector('text=Ronda 1 de 3'); pg.wait_for_selector('text=BISERIE')
        w='Peso serie 1 de Press de banca con barra'
        for v in ['122,5','247,5','1000']:
            el=pg.locator(f'[aria-label="{w}"]'); el.click(); el.fill(v); pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
            assert fits(w), f'el peso {v} queda recortado'
        el=pg.locator(f'[aria-label="{w}"]'); el.click(); el.fill('122,5'); pg.keyboard.press('Enter'); pg.wait_for_timeout(250); shot('R_peso')
        r='Repeticiones serie 1 de Press de banca con barra'; el=pg.locator(f'[aria-label="{r}"]'); el.click(); el.fill('120'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200); assert fits(r), 'repeticiones de 3 cifras recortadas'
        el.click(); el.fill('10'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
        pg.click('[aria-label="Completar serie 1 de Press de banca con barra"]'); pg.wait_for_timeout(500)
        assert pg.locator('[role=timer]').count()==0, 'hubo descanso dentro de la ronda'
        pg.wait_for_selector('[aria-label="Completar serie 1 de Remo con barra"]'); assert pg.locator('[aria-label="RIR 2"]').count()==1, 'no se abrió la serie del segundo ejercicio'
        pg.click('[aria-label="Completar serie 1 de Remo con barra"]'); pg.wait_for_selector('[role=timer]'); pg.wait_for_selector('text=2/9 series'); shot('R_biserie_sesion'); pg.click('button:has-text("Omitir")')
    step('Sesión: biserie por rondas sin descanso intermedio; pesos de tres cifras completos', r2)
    def r3():
        pg.locator('main button', has_text='2. Curl de bíceps con barra').click(); pg.wait_for_selector('h2:has-text("Curl de bíceps con barra")')
        el=pg.locator('[aria-label="Peso serie 1"]'); el.click(); el.fill('20'); pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
        pg.click('[aria-label="Completar serie 1"]'); pg.wait_for_selector('[role=timer]'); pg.wait_for_selector('text=3/9 series')
        pg.click('[aria-label="Serie 1 completada, tocar para editar"]'); pg.click('button:has-text("Técnica")')
        dlg().locator('text=Dropset').first.wait_for(); dlg().locator('text=Descanso-pausa').first.wait_for(); dlg().locator('text=Myo-reps').first.wait_for(); dlg().locator('text=Cluster').first.wait_for(); shot('R_tecnicas')
        dlg().locator('[aria-label="Añadir Dropset"]').click(); pg.wait_for_selector('[aria-label="Peso bajada 1 de la serie 1"]'); pg.wait_for_timeout(300)
        v=pg.locator('[aria-label="Peso bajada 1 de la serie 1"]').input_value(); assert v=='15', 'carga de la bajada: '+v
        assert pg.locator('[role=timer]').count()==0, 'el dropset no canceló el descanso'
        pg.click('[aria-label="Completar bajada 1 de la serie 1"]'); pg.wait_for_selector('[role=timer]'); pg.wait_for_selector('text=3/9 series'); pg.click('button:has-text("Omitir")')
        pg.click('button:has-text("Técnica")'); dlg().locator('[aria-label="Añadir Descanso-pausa"]').click(); pg.wait_for_selector('[aria-label="Peso pausa 1 de la serie 2"]'); pg.wait_for_selector('[role=timer]'); shot('R_dropset'); pg.click('button:has-text("Omitir")')
        pg.reload(); pg.wait_for_selector('text=3/9 series'); pg.wait_for_selector('[aria-label="Bajada 1 de la serie 1 completada, tocar para editar"]')
    step('Técnicas: dropset con carga rebajada, descanso-pausa con pausa corta, no cuentan como series', r3)
    def r4():
        pg.wait_for_selector('h2:has-text("Curl de bíceps con barra")'); swipe(260); pg.wait_for_selector('text=BISERIE'); swipe(-260); pg.wait_for_selector('main h2:has-text("Curl de bíceps con barra")')
        swipe(-260); pg.wait_for_selector('main h2:has-text("Curl de bíceps con barra")')
        pg.evaluate('''() => { const el = document.querySelector('[aria-label="RIR 2"]') || document.querySelector('[data-noswipe] button'); const r = el.getBoundingClientRect(); const mk = (x) => new Touch({ identifier: 9, target: el, clientX: x, clientY: r.top + 5 });
          el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [mk(60)], targetTouches: [mk(60)], changedTouches: [mk(60)] })); el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], targetTouches: [], changedTouches: [mk(330)] })); }'''); pg.wait_for_timeout(400)
        pg.wait_for_selector('main h2:has-text("Curl de bíceps con barra")')
    step('Gestos: deslizar cambia de ejercicio; no pasa del último ni se activa sobre los controles', r4)
    def r5():
        swipe(260); pg.wait_for_selector('text=BISERIE'); pg.click('[aria-label="Separar Remo con barra de la biserie"]'); toast('Ejercicio separado'); pg.wait_for_timeout(300)
        assert pg.locator('main [data-drop-id]').count()==3
        hold_drag('main [data-drop-id]:has-text("Remo con barra")', '[data-drop-zone] [data-drop-id]:has-text("Curl de bíceps con barra")', late=True); toast('Biserie creada')
        assert pg.locator('[data-drop-zone]').count()==0, 'la lista de destinos no se cerró'
        pg.wait_for_selector('main >> text=Biserie: Curl de bíceps con barra + Remo con barra'); pg.wait_for_selector('text=BISERIE')
        pg.locator('main button', has_text='1. Press de banca con barra').click(); pg.wait_for_selector('main h2:has-text("Press de banca con barra")')
        pg.click('[aria-label="Unir en biserie con otro ejercicio"]'); dlg().locator('button', has_text='Curl de bíceps con barra + Remo con barra').click(); toast('Triserie creada')
        pg.wait_for_selector('text=TRISERIE'); pg.wait_for_selector('text=3/9 series'); shot('R_triserie')
        assert pg.locator('[aria-label="Sumar un ejercicio"]').is_disabled()
    step('Sesión: separar, arrastrar para unir y pasar a triserie con el botón', r5)
    def r6():
        pg.click('button:has-text("Finalizar")'); dlg().locator('button:has-text("Finalizar")').click(); pg.wait_for_selector('text=Eliminar sesión')
        dlg().locator('text=Bajada 1').wait_for(); assert dlg().locator('text=Pausa 1').count()==0, 'un tramo sin completar quedó en el historial'; shot('R_historial')
        n=dlg().locator('.grid >> text=Series').locator('xpath=..').inner_text(); errors.append('HIST '+n.replace('\n',' '))
        pg.keyboard.press('Escape'); go('/analisis'); pg.wait_for_selector('text=Series por grupo muscular')
    step('Historial: el dropset aparece bajo su serie y la sesión se guarda', r6)

    # ---------- O. Primera apertura y luego sin conexión (pantallas nunca visitadas) ----------
    ctx2=b.new_context(viewport={'width':390,'height':844}, locale='es-CL'); ctx2.set_default_timeout(8000); pg=ctx2.new_page()
    pg.on('pageerror', lambda e: errors.append('PAGEERROR '+str(e)[:300]))
    def o1():
        pg.goto(B); pg.click('text=Continuar sin cuenta'); pg.wait_for_selector('text=CREAR RUTINA'); pg.wait_for_timeout(3500)
        ctx2.set_offline(True); pg.reload(); pg.wait_for_selector('text=CREAR RUTINA'); pg.wait_for_selector('main canvas', timeout=10000); pg.wait_for_timeout(1500)
        assert pg.locator('main canvas').count()==1, 'el modelo 3D no cargó sin conexión'
        go('/historial'); pg.wait_for_selector('text=Sin entrenamientos este mes'); go('/analisis'); pg.wait_for_selector('text=Sin datos para analizar'); go('/recuperacion'); pg.wait_for_selector('text=Registro de hoy')
        pg.click('button:has-text("Guardar registro")'); pg.wait_for_selector('text=Registro de hoy (guardado)')
    step('Sin conexión tras una sola apertura: abre pantallas nunca visitadas y guarda', o1)
    b.close()
for r in results: print(*r, sep=' | ')
print('--- consola/notas ---')
for e in errors: print(e)
