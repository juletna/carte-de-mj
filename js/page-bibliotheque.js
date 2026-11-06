/**
 * Page « Bibliothèque » (bibliotheque.html) : les cartes du catalogue local (dossier bibliotheque/) et « Mes images »
 * (importées, gardées dans ce navigateur). Filtres, recherche, aperçu, crédit, import et suppression d'une image importée.
 * Onglet « Générer une carte » : compose le prompt (style et format au choix, assets/styles-cartes/, js/bibliotheque/prompt.js,
 * le même que le skill generer-carte) à copier dans un générateur d'images, puis importe l'image obtenue, recadrée au format
 * choisi, avec son niveau et sa grille déjà remplis. Sans clé ni serveur.
 * Elle réutilise js/bibliotheque/ (lecture du catalogue, vocabulaire, images).
 */
import { h, deuxTemps, fichierChoisi } from './dom.js';
import { btn } from './univers-boutons.js';
import { selectionner, creditAffiche } from './bibliotheque/catalogue.js';
import { NIVEAUX, MILIEUX, NIVEAUX_AIDE, libelleNiveau, libelleMilieu } from './bibliotheque/vocabulaire.js';
import { lireCatalogue } from './bibliotheque/index.js';
import { urlBibliotheque } from './bibliotheque/source.js';
import { importerImage, listerImages, supprimerImage, recadrerImage } from './bibliotheque/images.js';
import { promptACopier, formatCarte, STYLES, FORMATS, STYLE_PAR_DEFAUT, FORMAT_PAR_DEFAUT } from './bibliotheque/prompt.js';


const racine = document.getElementById('bibliotheque');
const etat = { onglet: 'bibliotheque', niveau: '', milieux: new Set(), requete: '' };
const styles = new Map(); // id de style → texte de assets/styles-cartes/<id>.md, ou une Error (absent : en cours de lecture)
let preremplir = null; // métadonnées venues de l'onglet Générer pour le prochain import
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

const onglets = [['bibliotheque', 'Cartes du catalogue'], ['navigateur', 'Mes images'], ['generer', 'Générer une carte']].map(([id, libelle]) => {
  const b = h('button', { type: 'button', textContent: libelle, role: 'tab', id: `onglet-${id}`, 'aria-controls': 'bib-contenu' });
  b.addEventListener('click', () => { etat.onglet = id; choisi = null; dessiner(); });
  return [id, b];
});
const barreOnglets = h('div', { className: 'bib-onglets', role: 'tablist', 'aria-label': 'Origine des cartes' }, ...onglets.map(([, b]) => b));
barreOnglets.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const ids = onglets.map(([id]) => id);
  etat.onglet = ids[(ids.indexOf(etat.onglet) + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length]; choisi = null; dessiner();
  onglets.find(([id]) => id === etat.onglet)[1].focus();
});

const zoneMessage = h('div', { className: 'bib-message', role: 'status' });
const zoneImport = h('div', { className: 'bib-import' });
const grille = h('div', { className: 'bib-grille', role: 'list' });
const detail = h('div', { className: 'bib-detail', 'aria-live': 'polite' });
const zoneFiltres = h('div', { className: 'bib-filtres' },
  h('div', { className: 'bib-ligne' }, champRecherche, choixNiveau),
  h('div', { className: 'bib-puces', role: 'group', 'aria-label': 'Milieux (cumulables)' }, ...puces));
const corps = h('div', { className: 'bib-corps', id: 'bib-contenu', role: 'tabpanel' }, grille, detail);
const zoneGenerer = h('div', { className: 'bib-generer', role: 'tabpanel', 'aria-labelledby': 'onglet-generer' });

