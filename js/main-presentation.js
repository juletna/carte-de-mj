/**
 * Point d'entrée de la Présentation (outil indépendant : ni Fiche, ni réseau).
 *
 * Deux modes, selon l'adresse :
 *  - presentation.html            la RÉGIE du MJ : choix du donjon, carte complète, révélations, portes ;
 *  - presentation.html?vue=table  la VUE TABLE : uniquement la carte, alimentée par la régie.
 *
 * La logique (copie du donjon, portes, révélations, improvisation, plan envoyé à la table) est dans presentation.js.
 * Ici : DOM, stockage et BroadcastChannel.
 *
 * Plusieurs régies peuvent être ouvertes : une seule commande la table (voir commande-table.js).
 *
 * SÉCURITÉ : la vue table ne lit jamais les présentations du localStorage et ne reçoit de la
 * régie que le résultat de vueTable() et de miniPlanTable() (voir presentation.js). Aucun secret n'arrive à sa fenêtre.
 */
import * as stockage from './stockage.js';
import * as modele from './donjon.js';
import * as pres from './presentation.js';
import * as table from './commande-table.js';
import { dessiner, dessinerPlanDonjon } from './rendu/moteur.js';
import { disposerPlan, cleDisposition } from './plan-donjon.js';
import { activerDeplacement } from './deplacement.js';
import { creerMiniPlan } from './miniplan.js';
import { carteFiche, carteJoueur } from './carte-personnage.js';
import { MAX_JOUEURS } from './personnages.js';
import { LISTES } from './schema.js';
import { nomCase, libelleSelection, libelleDePorte } from './parseur/coordonnees.js';
import { nomAffiche } from './parseur/lexique.js';
import { creerMicro } from './voix.js';
import { AFFICHAGE_PAR_DEFAUT, modeTable, tailleTable, affichageDeReglages, validerAffichage, tailleQuiTientPlan } from './affichage.js';
import { telephone, activerOnglets, marquerDefilement, tailleQuiTient } from './telephone.js';
import { $, h, bouton, deuxTemps, fichierChoisi } from './dom.js';
import { pluriel, LIBELLE_FERMER, libelleMicro } from './format.js';

const ouvrirCanal = () => { try { return new BroadcastChannel(pres.CANAL); } catch { return null; } };

// =============================================================================
// Écran de table (partagé : fenêtre ?vue=table et « Plein écran ici »)
// =============================================================================
const ecran = { plan: null, mini: null, caseVisee: null, affichage: { ...AFFICHAGE_PAR_DEFAUT } };

/** Côté de case à la table : « échelle réelle » = la taille calibrée, exacte ; « remplir » = calculé sur la fenêtre. */
function tailleEcranTable() {
  const v = $('vue-table');
  return tailleTable({ mode: ecran.affichage.mode, plan: ecran.plan, vue: { largeur: v.clientWidth, hauteur: v.clientHeight }, taille: ecran.affichage.taille });
}

function optionsEcran(taille) {
  const { grille, reperes } = ecran.affichage;
  return { taille, grille, reperes, marques: ecran.caseVisee ? { caseVisee: ecran.caseVisee } : {} };
}

/**
 * À la souris, le MJ agit aussi depuis l'écran de table : glisser un pion, montrer une case. Un doigt de joueur sur la carte
 * ne déclenche rien. L'écran de table ne décide de rien : il demande à la régie, qui seule a le plan complet.
 */
function activerActionsTable({ deplacer, viser }) {
  activerDeplacement($('carte-table'), {
    plan: () => ecran.plan,
    taille: () => tailleEcranTable(),
    apercu: (plan) => dessiner($('carte-table'), plan, optionsEcran(tailleEcranTable())),
    deposer: (nouveau) => {
      const pion = nouveau.creatures.find((k, i) => k.x !== ecran.plan.creatures[i].x || k.y !== ecran.plan.creatures[i].y);
      if (pion) deplacer(pion.id, pion.x, pion.y);
    },
    cliquer: (touche, caseVide) => { if (!touche && caseVide) viser(caseVide[0], caseVide[1]); },
    deplacables: ['creature'],
    filtre: (e) => e.pointerType === 'mouse',
  });
}

function rendreEcranTable() {
  const carte = $('carte-table');
  $('attente').hidden = !!ecran.plan;
  carte.hidden = !ecran.plan;
  const mini = $('mini-table');
  mini.hidden = !ecran.plan || !ecran.mini;
  if (!ecran.plan) return;
  if (ecran.mini) {
    const { donjon, disposition, actif, portesFermees } = ecran.mini;
    const taille = tailleQuiTientPlan(disposition, Math.min(window.innerWidth * 0.28, 400), Math.min(window.innerHeight * 0.36, 340));
    dessinerPlanDonjon(mini, donjon, disposition, { taille, actif, portesFermees, noms: false, pions: false, surbrillance: true });
  }
  const taille = tailleEcranTable();
  carte.dataset.taille = String(taille); // mesurable (tests, vérification) ; aucun secret
  dessiner(carte, ecran.plan, optionsEcran(taille)); // aucun repère de liaison ni de sélection
}
// Recalculé quand la fenêtre change de taille (le mode « remplir » suit ; « échelle réelle » ne bouge pas).
let minuteTaille;
window.addEventListener('resize', () => {
  clearTimeout(minuteTaille);
  minuteTaille = setTimeout(() => { if (ecran.plan && !$('ecran-table').hidden) rendreEcranTable(); }, 120);
});

// Boutons de coin : invisibles ET inactifs (pointer-events: none) tant que la souris n'a pas bougé, puis quelques
// secondes. Un toucher (joueur qui pose le doigt sur la carte) ne les réveille jamais.
const DUREE_COINS = 3500;
let minuteCoins;
function cacherCoins() { clearTimeout(minuteCoins); $('ecran-table').classList.remove('coins-visibles'); reinitialiserRetour?.(); }
function montrerCoins() {
  $('ecran-table').classList.add('coins-visibles');
  clearTimeout(minuteCoins);
  minuteCoins = setTimeout(cacherCoins, DUREE_COINS);
}
$('ecran-table').addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') montrerCoins(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Tab' && !$('ecran-table').hidden) montrerCoins(); });
let reinitialiserRetour = null;
// « Retour à la régie » demande deux gestes : un premier appui arme le bouton, le second (dans les 4 s) confirme.
// Il est défini dans demarrerRegie (il n'existe que là).

/** Fait défiler la vue table d'une part de l'écran (-1, 0 ou 1 par axe), ou la recentre. */
function defilerEcranTable({ dx = 0, dy = 0, recentrer = false }) {
  const v = $('vue-table');
  if (recentrer) v.scrollTo({ left: (v.scrollWidth - v.clientWidth) / 2, top: (v.scrollHeight - v.clientHeight) / 2 });
  else v.scrollBy({ left: dx * Math.round(v.clientWidth * 0.6), top: dy * Math.round(v.clientHeight * 0.6) });
}

