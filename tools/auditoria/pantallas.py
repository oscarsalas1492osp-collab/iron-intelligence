import sys, json
from playwright.sync_api import sync_playwright
B='http://localhost:4173/'
JS = r'''() => {
  const out=[]; const W=innerWidth; const seen=new Set();
  const say=(k,el,extra)=>{ const t=(el.getAttribute('aria-label')||el.innerText||el.className||'').toString().replace(/\s+/g,' ').trim().slice(0,46); const key=k+'|'+t; if(seen.has(key)) return; seen.add(key); out.push(k+': «'+t+'» '+(extra||'')); };
  if (document.documentElement.scrollWidth > W+1) out.push('PAGINA desborda a lo ancho: '+document.documentElement.scrollWidth+' > '+W);
  const vis=(el)=>{ const r=el.getBoundingClientRect(); if(r.width<2||r.height<2) return null; const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0) return null; return r; };
  const scroller=(el)=>el.closest('.no-scrollbar, .overflow-x-auto, [data-drop-scroll]');
  for (const el of document.querySelectorAll('body *')) {
    const r=vis(el); if(!r) continue; const cs=getComputedStyle(el);
    if ((r.right > W+1 || r.left < -1) && !scroller(el) && cs.position!=='fixed' && !el.closest('.ambient, canvas, svg')) say('FUERA', el, Math.round(r.left)+'..'+Math.round(r.right));
    // texto recortado sin puntos suspensivos
    if (el.childElementCount===0 && el.textContent.trim() && el.scrollWidth > el.clientWidth+1 && cs.overflowX!=='visible' && cs.textOverflow!=='ellipsis' && el.tagName!=='INPUT' && el.tagName!=='TEXTAREA' && el.tagName!=='SELECT') say('RECORTE', el, el.scrollWidth+'>'+el.clientWidth);
  }
  // controles cuyo texto se parte en varias líneas
  for (const b of document.querySelectorAll('button, a')) {
    const r=vis(b); if(!r||r.height>76) continue;
    const walker=document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let n; const tops=new Set();
    const blocks=new Map();
    while((n=walker.nextNode())){ if(!n.textContent.trim()) continue; const rg=document.createRange(); rg.selectNodeContents(n); const p=n.parentElement; for(const q of rg.getClientRects()){ if(q.width>1){ const set=blocks.get(p)||blocks.set(p,new Set()).get(p); set.add(Math.round(q.top/3)); } } }
    for (const [p,set] of blocks) if (set.size>1) { say('PARTIDO', b, set.size+' líneas'); break; }
  }
  // controles tapados por otra capa (centro del control no recibe el toque)
  const modal=document.querySelector('[role=dialog]');
  for (const b of document.querySelectorAll(modal ? '[role=dialog] button, [role=dialog] input, [role=dialog] select' : 'main button, main a, main input, main select')) {
    if (b.closest('[role=timer]')) continue;
    const r=vis(b); if(!r) continue; const cx=r.left+r.width/2, cy=r.top+r.height/2; if(cy<0||cy>innerHeight||cx<0||cx>W) continue;
    const top=document.elementFromPoint(cx,cy); if(top && top!==b && !b.contains(top) && !top.contains(b)) { const f=top.closest('nav, [role=timer], [data-session-head], header, [role=status]'); if(!f) say('TAPADO', b, 'por '+(top.className||top.tagName).toString().slice(0,40)); }
  }
  // zonas de toque bajo 44 px (enlaces dentro de un párrafo no cuentan)
  for (const b of document.querySelectorAll('button, a[href], [role=button], select, input[type=checkbox], input[type=radio]')) {
    const r=vis(b); if(!r) continue; if (b.tagName==='A' && b.closest('p, li, label')) continue;
    const af=getComputedStyle(b,'::after'); const ext=af.content!=='none'&&af.position==='absolute'; const hw=ext?Math.max(r.width,parseFloat(af.width)||0):r.width, hh=ext?Math.max(r.height,parseFloat(af.height)||0):r.height;
    if (Math.min(hw, hh) < 43.5) say('CHICO', b, Math.round(hw)+'x'+Math.round(hh));
  }
  return out;
}'''
REACH = r'''async () => {
  // al llegar al final, el último control debe quedar por encima de la barra inferior
  window.scrollTo(0, document.documentElement.scrollHeight); await new Promise(r=>setTimeout(r,350));
  const nav=[...document.querySelectorAll('nav')].map(n=>n.getBoundingClientRect()).filter(r=>r.top>innerHeight/2).sort((a,b)=>a.top-b.top)[0];
  const timer=document.querySelector('[role=timer]'); const limit=Math.min(nav?nav.top:innerHeight, timer?timer.getBoundingClientRect().top:innerHeight);
  const els=[...document.querySelectorAll('main button, main a, main input, main select')].filter(e=>{ if(e.closest('[role=timer]')) return false;const r=e.getBoundingClientRect(); return r.width>2&&r.height>2;});
  const last=els.sort((a,b)=>b.getBoundingClientRect().bottom-a.getBoundingClientRect().bottom)[0]; if(!last) return null;
  const r=last.getBoundingClientRect(); window.scrollTo(0,0);
  return r.bottom>limit+2 ? 'INALCANZABLE: «'+(last.getAttribute('aria-label')||last.innerText).trim().slice(0,40)+'» queda bajo la barra ('+Math.round(r.bottom)+' > '+Math.round(limit)+')' : null;
}'''
import os
IDIOMAS=[x for x in os.environ.get('IDIOMAS','').split(',') if x]      # p. ej. IDIOMAS=en,pt: repite cada revisión en esos idiomas
TEXTOS=set()                                                             # textos vistos, para medir cuánto está traducido
TXT = r'''() => { const out=new Set(); const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT); let n;
  while((n=w.nextNode())){ if(n.nodeType===3){ const p=n.parentElement; if(!p||['SCRIPT','STYLE','TEXTAREA'].includes(p.tagName)||p.closest('[data-notr]')) continue; const t=n.nodeValue.replace(/\s+/g,' ').trim(); if(t) out.add(t); }
    else for(const a of ['placeholder','title','aria-label','alt']){ const v=n.getAttribute(a); if(v&&v.trim()) out.add(v.replace(/\s+/g,' ').trim()); } }
  return [...out]; }'''
