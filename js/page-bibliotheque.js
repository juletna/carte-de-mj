/**
 * Page « Bibliothèque » (bibliotheque.html) : une seule liste de cartes, celles de ce navigateur (importées ici, ou ajoutées au
 * dossier de travail par le skill generer-carte). Filtres, recherche, aperçu, crédit, import et suppression.
 * Panneau « Générer une carte » (bouton à côté de l'import) : compose le prompt (style et format au choix, assets/styles-cartes/, js/bibliotheque/prompt.js,
 * le même que le skill generer-carte) à copier dans un générateur d'images, puis importe l'image obtenue, recadrée au format
 * choisi, avec son niveau et sa grille déjà remplis. Sans clé ni serveur.
 * Elle réutilise js/bibliotheque/ (vocabulaire, images, fiche d'une carte).
 */
import { h, deuxTemps, fichierChoisi } from './dom.js';
import { btn } from './univers-boutons.js';
import { selectionner } from './bibliotheque/catalogue.js';
import { NIVEAUX, MILIEUX, NIVEAUX_AIDE, libelleNiveau } from './bibliotheque/vocabulaire.js';
import { ficheCarte, champsImport, metaImport, MESSAGE_VIDE } from './bibliotheque/fiche.js';
import { importerImage, listerImages, supprimerImage, recadrerImage } from './bibliotheque/images.js';
import { promptACopier, formatCarte, STYLES, FORMATS, STYLE_PAR_DEFAUT, FORMAT_PAR_DEFAUT } from './bibliotheque/prompt.js';


const racine = document.getElementById('bibliotheque');
const etat = { generer: false, niveau: '', milieux: new Set(), requete: '' };
const styles = new Map(); // id de style → texte de assets/styles-cartes/<id>.md, ou une Error (absent : en cours de lecture)
let preremplir = null; // métadonnées venues du panneau Générer pour le prochain import
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

const zoneMessage = h('div', { className: 'bib-message', role: 'status' });
const zoneImport = h('div', { className: 'bib-import' });
const grille = h('div', { className: 'bib-grille', role: 'list', 'aria-label': 'Cartes' });
const detail = h('div', { className: 'bib-detail', 'aria-live': 'polite' });
const zoneFiltres = h('div', { className: 'bib-filtres' },
  h('div', { className: 'bib-ligne' }, champRecherche, choixNiveau),
  h('div', { className: 'bib-puces', role: 'group', 'aria-label': 'Milieux (cumulables)' }, ...puces));
const corps = h('div', { className: 'bib-corps' }, grille, detail);
const zoneGenerer = h('div', { className: 'bib-generer', id: 'bib-generer', 'aria-label': 'Générer une carte' });

racine.append(zoneImport, zoneGenerer, zoneFiltres, zoneMessage, corps);

// --- Générer une carte : prompt à copier ---
const genNiveau = h('select', { id: 'gen-niveau' }, ...NIVEAUX.map((n) => h('option', { value: n.id, textContent: `${n.libelle} (${NIVEAUX_AIDE[n.id]})` })));
genNiveau.value = 'zone';
const genStyle = h('select', { id: 'gen-style' }, ...STYLES.map((s) => h('option', { value: s.id, textContent: `${s.libelle} (${s.aide})` })));
genStyle.value = STYLE_PAR_DEFAUT;
const genFormat = h('select', { id: 'gen-format' }, ...FORMATS.map((f) => h('option', { value: f.id, textContent: `${f.libelle} (${f.aide})` })));
genFormat.value = FORMAT_PAR_DEFAUT;
const genScene = h('textarea', { id: 'gen-scene', rows: 4, maxLength: 2000, placeholder: 'Une clairière dans une forêt de chênes, avec un petit sanctuaire en ruine de 6 cases à l’est et un chemin de 2 cases qui la traverse du nord au sud.' });
const genGrille = h('p', { className: 'bib-note' });
const genPrompt = h('textarea', { id: 'gen-prompt', rows: 10, readOnly: true, className: 'bib-prompt' });
const genEtat = h('p', { className: 'bib-note', role: 'status' });
const copier = btn('Copier le prompt', async () => {
  try { await navigator.clipboard.writeText(genPrompt.value); genEtat.textContent = 'Copié. Colle-le dans ChatGPT ou un autre générateur d’images.'; }
  catch { genPrompt.select(); genEtat.textContent = 'Copie refusée par le navigateur : le prompt est sélectionné, copie-le au clavier.'; }
}, { icone: 'copier', classe: 'btn-primaire' });
const entreeGen = h('input', { type: 'file', accept: '.webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg', hidden: true });
entreeGen.addEventListener('change', (e) => {
  const f = fichierChoisi(e);
  if (!f) return;
  const format = formatCarte(genFormat.value, genNiveau.value);
  preremplir = {
    niveau: genNiveau.value, description: genScene.value.trim().slice(0, 600), colonnes: format.grille?.colonnes,
    cadre: { largeur: format.largeur, hauteur: format.hauteur, libelle: FORMATS.find((f) => f.id === genFormat.value).libelle },
    origine: { type: 'generee', style: genStyle.value, le: new Date().toISOString().slice(0, 10) },
  };
  etat.generer = false; choisi = null; dessiner(); ouvrirFormulaire(f);
});
const importerGen = btn('Importer l’image obtenue…', () => entreeGen.click(), { icone: 'importer' });

