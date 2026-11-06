/**
 * Page « Bibliothèque » (bibliotheque.html) : les cartes du catalogue local (dossier bibliotheque/) et « Mes images »
 * (importées, gardées dans ce navigateur). Filtres, recherche, aperçu, crédit, import et suppression d'une image importée.
 * Elle réutilise js/bibliotheque/ (lecture du catalogue, vocabulaire, images).
 */
import { h, bouton, deuxTemps, fichierChoisi } from './dom.js';
import { selectionner, creditAffiche } from './bibliotheque/catalogue.js';
import { NIVEAUX, MILIEUX, NIVEAUX_AIDE, libelleNiveau, libelleMilieu } from './bibliotheque/vocabulaire.js';
import { lireCatalogue } from './bibliotheque/index.js';
import { importerImage, listerImages, supprimerImage } from './bibliotheque/images.js';

const DOSSIER = 'bibliotheque/';

const racine = document.getElementById('bibliotheque');
const etat = { onglet: 'bibliotheque', niveau: '', milieux: new Set(), requete: '' };
let catalogue = { cartes: [], avertissements: [], message: '' };
let images = [];
let erreurImages = '';
let choisi = null; // { entree, url, ref }
const urls = new Map(); // id d'image importée → objectURL
const urlDepuisBlob = (e) => { if (!urls.has(e.id)) urls.set(e.id, URL.createObjectURL(e.blob)); return urls.get(e.id); };

// --- Filtres ---
const champRecherche = h('input', { type: 'search', placeholder: 'Rechercher (titre, tag, milieu…)', 'aria-label': 'Rechercher une carte', className: 'bib-recherche' });
champRecherche.addEventListener('input', () => { etat.requete = champRecherche.value; choisi = null; dessinerListe(); });
const choixNiveau = h('select', { 'aria-label': 'Niveau' }, h('option', { value: '', textContent: 'Tous les niveaux' }),
  ...NIVEAUX.map((n) => h('option', { value: n.id, textContent: `${n.libelle} (${NIVEAUX_AIDE[n.id]})` })));
choixNiveau.addEventListener('change', () => { etat.niveau = choixNiveau.value; choisi = null; dessinerListe(); });
const puces = MILIEUX.map((m) => {
  const b = h('button', { type: 'button', textContent: m.libelle, className: 'bib-puce', 'aria-pressed': 'false' });
  b.addEventListener('click', () => {
    if (etat.milieux.has(m.id)) etat.milieux.delete(m.id); else etat.milieux.add(m.id);
    b.setAttribute('aria-pressed', String(etat.milieux.has(m.id))); choisi = null; dessinerListe();
  });
  return b;
});

const onglets = [['bibliotheque', 'Cartes du catalogue'], ['navigateur', 'Mes images']].map(([id, libelle]) => {
  const b = h('button', { type: 'button', textContent: libelle, role: 'tab', id: `onglet-${id}`, 'aria-controls': 'bib-contenu' });
  b.addEventListener('click', () => { etat.onglet = id; choisi = null; dessiner(); });
  return [id, b];
});
const barreOnglets = h('div', { className: 'bib-onglets', role: 'tablist', 'aria-label': 'Origine des cartes' }, ...onglets.map(([, b]) => b));
barreOnglets.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  etat.onglet = etat.onglet === 'bibliotheque' ? 'navigateur' : 'bibliotheque'; choisi = null; dessiner();
  onglets.find(([id]) => id === etat.onglet)[1].focus();
});

const zoneMessage = h('div', { className: 'bib-message', role: 'status' });
const zoneImport = h('div', { className: 'bib-import' });
const grille = h('div', { className: 'bib-grille', role: 'list' });
const detail = h('div', { className: 'bib-detail', 'aria-live': 'polite' });

racine.append(
  barreOnglets,
  h('div', { className: 'bib-filtres' },
    h('div', { className: 'bib-ligne' }, champRecherche, choixNiveau),
    h('div', { className: 'bib-puces', role: 'group', 'aria-label': 'Milieux (cumulables)' }, ...puces)),
  zoneMessage, zoneImport,
  h('div', { className: 'bib-corps', id: 'bib-contenu', role: 'tabpanel' }, grille, detail));

function tuile(entree, ref, url) {
  const img = h('img', { src: url, alt: '', loading: 'lazy' });
  img.addEventListener('error', () => img.replaceWith(h('span', { className: 'bib-sans-image', textContent: 'image introuvable' })));
  const b = h('button', { type: 'button', className: 'bib-tuile', role: 'listitem', 'aria-pressed': String(choisi?.ref.id === ref.id) },
    h('span', { className: 'bib-vignette' }, img),
    h('span', { className: 'bib-nom', textContent: entree.titre }),
    h('span', { className: 'bib-sous', textContent: libelleNiveau(entree.niveau) }));
  b.dataset.id = ref.id;
  b.addEventListener('click', () => { choisi = { ref, entree, url }; dessinerListe(); grille.querySelector(`[data-id="${CSS.escape(ref.id)}"]`)?.focus(); });
  return b;
}

