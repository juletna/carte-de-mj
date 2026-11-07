/**
 * Qui commande la table quand plusieurs régies sont ouvertes dans ce navigateur.
 * Module PUR : aucun accès au DOM, au stockage ni au canal, il se teste sous Node. Le canal est branché dans regie.js.
 *
 * Règle : la main revient à la dernière régie qui a ouvert une partie. Une régie est donc :
 *  - libre    : elle vient de démarrer et n'a encore rien ouvert ;
 *  - à la main (`main`) : elle seule diffuse à la table, lui répond et applique ses gestes ;
 *  - en retrait (`retrait`) : une autre l'a dépassée. Elle ne reprend la main que sur un geste du MJ, jamais d'elle-même :
 *    un onglet en arrière-plan peut être gelé par le navigateur sans être fermé, et montrer à la table une vieille partie
 *    serait pire que de la laisser attendre.
 * Une régie libre ou en retrait ne parle jamais de plan à la table : elle ne peut donc pas vider la table d'une autre.
 *
 * SÉCURITÉ : ces messages ne portent qu'un identifiant de régie et une date, rien de la partie.
 */
import { MESSAGES } from './protocole-table.js';

export const PRISE_MAIN = 'regie-prise-main';
export const DEPART = 'regie-depart';
/** Réponse d'une régie sans la main à la table : « je suis là, mais je n'ai rien à te montrer ». Sans aucune donnée. */
export const PRESENCE = 'regie-presente';

export const nouvelIdRegie = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** `retrait` : l'onglet était en retrait avant d'être rechargé. On ne sait alors plus qui a la main. */
export const creerCommande = (moi, { retrait = false } = {}) => ({ moi, main: false, retrait, titulaire: null, titulaireParti: false, quand: 0 });

/** @returns le message à poster sur le canal. Sa date dépasse toujours la dernière entendue, même à la même milliseconde. */
export function prendreMain(c, maintenant) {
  Object.assign(c, { main: true, retrait: false, titulaire: c.moi, titulaireParti: false, quand: Math.max(maintenant, c.quand + 1) });
  return { type: PRISE_MAIN, regie: c.moi, quand: c.quand };
}

/** Le message à poster quand la page se ferme ou se recharge ; null si cette régie n'a pas la main. */
/** En retrait, sur la partie que la régie active a ouverte : enregistrer ici serait écrasé à sa prochaine sauvegarde. Si elle a été fermée, plus personne n'écrase. */
export const partieTenueAilleurs = (c, idPartie, idOuverte) => c.retrait && !c.titulaireParti && idPartie === idOuverte;

export const messageDepart = (c) => (c.main ? { type: DEPART, regie: c.moi } : null);

const idValide = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64;
/** Deux régies qui prennent la main en même temps se départagent sans se concerter : la date la plus récente, puis le plus grand identifiant. */
const depasse = (m, c) => m.quand > c.quand || (m.quand === c.quand && m.regie > c.moi);

/**
 * Applique un message du canal à l'état de la régie, et dit ce qu'elle doit faire :
 * 'retrait' (l'état a changé, à montrer au MJ), 'diffuser' (envoyer son état à la table), 'presence' (poster PRESENCE),
 * 'appliquer' (exécuter le geste venu de la table), ou null (rien : message ignoré).
 */
export function surMessage(c, m) {
  switch (m?.type) {
    case PRISE_MAIN:
      if (!idValide(m.regie) || !Number.isFinite(m.quand) || m.regie === c.moi || !depasse(m, c)) return null;
      Object.assign(c, { main: false, retrait: true, titulaire: m.regie, titulaireParti: false, quand: m.quand });
      return 'retrait';
    case DEPART:
      if (!c.retrait || m.regie !== c.titulaire) return null;
      c.titulaireParti = true;
      return 'retrait';
    case MESSAGES.DEMANDE_ETAT:
      return c.main ? 'diffuser' : 'presence';
    case MESSAGES.TABLE_DEPLACER:
    case MESSAGES.TABLE_VISER:
    case MESSAGES.TABLE_POINT:
    case MESSAGES.TABLE_ZOOM:
    case MESSAGES.TABLE_CADRER:
    case MESSAGES.TABLE_ELEMENT:
      return c.main ? 'appliquer' : null;
    default:
      return null;
  }
}
