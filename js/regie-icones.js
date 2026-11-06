/**
 * Icônes de la page Jouer : les éléments du HTML portent `data-icone="nom"` ; l'icône SVG commune (js/icones.js) est posée avant leur
 * texte au démarrage. Une icône seule garde son `aria-label` (obligatoire dans le HTML). Sert aussi à la vue table (?vue=table).
 */
import { icone } from './icones.js';

export function poserIcones(racine = document) {
  for (const e of racine.querySelectorAll('[data-icone]')) {
    if (e.querySelector(':scope > svg.icone')) continue;
    e.prepend(icone(e.dataset.icone));
  }
}

/** Remplace le contenu d'un bouton par une icône suivie d'un libellé (le texte d'un bouton qui change ne perd pas son icône). */
export function iconeEtTexte(bouton, nom, texte) {
  bouton.replaceChildren(icone(nom), ...(texte ? [document.createTextNode(` ${texte}`)] : []));
}

/**
 * Comme `deuxTemps` (js/dom.js) pour un bouton qui porte une icône : le second clic, dans les 4 secondes, confirme ; le bouton se remet
 * au repos (icône et libellé) en perdant le focus. Renvoie la fonction qui le remet au repos.
 */
export function deuxTempsIcone(bouton, nom, libelle, confirmation, action) {
  let attente;
  const reinitialiser = () => {
    clearTimeout(attente);
    bouton.dataset.confirme = '';
    iconeEtTexte(bouton, nom, libelle);
  };
  reinitialiser();
  bouton.addEventListener('click', () => {
    if (bouton.dataset.confirme === '1') { reinitialiser(); action(); return; }
    bouton.dataset.confirme = '1';
    iconeEtTexte(bouton, nom, confirmation);
    attente = setTimeout(reinitialiser, 4000);
  });
  bouton.addEventListener('blur', reinitialiser);
  return reinitialiser;
}
