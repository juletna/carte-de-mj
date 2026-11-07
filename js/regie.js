/**
 * La RÉGIE du MJ (presentation.html) : choix du donjon, carte complète, révélations, portes, notes, personnages, commande rapide,
 * et ce qu'elle montre à la table (par le canal). Fabrique de tout le reste : `demarrerRegie()` est la
 * racine de composition, avec l'état de la régie (`etat`), ses réglages (`r`) et le contexte `ctx` que reçoivent les modules
 * regie-depart.js, regie-selection.js et regie-reglages.js (qui ne s'importent pas entre eux).
 *
 * La logique (copie du donjon, portes, révélations, improvisation, plan envoyé à la table) est dans presentation.js (façade de
 * partie.js, passage.js, vue-publique.js). Ici : DOM, stockage et canal.
 *
 * Plusieurs régies peuvent être ouvertes : une seule commande la table (voir commande-table.js).
 *
 * SÉCURITÉ : la régie n'envoie à la table que le résultat de vueTable() et de miniPlanTable() (voir vue-publique.js), par
 * `messageEtat` (protocole-table.js) : tout passe par `contenuTable()`.
 */
import * as stockage from './stockage.js';
import * as modele from './donjon.js';
import * as pres from './presentation.js';
import * as table from './commande-table.js';
import { dessiner } from './rendu/moteur.js';
import { themeParNom } from './rendu/themes/index.js';
import { disposerPlan, cleDisposition } from './plan-donjon.js';
import { activerDeplacement } from './deplacement.js';
import { carteFiche, carteJoueur } from './carte-personnage.js';
import { nomCase, libelleDePorte } from './coordonnees.js';
import { nomAffiche } from './parseur/lexique.js';
import { nomVariante } from './catalogue.js';
import { creerMicro } from './voix.js';
import { affichageDeReglages, optionsRendu, modeTable, ZOOM_TABLE_MIN, ZOOM_TABLE_MAX } from './affichage.js';
import { telephone, marquerDefilement, tailleQuiTient } from './telephone.js';
import { $, h, bouton } from './dom.js';
import { icone } from './icones.js';
import { pluriel } from './format.js';
import { ouvrirCanal, messageEtat, messageCadrage, lirePosition, lireFacteurZoom, lireCadrage, lireElement, MESSAGES } from './protocole-table.js';
import { creerDepart } from './regie-depart.js';
import { creerSelection } from './regie-selection.js';
import { creerReglages } from './regie-reglages.js';
import { creerRegieUnivers } from './regie-univers.js';
import { lierPanneau, sectionnerOnglets } from './regie-panneau.js';
import { creerSection } from './atelier/section.js';
import { poserIcones, iconeEtTexte } from './regie-icones.js';
import * as pu from './univers-partie.js';
import { creerJouer } from './atelier/jouer.js';
import { cartoucheSalle } from './atelier/cartouche.js';

