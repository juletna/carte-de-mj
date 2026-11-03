/**
 * Tirages reproductibles, communs aux générateurs (donjon, fiche) : le même numéro de tirage redonne la même suite.
 * Module PUR (sans DOM), testable sous Node, et sans dépendance : la Fiche le charge sans rien d'autre de l'outil.
 */
export const GRAINE_MAX = 999999;

export function generateur(graine) {
  let a = (graine * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un numéro de tirage saisi : null s'il n'est pas valable, à l'appelant d'en tirer un. */
export function lireGraine(brut) {
  const graine = Math.round(Number(brut));
  return Number.isInteger(graine) && graine >= 1 && graine <= GRAINE_MAX ? graine : null;
}

export const nouvelleGraine = () => 1 + Math.floor(Math.random() * GRAINE_MAX);

export const melanger = (liste, alea) => {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
};
