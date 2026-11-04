/**
 * Partie : état d'une partie en cours, séparé de la préparation.
 * Module PUR : aucun accès au DOM ni au stockage, il se teste sous Node.
 * Ce que la table en voit (règle de visibilité, vue table, encart) est dans vue-publique.js ; le passage d'une porte et la pose
 * des pions dans passage.js ; presentation.js réexporte les trois. États d'un pion : `ETATS_DE_PION`, `LIBELLES_ETAT`.
 *
 * {
 *   format: 'carte-de-mj-presentation', version: 1,
 *   donjon:       <COPIE du donjon préparé>,   // les modifications en jeu vont ici, jamais dans l'original
 *   salleCourante: idSalle,                    // la salle montrée à la table
 *   decouvertes:   [idSalle],                  // salles déjà montrées aux joueurs
 *   reveles:       { idSalle: [idElement] },   // éléments `cache: true` que le MJ a révélés
 *   notesPartie:   { idSalle: texte },         // notes prises en jouant (facultatif : absent des anciennes parties)
 *   masques:       { idSalle: ['monstres'|'objets'] }, // ce que le MJ a retiré de la table dans cette salle (facultatif, idem)
 *   joueurs:       [{ id, nom, race, classe }],  // joueurs sans fiche, indiqués au lancement (facultatif, idem ; voir personnages.js)
 *   pvEnJeu:       { idPersonnage: { pv, pvTemp } }  // PV changés en régie (facultatif, idem). À part : les fiches sont recopiées du donjon à chaque ouverture
 * }
 *
 * Démarrer une présentation copie le donjon : le donjon préparé n'est JAMAIS modifié, et aucun
 * texte n'est réécrit (déplacer un pion ne change que x et y dans le plan de la copie). Les
 * identifiants d'éléments (o1, c1, p1…) sont donc stables : rien ne relit le texte.
 * Révéler ne touche pas au plan : l'identifiant est ajouté à `reveles`, `cache` reste dans la copie.
 *
 * IMPROVISATION (étape 4) : le MJ peut faire évoluer le donjon pendant la partie, toujours dans la copie.
 *  - Le PLAN d'une salle de la copie est la référence : commandes (ajoute, supprime, déplace), nouvelle salle
 *    derrière une porte, état des pions (`etat` sur la créature) le modifient directement, sans jamais relire
 *    un texte. Les identifiants d'éléments et de portes restent donc stables, et les liaisons (salle + mur +
 *    position) ne bougent pas.
 *  - Le `texte` d'une salle de la copie n'est PAS utilisé en partie : c'est la description de la préparation,
 *    figée au démarrage (déjà le cas quand un pion se déplace ou change de salle). Il n'est ni affiché ni relu,
 *    on ne le réécrit donc pas. Seule une salle créée en jeu reçoit un texte (decrire(plan)), parce qu'une
 *    salle en a toujours un.
 *  - `notesPartie` est séparé de `notes` (préparation, jamais modifié) et ne quitte jamais la régie.
 *
 * MASQUAGE : table réelle, vrais pions et vrais coffres. Le MJ montre les monstres et les objets d'une salle le temps de les
 * poser, puis les retire de la table. Le choix est gardé par salle ; il ne touche pas au plan, et la régie voit tout, toujours.
 */
import { validerDonjon } from './donjon-validation.js';
import { validerPlan, ETATS, LISTES } from './schema.js';
import { interpreterCommande } from './parseur/commandes.js';
import { evaluerPose } from './pose.js';
import { validerJoueurs } from './personnages.js';
import { estObjet } from './format.js';
import { estCache, estRevele, estMasque, recevoirCaseVisee } from './vue-publique.js';

export const FORMAT_PRESENTATION = 'carte-de-mj-presentation';
export const VERSION_PRESENTATION = 1;

const dictionnaire = () => Object.create(null);
/** Longueur maximale d'une note de partie (comme les notes de préparation). */
const MAX_NOTE = 20000;
/** Ce que le MJ peut retirer de la table. Les pions des joueurs restent : « monstres » veut dire tout pion qui n'est pas pj (PNJ compris). */
export const CATEGORIES_MASQUABLES = ['monstres', 'objets'];

