// Lance les tests du parseur sans navigateur : node tests/node.mjs
import { executer, executerAllerRetour } from './parseur.test.js';
import { executer as executerDonjon } from './donjon.test.js';
import { executer as executerPresentation } from './presentation.test.js';
import { executer as executerCommandes } from './commandes.test.js';
import { executer as executerImpression } from './impression.test.js';
import { executer as executerPose } from './pose.test.js';
import { executer as executerPlan } from './plan-donjon.test.js';
import { executer as executerFormes } from './formes.test.js';
import { executer as executerGenerateur } from './generateur.test.js';
import { executer as executerModeles } from './modeles.test.js';
import { executer as executerPersonnages } from './personnages.test.js';

const resultats = [...executer(), ...executerAllerRetour(), ...executerDonjon(), ...executerPresentation(), ...executerCommandes(), ...executerImpression(), ...executerPose(), ...executerPlan(), ...executerFormes(), ...executerGenerateur(), ...executerModeles(), ...executerPersonnages()];
let echecs = 0;
for (const r of resultats) {
  const ok = r.ecarts.length === 0;
  if (!ok) echecs++;
  console.log(`${ok ? '✔' : '✘'} ${r.phrase}`);
  for (const e of r.ecarts) console.log(`    ${e}`);
}
console.log(`\n${resultats.length - echecs}/${resultats.length} réussis`);
process.exit(echecs ? 1 : 0);
