/**
 * Les pions du thème « peint » : à plat (jamais en perspective), au-dessus de tout, donc lisibles de loin. Un disque en dégradé de la couleur du camp
 * (bleu : joueurs, or : neutres, rouge : monstres), un anneau clair, un contour d'encre, le portrait du monstre (ou, très petit ou sans portrait, l'abréviation du type : « P1 » pour un joueur) et la pastille
 * du numéro. Blessé : anneau en tirets et pastille à croix rouge ; mort : disque grisé et barré d'une grande croix. Même contrat que `pion` du thème vectoriel.
 */
import { COULEURS } from '../../../parseur/lexique.js';
import { CREATURES } from '../../../catalogue.js';
import { dessinerPortrait } from '../../portraits.js';
import { alea, graineDeTexte } from './bruit.js';
import { etat } from './etat.js';
import { cercle, encre, trait, dr, ENCRE } from './trait.js';

const ABREVIATIONS = Object.fromEntries(CREATURES.map((c) => [c.type, c.abr]));
/** Dégradé du camp : [clair, sombre]. */
const CAMP = { pj: ['#6aa5ff', '#1b4aa8'], pnj: ['#ecca55', '#8a6710'], monstre: ['#e8695f', '#7a1814'] };
const MORT = ['#9a9792', '#4e4c48'];
const ANNEAU = '#f4efe4';
const R_PORTRAIT_MIN = 11; // px : sous ce rayon, un pion garde son abréviation (comme les thèmes vectoriel et papier)

export function pion(ctx, k, t) {
  const cote = k.taille * t, cx = k.x * t + cote / 2, cy = k.y * t + cote / 2, R = cote * 0.42;
  const r = alea((etat.graine ^ graineDeTexte(`pion|${k.type}|${k.x}|${k.y}`)) >>> 0);
  const mort = k.etat === 'mort', [clair, sombre] = mort ? MORT : CAMP[k.camp] || CAMP.pnj;
  const anneau = Math.max(2, t * 0.06);

  ctx.save();
  if (mort) ctx.globalAlpha *= 0.82;
  // Le disque : ombre portée douce, dégradé, anneau clair puis fin contour d'encre.
  cercle(ctx, cx, cy, R, r, 0.3);
  encre(ctx, dr(ctx, cx, cy, R, clair, sombre), 0, true);
  ctx.lineWidth = anneau; ctx.strokeStyle = ANNEAU; ctx.stroke();
  cercle(ctx, cx, cy, R + anneau / 2 + 0.8, r, 0.3); trait(ctx, ENCRE, 1.6);
  // Anneau de la couleur propre à la créature (dragon rouge, etc.).
  if (!mort && k.couleur && COULEURS[k.couleur]) { cercle(ctx, cx, cy, R * 0.78, r, 0.2); trait(ctx, COULEURS[k.couleur], Math.max(3, R * 0.18)); }

  // Le portrait du monstre dans l'anneau du camp ; très petit, il deviendrait illisible : on garde alors l'abréviation (un joueur n'en a pas).
  const portrait = !mort && R >= R_PORTRAIT_MIN && dessinerPortrait(ctx, k.type, cx, cy, R * 0.82);
  if (!portrait) {
    const texte = k.camp === 'pj' ? `P${k.numero}` : ABREVIATIONS[k.type] || '?';
    ctx.font = `700 ${Math.max(9, R * (texte.length > 2 ? 0.66 : 0.82))}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2.5, R * 0.2); ctx.strokeStyle = 'rgba(20,12,8,0.85)'; ctx.strokeText(texte, cx, cy + R * 0.04);
    ctx.fillStyle = '#fff'; ctx.fillText(texte, cx, cy + R * 0.04);
  }
  ctx.restore();

  // Pastille du numéro (inutile pour les PJ, déjà numérotés ; `sansNumero` : vignettes de la palette).
  if (k.camp !== 'pj' && !k.sansNumero) {
    const pr = Math.max(7, t * 0.17), px = cx + R * 0.72, py = cy - R * 0.72;
    cercle(ctx, px, py, pr, r, 0.2); encre(ctx, ANNEAU, 1.5);
    ctx.fillStyle = ENCRE; ctx.font = `700 ${pr * 1.2}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(k.numero), px, py + pr * 0.06);
  }

  if (mort) croix(ctx, cx, cy, R);
  else if (k.etat === 'blesse') blesse(ctx, cx, cy, R);
}

/** Pion mort : grande croix sombre cernée de clair, qui se lit aussi sans la couleur. */
function croix(ctx, cx, cy, R) {
  const a = R * 0.72;
  ctx.save();
  ctx.lineCap = 'round';
  for (const [couleur, epaisseur] of [[ANNEAU, Math.max(6, R * 0.46)], [ENCRE, Math.max(3.5, R * 0.26)]]) {
    ctx.beginPath(); ctx.moveTo(cx - a, cy - a); ctx.lineTo(cx + a, cy + a); ctx.moveTo(cx + a, cy - a); ctx.lineTo(cx - a, cy + a);
    trait(ctx, couleur, epaisseur);
  }
  ctx.restore();
}

/** Pion blessé : anneau en tirets (sombre puis clair, lisible sans la couleur) et grosse pastille blanche à croix rouge en bas à gauche. */
function blesse(ctx, cx, cy, R) {
  ctx.save();
  const anneau = R + Math.max(3, R * 0.14), epais = Math.max(3.5, R * 0.15);
  ctx.beginPath(); ctx.arc(cx, cy, anneau, 0, Math.PI * 2); trait(ctx, ENCRE, epais + Math.max(2, R * 0.08));
  ctx.setLineDash([Math.max(5, R * 0.34), Math.max(3, R * 0.2)]);
  ctx.beginPath(); ctx.arc(cx, cy, anneau, 0, Math.PI * 2); trait(ctx, '#fff', epais * 0.7);
  ctx.setLineDash([]);
  const pr = Math.max(11, R * 0.62), px = cx - R * 0.74, py = cy + R * 0.74;
  ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); encre(ctx, '#fff', Math.max(2, pr * 0.14));
  ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(px - pr * 0.6, py); ctx.lineTo(px + pr * 0.6, py); ctx.moveTo(px, py - pr * 0.6); ctx.lineTo(px, py + pr * 0.6);
  trait(ctx, '#a01818', Math.max(4, pr * 0.46));
  ctx.restore();
}