export function demarrerRegie() {
  const canal = ouvrirCanal();
  const retraitAvantRechargement = stockage.retraitMemorise();
  const commande = table.creerCommande(table.nouvelIdRegie(), { retrait: !!retraitAvantRechargement });
  const r = stockage.chargerReglages();
  const etat = {
    presentations: {},   // { idDonjon: présentation } (copie en mémoire de ce qui est sauvegardé)
    p: null,             // présentation en cours
    consultee: null,     // salle que le MJ regarde (≠ forcément la salle à la table) : jamais sauvegardée
    zoom: { cle: null, valeur: 1 }, // zoom de la vue table, par carte (voir affichageTable)
    selection: null,     // { genre, id } : les identifiants sont stables dans la copie
    message: '',
    messageCommande: null, // { texte, ok } : réponse à la dernière commande rapide (régie seulement)
    brouillon: null,     // { cle, texte, nom } : description de la salle à créer derrière une porte, gardée si on redessine
    groupeSuit: true,    // case « Le groupe suit »
    ajuster: true,       // adapter la carte de la régie à la fenêtre (n'agit pas sur la table)
    fichier: null,       // { donjon, avertissements } : donjon ouvert depuis un fichier
    focusSelection: false, // le focus doit passer au panneau de sélection au prochain rendu
    caseVisee: null,     // { salle, x, y } : la case que le MJ montre aux joueurs. Jamais sauvegardée
    enregistre: true,
    empreinte: null,     // la partie telle que cette régie l'a lue ou écrite en dernier (voir sauvegarder)
    perimee: false,      // en retrait : l'autre régie tient ou a fait avancer cette partie, on ne l'enregistre plus ici
  };

  // --- Retour d'action : toast transitoire, hors du flux, annoncé par aria-live (#toast) ------------------
  let minuteToast, minuteEffacement;
  function annoncer(texte, duree = 7000) {
    const t = $('toast');
    clearTimeout(minuteToast); clearTimeout(minuteEffacement);
    t.textContent = texte;
    t.classList.add('visible');
    minuteToast = setTimeout(effacerToast, duree);
  }
  function effacerToast() {
    clearTimeout(minuteToast);
    $('toast').classList.remove('visible');
    minuteEffacement = setTimeout(() => { $('toast').textContent = ''; }, 300);
  }
  $('toast').addEventListener('click', effacerToast);

  const salleCourante = () => etat.p.donjon.salles[etat.p.salleCourante];
  const salleConsultee = () => etat.p.donjon.salles[etat.consultee];
  const idsReveles = (idSalle) => etat.p.reveles[idSalle] || [];

  // --- Communication avec la fenêtre table -------------------------------------------------------
  // Le zoom de la vue table est celui de la régie (source unique) : propre à la carte montrée, il revient au cadrage de base quand elle change.
  const cleCarte = () => (etat.p ? `d:${etat.p.donjon.id}:${etat.p.salleCourante}` : ctx.univers?.cleCarte() ?? null);
  const zoomTable = () => { const cle = cleCarte(); if (etat.zoom.cle !== cle) etat.zoom = { cle, valeur: 1 }; return etat.zoom.valeur; };
  const affichageTable = () => {
    const a = affichageDeReglages(r); // le calibrage n'en fait pas partie : c'est un mode de la table, avec son propre message (js/calibrage.js)
    const z = zoomTable();
    return z === 1 ? a : { ...a, zoom: z };
  };
  // Le plan complet essaie plusieurs dispositions : on ne le refait que si les salles, leurs portes ou les liaisons ont changé.
  let dispositionPartie = { cle: null, plan: null };
  function dispositionDePartie() {
    const d = etat.p.donjon;
    const cle = cleDisposition(d);
    if (cle !== dispositionPartie.cle) dispositionPartie = { cle, plan: disposerPlan(d) };
    return dispositionPartie.plan;
  }
  function miniTable() {
    if (!etat.p || r.miniTable === false) return null;
    return pres.miniPlanTable(etat.p, dispositionDePartie());
  }
  /** La case montrée, si elle est dans la salle que voient les joueurs. */
  const caseATable = () => pres.caseATable(etat.p, etat.caseVisee);
  /** Tout ce que voit la table : le plan de vueTable(), la mini-carte de miniPlanTable(), la case montrée, l'affichage, et rien d'autre. */
  function contenuTable() {
    return { plan: etat.p ? pres.vueTable(etat.p) : null, mini: miniTable(), caseVisee: caseATable(), affichage: affichageTable() };
  }
  /** Envoie à la table son contenu (seule la régie qui a la main le fait). */
  function diffuser() {
    ctx.jouer?.vues.majCadrage(); // le contrôle de cadrage de la vue « À la table » suit le zoom et le mode
    // Le calibrage est un mode de la table : prioritaire sur la salle et sur une carte d'univers, et possible sans partie ouverte (régie libre).
    if (ctx.calibrage?.actif()) { ctx.calibrage.envoyer(); return; }
    if (!commande.main) return;
    if (univers.diffuser()) return; // une carte d'univers est affichée : c'est elle que voit la table (js/regie-univers.js)
    canal?.postMessage(messageEtat(contenuTable()));
  }

  // --- Cadrage de la vue table : zoom (− / +), Remplir, Réel ; molette, pincer et glisser dans la vue « À la table » ---------------------
  const cadrage = {
    lire: () => ({ zoom: zoomTable(), reel: modeTable(r) === 'reel', reelPossible: etat.p ? true : univers.grilleDisponible() }),
    /** Un cran de zoom (ou un facteur de geste). Depuis « Réel », on passe à « Remplir » : il n'y a pas de verrou. */
    zoomer(facteur) {
      let z = zoomTable();
      if (modeTable(r) === 'reel') { r.modeTable = 'remplir'; z = 1; reglages.sauver(); }
      etat.zoom.valeur = Math.max(ZOOM_TABLE_MIN, Math.min(ZOOM_TABLE_MAX, Math.round(z * facteur * 1000) / 1000));
      diffuser();
    },
    remplir() { r.modeTable = 'remplir'; etat.zoom.valeur = 1; reglages.sauver(); diffuser(); },
    reel() { r.modeTable = 'reel'; etat.zoom.valeur = 1; reglages.sauver(); diffuser(); },
  };
  /** Un glissement dans la vue « Table » : la position est renvoyée à la table (la carte du monde la garde dans sa partie d'affichage). */
  function cadrerTable(position) {
    if (univers.actif()) { univers.cadrer(position); return; }
    if (commande.main) canal?.postMessage(messageCadrage(position.x, position.y));
  }
  /** Un clic sur une case vide la montre ; un clic sur la même case l'enlève. */
  function viserCase(idSalle, x, y) {
    etat.caseVisee = pres.viserCase(etat.caseVisee, etat.p, idSalle, x, y);
    rendre();
  }
  function deplacerDepuisTable(id, x, y) {
    if (!etat.p) return;
    if (pres.deplacerPion(etat.p, etat.p.salleCourante, id, x, y)) modifie();
    else { diffuser(); } // refusé : la table reprend la position d'avant
  }
  if (canal) {
    canal.onmessage = (ev) => {
      const m = ev.data;
      const action = table.surMessage(commande, m);
      if (action === 'retrait') { noterRetrait(); if (etat.p) majRetrait(); else univers.redessiner(); } // la carte d'un monde montre aussi son bandeau « En retrait »
      else if (action === 'diffuser') diffuser();
      else if (action === 'presence') { canal.postMessage({ type: table.PRESENCE }); if (ctx.calibrage?.actif()) ctx.calibrage.envoyer(); } // une table ouverte pendant le calibrage le rejoint
      else if (action === 'appliquer' && m.type === MESSAGES.TABLE_DEPLACER) deplacerDepuisTable(m.id, m.x, m.y);
      else if (action === 'appliquer' && m.type === MESSAGES.TABLE_ZOOM) { const f = lireFacteurZoom(m); if (f) cadrage.zoomer(f); }
      else if (action === 'appliquer' && m.type === MESSAGES.TABLE_CADRER) { const p = lireCadrage(m); if (p) cadrerTable(p); }
      else if (action === 'appliquer' && m.type === MESSAGES.TABLE_ELEMENT) {
        const e = lireElement(m);
        if (e && etat.p) { etat.consultee = etat.p.salleCourante; selection.selectionner(e.genre, e.id, { ancre: jouer.vues.ancre(e.position) }); } // la table voit la salle courante : c'est elle qu'on regarde
      }
      else if (action === 'appliquer' && m.type === MESSAGES.TABLE_POINT) univers.choisirPoint(m.id, jouer.vues.ancre(lirePosition(m)));
      else if (action === 'appliquer' && etat.p) { etat.selection = null; viserCase(etat.p.salleCourante, m.x, m.y); } // une case vide touchée referme la sélection
    };
  }
  // Le retrait retient la partie de donjon ouverte, sinon le monde dont la carte est affichée (`univers:<id>`) : un rechargement les rouvre.
  const noterRetrait = () => { if (commande.retrait) stockage.memoriserRetrait(etat.p?.donjon.id ?? ctx.univers?.cleOuverte() ?? null); };
  function prendreLaMain() {
    canal?.postMessage(table.prendreMain(commande, Date.now()));
    stockage.oublierRetrait();
    reglages.sauver(); // ce qui a été réglé en retrait, et ce que l'autre régie a réglé entre-temps
  }
  window.addEventListener('pagehide', () => {
    const depart = table.messageDepart(commande);
    if (depart) canal?.postMessage(depart);
  });
  // Revenue du cache du navigateur par « Précédent » : elle a annoncé son départ et a pu manquer des messages.
  window.addEventListener('pageshow', (e) => { if (e.persisted && commande.main) prendreLaMain(); });

  /** Une régie en retrait le dit en permanence : dans le bandeau au-dessus de la carte (hauteur fixe : la carte ne bouge pas). */
  const tenueAilleurs = () => table.partieTenueAilleurs(commande, etat.p?.donjon.id, stockage.idPartieOuverte());
  function majRetrait() {
    $('support').className = commande.retrait ? '' : etat.consultee === etat.p.salleCourante ? 'sur-table' : 'consultation';
    majBandeau();
  }
  function reprendreLaMain() {
    if (!etat.p) return;
    viderSauvegarde(); // encore en retrait : ne peut rien écraser
    const id = etat.p.donjon.id;
    if (stockage.empreintePartie(id) !== etat.empreinte && stockage.chargerPresentations()[id]) { entrer(etat.p, { reprise: true }); return; }
    prendreLaMain();
    etat.perimee = false;
    sauvegarder(); // ce qui a été fait en retrait n'était pas enregistré
    stockage.memoriserPartieOuverte(id);
    etat.message = 'Cette régie a repris la main : la table montre sa partie.';
    rendre();
  }

  /**
   * N'écrit que la partie de cette régie, jamais sa copie en mémoire des autres : elles ont pu avancer dans un autre onglet.
   * En retrait, on n'enregistre pas CETTE partie si l'autre régie la tient (sa prochaine sauvegarde effacerait tout, sans le dire)
   * ou l'a fait avancer (on n'écrase pas sa version plus récente). La régie le dit : voir majRetrait.
   */
  function sauvegarder() {
    if (!etat.p) return;
    const id = etat.p.donjon.id;
    if (commande.retrait && (tenueAilleurs() || stockage.empreintePartie(id) !== etat.empreinte)) {
      if (!etat.perimee) { etat.perimee = true; majRetrait(); }
      return;
    }
    etat.perimee = false;
    etat.presentations[id] = etat.p;
    const ok = stockage.enregistrerPartie(etat.p);
    if (ok) etat.empreinte = JSON.stringify(etat.p);
    if (!ok && etat.enregistre) {
      etat.enregistre = false; // alerte permanente (en haut de la régie) : un toast serait manqué
      const alerte = $('alerte-stockage');
      alerte.hidden = false;
      alerte.textContent = 'Attention : impossible d’enregistrer la partie dans ce navigateur (stockage plein ou bloqué). Elle continue, mais ne pourra pas être reprise.';
    }
  }
  // Les notes de partie s'enregistrent pendant la frappe, sans redessiner la carte ni toucher à la table.
  let minuteSauvegarde = null;
  const planifierSauvegarde = () => { clearTimeout(minuteSauvegarde); minuteSauvegarde = setTimeout(viderSauvegarde, 300); };
  function viderSauvegarde() {
    if (minuteSauvegarde === null) return;
    clearTimeout(minuteSauvegarde);
    minuteSauvegarde = null;
    sauvegarder();
  }
  window.addEventListener('pagehide', viderSauvegarde);

  /**
   * `reprise` : on rouvre une partie déjà enregistrée, sans rien réécrire (aucune sauvegarde tant que rien ne change).
   * `main` : ouvrir une partie prend la main ; seul le rechargement d'une régie en retrait ne la prend pas.
   */
  function entrer(p, { reprise = false, main = true } = {}) {
    // La liste a pu rester ouverte pendant qu'un autre onglet jouait : on repart de ce qui est enregistré.
    if (reprise) p = stockage.chargerPresentations()[p.donjon.id] || p;
    etat.p = p;
    etat.empreinte = stockage.empreintePartie(p.donjon.id);
    etat.perimee = false;
    if (main) prendreLaMain(); else noterRetrait();
    const prepare = stockage.chargerDonjons()?.donjons?.[p.donjon.id];
    if (prepare) pres.synchroniserPersonnages(p, prepare); // les fiches ont pu changer dans le Donjon
    etat.consultee = p.salleCourante;
    etat.selection = null;
    etat.message = '';
    etat.messageCommande = null;
    etat.brouillon = null;
    noteSalle = null;
    etat.enregistre = true;
    $('alerte-stockage').hidden = true;
    $('depart').hidden = true;
    $('choix-joueurs').hidden = true;
    $('regie').hidden = false;
    ctx.jouer?.mode('donjon');
    document.title = `${p.donjon.nom} · Jouer · Carte de MJ`;
    if (!reprise) sauvegarder();
    if (main) stockage.memoriserPartieOuverte(p.donjon.id); // un rechargement rouvre cette partie
    if (reprise) etat.message = `Partie « ${p.donjon.nom} » reprise, salle « ${salleConsultee().nom} ».`;
    rendre();
  }


  // --- Arbre de lecture (js/atelier/jouer.js) -------------------------------------------------------------------
  /** Le monde dont la partie est en cours (carte affichée, ou donjon d'un monde), ou null pour un donjon joué seul. */
  const mondeEnCours = () => univers.monde();
  /** Ce que l'arbre montre : le monde de la partie et ses donjons, ou le seul donjon joué. */
  function donneesJeu() {
    const m = mondeEnCours();
    const prepares = stockage.chargerDonjons()?.donjons ?? {};
    if (m) {
      const ids = new Set(Object.values(m.univers.lieux).flatMap((l) => l.points.map((q) => q.vers?.donjon)).filter(Boolean));
      const donjons = {};
      for (const id of ids) if (prepares[id]) donjons[id] = prepares[id];
      if (etat.p && ids.has(etat.p.donjon.id)) donjons[etat.p.donjon.id] = etat.p.donjon;
      return { univers: { [m.univers.id]: m.univers }, donjons, mondeActif: m.univers.id };
    }
    return { univers: {}, donjons: etat.p ? { [etat.p.donjon.id]: etat.p.donjon } : {}, donjonActif: etat.p ? { donjon: etat.p.donjon.id, salle: etat.consultee } : null };
  }
  /** Les pastilles : ce qui est à la table, déjà découvert, pas encore montré. */
  function partieJeu() {
    const m = mondeEnCours();
    return { univers: m?.partie ?? null, presentations: etat.p ? { ...etat.presentations, [etat.p.donjon.id]: etat.p } : etat.presentations };
  }
  /** Où l'on est, pour l'arbre : la salle regardée, ou le lieu de la carte. */
  function positionJeu() {
    if (etat.p) return { donjon: etat.p.donjon.id, salle: etat.consultee };
    const m = mondeEnCours();
    return m ? { monde: m.univers.id, lieu: m.partie.lieuCourant } : null;
  }
  function majArbre() { const pos = positionJeu(); if (pos) ctx.jouer?.synchroniser(pos); }
  /** La vue « À la table » est choisie en haut de la scène : l'arbre montre alors tout de suite, sinon il consulte. */
  const vueTable = () => ctx.jouer?.vues.courante() === 'table';
  /** Un nœud de l'arbre choisi. Vue « À la table » : la table y va tout de suite. Vue « En régie » : consultation d'une salle du donjon en cours ou d'un lieu de la carte affichée, sans bouger la table ; le reste, on l'explique. */
  function choisirDansArbre(noeud) {
    if (vueTable() && montrerDepuisArbre(noeud)) return;
    if (noeud.type === 'salle' && etat.p && noeud.contexte.donjon === etat.p.donjon.id) { consulter(noeud.id); return; }
    if (noeud.type === 'lieu' && univers.consulterLieu(noeud.id)) return; // la régie regarde ce lieu, la table ne bouge pas
    if (noeud.type === 'donjon' && etat.p && noeud.id === etat.p.donjon.id) return;
    if (noeud.type === 'monde' && (!noeud.racine || univers.consulterLieu(noeud.racine))) return; // le nœud monde est la carte du monde
    annoncer('La table est ailleurs : choisis la vue « À la table » pour l’y conduire, ou reviens à elle pour la consulter.', 6000);
  }
  /** Met à la table ce que le nœud désigne (lieu, carte du monde, donjon, salle). Faux si l'on ne peut pas (le clic retombe alors sur la consultation). */
  function montrerDepuisArbre(noeud) {
    if (commande.retrait) return false; // en retrait la table n'est pas à cette régie
    if (noeud.type === 'salle' && etat.p && noeud.contexte.donjon === etat.p.donjon.id) { // la salle du donjon à la table
      viderSauvegarde();
      etat.consultee = noeud.id;
      afficherConsulteeATable();
      return true;
    }
    const m = mondeEnCours();
    if (!m || (noeud.contexte?.monde && m.univers.id !== noeud.contexte.monde)) return false; // un autre monde, ou un donjon hors monde : pas de lieu où conduire la table
    if (noeud.type === 'monde') return noeud.racine ? univers.conduireA({ lieu: noeud.racine }) : false;
    if (noeud.type === 'lieu') return univers.conduireA({ lieu: noeud.id });
    if (noeud.type === 'donjon') return noeud.contexte.lieu ? univers.conduireA({ lieu: noeud.contexte.lieu, donjon: noeud.id }) : false;
    if (noeud.type === 'salle') return noeud.contexte.lieu ? univers.conduireA({ lieu: noeud.contexte.lieu, donjon: noeud.contexte.donjon, salle: noeud.id }) : false;
    return false;
  }

  // --- Rendu de la régie ---------------------------------------------------------------------------
  /** Côté de case de la régie : réduit pour que la salle tienne dans la zone (réglage `r.taille` jamais modifié). Sous 760 px, marge plus étroite. */
  function tailleRegie(plan) {
    if (!etat.ajuster) return r.taille;
    return tailleQuiTient($('scene'), plan.largeur, plan.longueur, r.taille, telephone() ? 10 : 28);
  }

  /** Repères posés sur la carte de la régie : portes et escaliers reliés (pastille bleue) et élément sélectionné. */
  function marques(planAffiche) {
    const s = salleConsultee();
    const portesReliees = planAffiche.portes.filter((q) => modele.liaisonDePorte(etat.p.donjon, s.id, q)).map((q) => ({ mur: q.mur, position: q.position }));
    const escaliersRelies = planAffiche.objets.filter((o) => o.type === 'escalier' && modele.liaisonDePorte(etat.p.donjon, s.id, o)).map((o) => ({ x: o.x, y: o.y }));
    const trouve = selection.trouver(planAffiche, etat.selection);
    return { portesReliees, escaliersRelies, selection: trouve, ...(etat.caseVisee?.salle === s.id ? { caseVisee: etat.caseVisee } : {}) };
  }

  function dessinerRegie(plan) {
    const s = salleConsultee();
    const { grille, theme, details, relief, penombre } = optionsRendu(r);
    dessiner($('carte'), pres.planRegie(plan, idsReveles(s.id)), {
      taille: tailleRegie(s.plan), grille, theme: themeParNom(theme), details, relief, penombre, vue: 'mj', reperes: r.reperes !== false, marques: marques(plan),
    });
    marquerDefilement($('carte'), $('scene')); // écran étroit : une carte qui dépasse se fait défiler au doigt
  }

  /** La case montrée s'efface dès qu'un pion s'y pose, ou que ni la régie ni la table ne regardent plus sa salle. */
  function oublierCaseSiResolue() {
    etat.caseVisee = pres.oublierCaseSiResolue(etat.caseVisee, etat.p, etat.consultee);
  }

  function rendre() {
    if (!etat.p) { univers?.redessiner(); return; } // une carte d'univers est affichée : les réglages (partagés) la concernent aussi
    univers.majFil();
    oublierCaseSiResolue();
    const s = salleConsultee();
    dessinerRegie(s.plan);
    ctx.jouer?.cartouche.definir(cartoucheSalle(s.plan.largeur, s.plan.longueur, r.echelle));
    majRetrait();
    majProjection();
    if (etat.message) { annoncer(etat.message); etat.message = ''; } // hors du flux : la carte ne bouge jamais
    selection.maj();
    majSalle();
    majCommande();
    majPersonnages();
    diffuser();
    majArbre();
  }
  /** Après un changement de la partie : on enregistre, puis on redessine. */
  function modifie() { sauvegarder(); rendre(); }

  function consulter(id) {
    if (!(id in etat.p.donjon.salles)) return;
    viderSauvegarde();
    etat.consultee = id;
    etat.selection = null;
    etat.message = '';
    etat.messageCommande = null;
    rendre();
  }

  function afficherConsulteeATable() {
    pres.afficherATable(etat.p, etat.consultee);
    etat.message = `« ${salleConsultee().nom} » est maintenant à la table (et découverte).`;
    modifie();
  }

  /** Ce qui est sur la table, sans ambiguïté, en haut de la zone de carte. */
  function majBandeau() {
    const p = etat.p, courante = salleCourante(), consultee = salleConsultee();
    const bandeau = $('bandeau');
    if (commande.retrait) { // la table ne montre pas cette partie : « À la table » serait faux
      bandeau.className = 'retrait';
      const texte = h('div', { className: 'texte' }, h('span', { className: 'pastille', textContent: 'En retrait' }),
        commande.titulaireParti ? 'La régie qui avait la main a été fermée : la table n’est plus servie.' : 'Une autre régie commande la table : les joueurs ne voient pas ce que tu fais ici.',
        ...(etat.perimee || tenueAilleurs() ? [' Cette partie est aussi ouverte dans l’autre régie : ce que tu fais ici n’est pas enregistré. « Reprendre la main » le garde, sauf si elle y a avancé : tu repars alors de sa version.'] : []));
      texte.title = texte.textContent;
      bandeau.replaceChildren(texte, h('div', { className: 'actions' }, bouton('Reprendre la main', reprendreLaMain, 'btn')));
      return;
    }
    const meme = consultee.id === courante.id;
    bandeau.className = meme ? 'sur-table' : 'consultation';
    const texte = h('div', { className: 'texte' });
    if (meme) {
      texte.append(h('span', { className: 'pastille', textContent: 'À la table' }), 'Les joueurs voient cette salle : ', h('strong', { textContent: courante.nom }), '.');
    } else {
      texte.append(h('span', { className: 'pastille', textContent: 'Consultation' }), 'La table montre toujours ', h('strong', { textContent: courante.nom }), '.');
    }
    const actions = h('div', { className: 'actions' });
    if (!meme) {
      // Pas de doré ici : l'action principale de la régie est « Ouvrir la table » (barre d’outils).
      const afficher = h('button', { type: 'button', id: 'afficher-table', className: 'btn btn-fort' }, icone('oeil'), ' Afficher à la table');
      afficher.addEventListener('click', afficherConsulteeATable);
      const retour = h('button', { type: 'button', className: 'btn', textContent: 'Retour à la table' });
      retour.addEventListener('click', () => consulter(courante.id));
      actions.append(afficher, retour);
    }
    texte.title = texte.textContent; // si le texte est tronqué (hauteur fixe), la phrase entière reste lisible
    bandeau.replaceChildren(texte, actions);
  }

  /** Ce que la table montre de la salle regardée : un interrupteur par catégorie (Monstres, Objets, Plan du donjon). */
  function majProjection() {
    const sur = etat.consultee === etat.p.salleCourante;
    const titre = $('projection-titre');
    titre.hidden = sur;
    titre.textContent = 'La table voit une autre salle : ces réglages valent une fois cette salle à la table.';
    const plan = r.miniTable !== false;
    $('montrer-plan').setAttribute('aria-checked', String(plan));
    $('montrer-plan').title = `${plan ? 'Masquer' : 'Montrer'} à la table le plan des salles découvertes`;
    for (const b of $('projection').querySelectorAll('button[data-categorie]')) {
      const categorie = b.dataset.categorie, masque = pres.estMasque(etat.p, etat.consultee, categorie);
      b.setAttribute('aria-checked', String(!masque));
      b.title = `${masque ? 'Montrer' : 'Masquer'} à la table les ${categorie === 'monstres' ? 'monstres et les PNJ' : 'objets'} de cette salle. Cette régie les montre toujours.`;
    }
  }
  $('montrer-plan').addEventListener('click', () => { if (r.miniTable === false) delete r.miniTable; else r.miniTable = false; reglages.sauver(); diffuser(); majProjection(); });
  for (const b of $('projection').querySelectorAll('button[data-categorie]')) {
    b.addEventListener('click', () => {
      if (!etat.p) return;
      pres.definirMasque(etat.p, etat.consultee, b.dataset.categorie, !pres.estMasque(etat.p, etat.consultee, b.dataset.categorie));
      modifie();
    });
  }

  /** Bloc « Cette salle » : éléments cachés, portes (accessibles au clavier) et notes en lecture seule. */
  function majSalle() {
    const p = etat.p, s = salleConsultee();
    // En-tête de l'onglet Ici (js/regie-panneau.js) : la salle regardée, et si c'est elle que la table voit.
    if ($('regie-entete-nom')) {
      $('regie-entete-nom').textContent = s.nom;
      $('regie-entete-meta').textContent = s.id === p.salleCourante ? 'À la table' : 'Regardée ici seulement : la table voit une autre salle';
    }
    // Cachés : ce qui est préparé en secret et pas encore à la table. Le geste est ici (« Révéler » par ligne, ou « Révéler tout ») ; la carte et l'arbre font le reste.
    const aRevelerOu = (genre, e, nom, position) => ({ genre, e, nom, position });
    const caches = [
      ...s.plan.creatures.filter((k) => k.cache && !pres.estRevele(p, s.id, k.id)).map((k) => aRevelerOu('creature', k, selection.nomPion(k), nomCase(k.x, k.y))),
      ...s.plan.objets.filter((o) => o.cache && !pres.estRevele(p, s.id, o.id)).map((o) => aRevelerOu('objet', o, `${nomAffiche(o.type)}${o.variante ? ` ${nomVariante(o.type, o.variante)}` : ''}`, nomCase(o.x, o.y))),
      ...s.plan.portes.filter((q) => q.cache && !pres.estRevele(p, s.id, q.id)).map((q) => aRevelerOu('porte', q, libelleDePorte(q), '')),
    ];
    $('aucun-cache').hidden = !!caches.length; // la section reste toujours là : elle dit « aucun objet caché »
    $('reveler-tout').disabled = !caches.length;
    $('nb-caches').textContent = String(caches.length);
    $('liste-caches').replaceChildren(...caches.map(({ genre, e, nom, position }) => {
      const b = h('button', { type: 'button', className: 'p-rang compacte cachee', title: `Révéler « ${nom} » à la table` },
        h('span', { className: 'p-rang-icone' }),
        h('span', { className: 'p-rang-nom', textContent: nom }),
        h('span', { className: 'p-rang-position', textContent: position }),
        h('span', { className: 'p-rang-detail', textContent: 'Révéler' }));
      b.addEventListener('click', () => {
        pres.revelerElement(etat.p, s.id, e.id);
        const masquee = pres.categorieMasquee(etat.p, s.id, genre, e);
        etat.message = `Révélé${masquee ? `, mais les ${masquee} sont masqués à la table` : s.id === etat.p.salleCourante ? ' : il apparaît sur la table' : ', mais cette salle n’est pas à la table'}.`;
        modifie();
      });
      return h('li', {}, b);
    }));
    const notes = $('notes');
    notes.textContent = s.notes || 'Aucune note pour cette salle.';
    notes.classList.toggle('vide', !s.notes);
    if (noteSalle !== s.id) { champNotes.value = pres.notePartie(p, s.id); noteSalle = s.id; } // ne jamais écraser ce que le MJ est en train d'écrire
  }
  // Notes de partie : rattachées à la salle regardée, enregistrées avec la partie, jamais diffusées.
  const champNotes = $('notes-partie');
  let noteSalle = null; // salle dont la note est dans le champ
  champNotes.addEventListener('input', () => {
    if (!etat.p || noteSalle === null) return;
    pres.definirNotePartie(etat.p, noteSalle, champNotes.value);
    planifierSauvegarde();
  });
  champNotes.addEventListener('blur', viderSauvegarde);

  // --- Commande rapide (ajoute, supprime, déplace) ---------------------------------------------------
  function majCommande() {
    $('nom-salle-commande').textContent = `(« ${salleConsultee().nom} »)`;
    const m = $('message-commande'), mc = etat.messageCommande;
    m.hidden = !mc;
    m.textContent = mc ? `${mc.ok ? '' : 'Commande non appliquée. '}${mc.texte}` : '';
    m.classList.toggle('refus', !!mc && !mc.ok);
  }
  $('form-commande').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!etat.p) return;
    viderSauvegarde();
    const champ = $('commande');
    const res = pres.appliquerCommande(etat.p, etat.consultee, champ.value);
    etat.messageCommande = { texte: res.message, ok: res.ok };
    if (res.ok) { champ.value = ''; modifie(); } else majCommande();
  });
  const microCommande = creerMicro({
    onTexte: (texte) => { $('commande').value = texte; },
    onEtat: (actif) => { iconeEtTexte($('micro-commande'), actif ? 'stop' : 'micro', actif ? 'Arrêter' : 'Dicter'); $('micro-commande').setAttribute('aria-pressed', String(actif)); },
    onErreur: (texte) => { etat.messageCommande = { texte, ok: false }; majCommande(); },
  });
  if (!microCommande) {
    $('micro-commande').disabled = true;
    $('micro-commande').title = 'La dictée n’est pas disponible dans ce navigateur : la saisie au clavier marche partout.';
  } else {
    $('micro-commande').addEventListener('click', () => microCommande.basculer($('commande').value));
  }
  $('reveler-tout').addEventListener('click', () => {
    const s = salleConsultee();
    const n = pres.revelerToute(etat.p, s.id);
    const masquage = pres.CATEGORIES_MASQUABLES.some((c) => pres.estMasque(etat.p, s.id, c));
    etat.message = n ? `${pluriel(n, 'élément révélé', 'éléments révélés')}${s.id !== etat.p.salleCourante ? ', mais cette salle n’est pas à la table' : masquage ? ' : visibles sur la table, sauf ce qui y est masqué' : ' : visibles sur la table'}.` : 'Rien de plus à révéler.';
    modifie();
  });

  /** Dégâts et soins d'un personnage à fiche : un champ pour le nombre de PV, et un bouton par sens. */
  function reglagePV(perso, enJeu) {
    const champ = h('input', { type: 'number', min: '1', step: '1', inputMode: 'numeric', placeholder: 'PV', 'aria-label': `PV à retirer ou à rendre à ${perso.fiche.nom}` });
    champ.dataset.pv = perso.id;
    const reprendreLaMain = () => [...$('personnages-liste').querySelectorAll('input[data-pv]')].find((c) => c.dataset.pv === perso.id)?.focus({ preventScroll: true });
    const appliquer = (sens) => {
      const n = Math.floor(Number(champ.value));
      if (!(n >= 1)) { annoncer('Indique d’abord un nombre de PV.'); champ.focus(); return; }
      const res = pres.changerPV(etat.p, perso.id, sens * n);
      etat.message = `${perso.fiche.nom} : ${sens < 0 ? pluriel(n, 'dégât', 'dégâts') : `${n} PV rendu${n > 1 ? 's' : ''}`}, ${res.pv}/${res.pvMax} PV.`;
      modifie();
      reprendreLaMain();
    };
    return h('div', { className: 'reglage-pv' }, champ,
      bouton('Dégâts', () => appliquer(-1), 'btn'),
      bouton('Soins', () => appliquer(1), 'btn'),
      ...(enJeu ? [bouton('PV de la fiche', () => { pres.oublierPV(etat.p, perso.id); etat.message = `${perso.fiche.nom} reprend les PV de sa fiche.`; modifie(); reprendreLaMain(); }, 'btn btn-discret')] : []));
  }

  /** Les fiches du donjon et les joueurs sans fiche, et de quoi poser le pion de chacun dans la salle regardée. */
  function majPersonnages() {
    const p = etat.p;
    const carte = (id, dessiner) => {
      const pose = pres.pionDuPersonnage(p, id);
      const ici = pose?.salle === etat.consultee;
      const mention = pose ? `Pion P${pose.pion.numero}, en ${nomCase(pose.pion.x, pose.pion.y)}${ici ? '' : ` dans « ${p.donjon.salles[pose.salle].nom} »`}.` : '';
      const poser = bouton(pose ? 'L’amener dans cette salle' : 'Poser dans cette salle', () => {
        const res = pres.poserPersonnage(p, etat.consultee, id);
        etat.message = res.ok ? `${pres.nomPersonnage(p, id)} est dans « ${salleConsultee().nom} ». Glisse son pion sur la carte pour le déplacer.` : res.message;
        modifie();
      }, 'btn btn-discret');
      return dessiner(ici ? [] : [poser], mention);
    };
    const persos = p.donjon.personnages || [], joueurs = p.joueurs || [];
    $('personnages-vide').hidden = persos.length + joueurs.length > 0;
    $('personnages-liste').replaceChildren(
      ...persos.map((perso) => carte(perso.id, (actions, mention) => {
        const { pv, pvTemp, enJeu } = pres.pvPersonnage(p, perso.id);
        const note = enJeu ? 'PV changés en jeu : la fiche du joueur, elle, ne bouge pas.' : '';
        return carteFiche({ ...perso.fiche, pv, pvTemp }, [reglagePV(perso, enJeu), ...actions], [note, mention].filter(Boolean).join(' '));
      })),
      ...joueurs.map((joueur) => carte(joueur.id, (actions, mention) => carteJoueur(joueur, actions, mention))));
  }

  // Retardataire : le formulaire est dans la page (hors de #personnages-liste), donc majPersonnages ne l'efface jamais et la saisie survit aux rafraîchissements.
  $('form-ajout-joueur').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!etat.p) return;
    const champs = ['nom', 'race', 'classe'].map((c) => $(`ajout-${c}`));
    const res = pres.ajouterRetardataire(etat.p, etat.consultee, { nom: champs[0].value, race: champs[1].value, classe: champs[2].value });
    if (!res.ok) { annoncer(res.message); return; }
    for (const c of champs) c.value = '';
    etat.message = res.pose.ok
      ? `${res.nom} rejoint la partie : pion posé dans « ${salleConsultee().nom} ». Glisse-le sur la carte pour le déplacer.`
      : `${res.nom} rejoint la partie, sans pion. ${res.pose.message} Pose-le depuis sa carte, dans une autre salle.`;
    modifie();
    champs[0].focus({ preventScroll: true });
  });

  // --- Carte : déplacer les pions, cliquer le reste -----------------------------------------------
  // Les objets et les portes ne bougent jamais ici (option `deplacables`) ; ils restent cliquables.
  activerDeplacement($('carte'), {
    plan: () => salleConsultee().plan,
    taille: () => tailleRegie(salleConsultee().plan),
    apercu: (plan) => dessinerRegie(plan),
    deposer: (nouveau) => { pres.appliquerDeplacement(etat.p, etat.consultee, nouveau); etat.message = ''; modifie(); },
    cliquer: (touche, caseVide, position) => {
      etat.selection = touche ? { genre: touche.genre, id: touche.element.id } : null;
      etat.ancreSelection = touche ? position ?? null : null; // le popover de l'élément se pose à côté du clic (regie-selection.js)
      etat.message = '';
      if (caseVide) viserCase(etat.consultee, caseVide[0], caseVide[1]);
      else rendre();
    },
    deplacables: ['creature'],
    portesLarges: true, // zone de clic des portes élargie vers l'intérieur ; un glissement sur un pion déplace toujours le pion
  });

  // --- Fenêtre table -------------------------------------------------------------
  const messageTable = (texte) => annoncer(texte, 10000);
  let veilleFenetre = null;
  function ouvrirFenetreTable() {
    const w = window.open(new URL('presentation.html?vue=table', location.href).href, 'carte-de-mj-table', 'popup,width=1024,height=768');
    if (w) {
      w.focus();
      jouer.boutonTable?.ouverte(true); // discret tant que la fenêtre est ouverte, doré de nouveau à sa fermeture
      clearInterval(veilleFenetre);
      veilleFenetre = setInterval(() => { if (w.closed) { clearInterval(veilleFenetre); jouer.boutonTable?.ouverte(false); } }, 1000); messageTable('Fenêtre table ouverte : glisse-la sur l’écran de la table, puis son bouton « Plein écran » (au survol, en haut à droite).'); }
    else messageTable('Le navigateur a bloqué la fenêtre. Autorise les fenêtres pour ce site, ou ouvre presentation.html?vue=table dans un nouvel onglet.');
  }


  // Échap : UN SEUL écouteur, dans l'ordre de priorité qu'avaient les trois d'avant (enregistrés dans cet ordre, sans stopPropagation :
  // la sélection appelait preventDefault et les autres s'effaçaient devant lui ou par leurs propres conditions).
  //  1. un plein écran en cours : Échap sert déjà à en sortir, rien à faire ;
  //  2. une sélection ouverte : la ferme, sauf dans un champ de saisie ou de liste (Échap y sert déjà) ;
  //  3. sinon la case montrée : l'enlève, sauf dans n'importe quel champ (cases à cocher comprises).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (e.defaultPrevented || !etat.p || document.fullscreenElement) return;
    const cible = e.target instanceof HTMLElement ? e.target : null;
    if (etat.selection) {
      if (cible?.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select, [contenteditable]')) return;
      e.preventDefault();
      selection.deselectionner();
    } else if (etat.caseVisee) {
      if (cible?.matches('input, textarea, select, [contenteditable]')) return;
      etat.caseVisee = null;
      rendre();
    }
  });

  // --- Câblage des modules de la régie ---------------------------------------------------------------
  // Tout ce qui précède est déclaré (fonctions) ou défini (constantes) : on peut le donner aux modules. Ils ne l'appellent
  // qu'une fois la page démarrée, jamais pendant leur création.
  poserIcones();
  lierPanneau();
  sectionnerOnglets(creerSection); // les onglets en sections de panneau (docs/design-panneaux.md)
  const ctx = { etat, r, commande, canal, affichageTable, prendreLaMain, annoncer, rendre, modifie, salleCourante, salleConsultee, entrer, viderSauvegarde, noterRetrait, diffuser };
  const depart = creerDepart(ctx);
  ctx.depart = depart;
  const univers = creerRegieUnivers(ctx);
  ctx.univers = univers;
  const selection = creerSelection(ctx);
  // La coquille de l'atelier : arbre de lecture, onglets Ici · Joueurs · Écran. Créée avant les réglages (le popover « Affichage » porte la taille d'une case
  // et « Adapter ») et après `univers` et `etat`, qu'elle lit.
  let reglages;
  const jouer = creerJouer({ racine: $('regie'), donnees: donneesJeu, partie: partieJeu, surChoix: choisirDansArbre,
    ouvrirTable: { fenetre: ouvrirFenetreTable },
    cadrage,
    affichage: { regie: true, garderOuvert: () => ctx.calibrage?.actif() === true, lire: () => r, surChangement: () => { reglages.sauver(); rendre(); diffuser(); } } });
  reglages = creerReglages(ctx);
  ctx.jouer = jouer;
  let minuterie;
  window.addEventListener('resize', () => { clearTimeout(minuterie); minuterie = setTimeout(() => { if (etat.p) rendre(); }, 150); });

  // Démarrage (voir pres.ouvertureDemandee) : un rechargement (F5) rouvre la régie qui était ouverte, telle quelle (rien n'est relancé ni écrasé) ;
  // arriver par un lien de navigation montre la liste des parties. « ← Liste des parties » ramène à la liste et oublie la partie ouverte.
  // Une partie qui ne se relit pas en entier est copiée à part avant que quoi que ce soit puisse l'enregistrer.
  const miseDeCote = stockage.mettreDeCotePresentations();
  etat.presentations = stockage.chargerPresentations();
  const ouverture = pres.ouvertureDemandee({
    rechargement: pres.estRechargement(globalThis.performance?.getEntriesByType?.('navigation')?.[0]?.type),
  });
  /** Ouvre (ou commence) la partie de ce monde : la carte d'univers s'affiche. Faux si le monde n'existe plus ou n'a aucune carte. */
  function ouvrirMonde(id) { return univers.ouvrirParId(id); }
  ctx.ouvrirMonde = ouvrirMonde;
  function ouvrirDemande() {
    if (ouverture.genre === 'reprise') {
      // Rechargement : l'onglet qui avait la main la reprend (sinon la table resterait sans régie) ; celui qui était en retrait y reste,
      // avec sa propre partie : recharger un vieil onglet ne doit pas renvoyer sa partie à la table.
      const mondeEnRetrait = retraitAvantRechargement && pu.universOuvert(retraitAvantRechargement.partie);
      if (mondeEnRetrait && univers.reprendre({ id: mondeEnRetrait, main: false })) return true; // la carte du monde, toujours en retrait
      const aReprendre = retraitAvantRechargement ? stockage.partieDuRetrait(retraitAvantRechargement, etat.presentations) : stockage.partieAReprendre(etat.presentations);
      if (!retraitAvantRechargement && univers.reprendre()) return true; // la carte d'univers rouverte
      if (aReprendre) { entrer(aReprendre, { reprise: true, main: !retraitAvantRechargement }); return true; }
    }
    return false;
  }
  if (!ouvrirDemande()) {
    if (!retraitAvantRechargement) stockage.oublierPartieOuverte(); // la liste est affichée : un rechargement y reste
    depart.afficher();
  }
  // Dit une fois, après le premier affichage ; un échec, lui, est redit à chaque ouverture puisque rien n'est enregistré.
  if (miseDeCote && (miseDeCote.nouvelle || !miseDeCote.ok)) {
    const phrase = stockage.phraseMiseDeCoteParties(miseDeCote);
    const surDepart = $('alerte-parties'); // l'écran de départ n'a pas de toast : le message y reste affiché
    surDepart.textContent = phrase;
    surDepart.classList.toggle('erreur', !miseDeCote.ok);
    surDepart.hidden = false;
    if (miseDeCote.ok) { if (etat.p) annoncer(phrase, 15000); }
    else { const alerte = $('alerte-stockage'); alerte.hidden = false; alerte.textContent = phrase; } // permanent : un toast serait manqué
  }
}
