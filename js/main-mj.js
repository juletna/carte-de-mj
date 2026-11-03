/**
 * Point d'entrée de la vue MJ (outil Donjon) : relie la saisie, le parseur, le rendu,
 * le modèle de donjon (donjon.js), la mini-carte, les réglages et la sauvegarde.
 *
 * Rappel : dans chaque salle, la description est la seule référence.
 * texte → analyser() → plan → carte et JSON. Aucune dépendance à un autre outil ni au réseau.
 */
import { analyser } from './parseur/index.js';
import { dessiner, dessinerPlanDonjon } from './rendu/moteur.js';
import { MARGE } from './rendu/geometrie.js';
import { disposerPlan, salleSous, cleDisposition } from './plan-donjon.js';
import { tailleRemplir } from './affichage.js';
import {
  ZOOM_MIN, ZOOM_MAX, PLAN_ZOOM_MIN, PLAN_ZOOM_MAX, zoomBorne, pasDeZoom, facteurMolette, tailleAfficheePlan as tailleDuPlan,
} from './mise-en-page.js';
import { ajouterElement, elementsPalette, GROUPES_PALETTE, SOUS_GROUPES } from './pose.js';
import { creerPalette } from './palette.js';
import { creerHistorique } from './historique.js';
import { creerRail, OUTILS_CATALOGUE } from './rail.js';
import { creerMicro, voixDisponible } from './voix.js';
import * as stockage from './stockage.js';
import { activerDeplacement } from './deplacement.js';
import { decrire } from './parseur/decrire.js';
import * as modele from './donjon.js';
import { telephone, activerOnglets, marquerDefilement, LARGEUR_TELEPHONE } from './telephone.js';
import { creerPersonnages } from './mj/personnages-ui.js';
import { creerSalles } from './mj/salles-liste.js';
import { creerMenu } from './mj/menu-donjon.js';
import { creerSalleForme } from './mj/salle-forme.js';
import { creerBulle } from './mj/bulle.js';
import { $, h } from './dom.js';
import { libelleMicro } from './format.js';

const EXEMPLES = [
  'Grande pièce de 4 m par 12, quatre piliers, deux coffres au fond de la salle, une statue immobile devant une porte',
  'Salle du trône de 12 mètres sur 15, un trône au fond, deux statues de chaque côté du trône, six colonnes, des torches le long des murs',
  'Taverne de 8 par 6 cases, sol en bois, trois tables au centre, une bibliothèque contre le mur est, deux lits à gauche, un tonneau au fond à droite',
  'Salle de 12 m sur 15, une porte au sud, les personnages à l’entrée, un jeune dragon rouge au fond, deux tonneaux dans les coins, quatre gobelins devant le dragon, deux squelettes de chaque côté de la porte',
  'Salle carrée de 9 m, huit piliers en cercle, un autel au centre, une porte à l’ouest',
  'Petite crypte avec un sarcophage au centre, des débris et une herse au nord',
  'Salle de 6 cases sur 6, une porte au nord, une porte à l’est, un escalier dans le coin sud-ouest, trois tonneaux dans les coins, une fosse au centre',
  'Salle de 8 cases sur 8, une porte au sud, un coffre caché au fond, deux gobelins cachés devant le coffre, une porte secrète au mur nord',
];

// --- État de l'application ----------------------------------------------------
// Donjons et réglages sont sauvegardés séparément (voir stockage.js). L'ancienne clé
// `jdr-carte:v1` est migrée au premier démarrage, sans être supprimée. Ce qui était enregistré et ne se relit pas
// est mis de côté avant le premier enregistrement (`charge.miseDeCote`, annoncé en fin de fichier).
const charge = stockage.chargerTout({ texteInitial: EXEMPLES[0] });
const etat = {
  donjons: charge.donjons,
  actif: charge.actif,
  reglages: charge.reglages,
  selection: null,   // descripteur { genre, mur, position } ou { genre, type, x, y } : jamais un id du plan (ils changent à chaque relecture)
  message: '',       // retour d'une action sur la sélection
  retour: { compris: [], ignores: [] }, // dernier « compris / non compris », pour le rapport
  neuves: new Set(), // salles créées et pas encore affichées : la première fois, le focus va à la description
  zoom: null,        // côté de case choisi au zoom (px), temporaire et jamais sauvegardé ; null = la salle remplit la scène
  cleAjuste: '',     // donjon / salle / dimensions de la carte affichée : quand elle change, le zoom manuel est oublié
  plan: false,       // vue Plan du donjon affichée à la place de la salle (jamais mémorisée : on rouvre toujours sur la salle)
  zoomPlan: null,    // côté de case du plan choisi au zoom (px), propre au plan ; null = le plan remplit la scène
  planDispo: null,   // dernière disposition calculée (pour retrouver la salle sous un clic)
  planTaille: 0,     // côté de case réellement utilisé au dernier dessin du plan (peut être plafonné)
  planSurvol: null,  // salle survolée (souris ou focus clavier)
  clePlan: '',       // donjon du plan affiché : quand il change, le zoom du plan est oublié
  signatureListePlan: '', // salles de la liste clavier du plan : elle n'est reconstruite que si elle change
};
const r = etat.reglages;

