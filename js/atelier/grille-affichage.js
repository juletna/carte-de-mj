/**
 * La grille est UNE préférence d'affichage, commune aux salles de donjon et aux cartes image, réglable à tout moment : le réglage `cases`
 * (opacité des lignes, 0–100 %) de carte-de-mj:reglages-v1. Un seul contrôle la règle, le bouton « Grille » de la barre d'outils de la scène
 * (js/atelier/coquille.js, option `grille`) : un popover avec l'interrupteur Afficher / Masquer et le curseur d'opacité.
 *
 *   const g = creerGrilleAffichage({ lire: () => r, surChangement: () => { sauver; redessiner; diffuser } });
 *   g.element  le bouton et son popover (à poser dans la barre) ; g.maj()  relit `lire()` ; g.fermer()
 *
 * `lire()` rend l'objet des réglages de la page : le contrôle y écrit `cases` (et `grille`, le booléen des versions précédentes), puis appelle
 * `surChangement`. Sous 760 px, le popover est une feuille du bas aux cibles de 44 px (css/atelier.css).
 * Les fonctions pures (`appliquerCases`, `casesApresBascule`) se testent sous Node.
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';
import { casesDeReglages, casesValides, CASES_PAR_DEFAUT } from '../affichage.js';

/**
 * Écrit l'opacité (0–100, entier) dans les réglages ; `grille` suit (vrai dès que les lignes se voient). Rend la valeur retenue.
 * La dernière opacité visible survit au masquage dans le champ facultatif `casesAvant` (même clé de réglages) : écrit seulement quand la grille
 * est masquée et que cette opacité n'est pas celle par défaut (60 %), effacé dès que les lignes réapparaissent.
 */
export function appliquerCases(r, v) {
  const avant = casesDeReglages(r);
  const n = Math.max(0, Math.min(100, Math.round(Number(v)) || 0));
  r.cases = n;
  r.grille = n > 0;
  if (n > 0) delete r.casesAvant;
  else if (avant > 0 && avant !== CASES_PAR_DEFAUT) r.casesAvant = avant;
  else if (avant > 0) delete r.casesAvant;
  return n;
}
/** La valeur après un clic sur l'interrupteur : 0 si la grille se voyait, sinon la dernière opacité visible (`casesAvant`, puis `derniere`, puis 60 %). */
export function casesApresBascule(r, derniere = 0) {
  if (casesDeReglages(r) > 0) return 0;
  return casesValides(r.casesAvant) && r.casesAvant > 0 ? r.casesAvant : (derniere > 0 ? derniere : CASES_PAR_DEFAUT);
}

export function creerGrilleAffichage({ lire, surChangement }) {
  let derniere = 0; // la dernière opacité visible vue ici ; `casesAvant` (réglages) la garde d'une page à l'autre
  const bouton = h('button', { type: 'button', className: 'btn btn-icone btn-discret atelier-grille-bouton', 'aria-label': 'Grille', title: 'Grille : afficher ou masquer, opacité des lignes', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, icone('grille'));
  const interrupteur = h('button', { type: 'button', className: 'btn atelier-grille-interrupteur', role: 'switch', 'aria-checked': 'true' });
  const curseur = h('input', { type: 'range', min: '0', max: '100', step: '5', id: 'cases', 'aria-label': 'Opacité des lignes de la grille' });
  const valeur = h('output', { className: 'atelier-grille-valeur' });
  const panneau = h('div', { className: 'atelier-grille-panneau', role: 'dialog', 'aria-label': 'Grille', hidden: true },
    h('p', { className: 'atelier-grille-titre', textContent: 'Grille' }), interrupteur,
    h('label', { className: 'atelier-grille-ligne' }, h('span', { textContent: 'Opacité des lignes' }), curseur, valeur));
  const racine = h('div', { className: 'atelier-grille' }, bouton, panneau);

  function maj() {
    const n = casesDeReglages(lire() ?? {});
    if (n > 0) derniere = n;
    interrupteur.setAttribute('aria-checked', String(n > 0));
    interrupteur.textContent = n > 0 ? 'Grille affichée' : 'Grille masquée';
    curseur.value = String(n);
    valeur.textContent = `${n} %`;
  }
  function ecrire(v) { appliquerCases(lire(), v); maj(); surChangement(); }
  function ouvrir() { maj(); panneau.hidden = false; bouton.setAttribute('aria-expanded', 'true'); }
  function fermer({ rendreFocus = false } = {}) {
    if (panneau.hidden) return;
    panneau.hidden = true; bouton.setAttribute('aria-expanded', 'false');
    if (rendreFocus) bouton.focus();
  }
  bouton.addEventListener('click', () => { if (panneau.hidden) ouvrir(); else fermer(); });
  interrupteur.addEventListener('click', () => ecrire(casesApresBascule(lire() ?? {}, derniere)));
  curseur.addEventListener('input', () => ecrire(curseur.value));
  document.addEventListener('pointerdown', (e) => { if (!panneau.hidden && !racine.contains(e.target)) fermer(); });
  racine.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panneau.hidden) { e.preventDefault(); e.stopPropagation(); fermer({ rendreFocus: true }); } });
  maj();
  return { bouton, element: racine, maj, fermer };
}
