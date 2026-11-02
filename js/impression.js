/**
 * Impression : prépare les plans d'un donjon pour le papier (A4), afin de jouer avec de vraies figurines.
 * Module PUR : aucun accès au DOM ni au stockage, il se teste sous Node. Il ne modifie jamais le donjon reçu.
 *
 * Deux versions :
 *  - « mj »      tout, secrets compris (dessinés avec un repère « S » en pointillés), avec nom de la salle,
 *                notes de préparation, liaisons (porte → salle) et liste des secrets pour la feuille du MJ ;
 *  - « joueurs » mêmes règles de secret que la table : le plan passe par planPublic() de presentation.js
 *                (liste blanche : ni élément caché, ni porte secrète, ni notes, ni liaisons, ni nom de salle,
 *                ni état blessé / mort). Les pions de monstres et de PNJ en sont exclus par défaut, car un plan
 *                imprimé d'avance ne doit pas les dévoiler ; les pions de personnages (camp pj) restent.
 *
 * DÉCOUPAGE. Zone imprimable = A4 moins 10 mm de marge (@page { size: A4; margin: 10mm }), soit 190 × 277 mm en
 * portrait, 277 × 190 mm en paysage. Une page porte un en-tête, des repères (lettres au-dessus, numéros à gauche),
 * la fenêtre de cases, et un pied avec la règle de contrôle de 5 cm. Une fenêtre ne contient que des cases ENTIÈRES.
 * Les murs ne sont dessinés que là où la fenêtre touche le bord de la salle.
 * RECOUVREMENT : deux pages voisines partagent une rangée de cases (la dernière de l'une est la première de
 * l'autre). Une imprimante ne couvre jamais le bord du papier : sans recouvrement, il resterait toujours une
 * bande blanche entre les pages. Avec une rangée commune, on découpe la marge de la page de droite (ou du bas)
 * et on pose sa première colonne sur la dernière de la page voisine : les traits de grille se superposent.
 * Une bande de 4 mm sans mur est réservée sur les côtés de raccord pour la ligne de coupe et le numéro de la page voisine.
 * L'orientation (portrait ou paysage) est choisie par salle, pour avoir le moins de pages ; à égalité, on garde
 * celle dont le grand côté suit le grand côté de la salle.
 */
import { planPublic } from './presentation.js';
import { lettreColonne, nomCase } from './parseur/coordonnees.js';
import { nomAffiche } from './parseur/lexique.js';
import { EPAISSEUR_MUR } from './rendu/moteur.js';

export const CASE_MM = 25;           // échelle par défaut : 25 mm par case (figurines de 25 mm)
export const MARGE_PAGE_MM = 10;     // marge de @page
export const FEUILLE = { portrait: { l: 210, h: 297 }, paysage: { l: 297, h: 210 } };
/** Zone imprimable : la feuille moins la marge de chaque côté. */
export const ZONE = {
  portrait: { l: FEUILLE.portrait.l - 2 * MARGE_PAGE_MM, h: FEUILLE.portrait.h - 2 * MARGE_PAGE_MM },
  paysage: { l: FEUILLE.paysage.l - 2 * MARGE_PAGE_MM, h: FEUILLE.paysage.h - 2 * MARGE_PAGE_MM },
};
export const ENTETE_MM = 10;         // titre, position dans l'assemblage, échelle
export const PIED_MM = 16;           // règle de contrôle et consigne
export const REPERE_COLONNES_MM = 5; // lettres au-dessus de la grille
export const REPERE_LIGNES_MM = 6;   // numéros à gauche de la grille
export const RACCORD_MM = 4;         // bande de raccord, côtés est et sud d'une page qui a une voisine
export const RECOUVREMENT = 1;       // rangées de cases partagées entre deux pages voisines
export const REGLE_MM = 50;          // règle de contrôle : 5 cm exacts
export const PPP = 254;              // résolution des canvas : 10 pixels par mm (dans la plage 200–300 ppp)
export const MESSAGE_REGLE = 'Cette règle doit mesurer exactement 5 cm. Sinon, imprime à 100 % (échelle « Réelle »), sans « Ajuster à la page ».';
export const VERSIONS = ['mj', 'joueurs'];

const EPS = 1e-9;
const arrondi = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;
const entierBas = (v) => Math.floor(v + EPS);
const virgule = (v) => String(arrondi(v, 1)).replace('.', ',');
const orientationDe = (largeur, longueur) => (largeur > longueur ? 'paysage' : 'portrait');

// --- Découpage ---------------------------------------------------------------------

/** Longueur disponible pour les cases (hors en-tête et pied) et repère à réserver, selon l'axe. */
const axe = (orientation, nom) => (nom === 'x'
  ? { dispo: ZONE[orientation].l, repere: REPERE_LIGNES_MM }
  : { dispo: ZONE[orientation].h - ENTETE_MM - PIED_MM, repere: REPERE_COLONNES_MM });

