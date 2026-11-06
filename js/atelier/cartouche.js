/**
 * Le cartouche d'échelle : un petit encart HTML, discret, posé en surimpression dans un coin de la scène (jamais dans le canevas) pour dire
 * combien de cases la carte compte et la distance qu'elles représentent.
 *
 *   salle           « 8 × 6 cases · 12 × 9 m · 1 case = 1,5 m »     (zone étroite : sans l'échelle ; téléphone : « 8 × 6 · 12 × 9 m »)
 *   lieu à grille   « 24 × 36 cases · 36 × 54 m »
 *   vue d'ensemble  « 1 case = 1,5 m »                               (l'échelle seule)
 *   lieu sans grille : rien (le cartouche se cache)
 *
 * Fonctions pures (testées sous Node) : `cartoucheSalle`, `cartoucheLieu`, `cartoucheEnsemble`, chacune rend `{ long, moyen, court } | null` (trois longueurs : la place dont dispose la zone décide de celle qu'on voit).
 * `creerCartouche()` rend `{ element, definir(textes | null) }` ; l'élément porte les trois versions, css/atelier.css montre la longue, la moyenne (zone étroite) ou la courte (sous 760 px).
 * Il ne reçoit jamais le pointeur (`pointer-events: none`) : il ne gêne ni un clic sur la carte ni un bouton. Chaque page le pose dans la
 * zone de la scène qui lui convient et le met à jour quand la salle, le lieu ou l'échelle changent.
 */
import { h } from '../dom.js';
import { virgule } from '../format.js';
import { tailleEnMetres, resumeTailleLieu } from './dimensions.js';

const echelleValide = (e) => Number.isFinite(e) && e > 0;
/** « 1 case = 1,5 m » ; vide si l'échelle est invalide. */
export const phraseEchelle = (echelle) => (echelleValide(echelle) ? `1 case = ${virgule(echelle)} m` : '');

/** Une taille en cases et en mètres : la version longue dit « cases », la courte (téléphone) la tait. */
function taille(largeur, hauteur, echelle) {
  if (!(largeur > 0 && hauteur > 0)) return null;
  const metres = tailleEnMetres(largeur, hauteur, echelle);
  return { cases: `${largeur} × ${hauteur}`, metres };
}

/** Une salle : « 8 × 6 cases · 12 × 9 m · 1 case = 1,5 m » ; courte : « 8 × 6 · 12 × 9 m ». */
export function cartoucheSalle(largeur, hauteur, echelle) {
  const t = taille(largeur, hauteur, echelle);
  if (!t) return null;
  const e = phraseEchelle(echelle);
  return {
    long: [`${t.cases} cases`, t.metres, e].filter(Boolean).join(' · '),
    moyen: [`${t.cases} cases`, t.metres].filter(Boolean).join(' · '),
    court: [t.cases, t.metres].filter(Boolean).join(' · '),
  };
}

/** Un lieu : sa taille d'après sa grille (voir `resumeTailleLieu`) ; rien sans grille ou sans dimensions connues. */
export function cartoucheLieu(grille, largeurPx, hauteurPx, echelle) {
  const long = resumeTailleLieu(grille, largeurPx, hauteurPx, echelle);
  if (!long) return null;
  return { long, moyen: long, court: long.replace(' cases', '') };
}

/** La vue d'ensemble du donjon : l'échelle seule. */
export function cartoucheEnsemble(echelle) {
  const e = phraseEchelle(echelle);
  return e ? { long: e, moyen: e, court: e } : null;
}

export function creerCartouche() {
  const long = h('span', { className: 'atelier-cartouche-long' });
  const moyen = h('span', { className: 'atelier-cartouche-moyen' });
  const court = h('span', { className: 'atelier-cartouche-court' });
  const element = h('p', { className: 'atelier-cartouche', hidden: true, title: 'Taille de la carte et distance représentée' }, long, moyen, court);
  /** `textes` : { long, moyen, court } (voir les fonctions ci-dessus) ou null pour cacher le cartouche. */
  function definir(textes) {
    const ok = !!textes?.long;
    element.hidden = !ok;
    for (const [el, t] of [[long, textes?.long], [moyen, textes?.moyen ?? textes?.long], [court, textes?.court ?? textes?.long]]) if (el.textContent !== (t ?? '')) el.textContent = t ?? '';
  }
  return { element, definir };
}
