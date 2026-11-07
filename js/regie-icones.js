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
