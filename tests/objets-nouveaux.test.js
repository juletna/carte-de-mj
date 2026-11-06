/**
 * Tests des dix objets du lot 5 (brasero, bougies, tapis, bannière, feu de camp, flaque, rocher, champignons, toile d'araignée, ossements) :
 * leurs données du catalogue, la façon dont la description les redit, le coin d'une toile, leurs sources de lumière dans le thème peint, et leur
 * dessin dans les trois thèmes. Les mots du parseur (singulier, pluriel, synonymes, conflits) sont dans tests/phrases.js. Sans dépendance.
 */
import { OBJETS, nomDe, estFeminin, coucheDe, lettreDe } from '../js/catalogue.js';
import { nomAffiche, definition } from '../js/parseur/lexique.js';
import { analyser } from '../js/parseur/index.js';
import { decrire } from '../js/parseur/decrire.js';
import { evaluerPose } from '../js/pose.js';
import { THEMES as THEMES_ECRAN } from '../js/rendu/themes/index.js';
import * as papier from '../js/rendu/themes/papier.js';
import { sensDuCoin } from '../js/rendu/themes/commun.js';
import { objets as objetsPeints } from '../js/rendu/themes/peint/objets.js';
import { etat } from '../js/rendu/themes/peint/etat.js';
import { dessiner } from '../js/rendu/moteur.js';
import { verifier, egal, executerSuite, avecEcranSimule } from './mini-test.js';

const THEMES = { ...THEMES_ECRAN, papier };
const NOUVEAUX = ['brasero', 'bougies', 'tapis', 'banniere', 'feudecamp', 'flaque', 'rocher', 'champignons', 'toile', 'ossements'];
const rect = (largeur, longueur, plus = {}) => ({ id: 'n1', largeur, longueur, sol: 'pierre', portes: [], objets: [], creatures: [], ...plus });

function ctxPermissif() {
  const degrade = () => ({ addColorStop() {} });
  return new Proxy({}, {
    get: (_, nom) => (typeof nom === 'symbol' ? undefined : nom === 'createRadialGradient' || nom === 'createLinearGradient' ? degrade : nom === 'measureText' ? (s) => ({ width: String(s).length * 6 }) : () => {}),
    set: () => true,
  });
}
function ctxJournal() {
  const lignes = [];
  const fmt = (a) => a.map((v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)).join(',');
  const ctx = new Proxy({}, {
    get: (_, nom) => (typeof nom === 'symbol' ? undefined
      : nom === 'createRadialGradient' || nom === 'createLinearGradient' ? (...a) => { lignes.push(`${nom}(${fmt(a)})`); return { addColorStop: () => {} }; }
      : (...a) => { lignes.push(`${nom}(${fmt(a)})`); }),
    set: (_, nom, v) => { lignes.push(`${nom}=${v}`); return true; },
  });
  return { ctx, lignes };
}

/** Les sources déclarées par un objet du thème peint posé en (4, 3) d'une salle de 9 par 7. */
function lumieres(type, { relief = true, flammes = false } = {}) {
  const { ctx } = ctxJournal();
  THEMES.peint.preparer(ctx, rect(9, 7, { id: 'l' }), 48, { relief, flammes });
  objetsPeints[type](ctx, 48, 48, 48, { type, x: 4, y: 3, l: 1, h: 1, rotation: 180 });
  return [...etat.lumieres];
}
/** Le nombre de tracés d'un objet du thème peint, flammes fixes ou animées ailleurs. */
function tracesPeint(type, flammes) {
  const { ctx, lignes } = ctxJournal();
  THEMES.peint.preparer(ctx, rect(9, 7, { id: 'l' }), 48, { relief: true, flammes });
  objetsPeints[type](ctx, 48, 48, 48, { type, x: 4, y: 3, l: 1, h: 1, rotation: 180 });
  return lignes.length;
}

