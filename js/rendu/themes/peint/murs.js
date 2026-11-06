/**
 * Murs, ombre au pied des murs et portes du thème peint.
 *
 * Avec relief (kp > 0), chaque segment de mur (segments.js) est une FACE : un quadrilatère entre le pied du mur (le bord du sol) et son haut
 * (le bord monté à la hauteur 1, donc écarté du centre), garnie de trois assises de briques, ombrée selon la lumière du nord-ouest. Le DESSUS
 * du mur est une bande presque noire, d'épaisseur EPAISSEUR_MUR, posée à l'extérieur du haut de la face. Les faces que le centre ne voit pas
 * (l'envers d'un pan de mur, au fond d'une entaille) ne montrent que le balayage de leur dessus sur le sol. Sans relief, il ne reste que la bande,
 * à la place exacte des murs du thème vectoriel.
 *
 * Les formes non rectangulaires suivent le même chemin : un segment par mur continu, coins sortants prolongés de l'épaisseur du mur.
 *
 * Ambiance et état de la salle (lot « ambiance », ambiance.js) : l'ambiance teinte les pierres ; une salle usée a des blocs ébréchés, des fissures et un peu de mousse
 * au pied des faces ; en ruine, des blocs manquent (sur les faces comme sur le dessus), le dessus se couvre de mousse et le lierre grimpe sur les faces.
 * Les tirages au sort supplémentaires ne se font que pour une salle usée ou en ruine : une salle neuve garde exactement le dessin d'avant.
 */
import { EPAISSEUR_MUR, ancragePorte } from '../../geometrie.js';
import { tracerSol } from '../../trace.js';
import { haut as hautVue, faceVisible, eclairage } from '../../perspective.js';
import { segmentsDeMurs } from './segments.js';
import { etat } from './etat.js';
import { alea, graineDeTexte } from './bruit.js';
import { chemin, encre, trait, dl, ENCRE } from './trait.js';
import { couleurMur, usureDe } from './ambiance.js';
import { dessinerFaceDessinee, tacheMousseDessinee } from './murs-dessines.js';

const DESSUS = '#060504'; // le dessus des murs : presque noir, bien distinct des faces et du sol
const FOND_FACE = '#120f0c';
const LISERE_DESSUS = 'rgba(255,236,200,0.4)'; // murs dessinés : fin liseré clair sur l'arête intérieure du dessus

/** Couleur de pierre des murs selon le sol : teinte, saturation, luminosité [clair, foncé]. */
export const MURS_PEINTS = {
  pierre: { h: 215, s: 7, l: [56, 70] },
  marbre: { h: 32, s: 12, l: [58, 72] },
  bois: { h: 28, s: 20, l: [46, 60] },
  terre: { h: 30, s: 16, l: [46, 60] },
  sable: { h: 38, s: 22, l: [60, 74] },
  herbe: { h: 95, s: 10, l: [48, 62] },
  glace: { h: 200, s: 14, l: [62, 76] },
};
export const murDeSol = (sol) => MURS_PEINTS[sol] || MURS_PEINTS.pierre;
/** La couleur d'une pierre de luminosité `l`, teintée par l'ambiance de la salle en cours de dessin. */
const pierre = (mur, l) => couleurMur(mur, l, etat.ambiance);

/** Un segment de mur en pixels, avec le milieu pour le tri. */
function enPixels(s, t) {
  const A = [s.a[0] * t, s.a[1] * t], B = [s.b[0] * t, s.b[1] * t];
  return { ...s, A, B, milieu: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2] };
}

/** Graine d'un segment : stable quelle que soit l'ordre de dessin. */
const aleaSegment = (s) => alea((etat.graine ^ graineDeTexte(`${s.mur}|${s.a}|${s.b}`)) >>> 0);

/** Les murs de la salle : faces briquées, dessus sombre (voir l'en-tête). */
export function dessinerMurs(ctx, plan, t) {
  const { vue } = etat, e = EPAISSEUR_MUR * t, mur = murDeSol(plan.sol);
  const segs = segmentsDeMurs(plan).map((s) => enPixels(s, t));
  // Du plus loin au plus proche du centre : les faces d'un mur proche recouvrent celles d'un mur lointain.
  segs.sort((p, q) => Math.hypot(q.milieu[0] - vue.cx, q.milieu[1] - vue.cy) - Math.hypot(p.milieu[0] - vue.cx, p.milieu[1] - vue.cy));
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (vue.kp > 0) {
    for (const s of segs) {
      if (faceVisible(vue, s.A, s.B, s.normale)) dessinerFace(ctx, aleaSegment(s), s, mur, t);
      else balayerDessus(ctx, s);
    }
  }
  for (const s of segs) dessinerDessus(ctx, aleaSegment(s), s, mur, t, e);
  ctx.restore();
}

