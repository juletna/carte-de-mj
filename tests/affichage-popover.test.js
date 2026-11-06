/** Tests de la préférence d'affichage commune : grille, thème, détails, relief, pénombre, flammes, repères (js/atelier/affichage-popover.js, fonctions pures). */
import { appliquerCases, casesApresBascule, appliquerRendu } from '../js/atelier/affichage-popover.js';
import { casesDeReglages, themeDeReglages, detailsDeReglages, reliefDeReglages, penombreDeReglages, flammesDeReglages } from '../js/affichage.js';
import { egal, executerSuite } from './mini-test.js';

const TESTS = [
  ['appliquerCases borne, arrondit et garde le booléen d’avant', () => {
    const r = {};
    egal(appliquerCases(r, 140), 100, 'borné haut'); egal(r.grille, true, 'grille vraie');
    egal(appliquerCases(r, -3), 0, 'borné bas'); egal(r.grille, false, 'grille fausse'); egal(casesDeReglages(r), 0, 'lue');
    egal(appliquerCases(r, '35.4'), 35, 'texte du curseur');
  }],
  ['la bascule masque puis rend la dernière opacité visible', () => {
    egal(casesApresBascule({ cases: 40 }, 40), 0, 'visible → masquée');
    egal(casesApresBascule({ cases: 0 }, 40), 40, 'masquée → dernière');
    egal(casesApresBascule({ cases: 0 }, 0), 60, 'sans mémoire : défaut');
    egal(casesApresBascule({}, 0), 0, 'défaut visible → masquée');
  }],
  ['Masquer puis Afficher rend la dernière opacité, même après un rechargement (champ facultatif casesAvant)', () => {
    const r = { cases: 35, grille: true };
    appliquerCases(r, 0);
    egal(r.casesAvant, 35, 'l’opacité visible est gardée pendant le masquage');
    // Un rechargement : seul le contenu des réglages survit, pas la mémoire du contrôle.
    egal(casesApresBascule({ ...r }, 0), 35, 'Afficher rend 35 % et non 60 %');
    appliquerCases(r, 35);
    egal('casesAvant' in r, false, 'effacé dès que les lignes se voient');
    const d = { cases: 60 };
    appliquerCases(d, 0);
    egal('casesAvant' in d, false, 'rien d’écrit quand l’opacité est celle par défaut');
    egal(casesApresBascule(d, 0), 60, 'et Afficher rend 60 %');
    const c = { cases: 80 };
    appliquerCases(c, 0); appliquerCases(c, 0);
    egal(c.casesAvant, 80, 'masquer deux fois ne perd pas la valeur');
    const n = { cases: 0, casesAvant: 25 };
    appliquerCases(n, 40);
    egal([n.cases, 'casesAvant' in n], [40, false], 'le curseur depuis « masquée » efface la mémoire');
  }],
  ['appliquerRendu écrit les champs de reglages-v1 sans clé nouvelle et efface les valeurs par défaut', () => {
    const r = {};
    egal(appliquerRendu(r, 'theme', 'vectoriel'), 'vectoriel', 'thème retenu'); egal(themeDeReglages(r), 'vectoriel', 'relu');
    appliquerRendu(r, 'theme', 'peint'); egal('theme' in r, false, 'thème par défaut : effacé');
    egal(appliquerRendu(r, 'theme', 'inconnu'), 'peint', 'thème illisible : inchangé'); egal('theme' in r, false, 'rien écrit');
    appliquerRendu(r, 'details', 'sobres'); egal(detailsDeReglages(r), 'sobres', 'détails sobres');
    appliquerRendu(r, 'details', 'riches'); egal('details' in r, false, 'détails par défaut : effacés');
    appliquerRendu(r, 'relief', false); egal(reliefDeReglages(r), false, 'relief coupé');
    appliquerRendu(r, 'relief', true); egal('relief' in r, false, 'relief par défaut : effacé');
    appliquerRendu(r, 'flammes', false); egal(flammesDeReglages(r), false, 'flammes coupées');
    appliquerRendu(r, 'flammes', true); egal('flammes' in r, false, 'flammes par défaut : effacées');
    egal(appliquerRendu(r, 'penombre', '70.4'), 70, 'pénombre arrondie'); egal(penombreDeReglages(r), 70, 'relue');
    egal(appliquerRendu(r, 'penombre', 250), 100, 'bornée haut'); egal(appliquerRendu(r, 'penombre', -4), 0, 'bornée bas');
    appliquerRendu(r, 'penombre', 45); egal('penombre' in r, false, 'pénombre par défaut : effacée');
    appliquerRendu(r, 'reperes', false); egal(r.reperes, false, 'repères masqués');
    appliquerRendu(r, 'reperes', true); egal(r.reperes, true, 'repères affichés');
    let erreur = null; try { appliquerRendu(r, 'inconnu', 1); } catch (e) { erreur = e.message; }
    egal(typeof erreur, 'string', 'un champ inconnu est refusé');
  }],
];

export async function executer() {
  return executerSuite('affichage (préférence commune) : ', TESTS);
}
