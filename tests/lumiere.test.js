/**
 * Tests de la lumière (lot 3 du thème peint) : calculs purs (rendu/lumiere.js : multiplicateurs d'éclairage, pénombre selon la vue, couleurs d'ambiance,
 * liste des sources, vacillement), réglages Pénombre / Flammes animées (compatibilité des réglages enregistrés), enchaînement du moteur (décor, lumière,
 * pions) et boucle d'animation (une seule, arrêtée quand la vue ne se voit pas). Le rendu réel est vérifié dans un navigateur. Sans dépendance.
 */
import {
  ECLAIRAGE_MULT, COULEURS_AMBIANCE, VUE_MJ, OPACITE_MAX, SURFACE_ANIMEE_MAX, IMAGES_PAR_SECONDE,
  multiplicateurEclairage, facteurVue, opaciteVoile, couleurAmbiance, intensiteHalo, vacille, listeSources, animationPossible, animationActive,
} from '../js/rendu/lumiere.js';
import { penombreValide, penombreDeReglages, flammesDeReglages, optionsRendu, affichageDeReglages, validerAffichage, PENOMBRE_PAR_DEFAUT, AFFICHAGE_PAR_DEFAUT } from '../js/affichage.js';
import { chargerReglages, CLE_REGLAGES } from '../js/stockage.js';
import { THEMES } from '../js/rendu/themes/index.js';
import { dessiner } from '../js/rendu/moteur.js';
import { MARGE } from '../js/rendu/geometrie.js';
import { creerAnimation } from '../js/animation-carte.js';
import { verifier, egal, fauxStock, executerSuite, avecEcranSimule, ctxPermissif } from './mini-test.js';

const rect = (largeur, longueur, plus = {}) => ({ id: 'l1', largeur, longueur, sol: 'pierre', portes: [], objets: [], creatures: [], ...plus });
const proche = (a, b, quoi, eps = 1e-9) => verifier(Math.abs(a - b) <= eps, `${quoi} : ${a} ≠ ${b}`);
const reglagesDe = (brut) => chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify(brut) }));

const canvasSimule = () => ({ width: 0, height: 0, style: {}, getContext: () => ctxPermissif() });

/** Les toiles simulées sont fournies par `avecEcranSimule` (mini-test.js) autour de chaque test. */
const avecToiles = (f) => f();

/** Un thème peint dont on note le passage dans la lumière et les pions, pour vérifier l'enchaînement. */
function themeEspion(journal) {
  return {
    ...THEMES.peint,
    creerCouche: (decor, o) => { journal.push(['couche', o.ambiance]); return THEMES.peint.creerCouche(decor, o); },
    eclairer: (ctx, couche, p) => { journal.push(['eclairer', p.opacite, p.ms, p.anime, p.sources.length]); },
    pion: (ctx, k, t) => { journal.push(['pion']); },
  };
}
const torche = { id: 't', type: 'torche', x: 3, y: 0, l: 1, h: 1, rotation: 180 };
const autel = { id: 'a', type: 'autel', x: 4, y: 3, l: 2, h: 1, rotation: 180 };
const pion = { id: 'c', type: 'gobelin', camp: 'monstre', x: 2, y: 2, taille: 1, numero: 1 };

/** Une boucle d'animation simulée : on avance le temps à la main. */
function banc({ cache = false } = {}) {
  const b = { prochain: 1, attendus: new Map(), annules: 0, cache, images: [] };
  const raf = (f) => { const id = b.prochain++; b.attendus.set(id, f); return id; };
  const annuler = (id) => { if (b.attendus.delete(id)) b.annules++; };
  b.avancer = (ms) => { const f = [...b.attendus.values()]; b.attendus.clear(); f.forEach((g) => g(ms)); };
  b.scene = (anime = true) => ({ anime, image: (ms) => b.images.push(ms) });
  b.animation = creerAnimation(null, { raf, annuler, cache: () => b.cache });
  return b;
}

