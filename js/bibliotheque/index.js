/**
 * Bibliothèque de cartes : choix d'une carte (catalogue local + images du navigateur + import).
 * Interface publique, utilisée par l'univers (docs/conception-univers.md, section 5) :
 *   choisirCarte(options)  → référence { source, id } choisie, ou null si annulé
 *   urlImage(ref)          → URL affichable, ou null si la carte n'existe plus
 *   infosImage(ref)        → métadonnées (titre, niveau, milieux, largeur, hauteur, grille, credit…), ou null
 * Une référence est { source: 'bibliotheque' | 'navigateur', id } : jamais une URL, qui ne survivrait pas au rechargement.
 */
import { h, deuxTemps, fichierChoisi } from '../dom.js';
import { btn } from '../univers-boutons.js';
import { validerCatalogue, selectionner, creditAffiche } from './catalogue.js';
import { NIVEAUX, MILIEUX, libelleNiveau, libelleMilieu } from './vocabulaire.js';
import { importerImage, listerImages, lireImage, supprimerImage } from './images.js';
import { lireFichierBibliotheque, urlBibliotheque } from './source.js';

const DOSSIER = 'bibliotheque/';
const COMMENT_REMPLIR = 'Pour la remplir : lance la génération avec le skill « generer-carte » de Claude Code, ou, pour essayer, « node outils/demo-bibliotheque.mjs » depuis la racine du projet. Tu peux aussi importer tes propres images dans « Mes images », ou choisir un dossier de travail (bouton « Sauvegarde ») qui contient un sous-dossier bibliotheque/.';

let catalogueEnCours;
function chargerCatalogue(rafraichir = false) {
  if (rafraichir || !catalogueEnCours) catalogueEnCours = lireCatalogue();
  return catalogueEnCours;
}
export async function lireCatalogue() {
  const r = await lireFichierBibliotheque('catalogue.json');
  if (r.statut === 'absent') return { cartes: [], avertissements: [], message: `Aucun catalogue (${DOSSIER}catalogue.json est absent du site comme du dossier de travail). ${COMMENT_REMPLIR}` };
  if (r.statut === 'erreur') return { cartes: [], avertissements: [], message: `Le catalogue n’a pas pu être lu (ouvre l’appli par « python3 outils/serveur.py », pas en double-cliquant sur le fichier, ou choisis un dossier de travail dans « Sauvegarde »). ${COMMENT_REMPLIR}` };
  let brut;
  try { brut = JSON.parse(r.texte); } catch { return { cartes: [], avertissements: [], message: `${DOSSIER}catalogue.json est illisible (ce n’est pas du JSON valide).` }; }
  const v = validerCatalogue(brut);
  return { ...v, message: v.cartes.length ? '' : `Le catalogue est vide. ${COMMENT_REMPLIR}` };
}

const urlsCreees = new Map(); // id d'image du navigateur → objectURL
function urlDepuisBlob(entree) {
  let u = urlsCreees.get(entree.id);
  if (!u) { u = URL.createObjectURL(entree.blob); urlsCreees.set(entree.id, u); }
  return u;
}
const liberer = (id) => { const u = urlsCreees.get(id); if (u) { URL.revokeObjectURL(u); urlsCreees.delete(id); } };

const infosDe = (c) => ({ titre: c.titre, niveau: c.niveau, milieux: c.milieux, tags: c.tags, description: c.description, largeur: c.largeur, hauteur: c.hauteur, grille: c.grille, credit: c.credit ?? '', licence: c.licence ?? '' });

async function trouver(ref) {
  if (!ref || typeof ref !== 'object' || typeof ref.id !== 'string') return null;
  if (ref.source === 'bibliotheque') {
    const c = (await chargerCatalogue()).cartes.find((x) => x.id === ref.id);
    return c ? { url: urlBibliotheque(c.fichier), infos: infosDe(c) } : null;
  }
  if (ref.source === 'navigateur') {
    try {
      const e = await lireImage(ref.id);
      return e ? { url: urlDepuisBlob(e), infos: infosDe({ ...e, credit: '', licence: '' }) } : null;
    } catch { return null; }
  }
  return null;
}