function basculerPleinEcran() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else $('ecran-table').requestFullscreen?.().catch(() => {});
}
$('plein-ecran-table').addEventListener('click', basculerPleinEcran);
document.addEventListener('fullscreenchange', () => {
  $('plein-ecran-table').textContent = document.fullscreenElement ? '⛶ Quitter le plein écran' : '⛶ Plein écran';
});

const entierSigne = (v) => (v === -1 || v === 0 || v === 1 ? v : 0);

// =============================================================================
// Mode VUE TABLE
// =============================================================================
function demarrerTable() {
  document.body.classList.add('vue-table');
  document.title = 'Table · Carte de MJ';
  $('ecran-table').hidden = false;
  const reglages = stockage.chargerReglages(); // seuls les réglages d'affichage : jamais les présentations
  ecran.affichage = affichageDeReglages(reglages);
  const attendre = (texte) => { ecran.plan = null; $('attente').textContent = texte; rendreEcranTable(); };

  const canal = ouvrirCanal();
  if (!canal) { attendre('Ce navigateur ne permet pas de recevoir la présentation (BroadcastChannel indisponible).'); return; }
  let recu = false, regiePresente = false;
  canal.onmessage = (ev) => {
    const m = ev.data;
    if (!m || typeof m !== 'object') return;
    if (m.type === 'etat') {
      recu = true;
      ecran.affichage = validerAffichage(m.affichage, ecran.affichage);
      const plan = m.plan ? pres.recevoirVueTable(m.plan) : null;
      ecran.mini = m.mini ? pres.recevoirMiniPlan(m.mini) : null;
      ecran.caseVisee = pres.recevoirCaseVisee(m.caseVisee, plan);
      if (plan) { ecran.plan = plan; rendreEcranTable(); } else attendre('La présentation n’a pas commencé. Lance-la depuis la régie.');
    } else if (m.type === 'defiler') {
      defilerEcranTable({ dx: entierSigne(m.dx), dy: entierSigne(m.dy), recentrer: m.recentrer === true });
    } else if (m.type === table.PRESENCE) {
      regiePresente = true; // on continue à demander : la régie qui a la main, ou qui la reprendra, nous servira
      if (!ecran.plan) attendre('En attente de la régie : lance une présentation, ou clique sur « Reprendre la main » dans une régie en retrait.');
    }
  };
  activerActionsTable({
    deplacer: (id, x, y) => canal.postMessage({ type: 'table-deplacer', id, x, y }),
    viser: (x, y) => canal.postMessage({ type: 'table-viser', x, y }),
  });
  attendre('En attente de la régie…');
  const demander = () => canal.postMessage({ type: 'demande-etat' });
  demander();
  const relance = setInterval(() => { if (recu) clearInterval(relance); else demander(); }, 2000);
  setTimeout(() => {
    if (!recu && !regiePresente) attendre('Aucune régie ne répond. Ouvre presentation.html dans une autre fenêtre de ce navigateur et lance une présentation.');
  }, 1500);
}

