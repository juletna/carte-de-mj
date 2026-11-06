/**
 * La carte d'univers à la table (DOM) : l'image en grand et les points que la table a le droit de voir. Aucun clic : un doigt de
 * joueur sur la carte ne déclenche rien. Elle vit dans `#univers-table`, DANS `#orientation-table` : la rotation et le miroir réglés
 * pour la table s'appliquent donc comme pour une carte de donjon.
 * Ne lit jamais le stockage : l'image est retrouvée par sa référence (js/univers-images.js).
 */
import { creerCarteUnivers } from './univers-carte.js';
import * as images from './univers-images.js';
import { $, h } from './dom.js';

export function creerTableUnivers() {
  const racine = $('univers-table');
  const titre = h('p', { className: 'univers-table-titre', hidden: true });
  const zone = h('div', { className: 'univers-table-zone' });
  racine.replaceChildren(zone, titre);
  const carte = creerCarteUnivers(zone, {});
  let sequence = 0;
  return {
    /** Montre la vue (relue par lireVueUnivers). L'image arrive quand la bibliothèque a répondu ; sans elle, un message le dit. */
    async montrer({ image, nom, points }) {
      const moi = ++sequence;
      racine.hidden = false;
      $('orientation-table').classList.add('avec-univers');
      titre.hidden = !nom;
      titre.textContent = nom ?? '';
      const donnees = { points: points.map((p) => ({ id: p.id, x: p.x, y: p.y, nom: p.nom ?? '' })), alt: nom ? `Carte : ${nom}` : 'Carte' };
      carte.afficher({ ...donnees, url: null, absente: '' });
      const url = await images.urlImage(image);
      if (moi !== sequence) return;
      carte.afficher({ ...donnees, url, absente: 'La carte n’a pas pu être chargée sur cet écran (elle n’est pas dans la bibliothèque de ce navigateur).' });
    },
    masquer() {
      sequence++;
      racine.hidden = true;
      $('orientation-table').classList.remove('avec-univers');
    },
    visible: () => !racine.hidden,
  };
}
