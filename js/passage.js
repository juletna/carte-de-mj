/**
 * Passage : faire passer le groupe par une porte (ou un escalier), créer la salle derrière une porte (ou au bout d'un
 * escalier), poser des pions dans une salle. Partout ici, « porte » vaut aussi pour un escalier : `idPorte` est alors
 * l'identifiant de l'objet escalier, et la liaison le désigne par sa case (voir donjon.js).
 * Module PUR (voir partie.js pour la partie sur laquelle il agit). C'est lui qui lit le parseur de salle (`analyser`,
 * `decrire`) quand le MJ décrit la salle d'à côté en jouant.
 */
import * as modele from './donjon.js';
import { liaisonDePorte, estEscalier, extremite, phraseRetour } from './donjon.js';
import { OPPOSE, longueurMur } from './murs.js';
import { definition } from './parseur/lexique.js';
import { analyser } from './parseur/index.js';
import { decrire } from './parseur/decrire.js';
import { surLeSol } from './formes.js';
import { ancragePorte } from './rendu/geometrie.js';
import { seChevauchent } from './pose.js';
import { estRevele } from './vue-publique.js';
import { tousLesElements, afficherATable, revelerElement, recacherElement, nomPersonnage, pionDuPersonnage, ajouterJoueurs } from './partie.js';

// --- Passage d'une porte, le groupe suit -----------------------------------------------------------

const taillePion = (k) => k.taille || 1;
const rect = (e) => ({ x: e.x, y: e.y, l: e.taille ?? e.l ?? 1, h: e.taille ?? e.h ?? 1 });

/** La porte, ou l'objet escalier, d'identifiant `id` dans le plan (undefined sinon). */
const passageDe = (plan, id) => plan?.portes.find((q) => q.id === id) || plan?.objets.find((o) => o.id === id && o.type === 'escalier');

/** Point de la porte, au bord de la pièce, ou milieu de l'escalier, en cases. */
function pointPorte(plan, arrivee) {
  if (estEscalier(arrivee)) {
    const e = plan.objets.find((o) => o.type === 'escalier' && o.x === arrivee.x && o.y === arrivee.y);
    return e ? [e.x + e.l / 2, e.y + e.h / 2] : [arrivee.x + 0.5, arrivee.y + 0.5];
  }
  const a = ancragePorte(plan, arrivee.mur, arrivee.position);
  return a ? [a.x, a.y] : [plan.largeur / 2, plan.longueur / 2];
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
        if (!surLeSol(plan, x, y, s, s)) continue;
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
  const porte = passageDe(p.donjon.salles[idSalle]?.plan, idPorte);
  if (!porte) return null;
  const lien = liaisonDePorte(p.donjon, idSalle, porte);
  const salle = lien && p.donjon.salles[lien.autre.salle];
  return salle ? { salle, arrivee: { ...lien.autre } } : null;
}

/**
 * Passe une porte : la salle d'arrivée devient courante et découverte. Si `groupe`, les pions pj de
 * la salle d'où l'on part la suivent. Une porte non reliée n'est pas une erreur : { ok: false, message }.
 * @returns {{ok:boolean, message?:string, vers?:string, deplaces?:number, restes?:number}}
 */
