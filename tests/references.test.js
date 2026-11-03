/**
 * Références de non-régression : la disposition du plan du donjon (disposerPlan) et le dessin des moteurs de rendu
 * (journal d'appels d'un canvas simulé) sont comparés, cas par cas, à l'empreinte enregistrée dans tests/references.js.
 * Ces tests ne disent pas que le résultat est BON, seulement qu'il n'a pas BOUGÉ : c'est le filet des refactorisations.
 *
 * Un changement voulu (nouveau dessin, nouvelle disposition) fait échouer ces tests : relire ce qui a changé, puis
 *   node tests/regenerer-references.mjs
 * réécrit tests/references.js, et le diff du commit montre exactement quels cas ont bougé.
 */
import { verifier, executerSuite } from './mini-test.js';
import { calculerReferences } from './references-calcul.js';
import { REFERENCES } from './references.js';

const COMMENT = 'Si le changement est voulu : node tests/regenerer-references.mjs, puis relire le diff de tests/references.js.';
const FAMILLES = { disposition: 'disposition du plan', rendu: 'rendu' };

export function executer() {
  let obtenues = null, panne = null;
  try { obtenues = calculerReferences(); } catch (e) { panne = e; }
  const TESTS = [
    ['le calcul des références s’exécute sans erreur', () => { if (panne) throw panne; }],
    ['deux calculs successifs donnent les mêmes empreintes (les cas sont déterministes)', () => {
      if (panne) throw panne;
      const encore = calculerReferences();
      verifier(JSON.stringify(encore) === JSON.stringify(obtenues), 'le deuxième calcul diffère du premier : un cas dépend du hasard, de l’heure ou de l’écran');
    }],
  ];
  for (const [famille, titre] of Object.entries(FAMILLES)) {
    const noms = new Set([...Object.keys(REFERENCES[famille]), ...Object.keys(obtenues?.[famille] || {})]);
    for (const nom of noms) {
      TESTS.push([`${titre} · ${nom}`, () => {
        if (panne) throw panne;
        const attendu = REFERENCES[famille][nom], obtenu = obtenues[famille][nom];
        verifier(attendu, `cas absent de tests/references.js. ${COMMENT}`);
        verifier(obtenu, `cas enregistré mais plus calculé. ${COMMENT}`);
        const diff = Object.keys(attendu).filter((k) => attendu[k] !== obtenu[k]).map((k) => `${k} : ${attendu[k]} → ${obtenu[k]}`);
        verifier(!diff.length, `référence modifiée (${diff.join(' ; ')}). ${COMMENT}`);
      }]);
    }
  }
  return executerSuite('références : ', TESTS);
}
