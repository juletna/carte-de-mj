/**
 * Le départ de la régie (page « Jouer ») : les parties en cours d'abord (Reprendre, et « ⋯ » pour recommencer), puis les mondes et les
 * donjons à lancer, l'import d'un donjon depuis un fichier, puis « Qui joue ? » (fiches du donjon, ou nombre de joueurs avec nom, race
 * et classe) avant de lancer une partie neuve.
 * Fabrique `creerDepart(ctx)` ; `ctx` est celui de regie.js (`etat`, `r`, `annoncer`, `entrer`, `viderSauvegarde`, `noterRetrait`,
 * `quitterPleinIci`, `diffuser`, `salleCourante`), lu au moment de l'appel.
 */
import * as stockage from './stockage.js';
import { convertirImport } from './donjon-validation.js';
import * as pres from './presentation.js';
import { MAX_JOUEURS } from './personnages.js';
import { $, h, deuxTemps, fichierChoisi } from './dom.js';
import { pluriel } from './format.js';
import { icone } from './icones.js';
import { iconeEtTexte } from './regie-icones.js';

export function creerDepart(ctx) {
  const { etat, r } = ctx;
  const annoncer = (texte, duree) => ctx.annoncer(texte, duree);
  const entrer = (p, options) => ctx.entrer(p, options);
  const salleCourante = () => ctx.salleCourante();
  const viderSauvegarde = () => ctx.viderSauvegarde();
  const noterRetrait = () => ctx.noterRetrait();
  const quitterPleinIci = () => ctx.quitterPleinIci();
  const diffuser = () => ctx.diffuser();

  // --- Écran de départ -------------------------------------------------------------------------
  let compteurDepart = 0;
  /** « ⋯ » : des actions rares (recommencer, abandonner) à côté du bouton principal, repliées. */
  function menuPlus(...contenus) {
    return h('details', { className: 'menu-plus' }, h('summary', { className: 'btn btn-icone btn-discret', 'aria-label': 'Plus d’actions', title: 'Plus d’actions' }, icone('plus-d-actions')), h('div', { className: 'menu-plus-corps' }, ...contenus));
  }
  document.addEventListener('click', (e) => { // un clic ailleurs referme les menus « ⋯ » ouverts
    for (const m of document.querySelectorAll('.menu-plus[open]')) if (!m.contains(e.target)) m.open = false;
  });
  /** « Commencer par » : la première salle du donjon est présélectionnée (pas la dernière modifiée dans le Donjon). */
  function choixSalleDepart(d, libelle) {
    const salles = Object.values(d.salles);
    const depart = h('select', { id: `depart-${++compteurDepart}` });
    salles.forEach((sa, i) => depart.append(h('option', { value: sa.id, textContent: `${i + 1}. ${sa.nom}` })));
    depart.value = pres.salleDepart(d);
    const bloc = salles.length > 1 ? h('div', { className: 'depart-choix' }, h('label', { htmlFor: depart.id, textContent: libelle }), depart) : null;
    return { depart, bloc };
  }
  const resume = (d) => h('span', { textContent: pluriel(Object.keys(d.salles).length, 'salle', 'salles') });

  /** Un donjon à lancer (de la bibliothèque, ou d'un fichier ouvert). Sa partie en cours, s'il en a une, est dans « Parties en cours ». */
  /** Le bouton « Reprendre » : doré seulement s'il est la seule partie en cours (sans date, on ne sait pas laquelle est la plus récente) ; un seul doré par écran. */
  const reprendre = (onclick, primaire) => h('button', { type: 'button', className: primaire ? 'btn btn-primaire' : 'btn', onclick }, icone('jouer'), ' Reprendre');

  function ligneDonjon(d) {
    const enCours = etat.presentations[d.id];
    const infos = h('div', { className: 'infos' }, h('b', { textContent: d.nom }), resume(d));
    const boutons = h('div', { className: 'boutons' });
    if (enCours) {
      infos.append(h('br'), h('span', { className: 'en-cours', textContent: pres.resumePartie(enCours) }));
      boutons.append(reprendre(() => entrer(enCours, { reprise: true }), false));
      return h('li', {}, infos, boutons);
    }
    const { depart, bloc } = choixSalleDepart(d, 'Commencer par');
    boutons.append(h('button', { type: 'button', className: 'btn', onclick: () => demanderJoueurs(pres.creerPresentation(d, { salleDepart: depart.value })) }, icone('jouer'), ' Jouer'));
    return h('li', {}, infos, ...(bloc ? [bloc] : []), boutons);
  }

  /** Une partie de donjon en cours : Reprendre, et « ⋯ » pour la recommencer (donjon encore dans la bibliothèque) ou l'abandonner. */
  function ligneEnCours(p, d, primaire) {
    const infos = h('div', { className: 'infos' }, h('b', { textContent: p.donjon.nom }), h('span', { textContent: 'Donjon' }), h('br'), h('span', { className: 'en-cours', textContent: pres.resumePartie(p) }));
    const action = h('button', { type: 'button', className: 'btn btn-danger' }); // destructif : confirmation en deux temps (deuxTemps)
    let corps;
    if (d) {
      // La partie en cours n'est remplacée qu'une fois le choix validé : « ← Liste des parties » la laisse intacte.
      const { depart, bloc } = choixSalleDepart(d, 'Recommencer par');
      deuxTemps(action, 'Recommencer', 'Effacer la partie ?', () => demanderJoueurs(pres.creerPresentation(d, { salleDepart: depart.value }), p.joueurs));
      corps = [...(bloc ? [bloc] : []), action];
    } else {
      deuxTemps(action, 'Abandonner', 'Supprimer la partie ?', () => { stockage.supprimerPartie(p.donjon.id); afficherDepart(); });
      corps = [h('p', { className: 'note', textContent: 'Le donjon n’est plus dans ce navigateur (fichier ouvert, ou donjon supprimé).' }), action];
    }
    return h('li', {}, infos, h('div', { className: 'boutons' }, reprendre(() => entrer(p, { reprise: true }), primaire), menuPlus(...corps)));
  }

  /** Une partie de monde en cours (la carte d'univers : js/regie-univers.js). */
  function ligneMondeEnCours(u, partie, primaire) {
    const infos = h('div', { className: 'infos' }, h('b', { textContent: u.nom }), h('span', { textContent: 'Monde' }), h('br'),
      h('span', { className: 'en-cours', textContent: `Partie en cours : ${partie.dans ? 'dans un donjon, ' : ''}${u.lieux[partie.lieuCourant]?.nom ?? 'lieu disparu'}` }));
    return h('li', {}, infos, h('div', { className: 'boutons' }, reprendre(() => ctx.ouvrirMonde?.(u.id), primaire)));
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
    document.title = 'Jouer · Carte de MJ';
    const charge = stockage.chargerDonjons();
    const donjons = charge ? Object.values(charge.donjons) : [];
    etat.presentations = stockage.chargerPresentations();
    const parId = Object.fromEntries(donjons.map((d) => [d.id, d]));
    const parties = Object.values(etat.presentations);
    const mondes = stockage.chargerUnivers().etat?.univers ?? {};
    const partiesMondes = Object.values(stockage.chargerPartiesUnivers()).filter((pm) => mondes[pm.univers]?.lieux && Object.keys(mondes[pm.univers].lieux).length);
    const seule = parties.length + partiesMondes.length === 1;
    $('liste-en-cours').replaceChildren(...partiesMondes.map((pm) => ligneMondeEnCours(mondes[pm.univers], pm, seule)), ...parties.map((p) => ligneEnCours(p, parId[p.donjon.id], seule)));
    $('section-en-cours').hidden = parties.length + partiesMondes.length === 0;
    const alancer = donjons.filter((d) => !etat.presentations[d.id]);
    $('liste-donjons').replaceChildren(...alancer.map(ligneDonjon));
    $('biblio-vide').hidden = alancer.length > 0 || donjons.length > 0;
    $('biblio-tous').hidden = alancer.length > 0 || donjons.length === 0;
    $('liste-fichier').replaceChildren(...(etat.fichier ? [ligneFichier(etat.fichier)] : []));
    ctx.univers?.listerDepart();
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
      const res = convertirImport(brut, { echelle: r.echelle });
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
    iconeEtTexte($('lancer-joueurs'), 'jouer', n ? `Jouer avec ${qui}` : 'Jouer sans pion');
  }

  /** `precedents` : les joueurs de la partie qu'on recommence, pour ne pas tout ressaisir. */
  function demanderJoueurs(partie, precedents = []) {
    choix.partie = partie;
    choix.lignes = precedents.map(({ nom, race, classe }) => ({ nom, race, classe }));
    const fiches = partie.donjon.personnages || [];
    const prepares = Object.values(partie.donjon.salles).flatMap((s) => s.plan.creatures).filter((k) => k.camp === 'pj').length;
    $('choix-donjon').textContent = partie.donjon.nom;
    $('mode-fiches').disabled = !fiches.length;
    $('texte-mode-fiches').textContent = fiches.length ? 'Choisir parmi les fiches du donjon' : 'Choisir parmi les fiches du donjon (ce donjon n’en a aucune)';
    $('liste-fiches').replaceChildren(...fiches.map(({ id, fiche }) => {
      const coche = h('input', { type: 'checkbox', value: id, checked: true });
      const identite = [fiche.race, fiche.classe].filter(Boolean).join(' · ');
      return h('li', {}, h('label', {}, coche, h('span', {}, h('b', { textContent: fiche.nom }), identite ? h('span', { className: 'doux', textContent: ` ${identite}` }) : '')));
    }));
    const note = [
      ...(fiches.length ? [] : ['Ce donjon n’a aucune fiche de personnage : indique les joueurs ci-dessous (leur pion sera posé dans la première salle), ou ajoute des fiches dans le Donjon, outil « Personnages ».']),
      ...(prepares ? [`Le donjon a déjà ${pluriel(prepares, 'pion de joueur', 'pions de joueurs')} dans ses salles : ${prepares > 1 ? 'ils restent' : 'il reste'} en plus.`] : []),
    ].join(' ');
    $('note-choix').hidden = !note;
    $('note-choix').textContent = note;
    $('nb-joueurs').max = String(MAX_JOUEURS);
    $('nb-joueurs').value = String(precedents.length || 1); // un joueur : les autres s'ajoutent d'un chiffre, sans quatre champs vides à l'écran
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

  return { afficher: afficherDepart, demanderJoueurs };
}
