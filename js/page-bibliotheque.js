/**
 * Page « Bibliothèque » (bibliotheque.html) : une seule liste de cartes, celles de ce navigateur (importées ici, ou ajoutées au
 * dossier de travail par le skill generer-carte). Filtres, recherche, aperçu, crédit, import et suppression.
 * Volet « Générer une illustration IA » (bouton à côté de l'import ; docs/maquettes/generer-carte.html) : il prend la colonne de l'aperçu
 * (un tiroir bas sur téléphone) et la grille ne bouge pas. Trois sections-accordéon : décrire l'illustration, copier le prompt
 * (style et format au choix, assets/styles-cartes/, js/bibliotheque/prompt.js, le même que le skill generer-carte) à coller dans un
 * générateur d'images externe, importer l'image obtenue, recadrée au format choisi, avec son zoom et sa grille déjà remplis.
 * Le zoom (monde, lieu, plateau + sous-type) et le style se choisissent sur des cartes illustrées (js/bibliotheque/cartes-choix.js).
 * Le brouillon (scène, zoom, style, format, prompt copié) est gardé dans ce navigateur. Sans clé ni serveur.
 * Elle réutilise js/bibliotheque/ (vocabulaire, images, fiche d'une carte).
 */
import { h, deuxTemps, fichierChoisi } from './dom.js';
import { btn, remplirBouton } from './univers-boutons.js';
import { creerSection } from './atelier/section.js';
import { selectionner } from './bibliotheque/catalogue.js';
import { NIVEAUX, SOUS_TYPES, MILIEUX, NIVEAUX_AIDE, SOUS_TYPES_AIDE, SOUS_TYPE_PAR_DEFAUT, libelleZoom, normaliserNiveau } from './bibliotheque/vocabulaire.js';
import { ficheCarte, champsImport, metaImport, menuFiltreZoom, filtreDepuis, MESSAGE_VIDE } from './bibliotheque/fiche.js';
import { groupeCartes } from './bibliotheque/cartes-choix.js';
import { importerImage, listerImages, supprimerImage, recadrerImage } from './bibliotheque/images.js';
import { promptACopier, formatCarte, STYLES, FORMATS, STYLE_PAR_DEFAUT, FORMAT_PAR_DEFAUT } from './bibliotheque/prompt.js';


const racine = document.getElementById('bibliotheque');
const etat = { generer: false, niveau: '', milieux: new Set(), requete: '' };
const styles = new Map(); // id de style → texte de assets/styles-cartes/<id>.md, ou une Error (absent : en cours de lecture)
let preremplir = null; // métadonnées venues du volet Générer pour le prochain import
let copie = false; // le prompt a été copié : au retour de ChatGPT, le volet s'ouvre sur l'import
let images = [];
let erreurImages = '';
let choisi = null; // { entree, url, ref }
let boutonGenerer = null;
const urls = new Map(); // id d'image importée → objectURL
const urlDepuisBlob = (e) => { if (!urls.has(e.id)) urls.set(e.id, URL.createObjectURL(e.blob)); return urls.get(e.id); };

// --- Brouillon du volet (localStorage : un simple confort, la page marche sans) ---
const CLE_BROUILLON = 'carte-de-mj:bibliotheque-brouillon';
function lireBrouillon() {
  try { const b = JSON.parse(localStorage.getItem(CLE_BROUILLON) ?? 'null'); return b && typeof b === 'object' ? b : {}; } catch { return {}; }
}
function ecrireBrouillon(b) {
  try { if (b) localStorage.setItem(CLE_BROUILLON, JSON.stringify(b)); else localStorage.removeItem(CLE_BROUILLON); } catch { /* stockage indisponible : le volet marche sans brouillon */ }
}

// --- Filtres ---
const champRecherche = h('input', { type: 'search', placeholder: 'Rechercher (titre, tag, milieu…)', 'aria-label': 'Rechercher une carte', className: 'bib-recherche' });
champRecherche.addEventListener('input', () => { etat.requete = champRecherche.value; choisi = null; dessinerListe(); });
const choixNiveau = menuFiltreZoom();
choixNiveau.addEventListener('change', () => { etat.niveau = choixNiveau.value; choisi = null; dessinerListe(); }); // « plateau/exterieur » : zoom et sous-type
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
const volet = h('aside', { className: 'bib-volet', id: 'bib-generer', role: 'dialog', 'aria-label': 'Générer une illustration IA', hidden: true });
const fond = h('div', { className: 'bib-fond', hidden: true });
const corps = h('div', { className: 'bib-corps' }, grille, detail, volet);

