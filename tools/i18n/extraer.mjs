// Extrae del código los textos que ve el usuario, para traducirlos.
// Uso: node tools/i18n/extraer.mjs <idioma>   → escribe tools/i18n/pendiente.<idioma>.txt con lo que falta traducir.
// Recorre src/ (sin pruebas) con el compilador de TypeScript y junta: texto de JSX, cadenas y plantillas.
// Una plantilla con valores queda como «Sube a ${…} kg»; el motor de idiomas reemplaza los números al mostrar.
import ts from 'typescript';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
// No se recorren las pruebas, las figuras ni el panel interno (es solo para administración y va solo en español).
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/tests|figure$|panel$/.test(p)) walk(p); } else if (/\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f)) files.push(p); } };
walk('src');

const norm = (s) => s.replace(/\s+/g, ' ').trim();
// ¿Parece un texto para personas? Tiene letras y no es una clase CSS, una ruta, un id ni una clave técnica.
const human = (s) => {
  if (s.length < 2 || !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(s)) return false;
  if (/^[a-z0-9_\-:./#\[\]()%!,&>+*='" ]+$/.test(s) && !/[áéíóúñ]/.test(s) && !/ (de|la|el|en|con|por|para|tu|tus|un|una|los|las|del|al|que|se|sin|más|y|o|no|es) /.test(` ${s} `)) return false;   // clases, ids, rutas
  if (/^(https?:|\.\/|\/|#\/|data:|[A-Z0-9_]+$)/.test(s)) return false;
  if (/^[A-Za-z]+(\.[A-Za-z]+)+$/.test(s)) return false;
  if (/^[Mm][\d.\- ]/.test(s) || /^[a-z]+[A-Z][A-Za-z]*$/.test(s) || /\.(csv|json|png|jpg|glb|svg|webp)\b/.test(s) || /^[\w-]+\/[\w-]+$/.test(s)) return false;   // trazados SVG, identificadores, archivos
  return true;
};
const out = new Map();          // texto → { n, where, kind }
const add = (text, file, kind) => { const t = norm(text); if (!human(t)) return; const e = out.get(t) ?? { n: 0, where: file.replace('src/', ''), kind }; e.n++; out.set(t, e); };

for (const file of files) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxText(node)) add(node.text, file, 'jsx');
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const p = node.parent;
      const tech = (ts.isJsxAttribute(p) && /^(className|class|id|key|type|name|role|href|src|to|viewBox|d|fill|stroke|inputMode|autoComplete|rel|target|htmlFor|variant|size|tone|as|icon|dataKey|stackId|xmlns)$/.test(p.name.getText()))
        || (ts.isCallExpression(p) && /^(clsx|cx|cn|classNames|require|import|addEventListener|removeEventListener|getItem|setItem|removeItem|querySelector|querySelectorAll|getAttribute|setAttribute|createElement|rpc|from|select|eq|order)$/.test(p.expression.getText().split('.').pop()))
        || ts.isTypeNode(p) || ts.isLiteralTypeNode(p) || (ts.isPropertyAssignment(p) && p.name === node) || ts.isElementAccessExpression(p) || ts.isCaseClause(p)
        || (ts.isBinaryExpression(p) && /^(===|!==|==|!=)$/.test(p.operatorToken.getText()));
      const prop = ts.isPropertyAssignment(p) && p.initializer === node ? p.name.getText() : '';
      const call = ts.isCallExpression(p) ? p.expression.getText() : '', arg = ts.isCallExpression(p) ? p.arguments.indexOf(node) : -1;
      const inArr = ts.isArrayLiteralExpression(p) && ts.isCallExpression(p.parent) ? `${p.parent.expression.getText()}#${p.parent.arguments.indexOf(p)}` : '';
      // Alias de búsqueda y modelos comerciales: no se traducen.
      const data = /^(a|aka|id|ex|eq|zone|load|muscles|pattern|icon|path|key|kind|tag)$/.test(prop) || (call === 'm' && (arg === 0 || arg === 2 || arg >= 3 && arg !== 6)) || inArr === 'm#7' || (call === 'e' && arg !== 1) || (call === 'x' && (arg === 0 || arg === 10));
      if (!tech && !data) add(node.text, file, 'str');
    } else if (ts.isTemplateExpression(node)) {
      let t = node.head.text;
      for (const span of node.templateSpans) t += '{*}' + span.literal.text;
      if (/[A-Za-zÁÉÍÓÚáéíóúñ]{3}/.test(node.head.text + node.templateSpans.map((s) => s.literal.text).join(' '))) add(t, file, 'tpl');
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}
const list = [...out.entries()].map(([text, e]) => ({ text, ...e }));
const lang = process.argv[2];
if (!lang) { console.log(`${list.length} textos distintos, ${list.reduce((a, x) => a + x.text.length, 0)} caracteres`); process.exit(0); }
// Orden de trabajo: primero pantallas y rótulos, después nombres del catálogo, al final los textos largos de técnica.
const rank = (w) => /^(pages|ui)\//.test(w) || w === 'App.tsx' ? 0 : /^data\//.test(w) ? 1 : /catalog\/exercises/.test(w) ? 3 : /catalog\/machines/.test(w) ? 4 : /exerciseLibrary/.test(w) ? 5 : /catalog\/patterns/.test(w) ? 6 : /(progression|assistant|evidence)/.test(w) ? 7 : 2;
const langs = lang.split(',');
const dicts = langs.map((l) => JSON.parse(readFileSync(`src/i18n/${l}.json`, 'utf8')));
const missing = list.filter((x) => dicts.some((d) => !(x.text in d))).sort((a, b) => rank(a.where) - rank(b.where) || a.where.localeCompare(b.where));
// «número|texto», agrupado por archivo. El lote de respuesta lleva «número|traducción» (o «número|en|pt»).
let outTxt = '', last = '';
missing.forEach((x, i) => { if (x.where !== last) { outTxt += `# ${x.where}\n`; last = x.where; } outTxt += `${i + 1}|${x.text}\n`; });
writeFileSync('tools/i18n/pendiente.txt', outTxt);
writeFileSync('tools/i18n/pendiente.json', JSON.stringify(missing.map((x) => x.text)));
console.log(`${list.length} textos en el código; faltan ${missing.length} (${missing.reduce((a, x) => a + x.text.length, 0)} caracteres) → tools/i18n/pendiente.txt`);
