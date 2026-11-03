/**
 * Découpage de presentation.js : la façade réexporte partie.js, passage.js et vue-publique.js sans en perdre ni en doubler un nom,
 * et vue-publique.js (ce que voient la table et l'impression) n'embarque pas le parseur.
 * Les fichiers sont lus par `lire(chemin)` (disque sous Node, fetch dans tests.html).
 */
import * as facade from '../js/presentation.js';
import * as partie from '../js/partie.js';
import * as passage from '../js/passage.js';
import * as vue from '../js/vue-publique.js';
import { verifier, egal, executerSuite } from './mini-test.js';

/** Chemin normalisé d'un import relatif (« ./x.js » ou « ../x.js ») depuis un module du site. */
function resoudre(depuis, cible) {
  const morceaux = depuis.split('/').slice(0, -1);
  for (const m of cible.split('/')) {
    if (m === '..') morceaux.pop();
    else if (m !== '.') morceaux.push(m);
  }
  return morceaux.join('/');
}

/** Tous les modules que `racine` charge, de proche en proche. */
async function fermeture(racine, lire) {
  const vus = new Set();
  const aVoir = [racine];
  while (aVoir.length) {
    const chemin = aVoir.pop();
    if (vus.has(chemin)) continue;
    vus.add(chemin);
    const source = await lire(chemin);
    for (const m of source.matchAll(/(?:import|export)\s*(?:[^'"]*?from\s*)?['"](\.[^'"]+)['"]/g)) aVoir.push(resoudre(chemin, m[1]));
  }
  return vus;
}

export async function executer({ lire }) {
  const chargés = [...await fermeture('js/vue-publique.js', lire)];
  const TESTS = [
    ['la façade presentation.js réexporte les trois modules, sans perdre ni doubler un nom', () => {
      const modules = { partie, passage, 'vue-publique': vue };
      const vus = new Map();
      for (const [nom, m] of Object.entries(modules)) {
        for (const cle of Object.keys(m)) {
          verifier(!vus.has(cle), `« ${cle} » est exporté par ${vus.get(cle)} et par ${nom}`);
          vus.set(cle, nom);
        }
      }
      for (const cle of vus.keys()) verifier(cle in facade, `la façade ne réexporte pas « ${cle} »`);
      egal(Object.keys(facade).filter((c) => !vus.has(c)), ['ETATS'], 'la façade ne définit rien elle-même (hors ETATS, venu du schéma)');
    }],
    ['vue-publique.js ne charge pas le parseur de phrases : l’impression et la table n’en ont pas besoin', () => {
      const parseur = chargés.filter((c) => ['js/parseur/index.js', 'js/parseur/decrire.js', 'js/parseur/commandes.js'].includes(c));
      egal(parseur, [], 'modules du parseur chargés par vue-publique.js');
      verifier(!chargés.includes('js/partie.js') && !chargés.includes('js/passage.js'), 'vue-publique.js ne dépend ni de partie.js ni de passage.js');
    }],
  ];
  return executerSuite('découpage de la présentation : ', TESTS);
}
