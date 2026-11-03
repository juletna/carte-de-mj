/**
 * Point d'entrée de la page d'impression : lit les donjons du navigateur (SANS jamais rien écrire), prépare les pages
 * avec impression.js (pur), les dessine avec le moteur et le thème « papier », et les montre telles qu'elles sortiront.
 *
 * Chaque page est dessinée sur un canvas d'environ 254 ppp (voir resolutionCanvas), puis exportée en image PNG dont la
 * taille CSS est en millimètres : l'impression est exacte quelle que soit la résolution de l'écran, et la mémoire reste
 * raisonnable même pour un donjon de plusieurs dizaines de pages. Repères, titres et règle sont du texte et du SVG.
 * Les noms et notes du donjon ne passent QUE par textContent (jamais de HTML).
 */
import { CLE_DONJONS, chargerDonjons } from './stockage.js';
import { dessinerFenetre } from './rendu/moteur.js';
import { EPAISSEUR_MUR } from './rendu/geometrie.js';
import * as papier from './rendu/themes/papier.js';
import {
  preparerImpression, messageEchelle, resolutionCanvas, variablesCss, voisinesTexte, phrasesProposition, phrasesFeuilleMJ as phrases, FEUILLE, REPERE_COLONNES_MM, REPERE_LIGNES_MM, REGLE_MM, MESSAGE_REGLE,
} from './impression.js';
import { $, h } from './dom.js';
import { pluriel, virgule } from './format.js';

const SVG = 'http://www.w3.org/2000/svg';
const DEBORD_PX = 2;

const mm = (v) => `${v}mm`;

// --- Lecture des donjons (lecture seule) ----------------------------------------------

/** Les donjons du navigateur, ou { erreur } avec un message clair. Aucune écriture. */
function lireDonjons() {
  let brut;
  try {
    if (!globalThis.localStorage) throw new Error('absent');
    brut = localStorage.getItem(CLE_DONJONS);
  } catch {
    return { erreur: 'Le stockage du navigateur est indisponible (navigation privée, ou données de site bloquées) : impossible de lire tes donjons. Autorise le stockage pour ce site, ou imprime depuis un navigateur normal.' };
  }
  if (!brut) return { erreur: 'Aucun donjon enregistré dans ce navigateur. Prépare-en un dans l’outil Donjon, puis reviens ici.' };
  const etat = chargerDonjons();
  if (!etat) return { erreur: 'Les donjons enregistrés dans ce navigateur sont illisibles ou vides : rien à imprimer. Rien n’a été modifié.' };
  return etat;
}

const etat = {
  donjons: null,
  idDonjon: null,
  version: 'joueurs',
  pions: true,
  monstres: false,
  echelle: 'exacte',
  salles: new Set(), // identifiants cochés
  jeton: 0,          // change à chaque nouveau dessin : un dessin périmé s'arrête
  url: [],           // URL d'images à libérer
  pret: Promise.resolve(),
};
const donjon = () => etat.donjons[etat.idDonjon];

// --- Réglages ------------------------------------------------------------------------

function afficherMessage(texte) {
  const m = $('message-global');
  m.hidden = !texte;
  m.textContent = texte || '';
}

function remplirDonjons() {
  const choix = $('donjon-choix');
  choix.replaceChildren(...Object.values(etat.donjons).map((d) => h('option', { value: d.id, textContent: d.nom, selected: d.id === etat.idDonjon })));
  choix.hidden = Object.keys(etat.donjons).length < 2;
  choix.closest('fieldset').hidden = choix.hidden;
}

function remplirSalles() {
  const d = donjon();
  const liste = $('salles');
  liste.replaceChildren(...Object.values(d.salles).map((s, i) => {
    const c = h('input', { type: 'checkbox', checked: etat.salles.has(s.id), value: s.id });
    c.addEventListener('change', () => { c.checked ? etat.salles.add(s.id) : etat.salles.delete(s.id); rendre(); });
    return h('li', {}, h('label', {}, c, h('span', {}, h('b', { textContent: `Plan ${i + 1}` }), ' ',
      h('span', { textContent: `${s.nom} ` }), h('span', { className: 'detail', textContent: `(${s.plan.largeur} × ${s.plan.longueur} cases)` }))));
  }));
}

function nouveauDonjon(id) {
  etat.idDonjon = id;
  etat.salles = new Set(Object.keys(donjon().salles)); // toutes cochées par défaut
  remplirSalles();
}

function lireOptions() {
  etat.version = document.querySelector('input[name="version"]:checked').value;
  etat.echelle = document.querySelector('input[name="echelle"]:checked').value;
  etat.pions = $('pions').checked;
  etat.monstres = $('monstres').checked;
  // Les monstres ne se choisissent que pour la version joueurs (le MJ voit tout) et avec les pions.
  $('ligne-monstres').hidden = etat.version !== 'joueurs';
  $('monstres').disabled = !etat.pions;
}

