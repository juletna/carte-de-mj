/**
 * Tests de l'impression (impression.js, planPublic de vue-publique.js, thème papier, fenêtre du moteur).
 * Sans dépendance : marche sous Node et dans tests.html. Chaque test lève une Error au premier écart ;
 * executer() renvoie la même forme que les autres.
 */
import { lettreColonne, indexColonne } from '../js/coordonnees.js';
import * as m from '../js/donjon.js';
import * as imp from '../js/impression.js';
import { vueTable, planPublic } from '../js/presentation.js';
import { dessinerFenetre } from '../js/rendu/moteur.js';
import * as papier from '../js/rendu/themes/papier.js';
import { CREATURES } from '../js/catalogue.js';
import { aPortrait } from '../js/rendu/portraits.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const proche = (a, b, eps = 0.011) => Math.abs(a - b) <= eps;
function geler(v) { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(geler); } return v; }

const { ZONE, ENTETE_MM, PIED_MM, REPERE_COLONNES_MM, REPERE_LIGNES_MM, RACCORD_MM } = imp;

/** Vérifie les invariants d'un découpage de `l` × `h` cases. */
function verifierDecoupage(l, h, d, quoi) {
  const { pages, colonnes, lignes, mmParCase: c } = d;
  egal(pages.length, colonnes * lignes, `${quoi} : nombre de pages`);
  const couvert = Array.from({ length: l }, () => new Array(h).fill(0));
  for (const p of pages) {
    const f = p.fenetre;
    for (const v of [f.x0, f.y0, f.x1, f.y1]) verifier(Number.isInteger(v), `${quoi} : fenêtre non entière`);
    verifier(f.x0 >= 0 && f.y0 >= 0 && f.x1 <= l && f.y1 <= h && f.x1 > f.x0 && f.y1 > f.y0, `${quoi} : fenêtre hors de la salle ${JSON.stringify(f)}`);
    if (pages.length > 1 && (colonnes > 1 || lignes > 1)) {
      if (colonnes > 1) verifier(f.x1 - f.x0 >= 2, `${quoi} : fenêtre d'une seule colonne dans un assemblage`);
      if (lignes > 1) verifier(f.y1 - f.y0 >= 2, `${quoi} : fenêtre d'une seule rangée dans un assemblage`);
    }
    for (let x = f.x0; x < f.x1; x++) for (let y = f.y0; y < f.y1; y++) couvert[x][y]++;
    // Taille en mm : cases entières, à l'échelle.
    verifier(proche(p.grille.l, (f.x1 - f.x0) * c) && proche(p.grille.h, (f.y1 - f.y0) * c), `${quoi} : grille pas à l'échelle`);
    // Tout tient dans la zone imprimable, entre l'en-tête et le pied, avec les repères et la bande de raccord.
    const z = ZONE[d.orientation];
    const mur = 0.32 * c;
    const gauche = p.bords.ouest ? mur : 0, haut = p.bords.nord ? mur : 0;
    verifier(p.grille.x - gauche - REPERE_LIGNES_MM >= -0.011, `${quoi} : déborde à gauche`);
    verifier(p.grille.x + p.grille.l + (p.bords.est ? mur : RACCORD_MM) <= z.l + 0.011, `${quoi} : déborde à droite (${p.grille.x + p.grille.l})`);
    verifier(p.grille.y - haut - REPERE_COLONNES_MM >= ENTETE_MM - 0.011, `${quoi} : empiète sur l'en-tête`);
    verifier(p.grille.y + p.grille.h + (p.bords.sud ? mur : RACCORD_MM) <= z.h - PIED_MM + 0.011, `${quoi} : empiète sur le pied`);
    // Repères corrects pour la partie imprimée.
    egal(p.numeros, Array.from({ length: f.y1 - f.y0 }, (_, i) => f.y0 + i + 1), `${quoi} : numéros de lignes`);
    egal(p.lettres.length, f.x1 - f.x0, `${quoi} : lettres`);
    verifier(p.lettres[0] === imp.libellePorte('nord', f.x0).slice(-p.lettres[0].length), `${quoi} : première lettre`);
  }
  for (let x = 0; x < l; x++) for (let y = 0; y < h; y++) verifier(couvert[x][y] >= 1, `${quoi} : la case ${x},${y} n'est sur aucune page`);
  // Recouvrement : exactement une rangée entre deux pages voisines, et seulement là.
  for (const p of pages) {
    if (p.voisins.est) { const q = pages[p.voisins.est - 1]; egal(q.fenetre.x0, p.fenetre.x1 - imp.RECOUVREMENT, `${quoi} : recouvrement est`); egal([q.fenetre.y0, q.fenetre.y1], [p.fenetre.y0, p.fenetre.y1], `${quoi} : voisines alignées`); }
    if (p.voisins.sud) { const q = pages[p.voisins.sud - 1]; egal(q.fenetre.y0, p.fenetre.y1 - imp.RECOUVREMENT, `${quoi} : recouvrement sud`); egal([q.fenetre.x0, q.fenetre.x1], [p.fenetre.x0, p.fenetre.x1], `${quoi} : voisines alignées`); }
    egal(p.bords.est, p.fenetre.x1 === l, `${quoi} : bord est`);
    egal(p.bords.sud, p.fenetre.y1 === h, `${quoi} : bord sud`);
    egal(p.bords.ouest, p.fenetre.x0 === 0, `${quoi} : bord ouest`);
    egal(p.bords.nord, p.fenetre.y0 === 0, `${quoi} : bord nord`);
  }
  pages.forEach((p, i) => { egal(p.numero, i + 1, `${quoi} : numéro`); egal(p.total, pages.length, `${quoi} : total`); });
}

