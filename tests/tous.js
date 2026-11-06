/**
 * Liste unique des suites de tests, partagée par node tests/node.mjs et par tests.html.
 * Une nouvelle suite s'ajoute ici, et nulle part ailleurs.
 *
 * `lire(chemin)` rend le texte d'un fichier du site (relatif à la racine) : node.mjs le lit sur le disque,
 * tests.html par fetch. Les suites communes n'utilisent donc aucune API propre à Node ou au navigateur.
 */
import { executer as executerPhrases, executerAllerRetour } from './parseur.test.js';
import { executer as executerDonjon } from './donjon.test.js';
import { executer as executerPartie } from './partie.test.js';
import { executer as executerPassage } from './passage.test.js';
import { executer as executerDeplacement } from './deplacement.test.js';
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
import { executer as executerThemes } from './themes.test.js';
import { executer as executerReferences } from './references.test.js';
import { executer as executerOutils } from './dom.test.js';
import { executer as executerMurs } from './murs.test.js';
import { executer as executerCoordonnees } from './coordonnees.test.js';
import { executer as executerSchema } from './schema.test.js';
import { executer as executerGeometrie } from './geometrie.test.js';
import { executer as executerAffichage } from './affichage.test.js';
import { executer as executerVisibilite } from './visibilite.test.js';
import { executer as executerParseurCommun } from './parseur-commun.test.js';
import { executer as executerMesuresImpression } from './mesures-impression.test.js';
import { executer as executerHistorique } from './historique.test.js';
import { executer as executerMiseEnPage } from './mise-en-page.test.js';
import { executer as executerRegie } from './regie.test.js';
import { executer as executerStockage } from './stockage.test.js';
import { executer as executerContratFiche } from './fiche-contrat.test.js';
import { executer as executerCatalogue } from './catalogue.test.js';
import { executer as executerVuePublique } from './vue-publique.test.js';
import { executer as executerProtocoleTable } from './protocole-table.test.js';
import { executer as executerFicheDes } from './fiche-des.test.js';
import { executer as executerFicheJeu } from './fiche-jeu.test.js';
import { executer as executerFicheBase } from './fiche-base.test.js';
import { executer as executerRail } from './rail.test.js';
import { executer as executerPeint } from './peint.test.js';

/** Les suites, dans l'ordre d'exécution : chacune reçoit `{ lire }` et rend (ou promet) une liste de résultats. */
export const SUITES = [
  executerPhrases, executerAllerRetour, executerDonjon, executerPartie, executerPassage, executerDeplacement, executerCommandes, executerImpression,
  executerPose, executerPlan, executerFormes, executerGenerateur, executerModeles, executerPersonnages,
  executerFicheHasard, executerCommandeTable, executerNavigation,
  executerThemes, executerReferences, executerOutils, executerMurs, executerCoordonnees, executerSchema,
  executerGeometrie, executerAffichage, executerVisibilite, executerParseurCommun, executerMesuresImpression,
  executerHistorique, executerMiseEnPage, executerRegie, executerStockage, executerContratFiche, executerCatalogue,
  executerVuePublique, executerProtocoleTable, executerFicheDes, executerFicheJeu, executerFicheBase, executerRail, executerPeint,
];

/** Joue toutes les suites ; renvoie les résultats { phrase, ecarts, resultat? } à la suite les uns des autres. */
export async function executerTout({ lire }) {
  const resultats = [];
  for (const suite of SUITES) resultats.push(...await suite({ lire }));
  return resultats;
}
