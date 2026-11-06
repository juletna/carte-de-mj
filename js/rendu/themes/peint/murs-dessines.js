/**
 * Murs DESSINÉS du thème peint (réglage « Détails des sols » = riches) : faces en pierres claires et colorées, éclairées en aplats du nord-ouest
 * (liseré clair d'un côté, bande d'ombre nette de l'autre), cernées d'encre, avec quelques fissures, des touffes d'herbe au pied et, pour une
 * salle usée ou en ruine, des blocs ébréchés ou manquants, de la mousse et du lierre dessinés net. Appelé par murs.js ; le dessin « sobres »
 * ne passe jamais ici. Toutes les couleurs, épaisseurs et intensités à régler sont les constantes ci-dessous.
 */
import { etat } from './etat.js';
import { chemin, encre, trait, ENCRE } from './trait.js';
import { couleurMur, usureDe } from './ambiance.js';

// --- Réglages -----------------------------------------------------------------------------------------------
const SATURATION_PLUS = 16; // points de saturation ajoutés à la pierre du sol
const CLAIR_PLUS = 12; // points de luminosité ajoutés à la pierre claire du sol
const VARIATION_L = 12; // écart de luminosité d'une pierre à l'autre
const VARIATION_TEINTE = 7; // écart de teinte (degrés) d'une pierre à l'autre
const OMBRAGE_FACE = 0.7; // part de l'ombrage de la face (selon son orientation) appliquée à la luminosité
const MORTIER_L = 16; // luminosité du joint de mortier (relative à la pierre foncée du sol) : clair et chaud
const MORTIER_TEINTE = 34; const MORTIER_SAT = 30; // le mortier tire vers le beige chaud
const LISERE_PLUS = 13; // éclat du liseré clair (luminosité en plus)
const OMBRE_MOINS = 17; // bande d'ombre (luminosité en moins)
const LISERE_PART = 0.17; // épaisseur du liseré et de la bande d'ombre, en part de la hauteur de l'assise
const LISERE_PX = 2.3; // idem sur le côté, en pixels
const JOINT = 0.05; // jeu entre deux assises (part de la hauteur de la face)
const JOINT_PX = 1.6; // jeu entre deux pierres d'une assise, en pixels
const EPAISSEUR_PIERRE = 1.2; // trait d'encre autour d'une pierre
const EPAISSEUR_BORD = 2.2; // trait d'encre au pied, en haut et sur les côtés de la face
const TREMBLE = 0.3; // tremblement du trait
const P_FISSURE = 0.1; // probabilité d'une fissure par pierre (plus une part par degré d'usure)
const TROU = '#5a4636'; // le fond d'un bloc manquant ou d'un éclat : brun chaud, pas noir
const HERBE = ['#6fae3c', '#9ad04f']; // touffes d'herbe au pied : foncé, clair
const MOUSSE = ['#4f7d33', '#79a64c']; // mousse : foncé, clair (sourde : elle pousse sur le dessus presque noir)
const LIERRE = ['#3f7d2a', '#78b844', '#2c4f1c']; // lierre : feuille foncée, feuille claire, tige
const TOUFFES_PAR_CASE = 0.35; // touffes d'herbe au pied, par case de mur (salle neuve ; plus pour une salle usée)

const pierre = (h, s, l) => couleurMur({ h, s }, Math.max(8, Math.min(92, l)), etat.ambiance);

/** Les coins d'une pierre (u0–u1, v0–v1) coupés d'un petit éclat irrégulier : huit points dans l'espace de la face. */
function contourPierre(P, r, u0, u1, v0, v1, cu) {
  const c = () => 0.6 + r() * 0.8, cv = (v1 - v0) * 0.2;
  const a = cu * c(), b = cu * c(), d = cu * c(), e = cu * c();
  return [P(u0 + a, v0), P(u1 - b, v0), P(u1, v0 + cv * c()), P(u1, v1 - cv * c()), P(u1 - d, v1), P(u0 + e, v1), P(u0, v1 - cv * c()), P(u0, v0 + cv * c())];
}

const polygone = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };

/** Une tache de mousse dessinée : une flaque verte à deux tons, cernée d'encre. */
export function tacheMousseDessinee(ctx, x, y, rr) {
  // Une touffe de trois boules qui se chevauchent (orientée selon la position : pas deux pareilles), d'un vert sourd sur le dessus sombre.
  const a0 = (x * 0.73 + y * 1.31) % 6.28;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = a0 + i * 2.1, d = rr * 0.42, rb = rr * (0.62 - i * 0.08);
    ctx.moveTo(x + Math.cos(a) * d + rb, y + Math.sin(a) * d * 0.7);
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, rb, 0, 6.29);
  }
  encre(ctx, MOUSSE[0], 0.8);
  ctx.beginPath(); ctx.arc(x + Math.cos(a0) * rr * 0.32 - rr * 0.12, y + Math.sin(a0) * rr * 0.22 - rr * 0.14, rr * 0.22, 0, 6.29);
  ctx.fillStyle = MOUSSE[1]; ctx.fill();
}