racine.append(zoneImport, zoneFiltres, zoneMessage, corps, fond);

// --- Volet « Générer une illustration IA » ---
const champ = (id, libelle, control) => h('div', { className: 'bib-champ' }, h('label', { htmlFor: id, textContent: libelle }), control);
// Zoom, sous-type du plateau et style : des cartes cliquables illustrées (js/bibliotheque/cartes-choix.js), pas des menus.
const ZOOMS_CARTES = NIVEAUX.map((n) => ({ id: n.id, libelle: n.libelle, aide: NIVEAUX_AIDE[n.id], cle: `zoom-${n.id}` }));
const SOUS_TYPES_CARTES = SOUS_TYPES.map((t) => ({ id: t.id, libelle: t.libelle, aide: SOUS_TYPES_AIDE[t.id] }));
const STYLES_CARTES = STYLES.map((x) => ({ id: x.id, libelle: x.libelle, aide: x.aide, cle: `style-${x.id}` }));
const apresChoix = () => { genEtat.textContent = ''; copie = false; remplirBouton(copier, 'Copier le prompt', { icone: 'copier' }); majSousType(); enregistrer(); majPrompt(); };
const genNiveau = groupeCartes({ legende: 'Zoom', options: ZOOMS_CARTES, valeur: 'lieu', surChoix: () => apresChoix() });
const genSousType = groupeCartes({ legende: 'Sous-type du plateau', options: SOUS_TYPES_CARTES, valeur: SOUS_TYPE_PAR_DEFAUT, surChoix: () => apresChoix(), classe: 'bib-cartes-fines' });
const genStyle = groupeCartes({ legende: 'Style', options: STYLES_CARTES, valeur: STYLE_PAR_DEFAUT, surChoix: () => apresChoix() });
const zoneSousType = h('div', { className: 'bib-champ' }, h('span', { className: 'bib-etiq', textContent: 'Le plateau est…' }), genSousType.element);
const majSousType = () => { zoneSousType.hidden = genNiveau.valeur() !== 'plateau'; };
/** Le zoom choisi, avec son sous-type quand c'est un plateau. */
const zoomGen = () => ({ niveau: genNiveau.valeur(), sousType: genNiveau.valeur() === 'plateau' ? genSousType.valeur() : undefined });
const genFormat = h('select', { id: 'gen-format' }, ...FORMATS.map((f) => h('option', { value: f.id, textContent: f.libelle, title: f.aide })));
genFormat.value = FORMAT_PAR_DEFAUT;
const genScene = h('textarea', { id: 'gen-scene', rows: 5, maxLength: 2000, placeholder: 'Une clairière dans une forêt de chênes, avec un petit sanctuaire en ruine de 6 cases à l’est et un chemin de 2 cases qui la traverse du nord au sud.' });
const genGrille = h('p', { className: 'bib-etiquette' });
const genPrompt = h('textarea', { id: 'gen-prompt', rows: 4, readOnly: true, className: 'bib-prompt', 'aria-label': 'Prompt (en anglais)' });
const genEtat = h('p', { className: 'bib-note', role: 'status' });
const agrandir = btn('Agrandir', () => {
  const grand = genPrompt.rows === 4;
  genPrompt.rows = grand ? 14 : 4;
  agrandir.textContent = grand ? 'Réduire' : 'Agrandir';
}, { classe: 'btn-discret' });
const copier = btn('Copier le prompt', async () => {
  try {
    await navigator.clipboard.writeText(genPrompt.value);
    genEtat.textContent = 'Copié. Colle-le dans ChatGPT ou un autre générateur d’images.';
  } catch { genPrompt.select(); genEtat.textContent = 'Copie refusée par le navigateur : le prompt est sélectionné, copie-le au clavier.'; return; }
  remplirBouton(copier, 'Copié', { icone: 'coche' });
  copie = true; enregistrer(); majEtapes();
  ouvrirEtape(3);
}, { icone: 'copier', classe: 'btn-primaire' });