/** Tous les éléments d'un plan, avec leur genre : { genre, element }. */
export const tousLesElements = (plan) => Object.entries(LISTES).flatMap(([genre, liste]) => (plan[liste] || []).map((element) => ({ genre, element })));

// --- Création et validation ------------------------------------------------------

/** Copie profonde d'un donjon (dictionnaires sans prototype : une clé comme « constructor » reste inoffensive). */
function copierDonjon(donjon) {
  const c = JSON.parse(JSON.stringify(donjon));
  const salles = dictionnaire();
  for (const [id, s] of Object.entries(c.salles)) salles[id] = s;
  c.salles = salles;
  return c;
}

/**
 * Salle par laquelle commencer par défaut : la première du donjon (dans l'ordre où elles ont été créées).
 * Le modèle ne marque pas de salle « entrée » (`entree` d'un plan est un mur) : la première fait foi.
 * Ce n'est pas `salleActive`, qui est la dernière salle modifiée dans le Donjon (souvent la plus avancée).
 */
export const salleDepart = (donjon) => Object.keys(donjon?.salles || {})[0] || null;

/**
 * Démarre une présentation : COPIE du donjon, salle de départ découverte, rien de révélé.
 * Le donjon passé n'est pas modifié.
 */
export function creerPresentation(donjon, { salleDepart } = {}) {
  if (!donjon?.salles || !Object.keys(donjon.salles).length) throw new Error('ce donjon n’a aucune salle');
  const copie = copierDonjon(donjon);
  const depart = typeof salleDepart === 'string' && salleDepart in copie.salles ? salleDepart : Object.keys(copie.salles)[0];
  return {
    format: FORMAT_PRESENTATION, version: VERSION_PRESENTATION,
    donjon: copie, salleCourante: depart, decouvertes: [depart], reveles: dictionnaire(), notesPartie: dictionnaire(), masques: dictionnaire(), joueurs: [], pvEnJeu: dictionnaire(),
  };
}

/**
 * Valide (et nettoie) une présentation venue du stockage. Refuse ce qui n'est pas exploitable.
 * `avertissements` : ce que le nettoyage du donjon a perdu en route (vide si tout est repris tel quel) ; toujours une liste.
 * @returns {{ok:boolean, erreurs:string[], avertissements:string[], presentation:object|null}}
 */
