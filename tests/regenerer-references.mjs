// Réécrit tests/references.js : node tests/regenerer-references.mjs
// À lancer seulement après un changement VOULU du rendu ou de la disposition (voir tests/references.test.js).
import { writeFile } from 'node:fs/promises';
import { calculerReferences } from './references-calcul.js';

globalThis.window ??= { devicePixelRatio: 1 };

const references = calculerReferences();
/** Un cas par ligne : le diff d'un commit montre d'un coup d'œil quels cas ont bougé. */
const ecrire = (famille) => `{\n${Object.entries(famille).map(([nom, cas]) => `    ${JSON.stringify(nom)}: ${JSON.stringify(cas).replace(/([,:])/g, '$1 ')}`).join(',\n')},\n  }`;
const source = `/**
 * Empreintes de référence de la disposition du plan et du rendu (voir tests/references.test.js).
 * FICHIER GÉNÉRÉ par node tests/regenerer-references.mjs : ne pas le modifier à la main.
 */
export const REFERENCES = {\n  disposition: ${ecrire(references.disposition)},\n  rendu: ${ecrire(references.rendu)},\n};
`;
await writeFile(new URL('./references.js', import.meta.url), source);
const nombre = (f) => Object.keys(references[f]).length;
console.log(`tests/references.js réécrit : ${nombre('disposition')} dispositions, ${nombre('rendu')} rendus`);
