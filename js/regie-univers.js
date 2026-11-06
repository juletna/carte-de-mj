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
import { messageUnivers, CENTRE, decalerDefilement } from './univers-protocole.js';
import { creerCarteUnivers } from './univers-carte.js';
import * as images from './univers-images.js';
import { affichageDeReglages, casesDeReglages } from './affichage.js';
import { grilleEffective } from './univers-grille.js';
import { $, h, bouton, deuxTemps } from './dom.js';
import { pluriel } from './format.js';

export function creerRegieUnivers(ctx) {
  const { etat } = ctx;
  let courant = null;   // { univers, partie } : l'univers dont la carte est affichée (ou dont on est dans un donjon)
  let pointId = null;   // point choisi sur la carte
  let sequence = 0;
  let defil = { ...CENTRE }; // la partie de la carte montrée à la table quand elle dépasse son écran (voir univers-protocole.js)
  let ordreDefil = 0;        // change à chaque commande, même « recentrer » deux fois de suite : la table n'applique que ce qui est nouveau
  const donjons = () => stockage.chargerDonjons()?.donjons ?? {};
  const universEnregistres = () => stockage.chargerUnivers().etat?.univers ?? {};

  const ecran = $('univers-regie');
  const titre = h('h1', { id: 'titre-univers-regie', tabIndex: -1 });
  const fil = h('nav', { className: 'univers-fil', 'aria-label': 'Fil d’Ariane' });
  const zoneCarte = h('div', { className: 'univers-zone-carte' });
  const panneau = h('div', { className: 'univers-regie-panneau' });
  ecran.querySelector('.univers-regie-corps').replaceChildren(h('header', {}, titre, fil), h('div', { className: 'univers-regie-grille' }, zoneCarte, panneau));
  const carte = creerCarteUnivers(zoneCarte, { onPoint: (id) => { pointId = id; rendre(); } });

  function sauver() {
    if (!stockage.enregistrerPartieUnivers(courant.partie)) ctx.annoncer('Impossible d’enregistrer la partie de ce monde dans ce navigateur (stockage plein ou bloqué) : elle continue, mais ne pourra pas être reprise.', 12000);
  }
  // La grille du lieu : celle que le MJ a calée, sinon celle du catalogue (relue une fois par image, puis gardée).
  const infosParImage = new Map();
  const cleImage = (ref) => `${ref.source}:${ref.id}`;
  const grilleDuLieu = (lieu) => grilleEffective(lieu, infosParImage.get(cleImage(lieu.image))).grille;
  const opacite = () => casesDeReglages(ctx.r) / 100;
  const vue = () => { const lieu = courant.univers.lieux[courant.partie.lieuCourant]; return pu.vueDeLaTable(courant.partie, courant.univers, lieu ? grilleDuLieu(lieu) : null); };

  // --- Table ----------------------------------------------------------------------------------------------
  /** Envoie la carte à la table si la régie a la main et affiche une carte d'univers. Vrai : la table est servie (regie.js n'envoie alors pas de plan). */
  function diffuser() {
    if (!courant || ecran.hidden) return false;
    const lieu = courant.univers.lieux[courant.partie.lieuCourant];
    if (lieu) carte.majGrille(grilleDuLieu(lieu), opacite()); // le réglage « Cases » a pu changer
    if (!ctx.commande.main) return true; // en retrait : on ne parle pas à la table, et on ne lui envoie pas non plus un plan vide
    const v = vue();
    if (v) ctx.canal?.postMessage(messageUnivers(v, ctx.affichageTable(), defil, ordreDefil));
    return true;
  }

  // --- Réglages et défilement de la table ---------------------------------------------------------------------------
  // Le panneau de réglages de la régie de donjon (taille de case, cases, mode de la table, rotation, miroir…) est le même : ses blocs sont
  // déplacés ici tant qu'une carte d'univers est affichée, puis rendus à la régie de donjon. Leurs écouteurs restent attachés.
  const blocs = [document.querySelector('#regie .bloc-table'), document.querySelector('#regie details.reglages')].filter(Boolean);
  const reperes = new Map();
  function prendreLesReglages() {
    for (const bloc of blocs) {
      if (reperes.has(bloc)) continue;
      const repere = document.createComment('reglages'); // où le bloc retournera
      bloc.before(repere);
      reperes.set(bloc, repere);
      panneau.append(bloc);
    }
    $('plein-ici').hidden = true; // « Plein écran ici » ne montre que les salles
    $('mini-active').closest('label').hidden = true; // pas de mini-carte pour une carte d'univers
    $('calibrer-table').hidden = true; // le calibrage dessine une carte bancaire sur la salle : mesure-le depuis une salle (Donjon ou donjon d'un univers)
  }
  function rendreLesReglages() {
    for (const [bloc, repere] of reperes) { repere.replaceWith(bloc); }
    reperes.clear();
    $('plein-ici').hidden = false;
    $('mini-active').closest('label').hidden = false;
    $('calibrer-table').hidden = etat.calibrage === true;
  }
  /** Les flèches et « recentrer » de « Faire défiler la vue table » (regie.js les appelle quand une carte d'univers est affichée). */
  function defiler(dx, dy, recentrer) {
    if (!courant) return;
    defil = recentrer ? { ...CENTRE } : decalerDefilement(defil, dx, dy);
    ordreDefil++;
    diffuser();
  }
  function recentrerTable() { defil = { ...CENTRE }; ordreDefil++; }

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
      if (!n) infos.append(h('br'), h('span', { textContent: 'Aucune carte : prépare-la dans Monde.' }));
      else if (partie) {
        const recommencer = h('button', { type: 'button', className: 'discret' });
        deuxTemps(recommencer, 'Recommencer', 'Effacer la partie ?', () => ouvrir(u, pu.creerPartieUnivers(u)));
        boutons.append(recommencer); // « Reprendre » est dans « Parties en cours » (js/regie-depart.js)
      } else boutons.append(bouton('Jouer', () => ouvrir(u, pu.creerPartieUnivers(u))));
      return h('li', {}, infos, boutons);
    }));
  }

  // --- Ouvrir un univers et naviguer ---------------------------------------------------------------------------
  function afficherEcran() {
    for (const id of ['depart', 'choix-joueurs', 'regie']) $(id).hidden = true;
    ecran.hidden = false;
    document.title = `${courant.univers.nom} · Jouer · Carte de MJ`;
  }
  function ouvrir(univers, partie, { reprise = false } = {}) {
    const notes = pu.reconcilier(partie, univers, donjons());
    courant = { univers, partie };
    pointId = null;
    ctx.prendreLaMain();
    if (!ctx.commande.retrait) stockage.memoriserPartieOuverte(pu.cleOuverteUnivers(univers.id)); // un rechargement rouvre cette carte
    ctx.viderSauvegarde();
    etat.p = null; etat.consultee = null;
    ctx.noterRetrait();
    ctx.quitterPleinIci();
    recentrerTable();
    if (!partie.lieuCourant) { ctx.annoncer('Ce monde n’a plus aucune carte.', 8000); return; }
    sauver();
    if (partie.dans && reprise && donjons()[partie.dans.donjon]) { entrerDonjon(partie.dans); return; }
    afficherEcran();
    prendreLesReglages();
    rendre();
    if (notes.length) ctx.annoncer(notes.join(' '), 12000);
    titre.focus({ preventScroll: true });
  }

  function entrerDonjon({ donjon: idDonjon, salle }) {
    const d = donjons()[idDonjon];
    if (!d) return;
    ecran.hidden = true;
    rendreLesReglages();
    const existante = stockage.chargerPresentations()[d.id];
    if (existante) {
      ctx.entrer(existante, { reprise: true });
      if (salle && salle in etat.p.donjon.salles) { etat.consultee = salle; ctx.rendre(); }
      return;
    }
    ctx.depart.demanderJoueurs(pres.creerPresentation(d, { salleDepart: salle && salle in d.salles ? salle : pres.salleDepart(d) }));
  }

  function franchir(id) {
    const but = pu.franchir(courant.partie, courant.univers, id, donjons());
    if (!but) { ctx.annoncer('Cette destination n’existe plus : le point est signalé ⚠. Rien n’a été retiré.', 8000); return; }
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
    $('regie').hidden = true;
    $('fil-univers').hidden = true;
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
  function remplirFil(conteneur, partie, univers, dernier) {
    const noms = pu.filDAriane(partie, univers);
    const items = [...noms.map((n, i) => ({ ...n, index: i })), ...(dernier ? [{ nom: dernier }] : [])];
    conteneur.replaceChildren(...items.flatMap((it, i) => {
      const sep = i ? [h('span', { className: 'univers-sep', textContent: '›', 'aria-hidden': 'true' })] : [];
      if (i === items.length - 1) return [...sep, h('strong', { textContent: it.nom, 'aria-current': 'location' })];
      return [...sep, bouton(it.nom, () => versLe(it.index), 'discret petit')];
    }), ...(items.length > 1 ? [bouton('↑ Remonter', () => remonter(), 'discret petit univers-remonter')] : []));
  }
  /** Dans la régie de donjon : le fil de l'univers d'où l'on vient, avec « Remonter ». Appelée à chaque rendu de la régie. */
  function majFil() {
    const zone = $('fil-univers');
    if (!zone) return;
    const idDonjon = etat.p?.donjon.id;
    let trouve = null;
    if (idDonjon && ecran.hidden) {
      const univers = universEnregistres();
      for (const partie of Object.values(stockage.chargerPartiesUnivers())) {
        if (partie.dans?.donjon === idDonjon && univers[partie.univers]) { trouve = { univers: univers[partie.univers], partie }; break; }
      }
    }
    zone.hidden = !trouve;
    if (!trouve) return;
    courant = trouve;
    remplirFil(zone, trouve.partie, trouve.univers, etat.p.donjon.nom);
    zone.prepend(h('span', { className: 'doux', textContent: `${trouve.univers.nom} · ` }));
  }

  // --- Rendu de la carte ----------------------------------------------------------------------------------------
  function rendre() {
    const { univers, partie } = courant;
    const lieu = univers.lieux[partie.lieuCourant];
    titre.textContent = univers.nom;
    remplirFil(fil, partie, univers);
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
    if (lieu.grille === undefined && !infosParImage.has(cleImage(lieu.image))) {
      images.infosImage(lieu.image).then((infos) => {
        infosParImage.set(cleImage(lieu.image), infos);
        if (moi === sequence && grilleDuLieu(lieu)) { carte.majGrille(grilleDuLieu(lieu), opacite()); diffuser(); }
      });
    }
    images.urlImage(lieu.image).then((url) => { if (moi === sequence) carte.afficher({ ...options, url, absente: 'Image introuvable : la carte n’est plus dans la bibliothèque ou dans ce navigateur. Les points restent utilisables dans la liste.' }); });
    rendrePanneau(lieu, dons);
    diffuser();
  }

  function rendrePanneau(lieu, dons) {
    const { univers, partie } = courant;
    const p = lieu.points.find((q) => q.id === pointId) ?? null;
    const choisi = [];
    if (p) {
      const orph = modele.raisonOrpheline(univers, p.vers, dons);
      const visible = pu.pointRevele(partie, lieu.id, p);
      choisi.push(h('h3', { textContent: p.nom || 'Point sans nom' }),
        h('p', { className: 'note', textContent: `Mène à : ${modele.nomDestination(univers, p.vers, dons)}${orph ? ` ⚠ ${orph}` : ''}` }));
      if (p.cache) choisi.push(h('p', { className: 'note', textContent: visible ? 'Révélé : la table le voit.' : 'Caché : la table ne le voit pas.' }));
      const actions = h('div', { className: 'actions' });
      if (p.cache) actions.append(bouton(visible ? 'Cacher à nouveau' : 'Révéler à la table', () => { (visible ? pu.recacher : pu.reveler)(partie, lieu.id, p.id); sauver(); rendre(); }));
      const entrer = bouton(p.vers?.donjon ? 'Entrer dans le donjon' : 'Entrer dans ce lieu', () => franchir(p.id), 'principal');
      entrer.disabled = !p.vers || !!orph;
      actions.append(entrer);
      choisi.push(actions);
    } else choisi.push(h('p', { className: 'note', textContent: 'Touche un point de la carte, ou choisis-le dans la liste.' }));

    const liste = lieu.points.map((q) => {
      const orph = modele.raisonOrpheline(univers, q.vers, dons);
      const marque = [orph ? '⚠' : '', q.cache ? (pu.pointRevele(partie, lieu.id, q) ? '👁' : '🙈') : ''].filter(Boolean).join(' ');
      const b = bouton(`${marque ? `${marque} ` : ''}${q.nom || 'Point sans nom'}`, () => { pointId = q.id; rendre(); }, `discret petit${q.id === pointId ? ' choisi' : ''}`);
      if (q.id === pointId) b.setAttribute('aria-current', 'true');
      return h('li', {}, b);
    });
    const masquer = h('input', { type: 'checkbox', checked: !!partie.masquerNoms });
    masquer.addEventListener('change', () => { if (masquer.checked) partie.masquerNoms = true; else delete partie.masquerNoms; sauver(); rendre(); });
    const nbCaches = lieu.points.filter((q) => q.cache && !pu.pointRevele(partie, lieu.id, q)).length;
    panneau.replaceChildren(
      h('section', { 'aria-label': 'Carte à la table' }, h('h2', { textContent: 'Carte à la table' }),
        h('p', { className: 'note', textContent: ctx.commande.main ? `La table voit cette carte${nbCaches ? ` sans ${pluriel(nbCaches, 'point caché', 'points cachés')}` : ''}.` : 'Cette régie est en retrait : la table ne voit pas ce que tu fais ici.' }),
        h('label', { className: 'ligne case' }, masquer, ' Masquer les noms à la table')),
      h('section', { 'aria-label': 'Point choisi' }, ...choisi),
      h('section', { 'aria-label': 'Points de ce lieu' }, h('h2', { textContent: `Points (${lieu.points.length})` }), lieu.points.length ? h('ul', { className: 'univers-liste' }, ...liste) : h('p', { className: 'note', textContent: 'Aucun point sur cette carte.' })),
      ...(lieu.notes ? [h('section', { 'aria-label': 'Notes du lieu' }, h('h2', { textContent: 'Notes du lieu' }), h('p', { className: 'univers-notes', textContent: lieu.notes }))] : []),
      h('p', { className: 'note' }, bouton('← Liste des parties', () => { ecran.hidden = true; rendreLesReglages(); if (!ctx.commande.retrait) stockage.oublierPartieOuverte(); ctx.depart.afficher(); }, 'discret petit')),
      ...(reperes.size ? blocs : []));
  }
  /** Rouvre la carte d'univers qui était ouverte avant un rechargement (la partie mémorisée sait où l'on en était). Vrai si c'est fait. */
  function reprendre() {
    const id = pu.universOuvert(stockage.idPartieOuverte());
    const u = id && universEnregistres()[id];
    const partie = id && stockage.chargerPartiesUnivers()[id];
    if (!u || !partie) return false;
    ouvrir(u, partie, { reprise: true });
    return !ecran.hidden || !!etat.p;
  }

  /** Ouvre le monde `id` (`presentation.html?univers=<id>`) : reprend sa partie, ou en commence une. Faux s'il n'existe plus ou n'a aucune carte. */
  function ouvrirParId(id) {
    const u = universEnregistres()[id];
    if (!u || !Object.keys(u.lieux).length) return false;
    let partie = stockage.chargerPartiesUnivers()[id];
    if (!partie) { partie = pu.creerPartieUnivers(u); stockage.enregistrerPartieUnivers(partie); }
    ouvrir(u, partie, { reprise: true });
    return !ecran.hidden || !!etat.p;
  }

  return { listerDepart, diffuser, majFil, reprendre, ouvrirParId, defiler, redessiner: () => { if (courant && !ecran.hidden) rendre(); }, actif: () => !ecran.hidden };
}
