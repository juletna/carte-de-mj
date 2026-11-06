/**
 * Tests de la table des outils de la barre d'outils du Donjon (js/rail.js : Portes, Mobilier, Créatures) et de l'accord entre
 * donjon.html et les modules qui le lisent : tout `$('identifiant')` cité par le tronc (main-mj.js), les modules de js/mj/ et ceux de
 * l'atelier existe dans la page (un bloc déplacé ou retiré de donjon.html sans son code se voit ici, pas au navigateur).
 * Le reste de l'ancien rail (état mémorisé) est testé dans pose.test.js. Les fichiers sont lus par `lire(chemin)` (disque sous Node, fetch dans tests.html).
 */
import { OUTILS, OUTILS_CATALOGUE, TITRES_OUTILS } from '../js/rail.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const MODULES = [
  'js/main-mj.js', 'js/atelier/barre-salle.js', 'js/atelier/catalogue-onglet.js', 'js/atelier/inspecteurs-donjon.js', 'js/atelier/inscrire-donjon.js',
  'js/mj/bulle.js', 'js/mj/menu-donjon.js', 'js/mj/personnages-ui.js', 'js/mj/salle-forme.js', 'js/mj/salles-liste.js', 'js/mj/vue-carte.js',
  'js/mj/vue-plan.js', 'js/mj/zoom.js',
];

export async function executer({ lire }) {
  const html = await lire('donjon.html');
  const ids = OUTILS.map((o) => o.id);
  const idsPage = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const sources = {};
  for (const m of MODULES) sources[m] = await lire(m);

  const TESTS = [
    ['les titres et le catalogue dérivent de la table des outils', () => {
      egal(Object.keys(TITRES_OUTILS), ids, 'un titre par outil, dans l’ordre');
      verifier(OUTILS.every((o) => o.titre && o.aide && o.trace), 'chaque outil a un titre, une infobulle et une icône');
      egal(OUTILS_CATALOGUE, ['portes', 'mobilier', 'creatures'], 'les outils du catalogue de vignettes');
      verifier(new Set(ids).size === ids.length, 'identifiants uniques');
    }],
    ['donjon.html : plus de rail ni de panneau, un catalogue, la barre d’outils et les blocs de l’inspecteur', () => {
      verifier(!/data-outil=|data-pour=|id="rail"|id="panneau"|id="selection"|id="menu-donjon"/.test(html), 'aucun reste de l’ancien rail, du panneau, de la bulle ou du menu');
      for (const id of ['palette', 'barre-donjon', 'barre-catalogue', 'reserve', 'feuille-donjons', 'cadre-scene', 'scene', 'carte', 'arbre-bouton']) verifier(idsPage.has(id), `#${id} est dans la page`);
      for (const id of ['bloc-salle-nom', 'bloc-description', 'bloc-orphelines', 'bloc-notes', 'bloc-taille', 'bloc-apparence', 'bloc-exemples', 'bloc-avance', 'bloc-donjon-nom', 'bloc-plan', 'bloc-personnages', 'bloc-reglages']) verifier(idsPage.has(id), `le bloc #${id} est dans la page`);
    }],
    ['les identifiants de la page sont uniques', () => {
      const tous = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
      egal(tous.filter((id, i) => tous.indexOf(id) !== i), [], 'identifiants en double');
    }],
    ['chaque $(\'identifiant\') cité par le tronc et les modules du Donjon existe dans donjon.html', () => {
      const manques = [];
      for (const [fichier, source] of Object.entries(sources)) {
        for (const m of source.matchAll(/\$\('([a-z0-9-]+)'\)/g)) if (!idsPage.has(m[1])) manques.push(`${fichier} : #${m[1]}`);
      }
      egal([...new Set(manques)], [], 'identifiants cités mais absents de la page');
    }],
  ];
  return executerSuite('rail : ', TESTS);
}
