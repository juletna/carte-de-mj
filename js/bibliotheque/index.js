/**
 * Bibliothèque de cartes : choix d'une carte dans une seule liste (les images d'IndexedDB : importées ici, ou ajoutées au dossier
 * de travail par le skill generer-carte) et import.
 * Interface publique, utilisée par l'univers (docs/conception-univers.md, section 5) :
 *   choisirCarte(options)  → référence { source, id } choisie, ou null si annulé ; avec `options.sansImage`, le bouton « Sans image pour l'instant »
 *                            ferme la fenêtre en rendant { sansImage: true } (créer un lieu « à illustrer » : le plan d'abord, les images ensuite)
 *   urlImage(ref)          → URL affichable, ou null si la carte n'existe plus
 *   infosImage(ref)        → métadonnées (titre, niveau, milieux, largeur, hauteur, grille, credit…), ou null
 * Une référence est { source: 'navigateur', id } : jamais une URL, qui ne survivrait pas au rechargement. L'ancien format
 * { source: 'bibliotheque', id } reste lu : d'abord l'image de même id (les cartes de l'ancien catalogue y sont importées par le
 * dossier de travail), sinon bibliotheque/catalogue.json du dossier ou du site, en secours.
 */
import { h, deuxTemps, fichierChoisi } from '../dom.js';
import { btn } from '../univers-boutons.js';
import { validerCatalogue, selectionner } from './catalogue.js';
import { MILIEUX, libelleZoom } from './vocabulaire.js';
import { ficheCarte, champsImport, metaImport, menuFiltreZoom, filtreDepuis, MESSAGE_VIDE } from './fiche.js';
import { importerImage, listerImages, lireImage, supprimerImage } from './images.js';
import { lireFichierBibliotheque, urlBibliotheque } from './source.js';

/** Ancien catalogue (bibliotheque/catalogue.json du dossier de travail ou du site), lu seulement pour les références d'avant. */
let catalogueEnCours;
function chargerCatalogue() {
  catalogueEnCours ??= lireFichierBibliotheque('catalogue.json').then((r) => {
    if (r.statut !== 'ok') return [];
    try { return validerCatalogue(JSON.parse(r.texte)).cartes; } catch { return []; }
  });
  return catalogueEnCours;
}

const urlsCreees = new Map(); // id d'image du navigateur → objectURL
function urlDepuisBlob(entree) {
  let u = urlsCreees.get(entree.id);
  if (!u) { u = URL.createObjectURL(entree.blob); urlsCreees.set(entree.id, u); }
  return u;
}
const liberer = (id) => { const u = urlsCreees.get(id); if (u) { URL.revokeObjectURL(u); urlsCreees.delete(id); } };

const infosDe = (c) => ({ titre: c.titre, niveau: c.niveau, sousType: c.sousType, milieux: c.milieux, tags: c.tags, description: c.description, largeur: c.largeur, hauteur: c.hauteur, grille: c.grille, credit: c.credit ?? '', licence: c.licence ?? '' });

async function trouver(ref) {
  if (!ref || typeof ref !== 'object' || typeof ref.id !== 'string') return null;
  if (ref.source !== 'navigateur' && ref.source !== 'bibliotheque') return null;
  try {
    const e = await lireImage(ref.id);
    if (e) return { url: urlDepuisBlob(e), infos: infosDe(e) };
  } catch { /* IndexedDB indisponible : l'ancien catalogue peut encore servir */ }
  if (ref.source !== 'bibliotheque') return null;
  const c = (await chargerCatalogue()).find((x) => x.id === ref.id);
  return c ? { url: urlBibliotheque(c.fichier), infos: infosDe(c) } : null;
}

export async function urlImage(ref) { return (await trouver(ref))?.url ?? null; }
export async function infosImage(ref) { return (await trouver(ref))?.infos ?? null; }

/* ------------------------------------------------------------------ fenêtre de choix */