export function passerPorte(p, idSalle, idPorte, { groupe = true } = {}) {
  const porte = passageDe(p.donjon.salles[idSalle]?.plan, idPorte);
  if (!porte) return { ok: false, message: 'Cette porte n’existe plus.' };
  const dest = destinationPorte(p, idSalle, idPorte);
  if (!dest) return { ok: false, message: estEscalier(porte) ? 'Cet escalier ne mène nulle part : il n’est relié à aucune salle.' : 'Cette porte ne mène nulle part : elle n’est reliée à aucune salle.' };
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
  const porte = passageDe(d.salles[idSalle]?.plan, idPorte);
  if (!porte) return { ok: false, message: 'Cette porte n’existe plus.' };
  if (liaisonDePorte(d, idSalle, porte)) return { ok: false, message: estEscalier(porte) ? 'Cet escalier est déjà relié à une salle.' : 'Cette porte est déjà reliée à une salle.' };
  if (Object.keys(d.salles).length >= modele.MAX_SALLES) return { ok: false, message: `Ce donjon a déjà ${modele.MAX_SALLES} salles : c’est le maximum.` };
  const depuis = extremite(idSalle, porte);
  const texte = String(description ?? '').trim();
  const nomSalle = String(nom ?? '').trim();

  if (!texte) {
    const { salle } = modele.creerSalleDerriere(d, { depuis, echelle });
    if (nomSalle) modele.renommerSalle(d, salle.id, nomSalle);
    return { ok: true, salle, ignores: [] };
  }
  if (estEscalier(porte)) return creerSalleAuBoutDeLEscalier(d, depuis, porte, texte, { nomSalle, echelle });

  const mur = OPPOSE[porte.mur];
  const analyse = analyser(texte, { echelle, entree: mur }); // « au fond » se lit depuis la porte de retour
  const plan = { ...analyse.plan, portes: [...analyse.plan.portes] };
  let retour = plan.portes.find((q) => q.mur === mur && !q.cache);
  if (!retour) {
    const long = longueurMur(mur, plan.largeur, plan.longueur);
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

/**
 * La salle décrite au bout d'un escalier : l'escalier du retour est celui que le texte place, dans le bon sens (visible) ;
 * sinon il est ajouté à la description. Même contrat que `creerSalleApresPorte`.
 */
function creerSalleAuBoutDeLEscalier(d, depuis, escalier, texte, { nomSalle, echelle }) {
  const sens = escalier.sens === 'monte' ? undefined : 'monte'; // le retour va dans l'autre sens
  const estRetour = (o) => o.type === 'escalier' && o.sens === sens && !o.cache;
  let analyse = analyser(texte, { echelle });
  if (!analyse.plan.objets.some(estRetour)) analyse = { ...analyser(`${texte}, ${phraseRetour(escalier)}`, { echelle }), ignores: analyse.ignores };
  const retour = analyse.plan.objets.find(estRetour);
  if (!retour) return { ok: false, message: 'Cette salle n’a plus de place pour l’escalier du retour : décris-la plus grande.' };
  const salle = modele.ajouterSalle(d, { nom: nomSalle || undefined, texte: decrire(analyse.plan), plan: analyse.plan });
  try {
    modele.relier(d, depuis, extremite(salle.id, retour));
  } catch (err) {
    modele.supprimerSalle(d, salle.id);
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

/**
 * Un retardataire sans fiche en pleine partie : il est ajouté puis son pion est posé dans la salle donnée.
 * Si la pose échoue (plus de place), le joueur reste ajouté, sans pion.
 * @returns {{ok:false, message:string}|{ok:true, id:string, nom:string, pose:{ok:boolean, message?:string}}}
 *   ok:false : le nombre maximal de personnages est atteint, rien n'est ajouté
 */
export function ajouterRetardataire(p, idSalle, ligne) {
  const [id] = ajouterJoueurs(p, [{ nom: ligne?.nom, race: ligne?.race, classe: ligne?.classe }]);
  if (!id) return { ok: false, message: 'La partie ne peut pas accueillir d’autre joueur.' };
  return { ok: true, id, nom: nomPersonnage(p, id), pose: poserPersonnage(p, idSalle, id) };
}

/**
 * Pose les pions de ces personnages dans la salle à la table, au lancement de la partie.
 * @returns {{poses:number, restes:string[]}} restes : le nom de ceux qui n'ont pas trouvé de place
 */
export function poserAuDepart(p, ids) {
  const restes = [];
  let poses = 0;
  for (const id of ids) {
    if (poserPersonnage(p, p.salleCourante, id).ok) poses++;
    else restes.push(nomPersonnage(p, id));
  }
  return { poses, restes };
}

/**
 * Pose le pion d'un personnage dans une salle, au plus près de sa première porte. Déjà posé ailleurs : il y vient.
 * @returns {{ok:true, pion:object}|{ok:false, message:string}}
 */
export function poserPersonnage(p, idSalle, idPersonnage) {
  const nom = nomPersonnage(p, idPersonnage);
  const plan = p.donjon.salles[idSalle]?.plan;
  if (!nom || !plan) return { ok: false, message: 'Ce personnage ou cette salle n’existe plus.' };
  const deja = pionDuPersonnage(p, idPersonnage);
  if (deja?.salle === idSalle) return { ok: true, pion: deja.pion };
  const modele = { type: 'pj', camp: 'pj', taille: 1, fiche: idPersonnage };
  const { places } = placerPions(plan, [modele], plan.portes[0] || {});
  if (!places.length) return { ok: false, message: `Plus de place dans cette salle pour ${nom}.` };
  if (deja) {
    const depart = p.donjon.salles[deja.salle].plan;
    depart.creatures = depart.creatures.filter((k) => k !== deja.pion);
  }
  const numeros = plan.creatures.filter((k) => k.type === 'pj').map((k) => k.numero);
  const pion = { id: idLibre(plan, 'c'), ...modele, x: places[0].x, y: places[0].y, numero: Math.max(0, ...numeros) + 1 };
  plan.creatures.push(pion);
  return { ok: true, pion };
}
