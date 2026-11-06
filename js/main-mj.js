/**
 * Point d'entrée de la vue MJ (outil Donjon) : racine de composition. Elle garde l'état (`etat`), l'historique d'annulation, le
 * rendu (`rendre`), la navigation entre salles, la saisie de la description, les notes, les réglages, le micro
 * et le démarrage ; le reste est dans les modules de js/mj/, des fabriques `creerX(ctx)` qui ne s'importent pas entre elles :
 * personnages-ui, salles-liste, menu-donjon, salle-forme, bulle, vue-carte, vue-plan et zoom. L'interface est l'atelier
 * (js/atelier/ : arbre, scène sous sa barre d'outils, inspecteur) ; js/atelier/inscrire-donjon.js y branche le Donjon.
 *
 * Rappel : dans chaque salle, la description est la seule référence.
 * texte → analyser() → plan → carte et JSON. Aucune dépendance à un autre outil ni au réseau.
 */
import { analyser } from './parseur/index.js';
import { disposerPlan, cleDisposition } from './plan-donjon.js';
import { creerHistorique } from './historique.js';
import { creerMicro, voixDisponible } from './voix.js';
import * as stockage from './stockage.js';
import { decrire } from './parseur/decrire.js';
import * as modele from './donjon.js';
import { telephone, LARGEUR_TELEPHONE } from './telephone.js';
import { creerPersonnages } from './mj/personnages-ui.js';
import { creerSalles } from './mj/salles-liste.js';
import { creerMenu } from './mj/menu-donjon.js';
import { creerSalleForme } from './mj/salle-forme.js';
import { creerBulle } from './mj/bulle.js';
import { creerZoom } from './mj/zoom.js';
import { creerVueCarte } from './mj/vue-carte.js';
import { creerVuePlan } from './mj/vue-plan.js';
import { creerUniversUI } from './mj/univers-ui.js';
import { creerCoquille } from './atelier/coquille.js';
import { inscrireDonjon } from './atelier/inscrire-donjon.js';
import { inscrireMonde } from './atelier/inscrire-monde.js';
import { inscrireImport } from './atelier/importer.js';
import { lireRoute } from './atelier-route.js';
import { $, h } from './dom.js';
import { icone } from './icones.js';

// L'adresse d'ouverture, lue avant que l'écran Monde ne réécrive la sienne (il ouvre sur le lieu de départ) : F5 retrouve le même nœud.
const routeInitiale = lireRoute(location.hash);

// Icônes SVG communes (js/icones.js) : chaque <span data-icone="nom"> du HTML statique est remplacé par l'icône.
for (const marque of document.querySelectorAll('[data-icone]')) marque.replaceWith(icone(marque.dataset.icone));

const EXEMPLES = [
  modele.TEXTE_EXEMPLE_INITIAL, // aussi la description du donjon provisoire (donjonVierge, js/donjon.js)
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
  clePlan: '',       // donjon du plan affiché : quand il change, le zoom du plan est oublié
};
const r = etat.reglages;
// Ce qui est enregistré au chargement, pas une copie de `r` : des réglages repris de l'ancienne clé restent à écrire.
let reglagesLus = stockage.chargerReglages();

const donjon = () => etat.donjons[etat.actif];
const salle = () => donjon().salles[donjon().salleActive];

// --- Historique : propre à chaque salle (voir historique.js) --------------------
// La pile d'une salle est vidée quand le MJ reprend la main sur son texte en tapant (effacer et exemples, eux, s'annulent).
const historique = creerHistorique();
const pile = (idSalle = donjon().salleActive) => historique.pile(donjon().id, idSalle);
// `liaisons` : liaisons retirées par la modification (suppression d'une porte reliée), rétablies si on annule.
function memoriser(idSalle = donjon().salleActive, liaisons = []) {
  historique.memoriser(donjon().id, idSalle, { texte: donjon().salles[idSalle].texte, ancres: modele.ancresDeSalle(donjon(), idSalle), liaisons });
}

