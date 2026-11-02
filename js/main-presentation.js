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
 * SÉCURITÉ : la vue table ne lit jamais les présentations du localStorage et ne reçoit de la
 * régie que le résultat de vueTable() (voir presentation.js). Aucun secret n'arrive à sa fenêtre.
 */
import * as stockage from './stockage.js';
import * as modele from './donjon.js';
import * as pres from './presentation.js';
import { dessiner } from './rendu/moteur.js';
import { activerDeplacement } from './deplacement.js';
import { dessinerMiniCarte } from './minicarte.js';
import { nomCase, lettreColonne } from './parseur/coordonnees.js';
import { nomAffiche } from './parseur/lexique.js';
import { creerMicro, voixDisponible } from './voix.js';

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

/** Bouton qui demande confirmation au second clic, dans les 4 secondes. */
function deuxTemps(bouton, libelle, confirmation, action) {
  let attente;
  const reinitialiser = () => { clearTimeout(attente); bouton.dataset.confirme = ''; bouton.textContent = libelle; bouton.classList.remove('danger'); };
  reinitialiser();
  bouton.addEventListener('click', () => {
    if (bouton.dataset.confirme === '1') { reinitialiser(); action(); return; }
    bouton.dataset.confirme = '1';
    bouton.textContent = confirmation;
    bouton.classList.add('danger');
    attente = setTimeout(reinitialiser, 4000);
  });
  bouton.addEventListener('blur', reinitialiser);
}

const ouvrirCanal = () => { try { return new BroadcastChannel(pres.CANAL); } catch { return null; } };
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

// =============================================================================
// Écran de table (partagé : fenêtre ?vue=table et « Plein écran ici »)
// =============================================================================
const ecran = { plan: null, affichage: { taille: 48, grille: true, reperes: true } };

function rendreEcranTable() {
  const carte = $('carte-table');
  $('attente').hidden = !!ecran.plan;
  carte.hidden = !ecran.plan;
  if (ecran.plan) dessiner(carte, ecran.plan, { ...ecran.affichage, marques: {} }); // aucun repère de liaison ni de sélection
}

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
const affichageValide = (a, defaut) => ({
  taille: Number.isFinite(a?.taille) && a.taille >= 16 && a.taille <= 160 ? a.taille : defaut.taille,
  grille: typeof a?.grille === 'boolean' ? a.grille : defaut.grille,
  reperes: typeof a?.reperes === 'boolean' ? a.reperes : defaut.reperes,
});

// =============================================================================
// Mode VUE TABLE
// =============================================================================
function demarrerTable() {
  document.body.classList.add('vue-table');
  document.title = 'Table · Carte de MJ';
  $('ecran-table').hidden = false;
  const reglages = stockage.chargerReglages(); // seuls les réglages d'affichage : jamais les présentations
  ecran.affichage = { taille: reglages.taille, grille: reglages.grille, reperes: reglages.reperes !== false };
  const attendre = (texte) => { ecran.plan = null; $('attente').textContent = texte; rendreEcranTable(); };

  const canal = ouvrirCanal();
  if (!canal) { attendre('Ce navigateur ne permet pas de recevoir la présentation (BroadcastChannel indisponible).'); return; }
  let recu = false;
  canal.onmessage = (ev) => {
    const m = ev.data;
    if (!m || typeof m !== 'object') return;
    if (m.type === 'etat') {
      recu = true;
      ecran.affichage = affichageValide(m.affichage, ecran.affichage);
      const plan = m.plan ? pres.recevoirVueTable(m.plan) : null;
      if (plan) { ecran.plan = plan; rendreEcranTable(); } else attendre('La présentation n’a pas commencé. Lance-la depuis la régie.');
    } else if (m.type === 'defiler') {
      defilerEcranTable({ dx: entierSigne(m.dx), dy: entierSigne(m.dy), recentrer: m.recentrer === true });
    }
  };
  attendre('En attente de la régie…');
  const demander = () => canal.postMessage({ type: 'demande-etat' });
  demander();
  const relance = setInterval(() => { if (recu) clearInterval(relance); else demander(); }, 2000);
  setTimeout(() => {
    if (!recu) attendre('Aucune régie ne répond. Ouvre presentation.html dans une autre fenêtre de ce navigateur et lance une présentation.');
  }, 1500);
}

