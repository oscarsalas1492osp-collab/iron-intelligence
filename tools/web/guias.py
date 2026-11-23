"""Genera las guías de la página (public/guia/*.html), el mapa del sitio y robots.txt.

Uso: python3 tools/web/guias.py
Los textos siguen la redacción de la página: voz neutra, sin promesas de resultados.
Cada afirmación sale de src/domain/evidence.ts; si esa base cambia, hay que revisar las guías.
"""
import html, json, os

BASE = 'https://ironintelligence.app'
FECHA = '2026-11-23'
FECHA_TXT = '23 de noviembre de 2026'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public')

CSS = """:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#070d10;color:#e9e6df;font:17px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-text-size-adjust:100%}
main{max-width:42rem;margin:0 auto;padding:1.5rem 1.25rem 4rem}
header{display:flex;align-items:center;gap:.6rem;margin-bottom:2rem}
header img{width:32px;height:32px}
header a{color:#e9e6df;text-decoration:none;font-weight:800;letter-spacing:.03em}
h1{font-size:2rem;line-height:1.12;margin:0 0 .6rem;font-weight:800;letter-spacing:-.01em;text-wrap:balance}
h2{font-size:1.2rem;line-height:1.25;margin:2.2rem 0 .5rem;padding-top:1.1rem;border-top:1px solid #363b43}
p,li{color:#c9c5bc}
.bajada{font-size:1.1rem;color:#e9e6df}
.fecha{color:#8d939c;font-size:.9rem;margin:0 0 1.5rem}
a{color:#7fd6ff}
a:focus-visible{outline:2px solid #ff6a1a;outline-offset:2px;border-radius:4px}
ul,ol{padding-left:1.2rem}
li{margin:.35rem 0}
strong{color:#e9e6df}
.caja{margin:2.4rem 0 0;padding:1.2rem 1.2rem 1.3rem;border-radius:1rem;background:#0c161a;border:1px solid #24323a}
.caja p{margin:.2rem 0 .8rem}
.boton{display:inline-block;padding:.8rem 1.2rem;border-radius:.7rem;background:#ff6a1a;color:#070d10;font-weight:800;text-decoration:none}
.fuentes{font-size:.92rem}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid #363b43;font-size:.9rem;display:flex;flex-wrap:wrap;gap:.4rem 1.2rem}"""

AVISO = '<p class="fuentes">Esta guía es información general sobre entrenamiento y no reemplaza la indicación de un profesional. Consulta a uno antes de comenzar o cambiar un programa de ejercicio.</p>'