// Contexte des modules mj/ : ils le lisent au moment de l'appel (jamais pendant leur création) et ne s'importent pas entre eux.
// Ici ce que le tronc fournit ; les fonctions sont déclarées plus bas dans ce fichier. Chaque module qu'un autre appelle s'ajoute à
// `ctx` sous son nom en le créant : `ctx.carte`, `ctx.bulle`, `ctx.zoom`, `ctx.plan`, `ctx.salles`, `ctx.menu`, puis `ctx.coquille` et `ctx.barre` (l'atelier).
const ctx = { etat, donjon, salle, rendre, modifierPlan, annoncerCarte, deselectionner, sauvegarder, historique, activerSalle, afficherSalleActive, dispositionDuDonjon };

// --- Rendu --------------------------------------------------------------------
function rendre() {
  const s = salle();
  ctx.carte.oublierZoomSiAutreCarte();
  if (etat.plan) ctx.plan.dessiner(); // le plan est affiché : toute modification du donjon le redessine
  else ctx.carte.redessiner(s.plan);
  $('annuler').hidden = $('annuler-carte').hidden = pile().length === 0;
  if (document.activeElement !== $('json')) $('json').value = JSON.stringify(s.plan, null, 2);
  ctx.bulle.maj();
  ctx.salles.majOrphelines();
  ctx.salles.majMiniCarte();
  majTitreSalle();
  majAide();
  salleForme.majForme();
  personnages.maj();
  sauvegarder();
  ctx.cartouche?.maj(); // la taille de la salle et l'échelle
  ctx.coquille?.rafraichir(); // l'arbre de l'atelier suit les noms (salles, donjons) ; il ne se redessine que s'ils ont changé
}

/** Nom de la salle affichée, avec son niveau dès que le donjon en a plusieurs (des escaliers relient ses salles). */
function majTitreSalle() {
  const niv = modele.niveaux(donjon());
  const plusieurs = new Set(Object.values(niv)).size > 1;
  $('nom-salle-active').textContent = `· ${salle().nom}${plusieurs ? ` · ${modele.nomNiveau(niv[salle().id])}` : ''}`;
}