function majPrompt() {
  const scene = genScene.value.trim();
  copier.disabled = true;
  const { largeur, hauteur, recadre, grille: g } = formatCarte(genFormat.value, genNiveau.value);
  genGrille.textContent = `Image finale : ${largeur} × ${hauteur} px${recadre ? ' (demandée en 3:2, recadrée à l’import)' : ''}. `
    + (g ? `Grille demandée : ${g.colonnes} × ${g.lignes} cases (une case = 1,5 m), posée à l’import.` : 'Pas de grille à ce niveau.');
  const style = styles.get(genStyle.value);
  if (!style) { genPrompt.value = ''; genEtat.textContent = 'Chargement du style…'; lireStyle(genStyle.value); return; }
  if (style instanceof Error) { genPrompt.value = ''; genEtat.textContent = `Le style n’a pas pu être lu (${style.message}). Ouvre l’appli par « python3 outils/serveur.py » ou depuis le site.`; return; }
  if (!scene) { genPrompt.value = ''; genPrompt.placeholder = 'Décris la carte pour voir le prompt.'; return; }
  genPrompt.value = promptACopier({ style, niveau: genNiveau.value, scene, format: genFormat.value });
  copier.disabled = false;
}
const enCours = new Set();
function lireStyle(id) {
  if (enCours.has(id)) return;
  enCours.add(id);
  fetch(`assets/styles-cartes/${id}.md`)
    .then((r) => { if (!r.ok) throw new Error(`erreur ${r.status}`); return r.text(); })
    .then((t) => { styles.set(id, t); }, (e) => { styles.set(id, e instanceof Error ? e : new Error(String(e))); })
    .finally(() => { enCours.delete(id); genEtat.textContent = ''; majPrompt(); });
}
for (const champ of [genNiveau, genStyle, genFormat]) champ.addEventListener('change', () => { genEtat.textContent = ''; majPrompt(); });
genScene.addEventListener('input', () => { genEtat.textContent = ''; majPrompt(); });

zoneGenerer.append(
  h('section', { className: 'bib-etape' },
    h('h2', { textContent: '1. Décrire la carte' }),
    h('label', { htmlFor: 'gen-niveau', textContent: 'Niveau' }), genNiveau,
    h('label', { htmlFor: 'gen-style', textContent: 'Style' }), genStyle,
    h('label', { htmlFor: 'gen-format', textContent: 'Format' }), genFormat, genGrille,
    h('label', { htmlFor: 'gen-scene', textContent: 'Scène' }), genScene,
    h('p', { className: 'bib-note', textContent: 'En français ou en anglais. Dis ce qu’il y a, où, et en quelle taille : une porte fait 1 case, un arbre 2 à 3, un chemin 2. Pas besoin de demander l’absence de texte ou de personnages : le style s’en charge, et les noms de lieux que tu cites ne doivent pas être écrits sur l’image.' })),
  h('section', { className: 'bib-etape' },
    h('h2', { textContent: '2. Copier le prompt' }),
    h('label', { htmlFor: 'gen-prompt', textContent: 'Prompt (en anglais)' }), genPrompt,
    h('div', { className: 'bib-actions' }, copier), genEtat,
    h('p', { className: 'bib-note', textContent: 'Colle-le dans ChatGPT (ou un autre générateur d’images). Pour garder le même style d’une carte à l’autre, joins aussi une de tes cartes réussies comme image de référence.' })),
  h('section', { className: 'bib-etape' },
    h('h2', { textContent: '3. Importer l’image' }),
    h('p', { className: 'bib-note', textContent: 'Télécharge l’image obtenue puis importe-la : elle est recadrée au format choisi si le générateur en a donné un autre, et rejoint la liste avec son niveau, sa description et sa grille déjà remplis.' }),
    h('div', { className: 'bib-actions' }, importerGen, entreeGen)));

