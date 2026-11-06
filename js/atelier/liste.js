/**
 * Une liste de panneau (docs/design-panneaux.md, « Liste ») : des rangées de même hauteur dans un bloc en creux.
 * Rangée : icône · nom · position (case D4, à droite) ; une sous-ligne facultative, tronquée. La rangée choisie prend le fond doré léger.
 *
 *   creerListe([ { nom, vide?, icone?, position?, detail?, choisie?, titre?, alerte?, compacte?, surChoix } ])  → <ul class="p-liste">
 *
 * `nom` vide : `vide` (« Point sans nom ») en italique discret. `detail` : un texte, ou un tableau de morceaux dont les objets
 * { fort: texte } sont mis en valeur (« vers <b>Repaire gobelin</b> › Salle 1 »). Le DOM est fabriqué par `fabrique` : testable sous Node.
 */
import { h as hDom } from '../dom.js';
import { icone as iconeDom } from '../icones.js';

export function creerListe(rangees, { fabrique = hDom, icone = iconeDom } = {}) {
  const h = fabrique;
  const rangee = (r) => {
    const nom = r.nom?.trim();
    const morceaux = r.detail == null ? [] : (Array.isArray(r.detail) ? r.detail : [r.detail]);
    const b = h('button', { type: 'button', className: `p-rang${r.choisie ? ' choisie' : ''}${r.compacte ? ' compacte' : ''}${r.alerte ? ' alerte' : ''}` },
      h('span', { className: 'p-rang-icone' }, ...(r.icone ? [icone(r.icone)] : [])),
      h('span', { className: `p-rang-nom${nom ? '' : ' vide'}`, textContent: nom || r.vide || '' }),
      h('span', { className: 'p-rang-position', textContent: r.position ?? '' }),
      ...(morceaux.length ? [h('span', { className: 'p-rang-detail' },
        ...morceaux.map((m) => (typeof m === 'object' ? h('b', { textContent: m.fort }) : m)))] : []));
    if (r.choisie) b.setAttribute('aria-current', 'true');
    if (r.titre) b.title = r.titre;
    if (r.surChoix) b.addEventListener('click', () => r.surChoix());
    return h('li', {}, b);
  };
  return h('ul', { className: 'p-liste' }, ...rangees.map(rangee));
}