const pastille1 = h('span'), pastille2 = h('span'), pastille3 = h('span');
const entreeGen = h('input', { type: 'file', accept: '.webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg', hidden: true });
const erreurDepot = h('p', { className: 'bib-erreur', role: 'alert' });
const zoneFormGen = h('div', { className: 'bib-form-gen' });
const depot = h('div', { className: 'bib-depot', role: 'button', tabIndex: 0, 'aria-label': 'Choisir ou déposer l’image obtenue' },
  h('strong', { textContent: 'Dépose l’image ici' }), h('small', { textContent: 'ou clique pour la choisir · webp, png, jpg' }));
depot.addEventListener('click', () => entreeGen.click());
depot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entreeGen.click(); } });
depot.addEventListener('dragover', (e) => { e.preventDefault(); depot.classList.add('survol'); });
depot.addEventListener('dragleave', () => depot.classList.remove('survol'));
depot.addEventListener('drop', (e) => { e.preventDefault(); depot.classList.remove('survol'); recevoirImage(e.dataTransfer?.files?.[0]); });
entreeGen.addEventListener('change', (e) => recevoirImage(fichierChoisi(e)));

function recevoirImage(f) {
  if (!f) return;
  erreurDepot.textContent = '';
  if (!/^image\/(webp|png|jpeg)$/.test(f.type) && !/\.(webp|png|jpe?g)$/i.test(f.name)) { erreurDepot.textContent = 'Format non pris en charge : choisis une image webp, png ou jpg.'; return; }
  const format = formatCarte(genFormat.value, genNiveau.valeur());
  preremplir = {
    ...zoomGen(), description: genScene.value.trim().slice(0, 600), colonnes: format.grille?.colonnes,
    cadre: { largeur: format.largeur, hauteur: format.hauteur, libelle: FORMATS.find((x) => x.id === genFormat.value).libelle },
    origine: { type: 'generee', style: genStyle.valeur(), le: new Date().toISOString().slice(0, 10) },
  };
  ouvrirFormulaire(f);
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

function majPrompt() {
  const scene = genScene.value.trim();
  copier.disabled = true;
  const { largeur, hauteur, recadre, grille: g } = formatCarte(genFormat.value, genNiveau.valeur());
  genGrille.textContent = `${largeur} × ${hauteur} px${recadre ? ' (demandée en 3:2, recadrée à l’import)' : ''} · `
    + (g ? `grille ${g.colonnes} × ${g.lignes} cases (1 case = 1,5 m), posée à l’import` : 'pas de grille à ce zoom');
  const style = styles.get(genStyle.valeur());
  genPrompt.placeholder = 'Décris l’illustration à l’étape 1 pour voir le prompt.';
  genPrompt.value = '';
  if (!style) { genEtat.textContent = 'Chargement du style…'; lireStyle(genStyle.valeur()); }
  else if (style instanceof Error) genEtat.textContent = `Le style n’a pas pu être lu (${style.message}). Ouvre l’appli par « python3 outils/serveur.py » ou depuis le site.`;
  else if (scene) { genPrompt.value = promptACopier({ style, ...zoomGen(), scene, format: genFormat.value }); copier.disabled = false; }
  genPrompt.classList.toggle('vide', !genPrompt.value);
  majEtapes();
}

const section1 = creerSection({ cle: 'bib-gen:1', titre: '1 · Décrire l’illustration', compte: pastille1, enfants: [
  champ('gen-scene', 'Scène', genScene),
  h('div', { className: 'bib-champ' }, h('span', { className: 'bib-etiq', textContent: 'Zoom' }), genNiveau.element),
  zoneSousType,
  h('div', { className: 'bib-champ' }, h('span', { className: 'bib-etiq', textContent: 'Style' }), genStyle.element),
  champ('gen-format', 'Format', genFormat),
  genGrille,
  h('p', { className: 'bib-note', textContent: 'En français ou en anglais : ce qu’il y a, où, et en quelle taille (une porte fait 1 case, un arbre 2 à 3, un chemin 2). Inutile de demander l’absence de texte ou de personnages : le style s’en charge.' }),
] }, { replis: sansMemoire() });
const section2 = creerSection({ cle: 'bib-gen:2', titre: '2 · Copier le prompt', compte: pastille2, repliee: true,
  aide: 'Pour garder le même style d’une carte à l’autre, joins une de tes cartes réussies comme image de référence quand tu colles le prompt.', enfants: [
    genPrompt, h('div', { className: 'bib-actions' }, copier, agrandir), genEtat,
    h('p', { className: 'bib-note', textContent: 'À coller dans ChatGPT ou un autre générateur d’images, avec une de tes cartes réussies en référence pour garder le style.' }),
  ] }, { replis: sansMemoire() });
const section3 = creerSection({ cle: 'bib-gen:3', titre: '3 · Importer l’image', compte: pastille3, repliee: true, enfants: [
  depot, entreeGen, erreurDepot, zoneFormGen,
  h('p', { className: 'bib-note', textContent: 'Recadrée au centre si les proportions diffèrent. Zoom, description et grille sont déjà remplis.' }),
] }, { replis: sansMemoire() });
const sections = [section1, section2, section3];

const fermer = btn('Fermer', () => fermerVolet(), { icone: 'fermer', iconeSeule: true, classe: 'btn-discret' });
volet.append(
  h('div', { className: 'bib-poignee', 'aria-hidden': 'true' }),
  h('div', { className: 'bib-volet-tete' },
    h('div', {}, h('div', { className: 'bib-type', textContent: 'Illustration IA' }), h('div', { className: 'bib-volet-nom', textContent: 'Nouvelle illustration' }),
      h('div', { className: 'bib-volet-meta', textContent: 'Brouillon gardé dans ce navigateur' })), fermer),
  h('div', { className: 'bib-volet-sections' }, ...sections.map((x) => x.element)));
volet.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); fermerVolet(); } });
fond.addEventListener('click', () => fermerVolet());

