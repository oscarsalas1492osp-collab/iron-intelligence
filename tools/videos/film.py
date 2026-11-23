import asyncio, sys, subprocess, os
from playwright.async_api import async_playwright
async def main(v, times=None):
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={'width':1080,'height':1920})
        await pg.goto(f'file:///home/claude/videos/work/video.html?v={v}')
        await pg.evaluate("document.fonts.ready")
        # precarga de imágenes
        await pg.evaluate("""async()=>{for(const s of ['marca.png','rir.png','rec.png','serie.png','reloj.png']){const i=new Image();i.src=s;await i.decode()}}""")
        if times:
            for t in times:
                await pg.evaluate(f"render({t})"); await pg.wait_for_timeout(120)
                await pg.screenshot(path=f'prev_{v}_{t}.jpg',type='jpeg',quality=85)
        else:
            os.makedirs(f'fr{v}',exist_ok=True)
            ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','image2pipe','-framerate','30','-i','-','-c:v','libx264','-crf','18','-preset','veryfast','-pix_fmt','yuv420p','-movflags','+faststart',f'tmp_{v}.mp4'],stdin=subprocess.PIPE)
            for f in range(450):
                await pg.evaluate(f"render({f/30})")
                ff.stdin.write(await pg.screenshot(type='jpeg',quality=92))
            ff.stdin.close(); rc=ff.wait(); print(v,'rc',rc)
            if rc==0: os.rename(f'tmp_{v}.mp4',f'video_{v}.mp4')
        await b.close()
v=int(sys.argv[1]); ts=[float(x) for x in sys.argv[2:]] or None
asyncio.run(main(v,ts))
