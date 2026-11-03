/**
 * Tests de la table des outils du rail (js/rail.js) : les titres et le catalogue en dérivent, et la page donjon.html (boutons
 * `data-outil`, blocs `data-pour`) reste d'accord avec elle. Le reste du rail (état mémorisé) est testé dans pose.test.js.
 * Les pages sont lues par `lire(chemin)` (disque sous Node, fetch dans tests.html).
 */
import { OUTILS, OUTILS_CATALOGUE, TITRES_OUTILS } from '../js/rail.js';
import { verifier, egal, executerSuite } from './mini-test.js';

export async function executer({ lire }) {
  const html = await lire('donjon.html');
  const ids = OUTILS.map((o) => o.id);
  const boutons = [...html.matchAll(/<button\b[^>]*\bdata-outil="([^"]+)"/g)].map((m) => m[1]);
  const blocs = [...html.matchAll(/\bdata-pour="([^"]+)"/g)].map((m) => m[1].split(/\s+/));

  const TESTS = [
    ['les titres et le catalogue dérivent de la table des outils', () => {
      egal(Object.keys(TITRES_OUTILS), ids, 'un titre par outil, dans l’ordre');
      verifier(ids.every((id) => TITRES_OUTILS[id]), 'chaque outil a un titre');
      egal(OUTILS_CATALOGUE, ['portes', 'mobilier', 'creatures'], 'les outils du catalogue de vignettes');
      verifier(new Set(ids).size === ids.length, 'identifiants uniques');
    }],
    ['donjon.html a un bouton par outil, dans l’ordre de la table', () => {
      egal(boutons, ids, 'boutons data-outil de la page');
    }],
    ['les blocs du panneau ne citent que des outils connus, et chaque outil a son bloc', () => {
      const cites = blocs.flat();
      egal(cites.filter((id) => !ids.includes(id)), [], 'outils inconnus dans data-pour');
      egal(ids.filter((id) => !cites.includes(id)), [], 'outils sans bloc dans le panneau');
    }],
    ['le bloc du catalogue est celui des outils de catalogue', () => {
      const bloc = blocs.find((b) => b.some((id) => OUTILS_CATALOGUE.includes(id)));
      egal(bloc, OUTILS_CATALOGUE, 'data-pour du catalogue');
    }],
  ];
  return executerSuite('rail : ', TESTS);
}
