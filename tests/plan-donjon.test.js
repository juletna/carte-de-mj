/**
 * Tests du plan du donjon (js/plan-donjon.js) : positions à la vraie taille, portes qui se font face, aucun
 * chevauchement, salles non reliées à part, liaison orpheline, résultat stable, donjon jamais modifié.
 * Sans dépendance : marche sous Node et dans tests.html (même forme que les autres tests : { phrase, ecarts }).
 */
import * as m from '../js/donjon.js';
import { disposerPlan, cheminCouloir, salleSous, ECART_LIAISON, ECART_MIN, ECART_PASSAGE, ETIQUETTE_ISOLEES } from '../js/plan-donjon.js';
import { salleVoisine, disposerSalles } from '../js/minicarte.js';

function verifier(condition, message) { if (!condition) throw new Error(message); }
function egal(obtenu, attendu, quoi) {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  if (a !== b) throw new Error(`${quoi} : attendu ${b}, obtenu ${a}`);
}

const LETTRES = 'ABCDEFGH';
/** Texte d'une salle l x h avec les portes demandées : [['est', 2], ['nord', 0]] (position à partir de 0). */
function texteSalle(l, h, portes = []) {
  const reperes = (mur, pos) => (mur === 'nord' || mur === 'sud' ? LETTRES[pos] : String(pos + 1));
  return `Salle de ${l} par ${h} cases${portes.map(([mur, pos]) => `, une porte au mur ${mur} en ${reperes(mur, pos)}`).join('')}.`;
}
/** Ajoute une salle au donjon (la première remplace la salle vide du départ). */
function salle(d, nom, l, h, portes) {
  const s = m.ajouterSalle(d, { nom, texte: texteSalle(l, h, portes) });
  return s.id;
}
function donjonVide() {
  const d = m.creerDonjon({ nom: 'Plan', texte: texteSalle(6, 6) });
  return d;
}
const porte = (id, mur, position) => ({ salle: id, mur, position });

/** Vérifie qu'aucune paire de salles ne se touche (au moins ECART_MIN case entre deux), et que tout tient dans le plan. */
function sansChevauchement(disp, d, quoi) {
  const ids = Object.keys(disp.positions);
  verifier(ids.length === Object.keys(d.salles).length, `${quoi} : chaque salle a une position`);
  for (const id of ids) {
    const p = disp.positions[id];
    const plan = d.salles[id].plan;
    verifier(p.largeur === plan.largeur && p.longueur === plan.longueur, `${quoi} : la salle ${id} garde sa vraie taille`);
    verifier(p.x >= 0 && p.y >= 0 && p.x + p.largeur <= disp.largeur && p.y + p.longueur <= disp.longueur, `${quoi} : ${id} tient dans le plan`);
  }
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = disp.positions[ids[i]], b = disp.positions[ids[j]];
    const separes = a.x + a.largeur + ECART_MIN <= b.x || b.x + b.largeur + ECART_MIN <= a.x || a.y + a.longueur + ECART_MIN <= b.y || b.y + b.longueur + ECART_MIN <= a.y;
    verifier(separes, `${quoi} : ${d.salles[ids[i]].nom} et ${d.salles[ids[j]].nom} se touchent ou se chevauchent`);
  }
}

/** Le cas signalé : la salle 5 est à l'ouest de la salle 1 ; une autre de ses portes est mène à une salle 6. */
function casBarre() {
  const d = donjonVide();
  const s1 = d.salleActive;
  const t1 = texteSalle(8, 8, [['nord', 3], ['est', 2], ['ouest', 5]]);
  m.definirTexte(d, s1, t1, m.planDepuisTexte(t1, s1));
  const s2 = salle(d, 'Salle 2', 6, 6, [['ouest', 2]]);
  const s4 = salle(d, 'Salle 4', 6, 6, [['sud', 3]]);
  const s5 = salle(d, 'Salle 5', 6, 6, [['est', 2], ['est', 5]]);
  const s6 = salle(d, 'Salle 6', 6, 6, [['ouest', 2]]);
  m.relier(d, porte(s1, 'est', 2), porte(s2, 'ouest', 2));
  m.relier(d, porte(s1, 'nord', 3), porte(s4, 'sud', 3));
  m.relier(d, porte(s1, 'ouest', 5), porte(s5, 'est', 5));
  m.relier(d, porte(s5, 'est', 2), porte(s6, 'ouest', 2));
  return { d, s1, s5, s6 };
}

