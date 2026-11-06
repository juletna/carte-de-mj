/**
 * La barre d'outils de la scène du Donjon (au-dessus de la carte) : « + Salle », « Vue d'ensemble », « Annuler », l'état de la pose,
 * et « + Ajouter » (écran étroit seulement : il ouvre le catalogue en tiroir du bas).
 * Les boutons existent dans donjon.html (`#barre-donjon`) : leurs écouteurs sont ceux de vue-carte.js, salles-liste.js, vue-plan.js
 * et main-mj.js ; ce module range le bloc dans `coquille.barreOutils`. Le catalogue lui-même (Portes, Mobilier, Créatures) est dans
 * la colonne de droite : js/atelier/catalogue-onglet.js.
 *
 *   const barre = creerBarreSalle(coquille);
 *   barre.montrer(vrai | faux)     le bloc n'a de sens que dans le Donjon (le Monde y met ses propres outils)
 *   barre.focusCatalogue()         rend le focus à « + Ajouter » (Échap ferme le tiroir du catalogue)
 */
import { $ } from '../dom.js';

export function creerBarreSalle(coquille) {
  const barre = $('barre-donjon');
  coquille.barreOutils.append(barre);

  return {
    montrer: (oui) => { barre.hidden = !oui; },
    focusCatalogue: () => { $('ajouter').focus(); }, // téléphone : Échap ferme le tiroir, « + Ajouter » reprend le focus
  };
}
