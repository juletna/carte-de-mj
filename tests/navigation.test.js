/**
 * Barre de navigation commune : les liens et la page courante viennent de js/navigation-donnees.js (pur) ;
 * chaque page HTML y déclare un emplacement `[data-navigation]` (rempli par js/navigation.js) et charge ce script.
 * Les pages sont lues par `lire(chemin)` (disque sous Node, fetch dans tests.html).
 */
import { verifier, egal, executerSuite } from './mini-test.js';
import { LIENS, LIEN_FICHE, pageCourante, hrefPreparer, CLE_DERNIERE_ROUTE } from '../js/navigation-donnees.js';

const PAGES = ['index.html', 'fiche.html', 'donjon.html', 'presentation.html', 'impression.html', 'bibliotheque.html'];

export async function executer({ lire }) {
  const html = {};
  for (const page of PAGES) html[page] = await lire(page);
  const TESTS = [
    ['la barre : Préparer, Jouer, Bibliothèque, puis Fiche joueur à droite', () => {
      egal(LIENS.map((l) => l.texte), ['Préparer', 'Jouer', 'Bibliothèque']);
      egal(LIENS.map((l) => l.href), ['donjon.html', 'presentation.html', 'bibliotheque.html']);
      egal(LIEN_FICHE.href, 'fiche.html');
    }],
    ['chaque page a un emplacement de barre et charge js/navigation.js', () => {
      for (const page of PAGES) {
        verifier(/data-navigation/.test(html[page]), `${page} : pas d'emplacement [data-navigation]`);
        verifier(html[page].includes('src="js/navigation.js"'), `${page} : js/navigation.js n'est pas chargé`);
        verifier(!/<a class="menu-lien"/.test(html[page]), `${page} : liens de menu écrits à la main (ils viennent de navigation.js)`);
      }
    }],
    ['la page courante : une seule par page, Préparer quel que soit le hash', () => {
      egal(pageCourante('/index.html'), 'accueil');
      egal(pageCourante('/'), 'accueil');
      egal(pageCourante('/fiche.html'), 'fiche');
      egal(pageCourante('/donjon.html', ''), 'preparer');
      egal(pageCourante('/donjon.html', '#monde'), 'preparer');
      egal(pageCourante('/donjon.html', '#donjon=d&salle=s'), 'preparer');
      egal(pageCourante('/donjon.html', '#mondes-perdus'), 'preparer');
      egal(pageCourante('/x/presentation.html', '?donjon=a'), 'jouer');
      egal(pageCourante('/bibliotheque.html'), 'bibliotheque');
      egal(pageCourante('/impression.html'), 'preparer');
      egal(pageCourante('/autre.html'), null);
    }],
    ['« Préparer » : le dernier élément ouvert, sinon le premier monde, sinon le donjon actif', () => {
      const stock = (d) => (cle) => d[cle] ?? null;
      egal(hrefPreparer(stock({ [CLE_DERNIERE_ROUTE]: '#donjon=d-1&salle=s-2' })), 'donjon.html#donjon=d-1&salle=s-2', 'donjon + salle');
      egal(hrefPreparer(stock({ [CLE_DERNIERE_ROUTE]: '#monde=u-1&lieu=l-2' })), 'donjon.html#monde=u-1&lieu=l-2', 'monde + lieu');
      const univers = JSON.stringify({ actif: 'u-2', univers: { 'u-1': {}, 'u-2': {} } });
      egal(hrefPreparer(stock({ 'carte-de-mj:univers-v1': univers })), 'donjon.html#monde=u-2', 'sans historique : le monde actif');
      egal(hrefPreparer(stock({ 'carte-de-mj:univers-v1': JSON.stringify({ actif: 'x', univers: { 'u-1': {} } }) })), 'donjon.html#monde=u-1', 'monde actif inconnu : le premier');
      egal(hrefPreparer(stock({})), 'donjon.html', 'rien : le donjon actif');
      egal(hrefPreparer(stock({ [CLE_DERNIERE_ROUTE]: '#<script>', 'carte-de-mj:univers-v1': '{abîmé' })), 'donjon.html', 'données abîmées');
      egal(hrefPreparer(() => { throw new Error('stockage'); }), 'donjon.html', 'stockage indisponible');
    }],
    ['le titre de donjon.html est « Préparer · Carte de MJ »', () => verifier(/<title>Préparer · Carte de MJ<\/title>/.test(html['donjon.html']), 'titre de donjon.html')],
    ['le titre de chaque page porte le nom du site et le mot « Jouer » remplace « Présentation »', () => {
      for (const page of PAGES) verifier(/<title>[^<]*Carte de MJ<\/title>/.test(html[page]), `${page} : titre`);
      verifier(/<title>Jouer · Carte de MJ<\/title>/.test(html['presentation.html']), 'titre de presentation.html');
    }],
  ];
  return executerSuite('navigation : ', TESTS);
}
