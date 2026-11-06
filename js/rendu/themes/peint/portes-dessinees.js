/**
 * Portes DESSINÉES du thème peint (réglage « Détails des sols » = riches), dans le langage des murs dessinés (murs-dessines.js) : chambranle de
 * pierres claires aux joints d'encre, battant en planches de bois chaudes aux tons variés (fil du bois et rainures à l'encre, liseré clair d'un
 * côté, bande d'ombre nette de l'autre), ferrures et clous sombres avec un reflet, herse de fer, arche à clef de voûte. Chaque type reste
 * reconnaissable : le battant est brun et doré, la herse grise et barrée, l'arche une ouverture vide encadrée de pierre. Appelé par
 * `dessinerPorte` (murs.js) ; le dessin « sobres » ne passe jamais ici. Tout est déterministe (graine de la porte), sans boucle par pixel.
 * Toutes les couleurs, épaisseurs et proportions à régler sont les constantes ci-dessous.
 */
import { EPAISSEUR_MUR, ancragePorte } from '../../geometrie.js';
import { haut as hautVue, faceVisible } from '../../perspective.js';
import { etat } from './etat.js';
import { alea, graineDeTexte } from './bruit.js';
import { chemin, encre, trait, ENCRE } from './trait.js';
import { couleurMur } from './ambiance.js';

// --- Réglages -----------------------------------------------------------------------------------------------
const HAUTEUR = 0.74; // part de la hauteur du mur prise par l'ouverture (comme murs.js)
const LARGEUR = 0.9; // largeur de l'ouverture, en cases
const CHAMBRANLE = 0.1; // épaisseur du chambranle de pierre sur la face, en cases
const CHAMBRANLE_HAUT = 0.06; // idem au-dessus de l'ouverture, en part de la hauteur du mur
const CLAIR_CHAMBRANLE = 22; // luminosité de la pierre du chambranle, ajoutée à la pierre claire du mur
const SATURATION_PLUS = 16; // saturation ajoutée à la pierre (comme les murs dessinés)
const SEUIL_L = 26; // luminosité de la dalle du seuil (trouée dans le dessus du mur), ajoutée à la pierre claire
const LISERE_PLUS = 12; // éclat du liseré clair des pierres
const OMBRE_MOINS = 16; // bande d'ombre des pierres
const VOUSSOIRS = [-0.7, -0.35, 0, 0.35, 0.7]; // joints rayonnants du cintre, en part de la demi-largeur
const ASSISES = [0.2, 0.46]; // joints horizontaux des jambages, en part de la hauteur du mur
const OUVERTURE_FOND = ['#3a2c20', '#150f0a']; // l'ouverture vide : brun chaud en haut, presque noir au pied
const BOIS = ['#d09a58', '#bd8446', '#dcaa6a', '#c48d4c', '#b27a3e']; // planches : tons variés
const BOIS_CLAIR = '#efc98e'; // liseré clair d'une planche
const BOIS_OMBRE = '#8d5a2b'; // bande d'ombre d'une planche
const FIL = 'rgba(60,34,14,0.55)'; // fil du bois
const FER = '#4b4a52'; // ferrures et herse : fer sombre
const FER_REFLET = '#aab0bb'; // reflet sur le fer
const OR = '#e2b53a'; // poignée et clou doré
const OR_REFLET = '#fff0a8';
const PLANCHES_FACE = 4; // planches du battant vu de face
const PLANCHES_DESSUS = 4; // planches du battant vu d'en haut (dans l'épaisseur du mur)
const BATTANT_FACE = 0.46; // part de l'ouverture que couvre le battant sur la face (comme murs.js : l'autre moitié reste ouverte)
const BARREAUX = 5; // intervalles entre les barreaux de la herse
const EPAISSEUR_ENCRE = 1.3; // trait d'encre des formes
const TREMBLE = 0.25; // tremblement du trait
const ARC_PORTE = 'rgba(35,27,22,0.4)'; // l'arc pointillé de battement du battant : sombre, pour se lire sur un sol clair

const polygone = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };

/** La partie de la hauteur que prend le cintre de l'ouverture (arc surbaissé), au point u (marge incluse). */
const cintre = (u, demi, vHaut) => vHaut - 0.13 + 0.13 * Math.sqrt(Math.max(0, 1 - Math.min(1, Math.abs(u) / demi) ** 2));