GUIAS = [
  {
    'slug': 'cuando-subir-el-peso',
    'titulo': 'Cuándo subir el peso en el gimnasio',
    'desc': 'Una regla simple para decidir si subes el peso, lo mantienes o lo bajas en tu próxima sesión, y qué anotar para aplicarla.',
    'bajada': 'Sube el peso cuando completes el tope de tu rango de repeticiones en todas las series, dejando las repeticiones en reserva que te propusiste. Si todavía no llegas, mantén el peso y suma repeticiones.',
    'cuerpo': """
<h2>La regla: doble progresión</h2>
<p>Eliges un rango de repeticiones para cada ejercicio, por ejemplo de 8 a 12. Partes con un peso que te deja cerca del piso del rango y, sesión a sesión, intentas sumar repeticiones con ese mismo peso. Cuando haces 12 en todas las series, subes el peso y vuelves a empezar desde abajo.</p>
<p>Primero progresan las repeticiones y después la carga. Por eso se llama doble progresión.</p>

<h2>Un ejemplo</h2>
<ol>
<li>Press de banca, 3 series de 8 a 12. Sesión 1: 80 kg × 10, 9 y 8. Mantienes el peso.</li>
<li>Sesión 2: 80 kg × 11, 10 y 9. Mantienes el peso.</li>
<li>Sesión 3: 80 kg × 12, 12 y 12, y todavía te quedaba una repetición. En la próxima sesión subes a 82,5 kg.</li>
</ol>

<h2>Cuánto subir</h2>
<p>El salto más chico que permita tu equipo: 2,5 kg en barra, o el siguiente par de mancuernas. Un aumento de más de 10 % de una sola vez suele ser demasiado y te deja fuera del rango.</p>

<h2>Cuándo mantener y cuándo bajar</h2>
<ul>
<li><strong>Mantener:</strong> estás dentro del rango pero no completaste el tope. Es lo normal en la mayoría de las sesiones.</li>
<li><strong>Bajar:</strong> no alcanzas el piso del rango, o tus repeticiones caen mucho de una serie a otra. Antes de bajar, revisa si descansaste lo suficiente entre series.</li>
<li><strong>Estancado:</strong> llevas tres sesiones seguidas sin sumar repeticiones. Conviene revisar el descanso, el sueño y cuánto volumen llevas en la semana.</li>
</ul>

<h2>Qué tienes que anotar</h2>
<p>Para aplicar la regla necesitas tres datos de cada serie: el peso, las repeticiones y cuántas te quedaban antes de fallar (el <a href="/guia/que-es-el-rir.html">RIR</a>). Sin el registro de la sesión anterior, la decisión se toma de memoria.</p>

<h2>Lo que dice la evidencia y lo que no</h2>
<p>No hay un estudio que fije el momento exacto para subir la carga. Subir al completar el tope del rango es un criterio de entrenamiento habitual, no un resultado científico. Lo que sí está estudiado es que, con series llevadas cerca del fallo, el músculo crece de forma similar con cargas bajas, moderadas y altas, así que la regla sirve igual en rangos de 6 a 10 que de 12 a 20.</p>
""",
    'fuentes': [('Lopez et al., Medicine & Science in Sports & Exercise, 2021', 'https://pubmed.ncbi.nlm.nih.gov/33433148/')],
    'cierre': 'IRON INTELLIGENCE aplica esta regla con tus series anotadas: te recomienda subir, mantener o bajar el peso en la próxima sesión y te muestra el motivo.',
  },
  {
    'slug': 'que-es-el-rir',
    'titulo': 'Qué es el RIR y cómo usarlo',
    'desc': 'RIR son las repeticiones en reserva: cuántas más podrías haber hecho al terminar una serie. Cómo estimarlo y para qué sirve.',
    'bajada': 'RIR significa repeticiones en reserva: cuántas repeticiones más podrías haber hecho, con buena técnica, al terminar una serie. Un RIR de 2 quiere decir que paraste cuando te quedaban dos.',
    'cuerpo': """
<h2>Cómo se lee</h2>
<ul>
<li><strong>RIR 0:</strong> no podías hacer ni una más. Llegaste al fallo.</li>
<li><strong>RIR 1 a 2:</strong> te quedaban una o dos. Es una serie exigente sin llegar al fallo.</li>
<li><strong>RIR 3 a 4:</strong> la serie fue cómoda. Sirve para calentar o para una semana de descarga.</li>
<li><strong>RIR 5 o más:</strong> estabas lejos del fallo.</li>
</ul>

<h2>Para qué sirve</h2>
<p>El RIR dice qué tan dura fue la serie, algo que el peso y las repeticiones solos no muestran. Hacer 80 kg × 8 con dos en reserva y hacerlo al límite son esfuerzos distintos, y lo que decides para la próxima sesión cambia.</p>
<p>Con ese dato puedes aplicar una regla de progresión: <a href="/guia/cuando-subir-el-peso.html">subes el peso</a> cuando completas el tope de tu rango y todavía conservas la reserva que te propusiste.</p>

<h2>Cuánto RIR dejar</h2>
<p>Los estudios disponibles apuntan a que el músculo tiende a crecer más cuanto más cerca del fallo terminan las series, aunque los propios autores advierten que la relación exacta es incierta. No hay evidencia de que llegar al fallo sea superior a quedarse cerca.</p>
<p>Un punto de partida habitual es dejar 1 a 2 repeticiones en los ejercicios multiarticulares, como sentadilla o press de banca, y 0 a 2 en los de aislamiento.</p>

<h2>Qué tan preciso es</h2>
<p>El RIR es una estimación. En promedio, las personas calculan cerca de una repetición menos de las que realmente les quedaban. La estimación mejora cuando la serie termina cerca del fallo y con cargas más pesadas, y empeora en series de más de 12 repeticiones. La experiencia ayuda, pero no elimina el error.</p>

<h2>Cómo estimarlo mejor</h2>
<ol>
<li>Fíjate en la velocidad: cuando la repetición se pone lenta sin que lo decidas, quedan pocas.</li>
<li>Anótalo apenas terminas la serie, no al final del entrenamiento.</li>
<li>De vez en cuando, en un ejercicio seguro como una máquina, lleva la última serie al fallo y compara con lo que habías estimado.</li>
</ol>
""",
    'fuentes': [
      ('Robinson et al., Sports Medicine, 2024', 'https://doi.org/10.1007/s40279-024-02069-2'),
      ('Refalo et al., Sports Medicine, 2023', 'https://pubmed.ncbi.nlm.nih.gov/36334240/'),
      ('Halperin et al., Sports Medicine, 2022', 'https://pubmed.ncbi.nlm.nih.gov/34542869/'),
    ],
    'cierre': 'En IRON INTELLIGENCE indicas el RIR con un toque después de cada serie, y con ese dato la app decide si en la próxima sesión te conviene subir el peso.',
  },
  {
    'slug': 'series-por-musculo-a-la-semana',
    'titulo': 'Cuántas series por músculo hacer a la semana',
    'desc': 'Cómo contar las series semanales de cada grupo muscular, qué son las series directas e indirectas y cómo saber si te falta o te sobra volumen.',
    'bajada': 'No hay un número único. Más series semanales se asocian con más crecimiento muscular, pero cada serie adicional aporta menos que la anterior. Lo útil es contar las tuyas y ver cómo respondes.',
    'cuerpo': """
<h2>Qué cuenta como una serie</h2>
<p>Cuenta la serie de trabajo: la que haces con el peso del día y cerca del fallo. Las series de calentamiento no entran en la cuenta.</p>

<h2>Series directas e indirectas</h2>
<p>Un ejercicio trabaja un músculo principal y otros de apoyo. En el press de banca el pecho es el principal, y los hombros y los tríceps ayudan.</p>
<ul>
<li><strong>Serie directa:</strong> el músculo es el principal del ejercicio. Cuenta como una serie.</li>
<li><strong>Serie indirecta:</strong> el músculo ayuda. Una forma de contarla es como media serie.</li>
</ul>
<p>Contar las indirectas como media serie fue el método que mejor se ajustó a los datos en un análisis de estudios sobre volumen. Es una convención de conteo, no una equivalencia exacta.</p>

<h2>Un ejemplo</h2>
<p>En una semana haces 6 series de press de banca, 4 de aperturas y 6 de press militar. Para el pecho son 10 series directas. Para los tríceps, sin haber hecho un solo ejercicio de brazos, ya suman 6 series indirectas por los dos presses, que equivalen a unas 3.</p>

<h2>Cómo saber si te falta o te sobra</h2>
<ul>
<li><strong>Puede faltar:</strong> un músculo recibe pocas series a la semana y no avanza, mientras otros sí.</li>
<li><strong>Puede sobrar:</strong> las repeticiones caen de una sesión a otra, llegas cansado y dejas de progresar aunque sumes series.</li>
</ul>
<p>Antes de agregar series, revisa lo básico: que las que ya haces terminen cerca del fallo y que descanses lo suficiente entre ellas. Descansar más de 60 segundos muestra un pequeño beneficio para el crecimiento muscular.</p>

<h2>Cómo repartirlas</h2>
<p>Una práctica habitual es repartir las series de un músculo en dos o más días de la semana, en vez de juntarlas todas en una sola sesión larga. Lo que no se registra no se puede comparar: sin la cuenta por músculo, es fácil creer que entrenas todo parejo y descubrir que un grupo recibe la mitad que otro.</p>
""",
    'fuentes': [
      ('Pelland et al., SportRxiv, metarregresión sobre volumen', 'https://sportrxiv.org/index.php/server/preprint/view/460'),
      ('Singer et al., Frontiers in Sports and Active Living, 2024', 'https://pubmed.ncbi.nlm.nih.gov/39205815/'),
    ],
    'cierre': 'IRON INTELLIGENCE cuenta las series directas e indirectas de cada músculo en la semana, para que veas cuál recibió menos trabajo.',
  },
]


