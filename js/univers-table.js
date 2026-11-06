/**
 * La carte d'univers à la table (DOM) : l'image en grand et les points que la table a le droit de voir. Aucun clic : un doigt de
 * joueur sur la carte ne déclenche rien. Elle vit dans `#univers-table`, DANS `#orientation-table` : la rotation et le miroir réglés
 * pour la table s'appliquent donc comme pour une carte de donjon.
 * Taille : en « échelle réelle » (`mode` reel), une carte qui a une grille calée est mise à l'échelle pour qu'une case mesure la taille
 * calibrée de la table (`taille`, soit `caseMm` mm) ; sans grille, ou en « remplir », la carte tient dans l'écran. La grille est tracée
 * avec l'opacité du réglage « Cases ». Ne lit jamais le stockage : l'image est retrouvée par sa référence (js/univers-images.js).
 */
import { creerCarteUnivers } from './univers-carte.js';
import * as images from './univers-images.js';
import { dimensionsTable } from './univers-grille.js';
import { casesDeReglages, TAILLE_PAR_DEFAUT } from './affichage.js';
import { $, h } from './dom.js';

export function creerTableUnivers() {
  const racine = $('univers-table');
  const titre = h('p', { className: 'univers-table-titre', hidden: true });
  const zone = h('div', { className: 'univers-table-zone' });
  racine.replaceChildren(zone, titre);
  const carte = creerCarteUnivers(zone, {});
  let sequence = 0;
  let courante = null; // { vue, affichage, cle }
  let defilerAuCentre = false;
  let connue = null; // { ref, url } : la dernière image chargée

  /** Donne à l'image sa taille à l'écran (voir dimensionsTable) ; rappelée au chargement de l'image, au redimensionnement et à chaque message. */
  function dimensionner() {
    const img = carte.image;
    const dims = carte.dimensions();
    if (!courante || !dims) return;
    const marge = 24; // le padding de la zone
    const d = dimensionsTable({
      mode: courante.affichage.mode, grille: courante.vue.grille ?? null, taille: courante.affichage.taille ?? TAILLE_PAR_DEFAUT, image: dims,
      zone: { largeur: Math.max(0, zone.clientWidth - marge), hauteur: Math.max(0, zone.clientHeight - marge) },
    });
    if (!d) return;
    img.style.width = `${Math.round(d.largeur)}px`;
    img.style.height = `${Math.round(d.hauteur)}px`;
    zone.classList.toggle('defile', d.defile);
    if (d.defile && defilerAuCentre) {
      zone.scrollLeft = (zone.scrollWidth - zone.clientWidth) / 2;
      zone.scrollTop = (zone.scrollHeight - zone.clientHeight) / 2;
    }
    defilerAuCentre = false;
  }
  carte.image.addEventListener('load', () => { defilerAuCentre = true; dimensionner(); });
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => dimensionner()).observe(zone);
  else window.addEventListener('resize', dimensionner);

  return {
    /** Montre la vue (relue par lireVueUnivers). L'image arrive quand la bibliothèque a répondu ; sans elle, un message le dit. */
    async montrer({ image, nom, points, grille }, affichage = {}) {
      const moi = ++sequence;
      racine.hidden = false;
      $('orientation-table').classList.add('avec-univers');
      titre.hidden = !nom;
      titre.textContent = nom ?? '';
      const cle = `${image.source}:${image.id}:${affichage.mode}:${grille ? `${grille.case}/${grille.dx}/${grille.dy}` : ''}:${affichage.taille}`;
      if (cle !== courante?.cle) defilerAuCentre = true;
      courante = { vue: { image, nom, points, grille }, affichage, cle };
      const donnees = { grille: grille ?? null, opacite: casesDeReglages(affichage) / 100, points: points.map((p) => ({ id: p.id, x: p.x, y: p.y, nom: p.nom ?? '' })), alt: nom ? `Carte : ${nom}` : 'Carte' };
      const refCle = `${image.source}:${image.id}`;
      if (connue?.ref === refCle && connue.url) { // même carte : on ne la recharge pas à chaque point révélé
        carte.afficher({ ...donnees, url: connue.url, absente: '' });
        dimensionner();
        return;
      }
      carte.afficher({ ...donnees, url: null, absente: '' });
      carte.image.style.width = ''; carte.image.style.height = '';
      const url = await images.urlImage(image);
      if (moi !== sequence) return;
      connue = { ref: refCle, url };
      carte.afficher({ ...donnees, url, absente: 'La carte n’a pas pu être chargée sur cet écran (elle n’est pas dans la bibliothèque de ce navigateur).' });
      dimensionner();
    },
    masquer() {
      sequence++;
      courante = null;
      connue = null;
      racine.hidden = true;
      $('orientation-table').classList.remove('avec-univers');
    },
    visible: () => !racine.hidden,
  };
}
