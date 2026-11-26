import { tr } from '../i18n';
// Tarjeta de imagen para compartir en redes (1080 × 1350, formato vertical de Instagram).
export interface CardData {
  kicker: string; title: string; subtitle: string;
  stats: { value: string; label: string }[];
  lines: { left: string; right: string }[];
}

const FONT = 'Archivo, system-ui, sans-serif';
function fit(c: CanvasRenderingContext2D, text: string, max: number): string {
  if (c.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && c.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}
function wrap(c: CanvasRenderingContext2D, text: string, max: number, lines: number): string[] {
  const words = text.split(/\s+/); const out: string[] = []; let cur = '';
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (!cur || c.measureText(next).width <= max) { cur = next; continue; }
    // En la última línea permitida se junta lo que queda y se recorta con puntos suspensivos.
    if (out.length === lines - 1) { cur = `${cur} ${words.slice(i).join(' ')}`; break; }
    out.push(cur); cur = words[i];
  }
  out.push(fit(c, cur, max));
  return out;
}
function round(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

export async function drawCard(d: CardData): Promise<Blob> {
  const W = 1080, H = 1350, P = 84;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  try { await Promise.all([document.fonts.load(`800 60px ${FONT}`), document.fonts.load(`500 40px ${FONT}`)]); } catch { /* se usa la fuente del sistema */ }
  c.fillStyle = '#060914'; c.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, col: string) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); };
  glow(120, 60, 900, 'rgba(255,106,26,.42)'); glow(W - 60, H - 120, 820, 'rgba(26,140,150,.34)');

  // Marca
  // Marca: el disco que se va completando.
  const mx = P + 36, my = 108, lg = c.createLinearGradient(mx + 22, my - 34, mx - 22, my + 34); lg.addColorStop(0, '#ffc56e'); lg.addColorStop(0.45, '#ff7a22'); lg.addColorStop(1, '#ff4a12');
  c.lineCap = 'round'; c.lineWidth = 8;
  c.strokeStyle = 'rgba(180,205,255,.16)'; c.beginPath(); c.arc(mx, my, 32, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = lg; c.beginPath(); c.arc(mx, my, 32, -Math.PI / 2, -Math.PI / 2 + (282 * Math.PI) / 180); c.stroke();
  c.fillStyle = '#2f505a'; c.beginPath(); c.arc(mx, my, 22, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#060914'; c.beginPath(); c.arc(mx, my, 6, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f2f6f6'; c.textBaseline = 'alphabetic';
  c.font = `800 40px ${FONT}`; c.fillText('IRON', P + 92, 108);
  c.font = `500 24px ${FONT}`; c.fillStyle = '#949fb8'; c.fillText('I N T E L L I G E N C E', P + 92, 140);

  // Título
  c.fillStyle = '#ffb054'; c.font = `600 34px ${FONT}`; c.fillText(fit(c, tr(d.kicker), W - 2 * P), P, 300);
  c.fillStyle = '#f2f6f6'; c.font = `800 88px ${FONT}`;
  let y = 396;
  for (const ln of wrap(c, tr(d.title), W - 2 * P, 2)) { c.fillText(ln, P, y); y += 96; }
  c.fillStyle = '#c3ccd0'; c.font = `500 36px ${FONT}`; c.fillText(fit(c, tr(d.subtitle), W - 2 * P), P, y - 28);
  y += 30;

  // Cifras
  const n = Math.max(1, d.stats.length), gap = 24, bw = (W - 2 * P - gap * (n - 1)) / n;
  d.stats.forEach((s, i) => {
    const x = P + i * (bw + gap);
    round(c, x, y, bw, 190, 36); c.fillStyle = 'rgba(160,190,255,.09)'; c.fill(); c.strokeStyle = 'rgba(180,205,255,.18)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = ['#ff6a1a', '#ffb054', '#58c7ff', '#34e0a1'][i % 4]; c.font = `800 72px ${FONT}`; c.fillText(fit(c, tr(s.value), bw - 48), x + 28, y + 102);
    c.fillStyle = '#949fb8'; c.font = `500 30px ${FONT}`; c.fillText(fit(c, tr(s.label), bw - 48), x + 28, y + 152);
  });
  y += 190 + 56;

  // Detalle
  const rows = d.lines.slice(0, Math.max(0, Math.floor((H - 150 - y) / 76)));
  rows.forEach((ln) => {
    c.font = `700 36px ${FONT}`; c.fillStyle = '#f2f6f6'; c.textAlign = 'right'; c.fillText(tr(ln.right), W - P, y + 40);
    const rw = c.measureText(ln.right).width;
    c.textAlign = 'left'; c.font = `500 36px ${FONT}`; c.fillStyle = '#c3ccd0'; c.fillText(fit(c, tr(ln.left), W - 2 * P - rw - 36), P, y + 40);
    c.fillStyle = 'rgba(180,205,255,.14)'; c.fillRect(P, y + 64, W - 2 * P, 2);
    y += 76;
  });

  c.fillStyle = '#949fb8'; c.font = `600 28px ${FONT}`; c.fillText(tr('REGISTRA. ANALIZA. PROGRESA.'), P, H - 78);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo crear la imagen'))), 'image/png'));
}

/** Abre el menú de compartir del teléfono con la imagen; si no existe, la descarga. Devuelve cómo terminó. */
export async function shareBlob(blob: Blob, name: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], text }); return 'shared'; } catch (e) { if ((e as Error)?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
/** Comparte un enlace; si el teléfono no tiene menú de compartir, lo copia. */
export async function shareLink(url: string, title: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share) { try { await navigator.share({ title, url }); return 'shared'; } catch (e) { if ((e as Error)?.name === 'AbortError') return 'cancelled'; } }
  try { await navigator.clipboard.writeText(url); } catch { window.prompt('Copia este enlace', url); }
  return 'copied';
}
/** Comparte un texto corto (por ejemplo, un código); si no hay menú de compartir, lo copia. */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share) { try { await navigator.share({ text }); return 'shared'; } catch (e) { if ((e as Error)?.name === 'AbortError') return 'cancelled'; } }
  try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copia este texto', text); }
  return 'copied';
}