// --- Construction des pages ----------------------------------------------------------

/** Règle de contrôle : 50 mm exacts (SVG en millimètres), graduée au millimètre. */
function regle() {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('class', 'regle');
  s.setAttribute('viewBox', `0 0 ${REGLE_MM} 8`);
  s.setAttribute('width', `${REGLE_MM}mm`);
  s.setAttribute('height', '8mm');
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', 'Règle de contrôle de 5 centimètres');
  const el = (nom, attrs) => { const e = document.createElementNS(SVG, nom); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); s.append(e); return e; };
  el('rect', { x: 0.1, y: 0.1, width: REGLE_MM - 0.2, height: 4, fill: 'none', stroke: '#000', 'stroke-width': 0.2 }); // le contour extérieur mesure 50 mm
  for (let i = 0; i <= REGLE_MM; i++) {
    const long = i % 10 === 0 ? 4 : i % 5 === 0 ? 3 : 1.6;
    const x = Math.min(Math.max(i, 0.1), REGLE_MM - 0.1);
    el('line', { x1: x, y1: 0.1, x2: x, y2: long + 0.1, stroke: '#000', 'stroke-width': 0.15 });
  }
  for (let cm = 0; cm <= REGLE_MM / 10; cm++) {
    const fin = cm === REGLE_MM / 10; // le dernier repère s'aligne à droite : « 5 cm » ne déborde pas de la règle
    const t = el('text', { x: fin ? REGLE_MM : Math.max(cm * 10, 0.8), y: 7.4, 'text-anchor': fin ? 'end' : cm === 0 ? 'start' : 'middle', 'font-size': 2.6, 'font-family': 'system-ui, sans-serif', fill: '#000' });
    t.textContent = cm === REGLE_MM / 10 ? '5 cm' : String(cm);
  }
  return s;
}

/** Une page A4 (sans l'image du plan, qui arrive ensuite) : repères, en-tête, raccords et pied. */
function creerPage(salle, decoupage, p, version) {
  const portrait = decoupage.orientation === 'portrait';
  const c = decoupage.mmParCase;
  const mur = EPAISSEUR_MUR * c;
  const g = p.grille;
  const mj = version === 'mj';
  const titre = mj ? `Plan ${salle.numero} · ${salle.nom}` : `Plan ${salle.numero}`;

  const entete = h('div', { className: 'entete' },
    h('div', { className: 'ligne-entete' },
      h('span', { className: 'titre' }, h('span', { textContent: titre }), ...(mj ? [h('span', { className: 'mj', textContent: 'VERSION MJ · SECRÈTE' })] : [])),
      h('span', { className: 'position', textContent: p.total > 1 ? `Page ${p.numero}/${p.total} · colonne ${p.colonne}/${p.colonnes}, ligne ${p.ligne}/${p.lignes}` : 'Page 1/1' })),
    h('div', { className: 'ligne-entete' },
      decoupage.reduite
        ? h('span', { className: 'reduite', textContent: messageEchelle(decoupage) })
        : h('span', { className: 'detail-entete', textContent: `1 case = ${virgule(c)} mm (échelle réelle)` }),
      h('span', { className: 'detail-entete', textContent: p.total > 1 ? `Raccords — ${voisinesTexte(p)}` : '' })));

  const lettres = h('div', { className: 'lettres', style: `left:0;top:${mm(-(REPERE_COLONNES_MM + (p.bords.nord ? mur : 0)))}` },
    ...p.lettres.map((l) => h('span', { textContent: l, style: `width:${mm(c)}` })));
  const numeros = h('div', { className: 'numeros', style: `top:0;left:${mm(-(REPERE_LIGNES_MM + (p.bords.ouest ? mur : 0)))}` },
    ...p.numeros.map((n) => h('span', { textContent: String(n), style: `height:${mm(c)}` })));

  const grille = h('div', { className: 'grille', style: `left:${mm(g.x)};top:${mm(g.y)};width:${mm(g.l)};height:${mm(g.h)}` }, lettres, numeros);
  if (p.voisins.ouest) grille.append(h('div', { className: 'coupe ouest', title: 'Trait de coupe' }));
  if (p.voisins.nord) grille.append(h('div', { className: 'coupe nord', title: 'Trait de coupe' }));
  if (p.voisins.est) grille.append(h('div', { className: 'raccord est', textContent: `page ${p.voisins.est}/${p.total} recouvre cette colonne →` }));
  if (p.voisins.sud) grille.append(h('div', { className: 'raccord sud', textContent: `↓ page ${p.voisins.sud}/${p.total} recouvre cette rangée` }));

  const pied = h('div', { className: 'pied' }, regle(),
    h('div', { className: 'consigne-regle' }, h('b', { textContent: 'Règle de contrôle : 5 cm' }), MESSAGE_REGLE));

  const page = h('section', {
    className: `page ${decoupage.orientation}`,
    'aria-label': `Plan ${salle.numero}, page ${p.numero} sur ${p.total}`,
  }, entete, grille, pied);
  page.dataset.orientation = decoupage.orientation;
  return page;
}

