// Aplica el diccionario a lo que se dibuja: cada texto y cada rótulo que aparece en pantalla pasa por `tr()`.
// Solo cambia el contenido de los nodos de texto que ya existen (no agrega ni quita nodos), así React sigue
// trabajando sobre la misma estructura. Lo que escribe el usuario en campos de texto no se toca.
import { getLang, loadLang, tr, type Lang } from './index';

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);
// Por cada nodo que cambiamos: el texto original en español y lo que escribimos nosotros.
type Mark = { src: string; out: string; lang: Lang };
const done = new WeakMap<Text, Mark>();
const doneAttr = new WeakMap<Element, Record<string, Mark>>();

function text(node: Text): void {
  const v = node.nodeValue;
  if (!v) return;
  const mine = done.get(node);
  if (mine && mine.out === v && mine.lang === getLang()) return;      // es nuestra propia escritura, ya en este idioma
  const src = mine && mine.out === v ? mine.src : v;                   // al cambiar de idioma se parte del original
  const p = node.parentElement;
  if (!p || SKIP.has(p.tagName) || p.isContentEditable || p.closest('[data-notr]')) return;
  const out = tr(src);
  done.set(node, { src, out, lang: getLang() });
  if (out !== v) node.nodeValue = out;
}

function attrs(el: Element): void {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const mine = doneAttr.get(el)?.[a];
    if (mine && mine.out === v && mine.lang === getLang()) continue;
    const src = mine && mine.out === v ? mine.src : v;
    const out = tr(src);
    doneAttr.set(el, { ...doneAttr.get(el), [a]: { src, out, lang: getLang() } });
    if (out !== v) el.setAttribute(a, out);
  }
}

function tree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) { text(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (SKIP.has(el.tagName)) return;
  attrs(el);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (n.nodeType === Node.TEXT_NODE) text(n as Text); else attrs(n as Element); }
}

let watching = false;
function watch(): void {
  if (watching || typeof MutationObserver === 'undefined') return;
  watching = true;
  new MutationObserver((list) => {
    if (getLang() === 'es') return;
    for (const m of list) {
      if (m.type === 'characterData') text(m.target as Text);
      else if (m.type === 'attributes') attrs(m.target as Element);
      else for (const n of m.addedNodes) tree(n);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/** Empieza a traducir la pantalla. En español no hace nada. */
export function translatePage(): void {
  document.documentElement.lang = getLang();
  if (getLang() === 'es') return;
  tree(document.body);
  watch();
}

/**
 * Cambia el idioma de lo que está en pantalla sin recargar. Lo usan las auditorías para revisar cada pantalla
 * en todos los idiomas; el selector de Perfil recarga, porque fechas y números se calculan al dibujar.
 */
export async function previewLang(l: Lang): Promise<void> {
  await loadLang(l);
  document.documentElement.lang = getLang();
  tree(document.body);
  watch();
}
if (typeof window !== 'undefined') (window as unknown as { __iiLang?: (l: Lang) => Promise<void> }).__iiLang = previewLang;
