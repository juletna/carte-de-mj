/**
 * La barre d'outils de la scène du Donjon (au-dessus de la carte) : Portes, Mobilier et Créatures (ouvrent le catalogue de vignettes),
 * « + Ajouter » (écran étroit : le même catalogue, en tiroir), l'état de la pose, « + Salle », « Vue d'ensemble » et « Annuler ».
 * Les boutons existent dans donjon.html (`#barre-donjon`) : leurs écouteurs sont ceux de vue-carte.js, salles-liste.js, vue-plan.js
 * et main-mj.js ; ce module range le bloc dans `coquille.barreOutils` et ajoute les trois outils de catalogue (js/rail.js, `OUTILS`).
 *
 *   const barre = creerBarreSalle(coquille, ctx);   // ctx : celui de main-mj.js (`carte`, `plan`, `etat`)
 *   barre.montrer(vrai | faux)     le bloc n'a de sens que dans le Donjon (le Monde y met ses propres outils)
 *   barre.focusCatalogue()         rend le focus à l'outil de catalogue ouvert (Échap ferme le catalogue)
 *
 * Ordinateur : un outil ouvre le catalogue dans une colonne à gauche de la carte (re-cliquer le ferme). Sous 760 px : seul « + Ajouter »
 * reste, il ouvre le tiroir du bas (CSS). L'état « ouvert » est celui de `ctx.carte.tiroirOuvert()` : un seul mécanisme pour les deux.
 */
import { $, h } from '../dom.js';
import { OUTILS } from '../rail.js';

const SVG = 'http://www.w3.org/2000/svg';
/** Une icône de la table des outils (dessin statique de js/rail.js, jamais un texte venu d'un fichier). */
function iconeOutil(trace) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icone');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = trace;
  return svg;
}

export function creerBarreSalle(coquille, ctx) {
  const barre = $('barre-donjon');
  const groupe = $('barre-catalogue');
  const boutons = new Map();
  let dernier = OUTILS[0].id; // le dernier outil de catalogue choisi : il reprend le focus quand le catalogue se ferme

  for (const o of OUTILS) {
    const b = h('button', { type: 'button', className: 'btn btn-discret outil-catalogue', title: o.aide, 'aria-pressed': 'false', 'data-outil': o.id },
      iconeOutil(o.trace), h('span', { className: 'libelle', textContent: o.titre }));
    b.addEventListener('click', () => basculer(o.id));
    groupe.insertBefore(b, $('ajouter'));
    boutons.set(o.id, b);
  }

  /** Ouvre le catalogue sur ce groupe ; un second clic sur l'outil du groupe ouvert le referme. */
  function basculer(id) {
    const { palette } = ctx.carte;
    dernier = id;
    if (ctx.carte.tiroirOuvert() && palette.groupe() === id) { ctx.carte.ouvrirTiroir(false); majEtat(); return; }
    palette.afficherGroupe(id);
    ctx.carte.ouvrirTiroir(true);
    majEtat();
  }

  function majEtat() {
    const ouvert = ctx.carte.tiroirOuvert();
    const groupeOuvert = ctx.carte.palette.groupe();
    for (const [id, b] of boutons) b.setAttribute('aria-pressed', String(ouvert && id === groupeOuvert));
  }
  // Le catalogue peut se fermer d'ailleurs (Échap, un élément armé au doigt, la vue d'ensemble) : la classe du catalogue fait foi.
  new MutationObserver(majEtat).observe($('palette'), { attributes: true, attributeFilter: ['class'] });
  majEtat();

  coquille.barreOutils.append(barre);

  return {
    montrer: (oui) => { barre.hidden = !oui; },
    focusCatalogue: () => {
      const cible = boutons.get(dernier);
      (cible.offsetParent !== null ? cible : $('ajouter')).focus();
    },
  };
}
