/**
 * Protocole entre la régie et la fenêtre de table : le canal, les types de messages, leur fabrication côté émetteur et leur
 * relecture côté récepteur. Module sans DOM ni stockage : il se teste sous Node (`ouvrirCanal` est la seule fonction qui touche
 * à l'environnement, et elle ne s'exécute pas à l'import).
 *
 * Régie → table :  `etat` (le plan de la salle courante, l'encart, la case montrée, l'affichage), `defiler`.
 * Table → régie :  `demande-etat`, `table-deplacer` (un pion glissé à la souris), `table-viser` (une case touchée).
 * Les messages « qui commande la table » (`regie-prise-main`, `regie-depart`, `regie-presente`) sont dans commande-table.js.
 *
 * SÉCURITÉ : le message `etat` ne porte que le résultat de `vueTable()` et de `miniPlanTable()` (vue-publique.js), la case
 * montrée et l'affichage ; rien d'autre ne part de la régie. À la réception, `lireEtat` relit tout champ par champ, avec les
 * mêmes règles que le reste de l'outil, et écarte ce qui serait marqué caché.
 */
import { validerAffichage } from './affichage.js';
import { recevoirVueTable, recevoirMiniPlan, recevoirCaseVisee } from './vue-publique.js';

/** Canal BroadcastChannel entre la régie et la fenêtre table. */
export const CANAL = 'carte-de-mj-presentation';

/** Le canal, ou null si le navigateur n'a pas BroadcastChannel. */
export const ouvrirCanal = () => { try { return new BroadcastChannel(CANAL); } catch { return null; } };

export const MESSAGES = {
  ETAT: 'etat',
  DEFILER: 'defiler',
  DEMANDE_ETAT: 'demande-etat',
  TABLE_DEPLACER: 'table-deplacer',
  TABLE_VISER: 'table-viser',
};

// --- Régie → table ----------------------------------------------------------------------------------------

/** Ce que la régie envoie à la table : exactement ces quatre champs, déjà filtrés (vueTable, miniPlanTable, caseATable, affichage). */
export const messageEtat = ({ plan, mini, caseVisee, affichage }) => ({ type: MESSAGES.ETAT, plan, mini, caseVisee, affichage });

/**
 * Côté table : relit un message `etat`. Chaque champ invalide reprend sa valeur sûre (`affichageActuel` pour l'affichage, rien pour
 * le reste) ; un plan ou un encart qui ne se relit pas n'est pas montré.
 * @returns {{plan:object|null, mini:object|null, caseVisee:{x:number,y:number}|null, affichage:object}}
 */
export function lireEtat(m, affichageActuel) {
  const affichage = validerAffichage(m.affichage, affichageActuel);
  const plan = m.plan ? recevoirVueTable(m.plan) : null;
  const mini = m.mini ? recevoirMiniPlan(m.mini) : null;
  return { plan, mini, caseVisee: recevoirCaseVisee(m.caseVisee, plan), affichage };
}

const entierSigne = (v) => (v === -1 || v === 0 || v === 1 ? v : 0);

/** Le MJ fait défiler la table d'une part de l'écran (-1, 0 ou 1 par axe), ou la recentre. */
export const messageDefiler = (dx, dy, recentrer) => ({ type: MESSAGES.DEFILER, dx, dy, recentrer });

/** Côté table : relit un message `defiler`. Tout ce qui n'est pas -1, 0 ou 1 vaut 0 ; `recentrer` n'est vrai que s'il l'est exactement. */
export const lireDefilement = (m) => ({ dx: entierSigne(m.dx), dy: entierSigne(m.dy), recentrer: m.recentrer === true });

// --- Table → régie ----------------------------------------------------------------------------------------

export const messageDemandeEtat = () => ({ type: MESSAGES.DEMANDE_ETAT });
export const messageDeplacer = (id, x, y) => ({ type: MESSAGES.TABLE_DEPLACER, id, x, y });
export const messageViser = (x, y) => ({ type: MESSAGES.TABLE_VISER, x, y });
