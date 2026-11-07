/**
 * Le calibrage de la table, côté régie : l'état du parcours (étape courante, taille en cours de réglage), l'envoi des messages `calibrage`
 * à la table (js/protocole-table.js) et ce qui est enregistré à la fin. Sans DOM : il se teste sous Node.
 *
 * Le calibrage est un MODE de la table, indépendant de toute salle ou présentation. Tant qu'il est actif, la régie envoie la table à ce mode
 * (`envoyer`, aussi à chaque `diffuser()` de regie.js) ; à la fin ou à l'annulation, elle envoie `fin de calibrage` et la table retrouve
 * ce qu'elle montrait.
 *
 * Ce qui est réglé pendant le parcours reste un BROUILLON (la taille en pixels) : rien n'est enregistré avant `terminer()`. La rotation, le
 * miroir et la taille visée en mm sont ceux de l'Affichage (`r`, source unique) : ils sont lus à chaque envoi, jamais copiés.
 *
 * `ctx` : { r (les réglages), envoyer(message) (poste sur le canal, seulement si la régie a la main), enregistrer() (écrit `r`),
 *          surChangement() (facultatif : l'interface se met à jour) }.
 */
import { ETAPES_CALIBRAGE, messageCalibrage, messageFinCalibrage } from './protocole-table.js';
import { ajusterTaille, tailleReglable, CASE_MM_PAR_DEFAUT, TAILLE_PAR_DEFAUT } from './affichage.js';

export function creerCalibrage(ctx) {
  const { r } = ctx;
  let etape = null; // null : pas de calibrage en cours
  let taille = null; // le brouillon, en pixels par case

  const prevenir = () => ctx.surChangement?.();
  const tailleEnregistree = () => (Number.isFinite(r.taille) && tailleReglable(r.taille) ? r.taille : TAILLE_PAR_DEFAUT);

  /** Le message qui décrit l'état courant à la table ; null sans calibrage. */
  function message() {
    if (!etape) return null;
    return messageCalibrage({ etape, taille, caseMm: r.caseMm ?? CASE_MM_PAR_DEFAUT, rotation: r.rotationTable || 0, miroir: r.miroirTable === true });
  }
  /** Envoie l'état courant à la table (ou la fin du calibrage s'il n'y en a pas) : à rappeler à chaque changement et à chaque `diffuser()`. */
  function envoyer() {
    ctx.envoyer(etape ? message() : messageFinCalibrage());
  }

  return {
    actif: () => etape !== null,
    etape: () => etape,
    /** La taille en cours de réglage (px par case) ; celle qui est enregistrée sans calibrage. */
    taille: () => (etape ? taille : tailleEnregistree()),
    message,
    envoyer,

    /** Démarre le calibrage à une étape (« mesurer » par défaut : c'est ce que fait le bouton actuel). Sans effet s'il est déjà en cours. */
    demarrer(depart = 'mesurer') {
      if (etape) return;
      etape = ETAPES_CALIBRAGE.includes(depart) ? depart : 'mesurer';
      taille = tailleEnregistree();
      envoyer(); prevenir();
    },
    /** Va à une étape (sans effet hors calibrage ou pour une étape inconnue). */
    aller(suivante) {
      if (!etape || !ETAPES_CALIBRAGE.includes(suivante)) return;
      etape = suivante;
      envoyer(); prevenir();
    },
    /** L'étape d'après ; depuis la dernière (« termine »), le calibrage est enregistré. */
    suivante() {
      if (!etape) return;
      const i = ETAPES_CALIBRAGE.indexOf(etape);
      if (i === ETAPES_CALIBRAGE.length - 1) this.terminer();
      else this.aller(ETAPES_CALIBRAGE[i + 1]);
    },
    /** L'étape d'avant (la première reste la première). */
    precedente() {
      if (!etape) return;
      this.aller(ETAPES_CALIBRAGE[Math.max(0, ETAPES_CALIBRAGE.indexOf(etape) - 1)]);
    },
    /** Change la taille du brouillon d'un pas de pixels (borné, au dixième). */
    ajuster(pas) {
      if (!etape || !Number.isFinite(pas)) return;
      taille = ajusterTaille(taille, pas);
      envoyer(); prevenir();
    },
    /** Fixe la taille du brouillon ; ignorée hors des bornes. */
    definirTaille(t) {
      if (!etape || !Number.isFinite(t) || !tailleReglable(t)) return;
      taille = Math.round(t * 10) / 10;
      envoyer(); prevenir();
    },
    /** Enregistre ce qui vient d'être mesuré (la table est à l'échelle réelle) et rend la table à la présentation. */
    terminer() {
      if (!etape) return;
      r.taille = taille;
      r.calibre = true;
      r.modeTable = 'reel';
      etape = null; taille = null;
      ctx.enregistrer();
      envoyer(); prevenir();
    },
    /** Abandonne : rien n'est enregistré, la table retrouve la présentation. */
    annuler() {
      if (!etape) return;
      etape = null; taille = null;
      envoyer(); prevenir();
    },
  };
}