// --- Donjon d'essai avec des valeurs sentinelles ---------------------------------------

const NOM_DONJON = 'SENTINELLE-NOM-DONJON', NOM_A = 'SENTINELLE-NOM-SALLE-A', NOM_B = 'SENTINELLE-NOM-SALLE-B';
const NOTES = 'SENTINELLE-NOTES-PREPARATION';
function donjonSentinelles() {
  const d = m.creerDonjon({
    nom: NOM_DONJON,
    texte: 'Salle de 8 par 8 cases, une porte au mur est en 3, une porte secrète au mur nord en B, un coffre caché en D4, un pilier en E5, deux personnages en B7 C7, un gobelin en F2, un gobelin caché en F6, un roi en G7.',
  });
  const a = d.salles[d.salleActive];
  const b = m.ajouterSalle(d, { nom: NOM_B, texte: 'Salle de 6 par 6 cases, une porte au mur ouest en 3, un coffre en A1.' });
  m.renommerSalle(d, a.id, NOM_A);
  a.notes = NOTES;
  b.notes = `${NOTES}-B`;
  m.relier(d, { salle: a.id, mur: 'est', position: 2 }, { salle: b.id, mur: 'ouest', position: 2 });
  d.liaisons[0].id = 'SENTINELLE-ID-LIAISON';
  // Identifiants reconnaissables sur ce qui est caché.
  for (const p of a.plan.portes) if (p.cache) p.id = 'SENTINELLE-ID-PORTE-SECRETE';
  for (const o of a.plan.objets) if (o.cache) o.id = 'SENTINELLE-ID-OBJET-CACHE';
  for (const k of a.plan.creatures) if (k.cache) k.id = 'SENTINELLE-ID-PION-CACHE';
  return { d, a, b };
}
const INTERDITS_JOUEURS = [NOM_DONJON, NOM_A, NOM_B, NOTES, 'SENTINELLE-ID', 'SENTINELLE', '"cache"', 'liaisons', 'notes', '"texte"', 'secr'];

const campsDe = (plan) => plan.creatures.map((k) => k.camp);

// --- Tests -----------------------------------------------------------------------------

