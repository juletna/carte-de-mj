/**
 * Mode Univers du Donjon : préparer un univers de cartes imbriquées (voir js/univers.js et docs/conception-univers.md).
 * Un écran par-dessus la page : choisir ou créer un univers, ajouter des lieux (cartes image), poser des points d'un clic,
 * leur donner une destination (nouveau lieu, lieu existant, donjon existant), entrer dans la destination, remonter par le fil d'Ariane.
 * Fabrique `creerUniversUI(ctx)` ; `ctx` est celui de main-mj.js (`etat`, `afficherSalleActive`, `activerSalle`). Renvoie `ouvrir`, `fermer`, `ouvert`.
 * Rien ici ne retire une destination en silence : un lieu ou un donjon supprimé laisse des points orphelins, signalés.
 */
import * as stockage from '../stockage.js';
import * as modele from '../univers.js';
import { lireUnivers } from '../univers-validation.js';
import { creerCarteUnivers } from '../univers-carte.js';
import * as images from '../univers-images.js';
import { creerCalage } from './univers-calage.js';
import { grilleEffective } from '../univers-grille.js';
import { casesDeReglages } from '../affichage.js';
import { idUnique } from '../donjon.js';
import { $, h, bouton, deuxTemps, fichierChoisi } from '../dom.js';
import { pluriel, sansAccents } from '../format.js';

const TAILLE_MAX_FICHIER = 5 * 1024 * 1024;