export function validerPresentation(brut) {
  const refus = (m) => ({ ok: false, erreurs: [m], avertissements: [], presentation: null });
  if (!estObjet(brut)) return refus('présentation invalide');
  if (brut.format !== FORMAT_PRESENTATION) return refus('ce n’est pas une présentation de Carte de MJ');
  if (!Number.isInteger(brut.version) || brut.version < 1 || brut.version > VERSION_PRESENTATION) return refus('version de présentation non prise en charge');
  const v = validerDonjon(brut.donjon);
  if (!v.donjon) return refus(`donjon de la présentation invalide : ${v.erreurs.join(', ')}`);
  const donjon = v.donjon;
  const salleCourante = typeof brut.salleCourante === 'string' && brut.salleCourante in donjon.salles ? brut.salleCourante : donjon.salleActive;

  const decouvertes = [];
  for (const id of Array.isArray(brut.decouvertes) ? brut.decouvertes : []) {
    if (typeof id === 'string' && id in donjon.salles && !decouvertes.includes(id)) decouvertes.push(id);
  }
  if (!decouvertes.includes(salleCourante)) decouvertes.push(salleCourante);

  const reveles = dictionnaire();
  if (estObjet(brut.reveles)) {
    for (const [idSalle, ids] of Object.entries(brut.reveles)) {
      if (!(idSalle in donjon.salles) || !Array.isArray(ids)) continue;
      const cachesDeLaSalle = new Set(tousLesElements(donjon.salles[idSalle].plan).filter((x) => estCache(x.element)).map((x) => x.element.id));
      const gardes = [...new Set(ids.filter((id) => typeof id === 'string' && cachesDeLaSalle.has(id)))];
      if (gardes.length) reveles[idSalle] = gardes;
    }
  }

  // Notes de partie (facultatives : absentes des parties enregistrées avant l'étape 4).
  const notesPartie = dictionnaire();
  if (estObjet(brut.notesPartie)) {
    for (const [idSalle, texte] of Object.entries(brut.notesPartie)) {
      if (idSalle in donjon.salles && typeof texte === 'string' && texte) notesPartie[idSalle] = texte.slice(0, MAX_NOTE);
    }
  }

  // Masquage (facultatif : absent des parties enregistrées avant lui, où tout est donc visible).
  const masques = dictionnaire();
  if (estObjet(brut.masques)) {
    for (const [idSalle, categories] of Object.entries(brut.masques)) {
      if (!(idSalle in donjon.salles) || !Array.isArray(categories)) continue;
      const gardes = CATEGORIES_MASQUABLES.filter((c) => categories.includes(c));
      if (gardes.length) masques[idSalle] = gardes;
    }
  }

  // PV changés en régie (facultatifs) : seulement pour les fiches de ce donjon, en nombres positifs.
  const pvEnJeu = dictionnaire();
  if (estObjet(brut.pvEnJeu)) {
    const positif = (v) => Number.isFinite(v) && v >= 0;
    for (const { id } of donjon.personnages || []) {
      const e = Object.hasOwn(brut.pvEnJeu, id) ? brut.pvEnJeu[id] : null;
      if (estObjet(e) && positif(e.pv) && positif(e.pvTemp)) pvEnJeu[id] = { pv: e.pv, pvTemp: e.pvTemp };
    }
  }
  return { ok: true, erreurs: [], avertissements: v.avertissements, presentation: { format: FORMAT_PRESENTATION, version: VERSION_PRESENTATION, donjon, salleCourante, decouvertes, reveles, notesPartie, masques, joueurs: validerJoueurs(brut.joueurs), pvEnJeu } };
}

// --- Découvertes, salle courante -------------------------------------------------------

export const estDecouverte = (p, idSalle) => p.decouvertes.includes(idSalle);

/** Rend une salle courante (affichée à la table) ET découverte. */
export function afficherATable(p, idSalle) {
  if (!(idSalle in p.donjon.salles)) return false;
  p.salleCourante = idSalle;
  if (!p.decouvertes.includes(idSalle)) p.decouvertes.push(idSalle);
  return true;
}

// --- Révélation --------------------------------------------------------------------------

/** Révèle un élément caché de la salle. Renvoie false s'il n'existe pas ou n'est pas caché. */
export function revelerElement(p, idSalle, idElement) {
  const plan = p.donjon.salles[idSalle]?.plan;
  if (!plan || !tousLesElements(plan).some((x) => x.element.id === idElement && estCache(x.element))) return false;
  const liste = p.reveles[idSalle] || (p.reveles[idSalle] = []);
  if (!liste.includes(idElement)) liste.push(idElement);
  return true;
}

/** Recache un élément révélé. Renvoie false s'il n'était pas révélé. */
export function recacherElement(p, idSalle, idElement) {
  const liste = p.reveles[idSalle];
  if (!liste?.includes(idElement)) return false;
  const reste = liste.filter((id) => id !== idElement);
  if (reste.length) p.reveles[idSalle] = reste;
  else delete p.reveles[idSalle];
  return true;
}

/** Révèle tous les éléments cachés de la salle. Renvoie le nombre d'éléments nouvellement révélés. */
export function revelerToute(p, idSalle) {
  const plan = p.donjon.salles[idSalle]?.plan;
  if (!plan) return 0;
  let n = 0;
  for (const { element } of tousLesElements(plan)) {
    if (estCache(element) && !estRevele(p, idSalle, element.id) && revelerElement(p, idSalle, element.id)) n++;
  }
  return n;
}

/** { total, reveles } : éléments cachés de la salle, et parmi eux ceux déjà révélés. */
export function comptageCaches(p, idSalle) {
  const plan = p.donjon.salles[idSalle]?.plan;
  const caches = plan ? tousLesElements(plan).filter((x) => estCache(x.element)) : [];
  return { total: caches.length, reveles: caches.filter((x) => estRevele(p, idSalle, x.element.id)).length };
}

