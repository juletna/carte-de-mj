/**
 * Les univers dans la RÉGIE (presentation.html) : l'écran de départ les propose, la régie navigue de carte en carte, révèle des points,
 * entre dans un donjon (sa partie de donjon, au format inchangé, s'ouvre ou se reprend) et remonte. À la table : la carte en grand et
 * seulement les points visibles ou révélés (voir univers-protocole.js : la référence de l'image part, jamais l'image).
 * Fabrique `creerRegieUnivers(ctx)` ; `ctx` est celui de regie.js (`etat`, `r`, `commande`, `canal`, `annoncer`, `entrer`, `depart`, `rendre`,
 * `viderSauvegarde`, `noterRetrait`, `quitterPleinIci`, `prendreLaMain`), lu au moment de l'appel.
 * Renvoie `listerDepart` (l'écran de départ), `diffuser` (vrai si la table a reçu une carte d'univers), `majFil` (le fil d'Ariane de la régie de donjon).
 */
import * as stockage from './stockage.js';
import * as pres from './presentation.js';
import * as modele from './univers.js';
import * as pu from './univers-partie.js';
import { messageUnivers, CENTRE, bornerDefilement as pu_borner } from './univers-protocole.js';
import { creerCarteUnivers } from './univers-carte.js';
import * as images from './univers-images.js';
import { affichageDeReglages, casesDeReglages } from './affichage.js';
import { grilleEffective } from './univers-grille.js';
import { $, h, deuxTemps } from './dom.js';
import { btn } from './univers-boutons.js';
import { icone } from './icones.js';
import { pluriel } from './format.js';
import { creerFilCompact } from './atelier/fil-compact.js';
import { cartoucheLieu } from './atelier/cartouche.js';
import { creerSection } from './atelier/section.js';
import { creerListe } from './atelier/liste.js';
import { placerPopover } from './popover-element.js';

