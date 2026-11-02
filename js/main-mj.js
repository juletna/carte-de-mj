/**
 * Point d'entrée de la vue MJ (outil Donjon) : relie la saisie, le parseur, le rendu,
 * le modèle de donjon (donjon.js), la mini-carte, les réglages et la sauvegarde.
 *
 * Rappel : dans chaque salle, la description est la seule référence.
 * texte → analyser() → plan → carte et JSON. Aucune dépendance à un autre outil ni au réseau.
 */
import { analyser } from './parseur/index.js';
import { validerPlan } from './schema.js';
import { dessiner } from './rendu/moteur.js';
import { creerMicro, voixDisponible } from './voix.js';
import * as stockage from './stockage.js';
import { rapport } from './rapport.js';
import { activerDeplacement } from './deplacement.js';
import { decrire } from './parseur/decrire.js';
import { nomCase, lettreColonne } from './parseur/coordonnees.js';
import { nomAffiche } from './parseur/lexique.js';
import * as modele from './donjon.js';
import { dessinerMiniCarte } from './minicarte.js';

const $ = (id) => document.getElementById(id);

/** Crée un élément ; tout texte passe par textContent (jamais de HTML venu d'un fichier). */
function h(tag, props = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [cle, valeur] of Object.entries(props)) {
    if (cle.startsWith('aria-')) e.setAttribute(cle, valeur);
    else e[cle] = valeur;
  }
  e.append(...enfants);
  return e;
}

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
// `jdr-carte:v1` est migrée au premier démarrage, sans être supprimée.
const charge = stockage.chargerTout({ texteInitial: EXEMPLES[0] });
const etat = {
  donjons: charge.donjons,
  actif: charge.actif,
  reglages: charge.reglages,
  selection: null,   // descripteur { genre, mur, position } ou { genre, type, x, y } : jamais un id du plan (ils changent à chaque relecture)
  message: '',       // retour d'une action sur la sélection
  retour: { compris: [], ignores: [] }, // dernier « compris / non compris », pour le rapport
  focusMini: null,   // salle à qui rendre le focus clavier après un redessin de la mini-carte
  neuves: new Set(), // salles créées et pas encore affichées : la première fois, le focus va à la description
};
const r = etat.reglages;

const donjon = () => etat.donjons[etat.actif];
const salle = () => donjon().salles[donjon().salleActive];

// --- Historique : propre à chaque salle ----------------------------------------
// Chaque salle a sa pile d'anciennes descriptions (en mémoire, le temps de la session).
// Une entrée garde aussi la position des portes reliées de la salle, pour qu'annuler le
// déplacement d'une porte reliée ramène sa liaison avec elle. La pile d'une salle est vidée
// quand le MJ reprend la main sur son texte (frappe, exemple, effacer), ou quand la salle
// est supprimée ; changer de salle ne la perd pas, et ne peut jamais effacer un texte :
// annuler ne fait que remettre une description que cette salle avait vraiment.
const historiques = new Map();
const clePile = (idSalle) => `${donjon().id}/${idSalle}`;
function pile(idSalle = donjon().salleActive) {
  const cle = clePile(idSalle);
  if (!historiques.has(cle)) historiques.set(cle, []);
  return historiques.get(cle);
}
function memoriser(idSalle = donjon().salleActive) {
  const p = pile(idSalle);
  p.push({ texte: donjon().salles[idSalle].texte, ancres: modele.ancresDeSalle(donjon(), idSalle) });
  if (p.length > 100) p.shift();
}

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
const optionsDessin = (plan) => ({ taille: r.taille, grille: r.grille, marques: marques(plan) });