def pagina(g):
    url = f"{BASE}/guia/{g['slug']}.html"
    ld = {
        '@context': 'https://schema.org', '@type': 'Article', 'headline': g['titulo'], 'description': g['desc'],
        'inLanguage': 'es', 'datePublished': FECHA, 'dateModified': FECHA, 'mainEntityOfPage': url,
        'image': f'{BASE}/web/og.png',
        'author': {'@type': 'Organization', 'name': 'IRON INTELLIGENCE', 'url': BASE},
        'publisher': {'@type': 'Organization', 'name': 'IRON INTELLIGENCE', 'logo': {'@type': 'ImageObject', 'url': f'{BASE}/icon-v2-512.png'}},
    }
    otras = ''.join(f'<li><a href="/guia/{o["slug"]}.html">{html.escape(o["titulo"])}</a></li>' for o in GUIAS if o is not g)
    fuentes = ''.join(f'<li><a href="{u}" rel="noopener">{html.escape(n)}</a></li>' for n, u in g['fuentes'])
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#070d10">
<title>{html.escape(g['titulo'])} · IRON INTELLIGENCE</title>
<meta name="description" content="{html.escape(g['desc'])}">
<link rel="canonical" href="{url}">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:locale" content="es_CL">
<meta property="og:site_name" content="IRON INTELLIGENCE">
<meta property="og:title" content="{html.escape(g['titulo'])}">
<meta property="og:description" content="{html.escape(g['desc'])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE}/web/og.png">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<style>
{CSS}
</style>
</head>
<body>
<main>
<header><img src="/icon.svg" alt=""><a href="{BASE}/">IRON INTELLIGENCE</a></header>
<article>
<h1>{html.escape(g['titulo'])}</h1>
<p class="fecha">Actualizado el {FECHA_TXT}.</p>
<p class="bajada">{g['bajada']}</p>
{g['cuerpo'].strip()}