export function creerRegieUnivers(ctx) {
  const { etat } = ctx;
  let courant = null;   // { univers, partie } : l'univers dont la carte est affichée (ou dont on est dans un donjon)
  let pointId = null;   // point choisi sur la carte
  let consulte = null;  // le lieu que la régie regarde sans que la table y soit (jamais enregistré) ; null : la régie regarde le lieu de la table
  let sequence = 0;
  let defil = { ...CENTRE }; // la partie de la carte montrée à la table quand elle dépasse son écran (voir univers-protocole.js)
  let ordreDefil = 0;        // change à chaque commande, même « recentrer » deux fois de suite : la table n'applique que ce qui est nouveau
  const donjons = () => stockage.chargerDonjons()?.donjons ?? {};
  const universEnregistres = () => stockage.chargerUnivers().etat?.univers ?? {};

  const ecran = $('univers-regie');
  const titre = h('h1', { id: 'titre-univers-regie', tabIndex: -1 });
  const zoneCarte = h('div', { className: 'univers-zone-carte' });
  const panneau = $('panneau-lieu'); // l'onglet « Lieu » de l'inspecteur (js/atelier/jouer.js)
  ecran.querySelector('.univers-regie-corps').replaceChildren(titre, zoneCarte);
  const carte = creerCarteUnivers(zoneCarte, { onPoint: (id, centre) => { pointId = id; ancrePoint = centre ?? null; rendre(); } });

  function sauver() {
    if (!stockage.enregistrerPartieUnivers(courant.partie)) ctx.annoncer('Impossible d’enregistrer la partie de ce monde dans ce navigateur (stockage plein ou bloqué) : elle continue, mais ne pourra pas être reprise.', 12000);
  }
  // La grille du lieu : celle que le MJ a calée, sinon celle du catalogue (relue une fois par image, puis gardée).
  const infosParImage = new Map();
  const cleImage = (ref) => `${ref?.source}:${ref?.id}`;
  const grilleDuLieu = (lieu) => (lieu.image ? grilleEffective(lieu, infosParImage.get(cleImage(lieu.image))).grille : null); // sans image, pas de grille
  const opacite = () => casesDeReglages(ctx.r) / 100;
  /** Le lieu dessiné dans la régie : celui que le MJ consulte, sinon celui de la table. */
  const lieuAffiche = () => (consulte && consulte in courant.univers.lieux ? consulte : courant.partie.lieuCourant);
  const enConsultation = () => lieuAffiche() !== courant.partie.lieuCourant;
  const vue = () => { const lieu = courant.univers.lieux[courant.partie.lieuCourant]; return pu.vueDeLaTable(courant.partie, courant.univers, lieu ? grilleDuLieu(lieu) : null); };

  // --- Table ----------------------------------------------------------------------------------------------
  /** Envoie la carte à la table si la régie a la main et affiche une carte d'univers. Vrai : la table est servie (regie.js n'envoie alors pas de plan). */
  function diffuser() {
    if (!courant || ecran.hidden) return false;
    const lieu = courant.univers.lieux[lieuAffiche()];
    if (lieu) carte.majGrille(grilleDuLieu(lieu), opacite()); // le réglage « Cases » a pu changer
    if (!ctx.commande.main) return true; // en retrait : on ne parle pas à la table, et on ne lui envoie pas non plus un plan vide
    const v = vue();
    if (v) ctx.canal?.postMessage(messageUnivers(v, ctx.affichageTable(), defil, ordreDefil));
    return true;
  }

  // --- Réglages et défilement de la table ---------------------------------------------------------------------------
  // L'onglet Écran est le même pour un donjon et pour une carte de monde ; pour une carte, on masque ce qui ne concerne que les salles.
  function prendreLesReglages() {
    $('plein-ici').hidden = true; // « Plein écran ici » ne montre que les salles
    $('calibrer-table').hidden = true; // le calibrage dessine une carte bancaire sur la salle : mesure-le depuis une salle (Donjon ou donjon d'un univers)
  }
  function rendreLesReglages() {
    $('plein-ici').hidden = false;
    $('calibrer-table').hidden = etat.calibrage === true;
  }
  /** La table change de carte ou de niveau : sa vue se recentre, et la régie regarde de nouveau ce que voit la table. */
  function recentrerTable() { defil = { ...CENTRE }; ordreDefil++; consulte = null; }

  // --- Départ -----------------------------------------------------------------------------------------------
  function listerDepart() {
    const tous = Object.values(universEnregistres());
    const parties = stockage.chargerPartiesUnivers();
    $('section-univers').hidden = !tous.length;
    $('liste-univers').replaceChildren(...tous.map((u) => {
      const partie = parties[u.id];
      const n = Object.keys(u.lieux).length;
      const infos = h('div', { className: 'infos' }, h('b', { textContent: u.nom }), h('span', { textContent: pluriel(n, 'lieu', 'lieux') }));
      if (partie) infos.append(h('br'), h('span', { className: 'en-cours', textContent: `En cours : ${partie.dans ? 'dans un donjon, ' : ''}${u.lieux[partie.lieuCourant]?.nom ?? 'lieu disparu'}` }));
      const boutons = h('div', { className: 'boutons' });
      if (!n) infos.append(h('br'), h('span', { textContent: 'Aucune carte : prépare-la dans Préparer.' }));
      else if (partie) {
        const recommencer = h('button', { type: 'button', className: 'btn btn-danger' });
        deuxTemps(recommencer, 'Recommencer', 'Effacer la partie ?', () => ouvrir(u, pu.creerPartieUnivers(u)));
        boutons.append(recommencer); // « Reprendre » est dans « Parties en cours » (js/regie-depart.js)
      } else boutons.append(btn('Jouer', () => ouvrir(u, pu.creerPartieUnivers(u)), { icone: 'jouer' }));
      return h('li', {}, infos, boutons);
    }));
  }

  // --- Ouvrir un univers et naviguer ---------------------------------------------------------------------------
  function afficherEcran() {
    for (const id of ['depart', 'choix-joueurs']) $(id).hidden = true;
    $('regie').hidden = false;
    ecran.hidden = false;
    ctx.jouer?.mode('monde');
    document.title = `${courant.univers.nom} · Jouer · Carte de MJ`;
  }
  /** `main` faux : un rechargement en retrait rouvre la carte sans reprendre la main (la table reste à l'autre régie). */
  function ouvrir(univers, partie, { reprise = false, main = true } = {}) {
    const notes = pu.reconcilier(partie, univers, donjons());
    courant = { univers, partie };
    pointId = null;
    if (main) ctx.prendreLaMain();
    if (!ctx.commande.retrait) stockage.memoriserPartieOuverte(pu.cleOuverteUnivers(univers.id)); // un rechargement rouvre cette carte
    ctx.viderSauvegarde();
    etat.p = null; etat.consultee = null;
    ctx.noterRetrait();
    ctx.quitterPleinIci();
    recentrerTable();
    if (!partie.lieuCourant) { ctx.annoncer('Ce monde n’a plus aucune carte.', 8000); return; }
    sauver();
    if (partie.dans && reprise && donjons()[partie.dans.donjon]) { entrerDonjon(partie.dans, { main }); return; }
    afficherEcran();
    prendreLesReglages();
    rendre();
    if (notes.length) ctx.annoncer(notes.join(' '), 12000);
    titre.focus({ preventScroll: true });
  }

  function entrerDonjon({ donjon: idDonjon, salle }, { main = true, aLaTable = false } = {}) {
    const d = donjons()[idDonjon];
    if (!d) return;
    ecran.hidden = true;
    rendreLesReglages();
    ctx.jouer?.mode('donjon');
    const existante = stockage.chargerPresentations()[d.id];
    if (existante) {
      ctx.entrer(existante, { reprise: true, main });
      if (salle && salle in etat.p.donjon.salles) {
        if (aLaTable) { pres.afficherATable(etat.p, salle); etat.consultee = salle; ctx.modifie(); } // choisie dans l'arbre à la table : la table y va
        else { etat.consultee = salle; ctx.rendre(); }
      }
      return;
    }
    ctx.depart.demanderJoueurs(pres.creerPresentation(d, { salleDepart: salle && salle in d.salles ? salle : pres.salleDepart(d) }));
  }

  function franchir(id) {
    if (enConsultation()) { // la table n'est pas ici : on suit le point en consultation seulement
      const q = courant.univers.lieux[lieuAffiche()].points.find((x) => x.id === id);
      if (q?.vers?.lieu !== undefined && q.vers.lieu in courant.univers.lieux) { consulte = q.vers.lieu; pointId = null; rendre(); }
      return;
    }
    const but = pu.franchir(courant.partie, courant.univers, id, donjons());
    if (!but) { ctx.annoncer('Cette destination n’existe plus : le point est signalé comme orphelin. Rien n’a été retiré.', 8000); return; }
    sauver();
    pointId = null;
    recentrerTable();
    if (but.donjon) entrerDonjon(but); else rendre();
  }
  /** De retour d'un donjon : sa partie reste enregistrée telle quelle ; la régie quitte la partie de donjon et revient à la carte. */
  function quitterLeDonjon() {
    ctx.viderSauvegarde();
    if (!ctx.commande.retrait) stockage.memoriserPartieOuverte(pu.cleOuverteUnivers(courant.univers.id));
    etat.p = null; etat.consultee = null;
    ctx.noterRetrait();
    ctx.quitterPleinIci();
    afficherEcran();
    prendreLesReglages();
  }
  /** Après un changement de lieu ou de niveau : on enregistre, on sort du donjon si l'on y était, et on redessine la carte. */
  function apres() {
    sauver();
    pointId = null;
    recentrerTable();
    if (ecran.hidden) quitterLeDonjon();
    rendre();
  }
  const remonter = () => { if (pu.remonter(courant.partie)) apres(); };
  const versLe = (index) => { if (pu.allerAuChemin(courant.partie, index)) apres(); };

  // --- Fil d'Ariane (carte et donjon) ---------------------------------------------------------------------------
  function remplirFil(conteneur, partie, univers, dernier, { aller = versLe, remonterVers = remonter, etiquette = null } = {}) {
    const noms = pu.filDAriane(partie, univers);
    const items = [...noms.map((n, i) => ({ ...n, index: i })), ...(dernier ? [{ nom: dernier }] : [])];
    if (etiquette) items[items.length - 1] = { ...items[items.length - 1], nom: `${items[items.length - 1].nom} (consultation)` };
    // Deux versions dans la page, dont css/presentation.css n'affiche qu'une : le fil complet (ordinateur) et le fil compact d'une ligne (sous 760 px).
    const complet = h('span', { className: 'fil-complet' }, ...items.flatMap((it, i) => {
      const sep = i ? [h('span', { className: 'univers-sep', textContent: '›', 'aria-hidden': 'true' })] : [];
      if (i === items.length - 1) return [...sep, h('strong', { textContent: it.nom, 'aria-current': 'location' })];
      return [...sep, btn(it.nom, () => aller(it.index), { classe: 'btn-discret' })];
    }));
    const noeuds = [complet, creerFilCompact(items, { aller })];
    if (items.length > 1) {
      // Sous 760 px le libellé s'efface : Remonter est alors une icône (cible de 44 px).
      const haut = h('button', { type: 'button', className: 'btn btn-discret univers-remonter', 'aria-label': 'Remonter d’un niveau', title: 'Remonter d’un niveau' },
        icone('remonter'), h('span', { className: 'libelle', textContent: 'Remonter' }));
      haut.addEventListener('click', () => remonterVers());
      noeuds.push(haut);
    }
    conteneur.replaceChildren(...noeuds);
  }
  /** Le monde et la partie d'où l'on est entré dans le donjon joué, ou null (donjon joué seul, ou carte de monde affichée). */
  function mondeDuDonjon() {
    const idDonjon = etat.p?.donjon.id;
    if (!idDonjon || !ecran.hidden) return null;
    const univers = universEnregistres();
    for (const partie of Object.values(stockage.chargerPartiesUnivers())) {
      if (partie.dans?.donjon === idDonjon && univers[partie.univers]) return { univers: univers[partie.univers], partie };
    }
    return null;
  }
  /** Le monde de la partie en cours (carte affichée ou donjon d'un monde), pour l'arbre de lecture et ses pastilles. */
  function monde() { return !ecran.hidden ? courant : mondeDuDonjon(); }
  /** Un lieu du fil d'Ariane choisi dans l'arbre : on y remonte (vrai). Faux si ce lieu n'est pas sur le chemin. */
  function versLeLieu(id) {
    const m = monde();
    if (!m) return false;
    const chemin = [...m.partie.chemin, m.partie.lieuCourant];
    const index = chemin.indexOf(id);
    if (index < 0) return false;
    if (index === chemin.length - 1 && !m.partie.dans) return true; // déjà ici
    courant = m;
    versLe(index);
    return true;
  }
  /**
   * Un lieu, un donjon ou une salle choisi dans l'arbre pendant la vue « À la table » : la table y va tout de suite, vers le haut comme vers le bas.
   * `but` : { lieu } ou { lieu, donjon, salle? } (le lieu qui porte le donjon). Faux si le monde ou le but n'existe plus.
   */
  function conduireA(but) {
    const m = monde();
    if (!m || !m.univers.lieux[but.lieu]) return false;
    courant = m;
    if (!pu.conduireAuLieu(m.partie, m.univers, but.lieu)) return false;
    if (but.donjon) {
      const d = donjons()[but.donjon];
      if (!d) return false;
      m.partie.dans = { donjon: d.id, ...(but.salle && but.salle in d.salles ? { salle: but.salle } : {}) };
    }
    sauver();
    pointId = null;
    recentrerTable();
    if (m.partie.dans) { entrerDonjon(m.partie.dans, { aLaTable: true }); return true; }
    if (ecran.hidden) quitterLeDonjon();
    rendre();
    return true;
  }
  /** Un lieu choisi dans l'arbre pendant la vue « En régie » : la régie le regarde, la table ne bouge pas. Faux si la carte du monde n'est pas affichée. */
  function consulterLieu(id) {
    if (ecran.hidden || !courant || !(id in courant.univers.lieux)) return false;
    consulte = id === courant.partie.lieuCourant ? null : id;
    pointId = null;
    rendre();
    return true;
  }
  /** La liste des parties est demandée : la carte de monde n'est plus affichée. */
  function fermer() { ecran.hidden = true; rendreLesReglages(); }
  /** Dans la régie de donjon : le fil de l'univers d'où l'on vient, avec « Remonter ». Appelée à chaque rendu de la régie. */
  function majFil() {
    const zone = $('fil-univers');
    if (!zone) return;
    const trouve = mondeDuDonjon();
    zone.hidden = !trouve;
    if (!trouve) return;
    courant = trouve;
    remplirFil(zone, trouve.partie, trouve.univers, etat.p.donjon.nom);
    zone.prepend(h('span', { className: 'doux', textContent: `${trouve.univers.nom} · ` }));
  }

  // --- Rendu de la carte ----------------------------------------------------------------------------------------
  function rendre() {
    const { univers, partie } = courant;
    if (consulte && !(consulte in univers.lieux)) consulte = null;
    const lieu = univers.lieux[lieuAffiche()];
    titre.textContent = univers.nom;
    const fil = $('fil-univers');
    fil.hidden = false;
    if (enConsultation()) { // le fil suit le lieu regardé : ses noms et « Remonter » le consultent, sans bouger la table
      const vers = { chemin: pu.cheminVers(univers, lieu.id) ?? [partie.lieuCourant], lieuCourant: lieu.id };
      const consulter = (i) => consulterLieu([...vers.chemin, vers.lieuCourant][i]);
      remplirFil(fil, vers, univers, undefined, { aller: consulter, remonterVers: () => consulter(vers.chemin.length - 1), etiquette: true });
    } else remplirFil(fil, partie, univers);
    majBandeauMonde(lieu);
    const dons = donjons();
    const points = lieu.points.map((p) => {
      const orph = modele.raisonOrpheline(univers, p.vers, dons);
      const visible = pu.pointRevele(partie, lieu.id, p);
      return {
        id: p.id, x: p.x, y: p.y, nom: p.nom,
        titre: `${p.nom || 'Point sans nom'} → ${modele.nomDestination(univers, p.vers, dons)}${orph ? ` (${orph})` : ''}${p.cache ? (visible ? ' — révélé à la table' : ' — caché à la table') : ''}`,
        classes: [p.cache && !visible ? 'cache' : '', p.cache && visible ? 'revele' : '', orph ? 'orphelin' : '', !p.vers ? 'libre' : '', p.id === pointId ? 'choisi' : ''].filter(Boolean),
        selectionne: p.id === pointId,
      };
    });
    const moi = ++sequence;
    const options = { points, alt: `Carte : ${lieu.nom}`, grille: grilleDuLieu(lieu), opacite: opacite() };
    carte.afficher({ ...options, url: null, absente: 'Chargement de l’image…' });
    if (lieu.image && lieu.grille === undefined && !infosParImage.has(cleImage(lieu.image))) {
      images.infosImage(lieu.image).then((infos) => {
        infosParImage.set(cleImage(lieu.image), infos);
        if (moi === sequence && grilleDuLieu(lieu)) { carte.majGrille(grilleDuLieu(lieu), opacite()); diffuser(); }
      });
    }
    images.urlLieu(lieu).then((url) => { if (moi === sequence) carte.afficher({ ...options, url, absente: 'Image introuvable : la carte n’est plus dans la bibliothèque ou dans ce navigateur. Les points restent utilisables dans la liste.' }); });
    rendrePanneau(lieu, dons);
    majCartouche(lieu, moi);
    diffuser();
    ctx.jouer?.synchroniser({ monde: univers.id, lieu: lieu.id });
  }

  /** Le cartouche d'échelle du lieu : sa taille en cases et en mètres, d'après sa grille ; rien sans grille. Les dimensions de l'image se lisent une fois. */
  const dimensions = new Map();
  async function majCartouche(lieu, moi) {
    if (!lieu.image) { ctx.jouer?.cartouche.definir(null); return; } // lieu à illustrer : pas d'échelle
    const cle = cleImage(lieu.image);
    let infos = infosParImage.get(cle) ?? dimensions.get(cle);
    if (!infos) {
      ctx.jouer?.cartouche.definir(null);
      infos = await images.infosImage(lieu.image);
      dimensions.set(cle, infos);
    }
    if (moi !== sequence) return;
    ctx.jouer?.cartouche.definir(cartoucheLieu(grilleEffective(lieu, infos ?? null).grille, infos?.largeur, infos?.hauteur, ctx.r.echelle));
  }

  /** Le bandeau d'état, le même que celui de la régie de donjon : ce que voit la table, ou la régie en retrait. */
  function majBandeauMonde(lieu) {
    const bandeau = $('bandeau');
    const retrait = ctx.commande.retrait;
    const consultation = !retrait && enConsultation();
    bandeau.className = retrait ? 'retrait' : consultation ? 'consultation' : 'sur-table';
    const texte = h('div', { className: 'texte' });
    if (consultation) {
      const { univers, partie } = courant, table = univers.lieux[partie.lieuCourant];
      texte.append(h('span', { className: 'pastille', textContent: 'Consultation' }), 'La table montre toujours ', h('strong', { textContent: table?.nom ?? '…' }), '.');
    } else if (retrait) texte.append(h('span', { className: 'pastille', textContent: 'En retrait' }), 'Une autre régie commande la table : les joueurs ne voient pas ce que tu fais ici.');
    else texte.append(h('span', { className: 'pastille', textContent: 'À la table' }), 'Les joueurs voient la carte : ', h('strong', { textContent: lieu.nom }), '.');
    texte.title = texte.textContent;
    const actions = h('div', { className: 'actions' });
    if (consultation) {
      actions.append(btn('Afficher à la table', () => conduireA({ lieu: lieu.id }), { icone: 'oeil', classe: 'btn-fort' }),
        btn('Retour à la table', () => { consulte = null; pointId = null; rendre(); }));
    } else if (retrait) actions.append(btn('Reprendre la main', () => { ctx.prendreLaMain(); if (courant) stockage.memoriserPartieOuverte(pu.cleOuverteUnivers(courant.univers.id)); rendre(); }, { icone: 'oeil' }));
    bandeau.replaceChildren(texte, actions);
  }

  /** Le champ des notes de partie d'un lieu : enregistré pendant la frappe (sans redessiner), et au départ du champ. */
  let minuteNotes = null;
  function viderNotes() { if (minuteNotes === null) return; clearTimeout(minuteNotes); minuteNotes = null; if (courant) sauver(); }
  window.addEventListener('pagehide', viderNotes);
  function champNotes(idLieu) {
    const champ = h('textarea', { id: 'notes-partie-lieu', rows: 5, placeholder: 'Ce qui se passe ici…', value: pu.notePartieLieu(courant.partie, idLieu) });
    champ.addEventListener('input', () => {
      pu.definirNotePartieLieu(courant.partie, idLieu, champ.value);
      clearTimeout(minuteNotes);
      minuteNotes = setTimeout(viderNotes, 300);
    });
    champ.addEventListener('blur', viderNotes);
    return champ;
  }

  /** Le popover du point touché (Mène à, Entrer, Cacher ou Révéler), posé à côté du point : remplace l'ancien bloc « Point choisi ». Échap ou « Fermer » le ferme. */
  const popover = $('popover-point');
  let ancrePoint = null; // où le point a été touché (px écran), pour poser le popover à côté
  function fermerPopover() { pointId = null; popover.hidden = true; popover.replaceChildren(); }
  function majPopover(lieu, dons) {
    const { univers, partie } = courant;
    const p = lieu.points.find((q) => q.id === pointId) ?? null;
    if (!p) { popover.hidden = true; popover.replaceChildren(); return; }
    const orph = modele.raisonOrpheline(univers, p.vers, dons);
    const visible = pu.pointRevele(partie, lieu.id, p);
    const fermer = h('button', { type: 'button', className: 'btn btn-discret', 'aria-label': 'Fermer (Échap)' }, icone('fermer'), ' Fermer');
    fermer.addEventListener('click', () => { fermerPopover(); rendre(); });
    const contenu = [h('div', { className: 'selection-entete' }, h('h2', { textContent: 'Point' }), fermer),
      h('p', { className: `selection-titre${p.nom ? '' : ' vide'}`, textContent: p.nom || 'Point sans nom' }),
      h('p', { className: 'note' }, `Mène à : ${modele.nomDestination(univers, p.vers, dons)}`, ...(orph ? [' ', icone('alerte'), ` ${orph}`] : []))];
    if (p.cache) contenu.push(h('p', { className: 'note', textContent: visible ? 'Révélé : la table le voit.' : 'Caché : la table ne le voit pas.' }));
    const actions = h('div', { className: 'actions' });
    if (p.cache) actions.append(btn(visible ? 'Cacher à nouveau' : 'Révéler à la table', () => { (visible ? pu.recacher : pu.reveler)(partie, lieu.id, p.id); sauver(); rendre(); }, { icone: visible ? 'oeil-barre' : 'oeil' }));
    // Pas de doré ici : l'action principale de la régie est « Ouvrir la table » (barre d'outils).
    const entrer = btn(p.vers?.donjon ? 'Entrer dans le donjon' : 'Entrer dans ce lieu', () => franchir(p.id), { icone: 'retour', classe: 'univers-entrer' });
    entrer.append(entrer.firstChild); // la flèche passe après le libellé et pointe vers la droite
    entrer.disabled = !p.vers || !!orph || (enConsultation() && p.vers.lieu === undefined); // un donjon : d'abord « Afficher à la table »
    actions.append(entrer);
    contenu.push(actions);
    popover.replaceChildren(...contenu);
    popover.hidden = false;
    placerPopover(popover, ancrePoint, $('principal'));
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !popover.hidden && !ecran.hidden) { fermerPopover(); rendre(); } });
  document.addEventListener('pointerdown', (e) => { if (!popover.hidden && !popover.contains(e.target) && !e.target.closest?.('.univers-point')) { fermerPopover(); rendre(); } });

  function rendrePanneau(lieu, dons) {
    const { univers, partie } = courant;
    majPopover(lieu, dons);
    // Cachés : les points préparés en secret et pas encore révélés. « Révéler » par ligne, « Révéler tout » ; la section disparaît quand il n'y en a plus.
    const caches = lieu.points.filter((q) => q.cache && !pu.pointRevele(partie, lieu.id, q));
    const listeCaches = creerListe(caches.map((q) => ({
      nom: q.nom, vide: 'Point sans nom', icone: 'oeil-barre', position: 'Révéler', detail: `vers ${modele.nomDestination(univers, q.vers, dons)}`,
      surChoix: () => { pu.reveler(partie, lieu.id, q.id); sauver(); rendre(); },
    })));
    const reveler = btn('Révéler tout', () => { for (const q of caches) pu.reveler(partie, lieu.id, q.id); sauver(); rendre(); }, { icone: 'oeil' });
    /** Un interrupteur « Visible à la table » : mêmes rangées que celles d'une salle (js/regie.js). */
    const interrupteur = (libelle, visible, surBascule, aide = null) => {
      const b = h('button', { type: 'button', className: 'pop-interrupteur', role: 'switch', 'aria-checked': String(visible), 'aria-label': `${libelle} à la table` });
      b.addEventListener('click', () => { surBascule(!visible); sauver(); rendre(); });
      return h('div', { className: 'rang-interrupteur' }, h('span', { className: 'pop-lib' }, libelle, ...(aide ? [h('small', { textContent: aide })] : [])), b);
    };
    const basculeChamp = (champ) => (visible) => { if (visible) delete partie[champ]; else partie[champ] = true; };
    const nbCaches = lieu.points.filter((q) => q.cache && !pu.pointRevele(partie, lieu.id, q)).length;
    // Sections du panneau (js/atelier/section.js, docs/design-panneaux.md) ; le pli est gardé pour la session.
    const section = (cle, titre, enfants, options = {}) => creerSection({ cle: `regie-lieu:${cle}`, titre, enfants, ...options }).element;
    panneau.replaceChildren(
      section('table', 'Visible à la table', [
        h('p', { className: 'note', textContent: enConsultation() ? 'Tu consultes cette carte : la table ne la voit pas encore. « Afficher à la table » l’y conduit.' : ctx.commande.main ? `La table voit cette carte${nbCaches ? ` sans ${pluriel(nbCaches, 'point caché', 'points cachés')}` : ''}.` : 'Cette régie est en retrait : la table ne voit pas ce que tu fais ici.' }),
        interrupteur('Points', !partie.masquerPoints, basculeChamp('masquerPoints'), 'les points révélés'),
        interrupteur('Noms des points', !partie.masquerNoms, basculeChamp('masquerNoms'))]),
      ...(caches.length ? [section('caches', 'Cachés', [listeCaches, h('div', { className: 'actions' }, reveler)], { compte: caches.length })] : []),
      section('notes', 'Notes', [
        h('p', { className: 'note', textContent: 'Préparation (lecture seule) :' }),
        h('p', { className: `univers-notes${lieu.notes ? '' : ' vide'}`, textContent: lieu.notes || 'Aucune note pour ce lieu.' }),
        h('label', { className: 'note etiquette-notes', htmlFor: 'notes-partie-lieu', textContent: 'Notes de partie, prises en jouant (enregistrées avec la partie, jamais envoyées à la table) :' }),
        champNotes(lieu.id)]),
    );
  }
  /**
   * Rouvre la carte d'univers qui était ouverte avant un rechargement (la partie mémorisée sait où l'on en était). Vrai si c'est fait.
   * Une régie en retrait passe `{ id, main: false }` : le monde vient de son onglet (`univers:<id>` dans le retrait), pas de la partie
   * ouverte commune, et la main n'est pas reprise.
   */
  function reprendre({ id: demande = null, main = true } = {}) {
    const id = demande ?? pu.universOuvert(stockage.idPartieOuverte());
    const u = id && universEnregistres()[id];
    const partie = id && stockage.chargerPartiesUnivers()[id];
    if (!u || !partie) return false;
    ouvrir(u, partie, { reprise: true, main });
    return !ecran.hidden || !!etat.p;
  }

  /** Ouvre le monde `id` (depuis la liste des parties) : reprend sa partie, ou en commence une. Faux s'il n'existe plus ou n'a aucune carte. */
  function ouvrirParId(id) {
    const u = universEnregistres()[id];
    if (!u || !Object.keys(u.lieux).length) return false;
    let partie = stockage.chargerPartiesUnivers()[id];
    if (!partie) { partie = pu.creerPartieUnivers(u); stockage.enregistrerPartieUnivers(partie); }
    ouvrir(u, partie, { reprise: true });
    return !ecran.hidden || !!etat.p;
  }

  /** La clé `univers:<id>` du monde dont la carte est affichée (retenue par une régie en retrait), ou null. */
  const cleOuverte = () => (courant && !ecran.hidden ? pu.cleOuverteUnivers(courant.univers.id) : null);
  /** Choisit un point de la carte du monde affichée (geste venu de la vue « Table » de la régie) : comme un toucher sur la carte de la régie. */
  /** La carte que voit la table (clé du zoom : il revient au cadrage de base quand elle change), ou null. */
  const cleCarte = () => (courant && !ecran.hidden ? `u:${courant.univers.id}:${courant.partie.lieuCourant}` : null);
  /** Le lieu à la table a-t-il une grille ? « Réel » n'a de sens qu'avec elle. */
  const grilleDisponible = () => { const l = courant?.univers.lieux[courant.partie.lieuCourant]; return !!l && !!grilleDuLieu(l); };
  /** Le glissement dans la vue « Table » : la position (fractions de la course) que la carte montrée à la table doit avoir. */
  function cadrer({ x, y }) { defil = pu_borner({ x, y }); ordreDefil++; diffuser(); }
  function choisirPoint(id, ancre = null) {
    const lieu = courant && !ecran.hidden ? courant.univers.lieux[courant.partie.lieuCourant] : null;
    if (!lieu || typeof id !== 'string' || !lieu.points.some((q) => q.id === id)) return;
    pointId = id;
    ancrePoint = ancre;
    rendre();
  }

  return { cleCarte, grilleDisponible, cadrer, choisirPoint, cleOuverte, listerDepart, diffuser, majFil, monde, versLeLieu, conduireA, consulterLieu, fermer, reprendre, ouvrirParId, redessiner: () => { if (courant && !ecran.hidden) rendre(); }, actif: () => !ecran.hidden };
}