/** Une touffe d'herbe au pied : trois lames pointues en pixels écran. */
function touffe(ctx, r, x, y, h) {
  ctx.beginPath();
  for (const dx of [-0.5, 0, 0.5]) {
    const hh = h * (0.7 + r() * 0.5), bx = x + dx * h * 0.55, tx = bx + (dx || (r() - 0.5)) * h * 0.5;
    ctx.moveTo(bx - h * 0.16, y); ctx.lineTo(tx, y - hh); ctx.lineTo(bx + h * 0.16, y);
  }
  encre(ctx, HERBE[0], 0.8);
  ctx.beginPath(); ctx.moveTo(x - h * 0.05, y); ctx.lineTo(x, y - h * 0.7); ctx.lineTo(x + h * 0.1, y);
  ctx.fillStyle = HERBE[1]; ctx.fill();
}

/** Du lierre dessiné : une tige sinueuse du haut de la face jusqu'à `bas`, avec ses feuilles cernées d'encre. */
function lierre(ctx, r, P, u, bas) {
  const pts = [];
  for (let v = 0.95, derive = 0; v >= 1 - bas; v -= 0.1) { derive += (r() - 0.5) * 0.012; pts.push(P(u + derive, v)); }
  if (pts.length < 2) return;
  chemin(ctx, pts, false, r, 0.6); trait(ctx, LIERRE[2], 1.6);
  for (const [px, py] of pts) for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(px + s * 3.2, py, 3.2, 2, s * 0.6, 0, 7);
    encre(ctx, r() < 0.5 ? LIERRE[0] : LIERRE[1], 0.8);
  }
}

/**
 * La face d'un mur dessinée : `P(u, v)` place un point de la face, `long` est sa longueur en px, `k` l'ombrage de son orientation (−22 à 0, voir murs.js),
 * `dirLum` > 0 si le sens croissant de u regarde vers la lumière (le liseré clair passe alors du côté de u1).
 */