function sauvegarder() {
  stockage.sauverDonjons(etat);
  // Seulement ce qui a changé ici : un onglet resté ouvert n'écrase pas ce que la régie a réglé entre-temps (calibrage, rotation de la table…).
  if (stockage.enregistrerReglages(reglagesLus, r).ok) reglagesLus = { ...r };
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
 * L'inspecteur revient en haut ; une salle qui vient d'être créée donne le focus à sa description (sauf au doigt,
 * pour ne pas faire surgir le clavier, et sauf si le focus doit rester sur la mini-carte).
 */
function afficherSalleActive({ sansArbre = false } = {}) {
  const garderMini = $('minicarte').contains(document.activeElement); // le focus reste sur la miniature, si c'est là qu'il était
  clearTimeout(minuterie);
  deselectionner();
  $('description').value = salle().texte;
  $('notes').value = salle().notes;
  majTitreSalle();
  ctx.menu.majDonjons();
  ctx.salles.majListe();
  generer();
  ctx.coquille?.inspecteur.element.scrollTo?.({ top: 0 }); // l'inspecteur revient en haut
  ctx.menu.fermer();
  if (!sansArbre && !ctx.univers?.ouvert()) ctx.coquille?.positionner(etat.plan ? { donjon: etat.actif } : { donjon: etat.actif, salle: donjon().salleActive }); // l'arbre et l'adresse suivent la salle (ou la vue d'ensemble)
  const nouvelle = etat.neuves.delete(salle().id);
  if (nouvelle && !garderMini && !matchMedia('(pointer: coarse)').matches) $('description').focus({ preventScroll: true });
}

function activerSalle(id) {
  if (!(id in donjon().salles)) return;
  if (etat.plan) ctx.plan.ouvrir(false); // ouvrir une salle (onglet, liste, plan) quitte la vue Plan
  donjon().salleActive = id;
  afficherSalleActive();
}

// --- Saisie -------------------------------------------------------------------
$('description').addEventListener('input', (e) => { pile().length = 0; salle().texte = e.target.value; genererBientot(); });
// Effacer et les exemples remplacent tout le texte : on le mémorise d'abord, « Annuler » le rend.
function remplacerTexte(texte) {
  if (salle().texte === texte) return;
  memoriser();
  changerTexte(texte);
}
$('effacer').addEventListener('click', () => { remplacerTexte(''); $('description').focus(); });

$('exemples').replaceChildren(...EXEMPLES.map((ex) => {
  const a = h('a', { textContent: ex, tabIndex: 0 });
  const choisir = () => remplacerTexte(ex);
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

// --- Zoom de la scène : boutons et molette, pour la carte ou le plan (js/mj/zoom.js) ---
ctx.zoom = creerZoom(ctx);

// --- Vue Plan : tout le donjon d'un coup (js/mj/vue-plan.js) ---
ctx.plan = creerVuePlan(ctx);

/** Le calcul essaie plusieurs dispositions : on ne le refait que si les salles, leurs portes ou les liaisons ont changé. */
function dispositionDuDonjon(d) {
  const cle = cleDisposition(d);
  if (cle !== etat.cleDisposition) { etat.cleDisposition = cle; etat.planDispo = disposerPlan(d); }
  return etat.planDispo;
}

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

// Passage de l'ordinateur au téléphone (rotation, fenêtre redimensionnée) : le catalogue (colonne ou tiroir) se referme.
matchMedia(`(max-width: ${LARGEUR_TELEPHONE}px)`).addEventListener('change', () => ctx.carte.ouvrirTiroir(false));

// --- Donjons neufs, fichiers, copies mises de côté : la feuille « Ajouter un donjon » (js/mj/menu-donjon.js) ---
ctx.menu = creerMenu(ctx);

// Échap, du plus proche au plus lointain : glisser en cours, feuille ouverte, élément armé (ordinateur), catalogue ouvert, élément sélectionné.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  if (ctx.carte.palette.annulerGlisser() || salleForme.annulerGlisserBord()) return;
  if (ctx.menu.ouvert()) { ctx.menu.fermer(); return; }
  if (!telephone() && ctx.carte.palette.arme()) { ctx.carte.palette.desarmer(); return; } // le catalogue reste ouvert à côté de la carte
  if (ctx.carte.tiroirOuvert()) { ctx.carte.ouvrirTiroir(false); ctx.barre.focusCatalogue(); return; }
  if (ctx.carte.palette.arme()) { ctx.carte.palette.desarmer(); return; }
  if (etat.selection) { deselectionner(); rendre(); return; }
  if (etat.plan) { ctx.plan.ouvrir(false); $('plan-bouton').focus(); }
});

// --- Salles : nom, liaisons orphelines, miniature du plan, suppression (js/mj/salles-liste.js) ---
ctx.salles = creerSalles(ctx); // la bulle appelle majListe

// --- Micro --------------------------------------------------------------------
const messageMicro = $('message-micro');
const micro = creerMicro({
  onTexte: (texte) => { salle().texte = texte; $('description').value = texte; genererBientot(); },
  onEtat: (actif) => {
    $('micro').classList.toggle('actif', actif);
    $('micro').setAttribute('aria-pressed', String(actif));
    $('micro').replaceChildren(icone(actif ? 'stop' : 'micro'), actif ? 'Arrêter' : 'Dicter');
  },
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

$('echelle').addEventListener('change', (e) => {
  const v = parseFloat(e.target.value);
  if (v > 0) { r.echelle = v; generer(); }
});

// --- Plein écran (vue table) --------------------------------------------------
$('plein-ecran').addEventListener('click', () => $('scene').requestFullscreen?.());
$('quitter-plein-ecran').addEventListener('click', () => document.exitFullscreen());
document.addEventListener('fullscreenchange', () => { $('quitter-plein-ecran').hidden = !document.fullscreenElement; });

// --- Univers : cartes imbriquées, préparation (js/mj/univers-ui.js) ---
ctx.univers = creerUniversUI(ctx);

// --- Atelier : arbre unifié, sélection commune, inspecteur, adresse (js/atelier/coquille.js) ---
// Les lots Donjon et Monde y inscrivent leurs inspecteurs, leur barre d'outils et leurs actions (inscrire-donjon.js, inscrire-monde.js).
/** Où va la scène quand l'arbre ou l'adresse changent : le Monde (écran #univers) ou une salle du Donjon. */
function allerALaRoute(route) {
  if (route.page === 'monde') {
    ctx.univers.ouvrir({ id: route.monde ?? null, lieu: route.lieu ?? null }); // sans lieu : celui de départ
    return;
  }
  const etaitMonde = ctx.univers.ouvert();
  if (etaitMonde) ctx.univers.fermer({ rendreFocus: false });
  const d = etat.donjons[route.donjon];
  if (!d) return;
  const dejaLa = !etaitMonde && !etat.plan && etat.actif === d.id && (!route.salle || d.salleActive === route.salle); // rien à redessiner
  if (!dejaLa) {
    etat.actif = d.id;
    if (route.salle && route.salle in d.salles) ctx.activerSalle(route.salle); else ctx.afficherSalleActive();
  }
  if (!route.salle) { // le nœud donjon de l'arbre : la vue d'ensemble, pas sa salle active
    ctx.coquille.positionner({ donjon: d.id });
    if (!etat.plan) ctx.plan.ouvrir(true);
  }
}
ctx.coquille = creerCoquille({
  racine: $('atelier'), mode: 'preparer', scene: $('cadre-scene'), bouton: $('arbre-bouton'),
  donnees: () => ({
    univers: ctx.univers.donnees().univers, mondeActif: ctx.univers.donnees().actif,
    donjons: etat.donjons, donjonActif: { donjon: etat.actif, salle: donjon().salleActive },
  }),
  surNavigation: allerALaRoute,
  // L'affichage (grille, thème, détails, relief, pénombre, flammes, repères), préférence commune aux salles et aux cartes : un bouton dans la barre (js/atelier/affichage-popover.js).
  affichage: { lire: () => r, surChangement: () => { rendre(); ctx.univers.redessinerGrille(); } },
});
ctx.univers.surChangement(() => {
  if (!ctx.univers.ouvert()) { ctx.coquille.rafraichir(); return; }
  const { actif, univers } = ctx.univers.donnees();
  const pos = ctx.coquille.position();
  // Le nœud « monde » est choisi : la scène montre son lieu de départ, mais la position (et l'inspecteur du monde) restent au monde.
  if (pos.monde === actif && !pos.lieu && !pos.donjon && ctx.univers.lieu() === (univers[actif]?.racine ?? ctx.univers.lieu())) { ctx.coquille.rafraichir(); return; }
  ctx.coquille.positionner({ monde: actif, lieu: ctx.univers.lieu() });
});
inscrireDonjon(ctx.coquille, ctx);
inscrireMonde(ctx.coquille, ctx);
inscrireImport(ctx.coquille, ctx);

// --- Démarrage ----------------------------------------------------------------
afficherSalleActive({ sansArbre: true }); // l'arbre n'y passe pas : `naviguer` pose la vraie position (une étape de plus dépliait des plis du MJ)
ctx.coquille.naviguer(routeInitiale); // F5 retrouve le même nœud ; une adresse périmée retombe sur le donjon actif
if (charge.miseDeCote) { // dit après le premier dessin : le bandeau de la carte est prêt, et l'avertissement reste aussi dans la feuille « Ajouter un donjon »
  const phrase = stockage.phraseMiseDeCote(charge.miseDeCote);
  annoncerCarte(phrase, !charge.miseDeCote.ok, 15000);
  if (charge.miseDeCote.ok) ctx.menu.messageFichier(phrase); else ctx.menu.messageFichier('', [phrase]);
}
requestAnimationFrame(() => document.documentElement.classList.add('pret')); // l'atelier est dessiné : le point de chargement (donjon.html) disparaît