/** Feuille du MJ : noms, liaisons, secrets et notes de chaque salle imprimée. Tout le texte passe par textContent. */
function feuilleMJ(prep) {
  const f = h('section', { className: 'feuille-mj', 'aria-label': 'Feuille du MJ' },
    h('div', { className: 'secret-bandeau', textContent: 'SECRET : à ne pas montrer aux joueurs' }),
    h('h1', { textContent: `Feuille du MJ · ${prep.nomDonjon}` }),
    h('p', { textContent: phrases.introduction(prep) }));
  for (const s of prep.salles) {
    const taille = phrases.taille(s);
    const liaisons = s.liaisons.length
      ? h('ul', {}, ...s.liaisons.map((l) => h('li', { textContent: phrases.liaison(l) })))
      : h('p', { className: 'doux-mj', textContent: 'Aucune liaison.' });
    const secrets = s.secrets.length ? h('ul', {}, ...s.secrets.map((t) => h('li', { textContent: t }))) : h('p', { className: 'doux-mj', textContent: 'Aucun élément secret.' });
    f.append(h('article', { className: 'salle-mj' },
      h('h2', { textContent: `Plan ${s.numero} · ${s.nom}` }),
      h('p', { className: 'doux-mj', textContent: taille }),
      h('h3', { textContent: 'Liaisons' }), liaisons,
      h('h3', { textContent: 'Secrets' }), secrets,
      h('h3', { textContent: 'Notes de préparation' }),
      s.notes.trim() ? h('div', { className: 'notes-mj', textContent: s.notes }) : h('p', { className: 'doux-mj', textContent: 'Aucune note.' })));
  }
  return f;
}

// --- Dessin ---------------------------------------------------------------------------

const versBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

/** Dessine l'image d'une page, l'exporte en PNG et la pose dans la page. */
async function dessinerPage(canvas, salle, decoupage, p, page) {
  const res = resolutionCanvas(p.image.l, p.image.h);
  const taille = decoupage.mmParCase * res.pxParMm;
  const r = dessinerFenetre(canvas, salle.plan, {
    fenetre: p.fenetre, bords: p.bords, taille, debord: DEBORD_PX, theme: papier, marques: salle.marques || {},
  });
  const blob = await versBlob(canvas);
  if (!blob) throw new Error('export du canvas impossible');
  const url = URL.createObjectURL(blob);
  etat.url.push(url);
  const debordMm = DEBORD_PX / res.pxParMm;
  const img = h('img', {
    alt: `Plan ${salle.numero}, page ${p.numero} sur ${p.total}`,
    style: `left:${mm(Math.round((p.image.x - p.grille.x - debordMm) * 1000) / 1000)};top:${mm(Math.round((p.image.y - p.grille.y - debordMm) * 1000) / 1000)};width:${mm(Math.round(r.largeur / res.pxParMm * 1000) / 1000)};height:${mm(Math.round(r.hauteur / res.pxParMm * 1000) / 1000)}`,
  });
  img.src = url;
  page.querySelector('.grille').prepend(img);
  await img.decode().catch(() => {});
}

/**
 * Salle(s) qui dépasse(nt) de peu une page à 25 mm : un message et un bouton pour tenir sur une page.
 * Rien ne change sans clic (le défaut reste l'échelle réelle) ; le texte ne cite que « Plan N » et des nombres.
 */
function proposer(prep) {
  const liste = prep.propositions || [];
  $('proposition-echelle').hidden = liste.length === 0;
  $('lien-proposition').hidden = liste.length === 0;
  const phrases = phrasesProposition(prep);
  if (!phrases) return;
  $('texte-proposition').textContent = phrases.texte;
  $('detail-proposition').textContent = phrases.detail;
}