/** La face d'un mur tournée vers le centre : trois assises de briques. */
function dessinerFace(ctx, r, s, mur, t) {
  const { vue } = etat;
  const P = (u, v) => hautVue(vue, s.A[0] + (s.B[0] - s.A[0]) * u, s.A[1] + (s.B[1] - s.A[1]) * u, v);
  const long = Math.hypot(s.B[0] - s.A[0], s.B[1] - s.A[1]);
  const k = 11 * eclairage(vue, s.normale[0], s.normale[1]) - 11; // de −22 (face à l'opposé de la lumière) à 0
  if (etat.details === 'riches') { // murs dessinés (murs-dessines.js) ; « sobres » continue ci-dessous, inchangé
    return dessinerFaceDessinee(ctx, r, mur, t, P, long, k, -(s.B[0] - s.A[0]) - (s.B[1] - s.A[1]));
  }
  ctx.beginPath();
  [P(0, 0), P(1, 0), P(1, 1), P(0, 1)].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = FOND_FACE; ctx.fill();
  const usure = usureDe(etat.etatSalle);
  for (const [v0, v1, dec] of [[0, 0.34, 0], [0.34, 0.67, 0.25 * t], [0.67, 1, 0.1 * t]]) {
    let p = 0;
    while (p < long - 1) {
      let l = p === 0 && dec ? dec : t * (0.45 + r() * 0.4);
      if (p + l > long - 0.2 * t) l = long - p;
      if (usure === 2 && r() < (v0 > 0.6 ? 0.14 : 0.07)) { p += l; continue; } // bloc manquant : on voit le fond sombre de la face (plus souvent en haut)
      const u0 = (p + 1) / long, u1 = (p + l - 1) / long, g = 0.05, um = (u0 + u1) / 2;
      const Lm = mur.l[0] + k + r() * 8, [ax, ay] = P(um, v0), [bx, by] = P(um, v1);
      if (u1 > u0) {
        chemin(ctx, [P(u0, v0 + g), P(u1, v0 + g), P(u1, v1 - g), P(u0, v1 - g)], true, r, 0.35);
        encre(ctx, dl(ctx, ax, ay, bx, by, pierre(mur, Lm - 12 - usure * 2), pierre(mur, Lm + 4 - usure * 2)), 1.1);
        if (usure && r() < (usure === 2 ? 0.12 : 0.1)) ebrecher(ctx, r, P, u0, u1, v0 + g, v1 - g); // bloc ébréché
      }
      p += l;
    }
  }
  chemin(ctx, [P(0, 0), P(1, 0)], false, r, 0.3); trait(ctx, '#000', 2);
  chemin(ctx, [P(0, 1), P(1, 1)], false, r, 0.4); trait(ctx, ENCRE, 2);
  for (const u of [0, 1]) { chemin(ctx, [P(u, 0), P(u, 1)], false, r, 0.3); trait(ctx, ENCRE, 1.6); }
  if (usure) abimerFace(ctx, r, P, long, usure, t);
}

/** Un coin du bloc (u0–u1, v0–v1) manque : un petit triangle du fond sombre, en haut à gauche ou à droite. */
function ebrecher(ctx, r, P, u0, u1, v0, v1) {
  const droite = r() < 0.5, du = (u1 - u0) * (0.25 + r() * 0.3), dv = (v1 - v0) * (0.3 + r() * 0.35);
  const [ua, ub] = droite ? [u1 - du, u1] : [u0, u0 + du], pivot = droite ? u1 : u0;
  ctx.beginPath();
  [P(ua, v1), P(ub, v1), P(pivot, v1 - dv)].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = FOND_FACE; ctx.fill();
}

/** Une tache de mousse, floue, au point (x, y) de rayon `rr`. */
function tacheMousse(ctx, x, y, rr, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
  g.addColorStop(0, `rgba(78,108,48,${a})`); g.addColorStop(0.6, `rgba(72,104,44,${a * 0.8})`); g.addColorStop(1, 'rgba(72,104,44,0)');
  ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
}

