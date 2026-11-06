/**
 * L'AFFICHAGE est UNE préférence, commune aux salles de donjon, aux cartes image et à la régie, réglable à tout moment : les champs de
 * carte-de-mj:reglages-v1 (aucune nouvelle clé). Un seul contrôle les règle, le bouton « Affichage » de la barre d'outils de la scène
 * (js/atelier/coquille.js, option `affichage`) : un popover, le même en Préparer et en Jouer, avec
 *   Grille          interrupteur Afficher / Masquer et opacité des lignes (`cases`, 0–100 %) ;
 *   Carte           thème (peint / vectoriel), détails des sols (riches / sobres), relief des murs ;
 *   À la table      pénombre (0–100 %), flammes animées, repères de cases (A, B… et 1, 2…).
 * Ce qui touche à la table physique (mode remplir / échelle réelle, rotation, miroir, calibrage, mini-carte, défilement) reste dans l'onglet
 * Table de la régie ; l'échelle (m par case) reste dans l'inspecteur du donjon, car elle sert à écrire et à créer les salles.
 *
 *   const a = creerAffichagePopover({ lire: () => r, surChangement: () => { sauver; redessiner; diffuser } });
 *   a.element  le bouton et son popover (à poser dans la barre) ; a.maj()  relit `lire()` ; a.fermer()
 *
 * `lire()` rend l'objet des réglages de la page : un contrôle y écrit (une valeur par défaut n'est pas écrite, voir stockage.js), puis appelle
 * `surChangement`. Sous 760 px, le popover est une feuille du bas aux cibles de 44 px (css/atelier.css).
 * Les fonctions pures (`appliquerCases`, `casesApresBascule`, `appliquerRendu`) se testent sous Node.
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';
import {
  casesDeReglages, casesValides, CASES_PAR_DEFAUT, themeDeReglages, detailsDeReglages, reliefDeReglages, penombreDeReglages, flammesDeReglages,
  THEME_PAR_DEFAUT, DETAILS_PAR_DEFAUT, PENOMBRE_PAR_DEFAUT, THEMES_RENDU, DETAILS_SOLS,
} from '../affichage.js';

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

/**
 * Écrit un réglage de rendu dans `r` : une valeur par défaut est effacée plutôt qu'écrite. `champ` : theme, details, relief, penombre,
 * flammes ou reperes. Rend la valeur retenue (une valeur illisible laisse `r` intact et rend la valeur actuelle).
 */
export function appliquerRendu(r, champ, valeur) {
  switch (champ) {
    case 'theme':
      if (!THEMES_RENDU.includes(valeur)) return themeDeReglages(r);
      if (valeur === THEME_PAR_DEFAUT) delete r.theme; else r.theme = valeur;
      return valeur;
    case 'details':
      if (!DETAILS_SOLS.includes(valeur)) return detailsDeReglages(r);
      if (valeur === DETAILS_PAR_DEFAUT) delete r.details; else r.details = valeur;
      return valeur;
    case 'relief': if (valeur) delete r.relief; else r.relief = false; return !!valeur;
    case 'flammes': if (valeur) delete r.flammes; else r.flammes = false; return !!valeur;
    case 'reperes': r.reperes = !!valeur; return !!valeur;
    case 'penombre': {
      const v = Math.max(0, Math.min(100, Math.round(Number(valeur)) || 0));
      if (v === PENOMBRE_PAR_DEFAUT) delete r.penombre; else r.penombre = v;
      return v;
    }
    default: throw new Error(`Réglage de rendu inconnu : « ${champ} »`);
  }
}