/** Les sections gardent leur état dans la page seulement : le volet décide seul laquelle s'ouvre. */
function sansMemoire() { return { etat: () => undefined, garder() {} }; }
function ouvrirEtape(n) { sections.forEach((x, i) => (i + 1 === n ? x.deplier() : x.replier())); }

/** Pastilles de résumé et coches des étapes. */
function majEtapes() {
  const scene = genScene.value.trim();
  const style = STYLES.find((x) => x.id === genStyle.valeur())?.libelle ?? '';
  pastille1.textContent = `${libelleZoom(zoomGen())} · ${style} · ${FORMATS.find((x) => x.id === genFormat.value)?.libelle ?? ''}`;
  pastille2.textContent = !scene ? 'en attente de la scène' : copie ? 'copié' : 'prêt';
  pastille3.textContent = zoneFormGen.childElementCount ? 'à valider' : 'pas encore';
  section1.element.classList.toggle('bib-fait', !!scene);
  section2.element.classList.toggle('bib-fait', !!scene && copie);
  section3.element.classList.remove('bib-fait');
}

function enregistrer() {
  ecrireBrouillon({ scene: genScene.value, ...zoomGen(), style: genStyle.valeur(), format: genFormat.value, copie });
}
function restaurerBrouillon() {
  const b = lireBrouillon();
  if (typeof b.scene === 'string') genScene.value = b.scene.slice(0, 2000);
  const zoom = normaliserNiveau({ niveau: b.niveau, sousType: b.sousType }); // un brouillon d'avant (zone, localité…) est converti
  if (zoom) { genNiveau.definir(zoom.niveau); if (zoom.sousType) genSousType.definir(zoom.sousType); }
  if (STYLES.some((x) => x.id === b.style)) genStyle.definir(b.style);
  majSousType();
  if (FORMATS.some((x) => x.id === b.format)) genFormat.value = b.format;
  copie = b.copie === true && !!genScene.value.trim();
  if (copie) remplirBouton(copier, 'Copié', { icone: 'coche' });
}
genFormat.addEventListener('change', () => apresChoix());
genScene.addEventListener('input', () => {
  genEtat.textContent = ''; if (copie) { copie = false; remplirBouton(copier, 'Copier le prompt', { icone: 'copier' }); }
  enregistrer(); majPrompt();
});

function ouvrirVolet() {
  etat.generer = true; choisi = null; dessiner();
  const scene = genScene.value.trim();
  ouvrirEtape(copie ? 3 : scene ? 2 : 1);
  (copie ? depot : scene ? copier : genScene).focus();
}
function fermerVolet({ rendreFocus = true } = {}) {
  etat.generer = false; dessiner();
  if (rendreFocus) boutonGenerer?.focus();
}

restaurerBrouillon();
majPrompt();

