/**
 * Le Monde dans l'atelier du Donjon : la LOGIQUE de la carte d'un lieu et des données du monde (voir js/univers.js, docs/conception-univers.md
 * et docs/conception-atelier.md). Ce module ne construit plus d'écran : il pose la scène « lieu » (fil d'Ariane, carte, points, notifications)
 * dans `#cadre-scene`, et expose ses opérations à l'atelier. Le DOM des réglages est ailleurs :
 *   - js/atelier/inspecteurs-monde.js : les inspecteurs monde, lieu et point (nom, destination, grille, suppression…) ;
 *   - js/atelier/barre-lieu.js        : la barre d'outils Sélection · Point · Grille ;
 *   - js/atelier/inscrire-monde.js    : le branchement sur la coquille (arbre, « ⋯ », barre du haut, adresse).
 * Fabrique `creerUniversUI(ctx)` ; `ctx` est celui de main-mj.js (`etat`, `annoncerCarte`, `coquille` plus tard). Les identifiants de code, le
 * stockage et le format de fichier gardent le mot « univers » (compatibilité) ; seul ce qui s'affiche dit « monde ».
 * Rien ici ne retire une destination en silence : un lieu ou un donjon supprimé laisse des points orphelins, signalés.
 *
 * Outils de la scène (`mode()`) : 'selection' (un clic sur un point le choisit, un clic dans le vide ne pose rien), 'point' (le prochain clic dans
 * le vide pose un point, puis on revient à 'selection'), 'grille' (le calage de la grille ; actif tant que `calage.actif()`).
 * Le point choisi est une sélection commune de la coquille (type 'point') : `surPoint(f)` prévient l'atelier, `synchroniser(sel)` le contraire.
 */
import * as stockage from '../stockage.js';
import * as modele from '../univers.js';
import { lireUnivers } from '../univers-validation.js';
import { creerCarteUnivers } from '../univers-carte.js';
import * as images from '../univers-images.js';
import { creerCalage } from './univers-calage.js';
import { creerNotifications } from './univers-menu.js';
import { btn } from '../univers-boutons.js';
import { grilleEffective } from '../univers-grille.js';
import { casesDeReglages } from '../affichage.js';
import { idUnique } from '../donjon.js';
import { calagePossible, nomDuNouveauLieu } from '../univers-vue.js';
import { $, h, fichierChoisi } from '../dom.js';
import { pluriel, sansAccents } from '../format.js';

const TAILLE_MAX_FICHIER = 5 * 1024 * 1024;
const DELAI_DOUBLE_CLIC = 450;

