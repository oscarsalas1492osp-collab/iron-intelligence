// Mide cuánto de lo que se ve en pantalla está traducido. Uso: node tools/i18n/revisar.mjs <en|pt> [textos.json]
// Los textos salen de la auditoría de pantallas (tools/auditoria/pantallas.py deja /tmp/auditoria-out/textos.json).
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const lang = process.argv[2] ?? 'en', file = process.argv[3] ?? '/tmp/auditoria-out/textos.json';
const out = join(tmpdir(), `i18n-${Date.now()}.mjs`);
await build({ entryPoints: ['src/i18n/index.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', external: ['./en.json', './pt.json'] });
const { useDictionary, tr } = await import(pathToFileURL(out).href);
const dict = JSON.parse(readFileSync(`src/i18n/${lang}.json`, 'utf8'));
useDictionary(lang, dict);
const texts = JSON.parse(readFileSync(file, 'utf8'));
// Parece español: tildes o palabras propias del español. Sirve para no listar nombres propios, números o datos de prueba.
const spanish = (t) => /[ñ¿¡]|ción\b|\b(el|la|los|las|del|con|sin|para|por|una|un|tu|tus|más|y|que|se|no|hay|esta|este|series?|ejercicios?|entrenamientos?|rutinas?|peso|día|días|semana|hoy)\b/i.test(t);
const miss = texts.filter((t) => /[A-Za-zÀ-ÿ]{2}/.test(t) && tr(t) === t && !(t in dict) && spanish(t));
console.log(`${lang}: ${texts.length} textos en pantalla, ${miss.length} sin traducir`);
for (const t of miss) console.log('  ' + t.slice(0, 150));
