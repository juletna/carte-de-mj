/**
 * Le trait « à la main » du thème peint : contours bruns irréguliers (`chemin`, `cercle`, `encre`), dégradés et couleurs en teinte-saturation-
 * luminosité. Les fonctions qui tirent au sort prennent un générateur `r` (bruit.js : `alea(graine)`) : jamais Math.random, le rendu reste déterministe.
 */
import { etat } from './etat.js';

export const ENCRE = '#231b16';

/** Trace une ligne brisée qui tremble un peu (amplitude `amp` px) ; `ferme` la referme. */
export function chemin(ctx, pts, ferme, r, amp = 0.5, pas = 7) {
  ctx.beginPath();
  const n = pts.length, segs = ferme ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n];
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, k = Math.max(1, Math.round(L / pas)), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
    for (let s = 0; s < k; s++) {
      const u = s / k, j = s ? (r() - 0.5) * 2 * amp : 0;
      const x = x0 + (x1 - x0) * u + nx * j, y = y0 + (y1 - y0) * u + ny * j;
      if (i || s) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
  }
  if (ferme) ctx.closePath(); else ctx.lineTo(...pts[n - 1]);
}

/** Les quatre coins d'un rectangle, rentrés de `i`. */
export const rectPts = (x, y, l, h, i = 0) => [[x + i, y + i], [x + l - i, y + i], [x + l - i, y + h - i], [x + i, y + h - i]];

/** Un rectangle aux coins arrondis (rayon `rr`), en points. */
export function arrondi(x, y, l, h, rr) {
  const p = [];
  for (const [cx, cy, a0] of [[x + l - rr, y + rr, -Math.PI / 2], [x + l - rr, y + h - rr, 0], [x + rr, y + h - rr, Math.PI / 2], [x + rr, y + rr, Math.PI]]) {
    for (let k = 0; k <= 3; k++) { const a = a0 + (k * Math.PI) / 6; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  }
  return p;
}

/** Trace un cercle qui tremble un peu. */
export function cercle(ctx, cx, cy, rayon, r, amp = 0.4) {
  ctx.beginPath();
  const n = Math.max(16, Math.round(rayon / 2));
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rr = rayon + (r() - 0.5) * 2 * amp; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath();
}

/** Remplit le tracé courant de `fond` (avec une ombre portée si `ombre`), puis le cerne d'encre sur `ep` px (0 : sans contour). */
export function encre(ctx, fond, ep = 1.4, ombre = false) {
  if (fond) {
    if (ombre) { ctx.save(); ctx.shadowColor = 'rgba(8,6,4,0.5)'; ctx.shadowOffsetX = 3 * etat.dpr; ctx.shadowOffsetY = 4 * etat.dpr; ctx.shadowBlur = 4 * etat.dpr; }
    ctx.fillStyle = fond; ctx.fill();
    if (ombre) ctx.restore();
  }
  if (ep) { ctx.lineWidth = ep; ctx.strokeStyle = ENCRE; ctx.stroke(); }
}

/** Trace le chemin courant d'une couleur et d'une épaisseur. */
export function trait(ctx, couleur, ep) { ctx.lineWidth = ep; ctx.strokeStyle = couleur; ctx.stroke(); }

/** Dégradé linéaire de (x0, y0) à (x1, y1). */
export function dl(ctx, x0, y0, x1, y1, c0, c1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  return g;
}

/** Dégradé radial, lumineux en haut à gauche (la lumière vient du nord-ouest). */
export function dr(ctx, cx, cy, r, c0, c1) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  return g;
}

export const hsl = (h, s, l) => `hsl(${h} ${s}% ${l}%)`;
/** Une couleur [teinte, saturation, luminosité] éclaircie ou assombrie du facteur `k`. */
export const ton = (c, k = 1) => `hsl(${c[0]} ${c[1]}% ${Math.max(0, Math.min(100, c[2] * k))}%)`;
/** Le centre (moyenne) d'une liste de points. */
export const centre = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
