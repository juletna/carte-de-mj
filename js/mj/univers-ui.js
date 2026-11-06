/**
 * Écran Monde du Donjon : préparer un monde de cartes imbriquées (voir js/univers.js et docs/conception-univers.md).
 * Un écran par-dessus la page : choisir ou créer un monde, ajouter des lieux (cartes image), poser des points d'un clic sur la carte,
 * leur donner une destination (une autre carte, un donjon) dans une bulle accrochée au point, entrer dans la destination, remonter par le fil d'Ariane.
 * Fabrique `creerUniversUI(ctx)` ; `ctx` est celui de main-mj.js (`etat`, `afficherSalleActive`, `activerSalle`). Renvoie `ouvrir`, `fermer`, `ouvert`.
 * Ouverture directe : `donjon.html#monde` (ou `#monde=<id>`) ; fermer l'écran retire l'adresse. Les identifiants de code, le stockage et le format
 * de fichier gardent le mot « univers » (compatibilité) ; seul ce qui s'affiche dit « monde ».
 * Rien ici ne retire une destination en silence : un lieu ou un donjon supprimé laisse des points orphelins, signalés.
 */
import * as stockage from '../stockage.js';
import * as modele from '../univers.js';
import { lireUnivers } from '../univers-validation.js';
import { creerCarteUnivers } from '../univers-carte.js';
import * as images from '../univers-images.js';
import { creerCalage } from './univers-calage.js';
import { menuPlus, aide, creerNotifications } from './univers-menu.js';
import { creerListeDeroulante } from './univers-liste.js';
import { btn, lienBtn } from '../univers-boutons.js';
import { icone } from '../icones.js';
import { creerArbre } from './univers-arbre.js';
import { grilleEffective } from '../univers-grille.js';
import { casesDeReglages } from '../affichage.js';
import { idUnique } from '../donjon.js';
import { positionBulle } from '../mise-en-page.js';
import { telephone } from '../telephone.js';
import { analyserHash, hashMonde, lienJouer, calagePossible, genreDestination, nomDuNouveauLieu } from '../univers-vue.js';
import { $, h, fichierChoisi } from '../dom.js';
import { pluriel, sansAccents } from '../format.js';
import { marquerCourant } from '../navigation.js';

const TAILLE_MAX_FICHIER = 5 * 1024 * 1024;
const DELAI_DOUBLE_CLIC = 450;

