# Dibuja el video cuadro a cuadro desde la página de composición y lo codifica por escenas.
# Uso: render.py <config.json> prueba t1,t2,…   → cuadros sueltos en /tmp/video/prueba/
#      render.py <config.json> video <salida.mp4> → un archivo por escena y unión sin recodificar
import json, os, subprocess, sys
from playwright.sync_api import sync_playwright
cfg=json.load(open(sys.argv[1])); modo=sys.argv[2]
FPS=30; URL='http://localhost:4173/_video/index.html'
ENC=['-c:v','libx264','-crf','18','-preset','veryfast','-pix_fmt','yuv420p','-r',str(FPS),'-video_track_timescale','15360']
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--font-render-hinting=none'])
    pg=b.new_context(viewport={'width':1080,'height':1920}, device_scale_factor=1).new_page()
    pg.goto(URL); pg.evaluate('(c) => window.setup(c)', cfg); pg.wait_for_timeout(400)
    def frame(t):
        pg.evaluate('(t) => window.render(t)', t)
        return pg.screenshot(type='jpeg', quality=92)
    if modo=='prueba':
        os.makedirs('/tmp/video-prueba', exist_ok=True)
        for t in [float(x) for x in sys.argv[3].split(',')]:
            open(f'/tmp/video-prueba/t{t:05.2f}.jpg','wb').write(frame(t))
        print('cuadros de prueba listos')
    else:
        salida=sys.argv[3]; base=os.path.splitext(salida)[0]; partes=[]
        cortes=cfg['cortes']                                   # límites de escena en segundos
        for i,(a,z) in enumerate(zip(cortes[:-1], cortes[1:])):
            tmp=f'{base}.e{i}.tmp.mp4'; fin=f'{base}.e{i}.mp4'
            if i in cfg.get('omitir', []) and os.path.exists(fin): partes.append(fin); continue      # escena ya hecha: se reutiliza
            ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','image2pipe','-framerate',str(FPS),'-c:v','mjpeg','-i','-',*ENC,tmp], stdin=subprocess.PIPE)
            n=round((z-a)*FPS)
            for k in range(n): ff.stdin.write(frame(a+k/FPS))
            ff.stdin.close()
            if ff.wait()!=0: raise SystemExit(f'ffmpeg falló en la escena {i}')
            os.replace(tmp, fin); partes.append(fin); print('escena',i,n,'cuadros')
        json.dump(partes, open(base+'.partes.json','w'))
    b.close()
