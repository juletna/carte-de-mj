/**
 * USURE DESSINÉE d'une salle (réglage « Détails des sols » = riches) : par-dessus un sol dessiné, des flaques de saleté brun chaud de deux tons aux
 * bords nets, des plaques de mousse vert franc de deux tons cernées d'un fin contour sombre (sur la pierre, elles préfèrent les joints), des
 * fissures en traits d'encre fins qui se ramifient, avec un liseré clair d'un côté ; et, pour une salle en ruine, la lisière franche de la mousse,
 * de la terre et de l'herbe qui reprennent le dallage (`lisiereRuine`, appelée par sols.js à la place de la transition floue d'avant).
 * Module PUR ; tout est PÉRIODIQUE sur PERIODE (bruits de bruit.js à nombres de mailles entiers, `semis` à pas qui divise PERIODE) et ne crée aucun
 * objet par pixel. Les masques de végétation et leurs seuils restent ceux de sols.js (lus aussi par details.js) : ils sont passés en argument.
 */
import { fbmp, vbp } from '../bruit.js';
import { PERIODE } from '../tuile.js';
import { ENCRE, marche, vers, semis, D } from './outils.js';

// --- Réglages -----------------------------------------------------------------------------------------------
const SALE = [[150, 112, 70], [118, 82, 48]]; // saleté : ton clair, ton foncé (brun chaud)
const SALE_SEUIL = [0, 0.65, 0.6]; // la saleté commence au-dessus de ce bruit (indice : usure) ; plus bas = plus de saleté
const SALE_FORCE = [0, 0.3, 0.38]; // part de la couleur de saleté mêlée au sol
const SALE_PROFONDE = 0.075; // écart de bruit entre la flaque claire et son cœur foncé
const MOUSSE = [[98, 152, 62], [132, 184, 80]]; // mousse : ton franc, ton clair (sommet des plaques)
const MOUSSE_CONTOUR = [48, 92, 40]; // fin contour sombre autour de la plaque
const MOUSSE_SEUIL = [0, 0.73, 0.67]; // la mousse commence au-dessus de ce bruit
const MOUSSE_JOINT = 0.07; // bonus de bruit au bord des dalles de pierre (la mousse suit les joints)
const MOUSSE_PORTEE = 6; // distance au joint (px virtuels) sur laquelle le bonus s'éteint
const FISSURE_ZONE = [0, 0.55, 0.4]; // les fissures n'existent que là où le bruit de zone dépasse ce seuil
const FISSURE_LARGEUR = 0.0095; // demi-largeur de la fissure principale, en bruit
const BRANCHE_LARGEUR = 0.011; // demi-largeur de la zone des branches
const LISERE_LARGEUR = 0.0045; // liseré clair le long de la fissure (en bruit), d'un seul côté
const LISERE = [236, 226, 204];
// Lisières de la ruine (en valeur du masque de végétation, dont les paliers sont séparés de 0,02).
const LISIERE = 0.0022; // épaisseur du trait de lisière
const NET = 0.0011; // adoucissement d'un palier net
const TERRE_BORD = [86, 58, 36], HERBE_BORD = [46, 82, 38];

/**
 * Abîme `out` (le sol dessiné) selon l'usure (1 usée, 2 en ruine). `mousseOk` : le sol peut porter de la mousse ; `fissureOk` : il reçoit des
 * fissures (la pierre a déjà les siennes) ; `bord` : distance au joint de dalles en px virtuels (ou -1 si le sol n'a pas de joints).
 */
