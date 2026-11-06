/**
 * Le catalogue d'objets dans la colonne de droite du Donjon : quatre onglets-icônes en haut de l'inspecteur, « Salle » (l'inspecteur :
 * propriétés de la salle ou de l'objet choisi) puis « Portes », « Mobilier » et « Créatures » (le catalogue de vignettes, js/palette.js,
 * sur la catégorie choisie). Les onglets sont ceux de la coquille (`coquille.onglets`, comme dans Jouer).
 *
 *   const cat = creerCatalogueOnglet(coquille, ctx);
 *   cat.montrer(vrai | faux)   les onglets n'ont de sens que dans le Donjon (le Monde y met ses propres inspecteurs)
 *
 * Ordinateur : #palette se range dans la colonne, sous les onglets ; poser un objet marche comme avant (armer, puis cliquer la carte).
 * Cliquer un objet déjà posé (porte, objet, créature, pion) ramène sur « Salle » ; changer d'onglet ne désarme pas l'objet armé (pose en série).
 * Sous 760 px : pas d'onglets, #palette retourne dans la zone de la scène et le « + Ajouter » du bas l'ouvre en tiroir (js/mj/vue-carte.js).
 */
import { $ } from '../dom.js';
import { TYPES_ELEMENT } from '../atelier-selection.js';
import { telephone } from '../telephone.js';
import { OUTILS, OUTILS_CATALOGUE } from '../rail.js';

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
  onglets.ajouter({ id: 'salle', libelle: 'Salle', icone: 'salle', contenu: [tete, corps] });
  // Les trois catégories partagent le même catalogue : l'onglet choisit le groupe affiché (js/palette.js).
  const ICONES_GROUPE = { portes: 'porte', mobilier: 'objet', creatures: 'creature' };
  for (const o of OUTILS) onglets.ajouter({ id: o.id, libelle: o.titre, icone: ICONES_GROUPE[o.id], contenu: palette });
  onglets.surChoix((id) => { if (OUTILS_CATALOGUE.includes(id)) ctx.carte.palette.afficherGroupe(id); });
  onglets.choisir('salle');

  /** Ordinateur : le catalogue est dans la colonne ; téléphone : dans la scène (tiroir du bas). */
  function placer() {
    if (telephone()) {
      if (palette.parentNode !== zone) zone.prepend(palette);
      palette.setAttribute('role', 'group'); palette.removeAttribute('aria-labelledby'); // un tiroir, plus un panneau d'onglet
      onglets.choisir('salle');
    } else {
      if (palette.parentNode !== colonne) colonne.append(palette);
      palette.setAttribute('role', 'tabpanel'); palette.setAttribute('aria-labelledby', `atelier-onglet-${onglets.courant()}`);
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