const TESTS = [
  // --- Calculs purs ------------------------------------------------------------------------------------------
  ['éclairage : éclairée ×0,4, pénombre ×1, obscurité ×1,6 ; une valeur absente ou inconnue ne change rien', () => {
    egal([multiplicateurEclairage('eclairee'), multiplicateurEclairage('penombre'), multiplicateurEclairage('obscurite')], [0.4, 1, 1.6], 'les trois éclairages');
    egal([multiplicateurEclairage(undefined), multiplicateurEclairage('lumineuse'), multiplicateurEclairage('toString'), multiplicateurEclairage(null)], [1, 1, 1, 1], 'absent ou inconnu : ×1');
    egal(Object.keys(ECLAIRAGE_MULT), ['eclairee', 'penombre', 'obscurite'], 'les valeurs du schéma du lot « ambiance »');
  }],
  ['pénombre par vue : la table a la pénombre pleine, le MJ (Donjon, régie) en garde 35 %', () => {
    egal([facteurVue('table'), facteurVue('mj'), facteurVue(undefined), facteurVue('regie')], [1, VUE_MJ, VUE_MJ, VUE_MJ], 'facteur de vue');
    proche(opaciteVoile({ penombre: 45, vue: 'table' }), 0.45, 'table, 45 %');
    proche(opaciteVoile({ penombre: 45, vue: 'mj' }), 0.45 * 0.35, 'MJ, 45 %');
    proche(opaciteVoile({ penombre: 45 }), 0.45 * 0.35, 'sans vue : celle du MJ');
    verifier(opaciteVoile({ penombre: 45, vue: 'mj' }) < opaciteVoile({ penombre: 45, vue: 'table' }), 'le MJ voit plus clair que la table');
    egal(opaciteVoile({ penombre: 0, vue: 'table' }), 0, 'pénombre 0 : pas de voile');
    proche(opaciteVoile({ vue: 'table' }), PENOMBRE_PAR_DEFAUT / 100, 'réglage absent : le défaut');
    proche(opaciteVoile({ penombre: Number.NaN, vue: 'table' }), 0.45, 'réglage illisible : le défaut');
  }],
  ['opacité du voile : multipliée par l’éclairage de la salle, bornée', () => {
    proche(opaciteVoile({ penombre: 45, eclairage: 'eclairee', vue: 'table' }), 0.18, 'bien éclairée');
    proche(opaciteVoile({ penombre: 45, eclairage: 'penombre', vue: 'table' }), 0.45, 'pénombre');
    proche(opaciteVoile({ penombre: 45, eclairage: 'obscurite', vue: 'table' }), 0.72, 'plongée dans le noir');
    egal(opaciteVoile({ penombre: 100, eclairage: 'obscurite', vue: 'table' }), OPACITE_MAX, 'plafonnée : jamais le noir complet');
    egal(opaciteVoile({ penombre: 100, vue: 'table' }), OPACITE_MAX, 'pénombre 100 % à la table, éclairage normal : au plafond');
    egal(opaciteVoile({ penombre: 250, vue: 'table' }), OPACITE_MAX, 'réglage hors bornes : ramené à 100 %');
    verifier(intensiteHalo(0) < intensiteHalo(0.45) && intensiteHalo(0.95) === 1, 'les halos se renforcent avec la pénombre, sans dépasser 1');
  }],
  ['couleurs d’ambiance : neutre, froide, chaude, nuit ; l’inconnue et l’absente sont neutres', () => {
    egal(Object.keys(COULEURS_AMBIANCE), ['neutre', 'froide', 'chaude', 'nuit'], 'les quatre ambiances du schéma du lot « ambiance »');
    for (const [nom, rvb] of Object.entries(COULEURS_AMBIANCE)) verifier(rvb.length === 3 && rvb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255), `${nom} : trois composantes de 0 à 255`);
    egal(couleurAmbiance(undefined), COULEURS_AMBIANCE.neutre, 'absente');
    egal(couleurAmbiance('infernale'), COULEURS_AMBIANCE.neutre, 'inconnue');
    egal(couleurAmbiance('constructor'), COULEURS_AMBIANCE.neutre, 'pas un membre hérité');
    const [r, , b] = couleurAmbiance('froide'), [rc, , bc] = couleurAmbiance('chaude');
    verifier(b > r && rc > bc, 'la froide tire vers le bleu, la chaude vers le rouge');
    const clair = (c) => c.reduce((a, v) => a + v, 0);
    verifier(clair(couleurAmbiance('nuit')) < clair(couleurAmbiance('neutre')), 'la nuit est la plus sombre');
  }],
  ['vacillement : borné autour de 0,5, déterministe, différent d’une source à l’autre', () => {
    for (let t = 0; t < 20; t += 0.37) { const v = vacille(t, 3); verifier(v > -0.01 && v < 1.01, `vacille(${t}) = ${v} hors de 0–1`); }
    egal(vacille(1.5, 2), vacille(1.5, 2), 'déterministe');
    verifier(vacille(1.5, 2) !== vacille(1.5, 9), 'la phase change avec la source');
  }],
  ['liste des sources : invalides ignorées, intensité bornée, couleur sûre, tri stable, doublons fusionnés, hors salle écartées', () => {
    const l = listeSources([
      { x: 200, y: 50, r: 100, c: '255,170,80', k: 0.6, s: 6 },
      { x: 20, y: 50, r: 100, k: 4, s: -3 },
      { x: 20, y: 10, r: 0, k: 0.5 }, { x: Number.NaN, y: 1, r: 10 }, null, { y: 3, r: 10 },
      { x: 20.2, y: 50.1, r: 100.3, k: 0.1 },
      { x: 90, y: 90, r: 50, c: 'rgba(0,0,0,1);x', k: 0.3, petite: true },
      { x: 5000, y: 5, r: 40 },
    ], { largeur: 400, hauteur: 300, marge: 48 });
    egal(l.map((s) => [s.x, s.y]), [[20, 50], [200, 50], [90, 90]], 'triées par y puis x ; invalides, doublon et source hors de la salle écartés');
    egal(l[0].k, 1, 'intensité bornée à 1');
    egal(l[0].s, 0, 'flamme négative : aucune');
    egal(l[0].c, '255,190,110', 'couleur absente : celle du feu');
    egal(l[2].c, '255,190,110', 'couleur illisible : celle du feu (rien n’est injecté dans le style)');
    egal(l[1].c, '255,170,80', 'couleur valide gardée');
    egal(l[2].petite, true, 'petite gardée');
    verifier(l.every((s) => Number.isFinite(s.graine)), 'une phase de vacillement par source');
    egal(listeSources(undefined), [], 'rien à lire');
    egal(listeSources([]), [], 'aucune source');
    egal(listeSources([{ x: 5000, y: 5, r: 40 }]).length, 1, 'sans bornes, rien n’est écarté');
  }],
  ['sources déclarées par les objets : la torche en a une, l’autel deux, le reste aucune ; déclarées avec une position, un rayon et une intensité', () => {
    const lire = (objets) => {
      let relevees = [];
      const theme = { ...THEMES.peint, sources: () => (relevees = THEMES.peint.sources()) }; // le moteur les lit juste après le décor
      dessiner(canvasSimule(), rect(8, 6, { objets }), { taille: 48, theme });
      return relevees;
    };
    const t = lire([torche]), a = lire([autel]), rien = lire([{ id: 'c', type: 'coffre', x: 2, y: 2, l: 1, h: 1, rotation: 0 }]);
    egal([t.length, a.length, rien.length], [1, 2, 0], 'torche 1, autel 2, coffre 0');
    verifier(t.every((l) => Number.isFinite(l.x) && Number.isFinite(l.y) && l.r > 0 && l.k > 0 && l.s > 0), 'chaque source a une position, un rayon, une intensité et une flamme');
    egal(lire([torche, autel]).length, 3, 'trois sources pour une torche et un autel (le contexte simulé ne suit pas les positions : le tri et les doublons sont testés plus haut)');
  }],
  ['animation : seulement à la table, flammes cochées, mouvement non réduit, surface raisonnable', () => {
    egal(animationActive({ vue: 'table', flammes: true, mouvementReduit: false }), true, 'table, tout permis');
    egal(animationActive({ vue: 'table' }), true, 'flammes par défaut : oui');
    egal(animationActive({ vue: 'mj', flammes: true }), false, 'jamais dans la vue MJ');
    egal(animationActive({ vue: 'table', flammes: false }), false, 'case décochée');
    egal(animationActive({ vue: 'table', flammes: true, mouvementReduit: true }), false, 'prefers-reduced-motion');
    egal(animationActive(), false, 'sans rien : non');
    egal([animationPossible(2000, 1500), animationPossible(5000, 5000), animationPossible(0, 100)], [true, false, false], 'surface');
    verifier(SURFACE_ANIMEE_MAX >= 8_000_000 && IMAGES_PAR_SECONDE <= 60 && IMAGES_PAR_SECONDE >= 24, 'bornes raisonnables');
  }],

  // --- Réglages ----------------------------------------------------------------------------------------------
  ['Pénombre et Flammes animées : 45 % et oui par défaut, valeurs invalides ignorées', () => {
    egal([penombreDeReglages({}), penombreDeReglages({ penombre: 0 }), penombreDeReglages({ penombre: 80 }), penombreDeReglages({ penombre: 101 }), penombreDeReglages({ penombre: '30' }), penombreDeReglages({ penombre: 12.5 })],
      [45, 0, 80, 45, 45, 45], 'pénombre');
    egal([flammesDeReglages({}), flammesDeReglages({ flammes: false }), flammesDeReglages({ flammes: 0 }), flammesDeReglages({ flammes: true })], [true, false, true, true], 'seul faux éteint les flammes');
    egal([penombreValide(0), penombreValide(100), penombreValide(-1), penombreValide(50.5)], [true, true, false, false], 'penombreValide');
    egal(optionsRendu({ penombre: 70, flammes: false }), { grille: 0.6, theme: 'peint', details: 'riches', relief: true, penombre: 70, flammes: false }, 'ce que le moteur reçoit');
  }],
  ['réglages enregistrés : un fichier d’avant la pénombre se relit sans rien perdre ; 45 % et « flammes oui » ne sont pas écrits', () => {
    egal(reglagesDe({ echelle: 1.5, taille: 48, grille: true }), { echelle: 1.5, taille: 48, grille: true }, 'ancien fichier : rien de plus');
    egal(reglagesDe({ echelle: 1.5, taille: 48, grille: true, penombre: 70, flammes: false }), { echelle: 1.5, taille: 48, grille: true, penombre: 70, flammes: false }, 'réglés');
    egal(reglagesDe({ echelle: 1.5, taille: 48, grille: true, penombre: 45, flammes: true }), { echelle: 1.5, taille: 48, grille: true }, 'valeurs par défaut : non gardées');
    egal(reglagesDe({ echelle: 1.5, taille: 48, grille: true, penombre: 300, flammes: 'non' }), { echelle: 1.5, taille: 48, grille: true }, 'valeurs invalides : ignorées');
    egal(reglagesDe({ echelle: 1.5, taille: 48, grille: true, penombre: 0 }).penombre, 0, 'zéro est un vrai réglage');
    egal(reglagesDe({ echelle: 1.5, taille: 48, grille: true, futur: 7 }).futur, 7, 'ce que cette version ne connaît pas est toujours gardé');
  }],
  ['table : pénombre et flammes voyagent seulement s’ils diffèrent du défaut, et se relisent champ par champ', () => {
    egal(affichageDeReglages({ taille: 48, grille: true }), { taille: 48, grille: true, reperes: true, mode: 'remplir' }, 'rien de plus par défaut');
    const a = affichageDeReglages({ taille: 48, grille: true, penombre: 20, flammes: false });
    egal(a, { taille: 48, grille: true, reperes: true, mode: 'remplir', penombre: 20, flammes: false }, 'réglés');
    egal(validerAffichage(a, AFFICHAGE_PAR_DEFAUT), { mode: 'remplir', taille: 48, grille: true, reperes: true, penombre: 20, flammes: false }, 'aller-retour');
    egal(validerAffichage({ penombre: 'noir', flammes: 'non' }, AFFICHAGE_PAR_DEFAUT), { mode: 'remplir', taille: 48, grille: true, reperes: true }, 'invalides : le défaut');
    egal(validerAffichage({ penombre: 0 }, AFFICHAGE_PAR_DEFAUT).penombre, 0, 'zéro voyage aussi');
    egal(optionsRendu(a).penombre, 20, 'ce que la table dessine');
  }],

  // --- Moteur : décor, lumière, pions ------------------------------------------------------------------------------
  ['moteur : la pénombre est celle de la vue (MJ réduite, table pleine) et de l’éclairage de la salle, la teinte celle de l’ambiance', () => {
    const opacite = (plan, o) => { const j = []; dessiner(canvasSimule(), plan, { taille: 32, theme: themeEspion(j), ...o }); return j.find((l) => l[0] === 'eclairer')[1]; };
    proche(opacite(rect(6, 6), { penombre: 45, vue: 'table' }), 0.45, 'table');
    proche(opacite(rect(6, 6), { penombre: 45, vue: 'mj' }), 0.45 * VUE_MJ, 'MJ');
    proche(opacite(rect(6, 6), {}), 0.45 * VUE_MJ, 'par défaut : vue MJ, pénombre 45 %');
    proche(opacite(rect(6, 6, { eclairage: 'eclairee' }), { penombre: 45, vue: 'table' }), 0.18, 'salle bien éclairée');
    proche(opacite(rect(6, 6, { eclairage: 'obscurite' }), { penombre: 45, vue: 'table' }), 0.72, 'salle dans le noir');
    const j = []; dessiner(canvasSimule(), rect(6, 6, { ambiance: 'froide' }), { theme: themeEspion(j) });
    egal(j.find((l) => l[0] === 'couche'), ['couche', 'froide'], 'l’ambiance de la salle teinte la couche sombre');
  }],
  ['moteur : la lumière passe entre le décor et les pions ; les pions restent au-dessus, aussi à pénombre pleine', () => {
    for (const penombre of [0, 45, 100]) {
      const j = [];
      dessiner(canvasSimule(), rect(6, 6, { objets: [torche], creatures: [pion] }), { taille: 32, theme: themeEspion(j), penombre, vue: 'table' });
      const noms = j.map((l) => l[0]);
      verifier(noms.indexOf('eclairer') >= 0 && noms.indexOf('pion') > noms.indexOf('eclairer'), `pénombre ${penombre} % : ${noms.join(', ')}`);
      egal(j.find((l) => l[0] === 'eclairer')[4], 1, 'la torche éclaire');
    }
  }],
  ['moteur : sans animation, le dessin est complet et les flammes restent celles des objets ; la scène rendue est fixe', () => {
    const j = [], scene = dessiner(canvasSimule(), rect(6, 6, { objets: [torche] }), { theme: themeEspion(j), vue: 'table', animer: false });
    egal(scene.anime, false, 'pas d’animation demandée');
    egal(j.filter((l) => l[0] === 'eclairer').length, 1, 'la lumière est posée une fois');
    egal(j.find((l) => l[0] === 'eclairer')[3], false, 'sans flammes animées');
    scene.image(500);
    egal(j.filter((l) => l[0] === 'eclairer').length, 1, '`image` ne fait rien');
  }],
  ['moteur : animer à la table garde le décor, et chaque image ne repose que la lumière, les flammes et les pions', () => avecToiles(() => {
    const j = [], plan = rect(6, 6, { objets: [torche], creatures: [pion] });
    const scene = dessiner(canvasSimule(), plan, { taille: 32, theme: themeEspion(j), vue: 'table', animer: true });
    egal(scene.anime, true, 'il y a une flamme à animer');
    egal(j.find((l) => l[0] === 'eclairer')[3], true, 'la lumière dessine les flammes');
    scene.image(100); scene.image(200);
    egal(j.filter((l) => l[0] === 'eclairer').map((l) => l[2]), [0, 100, 200], 'une lumière par image, à son instant');
    egal(j.filter((l) => l[0] === 'pion').length, 3, 'les pions sont redessinés à chaque image');
    egal(j.filter((l) => l[0] === 'couche').length, 1, 'la couche sombre n’est faite qu’une fois');
    egal(j.filter((l) => l[0] === 'eclairer').every((l) => l[4] === 1), true, 'la torche est la source de chaque image');
  })],
  ['moteur : jamais d’animation dans la vue MJ, ni sans lumière, ni sur un canevas trop grand ; le vectoriel ne change pas', () => avecToiles(() => {
    const j = [], plan = rect(6, 6, { objets: [torche] });
    egal(dessiner(canvasSimule(), plan, { theme: themeEspion(j), vue: 'mj', animer: true }).anime, false, 'vue MJ');
    egal(dessiner(canvasSimule(), rect(6, 6), { theme: themeEspion([]), vue: 'table', animer: true }).anime, false, 'aucune source : rien à animer');
    egal(dessiner(canvasSimule(), rect(90, 90, { objets: [torche] }), { taille: 48, theme: themeEspion([]), vue: 'table', animer: true }).anime, false, 'canevas trop grand');
    const s = dessiner(canvasSimule(), plan, { theme: THEMES.vectoriel, vue: 'table', animer: true, penombre: 100 });
    egal([s.anime, 'creerCouche' in THEMES.vectoriel, 'eclairer' in THEMES.vectoriel], [false, false, false], 'vectoriel : pas de lumière, pas d’animation');
  })],
  ['moteur : la lumière est posée dans le repère de la salle, marge comprise', () => {
    const matrices = [];
    const theme = { ...THEMES.peint, eclairer: (ctx, couche, p) => matrices.push(p.salle) };
    const canvas = canvasSimule();
    avecEcranSimule(() => dessiner(canvas, rect(6, 6), { taille: 40, theme }), 2);
    egal(matrices[0], [2, 0, 0, 2, MARGE * 40 * 2, MARGE * 40 * 2], 'dpr 2, origine au coin nord-ouest de la salle');
  }],

  // --- Boucle d'animation ----------------------------------------------------------------------------------------------
  ['animation : une seule boucle, même quand on suit plusieurs scènes de suite', () => {
    const b = banc();
    b.animation.suivre(b.scene()); b.animation.suivre(b.scene()); b.animation.suivre(b.scene());
    egal(b.attendus.size, 1, 'une seule image demandée');
    b.avancer(1000); b.avancer(2000);
    egal(b.attendus.size, 1, 'toujours une seule');
    egal(b.images, [1000, 2000], 'seule la dernière scène joue');
  }],
  ['animation : cadencée, arrêtée par une scène sans flammes ou par arreter()', () => {
    const b = banc();
    b.animation.suivre(b.scene());
    b.avancer(1000); b.avancer(1005); b.avancer(1040);
    egal(b.images, [1000, 1040], 'pas plus de ~30 images par seconde');
    b.animation.suivre(b.scene(false));
    egal([b.attendus.size, b.animation.tourne()], [0, false], 'une scène fixe ne lance rien');
    b.animation.suivre(b.scene());
    b.animation.arreter();
    egal([b.attendus.size, b.animation.tourne()], [0, false], 'arreter() coupe la boucle');
    b.animation.suivre(null);
    egal(b.attendus.size, 0, 'pas de scène : rien');
  }],
  ['animation : s’arrête quand la vue ne se voit pas (onglet caché, canevas masqué) et repart quand elle revient', () => {
    const b = banc();
    b.animation.suivre(b.scene());
    b.animation.visible(false);
    egal([b.attendus.size, b.animation.tourne()], [0, false], 'canevas masqué : plus de boucle');
    b.animation.visible(false);
    b.animation.visible(true);
    egal(b.attendus.size, 1, 'revenu : une boucle, pas deux');
    b.cache = true;
    b.avancer(3000);
    egal([b.images.length, b.attendus.size], [0, 0], 'onglet caché : l’image en attente ne dessine rien et ne se redemande pas');
    b.cache = false;
    b.animation.visible(true);
    egal(b.attendus.size, 1, 'onglet revenu : repart');
    const c = banc({ cache: true });
    c.animation.suivre(c.scene());
    egal(c.attendus.size, 0, 'une scène suivie dans un onglet caché ne lance rien');
  }],
  ['animation : sans navigateur (pas de requestAnimationFrame), rien ne plante ni ne tourne', () => {
    const a = creerAnimation(null, { raf: null, annuler: null, cache: () => false }); // raf null = pas de navigateur, même dans un navigateur
    a.suivre({ anime: true, image() { throw new Error('ne doit pas jouer'); } });
    egal(a.tourne(), false, 'pas de boucle');
    a.arreter();
  }],
];

export const executer = () => executerSuite('lumière : ', TESTS, avecEcranSimule);
