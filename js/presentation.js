/**
 * Présentation : état d'une partie en cours, séparé de la préparation.
 * Module PUR : aucun accès au DOM ni au stockage, il se teste sous Node.
 *
 * {
 *   format: 'carte-de-mj-presentation', version: 1,
 *   donjon:       <COPIE du donjon préparé>,   // les modifications en jeu vont ici, jamais dans l'original
 *   salleCourante: idSalle,                    // la salle montrée à la table
 *   decouvertes:   [idSalle],                  // salles déjà montrées aux joueurs
 *   reveles:       { idSalle: [idElement] },   // éléments `cache: true` que le MJ a révélés
 *   notesPartie:   { idSalle: texte }          // notes prises en jouant (facultatif : absent des anciennes parties)
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
 * SÉCURITÉ : `vueTable()` est la SEULE source de ce qui part vers la fenêtre ou l'écran de table.
 * Elle construit le plan à partir d'une liste blanche de champs : notes, noms, textes, éléments
 * cachés non révélés, liaisons et autres salles n'y entrent jamais. L'état d'un pion (blessé, mort) est une
 * information de jeu : il y entre, au même titre que sa position.
 */
import * as modele from './donjon.js';
import { validerDonjon, liaisonDePorte, OPPOSE, longueurMur } from './donjon.js';
import { validerPlan, ETATS } from './schema.js';
import { definition } from './parseur/lexique.js';
import { analyser } from './parseur/index.js';
import { decrire } from './parseur/decrire.js';
import { interpreterCommande } from './parseur/commandes.js';

export { ETATS };

export const FORMAT_PRESENTATION = 'carte-de-mj-presentation';
export const VERSION_PRESENTATION = 1;
/** Canal BroadcastChannel entre la régie et la fenêtre table. */
export const CANAL = 'carte-de-mj-presentation';

const dictionnaire = () => Object.create(null);
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const LISTES = { porte: 'portes', objet: 'objets', creature: 'creatures' };
/** Longueur maximale d'une note de partie (comme les notes de préparation). */
const MAX_NOTE = 20000;

/** Un élément est caché dès que son champ `cache` est vrai (lecture volontairement large). */
const estCache = (e) => !!e?.cache;
const tousLesElements = (plan) => Object.entries(LISTES).flatMap(([genre, liste]) => (plan[liste] || []).map((element) => ({ genre, element })));

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
 * Démarre une présentation : COPIE du donjon, salle de départ découverte, rien de révélé.
 * Le donjon passé n'est pas modifié.
 */
export function creerPresentation(donjon, { salleDepart } = {}) {
  if (!donjon?.salles || !Object.keys(donjon.salles).length) throw new Error('ce donjon n’a aucune salle');
  const copie = copierDonjon(donjon);
  const depart = [salleDepart, copie.salleActive].find((id) => typeof id === 'string' && id in copie.salles) || Object.keys(copie.salles)[0];
  return {
    format: FORMAT_PRESENTATION, version: VERSION_PRESENTATION,
    donjon: copie, salleCourante: depart, decouvertes: [depart], reveles: dictionnaire(), notesPartie: dictionnaire(),
  };
}

/**
 * Valide (et nettoie) une présentation venue du stockage. Refuse ce qui n'est pas exploitable.
 * @returns {{ok:boolean, erreurs:string[], presentation:object|null}}
 */
