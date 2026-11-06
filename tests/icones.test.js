/** Icônes SVG communes (js/icones.js) : chaque nom rend un SVG valide, les noms inconnus sont signalés. */
import { verifier, egal, executerSuite } from './mini-test.js';
import { ICONES, NOMS_ICONES, iconeHtml } from '../js/icones.js';

const REQUIS = ['monde', 'donjon', 'jouer', 'bibliotheque', 'fiche', 'sauvegarde', 'menu', 'plus', 'fermer', 'plus-d-actions', 'retour', 'remonter',
  'micro', 'de', 'oeil', 'oeil-barre', 'copier', 'plein-ecran', 'exporter', 'importer', 'supprimer', 'crayon', 'grille', 'point', 'recentrer', 'fleches', 'aide'];

export async function executer() {
  const TESTS = [
    ['toutes les icônes demandées existent', () => {
      for (const n of REQUIS) verifier(NOMS_ICONES.includes(n), `icône manquante : ${n}`);
    }],
    ['chaque icône rend un SVG valide : viewBox 24, currentColor, aria-hidden, balises équilibrées', () => {
      for (const nom of NOMS_ICONES) {
        const s = iconeHtml(nom);
        verifier(s.startsWith('<svg ') && s.endsWith('</svg>'), `${nom} : pas un SVG`);
        verifier(s.includes('viewBox="0 0 24 24"') && s.includes('stroke="currentColor"') && s.includes('aria-hidden="true"'), `${nom} : attributs`);
        verifier(!/#[0-9a-f]{3,6}|rgb\(/i.test(s), `${nom} : couleur en dur`);
        verifier(!/NaN|undefined/.test(s), `${nom} : valeur invalide`);
        const ouvrantes = (ICONES[nom].match(/<(?!\/)[a-z]+/g) || []).length;
        verifier(ouvrantes > 0 && (ICONES[nom].match(/\/>/g) || []).length === ouvrantes, `${nom} : balises non auto-fermées`);
      }
    }],
    ['un nom inconnu est signalé', () => {
      let message = '';
      try { iconeHtml('inexistante'); } catch (e) { message = e.message; }
      verifier(message.includes('inexistante'), 'aucune erreur pour un nom inconnu');
      egal(NOMS_ICONES.length, new Set(NOMS_ICONES).size);
    }],
  ];
  return executerSuite('icônes : ', TESTS);
}