/**
 * Découpe `n` cases en fenêtres de cases entières le long d'un axe : [{ debut, fin }] (fin exclue).
 * Capacités (en cases) : une page seule réserve un mur de chaque côté ; la première un mur et une bande de raccord ;
 * une page du milieu deux bandes de raccord ; la dernière une bande et un mur.
 * Le nombre de pages est le plus petit possible, puis les fenêtres sont rééquilibrées (aucune n'a moins de 2 cases).
 */
function decouperAxe(n, { dispo, repere }, c) {
  const mur = EPAISSEUR_MUR * c;
  const seule = entierBas((dispo - repere - 2 * mur) / c);
  const premiere = entierBas((dispo - repere - mur - RACCORD_MM) / c);
  const milieu = entierBas((dispo - repere - 2 * RACCORD_MM) / c);
  const derniere = premiere; // même réserve que la première : un mur et une bande de raccord
  if (n <= seule) return [{ debut: 0, fin: n }];
  if (Math.min(premiere, milieu, derniere) < 2) throw new Error('Cette échelle est trop grande pour une feuille A4.');
  const capacites = (nb) => Array.from({ length: nb }, (_, i) => (i === 0 ? premiere : i === nb - 1 ? derniere : milieu));
  const somme = (liste) => liste.reduce((a, b) => a + b, 0);
  let k = 2;
  while (somme(capacites(k)) - (k - 1) * RECOUVREMENT < n) k++;
  const tailles = capacites(k);
  let exces = somme(tailles) - (k - 1) * RECOUVREMENT - n;
  while (exces > 0) {
    const i = tailles.indexOf(Math.max(...tailles));
    if (tailles[i] <= 2) break;
    tailles[i]--; exces--;
  }
  let debut = 0;
  return tailles.map((taille) => {
    const f = { debut, fin: debut + taille };
    debut = f.fin - RECOUVREMENT;
    return f;
  });
}

/**
 * Découpe une salle de `largeur` × `longueur` cases en pages A4, à `mmParCase` millimètres par case.
 * Sans `orientation`, choisit celle qui donne le moins de pages.
 * @returns {{orientation:string, mmParCase:number, colonnes:number, lignes:number, pages:object[]}}
 *   page : { numero, total, colonne, ligne, colonnes, lignes, fenetre:{x0,y0,x1,y1} (cases, fin exclue),
 *            bords:{nord,sud,est,ouest} (la fenêtre touche ce bord de la salle : mur dessiné),
 *            voisins:{nord,sud,est,ouest} (numéro de la page voisine ou null),
 *            grille:{x,y,l,h} (mm, par rapport à la zone imprimable : la fenêtre de cases),
 *            image:{x,y,l,h} (mm : la grille plus les murs qu'elle contient),
 *            lettres:[…], numeros:[…] (repères des colonnes et des lignes imprimées) }
 * @throws {Error} si l'échelle est trop grande pour une feuille A4
 */
export function decouper(largeur, longueur, { mmParCase = CASE_MM, orientation } = {}) {
  const pref = orientationDe(largeur, longueur);
  const essais = orientation ? [orientation] : [pref, pref === 'portrait' ? 'paysage' : 'portrait'];
  let meilleur = null, erreur = null;
  for (const o of essais) { // l'orientation préférée passe en premier : à égalité de pages, elle est gardée
    try {
      const r = decouperDans(largeur, longueur, mmParCase, o);
      if (!meilleur || r.pages.length < meilleur.pages.length) meilleur = r;
    } catch (e) { erreur = e; }
  }
  if (!meilleur) throw erreur;
  return meilleur;
}

