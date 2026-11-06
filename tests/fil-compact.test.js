/** Tests du fil d'Ariane compact de la régie (js/atelier/fil-compact.js, fonction pure `filCompact`). */
import { filCompact } from '../js/atelier/fil-compact.js';
import { egal, executerSuite } from './mini-test.js';

const lieux = (...noms) => noms.map((nom, index) => ({ nom, index }));

const TESTS = [
  ['trois lieux ou plus : le premier, le dernier, et le milieu derrière « … »', () => {
    const f = filCompact(lieux('Continent', 'Forêt', 'Clairière', 'Port', 'Taverne'));
    egal(f.premier.nom, 'Continent', 'premier');
    egal(f.dernier.nom, 'Taverne', 'dernier : l’endroit où l’on est');
    egal(f.caches.map((c) => c.nom), ['Forêt', 'Clairière', 'Port'], 'milieu');
    egal(f.caches.map((c) => c.index), [1, 2, 3], 'les indices du chemin suivent');
    egal(filCompact(lieux('A', 'B', 'C')).caches.map((c) => c.nom), ['B'], 'trois : un seul caché');
  }],
  ['deux lieux ou moins : rien n’est caché', () => {
    egal(filCompact(lieux('A', 'B')).caches, [], 'deux lieux');
    egal(filCompact(lieux('A', 'B')).premier.nom, 'A', 'le premier reste');
    egal(filCompact(lieux('A')), { premier: null, caches: [], dernier: { nom: 'A', index: 0 } }, 'un seul lieu : seulement le dernier');
    egal(filCompact([]), { premier: null, caches: [], dernier: null }, 'vide');
  }],
];

export async function executer() {
  return executerSuite('fil d’Ariane compact : ', TESTS);
}
