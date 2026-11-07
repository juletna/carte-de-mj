/**
 * Le Monde dans l'atelier du Donjon : la LOGIQUE de la carte d'un lieu et des données du monde (voir js/univers.js, docs/conception-univers.md
 * et docs/conception-atelier.md). Ce module ne construit plus d'écran : il pose la scène « lieu » (fil d'Ariane, carte, points, notifications)
 * dans `#cadre-scene`, et expose ses opérations à l'atelier. Le DOM des réglages est ailleurs :
 *   - js/atelier/inspecteurs-monde.js : les inspecteurs monde, lieu et point (nom, destination, grille, suppression…) ;
 *   - js/atelier/barre-lieu.js        : la barre d'outils (Calage, consigne des points) ;
 *   - js/atelier/inscrire-monde.js    : le branchement sur la coquille (arbre, « ⋯ », barre du haut, adresse).
 * Fabrique `creerUniversUI(ctx)` ; `ctx` est celui de main-mj.js (`etat`, `annoncerCarte`, `coquille` plus tard). Les identifiants de code, le
 * stockage et le format de fichier gardent le mot « univers » (compatibilité) ; seul ce qui s'affiche dit « monde ».
 * Rien ici ne retire une destination en silence : un lieu ou un donjon supprimé laisse des points orphelins, signalés.
 *
 * La carte n'a pas d'outil à choisir pour ses points (`mode()` : 'carte') : un clic dans le vide pose un point et ouvre sa bulle, accrochée à lui,
 * le nom prêt à taper (Entrée : fini ; un clic hors d'une bulle ouverte la referme seulement, sans poser de point) ; un clic sur un point ouvre sa
 * bulle (nom, destination, visible, Entrer, Supprimer ; contenu fourni par `definirBulle`), le glisser le déplace, Échap ferme la bulle, Suppr
 * supprime le point (« Annuler » le remet). Le panneau de droite ne change donc pas quand on choisit un point. Seul le calage est un mode.
 * Sous 760 px, pas de bulle : le point choisi devient la sélection commune de la coquille (type 'point', le panneau bas) ; `surPoint(f)`
 * prévient l'atelier, `synchroniser(sel)` le contraire. Le fil d'Ariane n'apparaît qu'à partir de deux niveaux (`filAriane`, rangé dans la barre).
 */
import * as stockage from '../stockage.js';
import * as modele from '../univers.js';
import { lireUnivers, validerUnivers } from '../univers-validation.js';
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
import { telephone } from '../telephone.js';
import { positionBulle } from '../mise-en-page.js';

const TAILLE_MAX_FICHIER = 5 * 1024 * 1024;
const DELAI_DOUBLE_CLIC = 450;

