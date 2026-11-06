/**
 * Tests du thème « peint » : ses parties PURES (perspective et KP, segments de murs, raccord des tuiles de sol, graine des salles) et les réglages
 * qui le pilotent (Thème, Cases, Relief : compatibilité avec l'ancien réglage booléen), puis un dessin complet sur un contexte simulé (aucune
 * exception, quelles que soient la forme et l'option). Le rendu réel est vérifié dans un navigateur (voir le README). Sans dépendance.
 */
import { kpDeSalle, vueDeSalle, haut, echelle, faceVisible, eclairage, debordMax, composer, inverser, appliquer, vueLocale, KP_MAX, IDENTITE } from '../js/rendu/perspective.js';
import { MARGE } from '../js/rendu/geometrie.js';
import { segmentsDeMurs } from '../js/rendu/themes/peint/segments.js';
import { SOLS_PEINTS, PERIODE, couleurSol, calculerTuile, cleTuile, resolutionTuile, RESOLUTION_MIN, RESOLUTION_MAX, CASES_PAR_TUILE } from '../js/rendu/themes/peint/sols.js';
import { h2, vbp, fbmp, voroP, alea, graineDeTexte } from '../js/rendu/themes/peint/bruit.js';
import { creerVolumes, volumesLocaux } from '../js/rendu/themes/peint/volumes.js';
import { graineDePlan, idPublic } from '../js/rendu/graine.js';
import { themeParNom, THEMES } from '../js/rendu/themes/index.js';
import { dessiner } from '../js/rendu/moteur.js';
import { casesDeReglages, themeDeReglages, reliefDeReglages, optionsRendu, affichageDeReglages, validerAffichage, CASES_PAR_DEFAUT, AFFICHAGE_PAR_DEFAUT } from '../js/affichage.js';
import { chargerReglages, CLE_REGLAGES } from '../js/stockage.js';
import { planPublic } from '../js/vue-publique.js';
import { casesRetirees, nombreCases } from '../js/formes.js';
import { OBJETS } from '../js/catalogue.js';
import { verifier, egal, fauxStock, executerSuite } from './mini-test.js';

const rect = (largeur, longueur, plus = {}) => ({ id: 's1', largeur, longueur, sol: 'pierre', portes: [], objets: [], creatures: [], ...plus });
const proche = (a, b, quoi, eps = 1e-9) => verifier(Math.abs(a - b) <= eps, `${quoi} : ${a} ≠ ${b}`);
const reglagesDe = (brut) => chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify(brut) }));

/** Contexte 2D qui accepte tout : on ne cherche que les exceptions. */
function ctxPermissif() {
  const degrade = () => ({ addColorStop() {} });
  return new Proxy({}, {
    get: (_, nom) => (typeof nom === 'symbol' ? undefined
      : nom === 'createRadialGradient' || nom === 'createLinearGradient' ? degrade
      : nom === 'measureText' ? (s) => ({ width: String(s).length * 6 })
      : () => {}),
    set: () => true,
  });
}
const canvasSimule = () => ({ width: 0, height: 0, style: {}, getContext: () => ctxPermissif() });