/**
 * Plan tel que la RÉGIE le dessine : les éléments révélés ne sont plus translucides, les autres
 * éléments cachés restent reconnaissables. (Le MJ voit tout : ce n'est PAS le plan de la table.)
 */
export function planRegie(plan, idsReveles = []) {
  const rev = new Set(idsReveles);
  const nettoie = (liste) => (liste || []).map((e) => {
    if (!estCache(e) || !rev.has(e.id)) return e;
    const { cache, ...sans } = e;
    return sans;
  });
  return { ...plan, portes: nettoie(plan.portes), objets: nettoie(plan.objets), creatures: nettoie(plan.creatures) };
}

// --- Masquage à la table ----------------------------------------------------------------------

/** Montre ou retire de la table une catégorie d'éléments de la salle. Le plan n'est pas touché : positions et états restent. */
export function definirMasque(p, idSalle, categorie, masque) {
  if (!(idSalle in p.donjon.salles) || !CATEGORIES_MASQUABLES.includes(categorie)) return false;
  if (!estObjet(p.masques)) p.masques = dictionnaire();
  const reste = CATEGORIES_MASQUABLES.filter((c) => (c === categorie ? masque : estMasque(p, idSalle, c)));
  if (reste.length) p.masques[idSalle] = reste;
  else delete p.masques[idSalle];
  return true;
}


// --- Déplacement des pions ------------------------------------------------------------------

/**
 * Enregistre dans la copie le déplacement d'un pion proposé par deplacement.js : seuls x et y du
 * pion changent (jamais le texte, jamais le reste du plan). Renvoie true si un pion a bougé.
 */
export function appliquerDeplacement(p, idSalle, nouveauPlan) {
  const plan = p.donjon.salles[idSalle]?.plan;
  if (!plan) return false;
  for (const k of plan.creatures) {
    const n = (nouveauPlan.creatures || []).find((c) => c.id === k.id);
    if (n && (n.x !== k.x || n.y !== k.y)) { k.x = n.x; k.y = n.y; return true; }
  }
  return false;
}

/**
 * Déplace un pion avec les règles de pose de l'outil (js/pose.js). Sert aux demandes venues de l'écran de table,
 * qui ne connaît que ce qui est visible : c'est toujours la régie, avec le plan complet, qui décide.
 * @returns {boolean} vrai si le pion a bougé
 */
export function deplacerPion(p, idSalle, idPion, x, y) {
  const plan = p?.donjon?.salles?.[idSalle]?.plan;
  const pion = plan?.creatures.find((k) => k.id === idPion);
  if (!pion || !Number.isInteger(x) || !Number.isInteger(y) || (pion.x === x && pion.y === y)) return false;
  if (!evaluerPose(plan, 'creature', pion, x, y, pion).ok) return false;
  pion.x = x;
  pion.y = y;
  return true;
}

// --- État des pions ----------------------------------------------------------------------------

/** Sentinelle : pas d'état. Donner « normal » à un pion retire son champ `etat` (le schéma ne connaît que `ETATS`). */
export const ETAT_NORMAL = 'normal';
/** Les états qu'on peut donner à un pion, dans l'ordre où l'interface les propose. */
export const ETATS_DE_PION = [ETAT_NORMAL, ...ETATS];
/** Comment on dit chaque état en français (à la suite de « est »). */
export const LIBELLES_ETAT = { [ETAT_NORMAL]: 'normal', blesse: 'blessé', mort: 'mort' };

/**
 * Pose l'état d'un pion de la salle : « blesse », « mort » ou « normal » (retire le champ).
 * C'est une information de jeu : la table la voit. Renvoie false si le pion n'existe pas ou l'état est inconnu.
 */
export function definirEtat(p, idSalle, idPion, etat) {
  const pion = p.donjon.salles[idSalle]?.plan.creatures.find((k) => k.id === idPion);
  if (!pion || (etat !== ETAT_NORMAL && !ETATS.includes(etat))) return false;
  if (etat === ETAT_NORMAL) delete pion.etat;
  else pion.etat = etat;
  return true;
}

