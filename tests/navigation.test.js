/**
 * Barre de navigation commune : les liens et la page courante viennent de js/navigation-donnees.js (pur) ;
 * chaque page HTML y déclare un emplacement `[data-navigation]` (rempli par js/navigation.js) et charge ce script.
 * Les pages sont lues par `lire(chemin)` (disque sous Node, fetch dans tests.html).
 */
import { verifier, egal, executerSuite } from './mini-test.js';
import { LIENS, LIEN_FICHE, pageCourante } from '../js/navigation-donnees.js';

const PAGES = ['index.html', 'fiche.html', 'donjon.html', 'presentation.html', 'impression.html', 'bibliotheque.html'];

export async function executer({ lire }) {
  const html = {};
  for (const page of PAGES) html[page] = await lire(page);
  const TESTS = [
    ['la barre : Monde, Donjons, Jouer, Bibliothèque, puis Fiche joueur à droite', () => {
      egal(LIENS.map((l) => l.texte), ['Monde', 'Donjons', 'Jouer', 'Bibliothèque']);
      egal(LIENS.map((l) => l.href), ['donjon.html#monde', 'donjon.html', 'presentation.html', 'bibliotheque.html']);
      egal(LIEN_FICHE.href, 'fiche.html');
    }],
    ['chaque page a un emplacement de barre et charge js/navigation.js', () => {
      for (const page of PAGES) {
        verifier(/data-navigation/.test(html[page]), `${page} : pas d'emplacement [data-navigation]`);
        verifier(html[page].includes('src="js/navigation.js"'), `${page} : js/navigation.js n'est pas chargé`);
        verifier(!/<a class="menu-lien"/.test(html[page]), `${page} : liens de menu écrits à la main (ils viennent de navigation.js)`);
      }
    }],
    ['la page courante : une seule par page, Monde seulement avec #monde', () => {
      egal(pageCourante('/index.html'), 'accueil');
      egal(pageCourante('/'), 'accueil');
      egal(pageCourante('/fiche.html'), 'fiche');
      egal(pageCourante('/donjon.html', ''), 'donjons');
      egal(pageCourante('/donjon.html', '#monde'), 'monde');
      egal(pageCourante('/donjon.html', '#mondes-perdus'), 'donjons');
      egal(pageCourante('/x/presentation.html', '?donjon=a'), 'jouer');
      egal(pageCourante('/bibliotheque.html'), 'bibliotheque');
      egal(pageCourante('/impression.html'), 'donjons');
      egal(pageCourante('/autre.html'), null);
    }],
    ['le titre de chaque page porte le nom du site et le mot « Jouer » remplace « Présentation »', () => {
      for (const page of PAGES) verifier(/<title>[^<]*Carte de MJ<\/title>/.test(html[page]), `${page} : titre`);
      verifier(/<title>Jouer · Carte de MJ<\/title>/.test(html['presentation.html']), 'titre de presentation.html');
    }],
  ];
  return executerSuite('navigation : ', TESTS);
}