function tuile(entree) {
  const ref = { source: 'navigateur', id: entree.id };
  const url = urlDepuisBlob(entree);
  const img = h('img', { src: url, alt: '', loading: 'lazy' });
  img.addEventListener('error', () => img.replaceWith(h('span', { className: 'bib-sans-image', textContent: 'image introuvable' })));
  const b = h('button', { type: 'button', className: 'bib-tuile', role: 'listitem', 'aria-pressed': String(choisi?.ref.id === ref.id) },
    h('span', { className: 'bib-vignette' }, img),
    h('span', { className: 'bib-nom', textContent: entree.titre }),
    h('span', { className: 'bib-sous', textContent: libelleZoom(entree) }));
  b.dataset.id = ref.id;
  b.addEventListener('click', () => { choisi = { ref, entree, url }; etat.generer = false; dessiner(); grille.querySelector(`[data-id="${CSS.escape(ref.id)}"]`)?.focus(); });
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
  entree.addEventListener('change', (e) => { const f = fichierChoisi(e); if (f) ouvrirFormulaire(f); });
  const generer = btn('', () => { if (etat.generer) fermerVolet(); else ouvrirVolet(); }, { icone: 'plus' });
  generer.append(h('span', { className: 'bib-lib-long', textContent: 'Générer une illustration IA…' }), h('span', { className: 'bib-lib-court', textContent: 'Illustration IA' }));
  generer.setAttribute('aria-expanded', String(etat.generer));
  generer.setAttribute('aria-controls', 'bib-generer');
  boutonGenerer = generer;
  zoneImport.append(h('div', { className: 'bib-actions' }, btn('Importer une image…', () => entree.click(), { icone: 'importer', classe: 'btn-primaire' }), generer), entree);
}

function ouvrirFormulaire(fichier) {
  const pre = preremplir; preremplir = null;
  const hote = pre ? zoneFormGen : zoneImport; // une image venue du volet s'importe dans le volet
  const champs = champsImport(fichier, { niveau: pre?.niveau || filtreDepuis(etat.niveau).niveau || 'lieu', sousType: pre?.sousType || filtreDepuis(etat.niveau).sousType, description: pre?.description });
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
      hote.replaceChildren();
      if (pre) { // l'illustration est dans la bibliothèque : le volet repart d'une scène vide
        depot.hidden = false; genScene.value = ''; copie = false; remplirBouton(copier, 'Copier le prompt', { icone: 'copier' }); ecrireBrouillon(null); majPrompt();
        etat.generer = false;
      }
      await recharger();
      choisi = { ref: { source: 'navigateur', id: e.id }, entree: images.find((i) => i.id === e.id) ?? e, url: urlDepuisBlob(e) };
      dessiner();
    } catch (err) { erreur.textContent = `Import impossible : ${err.message}`; ajouter.disabled = false; }
  });
  hote.replaceChildren(h('form', { className: 'bib-formulaire', onsubmit: (e) => e.preventDefault() },
    h('strong', { textContent: `Importer « ${fichier.name} »` }), ...champs.elements,
    ...(pre?.cadre ? [h('p', { className: 'bib-note', textContent: `Format ${pre.cadre.libelle} : si l’image a d’autres proportions, elle sera recadrée au centre (les bords en trop sont retirés).` })] : []),
    ...(pre?.colonnes && champs.niveau.value === pre.niveau ? [h('p', { className: 'bib-note', textContent: `Grille posée : ${pre.colonnes} cases sur la largeur (à caler ensuite dans l’atelier si besoin).` })] : []),
    erreur, h('div', { className: 'bib-actions' }, ajouter, btn('Annuler l’import', () => { if (pre) { hote.replaceChildren(); depot.hidden = false; majEtapes(); } else dessinerImport(); }, { classe: 'btn-discret' }))));
  if (pre) { depot.hidden = true; majEtapes(); ouvrirEtape(3); }
  champs.titre.focus(); champs.titre.select();
}

async function recharger() {
  try { images = await listerImages(); erreurImages = ''; } catch (e) { images = []; erreurImages = `Les cartes de ce navigateur sont indisponibles : ${e.message}`; }
  dessiner();
}

function dessiner() {
  volet.hidden = fond.hidden = !etat.generer;
  corps.classList.toggle('avec-volet', etat.generer);
  if (!zoneImport.querySelector('form')) dessinerImport();
  dessinerListe();
}

// Cartes arrivées du dossier de travail (skill generer-carte) : la liste se met à jour.
addEventListener('cdm-images-ajoutees', () => { recharger(); });

dessiner();
recharger();