export function creerUniversUI(ctx) {
  const { etat } = ctx;
  const racine = $('univers');
  const charge = stockage.chargerUnivers();
  const reserve = charge.etat ?? { actif: null, univers: {} };
  let lieuId = null;        // lieu affiché
  let fil = [];             // lieux traversés pour y arriver (fil d'Ariane), lieu affiché compris
  let pointId = null;       // point sélectionné
  let arme = false;         // prochain clic sur la carte : pose un point
  let sequence = 0;         // pour ignorer une URL d'image qui arrive après un changement de lieu
  let retraits = [];        // lieux retirés, pour « Annuler »

  const univ = () => reserve.univers[reserve.actif] ?? null;
  const lieu = () => univ()?.lieux[lieuId] ?? null;
  const point = () => lieu()?.points.find((p) => p.id === pointId) ?? null;

  // --- Squelette -----------------------------------------------------------------------------------
  const choix = h('select', { id: 'univers-choix', 'aria-label': 'Univers' });
  const nom = h('input', { id: 'univers-nom', type: 'text', maxLength: 80, spellcheck: false, 'aria-label': 'Nom de l’univers' });
  const nouveau = bouton('+ Nouvel univers', () => creerUniversNeuf(), 'discret');
  const exporter = bouton('Exporter', () => exporterUnivers(), 'discret');
  const importer = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  const supprimer = h('button', { type: 'button', className: 'discret' });
  const fermer = bouton('✕ Fermer', () => fermerEcran(), 'discret');
  const barre = h('header', { className: 'univers-barre' }, h('strong', { textContent: '🌍 Univers' }), choix, nom, nouveau, exporter,
    h('label', { className: 'bouton' }, 'Importer ', importer), supprimer, fermer);
  const message = h('p', { className: 'note', role: 'status', hidden: true });
  const filAriane = h('nav', { className: 'univers-fil', 'aria-label': 'Fil d’Ariane' });
  const zoneCarte = h('div', { className: 'univers-zone-carte' });
  const scene = h('section', { className: 'univers-scene' }, filAriane, zoneCarte);
  const panneau = h('aside', { className: 'univers-panneau', 'aria-label': 'Lieux et points' });
  racine.replaceChildren(barre, message, h('div', { className: 'univers-corps' }, scene, panneau));
  racine.setAttribute('role', 'dialog');
  racine.setAttribute('aria-label', 'Univers');

  const carte = creerCarteUnivers(zoneCarte, {
    onPoint: (id) => { if (calage.actif()) return; pointId = id; arme = false; rendre(); },
    onVide: (x, y) => { if (!calage.actif()) poserPoint(x, y); },
    onDeplace: (id, x, y) => { modele.deplacerPoint(univ(), lieuId, id, x, y); pointId = id; sauver(); rendre(); },
  });

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
  function dire(texte, { erreur = false, action = null } = {}) {
    message.hidden = !texte;
    message.className = `note${erreur ? ' erreur' : ''}`;
    message.replaceChildren(texte);
    if (texte && action) message.append(' ', bouton(action.libelle, action.faire, 'discret petit'));
  }
  function sauver() {
    if (!stockage.sauverUnivers(reserve)) dire('Les modifications n’ont pas pu être enregistrées dans ce navigateur (stockage plein, bloqué, ou données à sauvegarder d’abord). Exporte l’univers pour ne rien perdre.', { erreur: true });
  }
  const donjons = () => etat.donjons;
  const orphelinDe = (p) => modele.raisonOrpheline(univ(), p.vers, donjons());
  const champ = (libelle, ...enfants) => h('label', { className: 'ligne' }, h('span', { textContent: libelle }), ...enfants);

  // --- Univers : choisir, créer, renommer, supprimer, exporter, importer ---------------------------------------
  function majBarre() {
    const ids = Object.keys(reserve.univers);
    choix.replaceChildren(...ids.map((id) => h('option', { value: id, textContent: reserve.univers[id].nom, selected: id === reserve.actif })));
    choix.hidden = !ids.length;
    choix.value = reserve.actif ?? '';
    nom.hidden = exporter.hidden = supprimer.hidden = !univ();
    nom.value = univ()?.nom ?? '';
  }
  choix.addEventListener('change', () => { if (choix.value in reserve.univers) { reserve.actif = choix.value; allerA(univ().racine); sauver(); rendre(); } });
  nom.addEventListener('change', () => { modele.renommerUnivers(univ(), nom.value); sauver(); rendre(); });

  function creerUniversNeuf() {
    const u = modele.creerUnivers({ nom: `Univers ${Object.keys(reserve.univers).length + 1}` });
    reserve.univers[u.id] = u;
    reserve.actif = u.id;
    lieuId = null; fil = []; pointId = null;
    sauver();
    rendre();
    nom.focus(); nom.select();
    dire('Univers créé. Nomme-le, puis ajoute sa première carte (le monde, la région…).');
  }
  deuxTemps(supprimer, 'Supprimer cet univers', 'Confirmer la suppression', () => {
    const u = univ();
    delete reserve.univers[u.id];
    stockage.supprimerPartieUnivers(u.id);
    reserve.actif = Object.keys(reserve.univers)[0] ?? null;
    allerA(univ()?.racine ?? null);
    sauver();
    rendre();
    dire(`« ${u.nom} » est supprimé (ses donjons, eux, sont intacts). Une copie reste dans le fichier exporté si tu l’avais exporté.`);
  });

  function telecharger(texte, fichier) {
    const a = h('a', { href: URL.createObjectURL(new Blob([texte], { type: 'application/json' })), download: fichier });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exporterUnivers() {
    const fichier = `${sansAccents(univ().nom).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'univers'}.json`;
    telecharger(modele.texteUnivers(univ()), fichier);
    dire('Fichier exporté : il cite les images par leur référence, sans les contenir.');
  }
  importer.addEventListener('change', async (e) => {
    const fichier = fichierChoisi(e);
    if (!fichier) return;
    try {
      if (fichier.size > TAILLE_MAX_FICHIER) throw new Error('fichier trop gros (5 Mo au plus)');
      const { univers: u, avertissements } = lireUnivers(await fichier.text());
      if (u.id in reserve.univers) u.id = idUnique('u', Object.keys(reserve.univers)); // un univers déjà là n'est jamais écrasé
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
    pointId = null; arme = false; calage.fermer();
  }
  function entrerDansLieu(id) {
    fil = [...fil.slice(0, fil.indexOf(lieuId) + 1), id];
    lieuId = id; pointId = null; arme = false; calage.fermer();
  }

  async function demanderImage() {
    try { return await images.choisirCarte({}); } catch (err) { dire(err.message, { erreur: true }); return null; }
  }
  /** Crée un lieu à partir d'une image choisie. Rend le lieu, ou null (annulé, ou limite atteinte). */
  async function creerLieu() {
    const ref = await demanderImage();
    if (!ref) return null;
    const infos = await images.infosImage(ref);
    try {
      return modele.ajouterLieu(univ(), { nom: infos?.titre, image: ref });
    } catch (err) { dire(err.message, { erreur: true }); return null; }
  }

  async function ajouterLieuLibre() {
    const l = await creerLieu();
    if (!l) return;
    entrerDansLieu(l.id); fil = [l.id];
    sauver(); rendre();
    dire(`Lieu « ${l.nom} » ajouté. Pose un point sur la carte pour le relier à un autre lieu ou à un donjon.`);
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
      pointId = p.id; arme = false;
      sauver(); rendre();
      dire('Point posé : nomme-le et choisis où il mène.');
      panneau.querySelector('.univers-point-nom')?.focus();
    } catch (err) { dire(err.message, { erreur: true }); }
  }
  function changerDestination(vers) {
    modele.modifierPoint(univ(), lieuId, pointId, { vers });
    sauver(); rendre();
  }
  async function destinationNouveauLieu() {
    const l = await creerLieu();
    if (l) { modele.modifierPoint(univ(), lieuId, pointId, { vers: { lieu: l.id }, ...(point().nom ? {} : { nom: l.nom }) }); sauver(); dire(`Lieu « ${l.nom} » ajouté et relié à ce point.`); }
    rendre();
  }
  function entrerDansPoint() {
    const p = point();
    if (!p?.vers) return;
    if (p.vers.lieu !== undefined) {
      if (!(p.vers.lieu in univ().lieux)) return;
      entrerDansLieu(p.vers.lieu);
      rendre();
      return;
    }
    const d = donjons()[p.vers.donjon];
    if (!d) return;
    etat.actif = d.id;
    fermerEcran({ rendreFocus: false });
    if (p.vers.salle && p.vers.salle in d.salles) ctx.activerSalle(p.vers.salle); else ctx.afficherSalleActive();
  }

  // --- Rendu ----------------------------------------------------------------------------------------------
  function rendreFil() {
    const u = univ();
    filAriane.hidden = !u || !fil.length;
    filAriane.replaceChildren();
    if (!u) return;
    fil.forEach((id, i) => {
      if (i) filAriane.append(h('span', { className: 'univers-sep', textContent: '›', 'aria-hidden': 'true' }));
      const nomLieu = u.lieux[id]?.nom ?? '(lieu disparu)';
      if (i === fil.length - 1) filAriane.append(h('strong', { textContent: nomLieu, 'aria-current': 'location' }));
      else filAriane.append(bouton(nomLieu, () => { fil = fil.slice(0, i + 1); allerA(id, { nouveauFil: false }); rendre(); }, 'discret petit'));
    });
    if (fil.length > 1) filAriane.append(bouton('↑ Remonter', () => { const id = fil.at(-2); fil = fil.slice(0, -1); allerA(id, { nouveauFil: false }); rendre(); }, 'discret petit univers-remonter'));
  }

  let imageAffichee = null; // clé de l'image déjà montrée : on ne la recharge pas à chaque rendu
  async function rendreCarte() {
    const l = lieu();
    const moi = ++sequence;
    zoneCarte.hidden = !l;
    if (!l) return;
    const enCalage = calage.actif();
    const pointsCarte = enCalage ? calage.marqueurs() : l.points.map((p) => ({
      id: p.id, x: p.x, y: p.y, nom: p.nom || '',
      titre: `${p.nom || 'Point sans nom'} → ${modele.nomDestination(univ(), p.vers, donjons())}${orphelinDe(p) ? ` (${orphelinDe(p)})` : ''}`,
      classes: [p.cache ? 'cache' : '', orphelinDe(p) ? 'orphelin' : '', !p.vers ? 'libre' : '', p.id === pointId ? 'choisi' : ''].filter(Boolean),
      selectionne: p.id === pointId,
    }));
    const infos = await infosDe(l.image);
    if (moi !== sequence) return;
    const aff = enCalage ? calage.grilleAffichee() : { grille: grilleEffective(l, infos).grille, opacite: casesDeReglages(stockage.chargerReglages() ?? {}) / 100 };
    const options = { points: pointsCarte, modifiable: !enCalage, arme: arme && !enCalage, alt: `Carte : ${l.nom}`, ...aff };
    const cle = cleImage(l.image);
    if (imageAffichee !== cle) carte.afficher({ ...options, url: null, absente: 'Chargement de l’image…' });
    const url = await images.urlImage(l.image);
    if (moi !== sequence) return;
    imageAffichee = url ? cle : null;
    carte.afficher({ ...options, url, absente: 'Image introuvable : la carte n’est plus dans la bibliothèque ou dans ce navigateur (ou la bibliothèque n’est pas disponible). Les points restent posés ; choisis une autre image.' });
  }

  function listeLieux() {
    const u = univ();
    const inaccessibles = new Set(modele.lieuxInaccessibles(u));
    const items = modele.listerLieux(u).map((l) => {
      const etiquettes = [l.id === u.racine ? 'départ' : '', inaccessibles.has(l.id) ? 'relié à rien' : ''].filter(Boolean).join(' · ');
      const b = bouton(l.nom, () => { allerA(l.id); rendre(); }, `discret petit univers-lieu${l.id === lieuId ? ' choisi' : ''}`);
      if (l.id === lieuId) b.setAttribute('aria-current', 'true');
      return h('li', {}, b, etiquettes ? h('span', { className: 'doux', textContent: ` ${etiquettes}` }) : '');
    });
    return h('section', {},
      h('h3', { textContent: 'Lieux' }),
      items.length ? h('ul', { className: 'univers-liste' }, ...items) : h('p', { className: 'note', textContent: 'Aucun lieu : ajoute la première carte (le monde, la région, le village…).' }),
      bouton('+ Ajouter un lieu', () => ajouterLieuLibre(), 'principal'));
  }

  function editionLieu() {
    const l = lieu();
    const orph = modele.orphelins(univ(), donjons()).filter((o) => o.lieu === l.id);
    const nomLieu = h('input', { type: 'text', maxLength: 80, value: l.nom, spellcheck: false });
    nomLieu.addEventListener('change', () => { modele.renommerLieu(univ(), l.id, nomLieu.value); sauver(); rendre(); });
    const notes = h('textarea', { rows: 3, maxLength: 20000, value: l.notes, spellcheck: true });
    notes.addEventListener('change', () => { modele.definirNotesLieu(univ(), l.id, notes.value); sauver(); });
    const depart = h('label', { className: 'ligne case' }, h('input', { type: 'checkbox', checked: univ().racine === l.id }), ' Lieu de départ de l’univers');
    depart.firstChild.addEventListener('change', (e) => { if (e.target.checked) { modele.definirRacine(univ(), l.id); sauver(); rendre(); } else e.target.checked = true; });
    const suppr = h('button', { type: 'button', className: 'discret' });
    deuxTemps(suppr, 'Supprimer ce lieu', 'Confirmer la suppression', supprimerLeLieu);
    const info = infosCache.get(cleImage(l.image)) ?? null;
    const eff = grilleEffective(l, info);
    const etatGrille = { lieu: `Grille calée : cases de ${String(eff.grille?.case).replace('.', ',')} px.`, catalogue: `Grille du catalogue : cases de ${String(eff.grille?.case).replace('.', ',')} px.`, aucune: 'Pas de grille.', ambiance: 'Carte d’ambiance, sans grille.' }[eff.origine];
    return h('section', {},
      h('h3', { textContent: 'Ce lieu' }),
      champ('Nom', nomLieu), champ('Notes', notes), depart,
      h('p', { className: 'note univers-etat-grille', textContent: etatGrille }),
      h('div', { className: 'actions' }, bouton('Caler la grille', () => ouvrirCalage(), 'discret'), bouton('Changer l’image', () => changerImage(), 'discret'), suppr),
      ...(orph.length ? [h('p', { className: 'note erreur', textContent: `${pluriel(orph.length, 'point mène', 'points mènent')} vers une destination qui n’existe plus : ils sont marqués ⚠, rien n’a été retiré.` })] : []));
  }

  async function ouvrirCalage() {
    const l = lieu();
    const dims = carte.dimensions();
    if (!dims) { dire('La carte n’est pas encore chargée (ou introuvable) : on ne peut pas y caler une grille.', { erreur: true }); return; }
    arme = false; pointId = null;
    const infos = await infosDe(l.image);
    if (!calage.ouvrir({ lieu: l, infos, dims })) return;
    dire('');
    rendre();
    calage.focaliser();
  }

  function listePoints() {
    const l = lieu();
    const items = l.points.map((p) => {
      const orph = orphelinDe(p);
      const b = bouton(`${orph ? '⚠ ' : ''}${p.cache ? '🙈 ' : ''}${p.nom || 'Point sans nom'}`, () => { pointId = p.id; arme = false; rendre(); }, `discret petit univers-ligne-point${p.id === pointId ? ' choisi' : ''}`);
      if (p.id === pointId) b.setAttribute('aria-current', 'true');
      return h('li', {}, b, h('span', { className: 'doux', textContent: ` → ${modele.nomDestination(univ(), p.vers, donjons())}${orph ? ` (${orph})` : ''}` }));
    });
    const poser = bouton(arme ? 'Clique sur la carte… (annuler)' : '+ Poser un point', () => { arme = !arme; if (arme) pointId = null; rendre(); }, arme ? 'principal' : '');
    poser.setAttribute('aria-pressed', String(arme));
    return h('section', {}, h('h3', { textContent: `Points (${l.points.length})` }), poser,
      items.length ? h('ul', { className: 'univers-liste' }, ...items) : h('p', { className: 'note', textContent: 'Aucun point : pose-en un d’un clic sur la carte.' }));
  }

  /** Les listes de la destination d'un point : le genre (aucune, nouveau lieu, lieu existant, donjon existant), puis la cible. */
  function editionDestination(p) {
    const u = univ();
    const genre = !p.vers ? '' : p.vers.lieu !== undefined ? 'lieu' : 'donjon';
    const typeSel = h('select', { 'aria-label': 'Destination' },
      h('option', { value: '', textContent: 'Aucune destination' }),
      h('option', { value: 'nouveau', textContent: 'Nouveau lieu (choisir une carte)…' }),
      h('option', { value: 'lieu', textContent: 'Lieu existant' }),
      h('option', { value: 'donjon', textContent: 'Donjon existant' }));
    typeSel.value = genre;
    typeSel.addEventListener('change', () => {
      const v = typeSel.value;
      if (v === '') changerDestination(null);
      else if (v === 'nouveau') { typeSel.value = genre; destinationNouveauLieu(); }
      else if (v === 'lieu') {
        const autre = modele.listerLieux(u).find((x) => x.id !== lieuId);
        if (autre) changerDestination({ lieu: autre.id }); else { typeSel.value = genre; dire('Il n’y a pas d’autre lieu : choisis « Nouveau lieu ».', { erreur: true }); }
      } else {
        const d = Object.values(donjons())[0];
        if (d) changerDestination({ donjon: d.id }); else { typeSel.value = genre; dire('Aucun donjon dans ce navigateur : crée-en un d’abord.', { erreur: true }); }
      }
    });
    const enfants = [champ('Mène à', typeSel)];
    const option = (valeur, texte, disabled = false) => h('option', { value: valeur, textContent: texte, disabled });
    if (genre === 'lieu') {
      const sel = h('select', { 'aria-label': 'Lieu' }, ...modele.listerLieux(u).filter((x) => x.id !== lieuId || x.id === p.vers.lieu).map((x) => option(x.id, x.nom)));
      if (!(p.vers.lieu in u.lieux)) sel.prepend(option(p.vers.lieu, '⚠ (lieu disparu)', true));
      sel.value = p.vers.lieu;
      sel.addEventListener('change', () => changerDestination({ lieu: sel.value }));
      enfants.push(champ('Lieu', sel));
    } else if (genre === 'donjon') {
      const sel = h('select', { 'aria-label': 'Donjon' }, ...Object.values(donjons()).map((d) => option(d.id, d.nom)));
      if (!donjons()[p.vers.donjon]) sel.prepend(option(p.vers.donjon, '⚠ (donjon disparu)', true));
      sel.value = p.vers.donjon;
      sel.addEventListener('change', () => changerDestination({ donjon: sel.value }));
      enfants.push(champ('Donjon', sel));
      const d = donjons()[p.vers.donjon];
      if (d) {
        const salle = h('select', { 'aria-label': 'Salle d’arrivée' }, option('', 'Celle que le donjon affichait'), ...Object.values(d.salles).map((s) => option(s.id, s.nom)));
        if (p.vers.salle && !(p.vers.salle in d.salles)) salle.append(option(p.vers.salle, '⚠ (salle disparue)', true));
        salle.value = p.vers.salle ?? '';
        salle.addEventListener('change', () => changerDestination({ donjon: d.id, ...(salle.value ? { salle: salle.value } : {}) }));
        enfants.push(champ('Salle d’arrivée', salle));
      }
    }
    return enfants;
  }

  function editionPoint() {
    const p = point();
    if (!p) return null;
    const orph = orphelinDe(p);
    const nomPoint = h('input', { type: 'text', className: 'univers-point-nom', maxLength: 80, value: p.nom, spellcheck: false, placeholder: 'Nom du point' });
    nomPoint.addEventListener('change', () => { modele.modifierPoint(univ(), lieuId, p.id, { nom: nomPoint.value }); sauver(); rendre(); });
    const cache = h('input', { type: 'checkbox', checked: !!p.cache });
    cache.addEventListener('change', () => { modele.modifierPoint(univ(), lieuId, p.id, { cache: cache.checked }); sauver(); rendre(); });
    const suppr = h('button', { type: 'button', className: 'discret' });
    deuxTemps(suppr, 'Supprimer ce point', 'Confirmer la suppression', () => { modele.supprimerPoint(univ(), lieuId, p.id); pointId = null; sauver(); rendre(); });
    const entrer = bouton(p.vers?.donjon ? 'Entrer dans le donjon' : 'Entrer dans ce lieu', () => entrerDansPoint(), 'principal');
    entrer.disabled = !p.vers || !!orph;
    return h('section', { className: 'univers-edition' },
      h('h3', { textContent: 'Point choisi' }),
      champ('Nom', nomPoint), ...editionDestination(p),
      ...(orph ? [h('p', { className: 'note erreur', textContent: `⚠ Destination perdue : ${orph}. Choisis-en une autre ; rien n’a été retiré.` })] : []),
      h('label', { className: 'ligne case' }, cache, ' Caché : la table ne le voit que si tu le révèles'),
      h('p', { className: 'note', textContent: 'Glisse le point sur la carte, ou utilise les flèches du clavier, pour le déplacer.' }),
      h('div', { className: 'actions' }, entrer, suppr));
  }

  function rendre() {
    const u = univ();
    if (u && (!lieuId || !u.lieux[lieuId])) allerA(u.racine && u.lieux[u.racine] ? u.racine : Object.keys(u.lieux)[0] ?? null);
    if (pointId && !point()) pointId = null;
    majBarre();
    rendreFil();
    if (!u) {
      panneau.replaceChildren(h('p', { className: 'note', textContent: 'Un univers rassemble des cartes qui s’emboîtent : le monde mène à une région, puis à un village, puis à un donjon.' }),
        bouton('+ Créer un univers', () => creerUniversNeuf(), 'principal'));
      zoneCarte.hidden = true;
      return;
    }
    if (calage.actif() && lieu()) panneau.replaceChildren(calage.panneau());
    else panneau.replaceChildren(listeLieux(), ...(lieu() ? [editionLieu(), listePoints(), editionPoint()].filter(Boolean) : []));
    rendreCarte();
  }

  // --- Ouverture ----------------------------------------------------------------------------------------
  const declencheur = $('univers-bouton');
  function ouvrirEcran() {
    racine.hidden = false;
    document.body.classList.add('univers-ouvert');
    declencheur?.setAttribute('aria-expanded', 'true');
    rendre();
    (racine.querySelector('.univers-panneau button, .univers-barre button') ?? fermer).focus();
  }
  function fermerEcran({ rendreFocus = true } = {}) {
    racine.hidden = true;
    arme = false; calage.fermer();
    document.body.classList.remove('univers-ouvert');
    declencheur?.setAttribute('aria-expanded', 'false');
    if (rendreFocus) declencheur?.focus();
  }
  declencheur?.addEventListener('click', () => (racine.hidden ? ouvrirEcran() : fermerEcran()));
  racine.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    e.preventDefault();
    if (calage.actif()) { calage.fermer(); rendre(); } else if (arme) { arme = false; rendre(); } else fermerEcran();
  });

  if (charge.miseDeCote) {
    const phrase = stockage.phraseMiseDeCote(charge.miseDeCote).replace('données', 'univers');
    ctx.annoncerCarte?.(phrase, !charge.miseDeCote.ok, 15000);
  }
  allerA(univ()?.racine ?? null);
  return { ouvrir: ouvrirEcran, fermer: fermerEcran, ouvert: () => !racine.hidden };
}