const donjon = () => etat.donjons[etat.actif];
const salle = () => donjon().salles[donjon().salleActive];

// --- Historique : propre à chaque salle (voir historique.js) --------------------
// La pile d'une salle est vidée quand le MJ reprend la main sur son texte (frappe, exemple, effacer).
const historique = creerHistorique();
const pile = (idSalle = donjon().salleActive) => historique.pile(donjon().id, idSalle);
// `liaisons` : liaisons retirées par la modification (suppression d'une porte reliée), rétablies si on annule.
function memoriser(idSalle = donjon().salleActive, liaisons = []) {
  historique.memoriser(donjon().id, idSalle, { texte: donjon().salles[idSalle].texte, ancres: modele.ancresDeSalle(donjon(), idSalle), liaisons });
}

// Contexte des modules mj/ (fabriques `creerX(ctx)`) : ils le lisent au moment de l'appel et ne s'importent pas entre eux.
// Les fonctions (rendre, modifierPlan, activerSalle…) sont déclarées plus bas dans ce fichier ; les modules s'y ajoutent à mesure.
const ctx = { etat, donjon, salle, rendre, modifierPlan, annoncerCarte, deselectionner, sauvegarder, historique, activerSalle, afficherSalleActive, dispositionDuDonjon };
ctx.plan = { ouvrir: ouvrirPlan }; // le module de la vue Plan le remplacera
ctx.carte = { taille: tailleAffichee, apercu: apercuCarte, redessiner: dessinerCarte }; // idem pour la vue de la carte

// --- Rendu --------------------------------------------------------------------
/** Repères dessinés sur la carte : portes reliées et élément sélectionné. */
function marques(planAffiche) {
  const d = donjon(), s = salle();
  const reel = s.plan;
  // Pendant un glissement, la porte déplacée garde son repère : on la retrouve par son id dans le plan réel.
  const portesReliees = planAffiche.portes
    .filter((p) => modele.liaisonDePorte(d, s.id, reel.portes.find((q) => q.id === p.id) || p))
    .map((p) => ({ mur: p.mur, position: p.position }));
  const trouve = modele.retrouverElement(reel, etat.selection);
  const element = trouve && planAffiche[trouve.liste][trouve.index];
  return { portesReliees, selection: element ? { genre: trouve.genre, element } : null };
}

// --- Taille de la carte : ajustement automatique et zoom -------------------------------------

/**
 * Côté de case affiché :
 *  - pendant le calibrage à la carte bancaire : `r.taille` exact, sans aucune adaptation ;
 *  - après un zoom manuel (temporaire) : le zoom ;
 *  - sinon la salle remplit la scène (tailleRemplir, comme la Présentation en mode « remplir »). Scène masquée (onglet
 *    Texte du téléphone) : `r.taille`, un redessin suit à l'affichage.
 * `r.taille` est la taille calibrée, lue par la Présentation : rien ici ne l'écrit.
 */
function tailleAffichee(plan) {
  if ($('calibrage').checked) return r.taille;
  if (etat.zoom) return etat.zoom;
  const scene = $('scene');
  const retrait = 2 * (parseFloat(getComputedStyle($('support')).paddingLeft) || 0); // la place des bandes de dimensions
  return tailleRemplir(plan, scene.clientWidth - retrait, scene.clientHeight - retrait) ?? r.taille;
}
const optionsDessin = (plan) => ({ taille: tailleAffichee(plan), grille: r.grille, marques: marques(plan) });

/** Dessine `plan` sur la carte sans rien enregistrer (aperçu d'un glissement), à la taille donnée ou à celle de l'affichage. */
function apercuCarte(plan, taille) {
  dessiner($('carte'), plan, taille ? { ...optionsDessin(plan), taille } : optionsDessin(plan));
}

function dessinerCarte(plan) {
  dessiner($('carte'), plan, optionsDessin(plan));
  marquerDefilement($('carte'), $('scene'));
  majZoom(plan);
  ctx.bulle.placer();
}

/** Le zoom manuel ne survit ni à un changement de donjon ou de salle, ni de dimensions ; il survit à tout le reste. */
function oublierZoomSiAutreCarte() {
  const s = salle();
  const cle = `${donjon().id}/${s.id}/${s.plan.largeur}x${s.plan.longueur}`;
  if (cle === etat.cleAjuste) return;
  etat.cleAjuste = cle;
  etat.zoom = null;
}

