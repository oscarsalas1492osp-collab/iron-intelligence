# Las pruebas entran a la app «sin cuenta». Con la app en modo solo invitados eso no se ofrece, así que cada
# contexto de prueba parte con el modo abierto guardado y sin consultar ese ajuste al servidor.
# Uso: `import abierta` antes de abrir el navegador (los guiones de otras carpetas agregan esta al sys.path).
import re
from playwright.sync_api import Browser

_original = Browser.new_context

def _new_context(self, *args, **kwargs):
    ctx = _original(self, *args, **kwargs)
    ctx.add_init_script("try { localStorage.setItem('ii_access', JSON.stringify({ mode: 'open', uid: 'local', allowed: null, at: Date.now() })); } catch (e) {}")
    ctx.route(re.compile(r'/rest/v1/app_flags\?.*key=eq\.access'), lambda r: r.abort())
    return ctx

Browser.new_context = _new_context
