/**
 * Tests des adresses de l'atelier (js/atelier-route.js, pur) et de leur compatibilité avec les anciennes (js/univers-vue.js, navigation-donnees.js).
 */
import { lireRoute, ecrireRoute, memeRoute, routeDe } from '../js/atelier-route.js';
import { analyserHash, hashMonde } from '../js/univers-vue.js';
import { pageCourante } from '../js/navigation-donnees.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const TESTS = [
  ['les cinq adresses se lisent', () => {
    egal(lireRoute('#monde'), { page: 'monde' }, '#monde');
    egal(lireRoute('#monde=u-1'), { page: 'monde', monde: 'u-1' }, '#monde=id');
    egal(lireRoute('#monde=u-1&lieu=l-2'), { page: 'monde', monde: 'u-1', lieu: 'l-2' }, 'monde + lieu');
    egal(lireRoute('#donjon=d-1'), { page: 'donjon', donjon: 'd-1' }, '#donjon=id');
    egal(lireRoute('#donjon=d-1&salle=s-3'), { page: 'donjon', donjon: 'd-1', salle: 's-3' }, 'donjon + salle');
    egal(lireRoute(''), { page: 'donjon' }, 'sans hash : le donjon actif');
  }],
  ['aller-retour, identifiants à caractères spéciaux compris', () => {
    for (const r of [{ page: 'monde' }, { page: 'monde', monde: 'u 1' }, { page: 'monde', monde: 'a&b', lieu: 'c=d' }, { page: 'donjon', donjon: 'é/1', salle: 'x y' }, { page: 'donjon' }]) {
      egal(lireRoute(ecrireRoute(r)), r, `aller-retour ${JSON.stringify(r)}`);
    }
    egal(ecrireRoute({ page: 'donjon' }), '', 'adresse nue');
    egal(ecrireRoute({ page: 'monde', lieu: 'l' }), '#monde', 'un lieu sans monde est ignoré');
    egal(ecrireRoute({ page: 'donjon', salle: 's' }), '', 'une salle sans donjon est ignorée');
  }],
  ['hash invalide : retombe sur le donjon actif sans erreur', () => {
    for (const h of ['#', '#autre', '#mondes', '#donjons', '#=', '#&&', '#salle=s1', '#lieu=l1', undefined, null, 42, '#monde=%E0%A4%A', '#donjon=%E0%A4%A&salle=s']) {
      const r = lireRoute(h);
      verifier(r && (r.page === 'monde' || r.page === 'donjon'), `route ${h}`);
    }
    egal(lireRoute('#autre'), { page: 'donjon' }, 'inconnu');
    egal(lireRoute('#monde=%E0%A4%A'), { page: 'monde' }, 'mal encodé : le monde sans id');
    egal(lireRoute('#donjon=%E0%A4%A&salle=s'), { page: 'donjon' }, 'une salle sans donjon lisible est ignorée');
    egal(lireRoute('#monde&lieu=l'), { page: 'monde' }, 'un lieu sans monde est ignoré');
    egal(lireRoute('#donjon=a&donjon=b'), { page: 'donjon', donjon: 'a' }, 'le premier gagne');
  }],
  ['rétrocompatibilité : #monde et #monde=<id> donnent les mêmes sorties qu’avant', () => {
    for (const [h, id] of [['#monde', null], ['#monde=u-12', 'u-12'], ['#monde=a%20b', 'a b']]) {
      egal(analyserHash(h), { id }, `analyserHash ${h}`);
      egal(lireRoute(h).monde ?? null, id, `lireRoute ${h}`);
    }
    egal(hashMonde('u-1'), ecrireRoute({ page: 'monde', monde: 'u-1' }), 'hashMonde = ecrireRoute');
    egal(hashMonde(null), ecrireRoute({ page: 'monde' }), 'sans id');
  }],
  ['barre de navigation : #monde… marquent Préparer, quel que soit le hash', () => {
    egal(pageCourante('/donjon.html', '#monde'), 'preparer', '#monde');
    egal(pageCourante('/donjon.html', '#monde=u-1&lieu=l-2'), 'preparer', 'monde + lieu');
    egal(pageCourante('/donjon.html', '#donjon=d-1&salle=s'), 'preparer', 'donjon + salle');
    egal(pageCourante('/donjon.html', ''), 'preparer', 'sans hash');
    egal(pageCourante('/donjon.html', '#mondes'), 'preparer', 'préfixe trompeur');
  }],
  ['route d’une position', () => {
    egal(routeDe({ monde: 'u', lieu: 'l' }), { page: 'monde', monde: 'u', lieu: 'l' }, 'lieu');
    egal(routeDe({ monde: 'u', lieu: 'l', donjon: 'd', salle: 's' }), { page: 'donjon', donjon: 'd', salle: 's' }, 'salle : la page donjon');
    egal(routeDe({}), { page: 'donjon' }, 'rien');
    verifier(memeRoute({ page: 'monde', monde: 'u' }, lireRoute('#monde=u')), 'même route');
  }],
];

export async function executer() {
  return executerSuite('atelier (route) : ', TESTS);
}
