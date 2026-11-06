/**
 * La RÉGIE du MJ (presentation.html) : choix du donjon, carte complète, révélations, portes, notes, personnages, commande rapide,
 * et ce qu'elle montre à la table (par le canal, ou en « Plein écran ici »). Fabrique de tout le reste : `demarrerRegie()` est la
 * racine de composition, avec l'état de la régie (`etat`), ses réglages (`r`) et le contexte `ctx` que reçoivent les modules
 * regie-depart.js, regie-selection.js et regie-reglages.js (qui ne s'importent pas entre eux).
 *
 * La logique (copie du donjon, portes, révélations, improvisation, plan envoyé à la table) est dans presentation.js (façade de
 * partie.js, passage.js, vue-publique.js). Ici : DOM, stockage et canal.
 *
 * Plusieurs régies peuvent être ouvertes : une seule commande la table (voir commande-table.js).
 *
 * SÉCURITÉ : la régie n'envoie à la table que le résultat de vueTable() et de miniPlanTable() (voir vue-publique.js), par
 * `messageEtat` (protocole-table.js) : tout passe par `contenuTable()`, qui est aussi ce que dessine « Plein écran ici ».
 */
import * as stockage from './stockage.js';
import * as modele from './donjon.js';
import * as pres from './presentation.js';
import * as table from './commande-table.js';
import { dessiner } from './rendu/moteur.js';
import { themeParNom } from './rendu/themes/index.js';
import { disposerPlan, cleDisposition } from './plan-donjon.js';
import { activerDeplacement } from './deplacement.js';
import { creerMiniPlan } from './miniplan.js';
import { carteFiche, carteJoueur } from './carte-personnage.js';
import { nomCase, libelleDePorte } from './coordonnees.js';
import { nomAffiche } from './parseur/lexique.js';
import { creerMicro } from './voix.js';
import { affichageDeReglages, optionsRendu } from './affichage.js';
import { telephone, activerOnglets, marquerDefilement, tailleQuiTient } from './telephone.js';
import { $, h, bouton, deuxTemps } from './dom.js';
import { pluriel, libelleMicro } from './format.js';
import { ouvrirCanal, messageEtat, messageDefiler, MESSAGES } from './protocole-table.js';
import { creerEcranTable } from './ecran-table.js';
import { creerDepart } from './regie-depart.js';
import { creerSelection } from './regie-selection.js';
import { creerReglages } from './regie-reglages.js';