function rendre() {
  const s = salle();
  oublierZoomSiAutreCarte();
  if (etat.plan) dessinerPlan(); // le plan est affiché : toute modification du donjon le redessine
  else dessinerCarte(s.plan);
  majCarteRef();
  $('annuler').hidden = $('annuler-carte').hidden = pile().length === 0;
  if (document.activeElement !== $('json')) $('json').value = JSON.stringify(s.plan, null, 2);
  ctx.bulle.maj();
  ctx.salles.majOrphelines();
  ctx.salles.majMiniCarte();
  majAide();
  salleForme.majForme();
  personnages.maj();
  sauvegarder();
}

function sauvegarder() {
  stockage.sauverDonjons(etat);
  stockage.sauverReglages(r);
}

/** Analyse le texte de la salle affichée et met à jour la carte et le retour « compris / ignoré ». */
function generer() {
  const s = salle();
  const { plan, compris, ignores } = analyser(s.texte, { echelle: r.echelle });
  s.plan = { ...plan, id: s.id };
  etat.retour = { compris, ignores };
  $('compris').replaceChildren(...compris.map((ligne) => h('li', { textContent: ligne })));
  const zoneIgnores = $('ignores');
  zoneIgnores.hidden = ignores.length === 0;
  zoneIgnores.textContent = ignores.length ? `Mots non compris : ${ignores.join(', ')}` : '';
  rendre();
}

/** Remplace la description de la salle affichée et régénère tout : le texte reste la seule référence. */
function changerTexte(texte) {
  salle().texte = texte;
  $('description').value = texte;
  generer();
}

/** Plus d'élément sélectionné : la bulle se ferme au prochain `ctx.bulle.maj()` ou `rendre()` (à la charge de l'appelant). */
function deselectionner() {
  etat.selection = null;
  etat.message = '';
}

/**
 * Toute modification du plan de la salle affichée passe par ici : `plan` est écrit dans la description (elle reste la seule
 * référence), qui régénère la carte et le JSON. Dans l'ordre :
 *  - mémorise la description actuelle pour « Annuler », sauf `memoire: false` (le curseur de forme en cours de glissement) ;
 *    `liaisons` : liaisons retirées par la modification, rétablies si on annule ;
 *  - `suivrePortes` : la liaison d'une porte déplacée ou décalée la suit ;
 *  - désélectionne, sauf `garderSelection` ;
 *  - `texte` : description à poser à la place de celle que `decrire(plan)` écrit (l'éditeur JSON).
 */
function modifierPlan(plan, { memoire = true, liaisons = [], suivrePortes = false, garderSelection = false, texte = null } = {}) {
  const s = salle();
  if (memoire) memoriser(s.id, liaisons);
  if (suivrePortes) modele.suivrePortesDeplacees(donjon(), s.id, s.plan, plan);
  if (!garderSelection) deselectionner();
  changerTexte(texte || decrire(plan));
}

// Mise à jour pendant la frappe, avec un court délai pour rester fluide.
let minuterie;
function genererBientot() {
  clearTimeout(minuterie);
  minuterie = setTimeout(generer, 200);
}

// --- Aide de première utilisation ---------------------------------------------------
// Une seule phrase, sous la description, tant que le donjon n'a ni liaison ni deuxième salle ; elle s'efface ensuite.
// Débutant = aucun donjon n'a encore plus d'une salle ni de liaison ; dès qu'on relie, l'aide s'efface.
const estDebutant = () => modele.estDebutant(etat.donjons);

function majAide() {
  const zone = $('aide-debut');
  zone.hidden = !estDebutant();
  zone.textContent = estDebutant() ? 'Clique une porte sur la carte pour créer la salle suivante.' : '';
  $('aide-salles').textContent = salle().plan.portes.length
    ? 'Clique une porte sur la carte pour la relier à une autre salle.'
    : 'Cette salle n’a pas de porte : ajoutes-en une avec l’outil Portes, ou écris-la dans la description.';
}

/**
 * Affiche la salle active : description, notes, listes. À appeler après tout changement de salle ou de donjon.
 * Le panneau revient en haut ; une salle qui vient d'être créée donne le focus à sa description (sauf au doigt,
 * pour ne pas faire surgir le clavier, et sauf si le focus doit rester sur la mini-carte).
 */
function afficherSalleActive() {
  const garderMini = $('minicarte').contains(document.activeElement); // le focus reste sur la miniature, si c'est là qu'il était
  clearTimeout(minuterie);
  deselectionner();
  $('description').value = salle().texte;
  $('notes').value = salle().notes;
  $('nom-salle-active').textContent = `· ${salle().nom}`;
  ctx.menu.majDonjons();
  ctx.salles.majListe();
  generer();
  $('panneau').scrollTo({ top: 0 });
  ctx.menu.fermer();
  const nouvelle = etat.neuves.delete(salle().id);
  if (nouvelle && !garderMini && !matchMedia('(pointer: coarse)').matches) $('description').focus({ preventScroll: true });
}

