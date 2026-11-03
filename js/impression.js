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
import { lettreColonne, nomCase, reperePorte } from './parseur/coordonnees.js';
import { nomAffiche } from './parseur/lexique.js';
import { EPAISSEUR_MUR } from './rendu/geometrie.js';
import { virgule, pluriel } from './format.js';

export const CASE_MM = 25;           // échelle par défaut : 25 mm par case (figurines de 25 mm)
export const MARGE_PAGE_MM = 10;     // marge de @page
export const FEUILLE = { portrait: { l: 210, h: 297 }, paysage: { l: 297, h: 210 } };
/** Zone imprimable : la feuille moins la marge de chaque côté. */
export const ZONE = {
  portrait: { l: FEUILLE.portrait.l - 2 * MARGE_PAGE_MM, h: FEUILLE.portrait.h - 2 * MARGE_PAGE_MM },
  paysage: { l: FEUILLE.paysage.l - 2 * MARGE_PAGE_MM, h: FEUILLE.paysage.h - 2 * MARGE_PAGE_MM },
};
/** Les pages dessinées sont un peu plus courtes que la zone imprimable : un arrondi du navigateur ne doit pas créer une page blanche. */
export const JEU_PAGE_MM = 0.5;
export const ENTETE_MM = 9;          // titre, position dans l'assemblage, échelle
export const PIED_MM = 10;           // règle de contrôle et consigne
export const REPERE_COLONNES_MM = 5; // lettres au-dessus de la grille
export const REPERE_LIGNES_MM = 6;   // numéros à gauche de la grille
export const RACCORD_MM = 4;         // bande de raccord, côtés est et sud d'une page qui a une voisine
export const RECOUVREMENT = 1;       // rangées de cases partagées entre deux pages voisines
export const REGLE_MM = 50;          // règle de contrôle : 5 cm exacts
export const PPP = 254;              // résolution des canvas : 10 pixels par mm (dans la plage 200–300 ppp)
export const MESSAGE_REGLE = 'Cette règle doit mesurer exactement 5 cm. Sinon, imprime à 100 % (échelle « Réelle »), sans « Ajuster à la page ».';
export const VERSIONS = ['mj', 'joueurs'];

/**
 * Les mesures que la feuille de style de l'impression reprend (custom properties posées sur <html> au démarrage), pour que
 * le dessin des pages et le découpage en cases parlent des mêmes millimètres. `@page` ne peut pas lire de variable :
 * sa marge et son format sont gardés dans css/impression.css, et tests/mesures-impression.test.js vérifie qu'ils concordent avec les constantes.
 */
export function variablesCss() {
  const mm = (v) => `${v}mm`;
  return {
    '--marge-page': mm(MARGE_PAGE_MM),
    '--page-portrait-l': mm(ZONE.portrait.l), '--page-portrait-h': mm(ZONE.portrait.h - JEU_PAGE_MM),
    '--page-paysage-l': mm(ZONE.paysage.l), '--page-paysage-h': mm(ZONE.paysage.h - JEU_PAGE_MM),
    '--entete': mm(ENTETE_MM), '--repere-colonnes': mm(REPERE_COLONNES_MM), '--repere-lignes': mm(REPERE_LIGNES_MM),
    '--regle': mm(REGLE_MM),
  };
}