const TESTS = [
  ['repères de colonnes : aller-retour sur les 60 colonnes permises, sans caractère hors des lettres', () => {
    for (let x = 0; x < 60; x++) {
      const nom = lettreColonne(x);
      verifier(/^[A-Z]{1,2}$/.test(nom), `colonne ${x} : « ${nom} »`);
      egal(indexColonne(nom), x, `aller-retour de « ${nom} »`);
    }
    egal([lettreColonne(25), lettreColonne(26), lettreColonne(51), lettreColonne(52)], ['Z', 'AA', 'AZ', 'BA'], 'bornes');
  }],

  ['découpage : invariants sur toutes les tailles de salle de 1 à 60 cases (échelle réelle)', () => {
    for (let l = 1; l <= 60; l += l < 20 ? 1 : 3) for (let h = 1; h <= 60; h += h < 20 ? 1 : 3) {
      const d = imp.decouper(l, h);
      verifierDecoupage(l, h, d, `${l}×${h}`);
      // L'orientation choisie ne donne jamais plus de pages que l'autre.
      const autre = imp.decouper(l, h, { orientation: d.orientation === 'portrait' ? 'paysage' : 'portrait' });
      verifier(d.pages.length <= autre.pages.length, `${l}×${h} : ${d.orientation} a ${d.pages.length} pages, l'autre ${autre.pages.length}`);
    }
  }],
  ['découpage : une salle qui tient sur une page n’est pas découpée', () => {
    for (const [l, h] of [[1, 1], [5, 5], [6, 9], [9, 5], [10, 5]]) {
      const d = imp.decouper(l, h);
      egal(d.pages.length, 1, `${l}×${h} : pages`);
      egal(d.pages[0].fenetre, { x0: 0, y0: 0, x1: l, y1: h }, `${l}×${h} : fenêtre`);
      verifier(Object.values(d.pages[0].bords).every(Boolean), 'une page unique a tous ses murs');
      verifier(Object.values(d.pages[0].voisins).every((v) => v === null), 'une page unique n’a pas de voisine');
    }
  }],
  ['découpage : une salle de 8 × 8 cases à 25 mm demande plusieurs pages, avec une rangée de recouvrement', () => {
    const d = imp.decouper(8, 8);
    verifier(d.pages.length > 1, 'plusieurs pages attendues');
    verifierDecoupage(8, 8, d, '8×8');
    const [p1, p2] = d.pages;
    egal(p1.fenetre.x1 - p2.fenetre.x0, imp.RECOUVREMENT, 'recouvrement');
  }],
  ['découpage : l’orientation donne le moins de pages', () => {
    egal(imp.decouper(30, 5).orientation, 'paysage', 'salle large');
    egal(imp.decouper(6, 30).orientation, 'portrait', 'salle haute');
    egal(imp.decouper(30, 7).orientation, 'portrait', 'le choix suit le nombre de pages, pas la forme de la salle');
    egal(imp.decouper(10, 5).orientation, 'paysage', 'salle large qui tient sur une page paysage');
    // 10 × 5 : une page en paysage, deux en portrait.
    egal(imp.decouper(10, 5, { orientation: 'paysage' }).pages.length, 1, '10×5 paysage');
    egal(imp.decouper(10, 5, { orientation: 'portrait' }).pages.length, 2, '10×5 portrait');
  }],
  ['découpage : chaque page se remplit, seule la dernière garde le reste', () => {
    egal(imp.decouper(8, 6).pages.length, 1, '8×6 tient sur une page paysage');
    const d = imp.decouper(8, 10);
    egal(d.pages.map((p) => p.fenetre.y1 - p.fenetre.y0), [6, 5], '8×10 : première page pleine');
    for (const p of d.pages) verifier(p.image.y + p.image.h + (p.bords.sud ? 0 : imp.RACCORD_MM) <= imp.ZONE.paysage.h - imp.PIED_MM + 1e-6, `page ${p.numero} : la grille ne touche pas le pied`);
  }],
  ['découpage : repères A1… corrects pour la partie imprimée, positions dans l’assemblage', () => {
    const d = imp.decouper(12, 12);
    const noms = d.pages.map((p) => `${p.numero}/${p.total}:${p.colonne}.${p.ligne}`);
    egal(noms, ['1/6:1.1', '2/6:2.1', '3/6:3.1', '4/6:1.2', '5/6:2.2', '6/6:3.2'], 'positions');
    const p2 = d.pages[1];
    egal(p2.lettres, Array.from({ length: p2.fenetre.x1 - p2.fenetre.x0 }, (_, i) => String.fromCharCode(65 + p2.fenetre.x0 + i)), 'lettres de la page 2');
    verifier(p2.lettres[0] !== 'A', 'la page 2 ne repart pas de A');
    const p4 = d.pages[3];
    egal(p4.numeros[0], p4.fenetre.y0 + 1, 'premier numéro de la page 4');
    egal(p2.voisins, { nord: null, sud: 5, ouest: 1, est: 3 }, 'voisines de la page 2');
    // Au-delà de Z : AA, AB…
    const grande = imp.decouper(30, 3, { orientation: 'paysage' });
    verifier(grande.pages.flatMap((p) => p.lettres).includes('AA'), 'colonne AA');
  }],
  ['découpage : une salle plus grande que tout (60 × 60) est entièrement couverte, sans page absurde', () => {
    const d = imp.decouper(60, 60);
    verifierDecoupage(60, 60, d, '60×60');
    verifier(d.pages.length >= 40 && d.pages.length <= 100, `nombre de pages déraisonnable : ${d.pages.length}`);
  }],
  ['échelle : « tenir sur une page » donne toujours une seule page, la plus grande échelle possible', () => {
    for (let l = 1; l <= 60; l += l < 20 ? 1 : 4) for (let h = 1; h <= 60; h += h < 20 ? 1 : 4) {
      const r = imp.tenirSurUnePage(l, h);
      egal(r.pages.length, 1, `${l}×${h} : pages`);
      verifier(r.mmParCase <= imp.CASE_MM && r.mmParCase > 0, `${l}×${h} : échelle ${r.mmParCase}`);
      verifierDecoupage(l, h, r, `${l}×${h} réduite`);
      egal(r.reduite, r.mmParCase < imp.CASE_MM, `${l}×${h} : indicateur réduite`);
      if (r.reduite) {
        // Un dixième de millimètre de plus ne tiendrait plus sur une page, ni dans cette orientation.
        const plus = (() => { try { return imp.decouper(l, h, { mmParCase: Math.round((r.mmParCase + 0.1) * 10) / 10, orientation: r.orientation }).pages.length; } catch { return 2; } })();
        verifier(plus > 1, `${l}×${h} : ${r.mmParCase} mm n'est pas le maximum`);
      }
    }
    egal(imp.tenirSurUnePage(5, 5).reduite, false, 'une petite salle garde 25 mm');
    egal(imp.tenirSurUnePage(5, 5).mmParCase, 25, 'une petite salle garde 25 mm');
    verifier(imp.tenirSurUnePage(20, 20).reduite, '20×20 est réduite');
  }],
  ['échelle : le message de réduction est clair, et vide à l’échelle réelle', () => {
    egal(imp.messageEchelle(imp.decouper(5, 5)), '', 'échelle réelle');
    const msg = imp.messageEchelle(imp.tenirSurUnePage(12, 12));
    verifier(/Échelle réduite : 1 case = \d+(,\d)? mm au lieu de 25 mm \(\d+ %\)/.test(msg), `message : ${msg}`);
    verifier(msg.includes('figurines ne tiendront plus forcément'), 'mention des figurines');
  }],
  ['échelle : une échelle absurde est refusée avec une erreur, pas une boucle infinie', () => {
    let erreur = null;
    try { imp.decouper(5, 5, { mmParCase: 200 }); } catch (e) { erreur = e; }
    verifier(erreur && /trop grande/.test(erreur.message), 'erreur attendue');
  }],
  ['canvas : environ 254 ppp, jamais déraisonnable', () => {
    const r = imp.resolutionCanvas(190, 277);
    verifier(r.ppp >= 200 && r.ppp <= 300, `ppp ${r.ppp}`);
    verifier(r.largeur <= 4096 && r.hauteur <= 4096, 'côté <= 4096');
    const g = imp.resolutionCanvas(2000, 2000);
    verifier(g.largeur <= 4096 && g.hauteur <= 4096 && g.largeur * g.hauteur <= 12.1e6, `canvas géant non borné : ${g.largeur}×${g.hauteur}`);
    const z = imp.preparerImpression(donjonSentinelles().d, { version: 'mj' });
    for (const s of z.salles) for (const p of s.decoupage.pages) {
      const q = imp.resolutionCanvas(p.image.l, p.image.h);
      verifier(q.ppp >= 200 && q.ppp <= 300, 'résolution d’une vraie page');
    }
  }],
  ['joueurs : aucune trace des secrets, des notes, des liaisons ni des noms', () => {
    const { d } = donjonSentinelles();
    const prep = imp.preparerImpression(d, { version: 'joueurs', monstres: true });
    const json = JSON.stringify(prep);
    for (const interdit of INTERDITS_JOUEURS) verifier(!json.includes(interdit), `« ${interdit} » trouvé dans la version joueurs`);
    egal(prep.salles.length, 2, 'salles');
    const plan = prep.salles[0].plan;
    egal(plan.portes.length, 1, 'la porte secrète est absente');
    verifier(plan.objets.every((o) => o.type !== 'coffre'), 'le coffre caché est absent');
    egal(plan.creatures.length, 4, 'gobelin caché absent (2 pj + gobelin + roi)');
    egal(plan.nom, '', 'nom de salle vide');
    for (const s of prep.salles) egal(Object.keys(s).sort(), ['decoupage', 'numero', 'plan'], 'seuls ces champs sortent');
    verifier(!('nomDonjon' in prep), 'pas de nom de donjon');
    // Chaque élément n'a que les champs de la liste blanche.
    for (const o of plan.objets) egal(Object.keys(o).sort(), ['h', 'id', 'l', 'rotation', 'type', 'x', 'y'], 'champs d’un objet');
    for (const k of plan.creatures) verifier(!('etat' in k) && !('cache' in k), 'pas d’état ni de cache sur un pion');
  }],
  ['joueurs : l’état blessé / mort d’un pion n’est pas imprimé', () => {
    const { d, a } = donjonSentinelles();
    a.plan.creatures.find((k) => k.camp === 'pj').etat = 'mort';
    const prep = imp.preparerImpression(d, { version: 'joueurs' });
    verifier(!JSON.stringify(prep).includes('mort'), 'état imprimé');
  }],
  ['joueurs : monstres et PNJ exclus par défaut, personnages conservés ; case à cocher pour les inclure', () => {
    const { d } = donjonSentinelles();
    egal(campsDe(imp.preparerImpression(d, {}).salles[0].plan), ['pj', 'pj'], 'par défaut');
    egal(campsDe(imp.preparerImpression(d, { version: 'joueurs', pions: true, monstres: false }).salles[0].plan), ['pj', 'pj'], 'monstres décochés');
    const avec = campsDe(imp.preparerImpression(d, { version: 'joueurs', monstres: true }).salles[0].plan);
    egal(avec.filter((c) => c === 'monstre').length, 1, 'un seul monstre visible (l’autre est caché)');
    verifier(avec.includes('pnj') && avec.filter((c) => c === 'pj').length === 2, 'PNJ et personnages avec la case cochée');
    egal(imp.preparerImpression(d, { version: 'joueurs', pions: false, monstres: true }).salles[0].plan.creatures, [], 'sans pions : aucun pion, même avec monstres');
    egal(imp.preparerImpression(d, { version: 'mj', pions: false }).salles[0].plan.creatures, [], 'sans pions en version MJ');
  }],
  ['MJ : tout est là, secrets compris et signalés, avec nom, notes et liaisons', () => {
    const { d, a, b } = donjonSentinelles();
    const prep = imp.preparerImpression(d, { version: 'mj', monstres: false });
    const s = prep.salles[0];
    egal(s.nom, NOM_A, 'nom'); egal(s.notes, NOTES, 'notes');
    egal(prep.nomDonjon, NOM_DONJON, 'nom du donjon');
    egal(s.plan.portes.length, a.plan.portes.length, 'toutes les portes');
    egal(s.plan.creatures.length, a.plan.creatures.length, 'tous les pions, monstres compris');
    verifier(s.plan.portes.some((p) => p.cache) && s.plan.objets.some((o) => o.cache) && s.plan.creatures.some((k) => k.cache), 'secrets conservés (cache: true)');
    egal(s.secrets.length, 3, 'liste des secrets');
    verifier(s.secrets.some((t) => t.startsWith('Porte secrète au mur nord en B')), `secret porte : ${s.secrets}`);
    verifier(s.secrets.some((t) => t.startsWith('Coffre caché en D4')), `secret coffre : ${s.secrets}`);
    verifier(s.secrets.some((t) => /^Gobelin \d caché en F6/.test(t)), `secret gobelin : ${s.secrets}`);
    egal(s.liaisons.length, 1, 'liaison');
    egal(s.liaisons[0].porte, 'mur est en 3', 'porte');
    egal(s.liaisons[0].vers, { numero: 2, nom: NOM_B, imprimee: true, porte: 'mur ouest en 3' }, 'destination');
    egal(s.marques.portesReliees, [{ mur: 'est', position: 2, vers: 2 }], 'repère « → 2 » sur la carte');
    const t = prep.salles[1];
    egal(t.liaisons[0].vers.numero, 1, 'retour');
    // Salle d'arrivée non cochée : elle est nommée, et signalée comme non imprimée.
    const seule = imp.preparerImpression(d, { version: 'mj', salles: [a.id] }).salles[0];
    egal(seule.liaisons[0].vers.imprimee, false, 'salle non imprimée');
    egal(imp.preparerImpression(d, { version: 'mj', salles: [b.id] }).salles[0].numero, 2, 'la numérotation suit le donjon, pas la sélection');
  }],
  ['sélection : aucune salle, donjon vide, version inconnue', () => {
    const { d, a } = donjonSentinelles();
    const rien = imp.preparerImpression(d, { salles: [] });
    egal(rien.totalPages, 0, 'aucune page'); egal(rien.salles, [], 'aucune salle');
    verifier(/Aucune salle/.test(rien.avertissements[0]), `message : ${rien.avertissements}`);
    const vide = imp.preparerImpression({ ...d, salles: {}, liaisons: [] }, {});
    verifier(/aucune salle/.test(vide.avertissements[0]), `message : ${vide.avertissements}`);
    egal(imp.preparerImpression(d, { salles: [a.id, 'inconnue'] }).salles.length, 1, 'identifiant inconnu ignoré');
    let erreur = null;
    try { imp.preparerImpression(d, { version: 'autre' }); } catch (e) { erreur = e; }
    verifier(erreur, 'version inconnue refusée');
    egal(imp.preparerImpression(null, {}).avertissements.length, 1, 'donjon absent');
  }],
  ['le donjon n’est jamais modifié (donjon gelé, deux versions, toutes options)', () => {
    const { d } = donjonSentinelles();
    const avant = JSON.stringify(d);
    geler(d);
    for (const version of ['mj', 'joueurs']) for (const echelle of ['exacte', 'page']) for (const monstres of [true, false]) for (const pions of [true, false]) {
      imp.preparerImpression(d, { version, echelle, monstres, pions });
    }
    egal(JSON.stringify(d), avant, 'donjon après impression');
    // Le plan préparé ne partage rien avec le donjon : le modifier ne touche pas l'original.
    const dd = JSON.parse(avant);
    const prep = imp.preparerImpression(dd, { version: 'mj' });
    prep.salles[0].plan.portes.length = 0; prep.salles[0].plan.objets.push({ x: 0 });
    egal(JSON.stringify(dd), avant, 'pas d’alias en version MJ');
    const prepJ = imp.preparerImpression(dd, { version: 'joueurs' });
    prepJ.salles[0].plan.portes.length = 0;
    egal(JSON.stringify(dd), avant, 'pas d’alias en version joueurs');
  }],
  ['réduction proposée : une salle de 8 × 8 dépasse de 2 cases, 2 pages à 25 mm ; 21,2 mm (85 %) la ferait tenir sur une page', () => {
    const r = imp.proposerReduction(8, 8);
    egal(r, { pages: 2, depasse: 2, mmParCase: 21.2, pourcent: 85 }, '8×8');
    egal(imp.proposerReduction(7, 7), { pages: 2, depasse: 1, mmParCase: 24, pourcent: 96 }, '7×7 : une case de trop');
    // La proposition ne change rien : le découpage à 25 mm est celui d'avant, et la réduite tient bien sur une page.
    egal(imp.decouper(8, 8).pages.length, 2, '8×8 à 25 mm : toujours 2 pages');
    egal(imp.decouper(8, 8).mmParCase, 25, 'échelle réelle inchangée');
    const une = imp.tenirSurUnePage(8, 8);
    egal([une.pages.length, une.mmParCase, une.reduite], [1, 21.2, true], '8×8 réduite');
  }],
  ['réduction proposée : jamais pour une salle qui tient déjà, ni quand il faudrait trop réduire ; seuil de 80 %', () => {
    for (const [l, h] of [[1, 1], [5, 5], [6, 6], [6, 9], [10, 5]]) egal(imp.proposerReduction(l, h), null, `${l}×${h} tient déjà sur une page`);
    for (const [l, h] of [[9, 9], [12, 12], [30, 9], [6, 30]]) egal(imp.proposerReduction(l, h), null, `${l}×${h} : réduction trop forte`);
    for (let l = 1; l <= 40; l++) for (let h = 1; h <= 40; h++) {
      const r = imp.proposerReduction(l, h);
      const pages = imp.decouper(l, h).pages.length;
      if (pages < 2) { egal(r, null, `${l}×${h} : une page, rien à proposer`); continue; }
      if (!r) continue;
      egal(r.pages, pages, `${l}×${h} : pages à 25 mm`);
      verifier(r.pourcent >= imp.SEUIL_REDUCTION * 100 - 0.5 && r.mmParCase < imp.CASE_MM, `${l}×${h} : échelle proposée ${r.mmParCase}`);
      verifier(r.depasse >= 1, `${l}×${h} : au moins une case en trop`);
      egal(imp.tenirSurUnePage(l, h).pages.length, 1, `${l}×${h} : la réduction tient sur une page`);
    }
  }],
  ['réduction proposée : preparerImpression la signale à l’échelle réelle sans rien changer, et jamais en « page »', () => {
    const { d } = donjonSentinelles(); // 8 × 8 et 6 × 6
    const avant = JSON.stringify(d);
    const exacte = imp.preparerImpression(d, { version: 'mj' });
    egal(exacte.propositions, [{ numero: 1, pages: 2, depasse: 2, mmParCase: 21.2, pourcent: 85 }], 'propositions (salle 8 × 8 seule)');
    egal(exacte.salles[0].decoupage.mmParCase, 25, 'le défaut reste l’échelle réelle');
    egal(exacte.salles[0].decoupage.pages.length, 2, 'toujours 2 pages sans clic');
    egal(imp.preparerImpression(d, { version: 'joueurs', echelle: 'page' }).propositions, [], 'rien à proposer quand on tient déjà sur une page');
    egal(imp.preparerImpression(d, { version: 'joueurs', salles: [d.salleActive === Object.keys(d.salles)[0] ? Object.keys(d.salles)[1] : Object.keys(d.salles)[0]] }).propositions, [], 'salle de 6 × 6 : rien');
    // Version joueurs : aucun nom, aucune note dans les propositions.
    const j = JSON.stringify(imp.preparerImpression(d, { version: 'joueurs' }).propositions);
    for (const interdit of [NOM_DONJON, NOM_A, NOM_B, NOTES]) verifier(!j.includes(interdit), `fuite : ${interdit}`);
    egal(JSON.stringify(d), avant, 'donjon inchangé');
  }],
  ['phrases de la proposition : une salle, plusieurs salles, une partie seulement des salles cochées ; rien à proposer = null', () => {
    const une = { numero: 1, pages: 2, depasse: 2, mmParCase: 21.2, pourcent: 85 };
    const deux = { numero: 3, pages: 4, depasse: 1, mmParCase: 22.5, pourcent: 90 };
    egal(imp.phrasesProposition({ propositions: [], salles: [{}] }), null, 'rien à proposer');
    egal(imp.phrasesProposition({ salles: [{}] }), null, 'pas de liste');
    egal(imp.phrasesProposition({ propositions: [une], salles: [{}] }), {
      texte: 'Cette salle dépasse de 2 cases : 2 pages à 25 mm.',
      detail: 'En réduisant à 21,2 mm par case (85 % de 25 mm), elle tient sur une page. Les figurines risquent de ne plus tenir sur les cases. Rien ne change sans ton clic.',
    }, 'une salle');
    egal(imp.phrasesProposition({ propositions: [deux], salles: [{}, {}] }), {
      texte: 'Le plan 3 dépasse d’une case : 4 pages à 25 mm.',
      detail: 'En réduisant à 22,5 mm par case (90 % de 25 mm), elle tient sur une page. Les figurines risquent de ne plus tenir sur les cases. L’échelle réduite s’applique à toutes les salles cochées. Rien ne change sans ton clic.',
    }, 'deux salles dont une qui dépasse');
    egal(imp.phrasesProposition({ propositions: [une, deux], salles: [{}, {}] }), {
      texte: 'Le plan 1 dépasse de 2 cases : 2 pages à 25 mm ; Le plan 3 dépasse d’une case : 4 pages à 25 mm.',
      detail: 'En réduisant à 21,2 mm par case (85 % de 25 mm), elles tiennent sur une page. Les figurines risquent de ne plus tenir sur les cases. Rien ne change sans ton clic.',
    }, 'deux salles qui dépassent : la plus forte réduction');
  }],
  ['voisinesTexte et phrases de la feuille du MJ : texte exact', () => {
    egal(imp.voisinesTexte({ total: 4, voisins: { nord: 1, ouest: 3, est: null, sud: null } }), 'haut : page 1/4 · gauche : page 3/4', 'deux voisines');
    egal(imp.voisinesTexte({ total: 6, voisins: { nord: null, ouest: null, est: 2, sud: 4 } }), 'droite : page 2/6 · bas : page 4/6', 'est et sud');
    egal(imp.voisinesTexte({ total: 1, voisins: {} }), '', 'aucune voisine');
    const f = imp.phrasesFeuilleMJ;
    egal(f.introduction({ salles: [{}], totalPages: 1 }), '1 salle imprimée, 1 page de plan. Les plans portent le même numéro (« Plan 2 »). Les éléments secrets sont cernés de pointillés avec un « S » ; une porte reliée porte « → N » (numéro de la salle derrière).', 'introduction au singulier');
    verifier(f.introduction({ salles: [{}, {}, {}], totalPages: 5 }).startsWith('3 salles imprimées, 5 pages de plan. Les plans'), 'introduction au pluriel');
    egal(f.taille({ plan: { largeur: 7, longueur: 8 }, decoupage: { pages: [1], orientation: 'portrait', reduite: false } }), '7 × 8 cases, 1 page A4 portrait', 'une page');
    egal(f.taille({ plan: { largeur: 30, longueur: 9 }, decoupage: { pages: [1, 2], orientation: 'paysage', reduite: true, mmParCase: 19.2 } }), '30 × 9 cases, 2 pages A4 paysage, échelle réduite (1 case = 19,2 mm)', 'deux pages, réduite');
    egal(f.liaison({ porte: 'mur nord en C' }), 'Porte au mur nord en C → salle introuvable', 'liaison sans salle');
    egal(f.liaison({ porte: 'mur est en 6', vers: { numero: 4, nom: 'Cuisine', porte: 'mur ouest en 3', imprimee: true } }), 'Porte au mur est en 6 → Plan 4 « Cuisine » (porte au mur ouest en 3)', 'liaison normale');
    egal(f.liaison({ porte: 'mur est en 6', orpheline: true, vers: { numero: 4, nom: 'Cuisine', porte: 'mur ouest en 3', imprimee: false } }), 'Porte au mur est en 6 → Plan 4 « Cuisine » (porte au mur ouest en 3) · salle non imprimée · cette porte n’existe plus dans le plan', 'liaison orpheline, salle non imprimée');
  }],
  ['échelle réelle inchangée : 25 mm par case et règle de 5 cm', () => {
    egal([imp.CASE_MM, imp.REGLE_MM], [25, 50], 'constantes');
    const attendu = { '8x8': [2, 'portrait'], '12x12': [6, 'portrait'], '30x9': [6, 'portrait'], '6x6': [1, 'portrait'], '10x5': [1, 'paysage'] };
    for (const [cle, [pages, orientation]] of Object.entries(attendu)) {
      const [l, h] = cle.split('x').map(Number);
      const d = imp.decouper(l, h);
      egal([d.pages.length, d.orientation, d.mmParCase], [pages, orientation, 25], cle);
    }
  }],
  ['planPublic : la vue table en est inchangée (cachés non révélés exclus, révélés montrés, état conservé)', () => {
    const { d, a } = donjonSentinelles();
    const cache = a.plan.objets.find((o) => o.cache);
    a.plan.creatures.find((k) => k.camp === 'pj').etat = 'blesse';
    const p = { donjon: d, salleCourante: a.id, reveles: {}, decouvertes: [a.id] };
    const sans = vueTable(p);
    egal(sans, planPublic(a.plan), 'même résultat que planPublic par défaut');
    verifier(!sans.objets.some((o) => o.id === cache.id), 'objet caché absent');
    verifier(sans.creatures.some((k) => k.etat === 'blesse'), 'état conservé pour la table');
    const avec = vueTable({ ...p, reveles: { [a.id]: [cache.id] } });
    verifier(avec.objets.some((o) => o.id === cache.id), 'objet révélé montré');
    verifier(!JSON.stringify(avec).includes('cache'), 'aucun champ cache');
  }],
  ['portraits : tous les types de créatures ont le leur, sauf les personnages des joueurs', () => {
    for (const c of CREATURES) {
      if (c.type === 'pj') verifier(!aPortrait(c.type), 'pj garde P1, P2 : pas de portrait');
      else verifier(aPortrait(c.type), `portrait manquant : ${c.type}`);
    }
  }],
  ['rendu papier : le pion dessine le portrait, ou l\'abréviation quand il est très petit', () => {
    const textes = [];
    const ctx = new Proxy({}, { get: (c, nom) => (nom === 'fillText' ? (s) => textes.push(s) : nom === 'measureText' ? () => ({ width: 0 }) : () => {}), set: () => true });
    const pion = (type, camp, t) => { textes.length = 0; papier.pion(ctx, { type, camp, numero: 3, x: 0, y: 0, taille: 1 }, t); return [...textes]; };
    egal(pion('gobelin', 'monstre', 250), ['3'], 'portrait : seul le numéro est écrit');
    egal(pion('gobelin', 'monstre', 20), ['Gob', '3'], 'très petit : abréviation de repli');
    egal(pion('pj', 'pj', 250), ['P3'], 'joueur : P et son numéro, sans portrait');
  }],
  ['rendu papier : la fenêtre ne dessine que ses cases, sans erreur (canvas simulé)', () => {
    const { d, a } = donjonSentinelles();
    const appels = [];
    const ctx = new Proxy({}, {
      get: (_, nom) => (nom === 'canvas' ? null : (...args) => appels.push([nom, args])),
      set: () => true,
    });
    const canvas = { width: 0, height: 0, getContext: () => ctx };
    const prep = imp.preparerImpression(d, { version: 'mj', echelle: 'exacte' });
    const p = prep.salles[0].decoupage.pages[0];
    const r = dessinerFenetre(canvas, prep.salles[0].plan, { fenetre: p.fenetre, bords: p.bords, taille: 250, debord: 2, theme: papier, marques: prep.salles[0].marques });
    const mur = 0.32 * 250;
    const attendue = Math.round(((p.fenetre.x1 - p.fenetre.x0) + (p.bords.ouest ? 0.32 : 0) + (p.bords.est ? 0.32 : 0)) * 250) + 4;
    egal(canvas.width, attendue, 'largeur du canvas');
    egal(r.largeur, attendue, 'largeur renvoyée');
    verifier(mur > 0 && appels.length > 50, 'le thème papier a dessiné');
    verifier(appels.some(([nom]) => nom === 'setLineDash'), 'pointillés pour les secrets');
    // Un thème qui ne connaît pas `grille` garde la grille du moteur : dessiner() n'est pas modifiée.
    verifier(a.plan.largeur === 8, 'plan intact');
  }],
];

export const executer = () => executerSuite('impression : ', TESTS);