res={}
def check(pg, name, w, reach=True):
    pg.wait_for_timeout(250)
    if w==360: TEXTOS.update(pg.evaluate(TXT))
    for lang in IDIOMAS:
        pg.evaluate("l => window.__iiLang(l)", lang); pg.wait_for_timeout(200)
        pr=[x for x in pg.evaluate(JS) if not x.startswith('CHICO')]
        res.setdefault(name+'@'+lang,{})[w]=pr
        if w==360: pg.screenshot(path=f'/tmp/auditoria-out/{name}@{lang}.png')
        pg.evaluate("window.__iiLang('es')"); pg.wait_for_timeout(120)
    probs=pg.evaluate(JS)
    if reach and not pg.locator('[role=dialog]').count():
        x=pg.evaluate(REACH)
        if x: probs.append(x)
    res.setdefault(name,{})[w]=probs
    if w==360: pg.screenshot(path=f'/tmp/auditoria-out/{name}.png')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    for w in (360, 393):
        c=b.new_context(viewport={'width':w,'height':780}, device_scale_factor=2, locale='es-CL', timezone_id='America/Santiago', has_touch=True, is_mobile=True)
        c.set_default_timeout(9000); c.route('https://*.supabase.co/**', lambda r: r.abort())
        pg=c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        def go(path, wait=900): pg.goto(B+'#'+path); pg.wait_for_timeout(wait)
        dlg=lambda: pg.locator('[role=dialog]').last
        try:
            pg.goto(B); check(pg,'00_entrada',w, False)
        except Exception as e:
            print('SALTO', w, "pg.goto(B); check(pg,'00_entrada',w, False)", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.click('text=Continuar sin cuenta'); pg.wait_for_selector('text=CREAR RUTINA'); check(pg,'01_inicio_vacio',w)
        except Exception as e:
            print('SALTO', w, "pg.click('text=Continuar sin cuenta'); pg.wait_for_selector(", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            go('/perfil')
        except Exception as e:
            print('SALTO', w, "go('/perfil')", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.locator('[aria-label="Archivo de copia de seguridad"]').set_input_files('tools/auditoria/demo.json'); dlg().locator('button:has-text("Restaurar")').click()
        except Exception as e:
            print('SALTO', w, 'pg.locator(\'[aria-label="Archivo de copia de seguridad"]\').s', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.wait_for_selector('[role=status]:has-text("registros restaurados")'); pg.evaluate("localStorage.setItem('ii_hint_gestures','1')"); pg.wait_for_timeout(1500)
        except Exception as e:
            print('SALTO', w, 'pg.wait_for_selector(\'[role=status]:has-text("registros rest', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            check(pg,'10_perfil',w)
        except Exception as e:
            print('SALTO', w, "check(pg,'10_perfil',w)", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            go('/', 3000); check(pg,'02_inicio',w)
        except Exception as e:
            print('SALTO', w, "go('/', 3000); check(pg,'02_inicio',w)", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            go('/analisis', 2000); check(pg,'03_analisis',w)
        except Exception as e:
            print('SALTO', w, "go('/analisis', 2000); check(pg,'03_analisis',w)", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            go('/historial', 1200); check(pg,'04_historial',w)
        except Exception as e:
            print('SALTO', w, "go('/historial', 1200); check(pg,'04_historial',w)", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.locator('main button', has_text='Progresión').first.click(); pg.wait_for_timeout(900); check(pg,'04_historial_Progresión',w)
        except Exception as e:
            print('SALTO', w, 'historial Progresión', str(e).split(chr(10))[0][:90])
        try:
            pg.locator('main button', has_text='Récords').first.click(); pg.wait_for_timeout(900); check(pg,'04_historial_Récords',w)
        except Exception as e:
            print('SALTO', w, 'historial Récords', str(e).split(chr(10))[0][:90])
        try:
            go('/historial', 800); pg.locator('main button', has_text='kg').first.click(timeout=5000); pg.wait_for_timeout(700)
        except Exception as e:
            print('SALTO', w, 'go(\'/historial\', 800); pg.locator(\'main button[aria-label*="', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            if pg.locator('[role=dialog]').count(): check(pg,'04_historial_detalle',w, False); pg.keyboard.press('Escape')
        except Exception as e:
            print('SALTO', w, "if pg.locator('[role=dialog]').count(): check(pg,'04_histori", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            go('/rutinas', 900); check(pg,'05_rutinas',w)
        except Exception as e:
            print('SALTO', w, "go('/rutinas', 900); check(pg,'05_rutinas',w)", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.locator('main a, main button', has_text='Torso B').first.click(); pg.wait_for_timeout(1200); check(pg,'05_rutina_editor',w)
        except Exception as e:
            print('SALTO', w, "pg.locator('main a, main button', has_text='Torso B').first.", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.locator('main [data-drop-id] button.min-w-0').first.click(); pg.wait_for_timeout(500); check(pg,'05_rutina_objetivo',w, False); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        except Exception as e:
            print('SALTO', w, "pg.locator('main [data-drop-id] button.min-w-0').first.click", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            go('/ejercicios', 2500); check(pg,'06_biblioteca',w)
        except Exception as e:
            print('SALTO', w, "go('/ejercicios', 2500); check(pg,'06_biblioteca',w)", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.locator('main button', has_text='Press de banca con barra').first.click(); pg.wait_for_selector('text=Indicaciones técnicas'); pg.wait_for_timeout(600); check(pg,'06_ficha',w, False); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        except Exception as e:
            print('SALTO', w, "pg.locator('main button', has_text='Press de banca con barra", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.click('button:has-text("Nuevo")'); pg.wait_for_timeout(500); check(pg,'06_nuevo',w, False); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        except Exception as e:
            print('SALTO', w, 'pg.click(\'button:has-text("Nuevo")\'); pg.wait_for_timeout(50', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            go('/recuperacion', 1200); check(pg,'07_recuperacion',w)
        except Exception as e:
            print('SALTO', w, "go('/recuperacion', 1200); check(pg,'07_recuperacion',w)", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            go('/asistente', 900); check(pg,'08_asistente',w)
        except Exception as e:
            print('SALTO', w, "go('/asistente', 900); check(pg,'08_asistente',w)", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            go('/fundamento', 900); check(pg,'09_fundamento',w)
        except Exception as e:
            print('SALTO', w, "go('/fundamento', 900); check(pg,'09_fundamento',w)", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            go('/mas', 700); check(pg,'11_mas',w)
        except Exception as e:
            print('SALTO', w, "go('/mas', 700); check(pg,'11_mas',w)", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            go('/entrenar', 900); check(pg,'12_entrenar_inicio',w)
        except Exception as e:
            print('SALTO', w, "go('/entrenar', 900); check(pg,'12_entrenar_inicio',w)", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.locator('main button:has-text("Iniciar")').first.click(); pg.wait_for_selector('text=Entrenamiento en curso'); pg.wait_for_timeout(1500); check(pg,'13_sesion',w)
        except Exception as e:
            print('SALTO', w, 'pg.locator(\'main button:has-text("Iniciar")\').first.click();', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.locator('main [aria-label^="Completar serie 1"]').first.click(); pg.wait_for_timeout(1300); check(pg,'13_sesion_descanso',w)
        except Exception as e:
            print('SALTO', w, 'pg.locator(\'main [aria-label^="Completar serie 1"]\').first.c', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.locator('main [aria-label^="RIR 2 para"]').first.click(); pg.wait_for_timeout(700)
        except Exception as e:
            print('SALTO', w, 'pg.locator(\'main [aria-label^="RIR 2 para"]\').first.click();', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.locator('main button:has-text("Detalle")').first.click(); pg.wait_for_timeout(500); check(pg,'13_sesion_detalle',w, False); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        except Exception as e:
            print('SALTO', w, 'pg.locator(\'main button:has-text("Detalle")\').first.click();', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.locator('main button:has-text("Técnica")').first.click(); pg.wait_for_timeout(500); check(pg,'13_sesion_tecnica',w, False)
        except Exception as e:
            print('SALTO', w, 'pg.locator(\'main button:has-text("Técnica")\').first.click();', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            dlg().locator('button:has-text("Añadir")').first.click(); pg.wait_for_timeout(900); check(pg,'13_sesion_dropset',w)
        except Exception as e:
            print('SALTO', w, 'dlg().locator(\'button:has-text("Añadir")\').first.click(); pg', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.locator('[aria-label="Unir en biserie con otro ejercicio"]').click(); pg.wait_for_timeout(500); check(pg,'13_sesion_unir',w, False)
        except Exception as e:
            print('SALTO', w, 'pg.locator(\'[aria-label="Unir en biserie con otro ejercicio"', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            dlg().locator('button.rounded-panel').first.click(); pg.wait_for_timeout(1200); check(pg,'14_biserie',w)
        except Exception as e:
            print('SALTO', w, "dlg().locator('button.rounded-panel').first.click(); pg.wait", str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.locator('main [aria-label^="Objetivo:"]').first.click(); pg.wait_for_timeout(500); check(pg,'14_objetivo_hoy',w, False); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        except Exception as e:
            print('SALTO', w, 'pg.locator(\'main [aria-label^="Objetivo:"]\').first.click(); ', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.click('button:has-text("+ Ejercicio")'); pg.wait_for_timeout(700); check(pg,'15_selector',w, False); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        except Exception as e:
            print('SALTO', w, 'pg.click(\'button:has-text("+ Ejercicio")\'); pg.wait_for_time', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        try:
            pg.click('button:has-text("Finalizar")'); pg.wait_for_timeout(500); check(pg,'16_finalizar',w, False)
        except Exception as e:
            print('SALTO', w, 'pg.click(\'button:has-text("Finalizar")\'); pg.wait_for_timeou', str(e).split(chr(10))[0][:90]); pg.keyboard.press('Escape')
        print('ancho',w,'errores JS',errs)
        c.close()
    b.close()
for name in sorted(res):
    a=set(res[name].get(360,[])); bb=set(res[name].get(393,[]))
    if a|bb:
        print('\n## '+name)
        for x in sorted(a|bb): print('  ['+('360' if x in a else '   ')+' '+('393' if x in bb else '   ')+'] '+x)
print('\npantallas revisadas', len(res))
json.dump(sorted(TEXTOS), open('/tmp/auditoria-out/textos.json','w'), ensure_ascii=False)
