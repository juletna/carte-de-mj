/**
 * La graine d'une salle : le nombre dont le décor du thème peint tire tout son aléa (décalage des tuiles de sol, briques, détails). Module PUR.
 *
 * La table ne reçoit jamais l'identifiant d'une salle (vue-publique.js) mais `idPublic(id)`, une empreinte de cet identifiant ; la graine
 * calculée sur le plan de la régie et sur celui de la table est la même : une salle a le même décor des deux côtés.
 */
import { graineDeTexte } from './themes/peint/bruit.js';

const PUBLIC = /^g(\d{1,10})$/;

/** La graine d'un identifiant de salle. */
export const graineDeSalle = (id) => graineDeTexte(String(id ?? ''));

/** L'identifiant que la table reçoit à la place de celui de la salle : sa graine, sans que l'identifiant d'origine se déduise de rien. */
export const idPublic = (id) => `g${graineDeSalle(id)}`;

/** La graine d'un plan : celle de son identifiant, ou celle que porte déjà un identifiant public. */
export function graineDePlan(plan) {
  const m = PUBLIC.exec(String(plan?.id ?? ''));
  return m ? Number(m[1]) >>> 0 : graineDeSalle(plan?.id);
}