function dessinerDetail() {
  detail.replaceChildren();
  if (!choisi) { detail.append(h('p', { className: 'bib-aide', textContent: 'Choisis une vignette pour la voir en grand, avec son crédit.' })); return; }
  const e = choisi.entree;
  const credit = etat.onglet === 'bibliotheque' ? creditAffiche(e) : '';
  const lignes = [h('strong', { textContent: e.titre }), h('span', { textContent: `${libelleNiveau(e.niveau)}${e.milieux?.length ? ' · ' + e.milieux.map(libelleMilieu).join(', ') : ''}` })];
  if (e.largeur && e.hauteur) lignes.push(h('span', { className: 'bib-doux', textContent: `${e.largeur} × ${e.hauteur} px` }));
  if (e.description) lignes.push(h('span', { textContent: e.description }));
  if (e.tags?.length) lignes.push(h('span', { className: 'bib-doux', textContent: 'Tags : ' + e.tags.join(', ') }));
  if (credit) lignes.push(h('span', { className: 'bib-credit', textContent: `Crédit : ${credit}` }));
  const actions = h('div', { className: 'bib-actions' });
  if (etat.onglet === 'navigateur') {
    const sup = h('button', { type: 'button', className: 'discret' });
    deuxTemps(sup, 'Supprimer cette image', 'Confirmer la suppression', async () => {
      try {
        const id = choisi.ref.id;
        await supprimerImage(id);
        if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
        choisi = null; await recharger();
      } catch (err) { erreurImages = `Suppression impossible : ${err.message}`; dessiner(); }
    });
    actions.append(sup);
  }
  detail.append(h('div', { className: 'bib-apercu' }, h('img', { src: choisi.url, alt: `Aperçu : ${e.titre}` })), h('div', { className: 'bib-fiche' }, ...lignes, actions));
}

function dessinerListe() {
  const source = etat.onglet === 'bibliotheque' ? catalogue.cartes : images;
  const visibles = selectionner(source, { niveau: etat.niveau, milieux: [...etat.milieux], requete: etat.requete });
  grille.replaceChildren(...visibles.map((c) => etat.onglet === 'bibliotheque'
    ? tuile(c, { source: 'bibliotheque', id: c.id }, DOSSIER + c.fichier)
    : tuile(c, { source: 'navigateur', id: c.id }, urlDepuisBlob(c))));
  const msgs = [];
  if (etat.onglet === 'bibliotheque') {
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
  zoneImport.hidden = etat.onglet !== 'navigateur';
  if (zoneImport.hidden) return;
  const entree = h('input', { type: 'file', accept: '.webp,.png,.jpg,.jpeg,.svg,image/webp,image/png,image/jpeg,image/svg+xml', hidden: true });
  entree.addEventListener('change', (e) => { const f = fichierChoisi(e); if (f) ouvrirFormulaire(f); });
  zoneImport.append(bouton('Importer une image…', () => entree.click(), 'principal'), entree);
}

function ouvrirFormulaire(fichier) {
  const nom = h('input', { type: 'text', value: fichier.name.replace(/\.[^.]+$/, '').slice(0, 120), maxLength: 120, id: 'bib-f-titre' });
  const niveau = h('select', { id: 'bib-f-niveau' }, ...NIVEAUX.map((n) => h('option', { value: n.id, textContent: n.libelle })));
  niveau.value = etat.niveau || 'zone';
  const tags = h('input', { type: 'text', placeholder: 'tags séparés par des virgules', id: 'bib-f-tags' });
  const milieux = MILIEUX.map((m) => h('label', { className: 'bib-case' }, h('input', { type: 'checkbox', value: m.id }), ` ${m.libelle}`));
  const erreur = h('p', { className: 'bib-erreur', role: 'alert' });
  const ajouter = h('button', { type: 'button', textContent: 'Ajouter', className: 'principal' });
  ajouter.addEventListener('click', async () => {
    ajouter.disabled = true; erreur.textContent = '';
    try {
      const e = await importerImage(fichier, {
        titre: nom.value, niveau: niveau.value, tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean),
        milieux: milieux.filter((l) => l.firstChild.checked).map((l) => l.firstChild.value),
      });
      await recharger();
      choisi = { ref: { source: 'navigateur', id: e.id }, entree: images.find((i) => i.id === e.id) ?? e, url: urlDepuisBlob(e) };
      dessiner();
    } catch (err) { erreur.textContent = `Import impossible : ${err.message}`; ajouter.disabled = false; }
  });
  zoneImport.replaceChildren(h('form', { className: 'bib-formulaire', onsubmit: (e) => e.preventDefault() },
    h('strong', { textContent: `Importer « ${fichier.name} »` }),
    h('label', { htmlFor: 'bib-f-titre', textContent: 'Titre' }), nom,
    h('label', { htmlFor: 'bib-f-niveau', textContent: 'Niveau' }), niveau,
    h('fieldset', {}, h('legend', { textContent: 'Milieux' }), h('div', { className: 'bib-cases' }, ...milieux)),
    h('label', { htmlFor: 'bib-f-tags', textContent: 'Tags' }), tags,
    erreur, h('div', { className: 'bib-actions' }, ajouter, bouton('Annuler l’import', () => dessinerImport(), 'discret'))));
  nom.focus(); nom.select();
}

async function recharger() {
  try { images = await listerImages(); erreurImages = ''; } catch (e) { images = []; erreurImages = `Les images du navigateur sont indisponibles : ${e.message}`; }
  dessiner();
}

function dessiner() {
  for (const [id, b] of onglets) { b.setAttribute('aria-selected', String(id === etat.onglet)); b.tabIndex = id === etat.onglet ? 0 : -1; }
  dessinerImport();
  dessinerListe();
}

dessiner();
lireCatalogue().then((c) => { catalogue = c; dessinerListe(); });
recharger();
