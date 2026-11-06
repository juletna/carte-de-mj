/**
 * Validation d'un donjon venu de l'extérieur (fichier importé, stockage, partie) et conversion d'un fichier en donjon.
 * Module PUR, sans DOM. Il lit donjon.js (constantes, `creerDonjon`) ; donjon.js ne l'importe jamais, donc pas de cycle :
 * ceux qui ont besoin de `validerDonjon` ou de `convertirImport` l'importent d'ici directement.
 *
 * `validerDonjon` refuse ce qui n'est pas exploitable et écarte avec un avertissement ce qui peut l'être (liaisons, personnages,
 * éléments et valeurs inconnues d'un plan, textes trop longs). Seul le choix de la salle active se corrige sans rien dire : rien n'y est perdu.
 */
import { validerPersonnages } from './personnages.js';
import { validerPlan } from './schema.js';
import { MURS, longueurMur } from './murs.js';
import { decrire } from './parseur/decrire.js';
import { estObjet } from './format.js';
import {
  FORMAT, FORMAT_ANCIEN, VERSION, MAX_SALLES, LIMITES, coupe, dictionnaire, nomParDefaut, idUnique, planDepuisTexte, creerDonjon, extremite,
} from './donjon.js';

const MAX_LIAISONS = 1000;
const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function messageVersion(version) {
  if (!Number.isInteger(version) || version < 1) return 'numéro de version invalide';
  if (version > VERSION) return `fichier de version ${version}, plus récente que celle que cet outil comprend (${VERSION}) : mets l'outil à jour`;
  return null;
}

/** Une salle venue de l'extérieur : texte, plan validé et notes bornés. Renvoie { salle, erreurs, avertissements }. */
function validerSalle(brut, id, echelle) {
  const erreurs = [], avertissements = [];
  if (!estObjet(brut)) return { erreurs: [`salle « ${id} » : ce n'est pas un objet`] };
  const etiquette = `salle « ${coupe(brut.nom || id, 40)} »`;
  let plan = null;
  let texte = typeof brut.texte === 'string' ? coupe(brut.texte, LIMITES.texte) : null;
  if (typeof brut.texte === 'string' && brut.texte.length > LIMITES.texte) avertissements.push(`${etiquette} : description coupée à ${LIMITES.texte} caractères`);
  if (typeof brut.notes === 'string' && brut.notes.length > LIMITES.notes) avertissements.push(`${etiquette} : notes coupées à ${LIMITES.notes} caractères`);
  if (brut.plan !== undefined) {
    const v = validerPlan(brut.plan);
    if (!v.plan) erreurs.push(`${etiquette} : plan invalide (${v.erreurs.join(', ')})`);
    else {
      plan = v.plan;
      if (!v.ok) avertissements.push(`${etiquette} : éléments écartés (${v.erreurs.join(', ')})`);
    }
  } else if (texte !== null) {
    plan = planDepuisTexte(texte, id, echelle);
  } else {
    erreurs.push(`${etiquette} : ni plan ni texte`);
  }
  if (erreurs.length) return { erreurs, avertissements };
  plan.id = id;
  if (texte === null) texte = coupe(decrire(plan), LIMITES.texte);
  return {
    erreurs, avertissements,
    salle: { id, nom: coupe(brut.nom, LIMITES.nom).trim() || nomParDefaut({ salles: {} }, plan), texte, plan, notes: coupe(brut.notes, LIMITES.notes) },
  };
}

const cleExtremite = (e) => (e.escalier === true ? `${e.salle}|escalier|${e.x}|${e.y}` : `${e.salle}|${e.mur}|${e.position}`);

function validerExtremite(e, salles) {
  if (!estObjet(e)) return 'extrémité invalide';
  if (typeof e.salle !== 'string' || !(e.salle in salles)) return 'salle inconnue';
  if (e.escalier === true) {
    const { largeur, longueur } = salles[e.salle].plan;
    return Number.isInteger(e.x) && Number.isInteger(e.y) && e.x >= 0 && e.y >= 0 && e.x < largeur && e.y < longueur ? null : 'escalier hors de la salle';
  }
  if (!MURS.includes(e.mur)) return 'mur inconnu';
  if (!Number.isInteger(e.position) || e.position < 0 || e.position >= longueurMur(e.mur, salles[e.salle].plan.largeur, salles[e.salle].plan.longueur)) return 'position hors du mur';
  return null;
}

/**
 * Valide (et nettoie) un donjon venu d'un fichier ou du stockage. Refuse ce qui n'est pas
 * exploitable, écarte avec un avertissement ce qui peut l'être (liaisons invalides).
 * @returns {{ok:boolean, erreurs:string[], avertissements:string[], donjon:object|null}}
 */
