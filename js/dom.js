/**
 * Petits outils DOM communs aux pages du site (Donjon, Présentation, Impression, cartes de fiche, palette).
 * Ils touchent `document` : ce module n'est pas pour Node. Le texte à afficher, lui, est dans format.js (pur).
 */

export const $ = (id) => document.getElementById(id);

/**
 * Crée un élément ; tout texte passe par textContent (jamais de HTML venu d'un fichier).
 * `style` est du texte CSS, `aria-*` et `data-*` deviennent des attributs ; le reste est affecté à la propriété.
 */
export function h(tag, props = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [cle, valeur] of Object.entries(props)) {
    if (cle === 'style') e.style.cssText = valeur;
    else if (cle.startsWith('aria-') || cle.startsWith('data-')) e.setAttribute(cle, valeur);
    else e[cle] = valeur;
  }
  e.append(...enfants);
  return e;
}

/** Un bouton de type « button » avec son écouteur de clic. */
export function bouton(texte, onClick, classe = '') {
  const b = h('button', { type: 'button', textContent: texte, className: classe });
  b.addEventListener('click', onClick);
  return b;
}

/**
 * Bouton qui demande confirmation au second clic, dans les 4 secondes. Renvoie la fonction qui le remet à son état de repos.
 * `annonce` (facultatif) : { zone, texte() } affiche, dans une zone à part, ce qui va être supprimé.
 * Le bouton garde alors sa largeur (rien ne bouge autour) ; la zone, placée après les autres actions, ne les déplace pas.
 */
export function deuxTemps(bouton, libelle, confirmation, action, annonce) {
  let attente;
  const reinitialiser = () => {
    clearTimeout(attente);
    bouton.dataset.confirme = '';
    bouton.textContent = libelle;
    bouton.classList.remove('danger');
    if (annonce) { bouton.style.minWidth = ''; annonce.zone.hidden = true; annonce.zone.textContent = ''; }
  };
  reinitialiser();
  bouton.addEventListener('click', () => {
    if (bouton.dataset.confirme === '1') { reinitialiser(); action(); return; }
    bouton.dataset.confirme = '1';
    if (annonce) bouton.style.minWidth = `${bouton.offsetWidth}px`;
    bouton.textContent = confirmation;
    bouton.classList.add('danger');
    if (annonce) { annonce.zone.textContent = annonce.texte(); annonce.zone.hidden = false; }
    attente = setTimeout(reinitialiser, 4000);
  });
  bouton.addEventListener('blur', reinitialiser);
  return reinitialiser;
}

/**
 * Début commun des écouteurs « change » d'un <input type="file"> : rend le fichier choisi (ou undefined) et vide le champ,
 * pour que choisir deux fois le même fichier déclenche encore l'événement.
 */
export function fichierChoisi(e) {
  const fichier = e.target.files[0];
  e.target.value = '';
  return fichier;
}
