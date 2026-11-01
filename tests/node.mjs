// Lance les tests du parseur sans navigateur : node tests/node.mjs
import { executer, executerAllerRetour } from './parseur.test.js';

const resultats = [...executer(), ...executerAllerRetour()];
let echecs = 0;
for (const r of resultats) {
  const ok = r.ecarts.length === 0;
  if (!ok) echecs++;
  console.log(`${ok ? '✔' : '✘'} ${r.phrase}`);
  for (const e of r.ecarts) console.log(`    ${e}`);
}
console.log(`\n${resultats.length - echecs}/${resultats.length} réussis`);
process.exit(echecs ? 1 : 0);