export function validerDonjon(brut, { echelle } = {}) {
  const refus = (...erreurs) => ({ ok: false, erreurs, avertissements: [], donjon: null });
  if (!estObjet(brut)) return refus('le fichier doit contenir un objet JSON');
  if (brut.format !== FORMAT) return refus('ce fichier n’est pas un donjon de Carte de MJ');
  const mv = messageVersion(brut.version);
  if (mv) return refus(mv);
  if (!estObjet(brut.salles)) return refus('le donjon n’a pas de salles');
  const entrees = Object.entries(brut.salles);
  if (!entrees.length) return refus('le donjon n’a aucune salle');
  if (entrees.length > MAX_SALLES) return refus(`trop de salles (${MAX_SALLES} au plus)`);

  const erreurs = [], avertissements = [];
  const salles = dictionnaire();
  for (const [cle, s] of entrees) {
    if (!RE_ID.test(cle) || (s?.id !== undefined && s.id !== cle)) { erreurs.push(`identifiant de salle invalide : « ${coupe(cle, 30)} »`); continue; }
    const r = validerSalle(s, cle, echelle);
    erreurs.push(...r.erreurs);
    avertissements.push(...(r.avertissements || []));
    if (r.salle) salles[cle] = r.salle;
  }
  if (erreurs.length) return refus(...erreurs);

  const liaisons = [];
  const vues = new Set();
  const ids = new Set();
  const brutes = Array.isArray(brut.liaisons) ? brut.liaisons.slice(0, MAX_LIAISONS) : [];
  if (brut.liaisons !== undefined && brut.liaisons !== null && !Array.isArray(brut.liaisons)) avertissements.push('liaisons ignorées : ce n’est pas une liste');
  else if (brut.liaisons?.length > MAX_LIAISONS) avertissements.push(`${brut.liaisons.length - MAX_LIAISONS} liaison(s) ignorée(s) au-delà de ${MAX_LIAISONS}`);
  for (const [i, l] of brutes.entries()) {
    const probleme = !estObjet(l) ? 'liaison invalide' : validerExtremite(l.a, salles) || validerExtremite(l.b, salles)
      || (l.a.salle === l.b.salle ? 'liaison d’une salle avec elle-même' : null)
      || ((l.a.escalier === true) !== (l.b.escalier === true) ? 'une porte reliée à un escalier' : null);
    const cleA = probleme ? null : cleExtremite(l.a);
    const cleB = probleme ? null : cleExtremite(l.b);
    if (probleme || vues.has(cleA) || vues.has(cleB)) {
      avertissements.push(`liaison ${i + 1} ignorée : ${probleme || 'une porte (ou un escalier) est déjà reliée'}`);
      continue;
    }
    vues.add(cleA); vues.add(cleB);
    const id = typeof l.id === 'string' && RE_ID.test(l.id) && !ids.has(l.id) ? l.id : idUnique('l', ids);
    ids.add(id);
    liaisons.push({
      id,
      a: extremite(l.a.salle, l.a),
      b: extremite(l.b.salle, l.b),
    });
  }

  const donjon = {
    format: FORMAT, version: VERSION,
    id: typeof brut.id === 'string' && RE_ID.test(brut.id) ? brut.id : idUnique('donjon'),
    nom: coupe(brut.nom, LIMITES.nom).trim() || 'Donjon',
    salleActive: typeof brut.salleActive === 'string' && brut.salleActive in salles ? brut.salleActive : Object.keys(salles)[0],
    salles, liaisons,
  };
  const personnages = validerPersonnages(brut.personnages);
  if (personnages.length) donjon.personnages = personnages;
  if (brut.personnages !== undefined && brut.personnages !== null && !Array.isArray(brut.personnages)) avertissements.push('personnages ignorés : ce n’est pas une liste');
  else if (brut.personnages?.length > personnages.length) avertissements.push(`${brut.personnages.length - personnages.length} personnage(s) écarté(s)`);
  return { ok: true, erreurs: [], avertissements, donjon };
}

/**
 * Importe le contenu d'un fichier : nouveau format, ancien format (`jdr-carte`, une salle)
 * ou plan seul. Un fichier de donjon GARDE son identifiant (on retrouve ainsi sa partie en cours) ; mais si cet identifiant
 * est dans `idsPris` (les donjons de l'utilisateur), le donjon en reçoit un neuf : importer deux fois le même fichier
 * ne remplace jamais un donjon existant. Un fichier sans identifiant valide, un ancien format et un plan seul en reçoivent toujours un neuf.
 * @param {{echelle?:number, idsPris?:Iterable<string>}} [options]
 * @returns {{ok:boolean, erreurs:string[], avertissements:string[], donjon:object|null}}
 */
export function convertirImport(brut, { echelle, idsPris = [] } = {}) {
  const refus = (...erreurs) => ({ ok: false, erreurs, avertissements: [], donjon: null });
  if (!estObjet(brut)) return refus('le fichier doit contenir un objet JSON');
  const pris = new Set(idsPris);
  const sansCollision = (r) => {
    if (r.donjon && pris.has(r.donjon.id)) r.donjon.id = idUnique('donjon', pris);
    return r;
  };

  if (brut.format === FORMAT) return sansCollision(validerDonjon(brut, { echelle }));

  let planBrut, texte;
  if (brut.format === FORMAT_ANCIEN) {
    const mv = messageVersion(brut.version);
    if (mv) return refus(mv);
    if (!Array.isArray(brut.salles) || !estObjet(brut.salles[0])) return refus('ancien format : aucune salle dans le fichier');
    planBrut = brut.salles[0];
    texte = typeof brut.texte === 'string' && brut.texte ? coupe(brut.texte, LIMITES.texte) : undefined;
  } else if ('largeur' in brut && 'longueur' in brut) {
    planBrut = brut; // un plan seul
  } else {
    return refus('format de fichier non reconnu : ni donjon, ni ancienne carte, ni plan');
  }

  const v = validerPlan(planBrut);
  if (!v.plan) return refus(`plan invalide : ${v.erreurs.join(', ')}`);
  const donjon = creerDonjon({ nom: v.plan.nom !== 'Salle' ? v.plan.nom : 'Donjon importé', plan: v.plan, texte, echelle });
  return sansCollision({
    ok: true,
    erreurs: [],
    avertissements: v.ok ? [] : [`éléments écartés : ${v.erreurs.join(', ')}`],
    donjon,
  });
}