majPrompt();

function tuile(entree) {
  const ref = { source: 'navigateur', id: entree.id };
  const url = urlDepuisBlob(entree);
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
  const sup = h('button', { type: 'button', className: 'btn btn-danger' });
  deuxTemps(sup, 'Supprimer cette carte', 'Confirmer la suppression', async () => {
    try {
      const id = choisi.ref.id;
      await supprimerImage(id);
      if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
      choisi = null; await recharger();
    } catch (err) { erreurImages = `Suppression impossible : ${err.message}`; dessiner(); }
  });
  const fiche = ficheCarte(choisi.entree);
  fiche.append(h('div', { className: 'bib-actions' }, sup));
  detail.append(h('div', { className: 'bib-apercu' }, h('img', { src: choisi.url, alt: `Aperçu : ${choisi.entree.titre}` })), fiche);
}

function dessinerListe() {
  const visibles = selectionner(images, { niveau: etat.niveau, milieux: [...etat.milieux], requete: etat.requete });
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
  entree.addEventListener('change', (e) => { const f = fichierChoisi(e); if (f) ouvrirFormulaire(f); });
  const generer = btn('Générer une carte…', () => { etat.generer = !etat.generer; dessiner(); if (etat.generer) genScene.focus(); }, { icone: 'plus' });
  generer.setAttribute('aria-expanded', String(etat.generer));
  generer.setAttribute('aria-controls', 'bib-generer');
  zoneImport.append(h('div', { className: 'bib-actions' }, btn('Importer une image…', () => entree.click(), { icone: 'importer', classe: 'btn-primaire' }), generer), entree);
}

function ouvrirFormulaire(fichier) {
  const pre = preremplir; preremplir = null;
  const champs = champsImport(fichier, { niveau: pre?.niveau || etat.niveau || 'zone', description: pre?.description });
  const erreur = h('p', { className: 'bib-erreur', role: 'alert' });
  const ajouter = btn('Ajouter', null, { icone: 'plus', classe: 'btn-primaire' });
  ajouter.addEventListener('click', async () => {
    ajouter.disabled = true; erreur.textContent = '';
    try {
      const image = pre?.cadre ? (await recadrerImage(fichier, pre.cadre.largeur, pre.cadre.hauteur)).fichier : fichier;
      const e = await importerImage(image, {
        ...metaImport(champs),
        ...(pre && champs.niveau.value === pre.niveau ? { colonnes: pre.colonnes } : {}), ...(pre ? { origine: pre.origine } : {}),
      });
      zoneImport.replaceChildren(); await recharger();
      choisi = { ref: { source: 'navigateur', id: e.id }, entree: images.find((i) => i.id === e.id) ?? e, url: urlDepuisBlob(e) };
      dessiner();
    } catch (err) { erreur.textContent = `Import impossible : ${err.message}`; ajouter.disabled = false; }
  });
  zoneImport.replaceChildren(h('form', { className: 'bib-formulaire', onsubmit: (e) => e.preventDefault() },
    h('strong', { textContent: `Importer « ${fichier.name} »` }), ...champs.elements,
    ...(pre?.cadre ? [h('p', { className: 'bib-note', textContent: `Format ${pre.cadre.libelle} : si l’image a d’autres proportions, elle sera recadrée au centre (les bords en trop sont retirés).` })] : []),
    ...(pre?.colonnes && champs.niveau.value === pre.niveau ? [h('p', { className: 'bib-note', textContent: `Grille posée : ${pre.colonnes} cases sur la largeur (à caler ensuite dans l’atelier si besoin).` })] : []),
    erreur, h('div', { className: 'bib-actions' }, ajouter, btn('Annuler l’import', () => dessinerImport(), { classe: 'btn-discret' }))));
  champs.titre.focus(); champs.titre.select();
}

async function recharger() {
  try { images = await listerImages(); erreurImages = ''; } catch (e) { images = []; erreurImages = `Les cartes de ce navigateur sont indisponibles : ${e.message}`; }
  dessiner();
}

function dessiner() {
  zoneGenerer.hidden = !etat.generer;
  if (!zoneImport.querySelector('form')) dessinerImport();
  dessinerListe();
}

// Cartes arrivées du dossier de travail (skill generer-carte) : la liste se met à jour.
addEventListener('cdm-images-ajoutees', () => { recharger(); });

dessiner();
recharger();