// =============================================================================
// Mode RÉGIE
// =============================================================================
function demarrerRegie() {
  const canal = ouvrirCanal();
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
    focusMini: null,
    pleinIci: false,
    enregistre: true,
  };

  const salleCourante = () => etat.p.donjon.salles[etat.p.salleCourante];
  const salleConsultee = () => etat.p.donjon.salles[etat.consultee];
  const idsReveles = (idSalle) => etat.p.reveles[idSalle] || [];

  // --- Communication avec la fenêtre table -------------------------------------------------------
  const affichageTable = () => ({ taille: r.taille, grille: r.grille, reperes: r.reperes !== false });
  /** Envoie à la table le plan de vueTable() et rien d'autre. */
  function diffuser() {
    canal?.postMessage({ type: 'etat', plan: etat.p ? pres.vueTable(etat.p) : null, affichage: affichageTable() });
  }
  if (canal) canal.onmessage = (ev) => { if (ev.data?.type === 'demande-etat') diffuser(); };

  function sauvegarder() {
    if (!etat.p) return;
    etat.presentations[etat.p.donjon.id] = etat.p;
    const ok = stockage.sauverPresentations(etat.presentations);
    if (!ok && etat.enregistre) {
      etat.enregistre = false;
      etat.message = 'Attention : impossible d’enregistrer la partie dans ce navigateur (stockage plein ou bloqué). Elle continue, mais ne pourra pas être reprise.';
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
  function resumePartie(p) {
    const nom = p.donjon.salles[p.salleCourante].nom;
    return `Partie en cours : salle « ${nom} », ${p.decouvertes.length} salle${p.decouvertes.length > 1 ? 's' : ''} découverte${p.decouvertes.length > 1 ? 's' : ''} sur ${Object.keys(p.donjon.salles).length}.`;
  }

  function ligneDonjon(d) {
    const enCours = etat.presentations[d.id];
    const n = Object.keys(d.salles).length;
    const infos = h('div', { className: 'infos' }, h('b', { textContent: d.nom }),
      h('span', { textContent: pluriel(n, 'salle', 'salles') }));
    if (enCours) infos.append(h('br'), h('span', { className: 'en-cours', textContent: resumePartie(enCours) }));
    const boutons = h('div', { className: 'boutons' });
    if (enCours) {
      const reprendre = h('button', { type: 'button', textContent: 'Reprendre' });
      reprendre.addEventListener('click', () => entrer(enCours));
      const recommencer = h('button', { type: 'button', className: 'discret' });
      deuxTemps(recommencer, 'Recommencer', 'Effacer la partie ?', () => entrer(pres.creerPresentation(d)));
      boutons.append(reprendre, recommencer);
    } else {
      const demarrer = h('button', { type: 'button', textContent: 'Présenter' });
      demarrer.addEventListener('click', () => entrer(pres.creerPresentation(d)));
      boutons.append(demarrer);
    }
    return h('li', {}, infos, boutons);
  }

  function ligneOrpheline(p) {
    const reprendre = h('button', { type: 'button', textContent: 'Reprendre' });
    reprendre.addEventListener('click', () => entrer(p));
    const abandonner = h('button', { type: 'button', className: 'discret' });
    deuxTemps(abandonner, 'Abandonner', 'Supprimer la partie ?', () => {
      delete etat.presentations[p.donjon.id];
      stockage.sauverPresentations(etat.presentations);
      afficherDepart();
    });
    return h('li', {}, h('div', { className: 'infos' }, h('b', { textContent: p.donjon.nom }), h('span', { className: 'en-cours', textContent: resumePartie(p) })),
      h('div', { className: 'boutons' }, reprendre, abandonner));
  }

  function afficherDepart() {
    viderSauvegarde();
    etat.p = null;
    etat.consultee = null;
    quitterPleinIci();
    $('regie').hidden = true;
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
    diffuser(); // la table n'affiche plus rien tant qu'aucune partie n'est ouverte
  }

  function ligneFichier({ donjon, avertissements }) {
    const li = ligneDonjon(donjon);
    if (avertissements.length) li.querySelector('.infos').append(h('br'), h('span', { textContent: `À noter : ${avertissements.join(' · ')}` }));
    return li;
  }

  $('fichier').addEventListener('change', async (e) => {
    const fichier = e.target.files[0];
    e.target.value = '';
    if (!fichier) return;
    const erreur = $('erreur-fichier');
    erreur.hidden = true;
    try {
      const brut = await stockage.lireFichierJson(fichier);
      const res = modele.convertirImport(brut, { echelle: r.echelle });
      if (!res.donjon) throw new Error(res.erreurs.join(' · '));
      // Un fichier de donjon garde son identifiant : on retrouve ainsi sa partie en cours. Il n'entre PAS dans la bibliothèque.
      if (brut.format === modele.FORMAT && typeof brut.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(brut.id)) res.donjon.id = brut.id;
      etat.fichier = { donjon: res.donjon, avertissements: res.avertissements };
      afficherDepart();
    } catch (err) {
      erreur.hidden = false;
      erreur.textContent = `Fichier refusé : ${err.message}`; // textContent : jamais interprété comme du HTML
    }
  });

  function entrer(p) {
    etat.p = p;
    etat.consultee = p.salleCourante;
    etat.selection = null;
    etat.message = '';
    etat.messageCommande = null;
    etat.brouillon = null;
    noteSalle = null;
    etat.enregistre = true;
    $('depart').hidden = true;
    $('regie').hidden = false;
    $('nom-donjon').textContent = p.donjon.nom;
    document.title = `${p.donjon.nom} · Présentation · Carte de MJ`;
    sauvegarder();
    rendre();
  }
  $('quitter').addEventListener('click', afficherDepart);

  // --- Rendu de la régie ---------------------------------------------------------------------------
  const LISTES = { porte: 'portes', objet: 'objets', creature: 'creatures' };
  const trouver = (plan, sel) => {
    const e = sel && (plan[LISTES[sel.genre]] || []).find((x) => x.id === sel.id);
    return e ? { genre: sel.genre, element: e } : null;
  };
  const reperePorte = (q) => (q.mur === 'nord' || q.mur === 'sud' ? lettreColonne(q.position) : String(q.position + 1));

  function tailleRegie(plan) {
    if (!etat.ajuster) return r.taille;
    const sc = $('scene');
    const l = sc.clientWidth - 56, ha = sc.clientHeight - 56;
    if (l <= 0 || ha <= 0) return r.taille;
    return Math.max(16, Math.min(r.taille, Math.floor(Math.min(l / (plan.largeur + 2), ha / (plan.longueur + 2)))));
  }

  /** Repères posés sur la carte de la régie : portes reliées (pastille bleue) et élément sélectionné. */
  function marques(planAffiche) {
    const s = salleConsultee();
    const portesReliees = planAffiche.portes.filter((q) => modele.liaisonDePorte(etat.p.donjon, s.id, q)).map((q) => ({ mur: q.mur, position: q.position }));
    const trouve = trouver(planAffiche, etat.selection);
    return { portesReliees, selection: trouve };
  }

  function dessinerRegie(plan) {
    const s = salleConsultee();
    dessiner($('carte'), pres.planRegie(plan, idsReveles(s.id)), {
      taille: tailleRegie(s.plan), grille: r.grille, reperes: r.reperes !== false, marques: marques(plan),
    });
  }

  function rendre() {
    if (!etat.p) return;
    const s = salleConsultee();
    dessinerRegie(s.plan);
    $('support').className = etat.consultee === etat.p.salleCourante ? 'sur-table' : 'consultation';
    majBandeau();
    majSelection();
    majSalle();
    majCommande();
    majMiniCarte();
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
    const enfants = [texte, actions];
    if (etat.message) enfants.push(h('div', { className: 'note texte', id: 'message', textContent: etat.message }));
    bandeau.replaceChildren(...enfants);
  }

  function libelleElement(trouve) {
    const e = trouve.element;
    if (trouve.genre === 'porte') return `${e.type} · mur ${e.mur}, repère ${reperePorte(e)}`;
    if (trouve.genre === 'creature') return `${nomAffiche(e.type)} ${e.numero} · ${nomCase(e.x, e.y)}`;
    return `${nomAffiche(e.type)} · ${nomCase(e.x, e.y)}`;
  }

  const bouton = (texte, onClick, classe = '') => {
    const b = h('button', { type: 'button', textContent: texte, className: classe });
    b.addEventListener('click', onClick);
    return b;
  };

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

  const LIBELLES_ETAT = { normal: 'normal', blesse: 'blessé', mort: 'mort' };
  function changerEtat(pion, valeur) {
    const s = salleConsultee();
    pres.definirEtat(etat.p, s.id, pion.id, valeur);
    const qui = `${nomAffiche(pion.type)} ${pion.numero}`;
    const visible = !pion.cache || pres.estRevele(etat.p, s.id, pion.id);
    const ou = !visible ? ' (pion caché : la table ne le voit pas)' : s.id === etat.p.salleCourante ? ' : visible sur la table' : ' (cette salle n’est pas à la table)';
    etat.message = valeur === 'normal' ? `${qui} est de nouveau normal${ou}.` : `${qui} est ${LIBELLES_ETAT[valeur]}${ou}.`;
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

  function majSelection() {
    const zone = $('selection');
    const p = etat.p, s = salleConsultee();
    const trouve = trouver(s.plan, etat.selection);
    if (!trouve) { etat.selection = null; zone.hidden = true; zone.replaceChildren(); return; }
    zone.hidden = false;
    const el = trouve.element;
    const contenu = [h('h2', { textContent: 'Sélection' }), h('p', { className: 'selection-titre', textContent: libelleElement(trouve) })];
    const sur = s.id === p.salleCourante;

    if (el.cache) {
      const revele = pres.estRevele(p, s.id, el.id);
      contenu.push(h('p', { className: 'note', textContent: revele
        ? `Révélé : visible sur la table${sur ? '' : ' dès que la salle y sera affichée'}.`
        : 'Caché : les joueurs ne le voient pas. Tu le vois ici en translucide, contour en pointillés.' }));
      contenu.push(h('div', { className: 'actions' }, revele
        ? bouton('Recacher', () => { pres.recacherElement(p, s.id, el.id); etat.message = 'Recaché : il disparaît de la table.'; modifie(); }, 'discret')
        : bouton('Révéler', () => { pres.revelerElement(p, s.id, el.id); etat.message = `Révélé${sur ? ' : il apparaît sur la table' : ', mais cette salle n’est pas à la table'}.`; modifie(); })));
    }

    if (trouve.genre === 'creature') {
      const actuel = el.etat || 'normal';
      contenu.push(h('p', { className: 'note', id: 'etat-pion', textContent: `État : ${LIBELLES_ETAT[actuel]}. Un pion blessé porte une croix rouge, un pion mort est grisé et barré ; la table les voit.` }));
      const boutons = h('div', { className: 'etats' });
      boutons.setAttribute('role', 'group');
      boutons.setAttribute('aria-label', 'État du pion');
      for (const valeur of ['normal', 'blesse', 'mort']) {
        const b = bouton(valeur === 'normal' ? 'Normal' : valeur === 'blesse' ? 'Blessé' : 'Mort', () => changerEtat(el, valeur), valeur === 'normal' ? 'discret' : '');
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
  }

  /** Bloc « Cette salle » : éléments cachés, portes (accessibles au clavier) et notes en lecture seule. */
  function majSalle() {
    const p = etat.p, s = salleConsultee();
    const { total, reveles } = pres.comptageCaches(p, s.id);
    $('comptage-caches').textContent = total
      ? `Éléments cachés : ${total}, dont ${reveles} révélé${reveles > 1 ? 's' : ''}.`
      : 'Aucun élément caché dans cette salle.';
    $('reveler-tout').disabled = total === reveles;
    $('liste-portes').replaceChildren(...s.plan.portes.map((q) => {
      const lien = modele.liaisonDePorte(p.donjon, s.id, q);
      const vers = lien && p.donjon.salles[lien.autre.salle];
      const b = bouton(`${q.type} · mur ${q.mur}, repère ${reperePorte(q)} · ${vers ? `→ ${vers.nom}` : 'non reliée'}${q.cache ? ' · cachée' : ''}`,
        () => { etat.selection = { genre: 'porte', id: q.id }; etat.message = ''; rendre(); }, `discret${q.cache ? ' cachee' : ''}`);
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
    onEtat: (actif) => { $('micro-commande').textContent = actif ? '⏹ Arrêter' : '🎙️ Dicter'; },
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
    etat.message = n ? `${pluriel(n, 'élément révélé', 'éléments révélés')}${s.id === etat.p.salleCourante ? ' : visibles sur la table' : ', mais cette salle n’est pas à la table'}.` : 'Rien de plus à révéler.';
    modifie();
  });

  function majMiniCarte() {
    const p = etat.p;
    const focus = etat.focusMini;
    etat.focusMini = null;
    dessinerMiniCarte($('minicarte'), p.donjon, {
      actif: etat.consultee, courante: p.salleCourante, decouvertes: p.decouvertes, focus: focus || undefined,
      onChoisir: (id) => { etat.focusMini = id; consulter(id); },
    });
  }

  // --- Carte : déplacer les pions, cliquer le reste -----------------------------------------------
  // Les objets et les portes ne bougent jamais ici (option `deplacables`) ; ils restent cliquables.
  activerDeplacement($('carte'), {
    plan: () => salleConsultee().plan,
    taille: () => tailleRegie(salleConsultee().plan),
    apercu: (plan) => dessinerRegie(plan),
    deposer: (nouveau) => { pres.appliquerDeplacement(etat.p, etat.consultee, nouveau); etat.message = ''; modifie(); },
    cliquer: (touche) => {
      etat.selection = touche ? { genre: touche.genre, id: touche.element.id } : null;
      etat.message = '';
      rendre();
    },
    deplacables: ['creature'],
  });

  // --- Fenêtre table et plein écran ici -------------------------------------------------------------
  function messageTable(texte) {
    const m = $('message-table');
    m.hidden = !texte;
    m.textContent = texte || '';
  }
  $('ouvrir-table').addEventListener('click', () => {
    const w = window.open(new URL('presentation.html?vue=table', location.href).href, 'carte-de-mj-table', 'popup,width=1024,height=768');
    if (w) { w.focus(); messageTable('Fenêtre table ouverte : glisse-la sur l’écran de la table, puis son bouton « Plein écran » (au survol, en haut à droite).'); }
    else messageTable('Le navigateur a bloqué la fenêtre. Autorise les fenêtres pour ce site, ou ouvre presentation.html?vue=table dans un nouvel onglet.');
  });

  /** Met à jour l'écran de table local (plein écran ici) avec le plan de vueTable(). */
  function majEcranLocal() {
    if (!etat.pleinIci || !etat.p) return;
    ecran.plan = pres.vueTable(etat.p);
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
  $('retour-regie').addEventListener('click', quitterPleinIci);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && etat.pleinIci) quitterPleinIci(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && etat.pleinIci) quitterPleinIci(); });

  for (const b of document.querySelectorAll('[data-defiler]')) {
    b.addEventListener('click', () => {
      const [dx, dy] = b.dataset.defiler.split(',').map(Number);
      const recentrer = dx === 0 && dy === 0;
      canal?.postMessage({ type: 'defiler', dx, dy, recentrer });
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
  $('taille').addEventListener('input', (e) => { r.taille = Number(e.target.value); $('taille-val').textContent = `${r.taille} px`; sauverReglages(); rendre(); });
  $('grille').addEventListener('change', (e) => { r.grille = e.target.checked; sauverReglages(); rendre(); });
  $('reperes').addEventListener('change', (e) => { r.reperes = e.target.checked; sauverReglages(); rendre(); });
  $('ajuster').addEventListener('change', (e) => { etat.ajuster = e.target.checked; rendre(); });
  let minuterie;
  window.addEventListener('resize', () => { clearTimeout(minuterie); minuterie = setTimeout(() => { if (etat.p) rendre(); }, 150); });

  afficherDepart();
}

if (new URLSearchParams(location.search).get('vue') === 'table') demarrerTable();
else demarrerRegie();
