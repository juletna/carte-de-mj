/**
 * Primitives Canvas communes aux thèmes (vectoriel, papier) : un rectangle, un rectangle arrondi, un rond, chacun rempli
 * puis cerné si on le demande. L'ordre des appels au contexte est celui que les journaux de rendu de tests/references.js
 * fixent : ne pas le changer. Les corps d'objets restent dans chaque thème, ils ne se ressemblent pas.
 */
export function rect(ctx, x, y, w, h, fond, trait, epaisseur = 1) {
  ctx.beginPath(); ctx.rect(x, y, w, h);
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (trait) { ctx.strokeStyle = trait; ctx.lineWidth = epaisseur; ctx.stroke(); }
}
export function rectArrondi(ctx, x, y, w, h, r, fond, trait, epaisseur = 1) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (trait) { ctx.strokeStyle = trait; ctx.lineWidth = epaisseur; ctx.stroke(); }
}
export function rond(ctx, x, y, r, fond, trait, epaisseur = 1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (trait) { ctx.strokeStyle = trait; ctx.lineWidth = epaisseur; ctx.stroke(); }
}

/**
 * Le sens du coin de la salle le plus proche d'un objet, dans le repère local de son dessin : [sx, sy], chacun −1 ou +1, de l'objet vers le coin
 * (−1, −1 : le coin en haut à gauche du dessin). Sert aux objets qui se logent dans un angle (la toile d'araignée). `plan` est le sixième argument
 * du dessin d'un objet ; sans lui (vignette de la palette), le coin en haut à gauche.
 */
export function sensDuCoin(o, plan) {
  if (!plan || !Number.isFinite(plan.largeur) || !Number.isFinite(plan.longueur)) return [-1, -1];
  const dx = o.x + o.l / 2 >= plan.largeur / 2 ? 1 : -1, dy = o.y + o.h / 2 >= plan.longueur / 2 ? 1 : -1;
  const a = ((180 - (o.rotation ?? 180)) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); // le contexte est tourné de (rotation − 180)° : on remonte du plan au local
  return [Math.round(dx * c - dy * s) || -1, Math.round(dx * s + dy * c) || -1];
}

/**
 * Une toile d'araignée : cinq fils en éventail à partir du coin (cx, cy), vers le sens (dx, dy) (chacun −1 ou +1), de longueur `L`, et quatre arcs
 * qui les relient. Même figure que les toiles semées par le thème peint (peint/details.js).
 */
export function toileDans(ctx, cx, cy, dx, dy, L, couleur, epaisseur) {
  const rayons = [0, 0.25, 0.5, 0.75, 1].map((u) => (u * Math.PI) / 2);
  ctx.strokeStyle = couleur; ctx.lineWidth = epaisseur;
  ctx.beginPath();
  for (const a of rayons) { ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * Math.cos(a) * L, cy + dy * Math.sin(a) * L); }
  for (const k of [0.3, 0.5, 0.7, 0.9]) {
    rayons.forEach((a, i) => {
      const px = cx + dx * Math.cos(a) * L * k, py = cy + dy * Math.sin(a) * L * k;
      if (i) ctx.quadraticCurveTo(cx + dx * Math.cos(a - 0.4) * L * k * 0.82, cy + dy * Math.sin(a - 0.4) * L * k * 0.82, px, py); else ctx.moveTo(px, py);
    });
  }
  ctx.stroke();
}

/** Un nombre stable entre 0 et 1, tiré de la place d'un objet et d'un rang : une forme irrégulière (flaque, rocher) ne change pas d'un dessin à l'autre. */
export function hasard(o, k) {
  let h = (((o?.x ?? 0) + 1) * 374761393 + ((o?.y ?? 0) + 1) * 668265263 + k * 1442695041) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Trace (sans remplir) un contour irrégulier centré sur (0, 0) : `n` points sur une ellipse de rayons rx, ry, chacun écarté de ±`ecart` (0,2 = 20 %). */
export function contourIrregulier(ctx, rx, ry, o, n = 12, ecart = 0.2, rang = 0) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, f = 1 - ecart + 2 * ecart * hasard(o, rang + i);
    const x = Math.cos(a) * rx * f, y = Math.sin(a) * ry * f;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/**
 * Un objet allongé dessiné pour être long selon x (l'autel, 2 × 1) : si son repère local est plus haut que large (emprise de 2 × 1 cases mais regard
 * à l'est ou à l'ouest, donc repère de 1 × 2), il est dessiné tourné d'un quart de tour dans un repère de 2 × 1, sa face de devant du côté de
 * l'écran qui regarde le sud. Les décors (nappe, pentagramme, soleil, bougies, taches) en gardent leurs proportions à toutes les rotations.
 * Le repère des volumes (volumesLocaux) lit la matrice du contexte : la fausse 3D suit la rotation.
 */
export const enLong = (dessin) => (ctx, w, h, t, o, plan) => {
  if (h <= w) return dessin(ctx, w, h, t, o, plan);
  ctx.save();
  ctx.rotate(o?.rotation === 270 ? -Math.PI / 2 : Math.PI / 2);
  dessin(ctx, h, w, t, o, plan);
  ctx.restore();
};
