/**
 * Le catalogue d'objets (Portes, Mobilier, Créatures) dans la colonne de droite du Donjon : deux onglets en haut de l'inspecteur,
 * « Salle » (l'inspecteur : propriétés de la salle ou de l'objet choisi) et « Ajouter » (le catalogue de vignettes, js/palette.js).
 * Les onglets sont ceux de la coquille (`coquille.onglets`, comme dans Jouer).
 *
 *   const cat = creerCatalogueOnglet(coquille, ctx);
 *   cat.montrer(vrai | faux)   les onglets n'ont de sens que dans le Donjon (le Monde y met ses propres inspecteurs)
 *
 * Ordinateur : #palette se range dans la colonne, sous les onglets ; poser un objet marche comme avant (armer, puis cliquer la carte).
 * Cliquer un objet déjà posé (porte, objet, créature, pion) ramène sur « Salle » ; choisir dans « Ajouter » y reste tant qu'on pose.
 * Sous 760 px : pas d'onglets, #palette retourne dans la zone de la scène et le « + Ajouter » du bas l'ouvre en tiroir (js/mj/vue-carte.js).
 */
import { $ } from '../dom.js';
import { TYPES_ELEMENT } from '../atelier-selection.js';
import { telephone } from '../telephone.js';

export function creerCatalogueOnglet(coquille, ctx) {
  const colonne = coquille.colonneInspecteur;
  const palette = $('palette');
  const zone = $('zone-scene');
  const tete = colonne.querySelector('.atelier-inspecteur-tete');
  const corps = colonne.querySelector('.atelier-inspecteur-corps');
  for (const e of [tete, corps, palette]) e.dataset.sansMasque = '1';

  const { onglets } = coquille;
  onglets.element.classList.add('onglets-donjon');
  onglets.element.setAttribute('aria-label', 'Salle ou catalogue');
  onglets.ajouter({ id: 'salle', libelle: 'Salle', contenu: [tete, corps] });
  onglets.ajouter({ id: 'ajouter', libelle: 'Ajouter', contenu: palette });
  onglets.choisir('salle');

  /** Ordinateur : le catalogue est dans la colonne ; téléphone : dans la scène (tiroir du bas). */
  function placer() {
    if (telephone()) {
      if (palette.parentNode !== zone) zone.prepend(palette);
      palette.setAttribute('role', 'group'); palette.removeAttribute('aria-labelledby'); // un tiroir, plus un panneau d'onglet
      onglets.choisir('salle');
    } else {
      if (palette.parentNode !== colonne) colonne.append(palette);
      palette.setAttribute('role', 'tabpanel'); palette.setAttribute('aria-labelledby', 'atelier-onglet-ajouter');
    }
  }
  matchMedia('(max-width: 760px)').addEventListener('change', placer);
  placer();

  // Un objet posé qu'on clique sur la carte : ses réglages (onglet « Salle »). Armer un objet du catalogue, lui, ne change pas d'onglet.
  coquille.surSelection((sel) => { if (sel && TYPES_ELEMENT.includes(sel.type)) onglets.choisir('salle'); });

  // La vue d'ensemble ne pose rien : retour sur « Salle » (les onglets s'effacent, css/donjon.css).
  new MutationObserver(() => { if (document.body.classList.contains('vue-plan')) onglets.choisir('salle'); })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });

  return {
    montrer: (oui) => { onglets.element.hidden = !oui; if (!oui) onglets.choisir('salle'); },
  };
}
