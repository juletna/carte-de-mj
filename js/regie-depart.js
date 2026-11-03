/**
 * Le départ de la régie : la liste des donjons (et des parties en cours), l'import d'un donjon depuis un fichier, puis
 * « Qui joue ? » (fiches du donjon, ou nombre de joueurs avec nom, race et classe) avant de lancer une partie neuve.
 * Fabrique `creerDepart(ctx)` ; `ctx` est celui de regie.js (`etat`, `r`, `annoncer`, `entrer`, `viderSauvegarde`, `noterRetrait`,
 * `quitterPleinIci`, `diffuser`, `salleCourante`), lu au moment de l'appel.
 */
import * as stockage from './stockage.js';
import * as modele from './donjon.js';
import * as pres from './presentation.js';
import { MAX_JOUEURS } from './personnages.js';
import { $, h, deuxTemps, fichierChoisi } from './dom.js';
import { pluriel } from './format.js';

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

  return { afficher: afficherDepart, demanderJoueurs };
}