export function creerAffichagePopover({ lire, surChangement }) {
  let derniere = 0; // la dernière opacité visible vue ici ; `casesAvant` (réglages) la garde d'une page à l'autre
  const bouton = h('button', { type: 'button', className: 'btn btn-icone btn-discret atelier-affichage-bouton', 'aria-label': 'Affichage', title: 'Affichage : grille, thème, détails, relief, pénombre, flammes, repères', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, icone('affichage'));
  // Le même interrupteur que « Départ de la partie » (css/univers.css) : une glissière, et le libellé à côté.
  const interrupteur = h('input', { type: 'checkbox', role: 'switch', checked: true, 'aria-label': 'Afficher la grille' });
  const interrupteurLigne = h('label', { className: 'univers-interrupteur atelier-affichage-interrupteur' }, interrupteur, h('span', { className: 'univers-glissiere', 'aria-hidden': 'true' }), h('span', { textContent: 'Afficher la grille' }));
  const curseur = h('input', { type: 'range', min: '0', max: '100', step: '5', id: 'cases', 'aria-label': 'Opacité des lignes de la grille' });
  const valeur = h('output', { className: 'atelier-affichage-valeur' });
  const theme = h('select', { id: 'theme' }, h('option', { value: 'peint', textContent: 'Peint' }), h('option', { value: 'vectoriel', textContent: 'Vectoriel' }));
  const details = h('select', { id: 'details' }, h('option', { value: 'riches', textContent: 'Riches' }), h('option', { value: 'sobres', textContent: 'Sobres' }));
  const relief = h('input', { type: 'checkbox', id: 'relief' });
  const penombre = h('input', { type: 'range', min: '0', max: '100', step: '5', id: 'penombre', 'aria-label': 'Pénombre' });
  const penombreVal = h('output', { className: 'atelier-affichage-valeur', id: 'penombre-val' });
  const flammes = h('input', { type: 'checkbox', id: 'flammes' });
  const reperes = h('input', { type: 'checkbox', id: 'reperes' });
  const ligne = (texte, champ, titre) => h('label', { className: 'atelier-affichage-ligne atelier-affichage-choix', title: titre ?? '' }, h('span', { textContent: texte }), champ);
  const caseACocher = (texte, champ) => h('label', { className: 'atelier-affichage-case' }, champ, h('span', { textContent: texte }));
  const groupe = (titre, ...enfants) => h('div', { className: `atelier-affichage-groupe${titre === 'Grille' ? '' : ' pour-donjon'}` }, h('p', { className: 'atelier-affichage-sous-titre', textContent: titre }), ...enfants);
  const panneau = h('div', { className: 'atelier-affichage-panneau', role: 'dialog', 'aria-label': 'Affichage', hidden: true },
    h('p', { className: 'atelier-affichage-titre', textContent: 'Affichage' }),
    groupe('Grille', interrupteurLigne,
      h('label', { className: 'atelier-affichage-ligne' }, h('span', { textContent: 'Opacité des lignes' }), curseur, valeur)),
    groupe('Carte', ligne('Thème', theme), ligne('Détails des sols', details, 'Sols dessinés et détaillés, ou sols simples (thème peint).'), caseACocher('Relief des murs', relief)),
    groupe('À la table',
      h('label', { className: 'atelier-affichage-ligne', title: 'Obscurité de la salle à la table. La vue du MJ n’en garde qu’une part, pour tout voir.' },
        h('span', { textContent: 'Pénombre' }), penombre, penombreVal),
      caseACocher('Flammes animées', flammes), caseACocher('Repères (A, B… et 1, 2…)', reperes)));
  const racine = h('div', { className: 'atelier-affichage' }, bouton, panneau);

  function maj() {
    const r = lire() ?? {};
    const n = casesDeReglages(r);
    if (n > 0) derniere = n;
    interrupteur.checked = n > 0;
    curseur.value = String(n);
    valeur.textContent = `${n} %`;
    theme.value = themeDeReglages(r);
    details.value = detailsDeReglages(r);
    relief.checked = reliefDeReglages(r);
    penombre.value = String(penombreDeReglages(r));
    penombreVal.textContent = `${penombreDeReglages(r)} %`;
    flammes.checked = flammesDeReglages(r);
    reperes.checked = r.reperes !== false;
  }
  function ecrire(v) { appliquerCases(lire(), v); maj(); surChangement(); }
  /** Un réglage de rendu : écrit dans les réglages de la page, les contrôles se remettent d'accord, la page enregistre et redessine. */
  function ecrireRendu(champ, v) { appliquerRendu(lire(), champ, v); maj(); surChangement(); }
  function ouvrir() { maj(); panneau.hidden = false; bouton.setAttribute('aria-expanded', 'true'); }
  function fermer({ rendreFocus = false } = {}) {
    if (panneau.hidden) return;
    panneau.hidden = true; bouton.setAttribute('aria-expanded', 'false');
    if (rendreFocus) bouton.focus();
  }
  bouton.addEventListener('click', () => { if (panneau.hidden) ouvrir(); else fermer(); });
  interrupteur.addEventListener('change', () => ecrire(casesApresBascule(lire() ?? {}, derniere)));
  curseur.addEventListener('input', () => ecrire(curseur.value));
  theme.addEventListener('change', () => ecrireRendu('theme', theme.value));
  details.addEventListener('change', () => ecrireRendu('details', details.value));
  relief.addEventListener('change', () => ecrireRendu('relief', relief.checked));
  penombre.addEventListener('input', () => ecrireRendu('penombre', penombre.value));
  flammes.addEventListener('change', () => ecrireRendu('flammes', flammes.checked));
  reperes.addEventListener('change', () => ecrireRendu('reperes', reperes.checked));
  document.addEventListener('pointerdown', (e) => { if (!panneau.hidden && !racine.contains(e.target)) fermer(); });
  racine.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panneau.hidden) { e.preventDefault(); e.stopPropagation(); fermer({ rendreFocus: true }); } });
  maj();
  return { bouton, element: racine, maj, fermer };
}