/** L'usure d'une face : fissures, mousse au pied et, en ruine, lierre qui grimpe. */
function abimerFace(ctx, r, P, long, usure, t) {
  const nb = Math.max(1, Math.round(long / (t * (usure === 2 ? 2.5 : 4))));
  for (let i = 0; i < nb; i++) { // une fissure en zigzag, du haut vers le bas
    const u = 0.04 + r() * 0.92, pts = [];
    for (let v = 0.2 + r() * 0.75, n = 0; v > 0.05 && n < 7; v -= 0.07 + r() * 0.1, n++) pts.push(P(Math.min(0.99, Math.max(0.01, u + (r() - 0.5) * 0.02 * (long / t))), v));
    if (pts.length > 1) { chemin(ctx, pts, false, r, 0.5); trait(ctx, 'rgba(0,0,0,0.55)', 0.9); }
  }
  for (let i = 0, n = Math.round(long / (t * 0.7)) * usure; i < n; i++) { // mousse au pied du mur
    const [x, y] = P(r(), 0.03 + r() * 0.08);
    tacheMousse(ctx, x, y, t * (0.1 + r() * 0.12), usure === 2 ? 0.8 : 0.5);
  }
  if (usure < 2) return;
  for (let i = 0, n = Math.max(1, Math.round(long / (t * 3.5))); i < n; i++) lierre(ctx, r, P, 0.06 + r() * 0.88, 0.45 + r() * 0.5);
}

/** Du lierre : une tige sinueuse du haut de la face (v = 0,95) jusqu'à `bas`, avec ses feuilles de part et d'autre. */
function lierre(ctx, r, P, u, bas) {
  const pts = [];
  for (let v = 0.95, derive = 0; v >= 1 - bas; v -= 0.1) { derive += (r() - 0.5) * 0.012; pts.push(P(u + derive, v)); }
  if (pts.length < 2) return;
  chemin(ctx, pts, false, r, 0.6); trait(ctx, '#2f4a1c', 1.4);
  for (const [px, py] of pts) for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(px + s * 3, py, 2.8, 1.8, s * 0.6, 0, 7);
    encre(ctx, dl(ctx, px, py - 2, px, py + 2, '#7fae4a', '#3f6a24'), 0.5);
  }
}

/** Le haut d'un mur dont on ne voit pas la face recouvre le sol entre son pied et son haut : tout sombre. */
function balayerDessus(ctx, s) {
  const { vue } = etat, a = hautVue(vue, s.A[0], s.A[1], 1), b = hautVue(vue, s.B[0], s.B[1], 1);
  ctx.beginPath();
  [s.A, s.B, b, a].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = DESSUS; ctx.fill();
}

/** Le dessus du mur : une bande sombre en blocs, à l'extérieur du haut de la face, coins sortants prolongés. */
function dessinerDessus(ctx, r, s, mur, t, e) {
  const { vue } = etat, ep = e * (1 + vue.kp), usure = usureDe(etat.etatSalle);
  let [ax, ay] = hautVue(vue, s.A[0], s.A[1], 1), [bx, by] = hautVue(vue, s.B[0], s.B[1], 1);
  const long0 = Math.hypot(bx - ax, by - ay) || 1, dx = (bx - ax) / long0, dy = (by - ay) / long0;
  if (s.avant) { ax -= dx * ep; ay -= dy * ep; }
  if (s.apres) { bx += dx * ep; by += dy * ep; }
  const long = Math.hypot(bx - ax, by - ay);
  const ox = -s.normale[0] * ep, oy = -s.normale[1] * ep; // vers l'extérieur de la salle
  const Q = (u, v) => [ax + dx * u + (ox * v) / ep, ay + dy * u + (oy * v) / ep]; // u en px le long du mur, v en px vers l'extérieur
  ctx.beginPath();
  [Q(0, 0), Q(long, 0), Q(long, ep), Q(0, ep)].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = DESSUS; ctx.fill();
  let p = 0;
  while (p < long - 1) {
    let l = t * (0.4 + r() * 0.45);
    if (p + l > long - 0.25 * t) l = long - p;
    const L = 11 + r() * 6, i = 1.2;
    if (usure === 2 && r() < 0.1) { p += l; continue; } // bloc manquant dans le dessus : il ne reste que le fond noir
    if (l > 2 * i + 0.5) {
      chemin(ctx, [Q(p + i, i), Q(p + l - i, i), Q(p + l - i, ep - i), Q(p + i, ep - i)], true, r, 0.4);
      const [gx0, gy0] = Q(p, 0), [gx1, gy1] = Q(p + l, ep);
      ctx.fillStyle = dl(ctx, gx0, gy0, gx1, gy1, pierre(mur, L + 4), pierre(mur, L - 4)); ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,240,220,0.09)'; ctx.stroke();
    }
    p += l;
  }
  if (etat.details === 'riches') { // liseré clair sur l'arête côté salle, trait d'encre sur l'arête extérieure
    ctx.beginPath(); ctx.moveTo(...Q(0, 0)); ctx.lineTo(...Q(long, 0)); trait(ctx, LISERE_DESSUS, 1.3);
    ctx.beginPath(); ctx.moveTo(...Q(0, ep)); ctx.lineTo(...Q(long, ep)); trait(ctx, ENCRE, 1.6);
  }
  // La mousse prend sur le dessus des murs : quelques plaques sur un mur usé, de nombreuses en ruine (rognées aux bords de la bande).
  const nMousse = usure ? Math.round(long / (t * (usure === 2 ? 0.6 : 2.2))) : 0;
  if (!nMousse) return;
  ctx.save();
  ctx.beginPath();
  [Q(0, 0), Q(long, 0), Q(long, ep), Q(0, ep)].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  for (let k = 0; k < nMousse; k++) {
    const [mx, my] = Q(r() * long, ep * (0.2 + r() * 0.6));
    if (etat.details === 'riches') { const rr = ep * (0.3 + r() * 0.3); if (k % 3 === 0) tacheMousseDessinee(ctx, mx, my, rr); } // dessinée : moins de touffes, plus nettes
    else tacheMousse(ctx, mx, my, ep * (0.4 + r() * 0.5), usure === 2 ? 0.9 : 0.6);
  }
  ctx.restore();
}