// =============================================================================
// Mode RÉGIE
// =============================================================================
function demarrerRegie() {
  const canal = ouvrirCanal();
  const retraitAvantRechargement = stockage.retraitMemorise();
  const commande = table.creerCommande(table.nouvelIdRegie(), { retrait: !!retraitAvantRechargement });
  const r = stockage.chargerReglages();
  const etat = {
    presentations: {},   // { idDonjon: présentation } (copie en mémoire de ce qui est sauvegardé)
    p: null,             // présentation en cours
    consultee: null,     // salle que le MJ regarde (≠ forcément la salle à la table) : jamais sauvegardée
    selection: null,     // { genre, id } : les identifiants sont stables dans la copie
    message: '',
    messageCommande: null, // { texte, ok } : réponse à la dernière commande rapide (régie seulement)
    brouillon: null,     // { cle, texte, nom } : description de la salle à créer derrière une porte, gardée si on redessine
    groupeSuit: true,    // case « Le groupe suit »
    ajuster: true,       // adapter la carte de la régie à la fenêtre (n'agit pas sur la table)
    fichier: null,       // { donjon, avertissements } : donjon ouvert depuis un fichier
    focusSelection: false, // le focus doit passer au panneau de sélection au prochain rendu
    caseVisee: null,     // { salle, x, y } : la case que le MJ montre aux joueurs. Jamais sauvegardée
    pleinIci: false,
    enregistre: true,
    empreinte: null,     // la partie telle que cette régie l'a lue ou écrite en dernier (voir sauvegarder)
    perimee: false,      // en retrait : l'autre régie a fait avancer cette partie, on ne l'enregistre plus ici
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
  const affichageTable = () => affichageDeReglages(r);
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
  /** Envoie à la table le plan de vueTable(), la mini-carte de miniPlanTable(), et rien d'autre. */
  function diffuser() {
    if (!commande.main) return;
    canal?.postMessage({ type: 'etat', plan: etat.p ? pres.vueTable(etat.p) : null, mini: miniTable(), caseVisee: caseATable(), affichage: affichageTable() });
  }
  /** La case montrée, si elle est dans la salle que voient les joueurs. */
  const caseATable = () => pres.caseATable(etat.p, etat.caseVisee);

  /** Un clic sur une case vide la montre ; un clic sur la même case l'enlève. */
  function viserCase(idSalle, x, y) {
    etat.caseVisee = pres.viserCase(etat.caseVisee, etat.p, idSalle, x, y);
    rendre();
  }
  function deplacerDepuisTable(id, x, y) {
    if (!etat.p) return;
    if (pres.deplacerPion(etat.p, etat.p.salleCourante, id, x, y)) modifie();
    else { diffuser(); majEcranLocal(); } // refusé : la table reprend la position d'avant
  }
  if (canal) {
    canal.onmessage = (ev) => {
      const m = ev.data;
      const action = table.surMessage(commande, m);
      if (action === 'retrait') { noterRetrait(); if (etat.p) majRetrait(); }
      else if (action === 'diffuser') diffuser();
      else if (action === 'presence') canal.postMessage({ type: table.PRESENCE });
      else if (action === 'appliquer' && m.type === 'table-deplacer') deplacerDepuisTable(m.id, m.x, m.y);
      else if (action === 'appliquer' && etat.p) viserCase(etat.p.salleCourante, m.x, m.y);
    };
  }
  const noterRetrait = () => { if (commande.retrait) stockage.memoriserRetrait(etat.p?.donjon.id); };
  function prendreLaMain() {
    canal?.postMessage(table.prendreMain(commande, Date.now()));
    stockage.oublierRetrait();
  }
  window.addEventListener('pagehide', () => {
    const depart = table.messageDepart(commande);
    if (depart) canal?.postMessage(depart);
  });
  // Revenue du cache du navigateur par « Précédent » : elle a annoncé son départ et a pu manquer des messages.
  window.addEventListener('pageshow', (e) => { if (e.persisted && commande.main) prendreLaMain(); });

  /** Une régie en retrait le dit en permanence : dans son panneau, et dans le bandeau au-dessus de la carte (hauteur fixe : la carte ne bouge pas). */
  function majRetrait() {
    const alerte = $('alerte-retrait');
    alerte.hidden = !commande.retrait;
    if (commande.retrait) {
      $('texte-retrait').textContent = [
        commande.titulaireParti
          ? 'La régie qui avait la main a été fermée : la table n’est plus servie. Reprends la main pour lui montrer cette partie.'
          : 'Cette régie est en retrait : une autre régie a ouvert une partie et commande la table. Ce que tu fais ici n’est plus montré aux joueurs. Si cette autre régie a été fermée, reprends la main.',
        ...(etat.perimee ? ['Cette partie a avancé dans l’autre régie : ce que tu fais ici n’est plus enregistré. « Reprendre la main » repart de la version la plus récente.'] : []),
      ].join(' ');
    }
    $('support').className = commande.retrait ? '' : etat.consultee === etat.p.salleCourante ? 'sur-table' : 'consultation';
    majBandeau();
  }
  function reprendreLaMain() {
    if (!etat.p) return;
    viderSauvegarde(); // encore en retrait : ne peut rien écraser
    const id = etat.p.donjon.id;
    if (stockage.empreintePartie(id) !== etat.empreinte && stockage.chargerPresentations()[id]) { entrer(etat.p, { reprise: true }); return; }
    prendreLaMain();
    stockage.memoriserPartieOuverte(id);
    etat.message = 'Cette régie a repris la main : la table montre sa partie.';
    rendre();
  }
  $('reprendre-main').addEventListener('click', reprendreLaMain);

  /**
   * N'écrit que la partie de cette régie, jamais sa copie en mémoire des autres : elles ont pu avancer dans un autre onglet.
   * En retrait, si l'autre régie a fait avancer CETTE partie, on n'écrase pas sa version plus récente.
   */
  function sauvegarder() {
    if (!etat.p) return;
    const id = etat.p.donjon.id;
    if (commande.retrait && stockage.empreintePartie(id) !== etat.empreinte) {
      if (!etat.perimee) { etat.perimee = true; majRetrait(); }
      return;
    }
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
  const sauverReglages = () => stockage.sauverReglages(r);
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

  // --- Écran de départ -------------------------------------------------------------------------
  let compteurDepart = 0;
  function ligneDonjon(d) {
    const enCours = etat.presentations[d.id];
    const n = Object.keys(d.salles).length;
    const infos = h('div', { className: 'infos' }, h('b', { textContent: d.nom }),
      h('span', { textContent: pluriel(n, 'salle', 'salles') }));
    if (enCours) infos.append(h('br'), h('span', { className: 'en-cours', textContent: pres.resumePartie(enCours) }));
    const boutons = h('div', { className: 'boutons' });
    // « Commencer par » : la première salle du donjon est présélectionnée (pas la dernière modifiée dans le Donjon).
    const salles = Object.values(d.salles);
    const depart = h('select', { id: `depart-${++compteurDepart}` });
    salles.forEach((sa, i) => depart.append(h('option', { value: sa.id, textContent: `${i + 1}. ${sa.nom}` })));
    depart.value = pres.salleDepart(d);
    const commencer = () => pres.creerPresentation(d, { salleDepart: depart.value });
    const choix = salles.length > 1
      ? h('div', { className: 'depart-choix' }, h('label', { htmlFor: depart.id, textContent: enCours ? 'Recommencer par' : 'Commencer par' }), depart)
      : null;
    if (enCours) {
      const reprendre = h('button', { type: 'button', textContent: 'Reprendre' });
      reprendre.addEventListener('click', () => entrer(enCours, { reprise: true }));
      const recommencer = h('button', { type: 'button', className: 'discret' });
      // La partie en cours n'est remplacée qu'une fois le choix validé : « ← Liste des donjons » la laisse intacte.
      deuxTemps(recommencer, 'Recommencer', 'Effacer la partie ?', () => demanderJoueurs(commencer(), enCours.joueurs));
      boutons.append(reprendre, recommencer);
    } else {
      const demarrer = h('button', { type: 'button', textContent: 'Présenter' });
      demarrer.addEventListener('click', () => demanderJoueurs(commencer()));
      boutons.append(demarrer);
    }
    return h('li', {}, infos, ...(choix ? [choix] : []), boutons);
  }

  function ligneOrpheline(p) {
    const reprendre = h('button', { type: 'button', textContent: 'Reprendre' });
    reprendre.addEventListener('click', () => entrer(p, { reprise: true }));
    const abandonner = h('button', { type: 'button', className: 'discret' });
    deuxTemps(abandonner, 'Abandonner', 'Supprimer la partie ?', () => {
      stockage.supprimerPartie(p.donjon.id);
      afficherDepart();
    });
    return h('li', {}, h('div', { className: 'infos' }, h('b', { textContent: p.donjon.nom }), h('span', { className: 'en-cours', textContent: pres.resumePartie(p) })),
      h('div', { className: 'boutons' }, reprendre, abandonner));
  }

  function afficherDepart() {
    viderSauvegarde();
    etat.p = null;
    etat.consultee = null;
    noterRetrait();
    quitterPleinIci();
    $('regie').hidden = true;
    $('choix-joueurs').hidden = true;
    $('depart').hidden = false;
    document.title = 'Présentation · Carte de MJ';
    const charge = stockage.chargerDonjons();
    const donjons = charge ? Object.values(charge.donjons) : [];
    etat.presentations = stockage.chargerPresentations();
    $('liste-donjons').replaceChildren(...donjons.map(ligneDonjon));
    $('biblio-vide').hidden = donjons.length > 0;
    const idsBiblio = new Set(donjons.map((d) => d.id));
    const orphelines = Object.values(etat.presentations).filter((p) => !idsBiblio.has(p.donjon.id));
    $('orphelines-presentations').hidden = orphelines.length === 0;
    $('liste-orphelines').replaceChildren(...orphelines.map(ligneOrpheline));
    $('liste-fichier').replaceChildren(...(etat.fichier ? [ligneFichier(etat.fichier)] : []));
    diffuser(); // si cette régie a la main, la table n'affiche plus rien tant qu'aucune partie n'est ouverte
  }

  function ligneFichier({ donjon, avertissements }) {
    const li = ligneDonjon(donjon);
    if (avertissements.length) li.querySelector('.infos').append(h('br'), h('span', { textContent: `À noter : ${avertissements.join(' · ')}` }));
    return li;
  }

  $('fichier').addEventListener('change', async (e) => {
    const fichier = fichierChoisi(e);
    if (!fichier) return;
    const erreur = $('erreur-fichier');
    erreur.hidden = true;
    try {
      const brut = await stockage.lireFichierJson(fichier);
      const res = modele.convertirImport(brut, { echelle: r.echelle });
      if (!res.donjon) throw new Error(res.erreurs.join(' · '));
      // Un fichier de donjon garde son identifiant (convertirImport) : on retrouve ainsi sa partie en cours. Il n'entre PAS dans la bibliothèque.
      etat.fichier = { donjon: res.donjon, avertissements: res.avertissements };
      afficherDepart();
    } catch (err) {
      erreur.hidden = false;
      erreur.textContent = `Fichier refusé : ${err.message}`; // textContent : jamais interprété comme du HTML
    }
  });

  // --- Qui joue ? Une partie neuve : fiches du donjon, ou nombre de joueurs avec nom, race et classe ---------------
  const choix = { partie: null, lignes: [] }; // lignes : ce qui est saisi, gardé si le nombre baisse puis remonte
  const modeChoisi = () => document.querySelector('input[name="mode-joueurs"]:checked')?.value;
  const nombreJoueurs = () => {
    const n = Number($('nb-joueurs').value);
    return Number.isInteger(n) ? Math.min(MAX_JOUEURS, Math.max(1, n)) : 1;
  };
  const fichesCochees = () => [...$('liste-fiches').querySelectorAll('input:checked')].map((c) => c.value);

  function dessinerLignesJoueurs() {
    const champ = (ligne, cle, libelle) => {
      const input = h('input', { type: 'text', value: ligne[cle] || '', maxLength: 80 });
      input.addEventListener('input', () => { ligne[cle] = input.value; });
      return h('label', {}, libelle, input);
    };
    $('lignes-joueurs').replaceChildren(...Array.from({ length: nombreJoueurs() }, (_, i) => {
      const ligne = choix.lignes[i] || (choix.lignes[i] = {});
      return h('fieldset', { className: 'ligne-joueur' }, h('legend', { textContent: `Joueur ${i + 1}` }),
        champ(ligne, 'nom', 'Nom'), champ(ligne, 'race', 'Race'), champ(ligne, 'classe', 'Classe'));
    }));
  }

  /** Le texte du bouton dit ce qui va se passer. */
  function majChoix() {
    const mode = modeChoisi();
    $('zone-fiches').hidden = mode !== 'fiches';
    $('zone-nombre').hidden = mode !== 'nombre';
    const n = mode === 'fiches' ? fichesCochees().length : mode === 'nombre' ? nombreJoueurs() : 0;
    const qui = mode === 'fiches' ? pluriel(n, 'personnage', 'personnages') : pluriel(n, 'joueur', 'joueurs');
    $('lancer-joueurs').textContent = n ? `Présenter avec ${qui}` : 'Présenter sans pion';
  }

  /** `precedents` : les joueurs de la partie qu'on recommence, pour ne pas tout ressaisir. */
  function demanderJoueurs(partie, precedents = []) {
    choix.partie = partie;
    choix.lignes = precedents.map(({ nom, race, classe }) => ({ nom, race, classe }));
    const fiches = partie.donjon.personnages || [];
    const prepares = Object.values(partie.donjon.salles).flatMap((s) => s.plan.creatures).filter((k) => k.camp === 'pj').length;
    $('choix-donjon').textContent = partie.donjon.nom;
    $('mode-fiches').disabled = !fiches.length;
    $('liste-fiches').replaceChildren(...fiches.map(({ id, fiche }) => {
      const coche = h('input', { type: 'checkbox', value: id, checked: true });
      const identite = [fiche.race, fiche.classe].filter(Boolean).join(' · ');
      return h('li', {}, h('label', {}, coche, h('span', {}, h('b', { textContent: fiche.nom }), identite ? h('span', { className: 'doux', textContent: ` ${identite}` }) : '')));
    }));
    const note = [
      ...(fiches.length ? [] : ['Ce donjon n’a aucune fiche : elles s’ajoutent dans le Donjon, outil « Personnages ».']),
      ...(prepares ? [`Le donjon a déjà ${pluriel(prepares, 'pion de joueur', 'pions de joueurs')} dans ses salles : ${prepares > 1 ? 'ils restent' : 'il reste'} en plus.`] : []),
    ].join(' ');
    $('note-choix').hidden = !note;
    $('note-choix').textContent = note;
    $('nb-joueurs').max = String(MAX_JOUEURS);
    $('nb-joueurs').value = String(precedents.length || 4);
    $(precedents.length ? 'mode-nombre' : fiches.length ? 'mode-fiches' : prepares ? 'mode-aucun' : 'mode-nombre').checked = true;
    dessinerLignesJoueurs();
    majChoix();
    $('depart').hidden = true;
    $('regie').hidden = true;
    $('choix-joueurs').hidden = false;
    document.title = `Qui joue ? · ${partie.donjon.nom} · Carte de MJ`;
    window.scrollTo(0, 0);
    $('titre-choix').focus({ preventScroll: true });
  }

  for (const radio of document.querySelectorAll('input[name="mode-joueurs"]')) radio.addEventListener('change', majChoix);
  $('liste-fiches').addEventListener('change', majChoix);
  $('nb-joueurs').addEventListener('input', () => { dessinerLignesJoueurs(); majChoix(); });
  $('nb-joueurs').addEventListener('change', () => { $('nb-joueurs').value = String(nombreJoueurs()); });
  $('annuler-joueurs').addEventListener('click', afficherDepart);
  $('form-joueurs').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = choix.partie, mode = modeChoisi();
    if (!p) return;
    const ids = mode === 'fiches' ? fichesCochees() : mode === 'nombre' ? pres.ajouterJoueurs(p, choix.lignes.slice(0, nombreJoueurs())) : [];
    const { poses, restes } = pres.poserAuDepart(p, ids);
    entrer(p);
    if (!ids.length) return;
    const nomSalle = salleCourante().nom;
    annoncer([
      ...(poses ? [`${pluriel(poses, 'pion de joueur posé', 'pions de joueurs posés')} dans « ${nomSalle} ».`] : []),
      ...(restes.length ? [`Plus de place pour : ${restes.join(', ')}. Leur fiche, dans « Personnages », permet de les poser ailleurs.`] : []),
    ].join(' '));
  });

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
    $('nom-donjon').textContent = p.donjon.nom;
    document.title = `${p.donjon.nom} · Présentation · Carte de MJ`;
    if (!reprise) sauvegarder();
    if (main) stockage.memoriserPartieOuverte(p.donjon.id); // un rechargement rouvre cette partie
    if (reprise) etat.message = `Partie « ${p.donjon.nom} » rouverte, salle « ${salleConsultee().nom} ». « ← Liste des donjons » ramène à l’écran de départ.`;
    rendre();
  }
  // En retrait, la partie ouverte mémorisée est celle de l'autre régie : on n'y touche pas.
  $('quitter').addEventListener('click', () => { if (!commande.retrait) stockage.oublierPartieOuverte(); afficherDepart(); });

  // --- Rendu de la régie ---------------------------------------------------------------------------
  const trouver = (plan, sel) => {
    const e = sel && (plan[LISTES[sel.genre]] || []).find((x) => x.id === sel.id);
    return e ? { genre: sel.genre, element: e } : null;
  };

  /** Côté de case de la régie : réduit pour que la salle tienne dans la zone (réglage `r.taille` jamais modifié). Sous 760 px, marge plus étroite. */
  function tailleRegie(plan) {
    if (!etat.ajuster) return r.taille;
    return tailleQuiTient($('scene'), plan.largeur, plan.longueur, r.taille, telephone() ? 10 : 28);
  }

  /** Repères posés sur la carte de la régie : portes reliées (pastille bleue) et élément sélectionné. */
  function marques(planAffiche) {
    const s = salleConsultee();
    const portesReliees = planAffiche.portes.filter((q) => modele.liaisonDePorte(etat.p.donjon, s.id, q)).map((q) => ({ mur: q.mur, position: q.position }));
    const trouve = trouver(planAffiche, etat.selection);
    return { portesReliees, selection: trouve, ...(etat.caseVisee?.salle === s.id ? { caseVisee: etat.caseVisee } : {}) };
  }

  function dessinerRegie(plan) {
    const s = salleConsultee();
    dessiner($('carte'), pres.planRegie(plan, idsReveles(s.id)), {
      taille: tailleRegie(s.plan), grille: r.grille, reperes: r.reperes !== false, marques: marques(plan),
    });
    marquerDefilement($('carte'), $('scene')); // écran étroit : une carte qui dépasse se fait défiler au doigt
  }

  /** La case montrée s'efface dès qu'un pion s'y pose, ou que ni la régie ni la table ne regardent plus sa salle. */
  function oublierCaseSiResolue() {
    etat.caseVisee = pres.oublierCaseSiResolue(etat.caseVisee, etat.p, etat.consultee);
  }

  function rendre() {
    if (!etat.p) return;
    oublierCaseSiResolue();
    const s = salleConsultee();
    dessinerRegie(s.plan);
    majRetrait();
    majProjection();
    if (etat.message) { annoncer(etat.message); etat.message = ''; } // hors du flux : la carte ne bouge jamais
    majSelection();
    majSalle();
    majCommande();
    majMiniCarte();
    majPersonnages();
    majEcranLocal();
    diffuser();
  }
  /** Après un changement de la partie : on enregistre, puis on redessine. */
  const modifie = () => { sauvegarder(); rendre(); };

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
        commande.titulaireParti ? 'La régie qui avait la main a été fermée : la table n’est plus servie.' : 'Une autre régie commande la table : les joueurs ne voient pas ce que tu fais ici.');
      texte.title = texte.textContent;
      bandeau.replaceChildren(texte, h('div', { className: 'actions' }, bouton('Reprendre la main', reprendreLaMain)));
      return;
    }
    const meme = consultee.id === courante.id;
    bandeau.className = meme ? 'sur-table' : 'consultation';
    const texte = h('div', { className: 'texte' });
    if (meme) {
      texte.append(h('span', { className: 'pastille', textContent: 'À la table' }), 'Les joueurs voient cette salle : ', h('strong', { textContent: courante.nom }), '.');
    } else {
      texte.append(h('span', { className: 'pastille', textContent: 'Consultation' }), 'Tu regardes ', h('strong', { textContent: consultee.nom }),
        pres.estDecouverte(p, consultee.id) ? ' (déjà découverte)' : ' (non découverte)', '. La table montre toujours ', h('strong', { textContent: courante.nom }), '.');
    }
    const actions = h('div', { className: 'actions' });
    if (!meme) {
      const afficher = h('button', { type: 'button', id: 'afficher-table', textContent: 'Afficher à la table' });
      afficher.addEventListener('click', afficherConsulteeATable);
      const retour = h('button', { type: 'button', className: 'discret', textContent: 'Revenir à la salle de la table' });
      retour.addEventListener('click', () => consulter(courante.id));
      actions.append(afficher, retour);
    }
    texte.title = texte.textContent; // si le texte est tronqué (hauteur fixe), la phrase entière reste lisible
    bandeau.replaceChildren(texte, actions);
  }

  /** Ce que la table montre de la salle regardée : un bouton par catégorie, dont le texte dit l'état. */
  const NOMS_MASQUE = { monstres: 'Monstres', objets: 'Objets' };
  function majProjection() {
    const sur = etat.consultee === etat.p.salleCourante;
    $('projection-titre').textContent = sur ? 'À la table :' : 'Une fois à la table :';
    for (const b of $('projection').querySelectorAll('button')) {
      const categorie = b.dataset.categorie, masque = pres.estMasque(etat.p, etat.consultee, categorie);
      b.textContent = `${NOMS_MASQUE[categorie]} ${masque ? 'masqués' : 'visibles'}`;
      b.classList.toggle('masque', masque);
      b.title = `${masque ? 'Montrer' : 'Masquer'} à la table les ${categorie === 'monstres' ? 'monstres et les PNJ' : 'objets'} de cette salle. Cette régie les montre toujours.`;
    }
  }
  for (const b of $('projection').querySelectorAll('button')) {
    b.addEventListener('click', () => {
      if (!etat.p) return;
      pres.definirMasque(etat.p, etat.consultee, b.dataset.categorie, !pres.estMasque(etat.p, etat.consultee, b.dataset.categorie));
      modifie();
    });
  }

  /** Un pion, à la régie : le nom de son personnage s'il en a un (la table n'a que « P1 »). */
  const nomPion = (k) => {
    const nom = k.fiche && pres.nomPersonnage(etat.p, k.fiche);
    return nom ? `${nom} (P${k.numero})` : `${nomAffiche(k.type)} ${k.numero}`;
  };

  const libelleElement = (trouve) => libelleSelection(trouve, nomPion);

  /** Phrases communes à tout passage de porte : le groupe qui suit, les pions restés faute de place. */
  function phrasesGroupe(res, depart) {
    const parts = [];
    if (etat.groupeSuit && res.deplaces) parts.push(`${pluriel(res.deplaces, 'pion du groupe a suivi', 'pions du groupe ont suivi')}.`);
    if (res.restes) parts.push(`${pluriel(res.restes, 'pion n’a pas trouvé', 'pions n’ont pas trouvé')} de place et ${res.restes > 1 ? 'restent' : 'reste'} dans « ${depart} ».`);
    return parts;
  }

  function passer(porte) {
    const s = salleConsultee();
    const depart = s.nom;
    const res = pres.passerPorte(etat.p, s.id, porte.id, { groupe: etat.groupeSuit });
    if (!res.ok) { etat.message = res.message; rendre(); return; }
    const arrivee = etat.p.donjon.salles[res.vers].nom;
    etat.consultee = res.vers;
    etat.selection = null;
    etat.messageCommande = null;
    etat.message = [`Passage dans « ${arrivee} » : la salle est maintenant à la table.`, ...phrasesGroupe(res, depart)].join(' ');
    modifie();
  }

  /** Porte non reliée : crée la salle décrite (ou une salle de 6 × 6), la relie à cette porte et y passe. */
  function creerEtPasser(porte) {
    const s = salleConsultee();
    const depart = s.nom;
    const b = etat.brouillon;
    const res = pres.creerSalleEtPasser(etat.p, s.id, porte.id, b?.texte || '', { nom: b?.nom || '', echelle: r.echelle, groupe: etat.groupeSuit });
    if (!res.ok) { etat.message = res.message; rendre(); return; }
    const parts = [`Salle « ${res.salle.nom} » créée derrière la porte, reliée à « ${depart} » : elle est maintenant à la table.`, ...phrasesGroupe(res, depart)];
    if (res.ignores?.length) parts.push(`Mots non compris dans la description : ${res.ignores.join(', ')}.`);
    etat.consultee = res.vers;
    etat.selection = null;
    etat.brouillon = null;
    etat.messageCommande = null;
    etat.message = parts.join(' ');
    modifie();
  }

  function changerEtat(pion, valeur) {
    const s = salleConsultee();
    pres.definirEtat(etat.p, s.id, pion.id, valeur);
    const qui = nomPion(pion);
    const devoile = pres.estDevoile(etat.p, s.id, pion);
    const masquee = pres.categorieMasquee(etat.p, s.id, 'creature', pion);
    const ou = !devoile ? ' (pion caché : la table ne le voit pas)' : masquee ? ` (${masquee} masqués : la table ne le voit pas)` : s.id === etat.p.salleCourante ? ' : visible sur la table' : ' (cette salle n’est pas à la table)';
    etat.message = valeur === pres.ETAT_NORMAL ? `${qui} est de nouveau normal${ou}.` : `${qui} est ${pres.LIBELLES_ETAT[valeur]}${ou}.`;
    modifie();
  }

  /** Case « Le groupe suit » (partagée par le passage normal et la création de salle). */
  function caseGroupe(s) {
    const nbPj = s.plan.creatures.filter((k) => k.camp === 'pj').length;
    const suit = h('input', { type: 'checkbox', id: 'groupe-suit', checked: etat.groupeSuit });
    suit.addEventListener('change', () => { etat.groupeSuit = suit.checked; });
    return h('label', { className: 'suit' }, suit, `Le groupe suit (${pluriel(nbPj, 'pion de joueur', 'pions de joueurs')} dans cette salle)`);
  }

  function formulaireNouvelleSalle(s, porte) {
    const cle = `${s.id}|${porte.id}`;
    if (etat.brouillon?.cle !== cle) etat.brouillon = { cle, texte: '', nom: '' };
    const brouillon = etat.brouillon;
    const description = h('textarea', { id: 'description-nouvelle', rows: 3, spellcheck: false, value: brouillon.texte,
      placeholder: 'Ex. : salle de 8 par 6 cases, quatre piliers, un autel au fond, deux gobelins' });
    description.addEventListener('input', () => { brouillon.texte = description.value; });
    const nom = h('input', { type: 'text', id: 'nom-nouvelle', value: brouillon.nom, maxLength: 80, placeholder: 'Nom de la salle (facultatif)' });
    nom.addEventListener('input', () => { brouillon.nom = nom.value; });
    return [
      h('p', { className: 'note', textContent: 'Cette porte n’est reliée à aucune salle. Tu peux créer la salle d’à côté maintenant : elle sera reliée à cette porte, et le groupe peut y passer.' }),
      h('div', { className: 'nouvelle-salle' },
        h('label', { htmlFor: 'description-nouvelle', textContent: 'Décrire la nouvelle salle (facultatif)' }), description,
        h('p', { className: 'note', textContent: 'Même langage que dans le Donjon. Laisse vide pour une salle de 6 × 6 cases. Une porte de retour est ajoutée sur le mur opposé si la description n’en place pas.' }),
        nom),
      caseGroupe(s),
      h('div', { className: 'actions' }, bouton('Créer la salle et y passer', () => creerEtPasser(porte))),
    ];
  }

  /** Sélectionne un élément. `clavier` : on vient d'une liste, le focus passe au panneau pour agir sans souris. */
  function selectionner(genre, id, { clavier = false } = {}) {
    etat.selection = { genre, id };
    etat.focusSelection = clavier;
    etat.message = '';
    rendre();
  }
  /** Ferme la sélection (bouton, Échap ou clic dans le vide) ; le focus revient à l'élément dans la liste. */
  function deselectionner() {
    const zone = $('selection');
    const sel = etat.selection;
    const avaitFocus = !!sel && zone.contains(document.activeElement);
    etat.selection = null;
    etat.message = '';
    rendre();
    if (avaitFocus) (document.querySelector(`[data-el="${sel.genre}:${sel.id}"]`) || $('elements-salle').querySelector('summary')).focus?.({ preventScroll: true });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || !etat.p || !etat.selection) return;
    if (etat.pleinIci || document.fullscreenElement) return; // Échap sert déjà à quitter le plein écran
    const cible = e.target;
    if (cible instanceof HTMLElement && cible.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select, [contenteditable]')) return; // Échap sert déjà dans un champ
    e.preventDefault();
    deselectionner();
  });

  function majSelection() {
    const zone = $('selection');
    const p = etat.p, s = salleConsultee();
    const trouve = trouver(s.plan, etat.selection);
    if (!trouve) { etat.selection = null; zone.hidden = true; zone.replaceChildren(); return; }
    zone.hidden = false;
    const el = trouve.element;
    const fermer = bouton(LIBELLE_FERMER, deselectionner, 'discret petit');
    fermer.setAttribute('aria-label', 'Fermer la sélection (Échap)');
    const contenu = [h('div', { className: 'selection-entete' }, h('h2', { textContent: 'Sélection' }), fermer),
      h('p', { className: 'selection-titre', textContent: libelleElement(trouve) })];
    const sur = s.id === p.salleCourante;
    const masquee = pres.categorieMasquee(p, s.id, trouve.genre, el);

    if (el.cache) {
      const revele = pres.estRevele(p, s.id, el.id);
      contenu.push(h('p', { className: 'note', textContent: revele
        ? `Révélé${masquee ? '' : ` : visible sur la table${sur ? '' : ' dès que la salle y sera affichée'}`}.`
        : 'Caché : les joueurs ne le voient pas. Tu le vois ici en translucide, contour en pointillés.' }));
      contenu.push(h('div', { className: 'actions' }, revele
        ? bouton('Recacher', () => { pres.recacherElement(p, s.id, el.id); etat.message = 'Recaché : il disparaît de la table.'; modifie(); }, 'discret')
        : bouton('Révéler', () => { pres.revelerElement(p, s.id, el.id); etat.message = `Révélé${masquee ? `, mais les ${masquee} sont masqués à la table` : sur ? ' : il apparaît sur la table' : ', mais cette salle n’est pas à la table'}.`; modifie(); })));
    }
    if (masquee) contenu.push(h('p', { className: 'note', textContent: `Les ${masquee} de cette salle sont masqués à la table : les joueurs ne le voient pas.` }));

    if (trouve.genre === 'creature') {
      const actuel = el.etat || pres.ETAT_NORMAL;
      contenu.push(h('p', { className: 'note', id: 'etat-pion', textContent: `État : ${pres.LIBELLES_ETAT[actuel]}. Un pion blessé porte une croix rouge, un pion mort est grisé et barré ; la table les voit.` }));
      const boutons = h('div', { className: 'etats' });
      boutons.setAttribute('role', 'group');
      boutons.setAttribute('aria-label', 'État du pion');
      for (const valeur of pres.ETATS_DE_PION) {
        const libelle = pres.LIBELLES_ETAT[valeur];
        const b = bouton(libelle.charAt(0).toUpperCase() + libelle.slice(1), () => changerEtat(el, valeur), 'discret');
        b.setAttribute('aria-pressed', String(actuel === valeur));
        boutons.append(b);
      }
      contenu.push(boutons);
    }

    if (trouve.genre === 'porte') {
      const dest = pres.destinationPorte(p, s.id, el.id);
      if (dest) {
        contenu.push(h('p', {}, 'Mène à ', h('strong', { textContent: dest.salle.nom }), pres.estDecouverte(p, dest.salle.id) ? ' (déjà découverte).' : ' (non découverte).'));
        contenu.push(caseGroupe(s));
        contenu.push(h('div', { className: 'actions' }, bouton(`Passer dans la salle « ${dest.salle.nom} »`, () => passer(el), '')));
      } else {
        contenu.push(...formulaireNouvelleSalle(s, el));
      }
    }
    zone.replaceChildren(...contenu);
    if (etat.focusSelection) { etat.focusSelection = false; zone.focus({ preventScroll: true }); }
  }

  /** Bloc « Cette salle » : éléments cachés, portes (accessibles au clavier) et notes en lecture seule. */
  function majSalle() {
    const p = etat.p, s = salleConsultee();
    const { total, reveles } = pres.comptageCaches(p, s.id);
    $('comptage-caches').textContent = total
      ? `Éléments cachés : ${total}, dont ${reveles} révélé${reveles > 1 ? 's' : ''}.`
      : 'Aucun élément caché dans cette salle.';
    $('reveler-tout').disabled = total === reveles;
    const choisi = (genre, id) => etat.selection?.genre === genre && etat.selection.id === id;
    /** Bouton de liste (portes et éléments) : sélectionne au clavier comme à la souris, `aria-pressed` = élément sélectionné. */
    const boutonListe = (genre, e, texte, cachee) => {
      const b = bouton(texte, () => selectionner(genre, e.id, { clavier: true }), `discret${cachee ? ' cachee' : ''}`);
      b.dataset.el = `${genre}:${e.id}`;
      b.setAttribute('aria-pressed', String(choisi(genre, e.id)));
      return h('li', {}, b);
    };
    $('liste-portes').replaceChildren(...s.plan.portes.map((q) => {
      const lien = modele.liaisonDePorte(p.donjon, s.id, q);
      const vers = lien && p.donjon.salles[lien.autre.salle];
      return boutonListe('porte', q, `${libelleDePorte(q)} · ${vers ? `→ ${vers.nom}` : 'non reliée'}${q.cache ? ' · cachée' : ''}`, q.cache);
    }));
    // Éléments de la salle : pions puis objets, cachés repérés (comme sur la carte du MJ). Liste repliable.
    const marque = (e) => (!e.cache ? '' : pres.estRevele(p, s.id, e.id) ? ' · caché, révélé' : ' · caché');
    const elements = [
      ...s.plan.creatures.map((k) => boutonListe('creature', k, `${nomPion(k)} · ${nomCase(k.x, k.y)}${k.etat ? ` · ${pres.LIBELLES_ETAT[k.etat]}` : ''}${marque(k)}`, !pres.estDevoile(p, s.id, k))),
      ...s.plan.objets.map((o) => boutonListe('objet', o, `${nomAffiche(o.type)} · ${nomCase(o.x, o.y)}${marque(o)}`, !pres.estDevoile(p, s.id, o))),
    ];
    $('nb-elements').textContent = `(${elements.length})`;
    $('liste-elements').replaceChildren(...(elements.length ? elements : [h('li', { className: 'note', textContent: 'Aucun pion ni objet dans cette salle.' })]));
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
    onEtat: (actif) => { $('micro-commande').textContent = libelleMicro(actif); },
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

  const majMiniPlan = creerMiniPlan($('minicarte'), {
    onChoisir: (id) => consulter(id),
    libelle: (s) => {
      const p = etat.p;
      const statut = s.id === p.salleCourante ? ' (à la table)' : pres.estDecouverte(p, s.id) ? '' : ' (non découverte)';
      return `Consulter la salle ${s.nom}${statut}`;
    },
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
      bouton('Dégâts', () => appliquer(-1), 'discret'),
      bouton('Soins', () => appliquer(1), 'discret'),
      ...(enJeu ? [bouton('PV de la fiche', () => { pres.oublierPV(etat.p, perso.id); etat.message = `${perso.fiche.nom} reprend les PV de sa fiche.`; modifie(); reprendreLaMain(); }, 'discret')] : []));
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
      }, 'discret');
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

  function majMiniCarte() {
    const p = etat.p;
    majMiniPlan({
      donjon: p.donjon, disposition: dispositionDePartie(), actif: etat.consultee, courante: p.salleCourante,
      inconnues: Object.keys(p.donjon.salles).filter((id) => !pres.estDecouverte(p, id)),
      portesFermees: pres.portesNonOuvertes(p, dispositionDePartie()),
    });
  }

  // --- Carte : déplacer les pions, cliquer le reste -----------------------------------------------
  // Les objets et les portes ne bougent jamais ici (option `deplacables`) ; ils restent cliquables.
  activerDeplacement($('carte'), {
    plan: () => salleConsultee().plan,
    taille: () => tailleRegie(salleConsultee().plan),
    apercu: (plan) => dessinerRegie(plan),
    deposer: (nouveau) => { pres.appliquerDeplacement(etat.p, etat.consultee, nouveau); etat.message = ''; modifie(); },
    cliquer: (touche, caseVide) => {
      etat.selection = touche ? { genre: touche.genre, id: touche.element.id } : null;
      etat.message = '';
      if (caseVide) viserCase(etat.consultee, caseVide[0], caseVide[1]);
      else rendre();
    },
    deplacables: ['creature'],
    portesLarges: true, // zone de clic des portes élargie vers l'intérieur ; un glissement sur un pion déplace toujours le pion
  });

  // --- Fenêtre table et plein écran ici -------------------------------------------------------------
  const messageTable = (texte) => annoncer(texte, 10000);
  $('ouvrir-table').addEventListener('click', () => {
    const w = window.open(new URL('presentation.html?vue=table', location.href).href, 'carte-de-mj-table', 'popup,width=1024,height=768');
    if (w) { w.focus(); messageTable('Fenêtre table ouverte : glisse-la sur l’écran de la table, puis son bouton « Plein écran » (au survol, en haut à droite).'); }
    else messageTable('Le navigateur a bloqué la fenêtre. Autorise les fenêtres pour ce site, ou ouvre presentation.html?vue=table dans un nouvel onglet.');
  });

  /** Met à jour l'écran de table local (plein écran ici) avec le plan de vueTable(). */
  function majEcranLocal() {
    if (!etat.pleinIci || !etat.p) return;
    ecran.plan = pres.vueTable(etat.p);
    const mini = miniTable();
    ecran.mini = mini && pres.recevoirMiniPlan(mini);
    ecran.caseVisee = caseATable();
    ecran.affichage = affichageTable();
    rendreEcranTable();
  }
  function entrerPleinIci() {
    if (!etat.p) return;
    etat.pleinIci = true;
    $('retour-regie').hidden = false;
    $('ecran-table').hidden = false;
    $('attente').textContent = 'Aucune salle à afficher.';
    majEcranLocal();
    $('vue-table').focus({ preventScroll: true });
    $('ecran-table').requestFullscreen?.().catch(() => {}); // sinon : la vue table couvre quand même toute la fenêtre
  }
  function quitterPleinIci() {
    if (!etat.pleinIci) return;
    etat.pleinIci = false;
    $('ecran-table').hidden = true;
    $('retour-regie').hidden = true;
    if (document.fullscreenElement) document.exitFullscreen?.();
    $('plein-ici').focus?.();
  }
  $('plein-ici').addEventListener('click', entrerPleinIci);
  activerActionsTable({
    deplacer: deplacerDepuisTable,
    viser: (x, y) => { if (etat.p) viserCase(etat.p.salleCourante, x, y); },
  });
  // Échap enlève la case montrée (si une sélection est ouverte, Échap la ferme d'abord).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || !etat.p || !etat.caseVisee || etat.selection || etat.pleinIci || document.fullscreenElement) return;
    if (e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable]')) return;
    etat.caseVisee = null;
    rendre();
  });
  reinitialiserRetour = deuxTemps($('retour-regie'), '← Retour à la régie', 'Appuie encore pour revenir', quitterPleinIci);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && etat.pleinIci) quitterPleinIci(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && etat.pleinIci) quitterPleinIci(); });

  for (const b of document.querySelectorAll('[data-defiler]')) {
    b.addEventListener('click', () => {
      const [dx, dy] = b.dataset.defiler.split(',').map(Number);
      const recentrer = dx === 0 && dy === 0;
      if (commande.main) canal?.postMessage({ type: 'defiler', dx, dy, recentrer });
      if (etat.pleinIci) defilerEcranTable({ dx, dy, recentrer });
    });
  }

  // --- Réglages (partagés avec le Donjon : carte-de-mj:reglages-v1) ------------------------------------
  if (r.reperes === undefined) r.reperes = true;
  $('taille').value = r.taille;
  $('taille-val').textContent = `${r.taille} px`;
  $('grille').checked = r.grille;
  $('reperes').checked = r.reperes !== false;
  $('ajuster').checked = etat.ajuster;
  $('mini-active').checked = r.miniTable !== false;
  $('mini-active').addEventListener('change', (e) => { r.miniTable = e.target.checked; sauverReglages(); diffuser(); majEcranLocal(); });
  function majModeTable() {
    const mode = modeTable(r);
    $('mode-remplir').checked = mode === 'remplir';
    $('mode-reel').checked = mode === 'reel';
    $('aide-mode-table').textContent = mode === 'remplir'
      ? 'La case s’adapte à la fenêtre de la table : la salle occupe tout l’écran. Les figurines ne sont plus à l’échelle.'
      : `Chaque case garde sa taille calibrée (${r.taille} px) : les figurines restent à l’échelle. Une grande salle défile.`;
  }
  majModeTable();
  for (const radio of [$('mode-remplir'), $('mode-reel')]) {
    radio.addEventListener('change', () => { r.modeTable = radio.value; sauverReglages(); majModeTable(); diffuser(); majEcranLocal(); });
  }
  $('taille').addEventListener('input', (e) => { r.taille = Number(e.target.value); $('taille-val').textContent = `${r.taille} px`; sauverReglages(); majModeTable(); rendre(); });
  $('grille').addEventListener('change', (e) => { r.grille = e.target.checked; sauverReglages(); rendre(); });
  $('reperes').addEventListener('change', (e) => { r.reperes = e.target.checked; sauverReglages(); rendre(); });
  $('ajuster').addEventListener('change', (e) => { etat.ajuster = e.target.checked; rendre(); });
  let minuterie;
  window.addEventListener('resize', () => { clearTimeout(minuterie); minuterie = setTimeout(() => { if (etat.p) rendre(); }, 150); });
  // Écran étroit : onglets Carte / Actions ; la carte est redessinée à la taille qui tient quand on l'affiche.
  activerOnglets(document.querySelector('#regie .onglets'), { defaut: 'carte', onChange: (nom) => { if (nom === 'carte' && etat.p) rendre(); } });

  // Démarrage : le bouton « Présenter » d'un donjon ouvre CE donjon. Sinon, la partie ouverte au dernier passage est
  // rouverte telle quelle (rien n'est relancé ni écrasé) ; « ← Liste des donjons » ramène à l'écran de départ, et l'oublie.
  etat.presentations = stockage.chargerPresentations();
  const parametres = new URLSearchParams(location.search);
  const demande = pres.partieDemandee(parametres.get('donjon'), stockage.chargerDonjons()?.donjons, etat.presentations);
  // L'adresse perd sa demande : recharger la page ou revenir à la liste ne doit pas rouvrir ce donjon de force.
  if (parametres.has('donjon')) history.replaceState(null, '', 'presentation.html');
  // Rechargement : l'onglet qui avait la main la reprend (sinon la table resterait sans régie) ; celui qui était en retrait y reste,
  // avec sa propre partie : recharger un vieil onglet ne doit pas renvoyer sa partie à la table.
  const aReprendre = retraitAvantRechargement ? stockage.partieDuRetrait(retraitAvantRechargement, etat.presentations) : stockage.partieAReprendre(etat.presentations);
  if (demande?.reprise) entrer(demande.partie, { reprise: true });
  else if (demande) demanderJoueurs(demande.partie);
  else if (aReprendre) entrer(aReprendre, { reprise: true, main: !retraitAvantRechargement });
  else afficherDepart();
}

if (new URLSearchParams(location.search).get('vue') === 'table') demarrerTable();
else demarrerRegie();