export function creerUniversUI(ctx) {
  const { etat } = ctx;
  const charge = stockage.chargerUnivers();
  const reserve = charge.etat ?? { actif: null, univers: {} };
  let lieuId = null;        // lieu affiché
  let fil = [];             // lieux traversés pour y arriver (fil d'Ariane), lieu affiché compris
  let pointId = null;       // point choisi (son inspecteur est ouvert)
  let modeLocal = 'selection'; // 'selection' | 'point' (le calage, lui, se lit dans `calage.actif()`)
  let sequence = 0;         // pour ignorer une URL d'image qui arrive après un changement de lieu
  let retraits = [];        // lieux retirés, pour « Annuler »
  let dernierClic = { id: null, t: 0 };
  let ouvertEcran = false;
  const surChangement = []; // appelés après chaque rendu (la coquille de l'atelier suit le lieu affiché et les données)
  let surPoint = null;      // appelé quand le point choisi change (l'atelier en fait la sélection commune)
  const saisie = { choixGenre: null, cle: null }; // « Une autre carte » choisi sur ce point sans cible ; champ qui avait le focus avant un redessin

  const univ = () => reserve.univers[reserve.actif] ?? null;
  const lieu = () => univ()?.lieux[lieuId] ?? null;
  const point = () => lieu()?.points.find((p) => p.id === pointId) ?? null;

  // --- Scène : fil d'Ariane, carte, état vide, notifications -------------------------------------------------------
  const zoneNotifications = h('div', { className: 'univers-notifications' });
  const notifier = creerNotifications(zoneNotifications);
  /** Un message : une notification sur la carte du Monde, ou le bandeau de la carte quand on est dans le Donjon. */
  function dire(texte, options = {}) {
    if (ouvertEcran || !texte) notifier(texte, options);
    else ctx.annoncerCarte?.(texte, !!options.erreur, 4500);
  }
  const filAriane = h('nav', { className: 'univers-fil', 'aria-label': 'Fil d’Ariane' });
  const zoneCarte = h('div', { className: 'univers-zone-carte' });
  const vide = h('div', { className: 'univers-vide', hidden: true });
  const scene = h('section', { className: 'univers-scene', id: 'scene-monde', 'aria-label': 'Carte du lieu', hidden: true }, filAriane, zoneCarte, vide, zoneNotifications);
  $('cadre-scene').append(scene);

  const carte = creerCarteUnivers(zoneCarte, {
    onPoint: (id) => {
      if (calage.actif()) return;
      const maintenant = Date.now();
      const double = dernierClic.id === id && maintenant - dernierClic.t < DELAI_DOUBLE_CLIC;
      dernierClic = { id, t: double ? 0 : maintenant };
      modeLocal = 'selection';
      selectionner(id);
      if (double) entrerDansPoint(); else rendre();
    },
    onVide: (x, y) => {
      if (calage.actif()) return;
      if (modeLocal === 'point') { poserPoint(x, y); return; }
      if (pointId) { selectionner(null); rendre(); } // l'outil Sélection ne pose rien : un clic dans le vide lâche le point
    },
    onDeplace: (id, x, y) => { modele.deplacerPoint(univ(), lieuId, id, x, y); selectionner(id); sauver(); rendre(); },
  });
  zoneCarte.addEventListener('click', (e) => { if (e.target === zoneCarte && pointId) { selectionner(null); rendre(); } });

  // Le calage de la grille d'un lieu (js/mj/univers-calage.js) : l'outil Grille de la barre ; ses réglages sont dans l'inspecteur du lieu.
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
  /** Choisit (ou lâche) un point ; l'atelier est prévenu pour que l'inspecteur suive. */
  function selectionner(id) {
    if (id !== pointId) { saisie.choixGenre = null; saisie.cle = null; }
    const change = id !== pointId;
    pointId = id;
    if (change) surPoint?.(id);
  }

  // --- Monde : créer, renommer, supprimer, exporter, importer -----------------------------------------------------
  function creerMondeNeuf() {
    const u = modele.creerUnivers({ nom: `Monde ${Object.keys(reserve.univers).length + 1}` });
    reserve.univers[u.id] = u;
    reserve.actif = u.id;
    lieuId = null; fil = []; selectionner(null);
    sauver();
    saisie.cle = 'monde-nom';
    rendre();
    ctx.coquille?.naviguer({ page: 'monde', monde: u.id }); // l'arbre, l'adresse et l'inspecteur (le nom à saisir) suivent
    dire('Monde créé. Nomme-le, puis ajoute sa première carte (le continent, la région…).');
    return u;
  }
  function renommerMonde(nomMonde) {
    if (!univ()) return;
    modele.renommerUnivers(univ(), nomMonde);
    sauver(); rendre({ inspecteur: false });
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
  /** Importe un monde depuis un fichier choisi (l'évènement `change` d'un <input type=file>). Rend le monde importé, ou null. */
  async function importerMonde(evenement) {
    const fichier = fichierChoisi(evenement);
    if (!fichier) return null;
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
      return u;
    } catch (err) {
      dire(`Import impossible : ${err.message}`, { erreur: true });
      return null;
    }
  }

  // --- Lieux -----------------------------------------------------------------------------------------
  function allerA(id, { nouveauFil = true } = {}) {
    lieuId = id && univ()?.lieux[id] ? id : null;
    if (nouveauFil) fil = lieuId ? [lieuId] : [];
    modeLocal = 'selection';
    selectionner(null); calage.fermer();
  }
  function entrerDansLieu(id) {
    fil = [...fil.slice(0, fil.indexOf(lieuId) + 1), id];
    lieuId = id; modeLocal = 'selection'; selectionner(null); calage.fermer();
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
    if (!univ()) { dire('Crée d’abord un monde : un lieu est une carte de ce monde.', { erreur: true }); return null; }
    const l = await creerLieu();
    if (!l) return null;
    entrerDansLieu(l.id); fil = [l.id];
    sauver(); rendre();
    dire(`Lieu « ${l.nom} » ajouté. Choisis l’outil Point, puis clique sur la carte pour relier un point à un autre lieu ou à un donjon.`);
    return l;
  }
  function renommerLieu(nomLieu) { modele.renommerLieu(univ(), lieuId, nomLieu); sauver(); rendre({ inspecteur: false }); }
  function notesDuLieu(texte) { modele.definirNotesLieu(univ(), lieuId, texte); sauver(); }
  function lieuDeDepart() { modele.definirRacine(univ(), lieuId); sauver(); rendre(); }
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
      modeLocal = 'selection';
      selectionner(p.id); saisie.cle = 'nom';
      sauver(); rendre();
    } catch (err) { dire(err.message, { erreur: true }); }
  }
  function modifierPoint(champs) { modele.modifierPoint(univ(), lieuId, pointId, champs); sauver(); }
  function changerDestination(vers) {
    modele.modifierPoint(univ(), lieuId, pointId, { vers });
    saisie.choixGenre = null;
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
      saisie.choixGenre = null;
      sauver();
      dire(`Lieu « ${l.nom} » ajouté et relié à ce point.`);
    }
    rendre();
  }
  function supprimerPoint() {
    modele.supprimerPoint(univ(), lieuId, pointId);
    selectionner(null); sauver(); rendre();
  }
  function entrerDansPoint() {
    const p = point();
    if (!p) return;
    if (!p.vers) { dire('Ce point ne mène nulle part pour l’instant : choisis une destination dans son panneau.'); rendre(); return; }
    if (p.vers.lieu !== undefined) {
      if (!(p.vers.lieu in univ().lieux)) { dire(`Destination perdue : ${orphelinDe(p) ?? 'lieu disparu'}.`, { erreur: true }); rendre(); return; }
      entrerDansLieu(p.vers.lieu);
      rendre();
      return;
    }
    if (!entrerDansDonjon(p.vers)) { dire(`Destination perdue : ${orphelinDe(p) ?? 'donjon disparu'}.`, { erreur: true }); rendre(); }
  }
  /** Va dans le donjon (et sa salle d'arrivée si elle existe encore) : la coquille change la scène, sélectionne le donjon dans l'arbre et écrit l'adresse. */
  function entrerDansDonjon(vers) {
    const d = donjons()[vers.donjon];
    if (!d) return false;
    ctx.coquille.naviguer({ page: 'donjon', donjon: d.id, ...(vers.salle && vers.salle in d.salles ? { salle: vers.salle } : {}) });
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
  }

  /** L'état vide du Monde : aucun monde, ou un monde sans lieu. */
  function rendreVide() {
    const u = univ();
    vide.hidden = !!lieu();
    if (lieu()) return;
    vide.replaceChildren(...(u
      ? [h('p', { className: 'note', textContent: 'Aucun lieu : ajoute la première carte (le continent, la région, le village…).' }), btn('Ajouter un lieu', () => ajouterLieuLibre(), { icone: 'plus' })]
      : [h('p', { className: 'note', textContent: 'Un monde rassemble des cartes qui s’emboîtent : le continent mène à une région, puis à un village, puis à un donjon.' }), btn('Créer un monde', () => creerMondeNeuf(), { icone: 'plus', classe: 'btn-primaire' })]));
  }

  // --- Calage de la grille (outil Grille) -----------------------------------------------------------------------------------------
  /** Ouvre le calage de la grille du lieu. Rend vrai s'il est ouvert (sinon un message dit pourquoi). */
  async function ouvrirCalage() {
    const l = lieu();
    if (!l) return false;
    const dims = carte.dimensions();
    if (!dims) { dire('La carte n’est pas encore chargée (ou introuvable) : on ne peut pas y caler une grille.', { erreur: true }); return false; }
    selectionner(null);
    const infos = await infosDe(l.image);
    if (!calagePossible(infos?.niveau)) { dire('Une carte de continent ou de région n’a pas de grille de case : le calage se fait sur une zone, une localité, un bâtiment ou un souterrain.'); rendre(); return false; }
    if (!calage.ouvrir({ lieu: l, infos, dims })) return false;
    modeLocal = 'selection';
    rendre();
    calage.focaliser();
    return true;
  }
  /** Le calage est-il proposé pour ce lieu ? (Niveau inconnu : oui ; continent et région : non.) */
  async function grillePossible() {
    const l = lieu();
    if (!l) return false;
    return calagePossible((await infosDe(l.image))?.niveau);
  }
  /** Change d'outil : 'selection', 'point' ou 'grille' (le calage s'ouvre, ou se ferme sans rien enregistrer). */
  async function definirMode(m) {
    if (m === 'grille') { if (!calage.actif()) await ouvrirCalage(); return mode(); }
    if (calage.actif()) calage.fermer();
    modeLocal = m === 'point' && lieu() ? 'point' : 'selection';
    if (modeLocal === 'point') selectionner(null);
    rendre();
    return mode();
  }
  const mode = () => (calage.actif() ? 'grille' : modeLocal);

  // --- Rendu général ------------------------------------------------------------------------------------------------------------
  /** Redessine la scène puis prévient l'atelier. `inspecteur: false` : le champ qu'on vient de quitter ne doit pas faire perdre un clic en redessinant le panneau. */
  function rendre(options = {}) {
    const u = univ();
    if (u && (!lieuId || !u.lieux[lieuId])) allerA(u.racine && u.lieux[u.racine] ? u.racine : Object.keys(u.lieux)[0] ?? null);
    if (pointId && !point()) selectionner(null);
    rendreFil();
    rendreVide();
    scene.classList.toggle('en-calage', calage.actif());
    carte.cadre.classList.toggle('mode-selection', modeLocal === 'selection' && !calage.actif());
    if (u) rendreCarte(); else zoneCarte.hidden = true;
    surChangement.forEach((f) => f(options));
  }

  // --- Ouverture : la scène du lieu remplace celle du Donjon (l'adresse et la barre sont à la coquille) ----------------------------------------------------
  /** Affiche la scène « lieu » : sur le monde `id` (le monde actif par défaut), au lieu `lieu` (celui de départ par défaut). */
  function ouvrirEcran({ id = null, lieu: voulu = null } = {}) {
    if (id && id in reserve.univers) reserve.actif = id;
    allerA(voulu && univ()?.lieux[voulu] ? voulu : univ()?.racine ?? null);
    ouvertEcran = true;
    scene.hidden = false;
    document.body.classList.add('univers-ouvert');
    rendre();
  }
  function fermerEcran() {
    ouvertEcran = false;
    modeLocal = 'selection'; selectionner(null); calage.fermer();
    scene.hidden = true;
    notifier('');
    document.body.classList.remove('univers-ouvert');
    surChangement.forEach((f) => f());
  }
  // Échap : quitte l'outil armé (calage, pose d'un point), puis lâche le point (le tiroir et le panneau bas, eux, sont à la coquille).
  document.addEventListener('keydown', (e) => {
    if (!ouvertEcran || e.key !== 'Escape' || e.defaultPrevented) return;
    if (calage.actif()) { e.preventDefault(); calage.fermer(); rendre(); dire('Calage abandonné : rien n’a été modifié.'); }
    else if (modeLocal === 'point') { e.preventDefault(); modeLocal = 'selection'; rendre(); } else if (pointId) { e.preventDefault(); selectionner(null); rendre(); }
  });

  if (charge.miseDeCote) {
    const phrase = stockage.phraseMiseDeCote(charge.miseDeCote).replace('données', 'mondes');
    ctx.annoncerCarte?.(phrase, !charge.miseDeCote.ok, 15000);
  }
  allerA(univ()?.racine ?? null);
  return {
    ouvrir: ouvrirEcran, fermer: fermerEcran, ouvert: () => ouvertEcran,
    // Pour la coquille de l'atelier (js/atelier/coquille.js) : les mondes, le lieu affiché, et un abonnement aux changements.
    donnees: () => ({ univers: reserve.univers, actif: reserve.actif }),
    lieu: () => lieuId,
    allerALieu: (id) => { allerA(id); rendre(); },
    surChangement: (f) => { surChangement.push(f); },
    // Pour les inspecteurs, la barre d'outils et le branchement (js/atelier/inscrire-monde.js, inspecteurs-monde.js, barre-lieu.js).
    monde: univ, lieuCourant: lieu, pointCourant: point, pointId: () => pointId, donjons, orphelinDe, saisie, infosDe, infosEnCache: (ref) => (infosCache.has(cleImage(ref)) ? infosCache.get(cleImage(ref)) : undefined),
    mode, definirMode, grillePossible, calage, dire,
    surPoint: (f) => { surPoint = f; },
    /** La sélection commune a changé (arbre, retour au lieu…) : le point choisi suit. */
    synchroniser(sel) {
      const id = sel?.type === 'point' && sel.contexte?.lieu === lieuId ? sel.id : null;
      if (id === pointId) return;
      if (id !== pointId) { saisie.choixGenre = null; saisie.cle = null; }
      pointId = id;
      if (ouvertEcran) rendreCarte();
    },
    creerMondeNeuf, renommerMonde, supprimerLeMonde, exporterMonde, importerMonde,
    ajouterLieuLibre, renommerLieu, notesDuLieu, lieuDeDepart, supprimerLeLieu, changerImage,
    poserPoint, modifierPoint, changerDestination, destinationNouvelleCarte, supprimerPoint, entrerDansPoint,
    selectionnerPoint: (id) => { modeLocal = 'selection'; selectionner(id); rendre(); },
    rendreCarte, rendre,
  };
}