racine.append(barreOnglets, zoneFiltres, zoneMessage, zoneImport, corps, zoneGenerer);

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
  etat.onglet = 'navigateur'; choisi = null; dessiner(); ouvrirFormulaire(f);
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
    h('p', { className: 'bib-note', textContent: 'Télécharge l’image obtenue puis importe-la : elle est recadrée au format choisi si le générateur en a donné un autre, et rejoint « Mes images » avec son niveau, sa description et sa grille déjà remplis.' }),
    h('div', { className: 'bib-actions' }, importerGen, entreeGen)));

majPrompt();

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
    const sup = h('button', { type: 'button', className: 'btn btn-danger' });
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
    ? tuile(c, { source: 'bibliotheque', id: c.id }, urlBibliotheque(c.fichier))
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
  zoneImport.append(btn('Importer une image…', () => entree.click(), { icone: 'importer', classe: 'btn-primaire' }), entree);
}

function ouvrirFormulaire(fichier) {
  const pre = preremplir; preremplir = null;
  const nom = h('input', { type: 'text', value: fichier.name.replace(/\.[^.]+$/, '').slice(0, 120), maxLength: 120, id: 'bib-f-titre' });
  const niveau = h('select', { id: 'bib-f-niveau' }, ...NIVEAUX.map((n) => h('option', { value: n.id, textContent: n.libelle })));
  niveau.value = pre?.niveau || etat.niveau || 'zone';
  const description = h('textarea', { rows: 2, maxLength: 600, id: 'bib-f-description', value: pre?.description ?? '' });
  const tags = h('input', { type: 'text', placeholder: 'tags séparés par des virgules', id: 'bib-f-tags' });
  const milieux = MILIEUX.map((m) => h('label', { className: 'bib-case' }, h('input', { type: 'checkbox', value: m.id }), ` ${m.libelle}`));
  const erreur = h('p', { className: 'bib-erreur', role: 'alert' });
  const ajouter = btn('Ajouter', null, { icone: 'plus', classe: 'btn-primaire' });
  ajouter.addEventListener('click', async () => {
    ajouter.disabled = true; erreur.textContent = '';
    try {
      const image = pre?.cadre ? (await recadrerImage(fichier, pre.cadre.largeur, pre.cadre.hauteur)).fichier : fichier;
      const e = await importerImage(image, {
        titre: nom.value, niveau: niveau.value, tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean),
        milieux: milieux.filter((l) => l.firstChild.checked).map((l) => l.firstChild.value), description: description.value,
        ...(pre && niveau.value === pre.niveau ? { colonnes: pre.colonnes } : {}), ...(pre ? { origine: pre.origine } : {}),
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
    h('label', { htmlFor: 'bib-f-description', textContent: 'Description' }), description,
    ...(pre?.cadre ? [h('p', { className: 'bib-note', textContent: `Format ${pre.cadre.libelle} : si l’image a d’autres proportions, elle sera recadrée au centre (les bords en trop sont retirés).` })] : []),
    ...(pre?.colonnes && niveau.value === pre.niveau ? [h('p', { className: 'bib-note', textContent: `Grille posée : ${pre.colonnes} cases sur la largeur (à caler ensuite dans l’atelier si besoin).` })] : []),
    erreur, h('div', { className: 'bib-actions' }, ajouter, btn('Annuler l’import', () => dessinerImport(), { classe: 'btn-discret' }))));
  nom.focus(); nom.select();
}

async function recharger() {
  try { images = await listerImages(); erreurImages = ''; } catch (e) { images = []; erreurImages = `Les images du navigateur sont indisponibles : ${e.message}`; }
  dessiner();
}

function dessiner() {
  for (const [id, b] of onglets) { b.setAttribute('aria-selected', String(id === etat.onglet)); b.tabIndex = id === etat.onglet ? 0 : -1; }
  const generer = etat.onglet === 'generer';
  zoneGenerer.hidden = !generer;
  for (const z of [zoneFiltres, zoneMessage, corps]) z.hidden = generer;
  dessinerImport();
  if (generer) return;
  dessinerListe();
}

dessiner();
lireCatalogue().then((c) => { catalogue = c; dessinerListe(); });
recharger();
