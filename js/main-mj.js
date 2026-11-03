/**
 * Point d'entrée de la vue MJ (outil Donjon) : relie la saisie, le parseur, le rendu,
 * le modèle de donjon (donjon.js), la mini-carte, les réglages et la sauvegarde.
 *
 * Rappel : dans chaque salle, la description est la seule référence.
 * texte → analyser() → plan → carte et JSON. Aucune dépendance à un autre outil ni au réseau.
 */
import { analyser } from './parseur/index.js';
import { dessinerPlanDonjon } from './rendu/moteur.js';
import { disposerPlan, salleSous, cleDisposition } from './plan-donjon.js';
import {
  PLAN_ZOOM_MIN, PLAN_ZOOM_MAX, zoomBorne, tailleAfficheePlan as tailleDuPlan,
} from './mise-en-page.js';
import { creerHistorique } from './historique.js';
import { creerRail, OUTILS_CATALOGUE } from './rail.js';
import { creerMicro, voixDisponible } from './voix.js';
import * as stockage from './stockage.js';
import { decrire } from './parseur/decrire.js';
import * as modele from './donjon.js';
import { telephone, activerOnglets, LARGEUR_TELEPHONE } from './telephone.js';
import { creerPersonnages } from './mj/personnages-ui.js';
import { creerSalles } from './mj/salles-liste.js';
import { creerMenu } from './mj/menu-donjon.js';
import { creerSalleForme } from './mj/salle-forme.js';
import { creerBulle } from './mj/bulle.js';
import { creerVueCarte } from './mj/vue-carte.js';
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
ctx.plan = { ouvrir: ouvrirPlan, dessiner: dessinerPlan, taille: tailleAfficheePlan, majZoom: majZoomPlan, zoomer: zoomerPlan }; // le module de la vue Plan le remplacera

// --- Rendu --------------------------------------------------------------------
function rendre() {
  const s = salle();
  ctx.carte.oublierZoomSiAutreCarte();
  if (etat.plan) dessinerPlan(); // le plan est affiché : toute modification du donjon le redessine
  else ctx.carte.redessiner(s.plan);
  ctx.carte.majCarteRef();
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

// --- La carte de la salle : dessin, déplacement, pose, zoom, palette (js/mj/vue-carte.js) ---
ctx.carte = creerVueCarte(ctx);

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
ctx.bulle = creerBulle(ctx);

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
    ctx.carte.palette.desarmer(); // un élément armé ne doit pas rester pendant qu'on regarde le plan
    ctx.carte.ouvrirTiroir(false);
    if (etat.selection) { deselectionner(); ctx.bulle.maj(); }
    $('message-carte').hidden = true;
    etat.zoomPlan = null;
    onglets?.afficher('carte'); // téléphone : le plan est dans l'onglet Carte (sans effet sur ordinateur)
    dessinerPlan();
  } else {
    ctx.carte.redessiner(salle().plan);
    ctx.carte.majCarteRef();
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

// --- Rail d'outils et panneau contextuel ---------------------------------------------------------------
// Portes, Mobilier et Créatures montrent le catalogue (le groupe suit l'outil) ; les autres outils, leur bloc du panneau.
// Cliquer l'outil actif replie le panneau : la scène grandit et l'observateur de taille réajuste la carte.
const TITRES_OUTILS = { salle: 'Salle', portes: 'Portes', mobilier: 'Mobilier', creatures: 'Créatures', personnages: 'Personnages', notes: 'Notes', plan: 'Plan du donjon', reglages: 'Réglages' };
const rail = creerRail($('rail'), {
  cle: 'carte-de-mj:outil',
  telephone,
  titres: TITRES_OUTILS,
  onChange: ({ outil }) => { if (OUTILS_CATALOGUE.includes(outil) && ctx.carte.palette.groupe() !== outil) ctx.carte.palette.afficherGroupe(outil); },
});
// Passage de l'ordinateur au téléphone (rotation, fenêtre redimensionnée) : le rail et le tiroir se remettent d'aplomb.
matchMedia(`(max-width: ${LARGEUR_TELEPHONE}px)`).addEventListener('change', () => { ctx.carte.ouvrirTiroir(false); rail.appliquer(); });

// --- Menu du donjon (barre du haut) : donjons, fichiers, rapport (js/mj/menu-donjon.js) ---
ctx.menu = creerMenu(ctx);

// Échap, du plus proche au plus lointain : glisser en cours, menu ouvert, tiroir ouvert, élément armé, bulle ouverte.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  if (ctx.carte.palette.annulerGlisser()) return;
  if (ctx.menu.ouvert()) { ctx.menu.fermer(); $('menu-donjon-bouton').focus(); return; }
  if (ctx.carte.tiroirOuvert()) { ctx.carte.ouvrirTiroir(false); $('ajouter').focus(); return; }
  if (ctx.carte.palette.arme()) { ctx.carte.palette.desarmer(); return; }
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
  onChange: (nom) => { if (nom === 'carte' && $('scene').clientWidth) { ctx.carte.redessiner(salle().plan); ctx.carte.majCarteRef(); } },
});

// --- Démarrage ----------------------------------------------------------------
afficherSalleActive();
if (charge.miseDeCote) { // dit après le premier dessin : le bandeau de la carte est prêt, et l'avertissement reste aussi dans le panneau des fichiers
  const phrase = stockage.phraseMiseDeCote(charge.miseDeCote);
  annoncerCarte(phrase, !charge.miseDeCote.ok, 15000);
  if (charge.miseDeCote.ok) ctx.menu.messageFichier(phrase); else ctx.menu.messageFichier('', [phrase]);
}
