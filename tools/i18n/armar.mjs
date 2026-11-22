// Junta los lotes de traducción con la lista de textos pendientes y actualiza los diccionarios.
// Uso: node tools/i18n/armar.mjs   (lee tools/i18n/pendiente.json y tools/i18n/lotes/*.txt)
// Cada línea de un lote: «número|inglés|portugués». Los textos sueltos van en tools/i18n/extras.txt. Si falta el portugués, esa línea solo actualiza el inglés.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
const src = existsSync('tools/i18n/pendiente.json') ? JSON.parse(readFileSync('tools/i18n/pendiente.json', 'utf8')) : [];
const dict = { en: JSON.parse(readFileSync('src/i18n/en.json', 'utf8')), pt: JSON.parse(readFileSync('src/i18n/pt.json', 'utf8')) };
const count = (s) => (s.match(/\{\*\}|\{\d+\}/g) ?? []).length;
let bad = 0; const seen = { en: 0, pt: 0 };
const lotes = existsSync('tools/i18n/lotes') ? readdirSync('tools/i18n/lotes').filter((x) => x.endsWith('.txt')).sort() : [];
for (const f of lotes) {
  for (const line of readFileSync(`tools/i18n/lotes/${f}`, 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [n, en, pt] = line.split('|');
    const key = src[Number(n) - 1];
    if (!key) { console.log(`${f}: número fuera de la lista: ${line.slice(0, 60)}`); bad++; continue; }
    for (const [l, v] of [['en', en], ['pt', pt]]) {
      if (v === undefined || v === '') continue;
      if (count(v) !== count(key)) { console.log(`${f} ${n} [${l}]: cambia la cantidad de valores: «${key.slice(0, 50)}» → «${v.slice(0, 50)}»`); bad++; continue; }
      seen[l]++;
      dict[l][key] = v.trim();     // también si queda igual al español: no pasa por las reglas de respaldo y, si es plantilla, sus valores se traducen
    }
  }
}
// Textos que el extractor no ve (palabras sueltas en minúsculas, rótulos para lectores de pantalla armados por partes):
// tools/i18n/extras.txt, una línea «español|inglés|portugués». Aquí una plantilla igual al español sí se guarda,
// porque sus valores se traducen por separado («Aumentar {*}» → «Aumentar Peso, série 1»).
for (const line of readFileSync('tools/i18n/extras.txt', 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const [key, en, pt] = line.split('|');
  for (const [l, v] of [['en', en], ['pt', pt]]) {
    if (v === undefined || v === '') continue;
    if (count(v) !== count(key)) { console.log(`extras [${l}]: cambia la cantidad de valores: «${key}» → «${v}»`); bad++; continue; }
    seen[l]++; dict[l][key] = v;
  }
}
for (const l of ['en', 'pt']) {
  const sorted = Object.fromEntries(Object.entries(dict[l]).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(`src/i18n/${l}.json`, JSON.stringify(sorted, null, 0).replace(/","/g, '",\n"') + '\n');
  console.log(`${l}: ${seen[l]} líneas leídas, ${Object.keys(sorted).length} entradas en el diccionario`);
}
if (bad) { console.log(`${bad} líneas con problemas`); process.exit(1); }
