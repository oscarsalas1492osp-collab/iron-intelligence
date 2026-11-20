import json, base64, time, re
from playwright.sync_api import sync_playwright
B='http://localhost:4173/'
SB='https://flwbkclkebkmebtfljcg.supabase.co'
res=[]
def ok(name, cond, extra=''): res.append(('OK' if cond else 'FALLA', name, extra))
def b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
UID='11111111-2222-3333-4444-555555555555'
now=int(time.time())
JWT=b64({'alg':'HS256','typ':'JWT'})+'.'+b64({'sub':UID,'aud':'authenticated','role':'authenticated','email':'prueba@gmail.com','exp':now+3600,'iat':now})+'.firma'
USER={'id':UID,'aud':'authenticated','role':'authenticated','email':'prueba@gmail.com','app_metadata':{'provider':'google','providers':['google']},'user_metadata':{'full_name':'Prueba'},'identities':[],'created_at':'2026-11-19T00:00:00Z'}
state={'google':True,'rpc':0,'authorize':None}
def handler(route):
    req=route.request; u=req.url
    cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
    if req.method=='OPTIONS': return route.fulfill(status=204, headers=cors)
    if '/auth/v1/settings' in u: return route.fulfill(status=200, headers=cors, content_type='application/json', body=json.dumps({'external':{'google':state['google'],'email':True}}))
    if '/auth/v1/authorize' in u: state['authorize']=u; return route.fulfill(status=200, content_type='text/html', body='<h1>Google simulado</h1>')
    if '/auth/v1/user' in u: return route.fulfill(status=200, headers=cors, content_type='application/json', body=json.dumps(USER))
    if '/auth/v1/logout' in u: return route.fulfill(status=204, headers=cors)
    if '/auth/v1/token' in u: return route.fulfill(status=200, headers=cors, content_type='application/json', body=json.dumps({'access_token':JWT,'refresh_token':'r2','expires_in':3600,'token_type':'bearer','user':USER}))
    if '/rest/v1/rpc/delete_account' in u: state['rpc']+=1; return route.fulfill(status=204, headers=cors)
    if '/rest/v1/' in u:
        return route.fulfill(status=200 if req.method=='GET' else 201, headers=cors, content_type='application/json', body='[]')
    return route.fulfill(status=404, headers=cors, body='')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    def ctxnew():
        c=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, locale='es-CL')
        c.set_default_timeout(10000); c.route(SB+'/**', handler); return c
    errs=[]
    # 1) proveedor apagado: sin botón
    state['google']=False; c=ctxnew(); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto(B); pg.wait_for_selector('text=Iniciar sesión'); pg.wait_for_timeout(700)
    ok('sin proveedor activo no hay botón de Google', pg.locator('button:has-text("Continuar con Google")').count()==0)
    ok('enlaces legales en la pantalla de entrada', pg.locator('a[href="./privacidad.html"]').count()==1 and pg.locator('a[href="./terminos.html"]').count()==1)
    c.close()
    # 2) proveedor activo: botón y salida a Google
    state['google']=True; c=ctxnew(); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto(B); pg.wait_for_selector('button:has-text("Continuar con Google")'); pg.screenshot(path='/tmp/aud/G_auth.png')
    pg.click('button:has-text("Continuar con Google")'); pg.wait_for_selector('text=Google simulado')
    a=state['authorize'] or ''
    ok('el botón lleva a Supabase con proveedor Google y retorno a la app', 'provider=google' in a and 'redirect_to=http%3A%2F%2Flocalhost%3A4173%2F' in a, a[:160])
    # 3) retorno con sesión
    pg.goto(B+'#access_token='+JWT+'&expires_in=3600&expires_at='+str(now+3600)+'&refresh_token=r1&token_type=bearer&provider_token=x')
    pg.wait_for_function("(localStorage.getItem('ii_uid')||'local')!=='local'", timeout=10000); pg.wait_for_timeout(1200)
    uid=pg.evaluate("localStorage.getItem('ii_uid')")
    ok('al volver de Google la sesión queda iniciada', uid==UID, str(uid))
    ok('la dirección queda limpia tras el retorno', 'access_token' not in pg.url, pg.url)
    pg.goto(B+'#/perfil'); pg.wait_for_selector('text=prueba@gmail.com'); 
    ok('el perfil muestra la cuenta de Google', True)
    # 4) eliminar cuenta
    pg.locator('button:has-text("Eliminar cuenta y datos")').scroll_into_view_if_needed(); pg.screenshot(path='/tmp/aud/G_privacidad.png')
    pg.click('button:has-text("Eliminar cuenta y datos")')
    d=pg.locator('[role=dialog]').last; d.wait_for(); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/aud/G_confirmar.png')
    d.locator('button:has-text("Cancelar")').click(); pg.wait_for_timeout(300)
    ok('cancelar no llama al servidor', state['rpc']==0)
    pg.click('button:has-text("Eliminar cuenta y datos")'); d=pg.locator('[role=dialog]').last; d.wait_for()
    d.locator('button:has-text("Eliminar todo")').click()
    pg.wait_for_selector('[role=status]:has-text("Cuenta y datos eliminados")'); pg.wait_for_timeout(500)
    ok('eliminar llama al servidor una vez y vuelve a modo sin cuenta', state['rpc']==1 and pg.evaluate("localStorage.getItem('ii_uid')")=='local', f"rpc={state['rpc']}")
    left=pg.evaluate("""async()=>{const r=indexedDB.open('iron-intelligence');const d=await new Promise(o=>r.onsuccess=()=>o(r.result));let n=0;for(const t of ['profiles','routines','sessions','sets']){n+=await new Promise(o=>{const q=d.transaction(t).objectStore(t).getAll();q.onsuccess=()=>o(q.result.filter(x=>x.userId==='%s').length)})}return n}"""%UID)
    ok('no quedan datos de la cuenta en el dispositivo', left==0, str(left))
    c.close()
    # 5) retorno con error
    c=ctxnew(); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto(B+'?error=access_denied&error_code=access_denied&error_description=The+user+denied+access#error=access_denied&error_code=access_denied&error_description=The+user+denied+access')
    pg.wait_for_selector('[role=status]:has-text("No se completó el inicio de sesión con Google")')
    ok('si Google devuelve un error, la app lo avisa y limpia la dirección', pg.url.rstrip('/')==B.rstrip('/'), pg.url)
    # 6) sin cuenta: borrar datos del dispositivo
    pg.click('text=Continuar sin cuenta'); pg.wait_for_timeout(600); pg.goto(B+'#/perfil')
    pg.wait_for_selector('button:has-text("Borrar los datos de este dispositivo")')
    ok('sin cuenta se ofrece borrar los datos del dispositivo', True)
    # 7) páginas públicas
    for f,t in [('privacidad.html','Política de privacidad'),('terminos.html','Términos de uso'),('eliminar-cuenta.html','Eliminar tu cuenta')]:
        pg.goto(B+f); ok('página pública '+f, pg.locator('h1').inner_text().startswith(t[:12]) and pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
        pg.screenshot(path=f'/tmp/aud/G_{f[:-5]}.png')
    pg.goto(B+'eliminar-cuenta.html'); pg.click('a.boton'); pg.wait_for_selector('h1:has-text("Perfil y datos")')
    ok('el botón de la página de eliminación abre Perfil y datos', '#/perfil' in pg.url)
    c.close(); b.close()
for r in res: print(' | '.join(r))
print('ERRORES', errs[:5])