export function demarrerRegie() {
  // L'écran de table local (« Plein écran ici ») : créé le premier, comme ses écouteurs l'étaient à l'import.
  let reinitialiserRetour = null; // le bouton « Retour à la régie » (défini plus bas) se remet au repos quand les boutons de coin se cachent
  const ecran = creerEcranTable({ surCoinsCaches: () => reinitialiserRetour?.() });
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
  /** Pendant le calibrage, la table est à l'échelle réelle et dessine la carte bancaire ; ce réglage passager n'est pas enregistré. */
  const affichageTable = () => (etat.calibrage ? { ...affichageDeReglages(r), mode: 'reel', calibrage: true } : affichageDeReglages(r));
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
    if (!commande.main) return;
    canal?.postMessage(messageEtat(contenuTable()));
  }
  /** « Plein écran ici » : la même chose, dessinée par l'écran de table de cette page (l'encart relu comme le fait la fenêtre table). */
  function montrerIci() {
    if (!etat.pleinIci || !etat.p) return;
    const contenu = contenuTable();
    ecran.appliquer({ ...contenu, mini: contenu.mini && pres.recevoirMiniPlan(contenu.mini) });
  }

  /** Un clic sur une case vide la montre ; un clic sur la même case l'enlève. */
  function viserCase(idSalle, x, y) {
    etat.caseVisee = pres.viserCase(etat.caseVisee, etat.p, idSalle, x, y);
    rendre();
  }
  function deplacerDepuisTable(id, x, y) {
    if (!etat.p) return;
    if (pres.deplacerPion(etat.p, etat.p.salleCourante, id, x, y)) modifie();
    else { diffuser(); montrerIci(); } // refusé : la table reprend la position d'avant
  }
  if (canal) {
    canal.onmessage = (ev) => {
      const m = ev.data;
      const action = table.surMessage(commande, m);
      if (action === 'retrait') { noterRetrait(); if (etat.p) majRetrait(); }
      else if (action === 'diffuser') diffuser();
      else if (action === 'presence') canal.postMessage({ type: table.PRESENCE });
      else if (action === 'appliquer' && m.type === MESSAGES.TABLE_DEPLACER) deplacerDepuisTable(m.id, m.x, m.y);
      else if (action === 'appliquer' && etat.p) viserCase(etat.p.salleCourante, m.x, m.y);
    };
  }
  const noterRetrait = () => { if (commande.retrait) stockage.memoriserRetrait(etat.p?.donjon.id); };
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

  /** Une régie en retrait le dit en permanence : dans son panneau, et dans le bandeau au-dessus de la carte (hauteur fixe : la carte ne bouge pas). */
  const tenueAilleurs = () => table.partieTenueAilleurs(commande, etat.p?.donjon.id, stockage.idPartieOuverte());
  function majRetrait() {
    const alerte = $('alerte-retrait');
    alerte.hidden = !commande.retrait;
    if (commande.retrait) {
      $('texte-retrait').textContent = [
        commande.titulaireParti
          ? 'La régie qui avait la main a été fermée : la table n’est plus servie. Reprends la main pour lui montrer cette partie.'
          : 'Cette régie est en retrait : une autre régie a ouvert une partie et commande la table. Ce que tu fais ici n’est plus montré aux joueurs. Si cette autre régie a été fermée, reprends la main.',
        ...(etat.perimee || tenueAilleurs() ? ['Cette partie est aussi ouverte dans l’autre régie : ce que tu fais ici n’est pas enregistré. « Reprendre la main » le garde, sauf si elle y a avancé : tu repars alors de sa version.'] : []),
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
    etat.perimee = false;
    sauvegarder(); // ce qui a été fait en retrait n'était pas enregistré
    stockage.memoriserPartieOuverte(id);
    etat.message = 'Cette régie a repris la main : la table montre sa partie.';
    rendre();
  }
  $('reprendre-main').addEventListener('click', reprendreLaMain);

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
    $('nom-donjon').textContent = p.donjon.nom;
    document.title = `${p.donjon.nom} · Présentation · Carte de MJ`;
    if (!reprise) sauvegarder();
    if (main) stockage.memoriserPartieOuverte(p.donjon.id); // un rechargement rouvre cette partie
    if (reprise) etat.message = `Partie « ${p.donjon.nom} » rouverte, salle « ${salleConsultee().nom} ». « ← Liste des donjons » ramène à l’écran de départ.`;
    rendre();
  }
  // En retrait, la partie ouverte mémorisée est celle de l'autre régie : on n'y touche pas.
  $('quitter').addEventListener('click', () => { if (!commande.retrait) stockage.oublierPartieOuverte(); depart.afficher(); });

  // --- Rendu de la régie ---------------------------------------------------------------------------
  /** Côté de case de la régie : réduit pour que la salle tienne dans la zone (réglage `r.taille` jamais modifié). Sous 760 px, marge plus étroite. */
  function tailleRegie(plan) {
    if (!etat.ajuster) return r.taille;
    return tailleQuiTient($('scene'), plan.largeur, plan.longueur, r.taille, telephone() ? 10 : 28);
  }

  /** Repères posés sur la carte de la régie : portes reliées (pastille bleue) et élément sélectionné. */
  function marques(planAffiche) {
    const s = salleConsultee();
    const portesReliees = planAffiche.portes.filter((q) => modele.liaisonDePorte(etat.p.donjon, s.id, q)).map((q) => ({ mur: q.mur, position: q.position }));
    const trouve = selection.trouver(planAffiche, etat.selection);
    return { portesReliees, selection: trouve, ...(etat.caseVisee?.salle === s.id ? { caseVisee: etat.caseVisee } : {}) };
  }

  function dessinerRegie(plan) {
    const s = salleConsultee();
    const { grille, theme, relief } = optionsRendu(r);
    dessiner($('carte'), pres.planRegie(plan, idsReveles(s.id)), {
      taille: tailleRegie(s.plan), grille, theme: themeParNom(theme), relief, reperes: r.reperes !== false, marques: marques(plan),
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
    selection.maj();
    majSalle();
    majCommande();
    majMiniCarte();
    majPersonnages();
    montrerIci();
    diffuser();
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
      const b = bouton(texte, () => selection.selectionner(genre, e.id, { clavier: true }), `discret${cachee ? ' cachee' : ''}`);
      b.dataset.el = `${genre}:${e.id}`;
      b.setAttribute('aria-pressed', String(choisi(genre, e.id)));
      return h('li', {}, b);
    };
    $('liste-portes').replaceChildren(...s.plan.portes.map((q) => {
      const lien = modele.liaisonDePorte(p.donjon, s.id, q);
      const vers = lien && p.donjon.salles[lien.autre.salle];
      return boutonListe('porte', q, `${libelleDePorte(q)} · ${vers ? `→ ${vers.nom}` : 'non reliée'}${!q.cache ? '' : pres.estRevele(p, s.id, q.id) ? ' · cachée, révélée' : ' · cachée'}`, !pres.estDevoile(p, s.id, q));
    }));
    // Éléments de la salle : pions puis objets, cachés repérés (comme sur la carte du MJ). Liste repliable.
    const marque = (e) => (!e.cache ? '' : pres.estRevele(p, s.id, e.id) ? ' · caché, révélé' : ' · caché');
    const elements = [
      ...s.plan.creatures.map((k) => boutonListe('creature', k, `${selection.nomPion(k)} · ${nomCase(k.x, k.y)}${k.etat ? ` · ${pres.LIBELLES_ETAT[k.etat]}` : ''}${marque(k)}`, !pres.estDevoile(p, s.id, k))),
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

  function entrerPleinIci() {
    if (!etat.p) return;
    etat.pleinIci = true;
    $('retour-regie').hidden = false;
    $('ecran-table').hidden = false;
    $('attente').textContent = 'Aucune salle à afficher.';
    montrerIci();
    $('vue-table').focus({ preventScroll: true });
    $('ecran-table').requestFullscreen?.().catch(() => {}); // sinon : la vue table couvre quand même toute la fenêtre
  }
  function quitterPleinIci() {
    if (!etat.pleinIci) return;
    etat.pleinIci = false;
    ecran.relacherEveil();
    $('ecran-table').hidden = true;
    $('retour-regie').hidden = true;
    if (document.fullscreenElement) document.exitFullscreen?.();
    $('plein-ici').focus?.();
  }
  $('plein-ici').addEventListener('click', entrerPleinIci);
  ecran.activerActions({
    deplacer: deplacerDepuisTable,
    viser: (x, y) => { if (etat.p) viserCase(etat.p.salleCourante, x, y); },
  });
  reinitialiserRetour = deuxTemps($('retour-regie'), '← Retour à la régie', 'Appuie encore pour revenir', quitterPleinIci);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && etat.pleinIci) quitterPleinIci(); });

  // Échap : UN SEUL écouteur, dans l'ordre de priorité qu'avaient les trois d'avant (enregistrés dans cet ordre, sans stopPropagation :
  // la sélection appelait preventDefault et les autres s'effaçaient devant lui ou par leurs propres conditions).
  //  1. « Plein écran ici » : retour à la régie, quoi qu'il arrive à l'événement ;
  //  2. un plein écran en cours : Échap sert déjà à en sortir, rien à faire ;
  //  3. une sélection ouverte : la ferme, sauf dans un champ de saisie ou de liste (Échap y sert déjà) ;
  //  4. sinon la case montrée : l'enlève, sauf dans n'importe quel champ (cases à cocher comprises).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (etat.pleinIci) { quitterPleinIci(); return; }
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

  for (const b of document.querySelectorAll('[data-defiler]')) {
    b.addEventListener('click', () => {
      const [dx, dy] = b.dataset.defiler.split(',').map(Number);
      const recentrer = dx === 0 && dy === 0;
      if (commande.main) canal?.postMessage(messageDefiler(dx, dy, recentrer));
      if (etat.pleinIci) ecran.defiler({ dx, dy, recentrer });
    });
  }

  // --- Câblage des modules de la régie ---------------------------------------------------------------
  // Tout ce qui précède est déclaré (fonctions) ou défini (constantes) : on peut le donner aux modules. Ils ne l'appellent
  // qu'une fois la page démarrée, jamais pendant leur création.
  const ctx = { etat, r, commande, annoncer, rendre, modifie, salleCourante, salleConsultee, entrer, viderSauvegarde, noterRetrait, quitterPleinIci, diffuser, montrerIci };
  const depart = creerDepart(ctx);
  const selection = creerSelection(ctx);
  const reglages = creerReglages(ctx);
  let minuterie;
  window.addEventListener('resize', () => { clearTimeout(minuterie); minuterie = setTimeout(() => { if (etat.p) rendre(); }, 150); });
  // Écran étroit : onglets Carte / Actions ; la carte est redessinée à la taille qui tient quand on l'affiche.
  activerOnglets(document.querySelector('#regie .onglets'), { defaut: 'carte', onChange: (nom) => { if (nom === 'carte' && etat.p) rendre(); } });

  // Démarrage : le bouton « Présenter » d'un donjon ouvre CE donjon. Sinon, la partie ouverte au dernier passage est
  // rouverte telle quelle (rien n'est relancé ni écrasé) ; « ← Liste des donjons » ramène à l'écran de départ, et l'oublie.
  // Une partie qui ne se relit pas en entier est copiée à part avant que quoi que ce soit puisse l'enregistrer.
  const miseDeCote = stockage.mettreDeCotePresentations();
  etat.presentations = stockage.chargerPresentations();
  const parametres = new URLSearchParams(location.search);
  const demande = pres.partieDemandee(parametres.get('donjon'), stockage.chargerDonjons()?.donjons, etat.presentations);
  // L'adresse perd sa demande : recharger la page ou revenir à la liste ne doit pas rouvrir ce donjon de force.
  if (parametres.has('donjon')) history.replaceState(null, '', 'presentation.html');
  // Rechargement : l'onglet qui avait la main la reprend (sinon la table resterait sans régie) ; celui qui était en retrait y reste,
  // avec sa propre partie : recharger un vieil onglet ne doit pas renvoyer sa partie à la table.
  const aReprendre = retraitAvantRechargement ? stockage.partieDuRetrait(retraitAvantRechargement, etat.presentations) : stockage.partieAReprendre(etat.presentations);
  if (demande?.reprise) entrer(demande.partie, { reprise: true });
  else if (demande) depart.demanderJoueurs(demande.partie);
  else if (aReprendre) entrer(aReprendre, { reprise: true, main: !retraitAvantRechargement });
  else depart.afficher();
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