export function abimerDessine(X, Y, usure, mousseOk, fissureOk, bord, out) {
  const fx = X / PERIODE, fy = Y / PERIODE;
  // Saleté : des flaques à bords nets, deux tons (cœur plus foncé), un trait plus foncé juste au bord.
  const sale = fbmp(fx, fy, 10, 120, 2), ss = SALE_SEUIL[usure];
  if (sale > ss - 0.02) {
    const a = marche(sale, ss, 0.008), b = marche(sale, ss + SALE_PROFONDE, 0.008);
    if (a > 0) {
      vers(out, SALE[0], a * SALE_FORCE[usure]);
      vers(out, SALE[1], b * SALE_FORCE[usure] * 0.9);
      vers(out, SALE[1], a * (1 - marche(sale, ss + 0.01, 0.004)) * 0.5); // bord plus sombre, net comme un trait
    }
  }
  // Mousse : plaques franches de deux tons, contour sombre ; sur la pierre, elles s'accrochent aux joints.
  if (mousseOk) {
    const joint = bord >= 0 ? (1 - Math.min(1, bord / MOUSSE_PORTEE)) * MOUSSE_JOINT : 0;
    const mo = fbmp(fx, fy, 14, 130, 2) + joint, ms = MOUSSE_SEUIL[usure];
    if (mo > ms - 0.02) {
      const a = marche(mo, ms, 0.008);
      if (a > 0) {
        vers(out, MOUSSE_CONTOUR, a * (1 - marche(mo, ms + 0.012, 0.005)) * 0.9);
        const dedans = marche(mo, ms + 0.012, 0.006);
        vers(out, MOUSSE[0], dedans * 0.9);
        // Le sommet de la plaque est plus clair, et quelques brins sombres y sont semés.
        vers(out, MOUSSE[1], marche(mo, ms + 0.07, 0.008) * 0.85);
        semis(X, Y, 8, 0.5, 0.7, 1.3, 133);
        if (D.d < 1) vers(out, MOUSSE_CONTOUR, dedans * 0.5 * (1 - marche(D.d, 0.6, 0.35)));
      }
    }
  }
  // Fissures : un trait d'encre fin qui se ramifie, et un liseré clair du côté de la lumière.
  if (fissureOk) {
    const zone = vbp(fx, fy, 2, 2, 141), seuil = FISSURE_ZONE[usure];
    if (zone > seuil) {
      const z = marche(zone, seuil, 0.03), s = fbmp(fx, fy, 9, 140, 2) - 0.5, d = Math.abs(s);
      let encre = d < FISSURE_LARGEUR ? 1 - marche(d, FISSURE_LARGEUR * 0.55, FISSURE_LARGEUR * 0.45) : 0;
      if (d < BRANCHE_LARGEUR * 6) {
        const near = 1 - marche(d, BRANCHE_LARGEUR * 4, BRANCHE_LARGEUR * 2); // les branches partent des abords de la fissure
        const sb = Math.abs(fbmp(fx, fy, 24, 142, 1) - 0.5);
        if (sb < FISSURE_LARGEUR * 0.8) encre = Math.max(encre, near * (1 - marche(sb, FISSURE_LARGEUR * 0.4, FISSURE_LARGEUR * 0.35)));
      }
      if (encre > 0) vers(out, ENCRE, encre * z * 0.9);
      else if (s > 0 && s < FISSURE_LARGEUR + LISERE_LARGEUR) vers(out, LISERE, z * 0.4 * (1 - marche(s, FISSURE_LARGEUR + LISERE_LARGEUR * 0.5, LISERE_LARGEUR * 0.4)));
    }
  }
}

/**
 * Lisière nette d'un sol en ruine avant la terre : la mousse (masque `mv` entre `sm` et `st`), en deux paliers et bordée d'un trait sombre.
 * Rend vrai quand `mv` est dans cette bande (le reste de la ruine ne s'applique alors pas).
 */
export function mousseRuine(mv, sm, st, out) {
  if (mv >= st) return false;
  const bande = (mv - sm) / (st - sm);
  vers(out, MOUSSE[0], 0.88);
  vers(out, MOUSSE[1], 0.9 * marche(bande, 0.55, NET / (st - sm)));
  vers(out, MOUSSE_CONTOUR, 1 - marche(mv, sm + LISIERE, NET));
  return true;
}

/** Trait de lisière de la terre (au seuil `st`) et de l'herbe (au seuil `sh`) : à appeler après avoir posé la terre ou l'herbe. */
export function lisiereTerre(mv, st, out) { if (mv < st + LISIERE) vers(out, TERRE_BORD, 0.85 * (1 - marche(mv, st + LISIERE, NET))); }
export function lisiereHerbe(mv, sh, out) { if (mv < sh + LISIERE) vers(out, HERBE_BORD, 0.85 * (1 - marche(mv, sh + LISIERE, NET))); }
export { NET };