export function creerUniversUI(ctx) {
  const { etat } = ctx;
  const charge = stockage.chargerUnivers();
  const reserve = charge.etat ?? { actif: null, univers: {} };
  let lieuId = null;        // lieu affiché
  let fil = [];             // lieux traversés pour y arriver (fil d'Ariane), lieu affiché compris
  let pointId = null;       // point choisi (son inspecteur est ouvert)
  let focusApres = null;    // le point à qui rendre le focus clavier au prochain dessin de la carte
  let contenuBulle = null;  // (conteneur, point, univers) → remplit la bulle d'un point (js/atelier/inspecteurs-monde.js, `definirBulle`)
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
  // La bulle du point choisi, accrochée à lui sur la carte (sur ordinateur ; sous 760 px, le panneau bas fait ce travail).
  const bulle = h('div', { className: 'univers-bulle', role: 'dialog', 'aria-label': 'Point de la carte', hidden: true });
  bulle.addEventListener('focusin', (e) => { if (e.target.dataset?.cle) saisie.cle = e.target.dataset.cle; });
  const scene = h('section', { className: 'univers-scene', id: 'scene-monde', 'aria-label': 'Carte du lieu', hidden: true }, filAriane, zoneCarte, vide, bulle, zoneNotifications);
  $('cadre-scene').append(scene);

  // Lieu sans image : sur son fond neutre, un seul bouton pour y poser l'image (les points se posent et se relient comme sur n'importe quelle carte).
  const fondAction = h('div', { className: 'univers-fond-action', hidden: true },
    btn('Choisir une image', (e) => { e.stopPropagation(); changerImage(); }, { icone: 'bibliotheque', classe: 'btn-discret' }));
  const carte = creerCarteUnivers(zoneCarte, {
    onPoint: (id) => {
      if (calage.actif()) return;
      const maintenant = Date.now();
      const double = dernierClic.id === id && maintenant - dernierClic.t < DELAI_DOUBLE_CLIC;
      dernierClic = { id, t: double ? 0 : maintenant };
      selectionner(id);
      if (double) entrerDansPoint(); else rendre();
    },
    // Poser un point est le geste principal : un clic dans le vide le fait. Mais une bulle ouverte se referme d'abord, comme toute bulle :
    // ce clic-là ne pose rien (le suivant, si). Pour enchaîner : clic, nom, Entrée, clic…
    onVide: (x, y) => {
      if (calage.actif()) return;
      if (bulleOuverte()) { selectionner(null); rendre(); return; }
      poserPoint(x, y);
    },
    onDeplace: (id, x, y) => { modele.deplacerPoint(univ(), lieuId, id, x, y); selectionner(id); sauver(); rendre(); },
  });
  carte.cadre.append(fondAction);
  zoneCarte.addEventListener('click', (e) => { if (e.target === zoneCarte && pointId) { selectionner(null); rendre(); } });
  zoneCarte.addEventListener('scroll', () => placerBulle(), { passive: true });
  window.addEventListener('resize', () => placerBulle());

  // Le calage de la grille d'un lieu (js/mj/univers-calage.js) : l'outil Calage de la barre ; ses réglages sont dans l'inspecteur du lieu.
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
  const cleImage = (ref) => `${ref?.source}:${ref?.id}`;
  async function infosDe(ref) {
    if (!ref) return null; // lieu à illustrer
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
    dire('Monde créé. Nomme-le, puis choisis la carte du monde (l’archipel, le continent, la région…).');
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
    allerA(univ() ? modele.carteDuMonde(univ()) : null);
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
      return accueillirMonde(lireUnivers(await fichier.text()));
    } catch (err) {
      dire(`Import impossible : ${err.message}`, { erreur: true });
      return null;
    }
  }
  /** Le monde déjà lu (objet JSON) : l'import unique de l'atelier (js/atelier/importer.js) a reconnu son format. Rend le monde importé, ou null. */
  function importerMondeLu(brut) {
    const v = validerUnivers(brut);
    if (!v.univers) { dire(`Import impossible : ${v.erreurs.join(' · ')}`, { erreur: true }); return null; }
    return accueillirMonde(v);
  }
  function accueillirMonde({ univers: u, avertissements }) {
    if (u.id in reserve.univers) u.id = idUnique('u', Object.keys(reserve.univers)); // un monde déjà là n'est jamais écrasé
    reserve.univers[u.id] = u;
    reserve.actif = u.id;
    allerA(modele.carteDuMonde(u));
    sauver();
    rendre();
    dire(`« ${u.nom} » importé${avertissements.length ? ` · ${avertissements.join(' · ')}` : ''}.`);
    return u;
  }

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

  /** Ouvre le choix d'une carte. `sansImage` : la fenêtre propose aussi « Sans image pour l'instant » (rend alors `images.SANS_IMAGE`). Null si annulé. */
  async function demanderImage({ sansImage = false } = {}) {
    try { return await images.choisirCarte({ sansImage }); } catch (err) { dire(err.message, { erreur: true }); return null; }
  }
  /**
   * Crée un lieu : la fenêtre de choix de la carte propose « Sans image pour l'instant » (le plan d'abord, les images ensuite). Avec une image,
   * le lieu est nommé `nomImpose` s'il est donné, sinon d'après l'image ; sans image, d'après `nomImpose` ou « Lieu N ».
   * Rend le lieu, ou null (annulé, ou limite atteinte).
   */
  async function creerLieu(nomImpose = '') {
    const ref = await demanderImage({ sansImage: true });
    if (!ref) return null;
    const sans = images.estSansImage(ref);
    const infos = sans ? null : await images.infosImage(ref);
    try {
      return modele.ajouterLieu(univ(), { nom: nomDuNouveauLieu(nomImpose, infos?.titre), ...(sans ? {} : { image: ref }) });
    } catch (err) { dire(err.message, { erreur: true }); return null; }
  }
  async function ajouterLieuLibre() {
    if (!univ()) { dire('Crée d’abord un monde : un lieu est une carte de ce monde.', { erreur: true }); return null; }
    const premier = !Object.keys(univ().lieux).length; // la première carte est celle du monde : elle prend son nom
    const l = await creerLieu(premier ? univ().nom : '');
    if (!l) return null;
    entrerDansLieu(l.id); fil = [l.id];
    if (!l.image && !premier) saisie.cle = 'lieu-nom'; // sans image, rien ne le nomme : le nom est la première chose à saisir
    sauver(); rendre();
    // Le panneau montre le lieu neuf ; la première carte, elle, est celle du monde : son panneau est celui du monde.
    if (!premier) ctx.coquille?.naviguer({ page: 'monde', monde: univ().id, lieu: l.id });
    dire(`${premier ? 'Carte du monde choisie' : `Lieu « ${l.nom} » ajouté`}${l.image ? '' : ' sans image : un fond neutre en attendant'}. Clique sur la carte pour poser un point, tape son nom, Entrée.`);
    return l;
  }
  function renommerLieu(nomLieu) { modele.renommerLieu(univ(), lieuId, nomLieu); sauver(); rendre({ inspecteur: false }); }
  function notesDuLieu(texte) { modele.definirNotesLieu(univ(), lieuId, texte); sauver(); }
  /** Le lieu affiché devient le départ de la partie (la carte du monde l'est par défaut : la choisir retire le réglage). */
  function definirDepart() { modele.definirDepart(univ(), lieuId); sauver(); rendre(); }
  function supprimerLeLieu() {
    const l = lieu();
    const entrees = modele.pointsVers(univ(), l.id).length;
    const etaitRacine = univ().racine === l.id, etaitDepart = modele.lieuDeDepart(univ()) === l.id;
    const retire = modele.supprimerLieu(univ(), l.id);
    retraits = [{ univers: univ().id, lieu: retire, racine: etaitRacine, depart: etaitDepart }];
    fil = fil.filter((id) => id !== l.id);
    allerA(fil.at(-1) ?? modele.carteDuMonde(univ()), { nouveauFil: !fil.length });
    sauver(); rendre();
    dire(`« ${l.nom} » est retiré${entrees ? ` ; ${pluriel(entrees, 'point y menait', 'points y menaient')} et reste${entrees > 1 ? 'nt' : ''} signalé${entrees > 1 ? 's' : ''} comme orphelin${entrees > 1 ? 's' : ''}` : ''}.`, {
      action: { libelle: 'Annuler', faire: () => {
        const r = retraits.pop();
        if (r && reserve.univers[r.univers]) { modele.retablirLieu(reserve.univers[r.univers], r.lieu, { racine: r.racine, depart: r.depart }); allerA(r.lieu.id); sauver(); rendre(); dire('Lieu rétabli.'); }
      } },
    });
  }
  async function changerImage() {
    const ref = await demanderImage();
    if (!ref || images.estSansImage(ref)) return;
    modele.definirImageLieu(univ(), lieuId, ref);
    sauver(); rendre();
  }

  // --- Points -----------------------------------------------------------------------------------------
  /** Pose un point et le choisit : sa bulle s'ouvre (sous 760 px, le panneau bas), le nom prêt à taper. */
  function poserPoint(x, y) {
    try {
      const p = modele.ajouterPoint(univ(), lieuId, { x, y, nom: '' });
      selectionner(p.id); saisie.cle = 'nom';
      sauver(); rendre();
    } catch (err) { dire(err.message, { erreur: true }); }
  }
  /** Le nom tapé dans la bulle : la carte (l'étiquette) et le panneau suivent à chaque frappe, sans redessiner la bulle (le champ garde la main). */
  function nommerPoint(nom) {
    if (!point()) return;
    modifierPoint({ nom });
    rendreCarte();
    surChangement.forEach((f) => f({ bulle: false }));
  }
  /** Referme la bulle (Entrée dans le nom, ✕, Échap) ; le focus clavier revient au point, pour continuer au clavier. */
  function fermerBulle() {
    const id = pointId;
    if (!id) return;
    if (bulle.contains(document.activeElement)) focusApres = id;
    selectionner(null);
    rendre();
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
      modele.modifierPoint(univ(), lid, pid, { vers: { lieu: l.id }, ...(point().nom || !l.image ? {} : { nom: l.nom }) }); // sans image, le lieu n'a que son nom par défaut : le point n'en prend pas
      saisie.choixGenre = null;
      sauver();
      dire(`Lieu « ${l.nom} » ajouté${l.image ? '' : ' sans image'} et relié à ce point.`);
    }
    rendre();
  }
  /** Supprime le point choisi (menu du panneau, ou Suppr sur la carte) ; « Annuler » dans la notification le remet à sa place. */
  function supprimerPoint() {
    const u = univ(), lid = lieuId;
    const index = lieu().points.findIndex((p) => p.id === pointId);
    const retire = modele.supprimerPoint(u, lid, pointId);
    selectionner(null); sauver(); rendre();
    dire(`Point « ${retire.nom || 'sans nom'} » supprimé.`, {
      action: { libelle: 'Annuler', faire: () => {
        if (!u.lieux[lid]) return;
        try { const p = modele.retablirPoint(u, lid, retire, index); if (lieuId === lid) selectionner(p.id); } catch (err) { dire(err.message, { erreur: true }); return; }
        sauver(); rendre(); dire('Point rétabli.');
      } },
    });
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
    filAriane.hidden = !u || fil.length < 2; // un seul niveau : le nom est déjà dans l'arbre et dans le panneau
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
      titre: `${p.depart ? 'Départ de la carte : ' : ''}${p.nom || 'Point sans nom'} → ${modele.nomDestination(univ(), p.vers, donjons())}${orphelinDe(p) ? ` (${orphelinDe(p)})` : ''}`,
      classes: [p.cache ? 'cache' : '', p.depart ? 'depart' : '', orphelinDe(p) ? 'orphelin' : '', !p.vers ? 'libre' : '', p.id === pointId ? 'choisi' : '', enCalage ? 'transparent' : ''].filter(Boolean),
      selectionne: p.id === pointId,
    }));
    // En calage, les points restent visibles en transparence (sans qu'on puisse les toucher) et les repères de « Mesurer » s'y ajoutent.
    const pointsCarte = enCalage ? [...pointsLieu, ...calage.marqueurs()] : pointsLieu;
    const infos = await infosDe(l.image);
    if (moi !== sequence) return;
    fondAction.hidden = !!l.image || enCalage;
    const aff = enCalage ? calage.grilleAffichee() : { grille: grilleEffective(l, infos).grille, opacite: casesDeReglages(stockage.chargerReglages() ?? {}) / 100 };
    const options = { points: pointsCarte, modifiable: !enCalage, poser: !enCalage, alt: `Carte : ${l.nom}`, ...aff };
    const cle = l.image ? cleImage(l.image) : `fond:${l.nom}`;
    if (imageAffichee !== cle) carte.afficher({ ...options, url: null, absente: 'Chargement de l’image…' });
    const url = await images.urlLieu(l);
    if (moi !== sequence) return;
    imageAffichee = url ? cle : null;
    carte.afficher({ ...options, url, absente: 'Image introuvable : la carte n’est plus dans la bibliothèque ou dans ce navigateur (ou la bibliothèque n’est pas disponible). Les points restent posés ; choisis une autre image.' });
    if (focusApres) { carte.focaliser(focusApres); focusApres = null; }
    placerBulle();
  }

  // --- La bulle du point choisi --------------------------------------------------------------------------------------------
  const bulleOuverte = () => !bulle.hidden;
  /** Remplit la bulle (ou la cache : pas de point, calage, téléphone). Le champ qui avait le focus le retrouve (`saisie.cle`). */
  function rendreBulle() {
    const p = point();
    const visible = !!(p && ouvertEcran && !calage.actif() && !telephone() && contenuBulle);
    const cle = bulle.contains(document.activeElement) ? document.activeElement.dataset?.cle ?? saisie.cle : saisie.cle;
    bulle.hidden = !visible;
    if (!visible) { bulle.replaceChildren(); return; }
    bulle.replaceChildren();
    contenuBulle(bulle, p, univ());
    const el = cle && bulle.querySelector(`[data-cle="${cle}"]`);
    if (el) { el.focus({ preventScroll: true }); if (cle === 'nom' && !el.value) el.select?.(); }
    placerBulle();
  }
  /** Accroche la bulle à son point, sans qu'elle sorte de la scène (règle pure `positionBulle`, js/mise-en-page.js). */
  function placerBulle() {
    if (bulle.hidden || !pointId) return;
    const m = carte.marqueur(pointId);
    if (!m) return;
    const r = m.querySelector('.univers-pastille')?.getBoundingClientRect() ?? m.getBoundingClientRect();
    const s = scene.getBoundingClientRect();
    const z = zoneCarte.getBoundingClientRect();
    const vue = { g: z.left - s.left + 8, h: z.top - s.top + 8, d: z.right - s.left - 8, b: z.bottom - s.top - 8 };
    const { x, y } = positionBulle({ g: r.left - s.left, h: r.top - s.top, d: r.right - s.left, b: r.bottom - s.top }, vue, bulle.offsetWidth, bulle.offsetHeight);
    bulle.style.left = `${Math.round(x)}px`;
    bulle.style.top = `${Math.round(y)}px`;
  }

  /** L'état vide du Monde : aucun monde, ou un monde sans lieu. */
  function rendreVide() {
    const u = univ();
    vide.hidden = !!lieu();
    if (lieu()) return;
    vide.replaceChildren(...(u
      ? [h('p', { className: 'note', textContent: 'Ce monde n’a pas encore de carte : choisis celle du monde (l’archipel, le continent, la région…).' }), btn('Choisir la carte du monde', () => ajouterLieuLibre(), { icone: 'plus' })]
      : [h('p', { className: 'note', textContent: 'Un monde rassemble des cartes qui s’emboîtent : le continent mène à une région, puis à un village, puis à un donjon.' }), btn('Créer un monde', () => creerMondeNeuf(), { icone: 'plus', classe: 'btn-primaire' })]));
  }

  // --- Calage de la grille (outil Grille) -----------------------------------------------------------------------------------------
  /** Ouvre le calage de la grille du lieu. Rend vrai s'il est ouvert (sinon un message dit pourquoi). */
  async function ouvrirCalage() {
    const l = lieu();
    if (!l) return false;
    if (!l.image) { dire('Un lieu sans image n’a pas de grille à caler : choisis d’abord une image.'); return false; }
    const dims = carte.dimensions();
    if (!dims) { dire('La carte n’est pas encore chargée (ou introuvable) : on ne peut pas y caler une grille.', { erreur: true }); return false; }
    selectionner(null);
    const infos = await infosDe(l.image);
    if (!calagePossible(infos?.niveau)) { dire('Une carte de monde ou de lieu n’a pas de grille de case : le calage se fait sur un plateau (extérieur, intérieur ou souterrain).'); rendre(); return false; }
    if (!calage.ouvrir({ lieu: l, infos, dims })) return false;
    rendre();
    calage.focaliser();
    return true;
  }
  /** Le calage est-il proposé pour ce lieu ? (Niveau inconnu : oui ; continent et région : non.) */
  async function grillePossible() {
    const l = lieu();
    if (!l) return false;
    if (!l.image) return false; // pas d'image, pas de calage
    return calagePossible((await infosDe(l.image))?.niveau);
  }
  /** Change d'outil : 'grille' ouvre le calage ; tout autre mode le ferme sans rien enregistrer (la carte pose et choisit les points d'elle-même). */
  async function definirMode(m) {
    if (m === 'grille') { if (!calage.actif()) await ouvrirCalage(); return mode(); }
    if (calage.actif()) calage.fermer();
    rendre();
    return mode();
  }
  const mode = () => (calage.actif() ? 'grille' : 'carte');

  // --- Rendu général ------------------------------------------------------------------------------------------------------------
  /** Redessine la scène puis prévient l'atelier. `inspecteur: false` : le champ qu'on vient de quitter ne doit pas faire perdre un clic en redessinant le panneau. */
  function rendre(options = {}) {
    const u = univ();
    if (u && (!lieuId || !u.lieux[lieuId])) allerA(modele.carteDuMonde(u));
    if (pointId && !point()) selectionner(null);
    rendreFil();
    rendreVide();
    scene.classList.toggle('en-calage', calage.actif());
    if (u) rendreCarte(); else zoneCarte.hidden = true;
    rendreBulle();
    surChangement.forEach((f) => f(options));
  }

  // --- Ouverture : la scène du lieu remplace celle du Donjon (l'adresse et la barre sont à la coquille) ----------------------------------------------------
  /** Affiche la scène « lieu » : sur le monde `id` (le monde actif par défaut), au lieu `lieu` (la carte du monde par défaut). */
  function ouvrirEcran({ id = null, lieu: voulu = null } = {}) {
    if (id && id in reserve.univers) reserve.actif = id;
    allerA(voulu && univ()?.lieux[voulu] ? voulu : univ() ? modele.carteDuMonde(univ()) : null);
    ouvertEcran = true;
    scene.hidden = false;
    document.body.classList.add('univers-ouvert');
    rendre();
  }
  function fermerEcran() {
    ouvertEcran = false;
    selectionner(null); calage.fermer();
    scene.hidden = true;
    notifier('');
    document.body.classList.remove('univers-ouvert');
    surChangement.forEach((f) => f());
  }
  // Échap : quitte le calage, sinon lâche le point (le tiroir et le panneau bas, eux, sont à la coquille ; le champ du nom sur la carte se ferme lui-même).
  // Suppr (ou retour arrière) : supprime le point choisi, hors d'un champ de saisie ; « Annuler » le remet.
  // (Suppr ne vaut que sur la carte ou sans focus : dans le panneau, un retour arrière sur un bouton ne doit rien effacer.)
  const surLaCarte = (el) => el === document.body || (scene.contains(el) && !bulle.contains(el) && !el.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
  document.addEventListener('keydown', (e) => {
    if (!ouvertEcran || e.defaultPrevented) return;
    if (e.key === 'Escape') {
      if (calage.actif()) { e.preventDefault(); calage.fermer(); rendre(); dire('Calage abandonné : rien n’a été modifié.'); }
      else if (pointId) { e.preventDefault(); fermerBulle(); }
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && pointId && point() && !calage.actif() && surLaCarte(e.target)) {
      e.preventDefault();
      supprimerPoint();
    }
  });

  if (charge.miseDeCote) {
    const phrase = stockage.phraseMiseDeCote(charge.miseDeCote).replace('données', 'mondes');
    ctx.annoncerCarte?.(phrase, !charge.miseDeCote.ok, 15000);
  }
  allerA(univ() ? modele.carteDuMonde(univ()) : null);
  return {
    ouvrir: ouvrirEcran, fermer: fermerEcran, ouvert: () => ouvertEcran,
    // Pour la coquille de l'atelier (js/atelier/coquille.js) : les mondes, le lieu affiché, et un abonnement aux changements.
    donnees: () => ({ univers: reserve.univers, actif: reserve.actif }),
    lieu: () => lieuId,
    allerALieu: (id) => { allerA(id); rendre(); },
    /** L'opacité de la grille a changé (réglage commun) : la carte du lieu la relit. */
    redessinerGrille: () => { if (ouvertEcran) rendreCarte(); },
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
      if (ouvertEcran) { rendreCarte(); rendreBulle(); }
    },
    creerMondeNeuf, renommerMonde, supprimerLeMonde, exporterMonde, importerMonde, importerMondeLu,
    ajouterLieuLibre, renommerLieu, notesDuLieu, definirDepart, supprimerLeLieu, changerImage,
    poserPoint, nommerPoint, fermerBulle, modifierPoint,
    /** `f(conteneur, point, univers)` remplit la bulle du point choisi (js/atelier/inspecteurs-monde.js). */
    definirBulle: (f) => { contenuBulle = f; rendreBulle(); },
    filAriane, changerDestination, destinationNouvelleCarte, supprimerPoint, entrerDansPoint,
    selectionnerPoint: (id) => { selectionner(id); rendre(); },
    rendreCarte, rendre,
  };
}