// --- Notes de partie ------------------------------------------------------------------------------

/** Notes prises en jouant pour cette salle (séparées des notes de préparation, jamais envoyées à la table). */
export const notePartie = (p, idSalle) => p.notesPartie?.[idSalle] || '';

/** Remplace la note de partie d'une salle ; une note vide est retirée. */
export function definirNotePartie(p, idSalle, texte) {
  if (!(idSalle in p.donjon.salles)) return false;
  if (!estObjet(p.notesPartie)) p.notesPartie = dictionnaire();
  const t = String(texte ?? '').slice(0, MAX_NOTE);
  if (t) p.notesPartie[idSalle] = t;
  else delete p.notesPartie[idSalle];
  return true;
}

// --- Commandes à la volée ------------------------------------------------------------------------------

/**
 * Applique une commande du MJ (« ajoute trois gobelins », « supprime le coffre »…) à une salle de la copie.
 * Voir parseur/commandes.js. Une commande refusée ne change rien. Un élément supprimé n'est plus « révélé »
 * (son identifiant pourra être réutilisé par un nouvel élément, qui ne doit pas naître révélé).
 * @returns {{ok:boolean, message:string}}
 */
export function appliquerCommande(p, idSalle, texte) {
  const salle = p.donjon.salles[idSalle];
  if (!salle) return { ok: false, message: 'Cette salle n’existe plus.' };
  const r = interpreterCommande(texte, salle.plan);
  if (!r.ok) return r;
  const v = validerPlan(r.plan); // garde-fou : jamais de plan invalide dans la partie
  if (!v.ok) return { ok: false, message: 'Cette commande donnerait un plan invalide : elle n’a pas été appliquée.' };
  salle.plan = { ...v.plan, id: idSalle };
  for (const id of r.supprimes) recacherElement(p, idSalle, id);
  return { ok: true, message: r.message };
}

// --- La case que le MJ montre aux joueurs -----------------------------------------------------

/**
 * Un clic sur une case vide la montre ; un clic sur la même case l'enlève. Une case qui n'est pas du sol de la salle ne se montre pas.
 * @param {{salle:string,x:number,y:number}|null} caseVisee la case montrée avant le clic
 * @returns {{salle:string,x:number,y:number}|null} la case montrée après le clic
 */
export function viserCase(caseVisee, p, idSalle, x, y) {
  const deja = caseVisee?.salle === idSalle && caseVisee.x === x && caseVisee.y === y;
  return !deja && recevoirCaseVisee({ x, y }, p.donjon.salles[idSalle]?.plan) ? { salle: idSalle, x, y } : null;
}

/**
 * La case montrée s'efface dès qu'un pion s'y pose, ou que ni la régie (`consultee`) ni la table ne regardent plus sa salle.
 * @returns {{salle:string,x:number,y:number}|null} la case à garder
 */
export function oublierCaseSiResolue(caseVisee, p, consultee) {
  const c = caseVisee;
  if (!c) return c;
  const pions = p.donjon.salles[c.salle]?.plan.creatures || [];
  const occupee = pions.some((k) => c.x >= k.x && c.x < k.x + k.taille && c.y >= k.y && c.y < k.y + k.taille);
  return occupee || (c.salle !== consultee && c.salle !== p.salleCourante) ? null : c;
}

// --- Personnages et joueurs de la partie ---------------------------------------------------------

/** La ligne qui résume une partie en cours, dans l'écran de départ. */
export function resumePartie(p) {
  const nom = p.donjon.salles[p.salleCourante].nom;
  return `Partie en cours : salle « ${nom} », ${p.decouvertes.length} salle${p.decouvertes.length > 1 ? 's' : ''} découverte${p.decouvertes.length > 1 ? 's' : ''} sur ${Object.keys(p.donjon.salles).length}.`;
}

/** Où est le pion d'un personnage du donjon dans cette partie. @returns {{salle:string, pion:object}|null} */
export function pionDuPersonnage(p, idPersonnage) {
  for (const [salle, s] of Object.entries(p.donjon.salles)) {
    const pion = s.plan.creatures.find((k) => k.fiche === idPersonnage);
    if (pion) return { salle, pion };
  }
  return null;
}

