# Vuelca el modelo anatómico sin deformar y sus pesos de hueso (página lab/dump.html, con `npx vite --port 5199`).
import os
W = os.environ.get('PIEL_TMP', '/tmp/piel'); os.makedirs(W, exist_ok=True)
import sys, base64, json, numpy as np
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(); pg.on('pageerror', lambda e: print('pageerror:', str(e)[:400]))
    pg.goto('http://localhost:5199/lab/dump.html'); pg.wait_for_function('window.ready === true', timeout=60000)
    for fig in ('neutral',):
        rows = pg.evaluate('() => window.dump()'); d = {}
        for r in rows:
            d[r['name'] + '_P'] = np.frombuffer(base64.b64decode(r['P']), dtype=np.float32).reshape(-1, 3)
            d[r['name'] + '_W'] = np.frombuffer(base64.b64decode(r['W']), dtype=np.float32).reshape(-1, 14)
            d[r['name'] + '_I'] = np.frombuffer(base64.b64decode(r['I']), dtype=np.uint32).reshape(-1, 3)
        np.savez_compressed(f'{W}/src_{fig}.npz', **d)
        P = np.concatenate([d[k] for k in d if k.endswith('_P')]); print(fig, len(rows), P.shape, P.min(0).round(3), P.max(0).round(3))
    b.close()