<h2>Fuentes</h2>
<ul class="fuentes">{fuentes}</ul>
{AVISO}
</article>

<div class="caja">
<p><strong>{g['cierre']}</strong></p>
<p>Sale pronto. Inscríbete y te llega el link el día del lanzamiento.</p>
<a class="boton" href="{BASE}/?o=guia#aviso">Inscribirme</a>
</div>

<h2>Otras guías</h2>
<ul>{otras}</ul>

<footer>
<a href="{BASE}/">Inicio</a>
<a href="/guia/">Guías</a>
<a href="/privacidad.html">Política de privacidad</a>
<a href="/terminos.html">Términos de uso</a>
</footer>
</main>
</body>
</html>
"""


def indice():
    items = ''.join(f'<li><a href="/guia/{g["slug"]}.html"><strong>{html.escape(g["titulo"])}</strong></a><br>{html.escape(g["desc"])}</li>' for g in GUIAS)
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#070d10">
<title>Guías de entrenamiento de fuerza · IRON INTELLIGENCE</title>
<meta name="description" content="Guías cortas sobre entrenamiento de fuerza: cuándo subir el peso, qué es el RIR y cuántas series hacer por músculo.">
<link rel="canonical" href="{BASE}/guia/">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<style>
{CSS}
li{{margin:1rem 0}}
</style>
</head>
<body>
<main>
<header><img src="/icon.svg" alt=""><a href="{BASE}/">IRON INTELLIGENCE</a></header>
<h1>Guías de entrenamiento de fuerza</h1>
<p class="bajada">Respuestas cortas a las dudas más comunes al entrenar con pesas, con sus fuentes.</p>
<ul>{items}</ul>
<footer>
<a href="{BASE}/">Inicio</a>
<a href="/privacidad.html">Política de privacidad</a>
<a href="/terminos.html">Términos de uso</a>
</footer>
</main>
</body>
</html>
"""


def main():
    d = os.path.join(OUT, 'guia'); os.makedirs(d, exist_ok=True)
    for g in GUIAS:
        open(os.path.join(d, g['slug'] + '.html'), 'w', encoding='utf-8').write(pagina(g))
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(indice())
    urls = [f'{BASE}/', f'{BASE}/guia/'] + [f"{BASE}/guia/{g['slug']}.html" for g in GUIAS] + [f'{BASE}/privacidad.html', f'{BASE}/terminos.html']
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{u}</loc><lastmod>{FECHA}</lastmod></url>\n' for u in urls) + '</urlset>\n'
    open(os.path.join(OUT, 'sitemap.xml'), 'w', encoding='utf-8').write(sm)
    open(os.path.join(OUT, 'robots.txt'), 'w', encoding='utf-8').write(f'User-agent: *\nAllow: /\n\nSitemap: {BASE}/sitemap.xml\n')
    print('guías', len(GUIAS), 'urls', len(urls))


if __name__ == '__main__':
    main()
