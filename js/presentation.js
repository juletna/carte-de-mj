/**
 * Présentation : état d'une partie en cours, séparé de la préparation.
 * Module PUR : aucun accès au DOM ni au stockage, il se teste sous Node.
 *
 * {
 *   format: 'carte-de-mj-presentation', version: 1,
 *   donjon:       <COPIE du donjon préparé>,   // les modifications en jeu vont ici, jamais dans l'original
 *   salleCourante: idSalle,                    // la salle montrée à la table
 *   decouvertes:   [idSalle],                  // salles déjà montrées aux joueurs
 *   reveles:       { idSalle: [idElement] }    // éléments `cache: true` que le MJ a révélés
 * }
 *
 * Démarrer une présentation copie le donjon : le donjon préparé n'est JAMAIS modifié, et aucun
 * texte n'est réécrit (déplacer un pion ne change que x et y dans le plan de la copie). Les
 * identifiants d'éléments (o1, c1, p1…) sont donc stables : rien ne relit le texte.
 * Révéler ne touche pas au plan : l'identifiant est ajouté à `reveles`, `cache` reste dans la copie.
 *
 * SÉCURITÉ : `vueTable()` est la SEULE source de ce qui part vers la fenêtre ou l'écran de table.
 * Elle construit le plan à partir d'une liste blanche de champs : notes, noms, textes, éléments
 * cachés non révélés, liaisons et autres salles n'y entrent jamais.
 */
import { validerDonjon, liaisonDePorte } from './donjon.js';
import { validerPlan } from './schema.js';
import { definition } from './parseur/lexique.js';

export const FORMAT_PRESENTATION = 'carte-de-mj-presentation';
export const VERSION_PRESENTATION = 1;
/** Canal BroadcastChannel entre la régie et la fenêtre table. */
export const CANAL = 'carte-de-mj-presentation';

const dictionnaire = () => Object.create(null);
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const LISTES = { porte: 'portes', objet: 'objets', creature: 'creatures' };

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
    donjon: copie, salleCourante: depart, decouvertes: [depart], reveles: dictionnaire(),
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
  return { ok: true, erreurs: [], presentation: { format: FORMAT_PRESENTATION, version: VERSION_PRESENTATION, donjon, salleCourante, decouvertes, reveles } };
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

// --- Vue table : ce qui part vers l'écran des joueurs -------------------------------------------------

/**
 * Plan de la salle courante tel que les joueurs peuvent le voir. Construit par LISTE BLANCHE :
 *  - rien d'autre que la salle courante (ni autres salles, ni liaisons, ni nom, ni description, ni notes) ;
 *  - aucun élément caché non révélé, portes comprises ;
 *  - aucun champ `cache` ni aucun champ inconnu.
 * @returns {object|null} un plan, ou null s'il n'y a pas de salle courante
 */
export function vueTable(p) {
  const salle = p?.donjon?.salles?.[p.salleCourante];
  const plan = salle?.plan;
  if (!plan) return null;
  const rev = new Set(Array.isArray(p.reveles?.[p.salleCourante]) ? p.reveles[p.salleCourante] : []);
  const visible = (e) => !estCache(e) || rev.has(e.id);
  const creature = (k) => ({ id: k.id, type: k.type, camp: k.camp, x: k.x, y: k.y, taille: k.taille, numero: k.numero, ...(k.couleur ? { couleur: k.couleur } : {}) });
  return {
    version: 1, id: 'table', nom: '', forme: 'rectangle',
    largeur: plan.largeur, longueur: plan.longueur, sol: plan.sol, entree: 'sud',
    portes: (plan.portes || []).filter(visible).map((q) => ({ id: q.id, mur: q.mur, position: q.position, type: q.type })),
    objets: (plan.objets || []).filter(visible).map((o) => ({ id: o.id, type: o.type, x: o.x, y: o.y, l: o.l, h: o.h, rotation: o.rotation })),
    creatures: (plan.creatures || []).filter(visible).map(creature),
    connexions: [],
  };
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