/** Chaque couloir part de sa porte, arrive à l'autre, reste à angle droit et n'entre dans aucune salle. */
function couloirsPropres(disp, quoi) {
  for (const c of disp.couloirs) {
    const pts = cheminCouloir(c);
    egal([pts[0].x, pts[0].y], [c.de.x, c.de.y], `${quoi} : départ à la porte`);
    egal([pts.at(-1).x, pts.at(-1).y], [c.vers.x, c.vers.y], `${quoi} : arrivée à la porte`);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      verifier(a.x === b.x || a.y === b.y, `${quoi} : segment en diagonale`);
      const n = Math.ceil((Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) * 4);
      for (let k = 1; k < n; k++) {
        const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n;
        for (const [id, r] of Object.entries(disp.positions)) {
          verifier(!(x > r.x && x < r.x + r.largeur && y > r.y && y < r.y + r.longueur), `${quoi} : couloir à travers la salle ${id} en ${x},${y}`);
        }
      }
    }
  }
}

/** Grille de 3 × 4 salles reliées de tailles variées (avec des cycles) : 12 salles. */
function grande() {
  const d = donjonVide();
  const ids = [];
  for (let i = 0; i < 12; i++) {
    const portes = [['nord', 1], ['sud', 1], ['est', 1], ['ouest', 1]];
    const l = 4 + ((i * 3) % 7), h = 4 + ((i * 5) % 6);
    ids.push(i === 0 ? (m.definirTexte(d, d.salleActive, texteSalle(l, h, portes), m.planDepuisTexte(texteSalle(l, h, portes), d.salleActive)), d.salleActive) : salle(d, `Salle ${i + 1}`, l, h, portes));
  }
  const COLS = 4;
  for (let i = 0; i < 12; i++) {
    if (i % COLS < COLS - 1) m.relier(d, porte(ids[i], 'est', 1), porte(ids[i + 1], 'ouest', 1));
    if (i + COLS < 12) m.relier(d, porte(ids[i], 'sud', 1), porte(ids[i + COLS], 'nord', 1));
  }
  return d;
}