export function choisirCarte(options = {}) {
  return new Promise((resolve) => {
    const ancienFocus = document.activeElement;
    const dialogue = h('dialog', { className: 'bib', 'aria-labelledby': 'bib-titre' });
    let resultat = null;
    const etat = { niveau: options?.niveau || '', milieux: new Set(), requete: '' };
    let choisi = null; // { ref, entree, url }
    let images = [];
    let erreurImages = '';
    let formulaireOuvert = false;

    const titre = h('h2', { id: 'bib-titre', textContent: 'Choisir une carte' });
    const fermer = btn('Annuler', () => dialogue.close(), { icone: 'fermer', classe: 'btn-discret' });
    const sansImage = btn('Sans image pour l’instant', () => { resultat = { sansImage: true }; dialogue.close(); }, { icone: 'plus', classe: 'bib-sans-image-bouton' });
    sansImage.title = 'Crée le lieu tout de suite, sur un fond neutre : tu poses ses points maintenant et son image plus tard';
    const zoneFiltres = h('div', { className: 'bib-filtres' });
    const zoneMessage = h('div', { className: 'bib-message', role: 'status' });
    const grille = h('div', { className: 'bib-grille', role: 'list', 'aria-label': 'Cartes' });
    const detail = h('div', { className: 'bib-detail', 'aria-live': 'polite' });
    const zoneImport = h('div', { className: 'bib-import' });

    const champRecherche = h('input', { type: 'search', placeholder: 'Rechercher (titre, tag, milieu…)', 'aria-label': 'Rechercher une carte', className: 'bib-recherche' });
    champRecherche.addEventListener('input', () => { etat.requete = champRecherche.value; choisi = null; dessinerListe(); });
    const choixNiveau = menuFiltreZoom(etat.niveau);

    choixNiveau.addEventListener('change', () => { etat.niveau = choixNiveau.value; choisi = null; dessinerListe(); }); // « plateau/exterieur » : zoom et sous-type
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

    function tuile(entree) {
      const ref = { source: 'navigateur', id: entree.id };
      const url = urlDepuisBlob(entree);
      const img = h('img', { src: url, alt: '', loading: 'lazy' });
      img.addEventListener('error', () => img.replaceWith(h('span', { className: 'bib-sans-image', textContent: 'image introuvable' })));
      const b = h('button', { type: 'button', className: 'bib-tuile', role: 'listitem', 'aria-pressed': String(choisi?.ref.id === ref.id) },
        h('span', { className: 'bib-vignette' }, img),
        h('span', { className: 'bib-nom', textContent: entree.titre }),
        h('span', { className: 'bib-sous', textContent: libelleZoom(entree) }),
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
      const actions = h('div', { className: 'bib-actions' }, btn('Choisir cette carte', () => { resultat = choisi.ref; dialogue.close(); }, { classe: 'btn-primaire' }));
      const sup = h('button', { type: 'button', className: 'btn btn-danger' });
      deuxTemps(sup, 'Supprimer', 'Confirmer la suppression', async () => {
        try { await supprimerImage(choisi.ref.id); liberer(choisi.ref.id); choisi = null; await recharger(); }
        catch (err) { erreurImages = `Suppression impossible : ${err.message}`; dessiner(); }
      });
      actions.append(sup);
      detail.append(h('div', { className: 'bib-apercu' }, h('img', { src: choisi.url, alt: `Aperçu : ${e.titre}` })), ficheCarte(e, { titreDe: (ref) => images.find((i) => i.id === ref.id)?.titre }), actions);
    }

    function dessinerListe() {
      const visibles = selectionner(images, { ...filtreDepuis(etat.niveau), milieux: [...etat.milieux], requete: etat.requete });
      grille.replaceChildren(...visibles.map(tuile));
      const msgs = [];
      if (erreurImages) msgs.push(erreurImages);
      if (!images.length && !erreurImages) msgs.push(MESSAGE_VIDE);
      else if (images.length && !visibles.length) msgs.push('Aucune carte ne correspond à ces filtres.');
      zoneMessage.replaceChildren(...msgs.map((m) => h('p', { textContent: m })));
      dessinerDetail();
    }

    function dessinerImport() {
      zoneImport.replaceChildren();
      const entree = h('input', { type: 'file', accept: '.webp,.png,.jpg,.jpeg,.svg,image/webp,image/png,image/jpeg,image/svg+xml', hidden: true });
      const importer = btn('Importer une image…', () => entree.click(), { icone: 'importer' }); // jamais doré ici : « Choisir cette carte » est l'unique action principale
      entree.addEventListener('change', (e) => {
        const f = fichierChoisi(e);
        if (f) ouvrirFormulaire(f);
      });
      zoneImport.append(importer, entree);
    }

    function ouvrirFormulaire(fichier) {
      formulaireOuvert = true;
      const champs = champsImport(fichier, { ...filtreDepuis(etat.niveau), niveau: filtreDepuis(etat.niveau).niveau || options?.niveau || 'lieu' });
      const erreur = h('p', { className: 'bib-erreur', role: 'alert' });
      const ajouter = btn('Ajouter', null, { icone: 'plus' });
      ajouter.addEventListener('click', async () => {
        ajouter.disabled = true; erreur.textContent = '';
        try {
          const e = await importerImage(fichier, metaImport(champs));
          formulaireOuvert = false; await recharger(); choisi = { ref: { source: 'navigateur', id: e.id }, entree: images.find((i) => i.id === e.id) ?? e, url: urlDepuisBlob(e) }; dessiner();
        } catch (err) { erreur.textContent = `Import impossible : ${err.message}`; ajouter.disabled = false; }
      });
      const annuler = btn('Annuler l’import', () => { formulaireOuvert = false; dessinerImport(); }, { classe: 'btn-discret' });
      zoneImport.replaceChildren(h('form', { className: 'bib-formulaire', onsubmit: (e) => e.preventDefault() },
        h('strong', { textContent: `Importer « ${fichier.name} »` }), ...champs.elements,
        erreur, h('div', { className: 'bib-actions' }, ajouter, annuler)));
      champs.titre.focus(); champs.titre.select();
    }

    async function recharger() {
      try { images = await listerImages(); erreurImages = ''; }
      catch (e) { images = []; erreurImages = `Les cartes de ce navigateur sont indisponibles : ${e.message}`; }
      dessiner();
    }

    function dessiner() {
      if (!formulaireOuvert) dessinerImport();
      dessinerListe();
    }

    // Cartes arrivées du dossier de travail pendant que la fenêtre est ouverte (skill generer-carte) : la liste se met à jour.
    const surAjouts = () => { recharger(); };
    addEventListener('cdm-images-ajoutees', surAjouts);

    dialogue.append(h('div', { className: 'bib-cadre' },
      h('div', { className: 'bib-tete' }, titre, ...(options?.sansImage ? [sansImage] : []), fermer), zoneFiltres, zoneMessage, zoneImport,
      h('div', { className: 'bib-corps' }, grille, detail)));
    dialogue.addEventListener('click', (e) => { if (e.target === dialogue) dialogue.close(); });
    dialogue.addEventListener('close', () => { removeEventListener('cdm-images-ajoutees', surAjouts); dialogue.remove(); ancienFocus?.focus?.(); resolve(resultat); });
    document.body.append(dialogue);
    dialogue.showModal();
    dessiner();
    champRecherche.focus();
    recharger();
  });
}