export function validerPresentation(brut) {
  const refus = (m) => ({ ok: false, erreurs: [m], presentation: null });
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
  return { ok: true, erreurs: [], presentation: { format: FORMAT_PRESENTATION, version: VERSION_PRESENTATION, donjon, salleCourante, decouvertes, reveles, notesPartie } };
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

export const estRevele = (p, idSalle, idElement) => (p.reveles[idSalle] || []).includes(idElement);

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

// --- État des pions ----------------------------------------------------------------------------

/**
 * Pose l'état d'un pion de la salle : « blesse », « mort » ou « normal » (retire le champ).
 * C'est une information de jeu : la table la voit. Renvoie false si le pion n'existe pas ou l'état est inconnu.
 */
export function definirEtat(p, idSalle, idPion, etat) {
  const pion = p.donjon.salles[idSalle]?.plan.creatures.find((k) => k.id === idPion);
  if (!pion || (etat !== 'normal' && !ETATS.includes(etat))) return false;
  if (etat === 'normal') delete pion.etat;
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

// --- Passage d'une porte, le groupe suit -----------------------------------------------------------

const taillePion = (k) => k.taille || 1;
const rect = (e) => ({ x: e.x, y: e.y, l: e.taille ?? e.l ?? 1, h: e.taille ?? e.h ?? 1 });
const seChevauchent = (a, b) => a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.h && b.y < a.y + a.h;

/** Point de la porte, au bord de la pièce, en cases. */
function pointPorte(plan, arrivee) {
  const c = arrivee.position + 0.5;
  return { nord: [c, 0], sud: [c, plan.longueur], ouest: [0, c], est: [plan.largeur, c] }[arrivee.mur] || [plan.largeur / 2, plan.longueur / 2];
}

/** Ordre lexicographique : `a` passe avant `b` ? */
function avant(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/**
 * Place des pions dans la salle `plan`, au plus près de la porte d'arrivée, sans jamais en superposer
 * deux ni en sortir de la pièce. On préfère les cases sans objet gênant ; si la salle est pleine, un
 * pion peut monter sur un objet (comme à la main), jamais sur un autre pion.
 * @returns {{places:{pion:object,x:number,y:number}[], restes:object[]}} restes : faute de place
 */
export function placerPions(plan, pions, arrivee) {
  const occupes = (plan.creatures || []).map(rect);
  const bloquants = (plan.objets || []).filter((o) => definition(o.type)?.bloquant !== false).map(rect);
  const [ax, ay] = pointPorte(plan, arrivee);
  const places = [], restes = [];
  for (const pion of [...pions].sort((a, b) => taillePion(b) - taillePion(a))) {
    const s = taillePion(pion);
    let meilleur = null;
    for (let y = 0; y + s <= plan.longueur; y++) {
      for (let x = 0; x + s <= plan.largeur; x++) {
        const r = { x, y, l: s, h: s };
        if (occupes.some((o) => seChevauchent(r, o))) continue;
        const dx = Math.max(x - ax, 0, ax - (x + s)), dy = Math.max(y - ay, 0, ay - (y + s));
        const cle = [bloquants.some((o) => seChevauchent(r, o)) ? 1 : 0, Math.hypot(dx, dy), Math.hypot(x + s / 2 - ax, y + s / 2 - ay), y, x];
        if (!meilleur || avant(cle, meilleur.cle)) meilleur = { x, y, cle };
      }
    }
    if (!meilleur) { restes.push(pion); continue; }
    occupes.push({ x: meilleur.x, y: meilleur.y, l: s, h: s });
    places.push({ pion, x: meilleur.x, y: meilleur.y });
  }
  return { places, restes };
}

function idLibre(plan, prefixe) {
  const pris = new Set(tousLesElements(plan).map((x) => x.element.id));
  let n = 1;
  while (pris.has(`${prefixe}${n}`)) n++;
  return `${prefixe}${n}`;
}

/** Fait passer les pions de camp pj d'une salle à l'autre, placés près de la porte d'arrivée. */
function deplacerGroupe(p, idSource, idDest, arrivee) {
  const src = p.donjon.salles[idSource].plan, dest = p.donjon.salles[idDest].plan;
  const groupe = src.creatures.filter((k) => k.camp === 'pj');
  if (!groupe.length) return { deplaces: 0, restes: 0 };
  const { places, restes } = placerPions(dest, groupe, arrivee);
  for (const { pion, x, y } of places) {
    const id = idLibre(dest, 'c');
    const numeros = dest.creatures.filter((k) => k.type === pion.type).map((k) => k.numero);
    const numero = numeros.includes(pion.numero) ? Math.max(0, ...numeros) + 1 : pion.numero;
    const etaitRevele = estRevele(p, idSource, pion.id);
    src.creatures = src.creatures.filter((k) => k !== pion);
    recacherElement(p, idSource, pion.id);
    dest.creatures.push({ ...pion, id, x, y, numero });
    if (etaitRevele) revelerElement(p, idDest, id);
  }
  return { deplaces: places.length, restes: restes.length };
}

/** Salle et porte d'arrivée derrière une porte, ou null si la porte n'est reliée à rien. */
export function destinationPorte(p, idSalle, idPorte) {
  const porte = p.donjon.salles[idSalle]?.plan.portes.find((q) => q.id === idPorte);
  if (!porte) return null;
  const lien = liaisonDePorte(p.donjon, idSalle, porte);
  const salle = lien && p.donjon.salles[lien.autre.salle];
  return salle ? { salle, arrivee: { mur: lien.autre.mur, position: lien.autre.position } } : null;
}

/**
 * Passe une porte : la salle d'arrivée devient courante et découverte. Si `groupe`, les pions pj de
 * la salle d'où l'on part la suivent. Une porte non reliée n'est pas une erreur : { ok: false, message }.
 * @returns {{ok:boolean, message?:string, vers?:string, deplaces?:number, restes?:number}}
 */
export function passerPorte(p, idSalle, idPorte, { groupe = true } = {}) {
  if (!p.donjon.salles[idSalle]?.plan.portes.some((q) => q.id === idPorte)) return { ok: false, message: 'Cette porte n’existe plus.' };
  const dest = destinationPorte(p, idSalle, idPorte);
  if (!dest) return { ok: false, message: 'Cette porte ne mène nulle part : elle n’est reliée à aucune salle.' };
  const suite = groupe ? deplacerGroupe(p, idSalle, dest.salle.id, dest.arrivee) : { deplaces: 0, restes: 0 };
  afficherATable(p, dest.salle.id);
  return { ok: true, vers: dest.salle.id, ...suite };
}

/**
 * Crée une salle derrière une porte non reliée, relie les deux et renvoie la salle. Sans description : une salle
 * de 6 × 6 cases avec sa porte de retour (creerSalleDerriere du modèle). Avec une description : elle est lue par le
 * parseur de salle, et la porte de retour est celle que le texte place sur le mur opposé (visible), sinon une porte
 * est ajoutée sur ce mur, à la même position que la porte d'origine si elle est libre. La salle d'arrivée reçoit
 * son texte par decrire(plan). Aucune autre salle n'est touchée : les liaisons existantes restent valables.
 * @returns {{ok:boolean, message?:string, salle?:object, ignores?:string[]}}
 */
export function creerSalleApresPorte(p, idSalle, idPorte, description = '', { nom = '', echelle } = {}) {
  const d = p.donjon;
  const porte = d.salles[idSalle]?.plan.portes.find((q) => q.id === idPorte);
  if (!porte) return { ok: false, message: 'Cette porte n’existe plus.' };
  if (liaisonDePorte(d, idSalle, porte)) return { ok: false, message: 'Cette porte est déjà reliée à une salle.' };
  if (Object.keys(d.salles).length >= modele.MAX_SALLES) return { ok: false, message: `Ce donjon a déjà ${modele.MAX_SALLES} salles : c’est le maximum.` };
  const depuis = { salle: idSalle, mur: porte.mur, position: porte.position };
  const texte = String(description ?? '').trim();
  const nomSalle = String(nom ?? '').trim();

  if (!texte) {
    const { salle } = modele.creerSalleDerriere(d, { depuis, echelle });
    if (nomSalle) modele.renommerSalle(d, salle.id, nomSalle);
    return { ok: true, salle, ignores: [] };
  }

  const mur = OPPOSE[porte.mur];
  const analyse = analyser(texte, { echelle, entree: mur }); // « au fond » se lit depuis la porte de retour
  const plan = { ...analyse.plan, portes: [...analyse.plan.portes] };
  let retour = plan.portes.find((q) => q.mur === mur && !q.cache);
  if (!retour) {
    const long = longueurMur(plan, mur);
    const prises = new Set(plan.portes.filter((q) => q.mur === mur).map((q) => q.position));
    const voulue = Math.min(porte.position, long - 1);
    const position = prises.has(voulue) ? Array.from({ length: long }, (_, i) => i).find((i) => !prises.has(i)) : voulue;
    if (position === undefined) return { ok: false, message: `Le mur ${mur} de cette salle n’a plus de place pour la porte de retour : décris-la plus petite ou sans porte sur ce mur.` };
    retour = { id: idLibre(plan, 'p'), mur, position, type: porte.type };
    plan.portes.push(retour);
  }
  plan.entree = mur; // les joueurs entrent par la porte de retour
  const salle = modele.ajouterSalle(d, { nom: nomSalle || undefined, texte: decrire(plan), plan });
  try {
    modele.relier(d, depuis, { salle: salle.id, mur, position: retour.position });
  } catch (err) {
    modele.supprimerSalle(d, salle.id); // ne laisse pas une salle isolée derrière nous
    return { ok: false, message: err.message };
  }
  return { ok: true, salle, ignores: analyse.ignores };
}

/** Crée la salle derrière une porte non reliée, puis la franchit (« le groupe suit » comme pour un passage normal). */
export function creerSalleEtPasser(p, idSalle, idPorte, description, { nom, echelle, groupe = true } = {}) {
  const c = creerSalleApresPorte(p, idSalle, idPorte, description, { nom, echelle });
  if (!c.ok) return c;
  return { ...passerPorte(p, idSalle, idPorte, { groupe }), salle: c.salle, ignores: c.ignores };
}

// --- Vue table : ce qui part vers l'écran des joueurs -------------------------------------------------

/**
 * Plan « public » d'une salle : ce qu'il est permis de montrer aux joueurs. Construit par LISTE BLANCHE de champs
 * (ni nom, ni description, ni notes, ni `cache`, ni champ inconnu) ; partagé par la vue table et par l'impression.
 *  - visible(e)  : un porte, un objet ou un pion est-il montré ? (par défaut : tout ce qui n'est pas caché) ;
 *  - garder(k)   : filtre supplémentaire sur les pions (par défaut : tous) ;
 *  - avecEtat    : l'état blessé / mort d'un pion est une information de jeu (vrai pour la table, pas pour un plan imprimé).
 * @returns {object} un plan neuf, sans aucune référence vers le plan d'origine
 */
export function planPublic(plan, { visible = (e) => !estCache(e), garder = () => true, avecEtat = true } = {}) {
  const creature = (k) => ({
    id: k.id, type: k.type, camp: k.camp, x: k.x, y: k.y, taille: k.taille, numero: k.numero,
    ...(k.couleur ? { couleur: k.couleur } : {}),
    ...(avecEtat && ETATS.includes(k.etat) ? { etat: k.etat } : {}), // liste blanche : blessé ou mort, rien d'autre
  });
  return {
    version: 1, id: 'table', nom: '', forme: 'rectangle',
    largeur: plan.largeur, longueur: plan.longueur, sol: plan.sol, entree: 'sud',
    portes: (plan.portes || []).filter(visible).map((q) => ({ id: q.id, mur: q.mur, position: q.position, type: q.type })),
    objets: (plan.objets || []).filter(visible).map((o) => ({ id: o.id, type: o.type, x: o.x, y: o.y, l: o.l, h: o.h, rotation: o.rotation })),
    creatures: (plan.creatures || []).filter((k) => visible(k) && garder(k)).map(creature),
    connexions: [],
  };
}

/**
 * Plan de la salle courante tel que les joueurs peuvent le voir. Construit par LISTE BLANCHE (planPublic) :
 *  - rien d'autre que la salle courante (ni autres salles, ni liaisons, ni nom, ni description, ni notes) ;
 *  - aucun élément caché non révélé, portes comprises ;
 *  - aucun champ `cache` ni aucun champ inconnu (le seul ajout propre au jeu : l'état blessé / mort d'un pion).
 * @returns {object|null} un plan, ou null s'il n'y a pas de salle courante
 */
export function vueTable(p) {
  const salle = p?.donjon?.salles?.[p.salleCourante];
  const plan = salle?.plan;
  if (!plan) return null;
  const rev = new Set(Array.isArray(p.reveles?.[p.salleCourante]) ? p.reveles[p.salleCourante] : []);
  return planPublic(plan, { visible: (e) => !estCache(e) || rev.has(e.id) });
}

/**
 * Côté fenêtre table : relit un plan reçu avec les mêmes règles que le reste de l'outil, et par
 * précaution écarte tout élément marqué caché (la régie n'en envoie jamais).
 * @returns {object|null}
 */
export function recevoirVueTable(brut) {
  const { plan } = validerPlan(brut);
  if (!plan) return null;
  const sans = (liste) => liste.filter((e) => !estCache(e));
  return { ...plan, nom: '', connexions: [], portes: sans(plan.portes), objets: sans(plan.objets), creatures: sans(plan.creatures) };
}