const TESTS = [
  // --- Perspective et KP ---------------------------------------------------------------------------------
  ['KP : au plus KP_MAX, et plus petit pour une grande salle ; 0 sans relief', () => {
    proche(kpDeSalle(rect(4, 3), 48), KP_MAX, 'petite salle');
    proche(kpDeSalle(rect(8, 6), 48), KP_MAX, 'salle moyenne');
    proche(kpDeSalle(rect(12, 8), 48), 0.62 / 6, 'une salle de 12 cases est déjà un peu en dessous');
    proche(kpDeSalle(rect(40, 30), 48), (0.62 * 48) / ((40 * 48) / 2), 'grande salle : 0,62 case / demi-largeur en pixels');
    proche(kpDeSalle(rect(10, 40), 20), (0.62 * 20) / ((40 * 20) / 2), 'la plus grande dimension compte');
    egal(kpDeSalle(rect(12, 8), 48, false), 0, 'sans relief');
    verifier(kpDeSalle(rect(60, 60), 16) < kpDeSalle(rect(30, 30), 16), 'plus la salle est grande, plus KP baisse');
  }],
  ['KP : le haut des murs et leur épaisseur tiennent toujours dans la marge de roche', () => {
    for (const [l, h, t] of [[1, 1, 48], [3, 3, 16], [8, 5, 48], [12, 8, 100], [20, 20, 30], [40, 30, 48], [60, 60, 16], [60, 4, 160], [5, 60, 24]]) {
      const d = debordMax(rect(l, h), t);
      verifier(d < MARGE, `${l}×${h} à ${t} px : le dessus des murs déborde de ${d.toFixed(3)} case, la marge est de ${MARGE}`);
    }
    egal(debordMax(rect(12, 8), 48, false) < MARGE, true, 'sans relief aussi');
  }],
  ['haut(x, y, h) : un point à la hauteur h s’écarte du centre de 1 + h·KP ; rien ne bouge au sol ni sans relief', () => {
    const vue = vueDeSalle(rect(10, 6), 40); // centre (200, 120)
    egal([vue.cx, vue.cy], [200, 120], 'centre');
    egal(haut(vue, 40, 30, 0), [40, 30], 'au sol');
    const [x, y] = haut(vue, 40, 30, 1);
    proche(x, 200 + (40 - 200) * (1 + KP_MAX), 'x au sommet du mur');
    proche(y, 120 + (30 - 120) * (1 + KP_MAX), 'y au sommet du mur');
    egal(haut(vue, 200, 120, 1), [200, 120], 'le centre ne bouge jamais');
    proche(echelle(vue, 2), 1 + 2 * KP_MAX, 'une hauteur de deux murs');
    egal(haut(vueDeSalle(rect(10, 6), 40, false), 40, 30, 1), [40, 30], 'sans relief : à plat');
  }],
  ['faceVisible : on voit les faces tournées vers le centre, jamais sans relief ; l’éclairage vient du nord-ouest', () => {
    const vue = vueDeSalle(rect(10, 6), 40);
    verifier(faceVisible(vue, [0, 0], [400, 0], [0, 1]), 'le mur nord, face vers le sud');
    verifier(!faceVisible(vue, [0, 0], [400, 0], [0, -1]), 'son envers');
    verifier(faceVisible(vue, [400, 0], [400, 240], [-1, 0]), 'le mur est');
    verifier(!faceVisible(vueDeSalle(rect(10, 6), 40, false), [0, 0], [400, 0], [0, 1]), 'sans relief, aucune face');
    verifier(eclairage(vue, 0, -1) > eclairage(vue, 0, 1), 'une face tournée vers le nord est plus claire que celle tournée vers le sud');
    verifier(eclairage(vue, -1, 0) > eclairage(vue, 1, 0), 'et celle tournée vers l’ouest que celle tournée vers l’est');
  }],
  ['repère local d’un objet : le centre, KP et la lumière suivent la rotation, et haut() y reste cohérent avec le repère de la salle', () => {
    const vue = vueDeSalle(rect(10, 6), 40);
    const base = { a: 2, b: 0, c: 0, d: 2, e: 30, f: 30 }; // densité 2, marge
    const a = Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    const rot = { a: c, b: s, c: -s, d: c, e: 0, f: 0 };
    const courante = composer(base, composer({ ...IDENTITE, e: 100, f: 50 }, rot)); // translate(100, 50) puis rotate(90°), dans le repère de la salle
    const loc = vueLocale(vue, base, courante);
    egal(loc.kp, vue.kp, 'KP inchangé');
    proche(Math.hypot(...loc.lum), 1, 'lumière unitaire');
    // Un point local, élevé dans le repère local, puis ramené dans celui de la salle, égale le même point élevé dans la salle.
    const versSalle = composer(inverser(base), courante);
    const [px, py] = [12, -7];
    const [lx, ly] = haut(loc, px, py, 0.8);
    const [sx, sy] = appliquer(versSalle, lx, ly);
    const [ex, ey] = haut(vue, ...appliquer(versSalle, px, py), 0.8);
    proche(sx, ex, 'x', 1e-6); proche(sy, ey, 'y', 1e-6);
    egal(vueLocale(vue, base, base).cx, vue.cx, 'repère identique : rien ne change');
  }],
  ['volumes : creerVolumes donne haut, KP et les helpers de volume ; volumesLocaux marche sur un contexte simulé', () => {
    const vue = vueDeSalle(rect(10, 6), 40);
    const V = creerVolumes(vue);
    egal(V.KP, vue.kp, 'KP');
    egal(V.haut(40, 30, 1), haut(vue, 40, 30, 1), 'haut');
    for (const nom of ['auNiveau', 'prisme', 'cylindre', 'cerclage', 'ombrePied']) verifier(typeof V[nom] === 'function', `${nom} manque`);
    const ctx = ctxPermissif(), r = alea(1);
    V.prisme(ctx, r, [[0, 0], [40, 0], [40, 40], [0, 40]], 0, 0.3, [40, 6, 60], () => {});
    V.cylindre(ctx, r, 20, 20, 10, 0, 1, [40, 6, 60]);
    V.cerclage(ctx, 20, 20, 10, 0.5, 1);
    verifier(typeof volumesLocaux(ctx).haut === 'function', 'volumesLocaux');
  }],

  // --- Segments de murs ----------------------------------------------------------------------------------
  ['segments de murs : un rectangle a quatre murs continus, normales vers l’intérieur, deux coins sortants chacun', () => {
    const s = segmentsDeMurs(rect(6, 4));
    egal(s.length, 4, 'quatre segments');
    const nord = s.find((x) => x.mur === 'nord');
    egal([nord.a, nord.b, nord.normale], [[0, 0], [6, 0], [0, 1]], 'nord');
    const est = s.find((x) => x.mur === 'est');
    egal([est.a, est.b, est.normale], [[6, 0], [6, 4], [-1, 0]], 'est');
    verifier(s.every((x) => x.avant && x.apres), 'les quatre bouts de chaque mur sont des coins sortants');
  }],
  ['segments de murs : un L et une croix suivent chaque mur, sans trou ni recouvrement', () => {
    for (const plan of [rect(7, 5, { forme: 'L', position: 'sud-ouest' }), rect(9, 7, { forme: 'croix' }), rect(8, 6, { forme: 'U', position: 'nord' }), rect(9, 7, { forme: 'O' })]) {
      const segs = segmentsDeMurs(plan);
      // Chaque côté de case de sol donnant sur le vide est couvert exactement une fois.
      let attendu = 0;
      for (let y = 0; y < plan.longueur; y++) for (let x = 0; x < plan.largeur; x++) {
        if (casesRetirees(plan).has(`${x},${y}`)) continue;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= plan.largeur || Y >= plan.longueur || casesRetirees(plan).has(`${X},${Y}`)) attendu++;
        }
      }
      const total = segs.reduce((n, g) => n + (g.horizontal ? g.b[0] - g.a[0] : g.b[1] - g.a[1]), 0);
      egal(total, attendu, `${plan.forme} : longueur totale des murs`);
      verifier(segs.length < attendu, `${plan.forme} : les tronçons alignés sont fondus (${segs.length} segments pour ${attendu} côtés)`);
    }
    // Un L a six murs ; un coin rentrant n'est pas un coin sortant.
    const l = segmentsDeMurs(rect(7, 5, { forme: 'L', position: 'sud-ouest' }));
    egal(l.length, 6, 'un L a six murs');
    egal(l.filter((g) => g.avant).length + l.filter((g) => g.apres).length, 10, 'cinq coins sortants : dix bouts de mur qui se prolongent ; le coin rentrant ne prolonge rien');
  }],

  // --- Sols : tuiles raccordables ----------------------------------------------------------------------------
  ['sols : chaque sol est périodique (la tuile se raccorde à elle-même, à droite comme en bas), roche comprise', () => {
    const noms = Object.keys(SOLS_PEINTS);
    egal(noms.sort(), ['bois', 'glace', 'herbe', 'marbre', 'pierre', 'roche', 'sable', 'terre'], 'les sept sols du plan et la roche');
    const tirage = alea(7);
    for (const nom of noms) {
      for (let i = 0; i < 60; i++) {
        const X = 3 + tirage() * (PERIODE - 6), Y = 3 + tirage() * (PERIODE - 6);
        const a = couleurSol(nom, X, Y), droite = couleurSol(nom, X + PERIODE, Y), bas = couleurSol(nom, X, Y + PERIODE), loin = couleurSol(nom, X - 2 * PERIODE, Y + 3 * PERIODE);
        for (let c = 0; c < 3; c++) {
          proche(a[c], droite[c], `${nom} (${X.toFixed(1)}, ${Y.toFixed(1)}) canal ${c} : décalé d’une période vers la droite`, 1e-6);
          proche(a[c], bas[c], `${nom} canal ${c} : vers le bas`, 1e-6);
          proche(a[c], loin[c], `${nom} canal ${c} : de plusieurs périodes`, 1e-6);
        }
      }
    }
  }],
  ['bruits périodiques : indices de réseau pris modulo la période', () => {
    for (const [x, y] of [[0.13, 0.77], [0.5, 0.01], [0.99, 0.42]]) {
      proche(vbp(x, y, 7, 5, 3), vbp(x + 1, y + 2, 7, 5, 3), 'vbp', 1e-9);
      proche(fbmp(x, y, 4, 9), fbmp(x - 3, y + 1, 4, 9), 'fbmp', 1e-9);
      const a = voroP(x, y, 5, 2, { e: 0, id: 0, dx: 0, dy: 0 }), idA = a.id, eA = a.e;
      const b = voroP(x + 1, y - 1, 5, 2, { e: 0, id: 0, dx: 0, dy: 0 });
      egal([b.id, Math.abs(b.e - eA) < 1e-9], [idA, true], 'voroP : même cellule, même distance au joint');
    }
    verifier(h2(3, 4, 5) === h2(3, 4, 5) && h2(3, 4, 5) !== h2(4, 3, 5), 'h2 déterministe et sensible à l’ordre');
    verifier(graineDeTexte('salle-1') === graineDeTexte('salle-1') && graineDeTexte('salle-1') !== graineDeTexte('salle-2'), 'graineDeTexte');
    const r1 = alea(5), r2 = alea(5);
    egal([r1(), r1(), r1()], [r2(), r2(), r2()], 'alea déterministe');
  }],
  ['tuiles : taille, opacité, déterminisme et variété ; les bords opposés sont aussi proches que deux pixels voisins', () => {
    for (const nom of Object.keys(SOLS_PEINTS)) {
      const t = calculerTuile(nom, RESOLUTION_MIN), u = calculerTuile(nom, RESOLUTION_MIN);
      egal(t.cote, CASES_PAR_TUILE * RESOLUTION_MIN, `${nom} : côté`);
      egal(t.data.length, t.cote * t.cote * 4, `${nom} : pixels`);
      verifier(t.data.every((v, i) => i % 4 !== 3 || v === 255), `${nom} : opaque`);
      verifier(t.data.every((v, i) => v === u.data[i]), `${nom} : même tuile à chaque calcul`);
      let min = 255, max = 0;
      for (let i = 0; i < t.data.length; i += 4) { min = Math.min(min, t.data[i + 1]); max = Math.max(max, t.data[i + 1]); }
      verifier(max - min > 30, `${nom} : un sol vivant, pas un aplat (écart ${max - min})`);
      // Raccord : la colonne de droite et la colonne de gauche se suivent (le pixel de la tuile voisine est la colonne 0) ;
      // leur écart ne dépasse pas l'écart moyen entre deux colonnes voisines de la tuile.
      const { cote, data } = t, g = (x, y) => data[(y * cote + x) * 4 + 1];
      let coupure = 0, voisin = 0;
      for (let y = 0; y < cote; y++) {
        coupure += Math.abs(g(cote - 1, y) - g(0, y));
        for (let x = 0; x < cote - 1; x++) voisin += Math.abs(g(x, y) - g(x + 1, y)) / (cote - 1);
      }
      verifier(coupure <= voisin * 2.5, `${nom} : couture à droite (${coupure} contre ${voisin.toFixed(0)} en moyenne entre deux pixels voisins)`);
      coupure = 0; voisin = 0;
      for (let x = 0; x < cote; x++) {
        coupure += Math.abs(g(x, cote - 1) - g(x, 0));
        for (let y = 0; y < cote - 1; y++) voisin += Math.abs(g(x, y) - g(x, y + 1)) / (cote - 1);
      }
      verifier(coupure <= voisin * 2.5, `${nom} : couture en bas (${coupure} contre ${voisin.toFixed(0)})`);
    }
  }],
  ['tuiles : la résolution suit la case et la densité, bornée ; la clé de cache distingue sol, résolution, ambiance et état', () => {
    egal(resolutionTuile(48, 1), 48, '48 px, densité 1');
    egal(resolutionTuile(48, 2), RESOLUTION_MAX, 'densité 2 : plafonnée');
    egal(resolutionTuile(160, 2), RESOLUTION_MAX, 'très grande case : plafonnée');
    egal(resolutionTuile(4, 1), RESOLUTION_MIN, 'toute petite case : plancher');
    egal(resolutionTuile(50, 1), resolutionTuile(51, 1), 'des cases voisines partagent leur tuile');
    const cles = new Set([cleTuile('pierre', 48), cleTuile('bois', 48), cleTuile('pierre', 32), cleTuile('pierre', 48, { ambiance: 'froide' }), cleTuile('pierre', 48, { etat: 'ruine' })]);
    egal(cles.size, 5, 'cinq clés différentes');
    egal(cleTuile('pierre', 48), cleTuile('pierre', 48, { ambiance: 'neutre', etat: 'neuve' }), 'valeurs neutres par défaut');
  }],

  // --- Graine d'une salle --------------------------------------------------------------------------------
  ['graine : la régie et la table calculent la même, sans que la table reçoive l’identifiant de la salle', () => {
    const plan = rect(6, 4, { id: 's-ab12cd', nom: 'Secret', portes: [], objets: [], creatures: [], entree: 'sud' });
    const publique = planPublic(plan);
    verifier(!JSON.stringify(publique).includes('s-ab12cd'), 'l’identifiant de la salle ne part pas à la table');
    egal(publique.id, idPublic('s-ab12cd'), 'identifiant public');
    egal(graineDePlan(publique), graineDePlan(plan), 'même graine des deux côtés');
    verifier(graineDePlan(rect(6, 4, { id: 's-zz' })) !== graineDePlan(plan), 'deux salles, deux graines');
  }],

  // --- Réglages ---------------------------------------------------------------------------------------------
  ['Cases : l’ancien réglage booléen reste compris, le nouveau l’emporte', () => {
    egal(casesDeReglages({ grille: true }), CASES_PAR_DEFAUT, 'ancien « grille » oui : opacité par défaut');
    egal(casesDeReglages({ grille: false }), 0, 'ancien « grille » non : invisible');
    egal(casesDeReglages({}), CASES_PAR_DEFAUT, 'rien d’enregistré');
    egal(casesDeReglages({ grille: false, cases: 70 }), 70, 'cases l’emporte');
    egal(casesDeReglages({ grille: true, cases: 0 }), 0, 'cases = 0');
    egal(casesDeReglages({ cases: 101 }), CASES_PAR_DEFAUT, 'hors bornes : ignoré');
    egal(casesDeReglages({ cases: 12.5 }), CASES_PAR_DEFAUT, 'pas un entier : ignoré');
    egal(casesDeReglages({ cases: '40' }), CASES_PAR_DEFAUT, 'pas un nombre : ignoré');
  }],
  ['Thème et Relief : peint et relief par défaut, valeurs inconnues ignorées', () => {
    egal([themeDeReglages({}), themeDeReglages({ theme: 'vectoriel' }), themeDeReglages({ theme: 'pixel' }), themeDeReglages({ theme: 'papier' })], ['peint', 'vectoriel', 'peint', 'peint'], 'thème');
    egal([reliefDeReglages({}), reliefDeReglages({ relief: false }), reliefDeReglages({ relief: 0 })], [true, false, true], 'relief : seul faux l’éteint');
    egal(optionsRendu({ grille: true, theme: 'vectoriel', relief: false, cases: 25 }), { grille: 0.25, theme: 'vectoriel', relief: false }, 'optionsRendu');
    egal(optionsRendu({ grille: false }), { grille: 0, theme: 'peint', relief: true }, 'ancien réglage « sans grille »');
    egal(themeParNom('vectoriel'), THEMES.vectoriel, 'themeParNom');
    egal(themeParNom('inconnu'), THEMES.peint, 'thème inconnu : peint');
    egal(Object.keys(THEMES), ['peint', 'vectoriel'], 'les thèmes de l’écran');
  }],
  ['réglages enregistrés : les anciens se relisent tels quels, les nouveaux sont validés et gardés', () => {
    egal(reglagesDe({ echelle: 1.5, taille: 48, grille: false }), { echelle: 1.5, taille: 48, grille: false }, 'ancien fichier : rien d’ajouté');
    egal(reglagesDe({ echelle: 1.5, taille: 48, grille: true, cases: 65, theme: 'vectoriel', relief: false }),
      { echelle: 1.5, taille: 48, grille: true, cases: 65, theme: 'vectoriel', relief: false }, 'tout réglé');
    egal(reglagesDe({ echelle: 1.5, taille: 48, grille: true, cases: 300, theme: 'peint', relief: true }), { echelle: 1.5, taille: 48, grille: true }, 'valeurs par défaut ou invalides : non gardées');
    egal(reglagesDe({ echelle: 1.5, taille: 48, grille: true, theme: 'pixel' }).theme, undefined, 'thème inconnu');
  }],
  ['table : thème, cases et relief voyagent seulement s’ils diffèrent du défaut, et se relisent champ par champ', () => {
    egal(affichageDeReglages({ taille: 48, grille: true }), { taille: 48, grille: true, reperes: true, mode: 'remplir' }, 'défaut : rien de plus');
    egal(affichageDeReglages({ taille: 48, grille: true, cases: 0 }).grille, false, 'cases = 0 : plus de grille');
    egal(affichageDeReglages({ taille: 48, grille: false, cases: 30 }).grille, true, 'cases > 0 : la grille est là');
    const a = affichageDeReglages({ taille: 48, grille: true, cases: 30, theme: 'vectoriel', relief: false });
    egal(a, { taille: 48, grille: true, reperes: true, mode: 'remplir', cases: 30, theme: 'vectoriel', relief: false }, 'tout réglé');
    egal(validerAffichage(a, AFFICHAGE_PAR_DEFAUT), { mode: 'remplir', taille: 48, grille: true, reperes: true, cases: 30, theme: 'vectoriel', relief: false }, 'aller-retour');
    egal(validerAffichage({ theme: 'x', cases: 'beaucoup', relief: 'non' }, AFFICHAGE_PAR_DEFAUT), { mode: 'remplir', taille: 48, grille: true, reperes: true }, 'valeurs invalides : le défaut');
    egal(optionsRendu(a), { grille: 0.3, theme: 'vectoriel', relief: false }, 'ce que la table dessine');
  }],

  // --- Dessin complet sur un contexte simulé ---------------------------------------------------------------
  ['peint : dessiner ne lève aucune exception, quelles que soient la forme, l’option et les marques', () => {
    const types = OBJETS.map((o) => o.type);
    const formes = [rect(10, 7), rect(7, 5, { forme: 'L', position: 'sud-ouest' }), rect(9, 7, { forme: 'croix' }), rect(9, 7, { forme: 'O' }), rect(8, 6, { forme: 'U', position: 'est' }), rect(1, 1), rect(60, 60)];
    for (const base of formes) {
      const plan = {
        ...base,
        portes: [{ id: 'p1', mur: 'nord', position: 0, type: 'porte' }, { id: 'p2', mur: 'est', position: 0, type: 'herse', cache: true }, { id: 'p3', mur: 'sud', position: 0, type: 'arche' }, { id: 'p4', mur: 'ouest', position: 0, type: 'porte' }],
        objets: types.map((type, i) => ({ id: `o${i}`, type, x: 0, y: 0, l: 1, h: 1, rotation: [0, 90, 180, 270][i % 4], ...(i === 2 ? { cache: true } : {}) })),
        creatures: [{ id: 'c1', type: 'gobelin', camp: 'monstre', x: 0, y: 0, taille: 1, numero: 1, cache: true }],
      };
      for (const sol of Object.keys(SOLS_PEINTS).filter((s) => s !== 'roche')) {
        for (const [relief, grille] of [[true, 0.4], [false, true], [true, 0]]) {
          try {
            dessiner(canvasSimule(), { ...plan, sol }, {
              taille: 32, grille, relief, theme: THEMES.peint,
              marques: { selection: { genre: 'porte', element: plan.portes[0] }, portesReliees: [{ mur: 'nord', position: 0 }], caseVisee: { x: 0, y: 0 } },
            });
          } catch (e) { throw new Error(`${base.forme || 'rectangle'} ${base.largeur}×${base.longueur} · ${sol} · relief ${relief} : ${e.stack || e.message}`); }
        }
      }
    }
  }],
  ['moteur : une opacité de grille numérique est transmise au thème ; `true` laisse le trait habituel du thème', () => {
    const appels = [];
    const theme = { ...THEMES.vectoriel, grille: (ctx, plan, t, opacite) => appels.push(opacite) };
    const plan = rect(3, 3);
    dessiner(canvasSimule(), plan, { theme, grille: 0.25 });
    dessiner(canvasSimule(), plan, { theme, grille: true });
    dessiner(canvasSimule(), plan, { theme, grille: 0 });
    egal(appels, [0.25, undefined], 'opacité, vrai, puis zéro : pas de grille');
  }],
  ['peint : preparer et les volumes locaux fonctionnent sur un contexte qui ne connaît pas getTransform', () => {
    const ctx = ctxPermissif();
    THEMES.peint.preparer(ctx, rect(12, 8, { id: 'a' }), 48, { relief: true });
    const V = volumesLocaux(ctx);
    proche(V.KP, 0.62 / 6, 'KP de la salle préparée');
    THEMES.peint.preparer(ctx, rect(12, 8, { id: 'a' }), 48, { relief: false });
    egal(volumesLocaux(ctx).KP, 0, 'sans relief');
    egal(nombreCases(rect(12, 8)), 96, 'rectangle 12 × 8');
  }],
];

export const executer = () => executerSuite('thème peint : ', TESTS);