export function creerUniversUI(ctx) {
  const { etat } = ctx;
  const racine = $('univers');
  const charge = stockage.chargerUnivers();
  const reserve = charge.etat ?? { actif: null, univers: {} };
  let lieuId = null;        // lieu affiché
  let fil = [];             // lieux traversés pour y arriver (fil d'Ariane), lieu affiché compris
  let pointId = null;       // point sélectionné (sa bulle est ouverte)
  let choixGenre = null;    // « Une autre carte » choisi sur ce point, avant d'avoir une cible
  let cleFocus = null;      // le champ de la bulle qui avait le focus avant un redessin
  let sequence = 0;         // pour ignorer une URL d'image qui arrive après un changement de lieu
  let retraits = [];        // lieux retirés, pour « Annuler »
  let dernierClic = { id: null, t: 0 };
  let renomme = false;      // le nom du monde est en cours d'édition dans la barre

  const univ = () => reserve.univers[reserve.actif] ?? null;
  const lieu = () => univ()?.lieux[lieuId] ?? null;
  const point = () => lieu()?.points.find((p) => p.id === pointId) ?? null;

  // --- Squelette -----------------------------------------------------------------------------------
  const choix = h('select', { id: 'univers-choix', 'aria-label': 'Monde' });
  const nom = h('input', { id: 'univers-nom', type: 'text', maxLength: 80, spellcheck: false, 'aria-label': 'Nom du monde', hidden: true });
  const crayon = btn('Renommer ce monde', () => renommer(true), { icone: 'crayon', iconeSeule: true, classe: 'btn-discret univers-crayon' });
  const jouer = lienBtn('Jouer ce monde', null, { icone: 'jouer', classe: 'btn-primaire univers-jouer', titre: 'Ouvre la Présentation sur ce monde, pour le jouer à la table' });
  const importer = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  const menu = menuPlus({
    libelle: 'Menu du monde',
    items: [
      { libelle: 'Nouveau monde', icone: 'plus', faire: () => creerMondeNeuf() },
      { libelle: 'Exporter ce monde', icone: 'exporter', faire: () => exporterMonde() },
      { element: h('label', { className: 'btn btn-discret univers-menu-item', role: 'menuitem' }, icone('importer'), 'Importer un monde…', importer) },
      { separateur: true },
      { libelle: 'Supprimer ce monde', confirmation: 'Confirmer la suppression', danger: true, faire: () => supprimerLeMonde() },
    ],
  });
  const barre = h('header', { className: 'univers-barre' },
    h('div', { className: 'univers-nom-monde' }, choix, nom, crayon), jouer, menu.element);
  const zoneNotifications = h('div', { className: 'univers-notifications' });
  const dire = creerNotifications(zoneNotifications);
  const filAriane = h('nav', { className: 'univers-fil', 'aria-label': 'Fil d’Ariane' });
  const zoneCarte = h('div', { className: 'univers-zone-carte' });
  const bulle = h('div', { className: 'univers-bulle', role: 'dialog', 'aria-label': 'Point de la carte', hidden: true });
  const arbre = creerArbre({
    surLieu: (id) => { allerA(id); rendre(); arbre.fermer(); },
    surDonjon: (f) => { entrerDansDonjon({ donjon: f.id, ...(f.salle ? { salle: f.salle } : {}) }); },
    surAjouter: () => ajouterLieuLibre(),
  });
  const boutonLieux = btn('Lieux', () => (arbre.ouvert() ? arbre.fermer() : arbre.ouvrir()), { icone: 'menu', classe: 'btn-discret univers-lieux-bouton', titre: 'Lieux du monde' });
  const scene = h('section', { className: 'univers-scene' }, boutonLieux, filAriane, zoneCarte, bulle);
  const panneau = h('aside', { className: 'univers-panneau', 'aria-label': 'Ce lieu' });
  racine.replaceChildren(barre, h('div', { className: 'univers-corps' }, arbre.element, scene, panneau), arbre.voile, zoneNotifications);
  racine.setAttribute('role', 'dialog');
  racine.setAttribute('aria-label', 'Monde');

  const carte = creerCarteUnivers(zoneCarte, {
    onPoint: (id) => {
      if (calage.actif()) return;
      const maintenant = Date.now();
      const double = dernierClic.id === id && maintenant - dernierClic.t < DELAI_DOUBLE_CLIC;
      dernierClic = { id, t: double ? 0 : maintenant };
      selectionner(id);
      if (double) entrerDansPoint(); else rendre();
    },
    onVide: (x, y) => {
      if (calage.actif()) return;
      if (pointId) { selectionner(null); rendre(); return; } // un premier clic ferme la bulle, le suivant pose un point
      poserPoint(x, y);
    },
    onDeplace: (id, x, y) => { modele.deplacerPoint(univ(), lieuId, id, x, y); selectionner(id); sauver(); rendre(); },
  });
  zoneCarte.addEventListener('click', (e) => { if (e.target === zoneCarte && pointId) { selectionner(null); rendre(); } });
  zoneCarte.addEventListener('scroll', () => placerBulle(), { passive: true });
  carte.image.addEventListener('load', () => placerBulle());
  window.addEventListener('resize', () => placerBulle());
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => placerBulle()).observe(carte.cadre);

  // Le calage de la grille d'un lieu (js/mj/univers-calage.js) : pendant qu'il est ouvert, il remplace le panneau et la carte n'a plus de points à déplacer.
  const calage = creerCalage({
    carte,
    surMarqueurs: () => rendreCarte(),
    quitter: () => { calage.fermer(); rendre(); dire('Calage abandonné : rien n’a été modifié.'); },
    enregistrer: (grille, dims) => {
      try { modele.definirGrilleLieu(univ(), lieuId, grille, dims); } catch (err) { dire(err.message, { erreur: true }); return; }
      calage.fermer(); sauver(); rendre();
      dire(grille === undefined ? 'Grille du catalogue rétablie pour cette carte.' : grille === null ? 'Pas de grille : cette carte n’en affiche plus.' : 'Grille enregistrée. Elle sera tracée en régie et à la table.');
    },
  });
  const infosCache = new Map();
  const cleImage = (ref) => `${ref.source}:${ref.id}`;
  async function infosDe(ref) {
    if (!infosCache.has(cleImage(ref))) infosCache.set(cleImage(ref), await images.infosImage(ref));
    return infosCache.get(cleImage(ref));
  }

  // --- Petits outils ---------------------------------------------------------------------------------
  function sauver() {
    if (!stockage.sauverUnivers(reserve)) dire('Les modifications n’ont pas pu être enregistrées dans ce navigateur (stockage plein, bloqué, ou données à sauvegarder d’abord). Exporte le monde pour ne rien perdre.', { erreur: true });
  }
  const donjons = () => etat.donjons;
  const orphelinDe = (p) => modele.raisonOrpheline(univ(), p.vers, donjons());
  const champ = (libelle, ...enfants) => h('label', { className: 'ligne' }, h('span', { textContent: libelle }), ...enfants);
  function selectionner(id) {
    if (id !== pointId) { choixGenre = null; cleFocus = null; }
    pointId = id;
  }

  // --- Monde : choisir, créer, renommer, supprimer, exporter, importer -------------------------------------------
  function majBarre() {
    const ids = Object.keys(reserve.univers);
    choix.replaceChildren(...ids.map((id) => h('option', { value: id, textContent: reserve.univers[id].nom, selected: id === reserve.actif })));
    choix.value = reserve.actif ?? '';
    const u = univ();
    choix.hidden = !u || renomme;
    nom.hidden = !u || !renomme;
    crayon.hidden = !u || renomme;
    jouer.hidden = !u;
    jouer.classList.toggle('btn-primaire', !calage.actif()); // pendant le calage, « Enregistrer » est l'unique action principale
    if (u) jouer.href = lienJouer(u.id); else jouer.removeAttribute('href');
    if (!renomme) nom.value = u?.nom ?? '';
    if (!racine.hidden) majAdresse();
  }
  choix.addEventListener('change', () => { if (choix.value in reserve.univers) { reserve.actif = choix.value; allerA(univ().racine); sauver(); rendre(); } });

  /** Édition du nom du monde dans la barre : Entrée ou clic ailleurs valide, Échap annule. */
  function renommer(actif, { valider = true } = {}) {
    if (!actif && renomme && valider && univ()) { modele.renommerUnivers(univ(), nom.value); sauver(); }
    renomme = actif;
    if (actif && univ()) nom.value = univ().nom;
    rendre();
    if (actif) { nom.focus(); nom.select(); } else if (!racine.hidden) choix.focus();
  }
  nom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); renommer(false); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); renommer(false, { valider: false }); }
  });
  nom.addEventListener('blur', () => { if (renomme) renommer(false); });

  function creerMondeNeuf() {
    const u = modele.creerUnivers({ nom: `Monde ${Object.keys(reserve.univers).length + 1}` });
    reserve.univers[u.id] = u;
    reserve.actif = u.id;
    lieuId = null; fil = []; selectionner(null);
    sauver();
    renomme = true;
    nom.value = u.nom;
    rendre();
    nom.focus(); nom.select();
    dire('Monde créé. Nomme-le, puis ajoute sa première carte (le continent, la région…).');
  }
  function supprimerLeMonde() {
    const u = univ();
    if (!u) return;
    delete reserve.univers[u.id];
    stockage.supprimerPartieUnivers(u.id);
    reserve.actif = Object.keys(reserve.univers)[0] ?? null;
    allerA(univ()?.racine ?? null);
    sauver();
    rendre();
    dire(`« ${u.nom} » est supprimé (ses donjons, eux, sont intacts). Une copie reste dans le fichier exporté si tu l’avais exporté.`);
  }

  function telecharger(texte, fichier) {
    const a = h('a', { href: URL.createObjectURL(new Blob([texte], { type: 'application/json' })), download: fichier });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exporterMonde() {
    if (!univ()) { dire('Aucun monde à exporter.', { erreur: true }); return; }
    const fichier = `${sansAccents(univ().nom).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'monde'}.json`;
    telecharger(modele.texteUnivers(univ()), fichier);
    dire('Fichier exporté : il cite les images par leur référence, sans les contenir.');
  }
  importer.addEventListener('change', async (e) => {
    const fichier = fichierChoisi(e);
    if (!fichier) return;
    menu.fermer();
    try {
      if (fichier.size > TAILLE_MAX_FICHIER) throw new Error('fichier trop gros (5 Mo au plus)');
      const { univers: u, avertissements } = lireUnivers(await fichier.text());
      if (u.id in reserve.univers) u.id = idUnique('u', Object.keys(reserve.univers)); // un monde déjà là n'est jamais écrasé
      reserve.univers[u.id] = u;
      reserve.actif = u.id;
      allerA(u.racine);
      sauver();
      rendre();
      dire(`« ${u.nom} » importé${avertissements.length ? ` · ${avertissements.join(' · ')}` : ''}.`);
    } catch (err) {
      dire(`Import impossible : ${err.message}`, { erreur: true });
    }
  });

  // --- Lieux -----------------------------------------------------------------------------------------
  function allerA(id, { nouveauFil = true } = {}) {
    lieuId = id && univ()?.lieux[id] ? id : null;
    if (nouveauFil) fil = lieuId ? [lieuId] : [];
    selectionner(null); calage.fermer();
  }
  function entrerDansLieu(id) {
    fil = [...fil.slice(0, fil.indexOf(lieuId) + 1), id];
    lieuId = id; selectionner(null); calage.fermer();
  }

  async function demanderImage() {
    try { return await images.choisirCarte({}); } catch (err) { dire(err.message, { erreur: true }); return null; }
  }
  /** Crée un lieu à partir d'une image choisie, nommé `nomImpose` s'il est donné, sinon d'après l'image. Rend le lieu, ou null (annulé, ou limite atteinte). */
  async function creerLieu(nomImpose = '') {
    const ref = await demanderImage();
    if (!ref) return null;
    const infos = await images.infosImage(ref);
    try {
      return modele.ajouterLieu(univ(), { nom: nomDuNouveauLieu(nomImpose, infos?.titre), image: ref });
    } catch (err) { dire(err.message, { erreur: true }); return null; }
  }

  async function ajouterLieuLibre() {
    const l = await creerLieu();
    if (!l) return;
    entrerDansLieu(l.id); fil = [l.id];
    sauver(); rendre();
    dire(`Lieu « ${l.nom} » ajouté. Clique sur la carte pour poser un point qui le relie à un autre lieu ou à un donjon.`);
  }

  function supprimerLeLieu() {
    const l = lieu();
    const entrees = modele.pointsVers(univ(), l.id).length;
    const retire = modele.supprimerLieu(univ(), l.id);
    retraits = [{ univers: univ().id, lieu: retire }];
    fil = fil.filter((id) => id !== l.id);
    allerA(fil.at(-1) ?? univ().racine, { nouveauFil: !fil.length });
    sauver(); rendre();
    dire(`« ${l.nom} » est retiré${entrees ? ` ; ${pluriel(entrees, 'point y menait', 'points y menaient')} et reste${entrees > 1 ? 'nt' : ''} signalé${entrees > 1 ? 's' : ''} comme orphelin${entrees > 1 ? 's' : ''}` : ''}.`, {
      action: { libelle: 'Annuler', faire: () => {
        const r = retraits.pop();
        if (r && reserve.univers[r.univers]) { modele.retablirLieu(reserve.univers[r.univers], r.lieu); allerA(r.lieu.id); sauver(); rendre(); dire('Lieu rétabli.'); }
      } },
    });
  }

  async function changerImage() {
    const ref = await demanderImage();
    if (!ref) return;
    modele.definirImageLieu(univ(), lieuId, ref);
    sauver(); rendre();
  }

  // --- Points -----------------------------------------------------------------------------------------
  function poserPoint(x, y) {
    try {
      const p = modele.ajouterPoint(univ(), lieuId, { x, y, nom: '' });
      selectionner(p.id); cleFocus = 'nom';
      sauver(); rendre();
    } catch (err) { dire(err.message, { erreur: true }); }
  }
  function changerDestination(vers) {
    modele.modifierPoint(univ(), lieuId, pointId, { vers });
    choixGenre = null;
    sauver(); rendre();
  }
  /** « Une autre carte » : ouvre la bibliothèque, puis crée le lieu (nommé comme le point) et y relie le point. */
  async function destinationNouvelleCarte() {
    const pid = pointId, lid = lieuId;
    const p = point();
    if (!p) return;
    const l = await creerLieu(p.nom);
    if (l && lieu()?.id === lid && point()?.id === pid) {
      modele.modifierPoint(univ(), lid, pid, { vers: { lieu: l.id }, ...(point().nom ? {} : { nom: l.nom }) });
      choixGenre = null;
      sauver();
      dire(`Lieu « ${l.nom} » ajouté et relié à ce point.`);
    }
    rendre();
  }
  function entrerDansPoint() {
    const p = point();
    if (!p) return;
    if (!p.vers) { dire('Ce point ne mène nulle part pour l’instant : choisis une destination dans sa bulle.'); rendre(); return; }
    if (p.vers.lieu !== undefined) {
      if (!(p.vers.lieu in univ().lieux)) { dire(`Destination perdue : ${orphelinDe(p) ?? 'lieu disparu'}.`, { erreur: true }); rendre(); return; }
      entrerDansLieu(p.vers.lieu);
      rendre();
      return;
    }
    if (!entrerDansDonjon(p.vers)) { dire(`Destination perdue : ${orphelinDe(p) ?? 'donjon disparu'}.`, { erreur: true }); rendre(); }
  }
  /** Quitte l'écran Monde pour le donjon (et sa salle d'arrivée si elle existe encore). Rend false si le donjon a disparu. */
  function entrerDansDonjon(vers) {
    const d = donjons()[vers.donjon];
    if (!d) return false;
    etat.actif = d.id;
    fermerEcran({ rendreFocus: false });
    if (vers.salle && vers.salle in d.salles) ctx.activerSalle(vers.salle); else ctx.afficherSalleActive();
    return true;
  }

  // --- Rendu : fil d'Ariane et carte ----------------------------------------------------------------------------
  function rendreFil() {
    const u = univ();
    filAriane.hidden = !u || !fil.length;
    filAriane.replaceChildren();
    if (!u) return;
    fil.forEach((id, i) => {
      if (i) filAriane.append(h('span', { className: 'univers-sep', textContent: '›', 'aria-hidden': 'true' }));
      const nomLieu = u.lieux[id]?.nom ?? '(lieu disparu)';
      if (i === fil.length - 1) filAriane.append(h('strong', { textContent: nomLieu, 'aria-current': 'location' }));
      else filAriane.append(btn(nomLieu, () => { fil = fil.slice(0, i + 1); allerA(id, { nouveauFil: false }); rendre(); }, { classe: 'btn-discret' }));
    });
    if (fil.length > 1) filAriane.append(btn('Remonter', () => { const id = fil.at(-2); fil = fil.slice(0, -1); allerA(id, { nouveauFil: false }); rendre(); }, { icone: 'remonter', classe: 'btn-discret univers-remonter' }));
  }

  let imageAffichee = null; // clé de l'image déjà montrée : on ne la recharge pas à chaque rendu
  async function rendreCarte() {
    const l = lieu();
    const moi = ++sequence;
    zoneCarte.hidden = !l;
    if (!l) return;
    const enCalage = calage.actif();
    const pointsLieu = l.points.map((p) => ({
      id: p.id, x: p.x, y: p.y, nom: p.nom || '',
      titre: `${p.nom || 'Point sans nom'} → ${modele.nomDestination(univ(), p.vers, donjons())}${orphelinDe(p) ? ` (${orphelinDe(p)})` : ''}`,
      classes: [p.cache ? 'cache' : '', orphelinDe(p) ? 'orphelin' : '', !p.vers ? 'libre' : '', p.id === pointId ? 'choisi' : '', enCalage ? 'transparent' : ''].filter(Boolean),
      selectionne: p.id === pointId,
    }));
    // En calage, les points restent visibles en transparence (sans qu'on puisse les toucher) et les repères de « Mesurer » s'y ajoutent.
    const pointsCarte = enCalage ? [...pointsLieu, ...calage.marqueurs()] : pointsLieu;
    const infos = await infosDe(l.image);
    if (moi !== sequence) return;
    const aff = enCalage ? calage.grilleAffichee() : { grille: grilleEffective(l, infos).grille, opacite: casesDeReglages(stockage.chargerReglages() ?? {}) / 100 };
    const options = { points: pointsCarte, modifiable: !enCalage, poser: !enCalage, alt: `Carte : ${l.nom}`, ...aff };
    const cle = cleImage(l.image);
    if (imageAffichee !== cle) carte.afficher({ ...options, url: null, absente: 'Chargement de l’image…' });
    const url = await images.urlImage(l.image);
    if (moi !== sequence) return;
    imageAffichee = url ? cle : null;
    carte.afficher({ ...options, url, absente: 'Image introuvable : la carte n’est plus dans la bibliothèque ou dans ce navigateur (ou la bibliothèque n’est pas disponible). Les points restent posés ; choisis une autre image.' });
    if (infosPanneauPerimees) { infosPanneauPerimees = false; rendrePanneau(); }
    placerBulle();
  }

  // --- La bulle du point : accrochée au point sur la carte (panneau fixe en bas sous 760 px) --------------------------------
  /** Pose la bulle à côté du point (à droite, sinon à gauche, dessous, dessus), sans jamais dépasser de la scène. */
  function placerBulle() {
    if (bulle.hidden) return;
    if (telephone()) { bulle.style.left = bulle.style.top = bulle.style.maxHeight = ''; bulle.style.visibility = ''; racine.style.setProperty('--haut-bulle', `${bulle.offsetHeight}px`); focaliserBulle(); return; }
    const marqueur = carte.cadre.querySelector(`[data-id="${CSS.escape(pointId ?? '')}"] .univers-pastille`);
    const sc = scene.getBoundingClientRect();
    if (!marqueur || !sc.width) { bulle.style.visibility = ''; focaliserBulle(); return; }
    const m = marqueur.getBoundingClientRect();
    const vue = { g: sc.left + scene.clientLeft + 8, h: sc.top + scene.clientTop + 8, d: sc.left + scene.clientLeft + scene.clientWidth - 8, b: sc.top + scene.clientTop + scene.clientHeight - 8 };
    bulle.style.maxHeight = `${Math.max(160, vue.b - vue.h)}px`;
    const { x, y } = positionBulle({ g: m.left, h: m.top, d: m.right, b: m.bottom }, vue, bulle.offsetWidth, bulle.offsetHeight);
    bulle.style.left = `${Math.round(x - sc.left - scene.clientLeft)}px`;
    bulle.style.top = `${Math.round(y - sc.top - scene.clientTop)}px`;
    bulle.style.visibility = '';
    focaliserBulle();
  }
  /** Rend le focus au champ qui l'avait (ou au nom d'un point neuf), une fois la bulle visible : un élément caché ne le prend pas. */
  let focusAttendu = false;
  function focaliserBulle() {
    if (!focusAttendu || bulle.hidden) return;
    focusAttendu = false;
    if (cleFocus) bulle.querySelector(`[data-cle="${cleFocus}"]`)?.focus({ preventScroll: true });
  }
  bulle.addEventListener('focusin', (e) => { cleFocus = e.target.dataset?.cle ?? cleFocus; });

  const option = (valeur, texte, disabled = false) => h('option', { value: valeur, textContent: texte, disabled });
  const avecCle = (el, cle) => { el.dataset.cle = cle; return el; };

  const urlsVignettes = new Map(); // clé d'image → URL, pour que la vignette d'un lieu n'attende qu'une fois
  /** La vignette de 32 px d'un lieu : l'icône du monde d'abord, puis l'image dès qu'elle est connue. */
  function vignetteLieu(ref) {
    const boite = h('span', { className: 'univers-vignette petite', 'aria-hidden': 'true' }, icone('monde'));
    if (!ref) return boite;
    const cle = cleImage(ref);
    const poser = (url) => { if (url) boite.replaceChildren(h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async' })); };
    if (urlsVignettes.has(cle)) poser(urlsVignettes.get(cle));
    else images.urlImage(ref).then((url) => { if (url) { urlsVignettes.set(cle, url); poser(url); } });
    return boite;
  }

  const NOUVELLE_CARTE = '__nouvelle-carte__';
  /**
   * Destination du point, sur deux lignes : le sélecteur [ Carte | Donjon | Rien ], puis selon le choix un seul menu de lieux
   * (dont « ＋ Nouvelle carte… », qui ouvre la bibliothèque), ou le donjon et sa salle d'arrivée côte à côte, ou rien.
   */
  function destinationBulle(p) {
    const u = univ();
    const genre = genreDestination(p.vers);
    const actif = choixGenre ?? genre;
    const choisir = (id, libelle, cle, faire) => {
      const b = avecCle(btn(libelle, faire, { classe: 'univers-segment-bouton' }), cle);
      b.setAttribute('aria-pressed', String(actif === id));
      return b;
    };
    const segments = h('div', { className: 'univers-segment', role: 'group', 'aria-label': 'Où mène ce point' },
      choisir('carte', 'Carte', 'g-carte', () => { if (genre !== 'carte') { choixGenre = 'carte'; cleFocus = 'g-carte'; rendreBulle(); placerBulle(); } }),
      choisir('donjon', 'Donjon', 'g-donjon', () => {
        if (genre === 'donjon') return;
        const d = Object.values(donjons())[0];
        if (d) { cleFocus = 'g-donjon'; changerDestination({ donjon: d.id }); } else dire('Aucun donjon dans ce navigateur : crée-en un d’abord, dans Donjons.', { erreur: true });
      }),
      choisir('', 'Rien', 'g-rien', () => { cleFocus = 'g-rien'; changerDestination(null); }));
    const lignes = [];
    if (actif === 'carte') {
      const autres = modele.listerLieux(u).filter((x) => x.id !== lieuId || x.id === p.vers?.lieu);
      const avant = genre === 'carte' ? p.vers.lieu : '';
      const opts = [
        ...(genre === 'carte' && !(p.vers.lieu in u.lieux) ? [{ valeur: p.vers.lieu, libelle: '(lieu disparu)', desactive: true }] : []),
        ...autres.map((x) => ({ valeur: x.id, libelle: x.nom, image: u.lieux[x.id]?.image ?? null })),
        { valeur: NOUVELLE_CARTE, libelle: 'Nouvelle carte…', ajout: true },
      ];
      const liste = creerListeDeroulante({
        libelle: 'Lieu de destination', options: opts, valeur: avant, vide: 'Choisir un lieu…', cle: 'lieu',
        vignette: (o) => vignetteLieu(o.image),
        surChoix: (o) => { if (o.valeur === NOUVELLE_CARTE) destinationNouvelleCarte(); else { cleFocus = 'lieu'; changerDestination({ lieu: o.valeur }); } },
      });
      lignes.push(h('div', { className: 'univers-ligne-destination' }, liste.element));
    } else if (actif === 'donjon') {
      const listeDonjon = creerListeDeroulante({
        libelle: 'Donjon', cle: 'donjon', valeur: p.vers.donjon, vide: 'Choisir un donjon…',
        options: [
          ...(!donjons()[p.vers.donjon] ? [{ valeur: p.vers.donjon, libelle: '(donjon disparu)', desactive: true }] : []),
          ...Object.values(donjons()).map((d) => ({ valeur: d.id, libelle: d.nom })),
        ],
        surChoix: (o) => { cleFocus = 'donjon'; changerDestination({ donjon: o.valeur }); },
      });
      const enfants = [listeDonjon.element];
      const d = donjons()[p.vers.donjon];
      if (d) {
        const salle = avecCle(h('select', { 'aria-label': 'Salle d’arrivée' }, option('', 'Salle affichée'), ...Object.values(d.salles).map((x) => option(x.id, x.nom))), 'salle');
        if (p.vers.salle && !(p.vers.salle in d.salles)) salle.append(option(p.vers.salle, '(salle disparue)', true));
        salle.value = p.vers.salle ?? '';
        salle.title = 'Salle d’arrivée : « Salle affichée » garde celle que le donjon montrait';
        salle.addEventListener('change', () => changerDestination({ donjon: d.id, ...(salle.value ? { salle: salle.value } : {}) }));
        enfants.push(salle);
      }
      lignes.push(h('div', { className: 'univers-ligne-destination' }, ...enfants));
    }
    return [segments, ...lignes];
  }

  /** La bulle d'un point : le nom et ses menus, le sélecteur de destination, la destination, puis Visible/Caché et Entrer (quatre lignes). */
  function rendreBulle() {
    const p = calage.actif() ? null : point();
    document.body.classList.toggle('univers-bulle-ouverte', !!p);
    bulle.hidden = !p;
    if (!p) { bulle.replaceChildren(); return; }
    const orph = orphelinDe(p);
    const nomPoint = avecCle(h('input', { type: 'text', className: 'univers-point-nom', maxLength: 80, value: p.nom, spellcheck: false, placeholder: 'Nom du point', 'aria-label': 'Nom du point' }), 'nom');
    // Le nom s'enregistre en quittant le champ (ou Entrée) sans redessiner la bulle : un clic sur un autre bouton ne doit pas être perdu.
    nomPoint.addEventListener('change', () => { modele.modifierPoint(univ(), lieuId, p.id, { nom: nomPoint.value }); sauver(); rendrePanneau(); rendreCarte(); });
    nomPoint.addEventListener('keydown', (e) => { if (e.key === 'Enter') nomPoint.blur(); });
    const cache = avecCle(h('input', { type: 'checkbox', checked: !!p.cache, role: 'switch' }), 'cache');
    cache.addEventListener('change', () => { modele.modifierPoint(univ(), lieuId, p.id, { cache: cache.checked }); cleFocus = 'cache'; sauver(); rendre(); });
    const interrupteur = h('label', { className: 'univers-interrupteur', title: 'Caché : le point n’apparaît à la table qu’une fois révélé en jeu' }, cache, h('span', { className: 'univers-glissiere', 'aria-hidden': 'true' }),
      h('span', { textContent: p.cache ? 'Caché' : 'Visible' }));
    const plus = menuPlus({
      libelle: 'Plus d’actions sur ce point',
      items: [{ libelle: 'Supprimer ce point', confirmation: 'Confirmer la suppression', danger: true, faire: () => { modele.supprimerPoint(univ(), lieuId, p.id); selectionner(null); sauver(); rendre(); } }],
    });
    const entrer = avecCle(btn('Entrer', () => entrerDansPoint(), { icone: 'retour', classe: 'univers-entrer' }), 'entrer');
    entrer.disabled = !p.vers || !!orph;
    entrer.title = p.vers?.donjon ? 'Entrer dans le donjon (double-clic sur le point : même chose)' : 'Double-clic sur le point : même chose';
    entrer.append(entrer.firstChild); // l'icône (flèche) passe après le libellé et pointe vers la droite
    const fermerBulle = btn('Fermer la bulle du point', () => { selectionner(null); rendre(); }, { icone: 'fermer', iconeSeule: true, classe: 'btn-discret' });
    bulle.replaceChildren(
      h('div', { className: 'univers-bulle-tete' }, nomPoint, plus.element, fermerBulle),
      ...destinationBulle(p),
      ...(orph ? [h('p', { className: 'note erreur' }, icone('alerte'), ` Destination perdue : ${orph}. Choisis-en une autre ; rien n’a été retiré.`)] : []),
      h('div', { className: 'univers-bulle-pied' }, interrupteur, entrer));
    if (!telephone()) bulle.style.visibility = 'hidden'; // le temps de la placer à côté du point
    focusAttendu = !!cleFocus;
  }

  // --- Rendu : panneau latéral (lieu et liste des points) -------------------------------------------------------------------------
  function editionLieu() {
    const l = lieu();
    const orph = modele.orphelins(univ(), donjons()).filter((o) => o.lieu === l.id);
    const nomLieu = h('input', { type: 'text', maxLength: 80, value: l.nom, spellcheck: false });
    nomLieu.addEventListener('change', () => { modele.renommerLieu(univ(), l.id, nomLieu.value); sauver(); rendre(); });
    const notes = h('textarea', { rows: 3, maxLength: 20000, value: l.notes, spellcheck: true });
    notes.addEventListener('change', () => { modele.definirNotesLieu(univ(), l.id, notes.value); sauver(); });
    const depart = h('label', { className: 'ligne case' }, h('input', { type: 'checkbox', checked: univ().racine === l.id }), ' Lieu de départ du monde');
    depart.firstChild.addEventListener('change', (e) => { if (e.target.checked) { modele.definirRacine(univ(), l.id); sauver(); rendre(); } else e.target.checked = true; });
    const info = infosCache.get(cleImage(l.image)) ?? null;
    if (!infosCache.has(cleImage(l.image))) infosPanneauPerimees = true; // le niveau de la carte arrive avec ses informations
    const eff = grilleEffective(l, info);
    const etatGrille = { lieu: `Grille calée : cases de ${String(eff.grille?.case).replace('.', ',')} px.`, catalogue: `Grille du catalogue : cases de ${String(eff.grille?.case).replace('.', ',')} px.`, aucune: 'Pas de grille.', ambiance: 'Carte d’ambiance, sans grille.' }[eff.origine];
    const peutCaler = !info || calagePossible(info.niveau);
    const plus = menuPlus({
      libelle: 'Plus d’actions sur ce lieu',
      items: [{ libelle: 'Supprimer ce lieu', confirmation: 'Confirmer la suppression', danger: true, faire: supprimerLeLieu }],
    });
    return h('section', {},
      h('h3', { textContent: 'Ce lieu' }),
      champ('Nom', nomLieu), champ('Notes', notes), depart,
      ...(peutCaler ? [h('p', { className: 'note univers-etat-grille', textContent: etatGrille })] : []),
      h('div', { className: 'actions' },
        ...(peutCaler ? [btn('Caler la grille', () => ouvrirCalage(), { icone: 'grille' })] : []),
        btn('Changer l’image', () => changerImage(), { icone: 'bibliotheque' }), plus.element),
      ...(orph.length ? [h('p', { className: 'note erreur' }, icone('alerte'), ` ${pluriel(orph.length, 'point mène', 'points mènent')} vers une destination qui n’existe plus : ils sont signalés, rien n’a été retiré.`)] : []));
  }
  let infosPanneauPerimees = false;

  async function ouvrirCalage() {
    const l = lieu();
    const dims = carte.dimensions();
    if (!dims) { dire('La carte n’est pas encore chargée (ou introuvable) : on ne peut pas y caler une grille.', { erreur: true }); return; }
    selectionner(null);
    const infos = await infosDe(l.image);
    if (!calagePossible(infos?.niveau)) { dire('Une carte de continent ou de région n’a pas de grille de case : le calage se fait sur une zone, une localité, un bâtiment ou un souterrain.'); rendre(); return; }
    if (!calage.ouvrir({ lieu: l, infos, dims })) return;
    rendre();
    calage.focaliser();
  }

  function listePoints() {
    const l = lieu();
    const items = l.points.map((p) => {
      const orph = orphelinDe(p);
      const b = btn(p.nom || 'Point sans nom', () => { selectionner(p.id); rendre(); }, { classe: `btn-discret univers-ligne-point${p.id === pointId ? ' choisi' : ''}` });
      if (orph) { b.prepend(icone('alerte')); b.title = orph; }
      if (p.cache) { b.prepend(icone('oeil-barre')); b.title = `${b.title ? `${b.title} · ` : ''}Caché à la table`; }
      if (p.id === pointId) b.setAttribute('aria-current', 'true');
      return h('li', {}, b, h('span', { className: 'doux', textContent: ` → ${modele.nomDestination(univ(), p.vers, donjons())}${orph ? ` (${orph})` : ''}` }));
    });
    const auCentre = btn('Point au centre', () => poserPoint(0.5, 0.5), { icone: 'point', classe: 'btn-discret', titre: 'Pose un point au centre de la carte (pour le clavier) ; déplace-le ensuite avec les flèches' });
    return h('section', {},
      h('h3', {}, `Points (${l.points.length}) `, aide('Clique sur une zone vide de la carte pour poser un point : sa bulle s’ouvre, nomme-le et choisis où il mène. Clique sur un point pour rouvrir sa bulle, double-clique pour entrer. Glisse un point, ou utilise les flèches du clavier, pour le déplacer. Un clic dans le vide ferme d’abord la bulle.')),
      items.length ? h('ul', { className: 'univers-liste' }, ...items) : h('p', { className: 'note', textContent: 'Aucun point : clique sur la carte pour en poser un.' }),
      auCentre);
  }

  function rendrePanneau() {
    const u = univ();
    if (!u) {
      panneau.replaceChildren(h('p', { className: 'note', textContent: 'Un monde rassemble des cartes qui s’emboîtent : le continent mène à une région, puis à un village, puis à un donjon.' }),
        btn('Créer un monde', () => creerMondeNeuf(), { icone: 'plus', classe: 'btn-primaire' }));
      return;
    }
    if (calage.actif() && lieu()) panneau.replaceChildren(calage.panneau());
    else panneau.replaceChildren(...(lieu() ? [editionLieu(), listePoints()] : [h('p', { className: 'note', textContent: 'Aucun lieu : ajoute la première carte avec « + Lieu » (le continent, la région, le village…).' })]));
  }

  function rendre() {
    const u = univ();
    if (u && (!lieuId || !u.lieux[lieuId])) allerA(u.racine && u.lieux[u.racine] ? u.racine : Object.keys(u.lieux)[0] ?? null);
    if (pointId && !point()) selectionner(null);
    majBarre();
    rendreFil();
    racine.classList.toggle('sans-monde', !u);
    arbre.maj({ univers: u, donjons: donjons(), lieuId });
    if (!u) {
      rendrePanneau();
      rendreBulle();
      zoneCarte.hidden = true;
      return;
    }
    racine.classList.toggle('en-calage', calage.actif());
    rendrePanneau();
    rendreBulle();
    rendreCarte();
  }

  // --- Ouverture, adresse `#monde` ------------------------------------------------------------------------------------------------
  const declencheur = $('univers-bouton');
  declencheur?.prepend(icone('monde')); // l'icône est posée ici : le balisage n'a pas d'emoji
  const sansHash = () => `${location.pathname}${location.search}`;
  function majAdresse() {
    const voulu = hashMonde(reserve.actif);
    if (location.hash !== voulu) history.replaceState(null, '', `${sansHash()}${voulu}`);
  }
  function ouvrirEcran({ id = null } = {}) {
    if (id && id in reserve.univers && id !== reserve.actif) { reserve.actif = id; allerA(univ().racine); }
    racine.hidden = false;
    document.body.classList.add('univers-ouvert');
    window.scrollTo(0, 0);
    caler();
    declencheur?.setAttribute('aria-expanded', 'true');
    rendre();
    marquerCourant(); // la barre de navigation marque « Monde » (l'adresse change sans événement quand on ouvre par le bouton)
    (racine.querySelector('.univers-jouer:not([hidden]), .univers-panneau button, .univers-barre button') ?? racine).focus();
  }
  /** L'écran se pose sous la barre de navigation commune (jamais par-dessus). */
  const barreSite = document.querySelector('header[data-navigation]');
  function caler() {
    const haut = `${Math.max(0, Math.round(barreSite?.getBoundingClientRect().bottom ?? 0))}px`;
    racine.style.top = haut;
    racine.style.setProperty('--decalage-univers', haut);
  }
  window.addEventListener('resize', () => { if (!racine.hidden) caler(); });
  if (barreSite && typeof ResizeObserver === 'function') new ResizeObserver(() => { if (!racine.hidden) caler(); }).observe(barreSite);
  function fermerEcran({ rendreFocus = true } = {}) {
    racine.hidden = true;
    renomme = false; selectionner(null); calage.fermer();
    document.body.classList.remove('univers-ouvert', 'univers-bulle-ouverte');
    declencheur?.setAttribute('aria-expanded', 'false');
    arbre.fermer();
    if (analyserHash(location.hash)) history.replaceState(null, '', sansHash());
    marquerCourant();
    if (rendreFocus) declencheur?.focus();
  }
  declencheur?.addEventListener('click', () => (racine.hidden ? ouvrirEcran() : fermerEcran()));
  racine.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    e.preventDefault();
    if (calage.actif()) { calage.fermer(); rendre(); } else if (pointId) { selectionner(null); rendre(); } else fermerEcran();
  });
  window.addEventListener('hashchange', () => {
    const cible = analyserHash(location.hash);
    if (cible && racine.hidden) ouvrirEcran(cible);
    else if (!cible && !racine.hidden) fermerEcran({ rendreFocus: false }); // on a quitté #monde (retour du navigateur, lien Donjons)
  });

  if (charge.miseDeCote) {
    const phrase = stockage.phraseMiseDeCote(charge.miseDeCote).replace('données', 'mondes');
    ctx.annoncerCarte?.(phrase, !charge.miseDeCote.ok, 15000);
  }
  allerA(univ()?.racine ?? null);
  const ouvertureDirecte = analyserHash(location.hash);
  if (ouvertureDirecte) ouvrirEcran(ouvertureDirecte);
  return { ouvrir: ouvrirEcran, fermer: fermerEcran, ouvert: () => !racine.hidden };
}