const EPS = 1e-9;
const arrondi = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;
const entierBas = (v) => Math.floor(v + EPS);
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
 * Le nombre de pages est le plus petit possible. Chaque page se remplit au maximum ; la place restante va à la dernière
 * (aucune n'a moins de 2 cases).
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
  for (let i = k - 1; i >= 0 && exces > 0; i--) { // on retire depuis la fin : les premières pages restent pleines
    const retrait = Math.min(exces, tailles[i] - 2);
    tailles[i] -= retrait; exces -= retrait;
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

/** En dessous de ce rapport (échelle réduite / 25 mm), on ne propose plus de réduire : les figurines n'y tiendraient plus. */
export const SEUIL_REDUCTION = 0.8;

/**
 * Cases qui manquent pour tenir sur UNE page à `c` mm par case, dans l'orientation la plus favorable (au moins 1).
 * Même capacité que decouperAxe() pour une page seule : un mur de chaque côté, plus les repères.
 */
function casesEnTrop(largeur, longueur, c = CASE_MM) {
  const mur = EPAISSEUR_MUR * c;
  const exces = (o) => {
    const ax = axe(o, 'x'), ay = axe(o, 'y');
    return Math.max(largeur - entierBas((ax.dispo - ax.repere - 2 * mur) / c), longueur - entierBas((ay.dispo - ay.repere - 2 * mur) / c));
  };
  return Math.max(1, Math.min(exces('portrait'), exces('paysage')));
}

/**
 * Une salle qui n'a besoin que d'un peu moins de place pour tenir sur une page ? À l'échelle réelle elle prend plusieurs
 * pages ; si une échelle d'au moins 80 % de 25 mm la fait tenir sur une seule, on le propose (jamais d'office : l'échelle
 * réelle reste le défaut). Ne change rien au découpage ni à l'échelle : lecture seule.
 * @returns {{pages:number, depasse:number, mmParCase:number, pourcent:number}|null}
 *   pages : pages à 25 mm ; depasse : cases en trop pour une page ; mmParCase : échelle réduite qui suffit ; pourcent : par rapport à 25 mm
 */
export function proposerReduction(largeur, longueur) {
  const exacte = decouper(largeur, longueur);
  if (exacte.pages.length < 2) return null;
  const une = tenirSurUnePage(largeur, longueur);
  const rapport = une.mmParCase / CASE_MM;
  if (une.pages.length !== 1 || rapport < SEUIL_REDUCTION) return null;
  return { pages: exacte.pages.length, depasse: casesEnTrop(largeur, longueur), mmParCase: une.mmParCase, pourcent: Math.round(rapport * 100) };
}

/** Phrase à imprimer sur chaque page quand l'échelle est réduite ; vide à l'échelle réelle. */
export function messageEchelle(decoupage) {
  if (!decoupage.reduite) return '';
  const pct = Math.round((decoupage.mmParCase / CASE_MM) * 100);
  return `Échelle réduite : 1 case = ${virgule(decoupage.mmParCase)} mm au lieu de ${CASE_MM} mm (${pct} %). Les figurines ne tiendront plus forcément sur les cases.`;
}

/** Texte des pages voisines d'une page de l'assemblage : « haut : page 1/4 · gauche : page 3/4 ». */
export function voisinesTexte(p) {
  const v = [['haut', p.voisins.nord], ['gauche', p.voisins.ouest], ['droite', p.voisins.est], ['bas', p.voisins.sud]].filter(([, n]) => n);
  return v.map(([cote, n]) => `${cote} : page ${n}/${p.total}`).join(' · ');
}

/**
 * Phrases de la proposition de réduire l'échelle (voir `proposerReduction`), à partir du résultat de `preparerImpression` :
 * `texte` dit de combien chaque salle dépasse ; `detail` dit ce que la réduction donne. Le texte ne cite que « Plan N » et des nombres.
 * @returns {{texte:string, detail:string}|null} null quand il n'y a rien à proposer
 */
export function phrasesProposition(prep) {
  const liste = prep.propositions || [];
  if (!liste.length) return null;
  const cases = (n) => (n > 1 ? `${n} cases` : 'une case');
  const phrase = (p) => `${p.depasse > 1 ? `de ${cases(p.depasse)}` : 'd’une case'} : ${pluriel(p.pages, 'page', 'pages')} à ${CASE_MM} mm`;
  const texte = liste.length === 1 && prep.salles.length === 1
    ? `Cette salle dépasse ${phrase(liste[0])}.`
    : liste.map((p) => `Le plan ${p.numero} dépasse ${phrase(p)}`).join(' ; ') + '.';
  const plusFort = Math.min(...liste.map((p) => p.mmParCase));
  const pourcent = Math.min(...liste.map((p) => p.pourcent));
  const autres = prep.salles.length > liste.length ? ' L’échelle réduite s’applique à toutes les salles cochées.' : '';
  const detail = `En réduisant à ${virgule(plusFort)} mm par case (${pourcent} % de ${CASE_MM} mm), ${liste.length > 1 ? 'elles tiennent' : 'elle tient'} sur une page. `
    + `Les figurines risquent de ne plus tenir sur les cases.${autres} Rien ne change sans ton clic.`;
  return { texte, detail };
}

/** Phrases de la feuille du MJ : l'introduction, la taille d'une salle et chacune de ses liaisons. */
export const phrasesFeuilleMJ = {
  introduction: (prep) => `${pluriel(prep.salles.length, 'salle imprimée', 'salles imprimées')}, ${pluriel(prep.totalPages, 'page de plan', 'pages de plan')}. Les plans portent le même numéro (« Plan 2 »). Les éléments secrets sont cernés de pointillés avec un « S » ; une porte reliée porte « → N » (numéro de la salle derrière).`,
  taille: (s) => {
    const d = s.decoupage;
    return `${s.plan.largeur} × ${s.plan.longueur} cases, ${pluriel(d.pages.length, 'page', 'pages')} A4 ${d.orientation === 'portrait' ? 'portrait' : 'paysage'}${d.reduite ? `, échelle réduite (1 case = ${virgule(d.mmParCase)} mm)` : ''}`;
  },
  liaison: (l) => (!l.vers
    ? `Porte au ${l.porte} → salle introuvable`
    : `Porte au ${l.porte} → Plan ${l.vers.numero} « ${l.vers.nom} » (porte au ${l.vers.porte})${l.vers.imprimee ? '' : ' · salle non imprimée'}${l.orpheline ? ' · cette porte n’existe plus dans le plan' : ''}`),
};

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
export const libellePorte = (mur, position) => `mur ${mur} en ${reperePorte(mur, position)}`;

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
 * @returns {{version:string, echelle:string, nomDonjon?:string, salles:object[], totalPages:number, avertissements:string[], propositions:object[]}}
 *   propositions : à l'échelle réelle, les salles qui tiendraient sur une page en réduisant un peu l'échelle
 *   ({ numero, pages, depasse, mmParCase, pourcent }, voir proposerReduction) ; vide en « page ». Jamais appliquées d'office.
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
  const propositions = echelle === 'page' ? [] : choisies.flatMap((s) => {
    const r = proposerReduction(s.plan.largeur, s.plan.longueur);
    return r ? [{ numero: numeros[s.id], ...r }] : [];
  });
  return {
    version, echelle, ...(version === 'mj' ? { nomDonjon: donjon.nom } : {}),
    salles: resultat,
    totalPages: resultat.reduce((n, s) => n + s.decoupage.pages.length, 0),
    avertissements,
    propositions,
  };
}
