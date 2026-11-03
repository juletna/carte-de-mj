/**
 * Liste unique des suites de tests, partagée par node tests/node.mjs et par tests.html.
 * Une nouvelle suite s'ajoute ici, et nulle part ailleurs.
 *
 * `lire(chemin)` rend le texte d'un fichier du site (relatif à la racine) : node.mjs le lit sur le disque,
 * tests.html par fetch. Les suites communes n'utilisent donc aucune API propre à Node ou au navigateur.
 */
import { executer as executerPhrases, executerAllerRetour } from './parseur.test.js';
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
import { executer as executerFicheHasard } from './fiche-hasard.test.js';
import { executer as executerCommandeTable } from './commande-table.test.js';
import { executer as executerNavigation } from './navigation.test.js';

/** Les suites, dans l'ordre d'exécution : chacune reçoit `{ lire }` et rend (ou promet) une liste de résultats. */
export const SUITES = [
  executerPhrases, executerAllerRetour, executerDonjon, executerPresentation, executerCommandes, executerImpression,
  executerPose, executerPlan, executerFormes, executerGenerateur, executerModeles, executerPersonnages,
  executerFicheHasard, executerCommandeTable, executerNavigation,
];

/** Joue toutes les suites ; renvoie les résultats { phrase, ecarts, resultat? } à la suite les uns des autres. */
export async function executerTout({ lire }) {
  const resultats = [];
  for (const suite of SUITES) resultats.push(...await suite({ lire }));
  return resultats;
}