/**
 * Dessine une porte (battant, herse ou arche) dans le mur, vue de face si le centre voit sa face, et toujours en trouée dans le dessus du mur.
 * `mur` : { h, s, l:[clair, foncé] } de murs.js (selon le sol).
 */
export function dessinerPorteDessinee(ctx, p, plan, t, mur) {
  const { vue } = etat, e = EPAISSEUR_MUR * t, ep = e * (1 + vue.kp);
  const anc = ancragePorte(plan, p.mur, p.position, t);
  const c = Math.cos(anc.angle), s = Math.sin(anc.angle);
  const tx = [c, s], vers = [-s, c];
  const o = t * LARGEUR, demi = o / 2;
  const pied = (u) => [anc.x + tx[0] * u, anc.y + tx[1] * u];
  const sur = faceVisible(vue, pied(-demi), pied(demi), vers);
  const r = alea((etat.graine ^ graineDeTexte(`porte|${p.id}`)) >>> 0);
  const cote = -(tx[0] + tx[1]) >= 0 ? 1 : -1; // +1 : le sens croissant de u regarde vers la lumière (nord-ouest)
  const pierre = (l, plus = 0) => couleurMur({ h: mur.h, s: mur.s + SATURATION_PLUS + plus }, Math.max(8, Math.min(92, l)), etat.ambiance);
  const pierreClaire = mur.l[0];
  const lignes = (pts, ferme) => chemin(ctx, pts, ferme, r, TREMBLE);

  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  if (sur) {
    const F = (u, v) => { const [x, y] = pied(u); return hautVue(vue, x, y, v); };
    const m = t * CHAMBRANLE;
    const ouverture = (marge, vHaut) => {
      const pts = [F(-demi - marge, 0), F(demi + marge, 0)];
      for (let i = 0; i <= 10; i++) { const u = demi + marge - ((o + 2 * marge) * i) / 10; pts.push(F(u, cintre(u, demi + marge, vHaut))); }
      return pts;
    };
    // Chambranle : pierre claire, joints d'encre (cintre à voussoirs, jambages à assises), liseré clair du côté de la lumière.
    lignes(ouverture(m, HAUTEUR + CHAMBRANLE_HAUT), true);
    encre(ctx, pierre(pierreClaire + CLAIR_CHAMBRANLE), EPAISSEUR_ENCRE);
    ctx.beginPath();
    for (const f of VOUSSOIRS) {
      const ui = f * demi, uo = f * (demi + m);
      ctx.moveTo(...F(ui, cintre(ui, demi, HAUTEUR))); ctx.lineTo(...F(uo, cintre(uo, demi + m, HAUTEUR + CHAMBRANLE_HAUT)));
    }
    for (const v of ASSISES) for (const sg of [-1, 1]) { ctx.moveTo(...F(sg * demi, v * HAUTEUR)); ctx.lineTo(...F(sg * (demi + m), v * HAUTEUR)); }
    trait(ctx, ENCRE, 0.9);
    polygone(ctx, [F(cote * (demi + m * 0.2), 0.02), F(cote * (demi + m * 0.85), 0.02), F(cote * (demi + m * 0.85), HAUTEUR * 0.8), F(cote * (demi + m * 0.2), HAUTEUR * 0.8)]);
    ctx.fillStyle = pierre(pierreClaire + CLAIR_CHAMBRANLE + LISERE_PLUS); ctx.fill();
    polygone(ctx, [F(-cote * (demi + m * 0.2), 0.02), F(-cote * (demi + m * 0.85), 0.02), F(-cote * (demi + m * 0.85), HAUTEUR * 0.8), F(-cote * (demi + m * 0.2), HAUTEUR * 0.8)]);
    ctx.fillStyle = pierre(pierreClaire + CLAIR_CHAMBRANLE - OMBRE_MOINS); ctx.fill();
    // L'ouverture : brun chaud en haut, presque noir au pied.
    const g = ctx.createLinearGradient(...F(0, HAUTEUR), ...F(0, 0));
    g.addColorStop(0, OUVERTURE_FOND[0]); g.addColorStop(1, OUVERTURE_FOND[1]);
    lignes(ouverture(0, HAUTEUR), true); ctx.fillStyle = g; ctx.fill(); trait(ctx, ENCRE, EPAISSEUR_ENCRE * 1.4);

    if (p.type === 'arche') {
      // Clef de voûte : une pierre plus claire au sommet du cintre.
      const k = m * 0.55, vk = cintre(0, demi, HAUTEUR);
      lignes([F(-k, vk - 0.01), F(k, vk - 0.01), F(k * 1.25, vk + CHAMBRANLE_HAUT), F(-k * 1.25, vk + CHAMBRANLE_HAUT)], true);
      encre(ctx, pierre(pierreClaire + CLAIR_CHAMBRANLE + LISERE_PLUS + 4), EPAISSEUR_ENCRE);
    } else if (p.type === 'herse') {
      // Grille de fer levée à moitié : barreaux pointus vers le bas, deux traverses, reflet sur chaque barreau.
      const vh = HAUTEUR - 0.1, vb = 0.1, bar = Math.max(2, t * 0.05);
      ctx.beginPath();
      for (let i = 0; i <= BARREAUX; i++) { const u = -demi * 0.92 + (o * 0.92 * i) / BARREAUX; ctx.moveTo(...F(u, cintre(u, demi, HAUTEUR) - 0.04)); ctx.lineTo(...F(u, vb)); }
      trait(ctx, ENCRE, bar + 2);
      for (const v of [0.18, 0.42]) { ctx.beginPath(); ctx.moveTo(...F(-demi * 0.92, v)); ctx.lineTo(...F(demi * 0.92, v)); trait(ctx, ENCRE, bar + 2); }
      ctx.beginPath();
      for (let i = 0; i <= BARREAUX; i++) { const u = -demi * 0.92 + (o * 0.92 * i) / BARREAUX; ctx.moveTo(...F(u, cintre(u, demi, HAUTEUR) - 0.04)); ctx.lineTo(...F(u, vb)); }
      for (const v of [0.18, 0.42]) { ctx.moveTo(...F(-demi * 0.92, v)); ctx.lineTo(...F(demi * 0.92, v)); }
      trait(ctx, FER, bar);
      ctx.beginPath();
      for (let i = 0; i <= BARREAUX; i++) { const u = -demi * 0.92 + (o * 0.92 * i) / BARREAUX + cote * bar * 0.25; ctx.moveTo(...F(u, vh * 0.95)); ctx.lineTo(...F(u, vb + 0.08)); }
      trait(ctx, FER_REFLET, Math.max(0.8, bar * 0.3));
      for (let i = 0; i <= BARREAUX; i++) { // pointes
        const [x, y] = F(-demi * 0.92 + (o * 0.92 * i) / BARREAUX, vb - 0.04), w = bar * 0.9;
        ctx.beginPath(); ctx.moveTo(x - w, y - w * 1.6); ctx.lineTo(x, y + w * 0.6); ctx.lineTo(x + w, y - w * 1.6); ctx.closePath(); encre(ctx, FER, 0.9);
      }
    } else {
      // Battant de bois sur la moitié de l'ouverture, planches de tons variés, deux ferrures, une poignée.
      const l0 = -demi, l1 = -demi + o * BATTANT_FACE, vb = HAUTEUR - 0.14, n = PLANCHES_FACE;
      for (let i = 0; i < n; i++) {
        const a = l0 + ((l1 - l0) * i) / n, b = l0 + ((l1 - l0) * (i + 1)) / n, haut = vb - r() * 0.03;
        lignes([F(a, 0), F(b, 0), F(b, haut), F(a, haut)], true);
        encre(ctx, BOIS[Math.floor(r() * BOIS.length)], 1);
        const w = (b - a) * 0.16;
        polygone(ctx, [F(cote > 0 ? b - w : a + 0.5, 0.02), F(cote > 0 ? b - 0.5 : a + w, 0.02), F(cote > 0 ? b - 0.5 : a + w, haut - 0.02), F(cote > 0 ? b - w : a + 0.5, haut - 0.02)]);
        ctx.fillStyle = BOIS_CLAIR; ctx.fill();
        polygone(ctx, [F(cote > 0 ? a + 0.5 : b - w, 0.02), F(cote > 0 ? a + w : b - 0.5, 0.02), F(cote > 0 ? a + w : b - 0.5, haut - 0.02), F(cote > 0 ? a + 0.5 : b - w, haut - 0.02)]);
        ctx.fillStyle = BOIS_OMBRE; ctx.fill();
        ctx.beginPath(); // fil du bois : un trait un peu ondulé dans la planche
        const uf = a + (b - a) * (0.35 + r() * 0.3);
        ctx.moveTo(...F(uf, 0.06)); ctx.lineTo(...F(uf + (r() - 0.5) * (b - a) * 0.3, haut * 0.5)); ctx.lineTo(...F(uf, haut - 0.05));
        trait(ctx, FIL, 0.8);
      }
      for (const v of [0.14, vb - 0.12]) { // ferrures : bandes de fer avec clous et reflet
        lignes([F(l0, v - 0.025), F(l1, v - 0.025), F(l1, v + 0.025), F(l0, v + 0.025)], true); encre(ctx, FER, 1);
        ctx.beginPath(); ctx.moveTo(...F(l0 + 1, v + 0.012)); ctx.lineTo(...F(l1 - 1, v + 0.012)); trait(ctx, FER_REFLET, 0.8);
        for (const u of [l0 + (l1 - l0) * 0.2, l0 + (l1 - l0) * 0.55, l1 - (l1 - l0) * 0.12]) { const [x, y] = F(u, v); ctx.beginPath(); ctx.arc(x, y, Math.max(1, t * 0.025), 0, 7); encre(ctx, OR, 0.7); }
      }
      const [hx, hy] = F(l1 - (l1 - l0) * 0.18, vb * 0.5);
      ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.6, t * 0.04), 0, 7); encre(ctx, OR, 0.9);
      ctx.beginPath(); ctx.arc(hx - 0.5, hy - 0.6, Math.max(0.6, t * 0.014), 0, 7); ctx.fillStyle = OR_REFLET; ctx.fill();
    }
  }

  // La trouée dans le dessus du mur : u le long du mur, w en profondeur dans l'épaisseur (0 : côté pièce ; 1 : côté roche).
  const Q = (u, w) => {
    const [x, y] = pied(u), [hx, hy] = hautVue(vue, x, y, 1);
    return [hx - vers[0] * w * ep, hy - vers[1] * w * ep];
  };
  // Dalle du seuil : pierre claire, liseré du côté de la lumière, ombre de l'autre.
  lignes([Q(-demi, 0), Q(demi, 0), Q(demi, 1), Q(-demi, 1)], true);
  encre(ctx, pierre(pierreClaire + SEUIL_L), EPAISSEUR_ENCRE);
  const bande = t * 0.07, ub = demi - 1;
  polygone(ctx, [Q(cote * ub, 0.05), Q(cote * (ub - bande), 0.05), Q(cote * (ub - bande), 0.95), Q(cote * ub, 0.95)]);
  ctx.fillStyle = pierre(pierreClaire + SEUIL_L + LISERE_PLUS); ctx.fill();
  polygone(ctx, [Q(-cote * ub, 0.05), Q(-cote * (ub - bande), 0.05), Q(-cote * (ub - bande), 0.95), Q(-cote * ub, 0.95)]);
  ctx.fillStyle = pierre(pierreClaire + SEUIL_L - OMBRE_MOINS); ctx.fill();

  if (p.type === 'arche') {
    for (const u of [-demi, demi]) { // jambages de pierre claire cernés d'encre, avec leur joint
      lignes([Q(u - t * 0.07, 0), Q(u + t * 0.07, 0), Q(u + t * 0.07, 1), Q(u - t * 0.07, 1)], true);
      encre(ctx, pierre(pierreClaire + CLAIR_CHAMBRANLE), EPAISSEUR_ENCRE);
      ctx.beginPath(); ctx.moveTo(...Q(u - t * 0.07, 0.5)); ctx.lineTo(...Q(u + t * 0.07, 0.5)); trait(ctx, ENCRE, 0.8);
    }
  } else if (p.type === 'herse') {
    const bar = Math.max(1.6, t * 0.045);
    ctx.beginPath();
    for (let i = 0; i <= BARREAUX; i++) { const u = -demi + (o * i) / BARREAUX; ctx.moveTo(...Q(u, 0.1)); ctx.lineTo(...Q(u, 0.9)); }
    ctx.moveTo(...Q(-demi, 0.5)); ctx.lineTo(...Q(demi, 0.5));
    trait(ctx, ENCRE, bar + 1.6);
    trait(ctx, FER, bar);
    ctx.beginPath();
    for (let i = 0; i <= BARREAUX; i++) { const u = -demi + (o * i) / BARREAUX + cote * bar * 0.25; ctx.moveTo(...Q(u, 0.15)); ctx.lineTo(...Q(u, 0.85)); }
    trait(ctx, FER_REFLET, Math.max(0.7, bar * 0.28));
  } else {
    // Battant vu d'en haut : planches (dans l'épaisseur du mur), tons variés, fil du bois, ferrures aux deux bouts, poignée dorée.
    const w0 = 0.22, w1 = 0.78, n = PLANCHES_DESSUS;
    lignes([Q(-demi + 1, w0), Q(demi - 1, w0), Q(demi - 1, w1), Q(-demi + 1, w1)], true);
    encre(ctx, BOIS[0], EPAISSEUR_ENCRE);
    for (let i = 0; i < n; i++) {
      const a = w0 + ((w1 - w0) * i) / n, b = w0 + ((w1 - w0) * (i + 1)) / n;
      polygone(ctx, [Q(-demi + 1, a), Q(demi - 1, a), Q(demi - 1, b), Q(-demi + 1, b)]);
      ctx.fillStyle = BOIS[Math.floor(r() * BOIS.length)]; ctx.fill();
      ctx.beginPath(); ctx.moveTo(...Q(-demi + 1, a)); ctx.lineTo(...Q(demi - 1, a)); trait(ctx, ENCRE, 0.9);
      ctx.beginPath(); // fil du bois
      const wf = a + (b - a) * (0.35 + r() * 0.3), uf = -demi + o * (0.2 + r() * 0.2);
      ctx.moveTo(...Q(uf, wf)); ctx.lineTo(...Q(uf + o * (0.15 + r() * 0.15), wf + (r() - 0.5) * (b - a) * 0.3));
      trait(ctx, FIL, 0.8);
    }
    ctx.beginPath(); ctx.moveTo(...Q(-demi + 1, w0 + 0.02)); ctx.lineTo(...Q(demi - 1, w0 + 0.02)); trait(ctx, BOIS_CLAIR, 0.9); // liseré clair côté pièce
    ctx.beginPath(); ctx.moveTo(...Q(-demi + 1, w1 - 0.02)); ctx.lineTo(...Q(demi - 1, w1 - 0.02)); trait(ctx, BOIS_OMBRE, 1.1); // ombre côté roche
    for (const u of [-demi + o * 0.1, demi - o * 0.1]) { // bandes de fer des gonds
      lignes([Q(u - t * 0.04, w0), Q(u + t * 0.04, w0), Q(u + t * 0.04, w1), Q(u - t * 0.04, w1)], true); encre(ctx, FER, 1);
      ctx.beginPath(); ctx.moveTo(...Q(u - t * 0.015, w0 + 0.04)); ctx.lineTo(...Q(u - t * 0.015, w1 - 0.04)); trait(ctx, FER_REFLET, 0.7);
    }
    const [hx, hy] = Q(o * 0.32, 0.5), rh = Math.max(1.5, t * 0.04);
    ctx.beginPath(); ctx.arc(hx, hy, rh, 0, 7); encre(ctx, OR, 0.9);
    ctx.beginPath(); ctx.arc(hx - rh * 0.3, hy - rh * 0.35, rh * 0.32, 0, 7); ctx.fillStyle = OR_REFLET; ctx.fill();
    ctx.save(); // l'arc pointillé montre vers où le battant s'ouvre
    ctx.translate(anc.x, anc.y); ctx.rotate(anc.angle);
    ctx.strokeStyle = ARC_PORTE; ctx.setLineDash([t * 0.06, t * 0.06]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(-demi, 0, o, 0, Math.PI / 2.6); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
