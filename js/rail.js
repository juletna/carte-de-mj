/**
 * Rail d'outils du Donjon (à gauche, à la Canva) et panneau contextuel qui lui répond.
 *
 * Le rail est une colonne de boutons (`data-outil`, `aria-pressed`). Choisir un outil affiche son contenu dans le panneau :
 * les blocs du panneau portent `data-pour="outil1 outil2"` et sont masqués (`hidden`) quand ils ne concernent pas l'outil.
 * Sur ordinateur, cliquer l'outil déjà actif replie le panneau (la carte récupère la place) ; un autre clic le rouvre.
 * Sur téléphone, le rail devient une rangée dans l'onglet Texte : il n'offre que les outils de texte et ne replie rien.
 * Le dernier outil et l'état replié sont mémorisés (localStorage, jamais bloquant).
 */

/** Outils qui montrent le catalogue de vignettes ; sur téléphone, il vit dans un tiroir de l'onglet Carte. */
export const OUTILS_CATALOGUE = ['portes', 'mobilier', 'creatures'];
export const OUTIL_DEFAUT = 'salle';

/**
 * État mémorisé → { outil, replie }, sans jamais échouer : texte absent, abîmé ou d'un outil inconnu → valeurs par défaut.
 * @param {string|null} brut  contenu du localStorage
 * @param {string[]} valides  outils connus
 */
export function etatDepuis(brut, valides) {
  let lu = null;
  try { lu = JSON.parse(brut); } catch { /* texte abîmé : défauts */ }
  const outil = lu && valides.includes(lu.outil) ? lu.outil : OUTIL_DEFAUT;
  return { outil, replie: !!lu && lu.replie === true };
}

/**
 * Outil réellement affiché : sur téléphone, un outil de catalogue n'a pas de panneau (il passe par le tiroir) ;
 * on montre alors l'outil par défaut dans l'onglet Texte.
 */
export function outilAffiche(outil, surTelephone) {
  return surTelephone && OUTILS_CATALOGUE.includes(outil) ? OUTIL_DEFAUT : outil;
}

/**
 * @param {HTMLElement} nav  le rail (boutons `button[data-outil]`)
 * @param {{
 *   cle: string,                          clé du localStorage
 *   telephone: () => boolean,
 *   titres: Object<string,string>,        titre du panneau par outil
 *   onChange?: (etat: {outil: string, replie: boolean}) => void   après chaque changement (panneau déjà mis à jour)
 * }} options
 * @returns {{ choisir: (outil: string) => void, etat: () => {outil: string, replie: boolean}, appliquer: () => void }}
 */
export function creerRail(nav, { cle, telephone, titres, onChange }) {
  const boutons = [...nav.querySelectorAll('button[data-outil]')];
  const valides = boutons.map((b) => b.dataset.outil);
  let brut = null;
  try { brut = localStorage.getItem(cle); } catch { /* stockage indisponible */ }
  const etat = etatDepuis(brut, valides);
  const titre = document.getElementById('panneau-titre');

  function memoriser() {
    try { localStorage.setItem(cle, JSON.stringify(etat)); } catch { /* le choix n'est pas retenu */ }
  }

  /** Montre le bon contenu et pose l'état sur la page (appelée aussi quand on passe de l'ordinateur au téléphone). */
  function appliquer() {
    const tel = telephone();
    const affiche = outilAffiche(etat.outil, tel);
    const replie = !tel && etat.replie;
    for (const b of boutons) b.setAttribute('aria-pressed', String(b.dataset.outil === affiche && !replie));
    for (const bloc of document.querySelectorAll('[data-pour]')) {
      // Le catalogue (tiroir) n'est jamais masqué sur téléphone : le CSS l'affiche seulement quand il est ouvert.
      const catalogue = bloc.dataset.pour.split(' ').some((o) => OUTILS_CATALOGUE.includes(o));
      bloc.hidden = catalogue && tel ? false : !bloc.dataset.pour.split(' ').includes(affiche);
    }
    document.body.classList.toggle('panneau-replie', replie);
    document.body.dataset.outil = affiche;
    if (titre) titre.textContent = titres[affiche] || '';
    onChange?.({ outil: affiche, replie });
  }

  function choisir(outil) {
    if (!valides.includes(outil)) return;
    if (!telephone() && outil === etat.outil && !etat.replie) etat.replie = true; // l'outil actif : on replie
    else { etat.outil = outil; etat.replie = false; }
    memoriser();
    appliquer();
  }

  for (const b of boutons) b.addEventListener('click', () => choisir(b.dataset.outil));
  // Flèches haut/bas (ou gauche/droite sur téléphone) : passe d'un outil à l'autre du rail, comme une barre d'outils.
  nav.addEventListener('keydown', (e) => {
    const sens = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!sens) return;
    const visibles = boutons.filter((b) => b.offsetParent !== null);
    const i = visibles.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    visibles[(i + sens + visibles.length) % visibles.length].focus();
  });
  document.getElementById('panneau-replier')?.addEventListener('click', () => { etat.replie = true; memoriser(); appliquer(); });

  appliquer();
  return { choisir, etat: () => ({ ...etat }), appliquer };
}