const TESTS = [
  ['1 salle : une position, aucun couloir', () => {
    const d = donjonVide();
    const disp = disposerPlan(d);
    egal(Object.keys(disp.positions), [d.salleActive], 'une salle');
    egal(disp.couloirs, [], 'aucun couloir');
    egal(disp.isolees, [], 'aucune isolée');
    verifier(disp.etiquetteIsolees === null, 'pas d’étiquette sans salle isolée');
    sansChevauchement(disp, d, '1 salle');
  }],

  ['2 salles : la salle reliée est derrière la porte, à 2 cases du mur, portes face à face', () => {
    const d = donjonVide();
    const a = d.salleActive;
    m.definirTexte(d, a, texteSalle(8, 8, [['est', 5]]), m.planDepuisTexte(texteSalle(8, 8, [['est', 5]]), a));
    const b = salle(d, 'B', 4, 10, [['ouest', 1]]);
    m.relier(d, porte(a, 'est', 5), porte(b, 'ouest', 1));
    const disp = disposerPlan(d);
    const A = disp.positions[a], B = disp.positions[b];
    egal([A.largeur, A.longueur, B.largeur, B.longueur], [8, 8, 4, 10], 'vraies tailles');
    verifier(B.x === A.x + A.largeur + ECART_LIAISON, `B doit être à ${ECART_LIAISON} cases du mur est de A (obtenu ${B.x - A.x - A.largeur})`);
    verifier(B.y === A.y + 5 - 1, 'décalée pour que les portes se fassent face');
    const c = disp.couloirs[0];
    verifier(disp.couloirs.length === 1 && !c.orpheline, 'un couloir, non orphelin');
    verifier(c.de.y === c.vers.y && c.de.x === A.x + A.largeur && c.vers.x === B.x, 'les deux points de porte sont alignés, sur les murs');
    egal(cheminCouloir(c).length, 2, 'couloir droit : deux points');
    sansChevauchement(disp, d, '2 salles');
  }],

  ['direction : porte au nord → salle au-dessus, porte au sud → salle en dessous, porte à l’ouest → à gauche', () => {
    const d = donjonVide();
    const a = d.salleActive;
    const t = texteSalle(6, 6, [['nord', 2], ['sud', 3], ['ouest', 1]]);
    m.definirTexte(d, a, t, m.planDepuisTexte(t, a));
    const n = salle(d, 'Nord', 5, 3, [['sud', 0]]);
    const s = salle(d, 'Sud', 5, 4, [['nord', 4]]);
    const o = salle(d, 'Ouest', 3, 3, [['est', 0]]);
    m.relier(d, porte(a, 'nord', 2), porte(n, 'sud', 0));
    m.relier(d, porte(a, 'sud', 3), porte(s, 'nord', 4));
    m.relier(d, porte(a, 'ouest', 1), porte(o, 'est', 0));
    const p = disposerPlan(d).positions;
    verifier(p[n].y + p[n].longueur + ECART_LIAISON === p[a].y && p[n].x + 0 === p[a].x + 2, 'au nord, porte S de Nord (A) face à la porte C de A');
    verifier(p[s].y === p[a].y + 6 + ECART_LIAISON && p[s].x + 4 === p[a].x + 3, 'au sud, portes alignées');
    verifier(p[o].x + 3 + ECART_LIAISON === p[a].x && p[o].y === p[a].y + 1, 'à l’ouest, portes alignées');
    sansChevauchement(disposerPlan(d), d, '3 voisines');
  }],

  ['place disputée : plusieurs salles visent le même endroit, aucune ne chevauche', () => {
    const d = donjonVide();
    const a = d.salleActive;
    const t = texteSalle(6, 6, [['est', 0], ['est', 2], ['est', 4], ['sud', 1]]);
    m.definirTexte(d, a, t, m.planDepuisTexte(t, a));
    const cibles = [0, 1, 2].map((i) => salle(d, `Voisine ${i + 1}`, 6, 6, [['ouest', 0]]));
    [0, 2, 4].forEach((pos, i) => m.relier(d, porte(a, 'est', pos), porte(cibles[i], 'ouest', 0)));
    // Une salle au sud dont la porte sud rejoint aussi l'espace des autres (place prise par la rangée précédente).
    const sud = salle(d, 'Sud', 20, 12, [['nord', 1], ['est', 3]]);
    m.relier(d, porte(a, 'sud', 1), porte(sud, 'nord', 1));
    const disp = disposerPlan(d);
    sansChevauchement(disp, d, 'place disputée');
    const A = disp.positions[a];
    for (const id of cibles) verifier(disp.positions[id].x >= A.x + A.largeur + ECART_LIAISON, 'les trois voisines restent à l’est de A, éloignées dans la direction de la porte');
    egal(disp.couloirs.length, 4, 'les quatre liaisons sont tracées');
  }],

  ['12 salles reliées en grille avec cycles : jamais de chevauchement, une liaison tracée par porte', () => {
    const d = grande();
    const disp = disposerPlan(d);
    sansChevauchement(disp, d, '12 salles');
    egal(disp.couloirs.length, d.liaisons.length, 'toutes les liaisons sont tracées, même celles vers une salle déjà placée');
    egal(disp.isolees, [], 'aucune isolée');
    for (const c of disp.couloirs) {
      const chemin = cheminCouloir(c);
      for (let i = 1; i < chemin.length; i++) verifier(chemin[i].x === chemin[i - 1].x || chemin[i].y === chemin[i - 1].y, 'couloir sans diagonale');
    }
  }],

  ['salles non reliées : rangée sous le reste, avec l’étiquette', () => {
    const d = donjonVide();
    const a = d.salleActive;
    const t = texteSalle(6, 6, [['est', 2]]);
    m.definirTexte(d, a, t, m.planDepuisTexte(t, a));
    const b = salle(d, 'B', 5, 5, [['ouest', 2]]);
    m.relier(d, porte(a, 'est', 2), porte(b, 'ouest', 2));
    const seules = [salle(d, 'Seule 1', 7, 4), salle(d, 'Seule 2', 5, 9), salle(d, 'Seule 3', 6, 6)];
    const disp = disposerPlan(d);
    sansChevauchement(disp, d, 'non reliées');
    egal(disp.isolees, seules, 'les salles sans liaison sont listées dans l’ordre');
    const basReliees = Math.max(disp.positions[a].y + 6, disp.positions[b].y + 5);
    for (const id of seules) verifier(disp.positions[id].y >= basReliees + ECART_MIN, `${d.salles[id].nom} est sous les salles reliées`);
    verifier(disp.etiquetteIsolees && disp.etiquetteIsolees.y < disp.positions[seules[0]].y && disp.etiquetteIsolees.y > basReliees, 'l’étiquette est entre les deux, au-dessus de la rangée');
    verifier(ETIQUETTE_ISOLEES === 'Salles non reliées', 'libellé de l’étiquette');
    const ys = new Set(seules.map((id) => disp.positions[id].y));
    verifier(ys.size === 1, 'la rangée tient sur une ligne');
  }],

  ['liaison orpheline : pas de plantage, couloir marqué orphelin', () => {
    const d = donjonVide();
    const a = d.salleActive;
    const t = texteSalle(6, 6, [['est', 2]]);
    m.definirTexte(d, a, t, m.planDepuisTexte(t, a));
    const b = salle(d, 'B', 5, 5, [['ouest', 2]]);
    m.relier(d, porte(a, 'est', 2), porte(b, 'ouest', 2));
    // La porte de B disparaît du texte : la liaison devient orpheline côté B.
    const t2 = texteSalle(5, 5);
    m.definirTexte(d, b, t2, m.planDepuisTexte(t2, b));
    verifier(m.liaisonsOrphelines(d).length === 1, 'préparation : une extrémité orpheline');
    const disp = disposerPlan(d);
    egal(disp.couloirs.length, 1, 'le couloir existe');
    verifier(disp.couloirs[0].orpheline === true, 'drapeau orpheline');
    sansChevauchement(disp, d, 'orpheline');
    // Une liaison vers une salle disparue est ignorée, une position hors du mur ne plante pas.
    d.liaisons.push({ id: 'l-fantome', a: porte(a, 'sud', 3), b: porte('inconnue', 'nord', 0) });
    d.liaisons.push({ id: 'l-hors', a: porte(a, 'nord', 99), b: porte(b, 'sud', 99) });
    const disp2 = disposerPlan(d);
    verifier(!disp2.couloirs.some((c) => c.liaison === 'l-fantome'), 'liaison vers une salle absente ignorée');
    verifier(disp2.couloirs.some((c) => c.liaison === 'l-hors' && c.orpheline), 'position hors du mur : tracée, orpheline');
  }],

  ['stable : mêmes données, même plan ; le donjon d’origine n’est pas modifié', () => {
    const d = grande();
    const avant = JSON.stringify(d);
    const un = JSON.stringify(disposerPlan(d)), deux = JSON.stringify(disposerPlan(JSON.parse(avant)));
    verifier(un === deux, 'le plan d’une copie du donjon est identique');
    verifier(JSON.stringify(d) === avant, 'le donjon n’a pas changé');
  }],

  ['salleSous : trouve la salle sous un point (murs compris), rien dans le vide', () => {
    const d = donjonVide();
    const a = d.salleActive;
    const disp = disposerPlan(d);
    const p = disp.positions[a];
    egal(salleSous(disp, p.x + 1, p.y + 1), a, 'au centre');
    egal(salleSous(disp, p.x - 0.2, p.y + 1), a, 'sur le mur');
    egal(salleSous(disp, p.x - 1, p.y - 1), null, 'dans le vide');
  }],
  ['mini-plan : les flèches mènent à la salle voisine', () => {
    const pos = { a: { col: 1, ligne: 1 }, n: { col: 1, ligne: 0 }, e: { col: 3, ligne: 1 }, e2: { col: 2, ligne: 3 }, loin: { col: 0, ligne: 3 } };
    egal(salleVoisine(pos, 'a', 'nord'), 'n', 'au nord');
    egal(salleVoisine(pos, 'a', 'est'), 'e', 'à l’est, alignée');
    egal(salleVoisine(pos, 'a', 'sud'), 'e2', 'au sud : la plus proche dans le cône, à côté');
    egal(salleVoisine(pos, 'n', 'nord'), null, 'rien au nord');
    egal(salleVoisine(pos, 'absente', 'nord'), null, 'salle inconnue');
  }],
  ['placement : la salle reste du côté de sa porte, c’est sa voisine qui recule', () => {
    const { d, s1, s5, s6 } = casBarre();
    const disp = disposerPlan(d);
    sansChevauchement(disp, d, 'cas signalé');
    const p = disp.positions;
    verifier(p[s6].x >= p[s5].x + p[s5].largeur + ECART_LIAISON, 'la salle 6 est à droite de la salle 5, à la distance normale');
    egal(p[s6].x - (p[s5].x + p[s5].largeur), ECART_PASSAGE, 'écart à gauche de la salle 6');
    egal(p[s1].x - (p[s6].x + p[s6].largeur), ECART_PASSAGE, 'même écart à droite de la salle 6');
    const contour = disp.couloirs.find((c) => [c.de.salle, c.vers.salle].sort().join() === [s1, s5].sort().join());
    const verticales = cheminCouloir(contour).map((pt) => pt.x);
    verifier(verticales.includes(p[s6].x - 1.5), 'le couloir passe au milieu de l’espace à gauche de la salle 6');
    verifier(verticales.includes(p[s6].x + p[s6].largeur + 1.5), 'et au milieu de l’espace à droite');
    egal(p[s6].y, p[s5].y, 'les portes de la 5 et de la 6 se font face');
    couloirsPropres(disp, 'cas signalé');
    egal(JSON.stringify(disposerPlan(d)), JSON.stringify(disp), 'même plan à chaque calcul');
    const mini = disposerSalles(d).positions;
    verifier(mini[s6].col === mini[s5].col + 1 && mini[s6].ligne === mini[s5].ligne, 'mini-plan : la 6 juste à droite de la 5');
    verifier(mini[s1].col > mini[s6].col, 'mini-plan : la 1 reste à droite');
  }],
  ['couloirs : aucun ne traverse une salle, tous à angle droit, sur un grand donjon', () => {
    couloirsPropres(disposerPlan(grande()), '12 salles');
  }],
];

export function executer() {
  return TESTS.map(([phrase, f]) => {
    const ecarts = [];
    try { f(); } catch (e) { ecarts.push(e.message); }
    return { phrase: `Plan du donjon · ${phrase}`, ecarts };
  });
}