function activerSalle(id) {
  if (!(id in donjon().salles)) return;
  if (etat.plan) ouvrirPlan(false); // ouvrir une salle (onglet, liste, plan) quitte la vue Plan
  donjon().salleActive = id;
  afficherSalleActive();
}

// --- Saisie -------------------------------------------------------------------
$('description').addEventListener('input', (e) => { pile().length = 0; salle().texte = e.target.value; genererBientot(); });
$('effacer').addEventListener('click', () => { pile().length = 0; changerTexte(''); $('description').focus(); });

$('exemples').replaceChildren(...EXEMPLES.map((ex) => {
  const a = h('a', { textContent: ex, tabIndex: 0 });
  const choisir = () => { pile().length = 0; changerTexte(ex); };
  a.addEventListener('click', choisir);
  a.addEventListener('keydown', (e) => { if (e.key === 'Enter') choisir(); });
  return h('li', {}, a);
}));


// --- Notes ---------------------------------------------------------------------
let minuterieNotes;
$('notes').addEventListener('input', (e) => {
  salle().notes = e.target.value;
  clearTimeout(minuterieNotes);
  minuterieNotes = setTimeout(sauvegarder, 300);
});

// --- Carte : poser (palette), déplacer, cliquer ----------------------------------
// Élément de la palette armé : un appui sur la carte POSE. Cet écouteur est posé AVANT celui du déplacement (et en phase de
// capture) pour que le déplacement ne voie jamais cet appui : ni sélection, ni glissement tant qu'un élément est armé.
$('carte').addEventListener('pointerdown', (e) => {
  const item = palette.arme();
  if (!item || e.button !== 0) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  poserSurCarte(item, e.clientX, e.clientY);
}, true);

// Un élément déplacé réécrit la description, qui régénère la carte et le JSON.
// Un appui sans glissement sélectionne l'élément : ses actions s'ouvrent dans une bulle à côté de lui.
activerDeplacement($('carte'), {
  plan: () => salle().plan,
  taille: () => tailleAffichee(salle().plan),
  apercu: (plan) => apercuCarte(plan),
  portesLarges: true, // zone de clic des portes élargie vers l'intérieur ; un glissement sur un pion déplace toujours le pion
  commencer: () => { // un glissement commence : la bulle se ferme
    if (!etat.selection) return;
    deselectionner();
    ctx.bulle.maj();
  },
  deposer: (nouveau) => {
    const deplace = modele.elementDeplace(salle().plan, nouveau);
    if (deplace && modele.memeDescripteur(etat.selection, deplace.avant)) etat.selection = deplace.apres;
    modifierPlan(nouveau, { suivrePortes: true, garderSelection: true }); // la liaison d'une porte déplacée la suit
  },
  cliquer: (touche) => {
    etat.selection = touche ? modele.descripteur(touche.genre, touche.element) : null;
    etat.message = '';
    rendre();
  },
});

function annulerDeplacement() {
  const entree = pile().pop();
  if (!entree) return;
  modele.retablirLiaisons(donjon(), entree.liaisons);
  modele.restaurerAncres(donjon(), entree.ancres);
  changerTexte(entree.texte);
}
$('annuler').addEventListener('click', annulerDeplacement);
$('annuler-carte').addEventListener('click', annulerDeplacement); // même action, à portée dans l'onglet Carte (écran étroit)

// --- Bulle d'actions de l'élément sélectionné (js/mj/bulle.js) ---
// Un appui dans le vide de la scène ferme le tiroir de la palette. Posé avant l'écouteur de la bulle (même cible, même ordre qu'avant).
$('scene').addEventListener('pointerdown', (e) => {
  if (tiroirOuvert() && (e.target === $('scene') || e.target === $('support'))) ouvrirTiroir(false);
});
ctx.bulle = creerBulle(ctx);

// --- Zoom ------------------------------------------------------------------------------------
/** Affiche le zoom courant (pourcentage de la taille réelle : 100 % = une case à la taille calibrée). */
function majZoom(plan) {
  if (etat.plan) { majZoomPlan(); return; }
  const calibre = $('calibrage').checked;
  const t = tailleAffichee(plan || salle().plan);
  $('zoom-pct').textContent = `${Math.round((t / r.taille) * 100)} %`;
  for (const id of ['zoom-moins', 'zoom-plus', 'zoom-ajuster', 'zoom-reel']) $(id).disabled = calibre;
  $('zoom').title = calibre ? 'Calibrage en cours : la taille d’une case est celle du réglage. Décoche le calibrage pour zoomer.' : '';
  $('zoom-ajuster').setAttribute('aria-pressed', String(!calibre && !etat.zoom));
}

