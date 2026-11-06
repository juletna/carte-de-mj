/**
 * Un choix unique présenté en cartes cliquables (onglet « Générer une carte » : zoom, sous-type du plateau, style).
 * Chaque carte est un bouton à `aria-pressed` : vignette (l'image d'exemple assets/exemples-cartes/<cle>.webp si elle existe, sinon
 * la vignette de repli dessinée en SVG, js/bibliotheque/vignettes.js), nom, une ligne d'aide ; la carte choisie est cerclée d'or.
 * Sans `cle`, la carte est un simple encart de texte (sous-types du plateau).
 */
import { h } from '../dom.js';
import { svgVignette, urlExemple } from './vignettes.js';

/** La vignette d'une clé : l'image d'exemple, remplacée par le SVG de repli si elle est absente ou illisible. */
export function vignette(cle) {
  const boite = h('span', { className: 'bib-carte-img', 'aria-hidden': 'true' });
  const repli = () => { boite.innerHTML = svgVignette(cle) ?? ''; }; // SVG écrit dans vignettes.js : aucun texte de l'utilisateur
  const img = h('img', { src: urlExemple(cle), alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', repli);
  boite.append(img);
  return boite;
}

/**
 * `options` : [{ id, libelle, aide, cle? }]. Rend { element, valeur(), definir(id) } ; `surChoix(id)` est appelé à chaque clic sur une autre carte.
 */
export function groupeCartes({ legende, options, valeur, surChoix, classe = '' }) {
  let courant = valeur;
  const boutons = options.map((o) => {
    const b = h('button', { type: 'button', className: `bib-carte${o.cle ? '' : ' sans-image'}`, 'aria-pressed': String(o.id === courant), title: o.aide },
      ...(o.cle ? [vignette(o.cle)] : []),
      h('span', { className: 'bib-carte-nom', textContent: o.libelle }),
      h('span', { className: 'bib-carte-aide', textContent: o.aide }));
    b.dataset.id = o.id;
    b.addEventListener('click', () => { if (courant === o.id) return; definir(o.id); surChoix?.(o.id); });
    return b;
  });
  function definir(id) {
    courant = id;
    for (const b of boutons) b.setAttribute('aria-pressed', String(b.dataset.id === id));
  }
  const element = h('div', { className: `bib-cartes ${classe}`.trim(), role: 'group', 'aria-label': legende }, ...boutons);
  return { element, valeur: () => courant, definir };
}