export function dessinerFaceDessinee(ctx, r, mur, t, P, long, k, dirLum) {
  const usure = usureDe(etat.etatSalle);
  const kq = k < -16 ? -22 : k < -6 ? -11 : 0; // trois niveaux francs plutôt qu'un dégradé continu
  const dec = kq * OMBRAGE_FACE;
  const mort = pierre(MORTIER_TEINTE, MORTIER_SAT, mur.l[1] + MORTIER_L + dec);
  polygone(ctx, [P(0, 0), P(1, 0), P(1, 1), P(0, 1)]);
  ctx.fillStyle = mort; ctx.fill();
  const gu = JOINT_PX / long, cote = dirLum > 0 ? 1 : -1;
  for (const [v0, v1, decal] of [[0, 0.34, 0], [0.34, 0.67, 0.25 * t], [0.67, 1, 0.1 * t]]) {
    let p = 0;
    while (p < long - 1) {
      let l = p === 0 && decal ? decal : t * (0.45 + r() * 0.4);
      if (p + l > long - 0.2 * t) l = long - p;
      const u0 = p / long + gu, u1 = (p + l) / long - gu, a = v0 + JOINT, b = v1 - JOINT;
      p += l;
      if (u1 <= u0 + gu) continue;
      const cu = Math.min(0.22 * (u1 - u0), 3 / long);
      const manque = usure === 2 && r() < (v0 > 0.6 ? 0.14 : 0.07);
      const pts = contourPierre(P, r, u0, u1, a, b, cu);
      polygone(ctx, pts);
      if (manque) { encre(ctx, TROU, EPAISSEUR_PIERRE); continue; }
      const h = mur.h + (r() - 0.5) * 2 * VARIATION_TEINTE, s = mur.s + SATURATION_PLUS;
      const L = mur.l[0] + CLAIR_PLUS + dec + r() * VARIATION_L;
      chemin(ctx, pts, true, r, TREMBLE);
      encre(ctx, pierre(h, s, L), EPAISSEUR_PIERRE);
      // Aplats : liseré clair en haut et du côté de la lumière, bande d'ombre en bas et du côté opposé.
      const hv = (b - a) * LISERE_PART, wu = LISERE_PX / long, i = 0.5 / long, dv = 0.008;
      const clair = pierre(h, s + 4, L + LISERE_PLUS), sombre = pierre(h, s, L - OMBRE_MOINS);
      const [uc0, uc1] = cote > 0 ? [u1 - wu, u1 - i] : [u0 + i, u0 + wu], [us0, us1] = cote > 0 ? [u0 + i, u0 + wu] : [u1 - wu, u1 - i];
      polygone(ctx, [P(u0 + cu, b - dv), P(u1 - cu, b - dv), P(u1 - cu, b - dv - hv), P(u0 + cu, b - dv - hv)]); ctx.fillStyle = clair; ctx.fill();
      polygone(ctx, [P(uc0, b - dv - hv), P(uc1, b - dv - hv), P(uc1, a + dv + hv), P(uc0, a + dv + hv)]); ctx.fillStyle = clair; ctx.fill();
      polygone(ctx, [P(u0 + cu, a + dv), P(u1 - cu, a + dv), P(u1 - cu, a + dv + hv), P(u0 + cu, a + dv + hv)]); ctx.fillStyle = sombre; ctx.fill();
      polygone(ctx, [P(us0, b - dv - hv), P(us1, b - dv - hv), P(us1, a + dv + hv), P(us0, a + dv + hv)]); ctx.fillStyle = sombre; ctx.fill();
      if (r() < 0.55) { // quelques hachures d'encre dans la bande d'ombre
        ctx.beginPath();
        for (let n = 0, nb = 2 + Math.floor(r() * 3), x0 = u0 + cu + (u1 - u0) * 0.08; n < nb; n++, x0 += (u1 - u0) * 0.14) {
          ctx.moveTo(...P(x0, a + dv + hv)); ctx.lineTo(...P(x0 + gu * 2.5, a + dv));
        }
        trait(ctx, 'rgba(35,27,22,0.55)', 0.8);
      }
      if (r() < P_FISSURE + usure * 0.08) { // une fissure en zigzag depuis le haut de la pierre
        const x = u0 + (u1 - u0) * (0.25 + r() * 0.5), fis = [P(x, b - dv)];
        for (let n = 1, v = b - (b - a) * 0.25; n <= 3; n++, v -= (b - a) * (0.2 + r() * 0.1)) fis.push(P(x + (n % 2 ? 1 : -1) * (u1 - u0) * 0.08 * r(), Math.max(a + dv, v)));
        chemin(ctx, fis, false, r, 0.2); trait(ctx, ENCRE, 0.9);
      }
      if (usure && r() < (usure === 2 ? 0.14 : 0.1)) { // éclat : un coin du haut manque
        const dr = r() < 0.5, du = (u1 - u0) * (0.2 + r() * 0.2), dv2 = (b - a) * (0.3 + r() * 0.3), piv = dr ? u1 : u0, [ua, ub] = dr ? [u1 - du, u1] : [u0, u0 + du];
        polygone(ctx, [P(ua, b), P(ub, b), P(piv, b - dv2)]);
        encre(ctx, TROU, 0.9);
      }
    }
  }
  // Contour de la face : pied et côtés d'un trait d'encre franc, haut plus fin.
  chemin(ctx, [P(0, 0), P(1, 0)], false, r, TREMBLE); trait(ctx, ENCRE, EPAISSEUR_BORD);
  chemin(ctx, [P(0, 1), P(1, 1)], false, r, TREMBLE); trait(ctx, ENCRE, EPAISSEUR_BORD * 0.8);
  for (const u of [0, 1]) { chemin(ctx, [P(u, 0), P(u, 1)], false, r, TREMBLE); trait(ctx, ENCRE, EPAISSEUR_BORD * 0.7); }
  // Touffes d'herbe au pied (rares sur du neuf, plus nombreuses sur du vieux).
  const nT = Math.round((long / t) * TOUFFES_PAR_CASE * (1 + usure * 1.5));
  for (let n = 0; n < nT; n++) { const [x, y] = P(0.03 + r() * 0.94, 0.02); touffe(ctx, r, x, y, t * (0.13 + r() * 0.07)); }
  if (!usure) return;
  for (let n = 0, m = Math.round(long / (t * 1.4)) * usure; n < m; n++) { const [x, y] = P(r(), 0.03 + r() * 0.08); tacheMousseDessinee(ctx, x, y, t * (0.07 + r() * 0.07)); }
  if (usure < 2) return;
  for (let n = 0, m = Math.max(1, Math.round(long / (t * 3.5))); n < m; n++) lierre(ctx, r, P, 0.06 + r() * 0.88, 0.45 + r() * 0.5);
}