/**
 * Applique un zoom manuel (côté de case en px). Si `ancre` ({x, y} en px écran) est donné, la case qui s'y trouve y reste :
 * le zoom à la molette se fait sous le curseur.
 */
function zoomer(t, ancre) {
  if (etat.plan) { zoomerPlan(t, ancre); return; }
  if ($('calibrage').checked) return;
  const plan = salle().plan;
  const avant = tailleAffichee(plan);
  etat.zoom = zoomBorne(t, ZOOM_MIN, ZOOM_MAX);
  let sous = null;
  if (ancre) {
    const cv = $('carte').getBoundingClientRect();
    sous = [(ancre.x - cv.left) / avant - MARGE, (ancre.y - cv.top) / avant - MARGE];
  }
  dessinerCarte(plan);
  majCarteRef();
  if (sous) {
    const apres = tailleAffichee(plan), cv = $('carte').getBoundingClientRect();
    $('scene').scrollLeft += cv.left + (sous[0] + MARGE) * apres - ancre.x;
    $('scene').scrollTop += cv.top + (sous[1] + MARGE) * apres - ancre.y;
    ctx.bulle.placer();
  }
}
/** Un cran de zoom : ×1,25 ou ÷1,25, d'au moins 1 px. */
function pasZoom(sens) {
  const t = etat.plan ? etat.planTaille || tailleAfficheePlan() : tailleAffichee(salle().plan);
  zoomer(pasDeZoom(t, sens));
}
$('zoom-plus').addEventListener('click', () => pasZoom(1));
$('zoom-moins').addEventListener('click', () => pasZoom(-1));
$('zoom-ajuster').addEventListener('click', () => zoomer(null));
$('zoom-reel').addEventListener('click', () => zoomer(r.taille));
// Ctrl ou Cmd + molette (et le pincement du pavé tactile) : zoom sous le curseur ; la molette seule fait défiler.
$('scene').addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  zoomer((etat.plan ? etat.planTaille || tailleAfficheePlan() : tailleAffichee(salle().plan)) * facteurMolette(e.deltaY), { x: e.clientX, y: e.clientY });
}, { passive: false });

// La carte se réajuste quand la scène change de taille (fenêtre, plein écran, passage à l'onglet Carte du téléphone).
let derniereScene = '';
new ResizeObserver(() => {
  const scene = $('scene');
  const cle = `${scene.clientWidth}x${scene.clientHeight}`;
  if (cle === derniereScene) return;
  derniereScene = cle;
  if (!scene.clientWidth) return; // masquée : le redessin suivra à l'affichage
  if (etat.plan) { dessinerPlan(); return; }
  dessinerCarte(salle().plan);
  majCarteRef();
}).observe($('scene'));

// --- Vue Plan : tout le donjon d'un coup, les salles à leur vraie taille (js/plan-donjon.js, moteur.dessinerPlanDonjon) ---
// Elle remplace la carte de la salle dans la scène (#support, donc les bandes de dimensions et la bulle, est masqué). Son zoom
// est à part (`zoomPlan`) : la carte de la salle garde le sien. Cliquer une salle quitte le plan et l'ouvre.

/** Côté de case du plan : le zoom choisi, sinon le plan remplit la scène (jamais sous 4 px : au-delà, la scène défile). */
function tailleAfficheePlan() {
  const scene = $('scene');
  return tailleDuPlan({ zoom: etat.zoomPlan, dispo: etat.planDispo, largeur: scene.clientWidth, hauteur: scene.clientHeight });
}

/** Le calcul essaie plusieurs dispositions : on ne le refait que si les salles, leurs portes ou les liaisons ont changé. */
function dispositionDuDonjon(d) {
  const cle = cleDisposition(d);
  if (cle !== etat.cleDisposition) { etat.cleDisposition = cle; etat.planDispo = disposerPlan(d); }
  return etat.planDispo;
}

function dessinerPlan() {
  if (!etat.plan) return;
  const d = donjon();
  if (d.id !== etat.clePlan) { etat.clePlan = d.id; etat.zoomPlan = null; }
  dispositionDuDonjon(d);
  const t = tailleAfficheePlan();
  const res = dessinerPlanDonjon($('plan-donjon'), d, etat.planDispo, {
    taille: t, actif: d.salleActive, survol: etat.planSurvol, grille: r.grille && t >= 24,
  });
  etat.planTaille = res.taille;
  const n = Object.keys(d.salles).length;
  $('plan-donjon').setAttribute('aria-label', `Plan du donjon « ${d.nom} » : ${n} salle${n > 1 ? 's' : ''}. Clique une salle pour l’ouvrir.`);
  majListePlan();
  majZoomPlan();
}

