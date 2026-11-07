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
import { ajusterTaille, tailleReglable, caseMmValide, CASE_MM_PAR_DEFAUT, CASE_MM_MIN, CASE_MM_MAX, TAILLE_PAR_DEFAUT } from './affichage.js';

// --- Le parcours dans le popover Affichage : fonctions pures (le DOM est dans js/atelier/calibrage-parcours.js) ---------------------------------

/** Le pas de repère du curseur « Une case vaut » (mm) et la zone où la poignée s'accroche au standard (± mm). */
export const REPERE_MM = 5;
export const ACCROCHE_MM = 1;

/** La case standard, 25 mm, ramenée à la valeur où la poignée s'accroche quand on en est à ±1 mm ; toute autre valeur est inchangée. */
export function accrocherMm(mm, standard = CASE_MM_PAR_DEFAUT, zone = ACCROCHE_MM) {
  return Number.isFinite(mm) && Math.abs(mm - standard) <= zone ? standard : mm;
}
/** Les repères du curseur : [{ mm, pct (0–100 sur la plage 10–50), standard }] tous les 5 mm, le standard marqué. */
export function graduationsMm(min = CASE_MM_MIN, max = CASE_MM_MAX, pas = REPERE_MM) {
  const reperes = [];
  for (let mm = min; mm <= max; mm += pas) reperes.push({ mm, pct: ((mm - min) / (max - min)) * 100, standard: mm === CASE_MM_PAR_DEFAUT });
  return reperes;
}
/** Le bouton « Standard : 25 mm » : grisé quand la case vaut déjà le standard. */
export const standardGrise = (mm) => !Number.isFinite(mm) || Math.abs(mm - CASE_MM_PAR_DEFAUT) < 0.05;
/** La taille visée d'une case (mm) des réglages. */
export const caseMmDe = (r) => (caseMmValide(r?.caseMm) ? r.caseMm : CASE_MM_PAR_DEFAUT);
/** Écrit la taille visée d'une case (mm, au dixième) dans les réglages ; le standard n'est pas écrit. Rend la valeur retenue (illisible ou hors bornes : inchangée). */
export function appliquerCaseMm(r, mm) {
  const v = Math.round(Number(mm) * 10) / 10;
  if (!caseMmValide(v)) return caseMmDe(r);
  if (v === CASE_MM_PAR_DEFAUT) delete r.caseMm; else r.caseMm = v;
  return v;
}
/** Tourne l'écran de la table d'un pas (en degrés : ±90) ; 0 n'est pas écrit. Rend la rotation retenue. */
export function appliquerRotation(r, pas) {
  const v = (((r.rotationTable || 0) + pas) % 360 + 360) % 360;
  if (v) r.rotationTable = v; else delete r.rotationTable;
  return v;
}
/** Bascule le miroir de l'écran de la table (faux n'est pas écrit). Rend le nouvel état. */
export function basculerMiroir(r) {
  if (r.miroirTable === true) delete r.miroirTable; else r.miroirTable = true;
  return r.miroirTable === true;
}
/** Le texte d'une taille en pixels pour l'écran : un dixième, virgule française. */
export const texteTaille = (t) => `${(Math.round(t * 10) / 10).toFixed(1).replace('.', ',')} px`;

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
    /** Enregistre ce qui vient d'être mesuré et rend la table à la présentation ; `mode` : « reel » (échelle réelle, par défaut) ou « remplir ». */
    terminer({ mode = 'reel' } = {}) {
      if (!etape) return;
      r.taille = taille;
      r.calibre = true;
      r.modeTable = mode === 'remplir' ? 'remplir' : 'reel';
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