function decouperDans(largeur, longueur, c, orientation) {
  const fx = decouperAxe(largeur, axe(orientation, 'x'), c);
  const fy = decouperAxe(longueur, axe(orientation, 'y'), c);
  const mur = EPAISSEUR_MUR * c;
  const zone = ZONE[orientation];
  const total = fx.length * fy.length;
  const pages = [];
  fy.forEach((wy, ligne) => fx.forEach((wx, colonne) => {
    const numero = ligne * fx.length + colonne + 1;
    const bords = { nord: ligne === 0, sud: ligne === fy.length - 1, ouest: colonne === 0, est: colonne === fx.length - 1 };
    const voisins = {
      nord: bords.nord ? null : numero - fx.length, sud: bords.sud ? null : numero + fx.length,
      ouest: bords.ouest ? null : numero - 1, est: bords.est ? null : numero + 1,
    };
    const l = (wx.fin - wx.debut) * c, h = (wy.fin - wy.debut) * c;
    const avantX = REPERE_LIGNES_MM + (bords.ouest ? mur : 0);
    const apresX = bords.est ? mur : RACCORD_MM;
    const x = (zone.l - (avantX + l + apresX)) / 2 + avantX; // la fenêtre est centrée dans la largeur
    const y = ENTETE_MM + REPERE_COLONNES_MM + (bords.nord ? mur : 0);
    const gx = arrondi(x), gy = arrondi(y);
    const gauche = bords.ouest ? mur : 0, haut = bords.nord ? mur : 0;
    pages.push({
      numero, total, colonne: colonne + 1, ligne: ligne + 1, colonnes: fx.length, lignes: fy.length,
      fenetre: { x0: wx.debut, y0: wy.debut, x1: wx.fin, y1: wy.fin },
      bords, voisins,
      grille: { x: gx, y: gy, l: arrondi(l), h: arrondi(h) },
      image: {
        x: arrondi(gx - gauche), y: arrondi(gy - haut),
        l: arrondi(l + gauche + (bords.est ? mur : 0)), h: arrondi(h + haut + (bords.sud ? mur : 0)),
      },
      lettres: Array.from({ length: wx.fin - wx.debut }, (_, i) => lettreColonne(wx.debut + i)),
      numeros: Array.from({ length: wy.fin - wy.debut }, (_, i) => wy.debut + i + 1),
    });
  }));
  return { orientation, mmParCase: c, colonnes: fx.length, lignes: fy.length, pages };
}

/**
 * Échelle réduite : la salle entière sur UNE page, à la plus grande échelle possible (25 mm par case au plus,
 * au dixième de millimètre en dessous), dans l'orientation qui donne les plus grandes cases.
 * @returns {object} comme decouper(), plus `reduite` (vrai si l'échelle est inférieure à 25 mm)
 */
export function tenirSurUnePage(largeur, longueur) {
  const meilleureEchelle = (o) => {
    const ax = axe(o, 'x'), ay = axe(o, 'y');
    const s = Math.min((ax.dispo - ax.repere) / (largeur + 2 * EPAISSEUR_MUR), (ay.dispo - ay.repere) / (longueur + 2 * EPAISSEUR_MUR));
    return Math.min(CASE_MM, Math.floor(s * 10 + EPS) / 10);
  };
  const pref = orientationDe(largeur, longueur);
  const autre = pref === 'portrait' ? 'paysage' : 'portrait';
  const orientation = meilleureEchelle(autre) > meilleureEchelle(pref) ? autre : pref;
  let c = meilleureEchelle(orientation);
  let r = decouperDans(largeur, longueur, c, orientation);
  while (r.pages.length > 1 && c > 0.1) r = decouperDans(largeur, longueur, (c = arrondi(c - 0.1, 1)), orientation); // garde-fou d'arrondi
  return { ...r, reduite: c < CASE_MM };
}

/** Phrase à imprimer sur chaque page quand l'échelle est réduite ; vide à l'échelle réelle. */
export function messageEchelle(decoupage) {
  if (!decoupage.reduite) return '';
  const pct = Math.round((decoupage.mmParCase / CASE_MM) * 100);
  return `Échelle réduite : 1 case = ${virgule(decoupage.mmParCase)} mm au lieu de ${CASE_MM} mm (${pct} %). Les figurines ne tiendront plus forcément sur les cases.`;
}

/**
 * Taille des canvas d'une page, en pixels, pour une image de `largeurMm` × `hauteurMm` : environ 254 ppp,
 * réduite si le canvas devenait déraisonnable (plus de 4096 pixels de côté ou 12 millions de pixels).
 */
export function resolutionCanvas(largeurMm, hauteurMm, { ppp = PPP, maxCote = 4096, maxPixels = 12e6 } = {}) {
  const pxParMm = ppp / 25.4;
  const reduction = Math.min(1, maxCote / (Math.max(largeurMm, hauteurMm) * pxParMm), Math.sqrt(maxPixels / (largeurMm * hauteurMm * pxParMm * pxParMm)));
  return { ppp: arrondi(ppp * reduction, 1), pxParMm: pxParMm * reduction, largeur: Math.ceil(largeurMm * pxParMm * reduction), hauteur: Math.ceil(hauteurMm * pxParMm * reduction) };
}

// --- Contenu des salles --------------------------------------------------------------

/** « mur sud en D » : le mur et la case de la porte, comme dans la description d'une salle. */
export const libellePorte = (mur, position) => `mur ${mur} en ${mur === 'nord' || mur === 'sud' ? lettreColonne(position) : position + 1}`;

const copie = (v) => JSON.parse(JSON.stringify(v));
const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const NOM_CAMP = { pj: 'personnage', pnj: 'PNJ', monstre: 'monstre' };