/** Liste de boutons cachés à l'œil : chaque salle est atteignable au clavier (Tab, Entrée) ; le focus la surligne sur le plan. */
function majListePlan() {
  const d = donjon();
  const salles = modele.listerSalles(d);
  const signature = JSON.stringify([d.id, d.salleActive, salles.map((s) => [s.id, s.nom])]);
  if (signature === etat.signatureListePlan) return;
  etat.signatureListePlan = signature;
  $('plan-salles').replaceChildren(...salles.map((s) => {
    const b = h('button', { type: 'button', textContent: `Ouvrir la salle ${s.nom}${s.id === d.salleActive ? ' (affichée)' : ''}` });
    b.addEventListener('click', () => activerSalle(s.id));
    b.addEventListener('focus', () => survolerPlan(s.id));
    b.addEventListener('blur', () => survolerPlan(null));
    return h('li', {}, b);
  }));
}

function survolerPlan(id) {
  if (etat.planSurvol === id) return;
  etat.planSurvol = id;
  $('plan-donjon').classList.toggle('sur-salle', !!id);
  dessinerPlan();
}

function majZoomPlan() {
  const t = etat.planTaille || tailleAfficheePlan();
  $('zoom-pct').textContent = `${Math.round((t / r.taille) * 100)} %`;
  for (const id of ['zoom-moins', 'zoom-plus', 'zoom-ajuster']) $(id).disabled = false; // le calibrage ne concerne que la salle
  $('zoom').title = '';
  $('zoom-ajuster').setAttribute('aria-pressed', String(!etat.zoomPlan));
}

/** Zoom du plan (côté de case en px) ; `ancre` ({x, y} en px écran) : la case qui s'y trouve y reste (molette). */
function zoomerPlan(t, ancre) {
  const avant = etat.planTaille || tailleAfficheePlan();
  etat.zoomPlan = zoomBorne(t, PLAN_ZOOM_MIN, PLAN_ZOOM_MAX);
  let sous = null;
  if (ancre) {
    const cv = $('plan-donjon').getBoundingClientRect();
    sous = [(ancre.x - cv.left) / avant, (ancre.y - cv.top) / avant];
  }
  dessinerPlan();
  if (sous) {
    const apres = etat.planTaille, cv = $('plan-donjon').getBoundingClientRect();
    $('scene').scrollLeft += cv.left + sous[0] * apres - ancre.x;
    $('scene').scrollTop += cv.top + sous[1] * apres - ancre.y;
  }
}

/** Affiche (ou quitte) la vue Plan. Quitter ramène à la salle active. Sur téléphone, passe d'abord à l'onglet Carte. */
function ouvrirPlan(ouvert) {
  if (etat.plan === ouvert) return;
  etat.plan = ouvert;
  $('plan-bouton').setAttribute('aria-pressed', String(ouvert));
  document.body.classList.toggle('vue-plan', ouvert);
  $('support').hidden = ouvert;
  $('plan-donjon').hidden = !ouvert;
  $('plan-salles').hidden = !ouvert;
  $('zoom-reel').hidden = ouvert; // « Taille réelle » n'a pas de sens pour un plan entier
  etat.planSurvol = null;
  etat.signatureListePlan = '';
  if (ouvert) {
    palette.desarmer(); // un élément armé ne doit pas rester pendant qu'on regarde le plan
    ouvrirTiroir(false);
    if (etat.selection) { deselectionner(); ctx.bulle.maj(); }
    $('message-carte').hidden = true;
    etat.zoomPlan = null;
    onglets?.afficher('carte'); // téléphone : le plan est dans l'onglet Carte (sans effet sur ordinateur)
    dessinerPlan();
  } else {
    dessinerCarte(salle().plan);
    majCarteRef();
  }
}
$('plan-bouton').addEventListener('click', () => ouvrirPlan(!etat.plan));
$('plan-complet').addEventListener('click', () => ouvrirPlan(true));

/** Salle sous un événement souris ou toucher, d'après la disposition et le côté de case du dernier dessin. */
function salleDuPlan(e) {
  if (!etat.planDispo || !etat.planTaille) return null;
  const cv = $('plan-donjon').getBoundingClientRect();
  return salleSous(etat.planDispo, (e.clientX - cv.left) / etat.planTaille, (e.clientY - cv.top) / etat.planTaille);
}
$('plan-donjon').addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') survolerPlan(salleDuPlan(e)); });
$('plan-donjon').addEventListener('pointerleave', () => survolerPlan(null));
$('plan-donjon').addEventListener('click', (e) => {
  const id = salleDuPlan(e);
  if (id) activerSalle(id);
});