export async function urlImage(ref) { return (await trouver(ref))?.url ?? null; }
export async function infosImage(ref) { return (await trouver(ref))?.infos ?? null; }

/* ------------------------------------------------------------------ fenêtre de choix */

export function choisirCarte(options = {}) {
  return new Promise((resolve) => {
    const ancienFocus = document.activeElement;
    const dialogue = h('dialog', { className: 'bib', 'aria-labelledby': 'bib-titre' });
    let resultat = null;
    let onglet = 'bibliotheque';
    const etat = { niveau: options?.niveau || '', milieux: new Set(), requete: '' };
    let choisi = null; // { ref, titre, ... }
    let catalogue = { cartes: [], avertissements: [], message: '' };
    let images = [];
    let erreurImages = '';
    let formulaireOuvert = false;

    const titre = h('h2', { id: 'bib-titre', textContent: 'Choisir une carte' });
    const fermer = btn('Annuler', () => dialogue.close(), { icone: 'fermer', classe: 'btn-discret' });
    const bOnglets = [['bibliotheque', 'Bibliothèque'], ['navigateur', 'Mes images']].map(([id, libelle]) => {
      const b = h('button', { type: 'button', textContent: libelle, role: 'tab', id: `bib-onglet-${id}` });
      b.addEventListener('click', () => { onglet = id; choisi = null; formulaireOuvert = false; dessiner(); });
      return [id, b];
    });
    const barreOnglets = h('div', { className: 'bib-onglets', role: 'tablist', 'aria-label': 'Origine des cartes' }, ...bOnglets.map(([, b]) => b));
    const zoneFiltres = h('div', { className: 'bib-filtres' });
    const zoneMessage = h('div', { className: 'bib-message', role: 'status' });
    const grille = h('div', { className: 'bib-grille', role: 'list' });
    const detail = h('div', { className: 'bib-detail', 'aria-live': 'polite' });
    const zoneImport = h('div', { className: 'bib-import' });

    const champRecherche = h('input', { type: 'search', placeholder: 'Rechercher (titre, tag, milieu…)', 'aria-label': 'Rechercher une carte', className: 'bib-recherche' });
    champRecherche.addEventListener('input', () => { etat.requete = champRecherche.value; choisi = null; dessinerListe(); });
    const choixNiveau = h('select', { 'aria-label': 'Niveau' }, h('option', { value: '', textContent: 'Tous les niveaux' }), ...NIVEAUX.map((n) => h('option', { value: n.id, textContent: n.libelle })));
    choixNiveau.value = etat.niveau;
    choixNiveau.addEventListener('change', () => { etat.niveau = choixNiveau.value; choisi = null; dessinerListe(); });
    const puces = MILIEUX.map((m) => {
      const b = h('button', { type: 'button', textContent: m.libelle, className: 'bib-puce', 'aria-pressed': 'false' });
      b.addEventListener('click', () => {
        if (etat.milieux.has(m.id)) etat.milieux.delete(m.id); else etat.milieux.add(m.id);
        b.setAttribute('aria-pressed', String(etat.milieux.has(m.id))); choisi = null; dessinerListe();
      });
      return b;
    });
    zoneFiltres.append(
      h('div', { className: 'bib-ligne' }, champRecherche, choixNiveau),
      h('div', { className: 'bib-puces', role: 'group', 'aria-label': 'Milieux (cumulables)' }, ...puces),
    );

    function tuile(entree, ref, url) {
      const img = h('img', { src: url, alt: '', loading: 'lazy' });
      img.addEventListener('error', () => img.replaceWith(h('span', { className: 'bib-sans-image', textContent: 'image introuvable' })));
      const b = h('button', { type: 'button', className: 'bib-tuile', role: 'listitem', 'aria-pressed': String(choisi?.ref.id === ref.id) },
        h('span', { className: 'bib-vignette' }, img),
        h('span', { className: 'bib-nom', textContent: entree.titre }),
        h('span', { className: 'bib-sous', textContent: libelleNiveau(entree.niveau) }),
      );
      b.dataset.id = ref.id;
      b.addEventListener('click', () => { choisi = { ref, entree, url }; dessinerListe(); grille.querySelector(`[data-id="${CSS.escape(ref.id)}"]`)?.focus(); });
      b.addEventListener('dblclick', () => { resultat = ref; dialogue.close(); });
      return b;
    }

    function dessinerDetail() {
      detail.replaceChildren();
      if (!choisi) { detail.append(h('p', { className: 'bib-aide', textContent: 'Choisis une vignette pour la voir en détail.' })); return; }
      const e = choisi.entree;
      const credit = onglet === 'bibliotheque' ? creditAffiche(e) : '';
      const lignes = [h('strong', { textContent: e.titre }), h('span', { textContent: `${libelleNiveau(e.niveau)}${e.milieux.length ? ' · ' + e.milieux.map(libelleMilieu).join(', ') : ''}` })];
      if (e.largeur && e.hauteur) lignes.push(h('span', { className: 'bib-doux', textContent: `${e.largeur} × ${e.hauteur} px` }));
      if (e.description) lignes.push(h('span', { textContent: e.description }));
      if (e.tags?.length) lignes.push(h('span', { className: 'bib-doux', textContent: 'Tags : ' + e.tags.join(', ') }));
      if (credit) lignes.push(h('span', { className: 'bib-credit', textContent: `Crédit : ${credit}` }));
      const actions = h('div', { className: 'bib-actions' }, btn('Choisir cette carte', () => { resultat = choisi.ref; dialogue.close(); }, { classe: 'btn-primaire' }));
      if (onglet === 'navigateur') {
        const sup = h('button', { type: 'button', className: 'btn btn-danger' });
        deuxTemps(sup, 'Supprimer', 'Confirmer la suppression', async () => {
          try { await supprimerImage(choisi.ref.id); liberer(choisi.ref.id); choisi = null; await recharger(); }
          catch (err) { erreurImages = `Suppression impossible : ${err.message}`; dessiner(); }
        });
        actions.append(sup);
      }
      detail.append(h('div', { className: 'bib-apercu' }, h('img', { src: choisi.url, alt: `Aperçu : ${e.titre}` })), h('div', { className: 'bib-fiche' }, ...lignes), actions);
    }

    function dessinerListe() {
      const source = onglet === 'bibliotheque' ? catalogue.cartes : images;
      const visibles = selectionner(source, { niveau: etat.niveau, milieux: [...etat.milieux], requete: etat.requete });
      grille.replaceChildren(...visibles.map((c) => onglet === 'bibliotheque'
        ? tuile(c, { source: 'bibliotheque', id: c.id }, urlBibliotheque(c.fichier))
        : tuile(c, { source: 'navigateur', id: c.id }, urlDepuisBlob(c))));
      const msgs = [];
      if (onglet === 'bibliotheque') {
        if (catalogue.message) msgs.push(catalogue.message);
        else if (!visibles.length) msgs.push('Aucune carte ne correspond à ces filtres.');
        for (const a of catalogue.avertissements) msgs.push(`Attention : ${a}.`);
      } else {
        if (erreurImages) msgs.push(erreurImages);
        if (!images.length && !erreurImages) msgs.push('Aucune image importée pour l’instant. Importe un fichier (webp, png, jpg ou svg) : il reste dans ce navigateur.');
        else if (images.length && !visibles.length) msgs.push('Aucune image ne correspond à ces filtres.');
      }
      zoneMessage.replaceChildren(...msgs.map((m) => h('p', { textContent: m })));
      dessinerDetail();
    }

    function dessinerImport() {
      zoneImport.replaceChildren();
      zoneImport.hidden = onglet !== 'navigateur';
      if (zoneImport.hidden) return;
      const entree = h('input', { type: 'file', accept: '.webp,.png,.jpg,.jpeg,.svg,image/webp,image/png,image/jpeg,image/svg+xml', hidden: true });
      const importer = btn('Importer une image…', () => entree.click(), { icone: 'importer' }); // jamais doré ici : « Choisir cette carte » est l'unique action principale
      entree.addEventListener('change', (e) => {
        const f = fichierChoisi(e);
        if (f) ouvrirFormulaire(f);
      });
      zoneImport.append(importer, entree);
    }

    function ouvrirFormulaire(fichier) {
      const nom = h('input', { type: 'text', value: fichier.name.replace(/\.[^.]+$/, '').slice(0, 120), maxLength: 120, id: 'bib-f-titre' });
      const niveau = h('select', { id: 'bib-f-niveau' }, ...NIVEAUX.map((n) => h('option', { value: n.id, textContent: n.libelle })));
      niveau.value = etat.niveau || options?.niveau || 'zone';
      const tags = h('input', { type: 'text', placeholder: 'tags séparés par des virgules', id: 'bib-f-tags' });
      const milieux = MILIEUX.map((m) => h('label', { className: 'bib-case' }, h('input', { type: 'checkbox', value: m.id }), ` ${m.libelle}`));
      const erreur = h('p', { className: 'bib-erreur', role: 'alert' });
      const ajouter = btn('Ajouter', null, { icone: 'plus' });
      ajouter.addEventListener('click', async () => {
        ajouter.disabled = true; erreur.textContent = '';
        try {
          const e = await importerImage(fichier, {
            titre: nom.value, niveau: niveau.value, tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean),
            milieux: milieux.filter((l) => l.firstChild.checked).map((l) => l.firstChild.value),
          });
          formulaireOuvert = false; await recharger(); choisi = { ref: { source: 'navigateur', id: e.id }, entree: images.find((i) => i.id === e.id) ?? e, url: urlDepuisBlob(e) }; dessiner();
        } catch (err) { erreur.textContent = `Import impossible : ${err.message}`; ajouter.disabled = false; }
      });
      const annuler = btn('Annuler l’import', () => { zoneImport.replaceChildren(); dessinerImport(); }, { classe: 'btn-discret' });
      zoneImport.replaceChildren(h('form', { className: 'bib-formulaire', onsubmit: (e) => e.preventDefault() },
        h('strong', { textContent: `Importer « ${fichier.name} »` }),
        h('label', { htmlFor: 'bib-f-titre', textContent: 'Titre' }), nom,
        h('label', { htmlFor: 'bib-f-niveau', textContent: 'Niveau' }), niveau,
        h('fieldset', {}, h('legend', { textContent: 'Milieux' }), h('div', { className: 'bib-cases' }, ...milieux)),
        h('label', { htmlFor: 'bib-f-tags', textContent: 'Tags' }), tags,
        erreur, h('div', { className: 'bib-actions' }, ajouter, annuler)));
      nom.focus(); nom.select();
    }

    async function recharger() {
      try { images = await listerImages(); erreurImages = ''; }
      catch (e) { images = []; erreurImages = `Les images du navigateur sont indisponibles : ${e.message}`; }
      dessiner();
    }

    function dessiner() {
      for (const [id, b] of bOnglets) { b.setAttribute('aria-selected', String(id === onglet)); b.tabIndex = id === onglet ? 0 : -1; }
      if (!formulaireOuvert) dessinerImport();
      dessinerListe();
    }

    barreOnglets.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      onglet = onglet === 'bibliotheque' ? 'navigateur' : 'bibliotheque'; choisi = null; dessiner();
      bOnglets.find(([id]) => id === onglet)[1].focus();
    });

    dialogue.append(h('div', { className: 'bib-cadre' },
      h('div', { className: 'bib-tete' }, titre, fermer), barreOnglets, zoneFiltres, zoneMessage, zoneImport,
      h('div', { className: 'bib-corps' }, grille, detail)));
    dialogue.addEventListener('click', (e) => { if (e.target === dialogue) dialogue.close(); });
    dialogue.addEventListener('close', () => { dialogue.remove(); ancienFocus?.focus?.(); resolve(resultat); });
    document.body.append(dialogue);
    dialogue.showModal();
    dessiner();
    champRecherche.focus();
    chargerCatalogue(true).then((c) => { catalogue = c; dessinerListe(); });
    recharger();
  });
}