/** Secrets du plan, en phrases (feuille du MJ). */
export function secretsDuPlan(plan) {
  return [
    ...(plan.portes || []).filter((p) => p.cache).map((p) => `Porte secrète au ${libellePorte(p.mur, p.position)}`),
    ...(plan.objets || []).filter((o) => o.cache).map((o) => `${majuscule(nomAffiche(o.type))} caché en ${nomCase(o.x, o.y)}`),
    ...(plan.creatures || []).filter((k) => k.cache).map((k) => `${majuscule(nomAffiche(k.type))} ${k.numero} caché en ${nomCase(k.x, k.y)} (${NOM_CAMP[k.camp] || k.camp})`),
  ];
}

/** Liaisons d'une salle : [{ porte, vers: {numero, nom, imprimee}|null, orpheline }], dans l'ordre du mur et de la position. */
function liaisonsDeSalle(donjon, idSalle, numeros, imprimees) {
  const plan = donjon.salles[idSalle].plan;
  const res = [];
  for (const l of donjon.liaisons || []) {
    const ici = l.a.salle === idSalle ? l.a : l.b.salle === idSalle ? l.b : null;
    if (!ici) continue;
    const autre = ici === l.a ? l.b : l.a;
    const s = donjon.salles[autre.salle];
    res.push({
      mur: ici.mur, position: ici.position,
      porte: libellePorte(ici.mur, ici.position),
      vers: s ? { numero: numeros[autre.salle], nom: s.nom, imprimee: imprimees.has(autre.salle), porte: libellePorte(autre.mur, autre.position) } : null,
      orpheline: !plan.portes.some((p) => p.mur === ici.mur && p.position === ici.position),
    });
  }
  return res.sort((a, b) => a.mur.localeCompare(b.mur) || a.position - b.position);
}

/**
 * Prépare l'impression d'un donjon, sans le modifier.
 * @param {object} donjon  donjon validé (voir donjon.js)
 * @param {{salles?:string[], version?:'mj'|'joueurs', pions?:boolean, monstres?:boolean, echelle?:'exacte'|'page'}} options
 *   salles   identifiants des salles à imprimer (par défaut : toutes) ; l'ordre est celui du donjon
 *   version  « joueurs » par défaut (la plus prudente)
 *   pions    inclure les pions ; en version joueurs, seuls les personnages (camp pj) sont imprimés…
 *   monstres …sauf si `monstres` est vrai (alors aussi les PNJ et les monstres) ; sans effet pour la version MJ
 *   echelle  « exacte » : 25 mm par case, sur autant de pages que nécessaire ; « page » : salle entière sur une page
 * @returns {{version:string, echelle:string, nomDonjon?:string, salles:object[], totalPages:number, avertissements:string[]}}
 *   Version joueurs : chaque salle = { numero, plan, decoupage } et rien d'autre (aucun nom, note ni liaison).
 *   Version MJ : en plus nom, notes, liaisons, secrets et marques (portes reliées, pour le dessin).
 */
export function preparerImpression(donjon, { salles, version = 'joueurs', pions = true, monstres = false, echelle = 'exacte' } = {}) {
  if (!VERSIONS.includes(version)) throw new Error(`version inconnue : ${version}`);
  const toutes = Object.values(donjon?.salles || {});
  const numeros = Object.fromEntries(toutes.map((s, i) => [s.id, i + 1]));
  const choisies = toutes.filter((s) => !salles || salles.includes(s.id));
  const imprimees = new Set(choisies.map((s) => s.id));
  const avertissements = [];
  if (!toutes.length) avertissements.push('Ce donjon ne contient aucune salle.');
  else if (!choisies.length) avertissements.push('Aucune salle n’est cochée : rien à imprimer.');

  const resultat = choisies.map((salle) => {
    const p = salle.plan;
    const decoupage = echelle === 'page' ? tenirSurUnePage(p.largeur, p.longueur) : decouper(p.largeur, p.longueur);
    if (version === 'joueurs') {
      const plan = planPublic(p, { garder: (k) => pions && (k.camp === 'pj' || monstres), avecEtat: false });
      return { numero: numeros[salle.id], plan, decoupage };
    }
    const plan = copie(p);
    plan.nom = salle.nom;
    if (!pions) plan.creatures = [];
    const liaisons = liaisonsDeSalle(donjon, salle.id, numeros, imprimees);
    return {
      id: salle.id, numero: numeros[salle.id], nom: salle.nom, notes: salle.notes || '',
      plan, decoupage, liaisons, secrets: secretsDuPlan(plan),
      marques: { portesReliees: liaisons.filter((l) => l.vers && !l.orpheline).map((l) => ({ mur: l.mur, position: l.position, vers: l.vers.numero })) },
    };
  });
  return {
    version, echelle, ...(version === 'mj' ? { nomDonjon: donjon.nom } : {}),
    salles: resultat,
    totalPages: resultat.reduce((n, s) => n + s.decoupage.pages.length, 0),
    avertissements,
  };
}