/** Le nom d'un personnage de la partie : fiche du donjon ou joueur sans fiche. @returns {string|null} */
export function nomPersonnage(p, id) {
  const fiche = (p.donjon.personnages || []).find((x) => x.id === id)?.fiche;
  return fiche?.nom ?? (p.joueurs || []).find((j) => j.id === id)?.nom ?? null;
}

/** Ajoute à la partie des joueurs sans fiche. @returns {string[]} les identifiants des nouveaux joueurs */
export function ajouterJoueurs(p, liste) {
  const avant = (p.joueurs || []).length;
  p.joueurs = validerJoueurs([...(p.joueurs || []), ...liste]);
  return p.joueurs.slice(avant).map((j) => j.id);
}

/**
 * Les PV d'un personnage à fiche : ceux changés en jeu, sinon ceux de la fiche.
 * @returns {{pv:number, pvTemp:number, pvMax:number, enJeu:boolean}|null}  null : pas de fiche (un joueur sans fiche n'a pas de PV)
 */
export function pvPersonnage(p, id) {
  const fiche = (p.donjon.personnages || []).find((x) => x.id === id)?.fiche;
  if (!fiche) return null;
  const enJeu = p.pvEnJeu?.[id];
  return enJeu ? { pv: Math.min(enJeu.pv, fiche.pvMax), pvTemp: enJeu.pvTemp, pvMax: fiche.pvMax, enJeu: true } : { pv: fiche.pv, pvTemp: fiche.pvTemp, pvMax: fiche.pvMax, enJeu: false };
}

/**
 * Change les PV d'un personnage à fiche, comme l'outil Fiche : des dégâts (montant négatif) entament d'abord les PV temporaires et
 * s'arrêtent à 0 ; des soins (montant positif) s'arrêtent aux PV max. La fiche elle-même n'est pas touchée.
 * @returns {{pv:number, pvTemp:number, pvMax:number, enJeu:boolean}|null}  null : pas de fiche, ou montant illisible
 */
export function changerPV(p, id, montant) {
  const actuels = pvPersonnage(p, id);
  if (!actuels || !Number.isInteger(montant) || !montant) return null;
  let { pv, pvTemp } = actuels;
  if (montant < 0) {
    const absorbe = Math.min(pvTemp, -montant);
    pvTemp -= absorbe;
    pv = Math.max(0, pv + montant + absorbe);
  } else pv = Math.max(pv, Math.min(actuels.pvMax, pv + montant));
  if (!estObjet(p.pvEnJeu)) p.pvEnJeu = dictionnaire();
  p.pvEnJeu[id] = { pv, pvTemp };
  return pvPersonnage(p, id);
}

/** Oublie les PV changés en jeu : le personnage reprend ceux de sa fiche. */
export function oublierPV(p, id) {
  if (p.pvEnJeu) delete p.pvEnJeu[id];
}

/** La partie reprend les fiches du donjon de la bibliothèque : ce ne sont pas des données de jeu, et elles ont pu changer. */
export function synchroniserPersonnages(p, donjon) {
  if (donjon?.personnages?.length) p.donjon.personnages = JSON.parse(JSON.stringify(donjon.personnages));
  else delete p.donjon.personnages;
}

/**
 * La partie à ouvrir quand on arrive du bouton « Présenter » d'un donjon : celle de ce donjon, sinon une nouvelle.
 * @returns {{partie:object, reprise:boolean}|null}  null : ce donjon n'est pas (ou plus) dans ce navigateur
 */
export function partieDemandee(idDonjon, donjons, presentations) {
  const a = (objet, cle) => !!objet && Object.prototype.hasOwnProperty.call(objet, cle);
  if (!idDonjon || !a(donjons, idDonjon)) return null;
  if (a(presentations, idDonjon)) return { partie: presentations[idDonjon], reprise: true };
  return { partie: creerPresentation(donjons[idDonjon]), reprise: false };
}