// --- Ombre au pied des murs --------------------------------------------------------------------------------

/** Ombre au pied des murs, sur le sol : forte au nord et à l'ouest (la lumière vient du nord-ouest), douce au sud et à l'est. */
export function ombreAuPied(ctx, plan, t) {
  const profondeur = t * (etat.vue.kp > 0 ? 0.75 : 0.45);
  ctx.save();
  tracerSol(ctx, plan, t);
  ctx.clip();
  for (const s of segmentsDeMurs(plan)) {
    const [nx, ny] = s.normale, fort = s.mur === 'nord' || s.mur === 'ouest';
    const d = profondeur * (fort ? 1 : 0.6), alpha = { nord: 0.6, ouest: 0.5, est: 0.32, sud: 0.32 }[s.mur];
    const A = [s.a[0] * t, s.a[1] * t], B = [s.b[0] * t, s.b[1] * t];
    ctx.fillStyle = dl(ctx, A[0], A[1], A[0] + nx * d, A[1] + ny * d, `rgba(10,7,5,${alpha})`, 'rgba(10,7,5,0)');
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(B[0] + nx * d, B[1] + ny * d); ctx.lineTo(A[0] + nx * d, A[1] + ny * d);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// --- Portes ----------------------------------------------------------------------------------------------------

/** La partie de la hauteur d'un mur que prend l'ouverture d'une porte, sur la face. */
const HAUTEUR_PORTE = 0.74;
const SEUIL = ['#8a867e', '#5f5b55']; // la trouée dans le dessus du mur : la pierre du passage

/**
 * Une porte dans le mur, lisible de deux façons : avec relief, une ouverture sombre cernée de pierre sur la FACE du mur (si le centre la voit) ;
 * et toujours, une TROUÉE dans le dessus sombre du mur, avec ce qui ferme le passage (battant, herse ou jambages d'arche) vu d'en haut,
 * comme sur une carte à plat.
 */
export function dessinerPorte(ctx, p, plan, t) {
  const { vue } = etat, e = EPAISSEUR_MUR * t, ep = e * (1 + vue.kp);
  const anc = ancragePorte(plan, p.mur, p.position, t);
  const c = Math.cos(anc.angle), s = Math.sin(anc.angle);
  const tx = [c, s], vers = [-s, c]; // le long du mur, et vers l'intérieur de la salle
  const o = t * 0.9; // largeur de l'ouverture
  const pied = (u) => [anc.x + tx[0] * u, anc.y + tx[1] * u];
  const sur = faceVisible(vue, pied(-o / 2), pied(o / 2), vers);
  const mur = murDeSol(plan.sol);
  const r = alea((etat.graine ^ graineDeTexte(`porte|${p.id}`)) >>> 0);
  const contour = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  if (sur) {
    // Sur la face : le point à la distance u le long du mur et à la hauteur v (1 : le haut du mur).
    const F = (u, v) => { const [x, y] = pied(u); return hautVue(vue, x, y, v); };
    const ouverture = (marge, vHaut) => {
      const pts = [F(-o / 2 - marge, 0), F(o / 2 + marge, 0)];
      for (let i = 0; i <= 10; i++) {
        const u = o / 2 + marge - ((o + 2 * marge) * i) / 10, q = 1 - Math.min(1, Math.abs(u) / (o / 2 + marge)) ** 2;
        pts.push(F(u, vHaut - 0.13 + 0.13 * Math.sqrt(Math.max(0, q))));
      }
      return pts;
    };
    contour(ouverture(t * 0.07, HAUTEUR_PORTE + 0.05));
    encre(ctx, pierre(mur, mur.l[1] + 8), 1.4);
    contour(ouverture(0, HAUTEUR_PORTE));
    ctx.fillStyle = dl(ctx, ...F(0, 0), ...F(0, HAUTEUR_PORTE), '#1d1814', '#050403'); ctx.fill();
  }

  // La trouée dans le dessus du mur : u le long du mur, w en profondeur dans l'épaisseur (0 : côté pièce ; 1 : côté roche).
  const Q = (u, w) => {
    const [x, y] = pied(u), [hx, hy] = hautVue(vue, x, y, 1);
    return [hx - vers[0] * w * ep, hy - vers[1] * w * ep];
  };
  contour([Q(-o / 2, 0), Q(o / 2, 0), Q(o / 2, 1), Q(-o / 2, 1)]);
  encre(ctx, dl(ctx, ...Q(0, 0), ...Q(0, 1), SEUIL[0], SEUIL[1]), 1.2);
  if (p.type === 'arche') {
    for (const u of [-o / 2, o / 2]) {
      contour([Q(u - t * 0.07, 0), Q(u + t * 0.07, 0), Q(u + t * 0.07, 1), Q(u - t * 0.07, 1)]);
      encre(ctx, pierre(mur, mur.l[1] + 14), 1.1);
    }
  } else if (p.type === 'herse') {
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) { const u = -o / 2 + (o * i) / 5; ctx.moveTo(...Q(u, 0.1)); ctx.lineTo(...Q(u, 0.9)); }
    ctx.moveTo(...Q(-o / 2, 0.5)); ctx.lineTo(...Q(o / 2, 0.5));
    trait(ctx, '#1f1f1f', Math.max(1.5, t * 0.045));
    if (sur) {
      const F = (u, v) => { const [x, y] = pied(u); return hautVue(vue, x, y, v); };
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) { const u = -o / 2 + (o * i) / 5; ctx.moveTo(...F(u, 0.02)); ctx.lineTo(...F(u, HAUTEUR_PORTE - 0.1)); }
      ctx.moveTo(...F(-o / 2, 0.4)); ctx.lineTo(...F(o / 2, 0.4));
      trait(ctx, '#3a3a3a', Math.max(1.2, t * 0.035));
    }
  } else {
    // Battant de bois en travers du passage, avec sa poignée ; l'arc pointillé montre vers où il s'ouvre.
    contour([Q(-o / 2 + 1, 0.22), Q(o / 2 - 1, 0.22), Q(o / 2 - 1, 0.78), Q(-o / 2 + 1, 0.78)]);
    encre(ctx, dl(ctx, ...Q(0, 0.22), ...Q(0, 0.78), '#9a6836', '#6a4220'), 1.4);
    ctx.beginPath();
    for (const w of [0.4, 0.6]) { ctx.moveTo(...Q(-o / 2 + 2, w)); ctx.lineTo(...Q(o / 2 - 2, w)); }
    trait(ctx, 'rgba(30,16,6,0.55)', 0.9);
    const [hx, hy] = Q(o * 0.32, 0.5);
    ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.3, t * 0.035), 0, 7); encre(ctx, '#d9a929', 0.8);
    if (sur) {
      const F = (u, v) => { const [x, y] = pied(u); return hautVue(vue, x, y, v); };
      const l0 = -o / 2, l1 = -o / 2 + o * 0.46, v1 = HAUTEUR_PORTE - 0.14;
      contour([F(l0, 0), F(l1, 0), F(l1, v1), F(l0, v1)]);
      encre(ctx, dl(ctx, ...F(l0, 0), ...F(l1, 0), '#8a5a2c', '#5e3a1a'), 1.3);
    }
    ctx.save();
    ctx.translate(anc.x, anc.y); ctx.rotate(anc.angle);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([t * 0.06, t * 0.06]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(-o / 2, 0, o, 0, Math.PI / 2.6); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