// --- Personnages : les fiches associées au donjon, tirage au hasard (js/mj/personnages-ui.js) ---
const personnages = creerPersonnages(ctx);

// --- Forme, sol et dimensions de la salle (js/mj/salle-forme.js) ---
const salleForme = creerSalleForme(ctx);

let minuterieMessage;
/** Retour d'une pose, posé sur la carte (hors du flux : rien ne bouge). */
function annoncerCarte(texte, erreur = false, duree = erreur ? 4500 : 2500) {
  const zone = $('message-carte');
  zone.hidden = false;
  zone.textContent = texte;
  zone.classList.toggle('erreur-pose', erreur);
  clearTimeout(minuterieMessage);
  minuterieMessage = setTimeout(() => { zone.hidden = true; }, duree);
}

/** Pose l'élément de la palette au point écran donné, si ce point est sur la carte visible. Renvoie vrai si posé. */
function poserSurCarte(item, clientX, clientY) {
  const scene = $('scene').getBoundingClientRect(), cv = $('carte').getBoundingClientRect();
  const dansScene = clientX >= scene.left && clientX <= scene.right && clientY >= scene.top && clientY <= scene.bottom;
  const dansCarte = clientX >= cv.left && clientX <= cv.right && clientY >= cv.top && clientY <= cv.bottom;
  if (!dansScene || !dansCarte) { annoncerCarte('Lâche l’élément sur la carte pour le poser.', true); return false; }
  const t = tailleAffichee(salle().plan);
  const res = ajouterElement(salle().plan, item, (clientX - cv.left) / t - MARGE, (clientY - cv.top) / t - MARGE);
  if (res.erreur) { annoncerCarte(res.erreur, true); return false; }
  modifierPlan(res.plan);
  annoncerCarte(res.message);
  return true;
}

// --- Palette : catalogue de vignettes (panneau sur ordinateur, tiroir sur téléphone) ------------------------
/** Tiroir du bas (téléphone) : ouvert par « + Ajouter », refermé tout seul quand un élément est armé. */
function ouvrirTiroir(ouvert) {
  $('palette').classList.toggle('tiroir-ouvert', ouvert);
  $('ajouter').setAttribute('aria-expanded', String(ouvert));
  if (ouvert) $('palette').querySelector('.palette-groupes [aria-pressed="true"]')?.focus({ preventScroll: true });
}
const tiroirOuvert = () => $('palette').classList.contains('tiroir-ouvert');
$('ajouter').addEventListener('click', () => ouvrirTiroir(!tiroirOuvert()));

const palette = creerPalette($('palette'), {
  elements: elementsPalette(),
  groupes: GROUPES_PALETTE,
  sousGroupes: SOUS_GROUPES,
  pastille: $('pose-pastille'),
  onFermer: () => { ouvrirTiroir(false); $('ajouter').focus(); },
  onArmer: (item) => {
    $('carte').classList.toggle('arme', !!item);
    if (item) {
      etat.selection = null; // la bulle se ferme : le prochain clic sur la carte pose
      ctx.bulle.maj();
      if (telephone()) ouvrirTiroir(false); // au doigt, le tiroir libère la carte une fois l'élément choisi
      annoncerCarte(`${item.libelle} : clique une case de la carte pour le poser. Échap pour arrêter.`);
    } else $('message-carte').hidden = true;
  },
  onDeposer: (item, x, y) => { poserSurCarte(item, x, y); },
  survol: (x, y) => {
    const cv = $('carte').getBoundingClientRect(), sc = $('scene').getBoundingClientRect();
    return x >= Math.max(cv.left, sc.left) && x <= Math.min(cv.right, sc.right) && y >= Math.max(cv.top, sc.top) && y <= Math.min(cv.bottom, sc.bottom);
  },
});

// --- Rail d'outils et panneau contextuel ---------------------------------------------------------------
// Portes, Mobilier et Créatures montrent le catalogue (le groupe suit l'outil) ; les autres outils, leur bloc du panneau.
// Cliquer l'outil actif replie le panneau : la scène grandit et l'observateur de taille réajuste la carte.
const TITRES_OUTILS = { salle: 'Salle', portes: 'Portes', mobilier: 'Mobilier', creatures: 'Créatures', personnages: 'Personnages', notes: 'Notes', plan: 'Plan du donjon', reglages: 'Réglages' };
const rail = creerRail($('rail'), {
  cle: 'carte-de-mj:outil',
  telephone,
  titres: TITRES_OUTILS,
  onChange: ({ outil }) => { if (OUTILS_CATALOGUE.includes(outil) && palette.groupe() !== outil) palette.afficherGroupe(outil); },
});
// Passage de l'ordinateur au téléphone (rotation, fenêtre redimensionnée) : le rail et le tiroir se remettent d'aplomb.
matchMedia(`(max-width: ${LARGEUR_TELEPHONE}px)`).addEventListener('change', () => { ouvrirTiroir(false); rail.appliquer(); });