function rendre() {
  const s = salle();
  dessiner($('carte'), s.plan, optionsDessin(s.plan));
  majCarteRef();
  $('annuler').hidden = pile().length === 0;
  if (document.activeElement !== $('json')) $('json').value = JSON.stringify(s.plan, null, 2);
  majSelection();
  majOrphelines();
  majMiniCarte();
  majAide();
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

// Mise à jour pendant la frappe, avec un court délai pour rester fluide.
let minuterie;
function genererBientot() {
  clearTimeout(minuterie);
  minuterie = setTimeout(generer, 200);
}

// --- Aide de première utilisation ---------------------------------------------------
// Pas de texte en plus : le sous-titre et la note de « Salles » changent de contenu tant qu'ils servent.
// Débutant = aucun donjon n'a encore plus d'une salle ni de liaison ; dès qu'on relie, l'aide s'efface.
const SOUS_TITRE = 'Décris la pièce, la carte suit.';
const NOTE_SALLES = 'Clique une porte sur la carte pour la relier à une autre salle.';
const estDebutant = () => Object.values(etat.donjons).every((d) => d.liaisons.length === 0 && Object.keys(d.salles).length < 2);

function majAide() {
  $('aide-debut').textContent = estDebutant() ? 'Décris une porte, puis clique dessus pour créer la salle suivante.' : SOUS_TITRE;
  $('aide-salles').textContent = salle().plan.portes.length
    ? NOTE_SALLES
    : 'Cette salle n’a aucune porte : écris-en une dans la description (« une porte au nord »), puis clique dessus sur la carte.';
}

/** Défilement doux, sans animation si l'utilisateur la réduit. */
const comportementDefilement = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
const telephone = () => matchMedia('(max-width: 760px)').matches;

/**
 * Affiche la salle active : description, notes, listes. À appeler après tout changement de salle ou de donjon.
 * Le panneau revient en haut ; une salle qui vient d'être créée donne le focus à sa description (sauf au doigt,
 * pour ne pas faire surgir le clavier, et sauf si le focus doit rester sur la mini-carte).
 */
function afficherSalleActive() {
  const garderMini = etat.focusMini; // le redessin de la mini-carte l'efface pendant generer()
  clearTimeout(minuterie);
  etat.selection = null;
  etat.message = '';
  $('description').value = salle().texte;
  $('notes').value = salle().notes;
  $('nom-salle-active').textContent = `· ${salle().nom}`;
  majDonjons();
  majListe();
  generer();
  $('panneau').scrollTo({ top: 0 });
  const nouvelle = etat.neuves.delete(salle().id);
  if (nouvelle && !garderMini && !matchMedia('(pointer: coarse)').matches) $('description').focus({ preventScroll: true });
}

function activerSalle(id) {
  if (!(id in donjon().salles)) return;
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

if (estDebutant()) document.querySelector('details.exemples').open = true; // première utilisation seulement

// --- Notes ---------------------------------------------------------------------
let minuterieNotes;
$('notes').addEventListener('input', (e) => {
  salle().notes = e.target.value;
  clearTimeout(minuterieNotes);
  minuterieNotes = setTimeout(sauvegarder, 300);
});

// --- Carte : déplacer, cliquer --------------------------------------------------
// Un élément déplacé réécrit la description, qui régénère la carte et le JSON.
// Un appui sans glissement sélectionne l'élément.
activerDeplacement($('carte'), {
  plan: () => salle().plan,
  taille: () => r.taille,
  apercu: (plan) => dessiner($('carte'), plan, optionsDessin(plan)),
  deposer: (nouveau) => {
    const s = salle();
    const deplace = modele.elementDeplace(s.plan, nouveau);
    memoriser();
    modele.suivrePortesDeplacees(donjon(), s.id, s.plan, nouveau); // la liaison d'une porte déplacée la suit
    if (deplace && modele.memeDescripteur(etat.selection, deplace.avant)) etat.selection = deplace.apres;
    changerTexte(decrire(nouveau));
  },
  cliquer: (touche) => {
    etat.selection = touche ? modele.descripteur(touche.genre, touche.element) : null;
    etat.message = '';
    rendre();
    // Les actions de la sélection sont plus bas dans le panneau : on les amène en vue, sans toucher à ce qui est saisi.
    // (Sous 760 px le panneau est au-dessus de la carte : on ne fait pas remonter la page.)
    if (touche && !telephone()) $('selection').scrollIntoView({ block: 'nearest', behavior: comportementDefilement() });
  },
});

$('annuler').addEventListener('click', () => {
  const entree = pile().pop();
  if (!entree) return;
  modele.restaurerAncres(donjon(), entree.ancres);
  changerTexte(entree.texte);
});

// --- Section « sélection » ---------------------------------------------------------
const reperePorte = (p) => (p.mur === 'nord' || p.mur === 'sud' ? lettreColonne(p.position) : String(p.position + 1));

function libelleSelection(trouve) {
  const e = trouve.element;
  if (trouve.genre === 'porte') return `${e.type} · mur ${e.mur}, repère ${reperePorte(e)}`;
  if (trouve.genre === 'creature') return `${nomAffiche(e.type)} ${e.numero} · ${nomCase(e.x, e.y)}`;
  return `${nomAffiche(e.type)} · ${nomCase(e.x, e.y)}`;
}

function majSelection() {
  const zone = $('selection');
  const s = salle(), d = donjon();
  const trouve = modele.retrouverElement(s.plan, etat.selection);
  if (!trouve) {
    etat.selection = null;
    zone.hidden = true;
    zone.replaceChildren();
    return;
  }
  zone.hidden = false;
  const el = trouve.element;
  const contenu = [h('h2', { textContent: 'Sélection' }), h('p', { className: 'selection-titre', textContent: libelleSelection(trouve) })];

  const bouton = (texte, onClick, classe = '') => {
    const b = h('button', { type: 'button', textContent: texte, className: classe });
    b.addEventListener('click', onClick);
    return b;
  };

  contenu.push(h('div', { className: 'actions' }, bouton(el.cache === true ? 'Rendre visible' : 'Marquer comme caché', () => {
    const nouveau = modele.basculerCache(s.plan, etat.selection);
    if (!nouveau) return;
    memoriser();
    changerTexte(decrire(nouveau));
  }, 'discret')));
  if (el.cache === true) contenu.push(h('p', { className: 'note', textContent: 'Caché aux joueurs. Tu le vois ici, en translucide avec un contour en pointillés.' }));

  if (trouve.genre === 'porte') {
    const lien = modele.liaisonDePorte(d, s.id, el);
    if (lien) {
      const autre = d.salles[lien.autre.salle];
      contenu.push(h('p', {}, 'Reliée à ', h('strong', { textContent: autre.nom }), '.'));
      if (modele.liaisonsOrphelines(d).some((o) => o.liaison === lien.liaison && o.cote !== lien.cote)) {
        contenu.push(h('p', { className: 'note erreur', textContent: 'La porte de retour a disparu dans cette salle : la liaison est orpheline là-bas.' }));
      }
      contenu.push(h('div', { className: 'actions' },
        bouton(`Aller à la salle « ${autre.nom} »`, () => activerSalle(autre.id)),
        bouton('Délier', () => { modele.delier(d, lien.liaison.id); etat.message = 'Liaison retirée.'; rendre(); }, 'discret')));
    } else {
      const depuis = { salle: s.id, mur: el.mur, position: el.position };
      contenu.push(h('div', { className: 'actions' }, bouton('Nouvelle salle derrière cette porte', () => {
        try {
          const { salle: nouvelle } = modele.creerSalleDerriere(d, { depuis, echelle: r.echelle });
          etat.neuves.add(nouvelle.id);
          etat.message = `Salle « ${nouvelle.nom} » créée derrière cette porte (6 × 6 cases). Tu restes ici.`;
          majListe();
        } catch (err) { etat.message = err.message; }
        rendre();
      })));
      const autres = modele.listerSalles(d).filter((x) => x.id !== s.id);
      const choix = h('select', { id: 'relier-choix', disabled: autres.length === 0, 'aria-label': 'Salle à relier' },
        ...autres.map((x) => h('option', { value: x.id, textContent: x.nom })));
      const relier = bouton('Relier à une salle existante', () => {
        const cible = d.salles[choix.value];
        if (!cible) return;
        const ancres = modele.ancresDeSalle(d, cible.id);
        const texteAvant = cible.texte;
        try {
          modele.relierASalle(d, depuis, cible.id, { echelle: r.echelle });
          pile(cible.id).push({ texte: texteAvant, ancres }); // annulable depuis la salle d'arrivée
          etat.message = `Reliée à « ${cible.nom} » : une porte a été ajoutée sur son mur ${modele.OPPOSE[el.mur]}.`;
        } catch (err) { etat.message = err.message; }
        rendre();
      });
      relier.disabled = autres.length === 0;
      contenu.push(h('div', { className: 'ligne-relier' }, choix, relier));
      if (autres.length === 0) contenu.push(h('p', { className: 'note', textContent: 'Ajoute d’abord une autre salle pour pouvoir y relier cette porte.' }));
    }
  }
  if (etat.message) contenu.push(h('p', { className: 'note', textContent: etat.message }));
  zone.replaceChildren(...contenu);
}

// --- Liaisons orphelines --------------------------------------------------------
function majOrphelines() {
  const zone = $('orphelines');
  const d = donjon(), s = salle();
  const orphelines = modele.liaisonsOrphelines(d).filter((o) => o.salle === s.id);
  zone.hidden = orphelines.length === 0;
  zone.replaceChildren(...orphelines.map((o) => {
    const autreExt = o.liaison[o.cote === 'a' ? 'b' : 'a'];
    const autre = d.salles[autreExt.salle];
    const b = h('button', { type: 'button', className: 'discret', textContent: 'Retirer la liaison' });
    b.addEventListener('click', () => { modele.delier(d, o.liaison.id); rendre(); });
    return h('div', { className: 'orpheline' },
      h('p', { className: 'note erreur' },
        `Liaison orpheline : il n’y a plus de porte au mur ${o.mur} (repère ${o.mur === 'nord' || o.mur === 'sud' ? lettreColonne(o.position) : o.position + 1}), `
        + 'qui menait à « ', h('strong', { textContent: autre?.nom ?? '?' }), ' ». Rétablis la porte dans le texte, ou retire la liaison.'),
      b);
  }));
}

// --- Liste des salles et mini-carte ----------------------------------------------
/**
 * Bouton qui demande confirmation au second clic, dans les 4 secondes.
 * `annonce` (facultatif) : { zone, texte() } affiche, dans une zone à part, ce qui va être supprimé.
 * Le bouton garde sa largeur (rien ne bouge autour) ; la zone, placée après les autres actions, ne les déplace pas.
 */
function deuxTemps(bouton, libelle, confirmation, action, annonce) {
  let attente;
  const reinitialiser = () => {
    clearTimeout(attente);
    bouton.dataset.confirme = '';
    bouton.textContent = libelle;
    bouton.classList.remove('danger');
    bouton.style.minWidth = '';
    if (annonce) { annonce.zone.hidden = true; annonce.zone.textContent = ''; }
  };
  reinitialiser();
  bouton.addEventListener('click', () => {
    if (bouton.dataset.confirme === '1') { reinitialiser(); action(); return; }
    bouton.dataset.confirme = '1';
    if (annonce) bouton.style.minWidth = `${bouton.offsetWidth}px`;
    bouton.textContent = confirmation;
    bouton.classList.add('danger');
    if (annonce) { annonce.zone.textContent = annonce.texte(); annonce.zone.hidden = false; }
    attente = setTimeout(reinitialiser, 4000);
  });
  bouton.addEventListener('blur', reinitialiser);
}

function majListe() {
  const d = donjon();
  $('salles-liste').replaceChildren(...modele.listerSalles(d).map((s) => {
    const actif = s.id === d.salleActive;
    const nom = h('input', { type: 'text', value: s.nom, maxLength: 80, spellcheck: false, 'aria-label': `Nom de la salle ${s.nom}` });
    nom.addEventListener('change', () => {
      modele.renommerSalle(d, s.id, nom.value);
      nom.value = s.nom;
      if (actif) $('nom-salle-active').textContent = `· ${s.nom}`;
      rendre();
    });
    const aller = h('button', { type: 'button', className: 'discret', textContent: actif ? 'Affichée' : 'Afficher', disabled: actif });
    aller.addEventListener('click', () => activerSalle(s.id));
    const suppr = h('button', { type: 'button', className: 'discret' });
    deuxTemps(suppr, 'Supprimer', 'Confirmer ?', () => {
      const etaitActive = actif;
      modele.supprimerSalle(d, s.id, { echelle: r.echelle });
      historiques.delete(clePile(s.id));
      if (etaitActive) afficherSalleActive();
      else { majListe(); rendre(); }
    });
    suppr.title = 'Supprime la salle et ses liaisons';
    return h('li', { className: actif ? 'actif' : '' }, nom, aller, suppr);
  }));
}

function majMiniCarte() {
  const d = donjon();
  const focus = etat.focusMini;
  etat.focusMini = null;
  dessinerMiniCarte($('minicarte'), d, {
    actif: d.salleActive,
    focus: focus || undefined,
    onChoisir: (id) => { etat.focusMini = id; activerSalle(id); },
  });
}

$('salle-ajouter').addEventListener('click', () => {
  const d = donjon();
  etat.neuves.add(modele.ajouterSalle(d, { echelle: r.echelle }).id);
  etat.message = '';
  majListe();
  rendre();
  const champ = $('salles-liste').querySelector('li:last-child input');
  champ?.focus();
  champ?.select();
});

// --- Donjons : changer, nouveau, renommer, supprimer ------------------------------
function majDonjons() {
  const choix = $('donjon-choix');
  choix.replaceChildren(...Object.values(etat.donjons).map((d) => h('option', { value: d.id, textContent: d.nom, selected: d.id === etat.actif })));
  choix.value = etat.actif;
  $('donjon-nom').value = donjon().nom;
}

$('donjon-choix').addEventListener('change', (e) => {
  if (!(e.target.value in etat.donjons)) return;
  etat.actif = e.target.value;
  afficherSalleActive();
});
$('donjon-nom').addEventListener('change', (e) => {
  donjon().nom = e.target.value.trim().slice(0, 80) || donjon().nom;
  majDonjons();
  sauvegarder();
});
$('donjon-nouveau').addEventListener('click', () => {
  const d = modele.creerDonjon({ nom: `Donjon ${Object.keys(etat.donjons).length + 1}`, echelle: r.echelle });
  etat.donjons[d.id] = d;
  etat.actif = d.id;
  etat.neuves.add(d.salleActive);
  afficherSalleActive();
});
/** Ce que la confirmation annonce : le nom, le nombre de salles, et le sort d'une partie en cours. */
function annonceSuppressionDonjon() {
  const d = donjon();
  const n = Object.keys(d.salles).length;
  const partie = d.id in stockage.chargerPresentations();
  return `Supprimer « ${d.nom} » et ${n > 1 ? `ses ${n} salles` : 'sa salle'} ? Clique sur Confirmer dans les 4 secondes.`
    + (partie ? ' La partie en cours reste disponible dans la Présentation.' : '');
}
deuxTemps($('donjon-supprimer'), 'Supprimer', 'Confirmer', () => {
  for (const cle of [...historiques.keys()]) if (cle.startsWith(`${etat.actif}/`)) historiques.delete(cle);
  delete etat.donjons[etat.actif];
  if (!Object.keys(etat.donjons).length) {
    const d = modele.creerDonjon({ echelle: r.echelle });
    etat.donjons[d.id] = d;
  }
  etat.actif = Object.keys(etat.donjons)[0];
  afficherSalleActive();
}, { zone: $('donjon-confirmation'), texte: annonceSuppressionDonjon });

// --- Copier pour signaler -----------------------------------------------------
$('copier-rapport').addEventListener('click', async () => {
  const texte = rapport({ texte: salle().texte, ...etat.retour, plan: salle().plan });
  const message = $('message-copie');
  message.hidden = false;
  try {
    await navigator.clipboard.writeText(texte);
    message.textContent = 'Copié ! Colle-le dans ton message.';
  } catch {
    // Presse-papiers refusé (page non sécurisée…) : on montre le texte à copier à la main.
    for (let d = $('json').closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
    $('json').value = texte;
    $('json').select();
    message.textContent = 'Copie automatique impossible : le texte est sélectionné dans la zone JSON, fais Cmd+C.';
  }
  clearTimeout(message.minuterie);
  message.minuterie = setTimeout(() => { message.hidden = true; }, 4000);
});

// --- Micro --------------------------------------------------------------------
const messageMicro = $('message-micro');
const micro = creerMicro({
  onTexte: (texte) => { salle().texte = texte; $('description').value = texte; genererBientot(); },
  onEtat: (actif) => { $('micro').classList.toggle('actif', actif); $('micro').textContent = actif ? '⏹ Arrêter' : '🎙️ Dicter'; },
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
$('calibrage').addEventListener('change', (e) => { $('aide-calibrage').hidden = !e.target.checked; majCarteRef(); });

// --- Plein écran (vue table) --------------------------------------------------
$('plein-ecran').addEventListener('click', () => $('scene').requestFullscreen?.());
$('quitter-plein-ecran').addEventListener('click', () => document.exitFullscreen());
document.addEventListener('fullscreenchange', () => { $('quitter-plein-ecran').hidden = !document.fullscreenElement; });

// --- Fichiers -----------------------------------------------------------------
$('exporter').addEventListener('click', () => stockage.exporterDonjon(donjon()));

function messageFichier(texte, erreurs = []) {
  const ok = $('message-fichier'), ko = $('erreurs-fichier');
  ok.hidden = !texte;
  ok.textContent = texte || '';
  ko.hidden = erreurs.length === 0;
  ko.textContent = erreurs.join(' · '); // textContent : le contenu du fichier n'est jamais interprété comme du HTML
}

$('importer').addEventListener('change', async (e) => {
  const fichier = e.target.files[0];
  e.target.value = '';
  if (!fichier) return;
  try {
    const resultat = modele.convertirImport(await stockage.lireFichierJson(fichier), { echelle: r.echelle });
    if (!resultat.donjon) { messageFichier('', [`Import refusé : ${resultat.erreurs.join(' · ')}`]); return; }
    // Le donjon importé s'AJOUTE aux autres, sous un identifiant neuf : rien n'est écrasé.
    const d = resultat.donjon;
    while (d.id in etat.donjons) d.id = modele.idUnique('donjon', Object.keys(etat.donjons));
    etat.donjons[d.id] = d;
    etat.actif = d.id;
    afficherSalleActive();
    const n = Object.keys(d.salles).length;
    messageFichier(`Donjon « ${d.nom} » importé (${n} salle${n > 1 ? 's' : ''}).${resultat.avertissements.length ? ` À noter : ${resultat.avertissements.join(' · ')}` : ''}`);
  } catch (err) {
    messageFichier('', [`Import refusé : ${err.message}`]);
  }
});

$('appliquer-json').addEventListener('click', () => {
  try {
    appliquerPlan(JSON.parse($('json').value), null);
  } catch (err) {
    afficherErreursJson([`JSON invalide : ${err.message}`]);
  }
});

/** Remplace le plan de la salle affichée par un plan venu de l'éditeur JSON (ou d'un fichier de plan seul). */
function appliquerPlan(brut, texte) {
  const { ok, erreurs, plan } = validerPlan(brut);
  afficherErreursJson(erreurs);
  if (!plan) return;
  // Le JSON modifié réécrit la description, qui régénère la carte : tout reste aligné.
  memoriser();
  changerTexte(texte || decrire(plan));
  if (!ok) $('compris').prepend(h('li', { textContent: 'plan chargé, avec des éléments écartés' }));
}

function afficherErreursJson(erreurs) {
  const zone = $('erreurs-json');
  zone.hidden = erreurs.length === 0;
  zone.textContent = erreurs.join(' · ');
}

// --- Démarrage ----------------------------------------------------------------
afficherSalleActive();
