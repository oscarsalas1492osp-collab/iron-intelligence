import sys
from playwright.sync_api import sync_playwright
ids=sys.argv[1].split(','); out=sys.argv[2] if len(sys.argv)>2 else '/tmp/kit/pair.png'; px=int(sys.argv[3]) if len(sys.argv)>3 else 190; cols=int(sys.argv[4]) if len(sys.argv)>4 else 4
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':cols*(2*px+10)+8,'height':600}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    for k in range(3):
        try: pg.goto('http://localhost:5174/'); pg.wait_for_timeout(2500); break
        except Exception as e: pg.wait_for_timeout(2500)
    info=pg.evaluate('''async ([ids,px]) => {
      const r = await import('/src/ui/figure/render3d.ts'); await r.prepare('male'); const s = await import('/src/ui/figure/scenes.ts'); const lib = await import('/src/domain/exerciseLibrary.ts');
      document.body.innerHTML = ''; document.body.style.cssText = 'margin:4px;background:#0c1418;display:flex;flex-wrap:wrap;gap:10px 10px;font:11px sans-serif;color:#cdd';
      const miss = [];
      for (const id of ids) {
        const ex = lib.LIBRARY.find(e => e.id === id); if (!ex) { miss.push(id); continue; }
        const sc = s.sceneFor(ex, lib.patternOf(ex.id)); const f = new r.Figure3D(ex, sc, true);
        const d = document.createElement('div'); d.style.cssText = `width:${2*px}px;background:#16222a;border-radius:12px;overflow:hidden;display:flex;flex-wrap:wrap`;
        for (const t of [0, 1]) { const i = new Image(); i.src = f.draw(t, px*2).toDataURL('image/webp', 0.9); i.width = px; i.height = px; d.appendChild(i); }
        const c = document.createElement('div'); c.textContent = id + ' · ' + ex.equipment; c.style.cssText='padding:0 6px 3px;width:100%'; d.appendChild(c); document.body.appendChild(d);
      }
      return miss;
    }''', [ids,px])
    print('faltan', info, errs[:3]); pg.wait_for_timeout(500); pg.screenshot(path=out, full_page=True); b.close()