// --- Menu du donjon (barre du haut) : donjons, fichiers, rapport (js/mj/menu-donjon.js) ---
ctx.menu = creerMenu(ctx);

// Échap, du plus proche au plus lointain : glisser en cours, menu ouvert, tiroir ouvert, élément armé, bulle ouverte.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  if (palette.annulerGlisser()) return;
  if (ctx.menu.ouvert()) { ctx.menu.fermer(); $('menu-donjon-bouton').focus(); return; }
  if (tiroirOuvert()) { ouvrirTiroir(false); $('ajouter').focus(); return; }
  if (palette.arme()) { palette.desarmer(); return; }
  if (etat.selection) { deselectionner(); rendre(); return; }
  if (etat.plan) { ouvrirPlan(false); $('plan-bouton').focus(); }
});

// --- Salles : onglets, liste, liaisons orphelines, miniature du plan (js/mj/salles-liste.js) ---
ctx.salles = creerSalles(ctx); // la bulle appelle majListe

// --- Micro --------------------------------------------------------------------
const messageMicro = $('message-micro');
const micro = creerMicro({
  onTexte: (texte) => { salle().texte = texte; $('description').value = texte; genererBientot(); },
  onEtat: (actif) => { $('micro').classList.toggle('actif', actif); $('micro').textContent = libelleMicro(actif); },
  onErreur: (msg) => { messageMicro.hidden = false; messageMicro.textContent = msg; },
});
if (!voixDisponible) {
  $('micro').disabled = true;
  messageMicro.hidden = false;
  messageMicro.textContent = 'La dictée vocale n’est pas disponible dans ce navigateur (Firefox, par exemple). La saisie au clavier marche partout.';
} else {
  $('micro').addEventListener('click', () => { messageMicro.hidden = true; micro.basculer($('description').value); });
}

// --- Réglages -----------------------------------------------------------------
$('echelle').value = r.echelle;
$('taille').value = r.taille;
$('taille-val').textContent = `${r.taille} px`;
$('grille').checked = r.grille;

$('echelle').addEventListener('change', (e) => {
  const v = parseFloat(e.target.value);
  if (v > 0) { r.echelle = v; generer(); }
});
$('taille').addEventListener('input', (e) => {
  r.taille = Number(e.target.value);
  if ($('calibrage').checked) r.calibre = true; // indicateur lu par la Présentation (échelle réelle par défaut), sans effet ici
  $('taille-val').textContent = `${r.taille} px`;
  rendre();
});
$('grille').addEventListener('change', (e) => { r.grille = e.target.checked; rendre(); });

// Calibrage : une carte bancaire mesure 85,6 × 53,98 mm ; une case visée = 25 mm.
function majCarteRef() {
  const ref = $('carte-ref');
  ref.hidden = !$('calibrage').checked;
  ref.style.width = `${(r.taille * 85.6) / 25}px`;
  ref.style.height = `${(r.taille * 53.98) / 25}px`;
}
$('calibrage').addEventListener('change', (e) => { $('aide-calibrage').hidden = !e.target.checked; rendre(); });

// --- Plein écran (vue table) --------------------------------------------------
$('plein-ecran').addEventListener('click', () => $('scene').requestFullscreen?.());
$('quitter-plein-ecran').addEventListener('click', () => document.exitFullscreen());
document.addEventListener('fullscreenchange', () => { $('quitter-plein-ecran').hidden = !document.fullscreenElement; });

// --- Écran étroit : onglets Texte / Carte ---------------------------------------------
// La carte est redessinée (à la taille qui tient) quand on l'affiche ; quand la fenêtre change de taille ou de sens,
// c'est l'observateur de la scène (plus haut) qui s'en charge.
const onglets = activerOnglets(document.querySelector('.onglets'), {
  defaut: 'texte',
  onChange: (nom) => { if (nom === 'carte' && $('scene').clientWidth) { dessinerCarte(salle().plan); majCarteRef(); } },
});

// --- Démarrage ----------------------------------------------------------------
afficherSalleActive();
if (charge.miseDeCote) { // dit après le premier dessin : le bandeau de la carte est prêt, et l'avertissement reste aussi dans le panneau des fichiers
  const phrase = stockage.phraseMiseDeCote(charge.miseDeCote);
  annoncerCarte(phrase, !charge.miseDeCote.ok, 15000);
  if (charge.miseDeCote.ok) ctx.menu.messageFichier(phrase); else ctx.menu.messageFichier('', [phrase]);
}