/** Reconstruit l'aperçu : les pages d'abord (vides), puis les images, une page à la fois. */
async function rendre() {
  lireOptions();
  const jeton = ++etat.jeton;
  for (const u of etat.url.splice(0)) URL.revokeObjectURL(u);
  const apercu = $('apercu');
  const imprimer = $('imprimer');
  imprimer.disabled = true;

  let prep;
  try {
    prep = preparerImpression(donjon(), { salles: [...etat.salles], version: etat.version, pions: etat.pions, monstres: etat.monstres, echelle: etat.echelle });
  } catch (err) {
    apercu.replaceChildren();
    $('etat-pages').textContent = '';
    afficherMessage(`Impossible de préparer l’impression : ${err.message}`);
    return;
  }
  afficherMessage(prep.avertissements.join(' '));
  $('avant-impression').hidden = false;
  $('barre-impression').hidden = false;
  proposer(prep);
  $('consigne-assemblage').hidden = !prep.salles.some((s) => s.decoupage.pages.length > 1);
  if (!prep.totalPages) {
    apercu.replaceChildren();
    $('etat-pages').textContent = 'Rien à imprimer.';
    return;
  }

  const fragments = [];
  const travaux = [];
  if (prep.version === 'mj') fragments.push(feuilleMJ(prep));
  for (const salle of prep.salles) {
    for (const p of salle.decoupage.pages) {
      const page = creerPage(salle, salle.decoupage, p, prep.version);
      fragments.push(page);
      travaux.push({ salle, p, page });
    }
  }
  apercu.replaceChildren(...fragments);
  ajusterApercu();

  const canvas = document.createElement('canvas');
  const etatPages = $('etat-pages');
  let fait = 0;
  const total = travaux.length;
  etatPages.textContent = `Préparation des pages : 0/${total}…`;
  etat.pret = (async () => {
    for (const { salle, p, page } of travaux) {
      if (jeton !== etat.jeton) return false; // un autre réglage a pris la suite
      try {
        await dessinerPage(canvas, salle, salle.decoupage, p, page);
      } catch (err) {
        afficherMessage(`Le dessin d’une page a échoué (${err.message}). Essaie avec moins de salles.`);
        etatPages.textContent = '';
        return false;
      }
      etatPages.textContent = `Préparation des pages : ${++fait}/${total}…`;
      await new Promise((r) => setTimeout(r, 0)); // laisse l'écran respirer
    }
    if (jeton !== etat.jeton) return false;
    canvas.width = canvas.height = 1; // libère la mémoire du canvas de travail
    const feuille = prep.version === 'mj' ? ' + feuille du MJ' : '';
    etatPages.textContent = `${pluriel(total, 'page prête', 'pages prêtes')}${feuille}, A4.`;
    imprimer.disabled = false;
    document.documentElement.dataset.pret = String(jeton);
    return true;
  })();
}

/** Aperçu à l'écran : réduit pour tenir dans la fenêtre (CSS zoom), jamais à l'impression. */
function ajusterApercu() {
  const apercu = $('apercu');
  const large = apercu.querySelector('.page.paysage') ? FEUILLE.paysage.l : FEUILLE.portrait.l; // mm : feuille avec marges
  const pxLarge = (large * 96) / 25.4;
  const dispo = document.documentElement.clientWidth;
  apercu.style.zoom = dispo < pxLarge ? String(Math.max(0.3, dispo / pxLarge)) : '';
}

// --- Démarrage -------------------------------------------------------------------------

function demarrer() {
  for (const [nom, valeur] of Object.entries(variablesCss())) document.documentElement.style.setProperty(nom, valeur);
  const lecture = lireDonjons();
  if (lecture.erreur) { afficherMessage(lecture.erreur); return; }
  etat.donjons = lecture.donjons;
  const demande = new URLSearchParams(location.search).get('donjon');
  nouveauDonjon(demande && etat.donjons[demande] ? demande : lecture.actif);
  remplirDonjons();
  $('options').hidden = false;

  $('donjon-choix').addEventListener('change', (e) => { nouveauDonjon(e.target.value); rendre(); });
  // Les cases des salles et le choix du donjon ont leurs propres écouteurs ; tout le reste relance le dessin.
  $('options').addEventListener('change', (e) => { if (!e.target.closest('#salles') && e.target.id !== 'donjon-choix') rendre(); });
  $('tout-cocher').addEventListener('click', () => { etat.salles = new Set(Object.keys(donjon().salles)); remplirSalles(); rendre(); });
  $('tout-decocher').addEventListener('click', () => { etat.salles = new Set(); remplirSalles(); rendre(); });
  $('imprimer').addEventListener('click', async () => { await etat.pret; window.print(); });
  $('reduire').addEventListener('click', () => {
    const radio = document.querySelector('input[name="echelle"][value="page"]');
    radio.checked = true;
    radio.focus({ preventScroll: true }); // le bouton disparaît avec la proposition : le focus reste dans les choix d'échelle
    rendre();
  });
  window.addEventListener('resize', ajusterApercu);
  window.addEventListener('beforeprint', () => { $('apercu').style.zoom = ''; });
  window.addEventListener('afterprint', ajusterApercu);
  rendre();
}

demarrer();