const TESTS = [
  ['catalogue : les dix objets, avec leur nom, leur genre, leur lettre unique, leur zone et leur couche', () => {
    egal(NOUVEAUX.every((t) => OBJETS.some((o) => o.type === t)), true, 'les dix types existent');
    egal(NOUVEAUX.map(nomDe), ['brasero', 'bougie', 'tapis', 'bannière', 'feu de camp', 'flaque', 'rocher', 'champignon', 'toile d’araignée', 'ossement'], 'noms affichés');
    egal(NOUVEAUX.filter(estFeminin), ['bougies', 'banniere', 'flaque', 'toile'], 'féminins');
    egal(NOUVEAUX.map((t) => definition(t).zone), ['coins', 'aleatoire', 'centre', 'perimetre', 'centre', 'aleatoire', 'aleatoire', 'coins', 'coins', 'aleatoire'], 'zones par défaut');
    egal(NOUVEAUX.map((t) => definition(t).bloquant !== false), [true, false, false, false, true, false, true, false, false, false], 'ce qui bloque le passage');
    egal(NOUVEAUX.map(coucheDe), [5, 6, -1, 8, 5, 0, 5, 5, 7, 2], 'couches : le tapis et la flaque au sol, la bannière accrochée au mur');
    egal([definition('tapis').l, definition('tapis').h, definition('flaque').l, definition('flaque').h], [3, 2, 2, 1], 'tapis 3×2, flaque 2×1');
    const lettres = NOUVEAUX.map(lettreDe);
    verifier(lettres.every(Boolean) && new Set(lettres).size === 10, `lettres : ${lettres}`);
    // La torche garde ses mots d'avant, moins « brasero » et « chandelier » qui ont chacun leur objet.
    egal(definition('torche').mots, ['torche', 'flambeau'], 'torche');
  }],
  ['noms au pluriel : « feux de camp », « toiles d’araignée », les autres prennent un « s » et tapis ne change pas', () => {
    egal([nomAffiche('feudecamp', 3), nomAffiche('toile', 2), nomAffiche('bougies', 5), nomAffiche('banniere', 2), nomAffiche('tapis', 2), nomAffiche('champignons', 2), nomAffiche('ossements', 3), nomAffiche('rocher', 2)],
      ['feux de camp', 'toiles d’araignée', 'bougies', 'bannières', 'tapis', 'champignons', 'ossements', 'rochers'], 'pluriels');
    egal(nomAffiche('feudecamp'), 'feu de camp', 'singulier');
  }],
  ['la description redit les nouveaux objets, accordés, et la relecture redonne le même plan', () => {
    const { plan } = analyser('salle de 12 par 12 cases, un brasero, deux bougies, un tapis, une bannière, un feu de camp, une flaque, un rocher, un champignon, une toile d’araignée, un ossement');
    const texte = decrire(plan);
    for (const morceau of ['un brasero', 'deux bougies', 'un tapis', 'une bannière', 'un feu de camp', 'une flaque', 'un rocher', 'un champignon', 'une toile d’araignée', 'un ossement']) {
      verifier(texte.includes(morceau), `« ${morceau} » manque dans : ${texte}`);
    }
    const relu = analyser(texte).plan;
    const resume = (p) => p.objets.map((o) => `${o.type} ${o.x},${o.y} ${o.l}x${o.h}`).sort();
    egal(resume(relu), resume(plan), 'même plan');
    const deux = decrire(analyser('salle de 12 par 12 cases, deux feux de camp, deux toiles d’araignée').plan);
    verifier(deux.includes('deux feux de camp') && deux.includes('deux toiles d’araignée'), `pluriels : ${deux}`);
  }],
  ['placement par défaut : un tapis au centre, les bannières contre les murs, une toile dans un coin ; ni tapis, flaque ni bougies ne bloquent', () => {
    const { plan } = analyser('salle de 12 par 12 cases, un tapis, une table, une toile d’araignée, un rocher');
    const tapis = plan.objets.find((o) => o.type === 'tapis'), toile = plan.objets.find((o) => o.type === 'toile'), table = plan.objets.find((o) => o.type === 'table');
    verifier(tapis.x > 0 && tapis.y > 0 && tapis.x + tapis.l < plan.largeur && tapis.y + tapis.h < plan.longueur, 'le tapis est loin des murs');
    verifier((toile.x === 0 || toile.x === plan.largeur - 1) && (toile.y === 0 || toile.y === plan.longueur - 1), 'la toile est dans un coin');
    verifier(table, 'la table reste posée sur le tapis (le tapis ne bloque pas)');
    const sur = (type) => evaluerPose(plan, 'objet', { type, l: 1, h: 1 }, table.x, table.y).ok;
    egal([sur('tapis'), sur('flaque'), sur('bougies'), sur('ossements'), sur('rocher'), sur('brasero')], [true, true, true, true, false, false], 'poser sur la table : seuls les objets qui ne bloquent pas passent');
  }],
  ['sensDuCoin : la toile se loge dans le coin de la salle le plus proche, dans le repère local de l’objet', () => {
    const plan = { largeur: 8, longueur: 6 };
    const coin = (x, y, rotation) => sensDuCoin({ x, y, l: 1, h: 1, rotation }, plan);
    egal(coin(0, 0, 180), [-1, -1], 'nord-ouest, objet non pivoté');
    egal(coin(7, 0, 180), [1, -1], 'nord-est');
    egal(coin(0, 5, 180), [-1, 1], 'sud-ouest');
    egal(coin(7, 5, 180), [1, 1], 'sud-est');
    egal(coin(0, 0, 0), [1, 1], 'tourné de 180° : le coin nord-ouest est en bas à droite du dessin');
    egal(coin(7, 0, 90), [1, 1], 'tourné de −90° : le coin nord-est passe en bas à droite');
    egal(coin(0, 0, 270), [-1, 1], 'tourné de 90° : le coin nord-ouest passe en bas à gauche');
    egal(sensDuCoin({ x: 0, y: 0, l: 1, h: 1, rotation: 0 }), [-1, -1], 'sans plan (vignette) : en haut à gauche');
  }],
  ['peint : sources de lumière — brasero et feu de camp éclairent fort, bougies et champignons doucement (cyan, sans flamme), le reste pas du tout', () => {
    const [brasero] = lumieres('brasero'), [feu] = lumieres('feudecamp'), [champi] = lumieres('champignons'), bougies = lumieres('bougies');
    egal([lumieres('brasero').length, lumieres('feudecamp').length, lumieres('champignons').length, bougies.length], [1, 1, 1, 3], 'nombre de sources');
    verifier(brasero.s > 0 && feu.s > 0 && brasero.k >= 0.6 && feu.k >= 0.8, 'flammes et forte lumière');
    verifier(feu.r > brasero.r && brasero.r > bougies[0].r, 'rayon : feu de camp > brasero > bougie');
    verifier(bougies.every((b) => b.petite === true && b.s > 0 && b.k < 0.4), 'bougies : petites flammes, faible lumière');
    egal([champi.s, champi.c], [0, '90,230,215'], 'champignons : halo cyan, pas de flamme');
    for (const type of ['tapis', 'banniere', 'flaque', 'rocher', 'toile', 'ossements']) egal(lumieres(type).length, 0, `${type} : aucune source`);
    for (const s of [brasero, feu, champi, ...bougies]) for (const k of ['x', 'y', 'r', 'k']) verifier(Number.isFinite(s[k]), `source : ${k}`);
    verifier(lumieres('brasero', { relief: false }).length === 1, 'sans relief aussi');
  }],
  ['peint : brasero, bougies et feu de camp dessinent leur flamme tant qu’elle n’est pas animée ailleurs ; les champignons n’en ont pas', () => {
    for (const type of ['brasero', 'bougies', 'feudecamp']) verifier(tracesPeint(type, true) < tracesPeint(type, false), `${type} : flamme fixe seulement quand elle n’est pas animée`);
    egal(tracesPeint('champignons', true), tracesPeint('champignons', false), 'champignons : jamais de flamme');
  }],
  ['peint : la bannière se plaque sur la face du mur avec le relief, et se voit du dessus sans relief', () => {
    const avec = (relief) => { const { ctx, lignes } = ctxJournal(); THEMES.peint.preparer(ctx, rect(9, 7), 48, { relief }); objetsPeints.banniere(ctx, 48, 48, 48, { type: 'banniere', x: 4, y: 0, l: 1, h: 1, rotation: 180 }); return lignes; };
    verifier(avec(true).length > 0 && avec(false).length > 0, 'les deux dessins existent');
    verifier(avec(true).join('|') !== avec(false).join('|'), 'le dessin de la face du mur n’est pas celui du dessus');
    egal(avec(true).join('|'), avec(true).join('|'), 'déterministe');
  }],
  ['les trois thèmes ancrent la toile dans le coin de la salle le plus proche', () => {
    const plan = rect(6, 6);
    for (const nom of ['vectoriel', 'papier']) {
      const ancre = (x, y, rotation) => { const { ctx, lignes } = ctxJournal(); THEMES[nom].objets.toile(ctx, 48, 48, 48, { type: 'toile', x, y, l: 1, h: 1, rotation }, plan); return lignes.find((l) => l.startsWith('moveTo(')); };
      egal(ancre(0, 0, 180), 'moveTo(-24,-24)', `${nom} : coin nord-ouest`);
      egal(ancre(5, 0, 180), 'moveTo(24,-24)', `${nom} : coin nord-est`);
      egal(ancre(5, 5, 180), 'moveTo(24,24)', `${nom} : coin sud-est`);
      egal(ancre(0, 0, 0), 'moveTo(24,24)', `${nom} : objet pivoté, le coin tourne avec lui`);
    }
    const { ctx, lignes } = ctxJournal();
    THEMES.peint.preparer(ctx, plan, 48, { relief: true });
    objetsPeints.toile(ctx, 48, 48, 48, { type: 'toile', x: 5, y: 5, l: 1, h: 1, rotation: 180 }, plan);
    verifier(lignes.includes('moveTo(24,24)'), 'peint : coin sud-est');
  }],
  ['le moteur donne la salle au dessin de l’objet (sixième argument)', () => {
    const plan = rect(6, 6, { objets: [{ id: 'o1', type: 'toile', x: 0, y: 0, l: 1, h: 1, rotation: 180 }] });
    let recu = null;
    const theme = { ...THEMES.vectoriel, objets: { ...THEMES.vectoriel.objets, toile: (ctx, w, h, t, o, p) => { recu = p; } } };
    const canvas = { width: 0, height: 0, style: {}, getContext: () => ctxPermissif() };
    avecEcranSimule(() => dessiner(canvas, plan, { taille: 32, theme })); // le moteur lit la densité de l'écran
    verifier(recu === plan, 'le plan est passé au dessin');
  }],
  ['dans chaque thème, chaque nouvel objet se dessine à plat comme en volume sans valeur invalide, à toutes les rotations', () => {
    for (const [nom, theme] of Object.entries(THEMES)) {
      for (const type of NOUVEAUX) {
        const def = definition(type);
        for (const rotation of [0, 90, 180, 270]) {
          const quart = rotation === 90 || rotation === 270;
          const { ctx, lignes } = ctxJournal();
          theme.preparer?.(ctx, rect(9, 7, { id: 'v' }), 48, { relief: true });
          theme.objets[type](ctx, (quart ? def.h : def.l) * 48, (quart ? def.l : def.h) * 48, 48, { type, x: 2, y: 2, l: def.l, h: def.h, rotation }, rect(9, 7));
          verifier(lignes.length > 0, `${nom} · ${type} : rien de tracé`);
          const faux = lignes.find((l) => /NaN|undefined|Infinity/.test(l));
          verifier(!faux, `${nom} · ${type} · ${rotation}° : valeur invalide : ${faux}`);
        }
      }
    }
  }],
  ['papier : les nouveaux objets restent en noir, blanc et gris (lisibles à l’impression, sans aplat de couleur)', () => {
    for (const type of NOUVEAUX) {
      const def = definition(type);
      const { ctx, lignes } = ctxJournal();
      THEMES.papier.objets[type](ctx, def.l * 48, def.h * 48, 48, { type, x: 2, y: 2, l: def.l, h: def.h, rotation: 180 }, rect(9, 7));
      const couleurs = lignes.filter((l) => /^(fillStyle|strokeStyle)=/.test(l)).map((l) => l.split('=')[1]);
      const colorees = couleurs.filter((c) => !/^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgba?\(.*\))$/i.test(c) || (/^#[0-9a-f]{6}$/i.test(c) && !(c[1] === c[3] && c[3] === c[5] && c[2] === c[4] && c[4] === c[6])));
      verifier(colorees.length === 0, `papier · ${type} : couleurs non grises ${[...new Set(colorees)]}`);
    }
  }],
];

export const executer = () => executerSuite('objets du lot 5 : ', TESTS, avecEcranSimule);
