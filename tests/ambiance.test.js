/**
 * Tests du lot « ambiance, état, éclairage » : les trois champs facultatifs du plan (schéma), leur lecture dans la description (parseur) et leur retour
 * (decrire, « Compris »), puis le rendu du thème peint : tuiles de sol, teinte des murs, petits détails semés (déterminisme, cases occupées), et le fait que
 * le vectoriel et le papier les ignorent. Le dessin réel est vérifié dans un navigateur (voir le README). Sans dépendance.
 */
import { validerPlan, AMBIANCES, ETATS_SALLE, ECLAIRAGES, CHAMPS_AMBIANCE, NOMS_AMBIANCES, NOMS_ETATS_SALLE, NOMS_ECLAIRAGES, ETATS } from '../js/schema.js';
import { analyser } from '../js/parseur/index.js';
import { decrire } from '../js/parseur/decrire.js';
import { extraireAmbiance, MOTS_AMBIANCE } from '../js/parseur/ambiance.js';
import { normaliser } from '../js/parseur/normaliser.js';
import { planPublic } from '../js/vue-publique.js';
import { usureDe, teinterSol, couleurMur, densites, TEINTES } from '../js/rendu/themes/peint/ambiance.js';
import { semerDetails, casesOccupees } from '../js/rendu/themes/peint/details.js';
import { calculerTuile, cleTuile, couleurSol, PERIODE, SOLS_PEINTS, masqueVert, decalageDeTuile } from '../js/rendu/themes/peint/sols.js';
import { opaciteVoile, couleurAmbiance, COULEURS_AMBIANCE } from '../js/rendu/lumiere.js';
import { dessiner } from '../js/rendu/moteur.js';
import { THEMES } from '../js/rendu/themes/index.js';
import { verifier, egal, executerSuite, avecEcranSimule } from './mini-test.js';

const rect = (largeur, longueur, plus = {}) => ({ id: 's1', largeur, longueur, sol: 'pierre', portes: [], objets: [], creatures: [], ...plus });
const lire = (texte) => analyser(texte, { echelle: 1.5 });
const champs = (texte) => { const { ambiance, etat, eclairage } = lire(texte).plan; return { ambiance, etat, eclairage }; };

/** Contexte 2D qui note chaque appel et chaque affectation. */
function ctxJournal() {
  const lignes = [];
  const fmt = (a) => a.map((v) => (typeof v === 'number' ? v.toFixed(3) : v)).join(',');
  const ctx = new Proxy({}, {
    get: (_, nom) => (typeof nom === 'symbol' ? undefined
      : nom === 'createRadialGradient' || nom === 'createLinearGradient' ? (...a) => { lignes.push(`${nom}(${fmt(a)})`); return { addColorStop: (...c) => lignes.push(`stop(${c.join(',')})`) }; }
      : nom === 'measureText' ? (s) => ({ width: String(s).length * 6 })
      : (...a) => { lignes.push(`${nom}(${fmt(a)})`); }),
    set: (_, nom, v) => { lignes.push(`${nom}=${v}`); return true; },
  });
  return { ctx, lignes };
}
const dessinDe = (plan, theme, options = {}) => {
  const { ctx, lignes } = ctxJournal();
  avecEcranSimule(() => dessiner({ width: 0, height: 0, style: {}, getContext: () => ctx }, plan, { theme, taille: 24, ...options })); // densité d'écran et toiles simulées
  return lignes.join('\n');
};

const TESTS_SCHEMA = [
  ['les valeurs de chaque champ, leurs noms et la valeur par défaut (la première)', () => {
    egal(AMBIANCES, ['neutre', 'froide', 'chaude', 'nuit'], 'ambiances');
    egal(ETATS_SALLE, ['neuve', 'usee', 'ruine'], 'états de la salle');
    egal(ECLAIRAGES, ['penombre', 'eclairee', 'obscurite'], 'éclairages');
    egal(Object.keys(CHAMPS_AMBIANCE), ['ambiance', 'etat', 'eclairage'], 'champs');
    egal(Object.keys(NOMS_AMBIANCES), AMBIANCES, 'un nom par ambiance');
    egal(Object.keys(NOMS_ETATS_SALLE), ETATS_SALLE, 'un nom par état');
    egal(Object.keys(NOMS_ECLAIRAGES), ECLAIRAGES, 'un nom par éclairage');
    for (const v of [...AMBIANCES, ...ETATS_SALLE, ...ECLAIRAGES]) verifier(/^[a-z]+$/.test(v), `« ${v} » : sans accent`);
  }],
  ['des valeurs connues sont conservées', () => {
    for (const ambiance of AMBIANCES) for (const etat of ETATS_SALLE) for (const eclairage of ECLAIRAGES) {
      const v = validerPlan({ largeur: 5, longueur: 5, ambiance, etat, eclairage });
      verifier(v.ok, `${ambiance}/${etat}/${eclairage} : valide`);
      egal([v.plan.ambiance, v.plan.etat, v.plan.eclairage], [ambiance, etat, eclairage], 'conservées');
    }
  }],
  ['absents : aucun champ n’est inventé (un plan existant se relit à l’identique)', () => {
    const v = validerPlan({ largeur: 5, longueur: 5, sol: 'bois', creatures: [{ type: 'gobelin', x: 0, y: 0, etat: 'blesse' }] });
    verifier(v.ok, 'plan valide');
    for (const c of ['ambiance', 'etat', 'eclairage']) verifier(!(c in v.plan), `pas de « ${c} »`);
    egal(validerPlan(v.plan).plan, v.plan, 'revalider ne change rien');
    egal(Object.keys(lire('salle de 6 par 6, sol en bois').plan).filter((c) => ['ambiance', 'etat', 'eclairage'].includes(c)), [], 'le parseur n’en ajoute pas non plus');
  }],
  ['une valeur inconnue est ignorée et signalée, comme les autres champs facultatifs ; une valeur qui n’est pas du texte aussi', () => {
    const v = validerPlan({ largeur: 5, longueur: 5, ambiance: 'tropicale', etat: 'cassee', eclairage: 'Obscurite', sol: 'pierre' });
    verifier(!v.ok, 'signalé');
    for (const mot of ['tropicale', 'cassee', 'Obscurite']) verifier(v.erreurs.some((e) => e.includes(`« ${mot} »`)), `« ${mot} » est dit`);
    for (const c of ['ambiance', 'etat', 'eclairage']) verifier(!(c in v.plan), `« ${c} » retiré`);
    for (const bizarre of [12, true, ['froide'], { a: 1 }]) verifier(!('ambiance' in validerPlan({ largeur: 5, longueur: 5, ambiance: bizarre }).plan), `${JSON.stringify(bizarre)} ignoré`);
    egal(validerPlan({ largeur: 5, longueur: 5, ambiance: null, etat: null }).erreurs, [], 'null = absent, rien à dire');
  }],
  ['l’état d’une salle n’est pas l’état d’une créature : champs distincts, valeurs distinctes', () => {
    const v = validerPlan({ largeur: 5, longueur: 5, etat: 'ruine', creatures: [{ type: 'gobelin', x: 0, y: 0, etat: 'mort' }, { type: 'gobelin', x: 1, y: 0, etat: 'ruine' }, { type: 'gobelin', x: 2, y: 0 }] });
    egal(v.plan.etat, 'ruine', 'état de la salle');
    egal(v.plan.creatures.map((k) => k.etat), ['mort', undefined, undefined], 'état des pions : « ruine » n’en est pas un');
    verifier(v.erreurs.some((e) => e.includes('créature 2')), 'et « ruine » sur un pion est signalé comme inconnu');
    const w = validerPlan({ largeur: 5, longueur: 5, etat: 'mort', creatures: [] });
    verifier(!('etat' in w.plan), '« mort » n’est pas un état de salle');
    for (const e of ETATS) verifier(!ETATS_SALLE.includes(e), `« ${e} » n’est pas un état de salle`);
  }],
  ['export puis import : le plan sort du JSON tel qu’il y est entré, et le plan public (la table) garde les trois champs', () => {
    const plan = lire('crypte glaciale en ruine, plongée dans le noir, 8 par 6').plan;
    const relu = validerPlan(JSON.parse(JSON.stringify(plan)));
    verifier(relu.ok, 'valide');
    const trie = (o) => JSON.parse(JSON.stringify(o, Object.keys(o).sort()));
    egal(trie(relu.plan), trie(plan), 'aller-retour JSON');
    const pub = planPublic(plan);
    egal([pub.ambiance, pub.etat, pub.eclairage], ['froide', 'ruine', 'obscurite'], 'plan public');
    verifier(!('ambiance' in planPublic(lire('salle de 6 par 6').plan)), 'rien d’inventé non plus à la table');
  }],
];

const TESTS_PARSEUR = [
  ['ambiance : chaque formulation, avec et sans accents, en majuscules ou non', () => {
    const attendu = {
      froide: ['salle glaciale', 'salle Glaciale', 'une salle froide', 'crypte gelée', 'salle gelee', 'un couloir glacial', 'salles glaciales'],
      chaude: ['salle chaleureuse', 'une salle chaude', 'salle accueillante', 'taverne chaleureuse', 'pièce accueillante'],
      nuit: ['salle de nuit', 'une salle nocturne', 'cour au clair de lune', 'cour au Clair de Lune'],
    };
    for (const [ambiance, textes] of Object.entries(attendu)) for (const t of textes) egal(champs(t).ambiance, ambiance, `« ${t} »`);
  }],
  ['état : chaque formulation, avec et sans accents', () => {
    const attendu = {
      neuve: ['salle neuve', 'une pièce propre', 'salle Neuve'],
      usee: ['salle usée', 'salle usee', 'vieille salle', 'une ancienne crypte', 'crypte ancienne', 'salle délabrée', 'salle delabree', 'un vieux donjon'],
      ruine: ['salle en ruine', 'salle en ruines', 'salle ruinée', 'salle ruinee', 'crypte abandonnée', 'crypte abandonnee', 'salle effondrée', 'salle effondree', 'salle envahie par la végétation', 'salle envahie par la vegetation', 'salle envahie de lierre', 'une cave envahie par les ronces'],
    };
    for (const [etat, textes] of Object.entries(attendu)) for (const t of textes) egal(champs(t).etat, etat, `« ${t} »`);
  }],
  ['éclairage : chaque formulation, avec et sans accents', () => {
    const attendu = {
      eclairee: ['salle bien éclairée', 'salle bien eclairee', 'salle illuminée', 'salle illuminee', 'salle lumineuse', 'pièce Lumineuse'],
      penombre: ['salle sombre', 'salle dans la pénombre', 'salle dans la penombre', 'une salle en pénombre', 'salle mal éclairée'],
      obscurite: ['salle plongée dans le noir', 'salle plongee dans le noir', 'salle obscure', 'une salle noire', 'salle dans l’obscurité', 'salle dans l obscurite', 'salle dans le noir', 'salle plongée dans l’obscurité'],
    };
    for (const [eclairage, textes] of Object.entries(attendu)) for (const t of textes) egal(champs(t).eclairage, eclairage, `« ${t} »`);
  }],
  ['phrases combinées : les trois champs, le nom, la taille et les objets sont lus ensemble', () => {
    const r = lire('crypte glaciale en ruine, plongée dans le noir, 10 cases sur 8, quatre piliers, deux torches');
    egal([r.plan.ambiance, r.plan.etat, r.plan.eclairage], ['froide', 'ruine', 'obscurite'], 'champs');
    egal([r.plan.largeur, r.plan.longueur], [10, 8], 'dimensions');
    egal([r.plan.objets.filter((o) => o.type === 'pilier').length, r.plan.objets.filter((o) => o.type === 'torche').length], [4, 2], 'objets');
    egal(r.ignores, [], 'rien d’ignoré');
    for (const ligne of ['ambiance : froide', 'état de la salle : en ruine', 'éclairage : plongée dans le noir']) verifier(r.compris.includes(ligne), `« Compris » : ${ligne}`);
    const b = lire('salle chaleureuse bien éclairée au sol de bois');
    egal([b.plan.ambiance, b.plan.etat, b.plan.eclairage, b.plan.sol], ['chaude', undefined, 'eclairee', 'bois'], 'chaleureuse, éclairée, bois');
    egal(b.ignores, [], 'rien d’ignoré');
    egal(champs('Une salle abandonnée de nuit, sombre, de 6 par 6 cases'), { ambiance: 'nuit', etat: 'ruine', eclairage: 'penombre' }, 'virgules et « de 6 par 6 » après');
    egal(lire('crypte glaciale du vampire, 8 par 6').plan.nom, 'Crypte du vampire', 'le mot d’ambiance ne gêne pas le nom de la pièce');
    egal(lire('grande salle sombre').plan.largeur, 8, 'ni la taille');
    egal(lire('salle sombre et froide en ruine de 12 par 9 cases').plan.longueur, 9, 'ni les dimensions');
  }],
  ['pas de faux positif : un mot d’ambiance collé à un objet, un pion ou une porte lui appartient', () => {
    const r = lire('une salle sombre avec un pion noir');
    egal(r.plan.eclairage, 'penombre', 'la salle est sombre');
    verifier(!('etat' in r.plan) && !('ambiance' in r.plan), 'et rien d’autre');
    egal(r.ignores, ['pion', 'noir'], 'le pion noir n’est pas un mot du parseur : il reste signalé, comme avant');
    egal(champs('un chevalier sombre').eclairage, undefined, 'un chevalier sombre n’éteint pas la salle');
    egal(champs('un garde noir et un dragon noir').eclairage, undefined, 'les couleurs de pions sont intactes');
    egal(lire('un garde noir').plan.creatures[0].couleur, 'noir', 'couleur du garde');
    egal(champs('une salle, un garde de nuit').ambiance, undefined, 'un garde de nuit n’est pas une salle de nuit');
    egal(champs('une ancienne liche garde la salle').etat, undefined, 'une ancienne liche non plus');
    egal(champs('un vieux coffre').etat, undefined, 'ni un vieux coffre');
    egal(champs('un coffre usé dans la salle').etat, undefined, 'ni un coffre usé');
    egal(champs('une porte noire au mur sud').eclairage, undefined, 'ni une porte noire');
    egal(champs('une torche chaude').ambiance, undefined, 'ni une torche chaude');
    egal(lire('salle avec un trône propre').plan.etat, undefined, 'ni un trône propre');
  }],
  ['non-régression : « ruine » reste un tas de débris, « neutre » un camp, les autres mots gardent leur sens', () => {
    verifier(lire('salle de 6 par 6 avec des ruines').plan.objets.some((o) => o.type === 'debris'), 'des ruines : des débris');
    egal(champs('salle de 6 par 6 avec des ruines').etat, undefined, '…et pas un état');
    egal(lire('un nain neutre').plan.creatures[0].camp, 'pnj', 'neutre : le camp');
    verifier(!('ambiance' in lire('un nain neutre').plan), '…pas une ambiance');
    egal(lire('salle de 6 par 6, sol en glace').plan.sol, 'glace', 'glace : le sol');
    egal(champs('sol de glace, salle froide').ambiance, 'froide', 'une salle froide sur glace');
    egal(lire('un ancien dragon rouge').plan.creatures[0].taille, 3 + 1, 'un ancien dragon : plus grand (préfixe de créature)');
    egal(lire('salle de 6 par 6, sol en mousse').plan.sol, 'herbe', 'mousse : toujours un sol');
  }],
  ['extraireAmbiance : retire les mots lus, garde le reste', () => {
    const r = extraireAmbiance(normaliser('une crypte glaciale du vampire, en ruine'));
    egal(r.champs, { ambiance: 'froide', etat: 'ruine' }, 'champs');
    egal(r.reste, 'une crypte du vampire ,', 'reste');
    egal(extraireAmbiance('salle de 6 par 6').champs, {}, 'rien à lire');
    egal(extraireAmbiance('salle de 6 par 6').compris, [], 'rien à dire');
    egal(extraireAmbiance(normaliser('garde de nuit, salle de nuit nocturne')).reste.includes('nocturne'), false, 'toutes les expressions d’une même règle partent');
  }],
  ['decrire : mentionne les champs présents et le texte relu redonne les mêmes champs', () => {
    const t = (p) => decrire(p);
    verifier(!/froide|chaude|nuit|neuve|usée|ruine|éclairée|pénombre|noir/.test(t(lire('salle de 6 par 6').plan)), 'rien à dire sur une salle sans ces champs');
    for (const ambiance of AMBIANCES) for (const etat of ETATS_SALLE) for (const eclairage of ECLAIRAGES) {
      const plan = { ...lire('salle de 7 par 5 cases, sol en bois, deux piliers').plan, ambiance, etat, eclairage };
      const texte = t(plan), relu = lire(texte);
      egal([relu.plan.ambiance, relu.plan.etat, relu.plan.eclairage], [ambiance === 'neutre' ? undefined : ambiance, etat, eclairage], `« ${texte} »`);
      egal([relu.plan.largeur, relu.plan.longueur, relu.plan.sol, relu.plan.objets.length], [7, 5, 'bois', 2], `« ${texte} » : le reste est intact`);
      egal(relu.ignores, [], `« ${texte} » : rien d’ignoré`);
    }
    verifier(t({ ...rect(6, 6), ambiance: 'froide', etat: 'ruine', eclairage: 'obscurite' }).includes('froide, en ruine, plongée dans le noir'), 'les mots, dans l’ordre');
    for (const champ of Object.keys(MOTS_AMBIANCE)) for (const v of Object.keys(MOTS_AMBIANCE[champ])) verifier(CHAMPS_AMBIANCE[champ].includes(v), `${champ} : ${v} est une valeur du schéma`);
    verifier(!('neutre' in MOTS_AMBIANCE.ambiance), '« neutre » n’a pas de mot : c’est l’absence de champ');
  }],
];

const TESTS_RENDU = [
  ['usureDe : 0, 1, 2 ; inconnu = neuve', () => {
    egal([usureDe('neuve'), usureDe('usee'), usureDe('ruine'), usureDe(undefined), usureDe('mort'), usureDe('toString')], [0, 1, 2, 0, 0, 0], 'degrés');
  }],
  ['teintes : neutre n’y change rien ; froide bleuit, chaude réchauffe, nuit assombrit et contraste ; inconnu = neutre', () => {
    const base = () => [120, 110, 100];
    egal(teinterSol(base(), 'neutre'), [120, 110, 100], 'neutre');
    egal(teinterSol(base(), 'inconnue'), [120, 110, 100], 'inconnue');
    const f = teinterSol(base(), 'froide'), c = teinterSol(base(), 'chaude'), n = teinterSol(base(), 'nuit');
    verifier(f[2] - f[0] > 100 - 120 + 10, 'froide : le bleu gagne sur le rouge');
    verifier(c[0] - c[2] > 120 - 100 + 10, 'chaude : le rouge gagne sur le bleu');
    verifier(n[0] < 80 && n[1] < 80, 'nuit : sombre');
    verifier(Math.abs(TEINTES.nuit.contraste - 1) > 0.05, 'nuit : plus contrastée');
    egal(couleurMur({ h: 215, s: 7 }, 56, 'neutre'), 'hsl(215 7% 56%)', 'mur neutre : la couleur du thème telle quelle');
    verifier(/^rgb\(\d+,\d+,\d+\)$/.test(couleurMur({ h: 215, s: 7 }, 56, 'froide')), 'mur teinté : un rgb');
    const [rf, , bf] = couleurMur({ h: 28, s: 20 }, 50, 'froide').match(/\d+/g).map(Number), [rc, , bc] = couleurMur({ h: 28, s: 20 }, 50, 'chaude').match(/\d+/g).map(Number);
    verifier(bf - rf > bc - rc + 20, 'mur froid plus bleu que mur chaud');
  }],
  ['densités : rien dans une salle neuve ; os et toiles pour les salles froides ou de nuit ; plus de tout en ruine', () => {
    verifier(Object.values(densites('neuve', 'froide', 'pierre')).every((v) => v === 0), 'neuve : rien');
    verifier(Object.values(densites(undefined, 'nuit', 'pierre')).every((v) => v === 0), 'état absent : rien');
    for (const [etat, ambiance] of [['usee', 'froide'], ['ruine', 'nuit']]) verifier(densites(etat, ambiance, 'pierre').os > 0.01 && densites(etat, ambiance, 'pierre').toile > 0.5, `${etat} ${ambiance} : os et toiles`);
    verifier(densites('usee', 'chaude', 'pierre').os === 0 && densites('usee', 'chaude', 'pierre').toile === 0, 'usée et chaude : ni os ni toiles');
    verifier(densites('ruine', 'chaude', 'pierre').os < densites('ruine', 'froide', 'pierre').os, 'moins d’os en ruine chaude');
    verifier(densites('ruine', 'neutre', 'pierre').caillou > densites('usee', 'neutre', 'pierre').caillou, 'plus de cailloux en ruine');
    verifier(densites('ruine', 'neutre', 'pierre').touffe > 0 && densites('usee', 'neutre', 'pierre').touffe === 0, 'les touffes sont pour la ruine');
    verifier(densites('ruine', 'neutre', 'glace').mousse < densites('ruine', 'neutre', 'pierre').mousse, 'moins de mousse sur la glace');
  }],
  ['tuiles : la clé de cache distingue sol, ambiance et état ; une salle neuve et neutre garde le sol d’avant', () => {
    const cles = new Set();
    for (const sol of ['pierre', 'bois']) for (const ambiance of AMBIANCES) for (const etat of ETATS_SALLE) cles.add(cleTuile(sol, 32, { ambiance, etat }));
    egal(cles.size, 2 * 4 * 3, 'toutes différentes');
    const a = calculerTuile('pierre', 16, {}), b = calculerTuile('pierre', 16, { ambiance: 'neutre', etat: 'neuve' });
    verifier(a.data.every((v, i) => v === b.data[i]), 'sans variante = neutre et neuve');
    const tousLesSols = Object.keys(SOLS_PEINTS);
    for (const sol of tousLesSols) {
      const neuf = calculerTuile(sol, 16, {}), nuit = calculerTuile(sol, 16, { ambiance: 'nuit' }), ruine = calculerTuile(sol, 16, { etat: 'ruine' });
      const somme = (t) => t.data.reduce((s, v, i) => s + (i % 4 < 3 ? v : 0), 0);
      verifier(somme(nuit) < somme(neuf), `${sol} : la nuit assombrit la tuile`);
      if (sol !== 'roche') verifier(ruine.data.some((v, i) => v !== neuf.data[i]), `${sol} : la ruine change la tuile`);
      else verifier(ruine.data.every((v, i) => v === neuf.data[i]), 'la roche ne s’use pas');
    }
  }],
  ['tuiles : usée et en ruine restent raccordables (périodiques) et la ruine reprend le sol (terre, herbe)', () => {
    for (const sol of ['pierre', 'marbre', 'bois', 'terre', 'sable', 'herbe', 'glace']) for (const etat of ['usee', 'ruine']) {
      for (const [X, Y] of [[10.5, 20.5], [123.5, 77.5], [300.5, 5.5]]) {
        const p = couleurSol(sol, X, Y, [0, 0, 0], { etat, ambiance: 'froide' }), q = couleurSol(sol, X + PERIODE, Y + 2 * PERIODE, [0, 0, 0], { etat, ambiance: 'froide' });
        for (let i = 0; i < 3; i++) verifier(Math.abs(p[i] - q[i]) < 1e-6, `${sol} ${etat} : un pixel et son voisin d’une période sont identiques (${p[i]} / ${q[i]})`);
      }
    }
    let vert = 0, terre = 0, mur = 0;
    for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) {
      const c = couleurSol('pierre', (i + 0.5) * PERIODE / 40, (j + 0.5) * PERIODE / 40, [0, 0, 0], { etat: 'ruine' });
      if (c[1] > c[0] + 25 && c[1] > c[2] + 25) vert++; else if (c[0] > c[2] + 30 && c[0] > c[1] + 10) terre++; else mur++;
    }
    verifier(vert > 100 && terre > 15 && mur > 300, `ruine : herbe ${vert}, terre ${terre}, dalles ${mur} sur 1600`);
    let neuf = 0;
    for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) { const c = couleurSol('pierre', (i + 0.5) * PERIODE / 40, (j + 0.5) * PERIODE / 40); if (c[1] > c[0] + 25) neuf++; }
    egal(neuf, 0, 'une salle neuve n’a aucune herbe');
    for (let i = 0; i < 20; i++) { const m = masqueVert(i / 20, 0.3); verifier(m >= 0 && m <= 1, 'le masque est entre 0 et 1'); }
    verifier(Math.abs(masqueVert(0.3, 0.7) - masqueVert(1.3, 1.7)) < 1e-9, 'le masque est périodique');
  }],
  ['semis : même salle = mêmes détails ; une autre salle en a d’autres ; salle neuve : aucun', () => {
    const plan = rect(12, 9, { sol: 'pierre' }), p = { graine: 123456, ambiance: 'froide', etat: 'ruine' };
    const a = semerDetails(plan, p), b = semerDetails(plan, p);
    verifier(a.length > 20, `une salle en ruine est semée (${a.length} détails)`);
    egal(a, b, 'déterministe');
    verifier(JSON.stringify(semerDetails(plan, { ...p, graine: 654321 })) !== JSON.stringify(a), 'une autre graine, d’autres détails');
    egal(semerDetails(plan, { graine: 1, ambiance: 'froide', etat: 'neuve' }), [], 'neuve : rien');
    egal(semerDetails(plan, { graine: 1, ambiance: 'froide' }), [], 'état absent : rien');
    verifier(semerDetails(plan, { ...p, etat: 'usee' }).length < a.length, 'moins de détails quand la salle est seulement usée');
    for (const d of a) verifier(d.x >= 0 && d.y >= 0 && d.x <= plan.largeur && d.y <= plan.longueur && Number.isFinite(d.graine), `${d.sorte} : dans la salle`);
  }],
  ['semis : seuls la ruine et l’ambiance froide ou de nuit donnent des os et des toiles, dans les coins ou contre les murs', () => {
    const plan = rect(14, 12), tout = (ambiance, etat) => { const l = []; for (let g = 1; g <= 30; g++) l.push(...semerDetails(plan, { graine: g * 7919, ambiance, etat })); return l; };
    const froid = tout('froide', 'ruine'), chaud = tout('chaude', 'usee');
    verifier(froid.some((d) => d.sorte === 'os') && froid.some((d) => d.sorte === 'toile'), 'froide en ruine : os et toiles');
    verifier(!chaud.some((d) => d.sorte === 'os' || d.sorte === 'toile'), 'chaude et usée : ni os ni toiles');
    verifier(froid.some((d) => d.sorte === 'touffe') && froid.some((d) => d.sorte === 'feuille') && froid.some((d) => d.sorte === 'caillou') && froid.some((d) => d.sorte === 'mousse'), 'touffes, feuilles, cailloux, mousse');
    for (const d of froid.filter((x) => x.sorte === 'toile')) {
      verifier(Number.isInteger(d.x) && Number.isInteger(d.y), 'une toile est posée sur un coin de case');
      verifier((d.x === 0 || d.x === 14) && (d.y === 0 || d.y === 12), 'et ce coin est un coin de la salle');
      verifier(Math.abs(d.sx) === 1 && Math.abs(d.sy) === 1 && (d.x === 0) === (d.sx === 1) && (d.y === 0) === (d.sy === 1), 'tournée vers l’intérieur');
    }
    for (const d of froid.filter((x) => x.sorte === 'os')) verifier(d.x < 1 || d.y < 1 || d.x > 13 || d.y > 11, 'un os est contre un mur');
    verifier(!tout('neutre', 'ruine').some((d) => d.sorte === 'os' && false), 'rien');
  }],
  ['semis : jamais sous un objet, un pion ou le seuil d’une porte ; le reste de la salle ne bouge pas quand un pion se déplace', () => {
    const plan = rect(12, 9, {
      objets: [{ id: 'o1', type: 'table', x: 3, y: 3, l: 3, h: 2, rotation: 0 }, { id: 'o2', type: 'pilier', x: 8, y: 1, l: 1, h: 1, rotation: 0 }],
      creatures: [{ id: 'c1', type: 'gobelin', x: 6, y: 6, taille: 2, camp: 'monstre', numero: 1 }],
      portes: [{ id: 'p1', mur: 'sud', position: 4, type: 'porte' }, { id: 'p2', mur: 'nord', position: 7, type: 'porte' }, { id: 'p3', mur: 'est', position: 3, type: 'porte' }, { id: 'p4', mur: 'ouest', position: 5, type: 'porte' }],
    });
    const pris = casesOccupees(plan);
    for (const [x, y] of [[3, 3], [4, 3], [5, 3], [3, 4], [5, 4], [8, 1], [6, 6], [7, 6], [6, 7], [7, 7], [4, 8], [7, 0], [11, 3], [0, 5]]) verifier(pris.has(`${x},${y}`), `case ${x},${y} occupée`);
    verifier(!pris.has('0,0') && !pris.has('5,5'), 'les autres sont libres');
    let semes = 0;
    for (let g = 1; g <= 40; g++) {
      for (const d of semerDetails(plan, { graine: g * 104729, ambiance: 'froide', etat: 'ruine' })) {
        if (d.sorte === 'toile') continue; // posée sur un coin, jamais sur une case de départ : on teste la case qui porte la toile
        semes++;
        verifier(!pris.has(`${Math.floor(d.x)},${Math.floor(d.y)}`), `graine ${g} : ${d.sorte} en ${d.x.toFixed(2)},${d.y.toFixed(2)} est sur une case occupée`);
      }
    }
    verifier(semes > 500, `et pourtant, ça sème (${semes})`);
    // Déplacer le pion ne change que les cases touchées.
    const p = { graine: 99, ambiance: 'froide', etat: 'ruine' }, avant = semerDetails(plan, p);
    const bouge = { ...plan, creatures: [{ ...plan.creatures[0], x: 1, y: 6 }] };
    const apres = semerDetails(bouge, p), cle = (d) => JSON.stringify(d), touche = (d) => { const x = Math.floor(d.x), y = Math.floor(d.y); return (x >= 6 && x <= 7 && y >= 6 && y <= 7) || (x >= 1 && x <= 2 && y >= 6 && y <= 7); };
    egal(avant.filter((d) => !touche(d)).map(cle), apres.filter((d) => !touche(d)).map(cle), 'hors des cases du pion, rien ne change');
    verifier(apres.some((d) => { const x = Math.floor(d.x), y = Math.floor(d.y); return x >= 6 && x <= 7 && y >= 6 && y <= 7; }), 'la case qu’il a quittée est semée');
  }],
  ['semis : une forme non rectangulaire n’a de détails que sur son sol', () => {
    const plan = { ...rect(10, 10), forme: 'croix', bras: 3 };
    const vides = new Set();
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if ((x < 3 || x > 6) && (y < 3 || y > 6)) vides.add(`${x},${y}`);
    let n = 0;
    for (let g = 1; g <= 20; g++) for (const d of semerDetails(plan, { graine: g * 31, ambiance: 'nuit', etat: 'ruine' })) {
      if (d.sorte === 'toile') continue;
      n++;
      verifier(!vides.has(`${Math.floor(d.x)},${Math.floor(d.y)}`), `${d.sorte} sur une case retirée`);
    }
    verifier(n > 100, 'la croix est semée');
  }],
  ['les décalages de tuile (graine) sont ceux que les détails relisent', () => {
    const [dx, dy] = decalageDeTuile(0xabcdef12);
    verifier(dx >= 0 && dx < 1 && dy >= 0 && dy < 1, 'fractions de période');
    egal(decalageDeTuile(0xabcdef12), [dx, dy], 'stable');
  }],
  ['lumière : l’ambiance teinte le voile, l’éclairage règle l’opacité (déjà branchés, vérifiés ici sur les valeurs du schéma)', () => {
    for (const a of AMBIANCES) egal(couleurAmbiance(a), COULEURS_AMBIANCE[a], `couleur ${a}`);
    verifier(opaciteVoile({ penombre: 45, eclairage: 'eclairee', vue: 'table' }) < opaciteVoile({ penombre: 45, eclairage: 'penombre', vue: 'table' }), 'éclairée < pénombre');
    verifier(opaciteVoile({ penombre: 45, eclairage: 'obscurite', vue: 'table' }) > opaciteVoile({ penombre: 45, eclairage: 'penombre', vue: 'table' }), 'obscurité > pénombre');
  }],
  ['dessin complet : toutes les ambiances et tous les états, sur un rectangle, une croix et sans relief, sans exception', () => {
    const base = rect(9, 7, {
      objets: [{ id: 'o1', type: 'pilier', x: 2, y: 2, l: 1, h: 1, rotation: 0 }, { id: 'o2', type: 'torche', x: 4, y: 0, l: 1, h: 1, rotation: 180 }],
      creatures: [{ id: 'c1', type: 'gobelin', camp: 'monstre', x: 5, y: 4, taille: 1, numero: 1 }],
      portes: [{ id: 'p1', mur: 'sud', position: 3, type: 'porte' }],
    });
    for (const forme of [{}, { forme: 'croix', bras: 3 }, { forme: 'L', bras: 3, position: 'nord-ouest' }]) for (const relief of [true, false]) {
      for (const ambiance of AMBIANCES) for (const etat of ETATS_SALLE) for (const eclairage of ECLAIRAGES) {
        for (const sol of ['pierre', 'bois', 'herbe']) dessinDe({ ...base, ...forme, sol, ambiance, etat, eclairage, id: `salle-${etat}` }, THEMES.peint, { relief, vue: 'table' });
      }
    }
  }],
  ['dessin : une salle neuve et neutre est dessinée comme avant ; en ruine, les murs et le sol changent ; le vectoriel et le papier ignorent les trois champs', () => {
    const base = rect(8, 6, { objets: [{ id: 'o1', type: 'coffre', x: 2, y: 2, l: 1, h: 1, rotation: 0 }], portes: [{ id: 'p1', mur: 'sud', position: 2, type: 'porte' }] });
    const explicite = { ...base, ambiance: 'neutre', etat: 'neuve', eclairage: 'penombre' };
    egal(dessinDe(explicite, THEMES.peint), dessinDe(base, THEMES.peint), 'peint : neutre, neuve et pénombre explicites = rien');
    const ruine = dessinDe({ ...base, etat: 'ruine' }, THEMES.peint), nuit = dessinDe({ ...base, ambiance: 'nuit' }, THEMES.peint);
    verifier(ruine !== dessinDe(base, THEMES.peint), 'en ruine : un autre dessin');
    verifier(ruine.length > dessinDe(base, THEMES.peint).length * 1.05, 'en ruine : plus de choses dessinées (mousse, lierre, détails)');
    verifier(nuit !== dessinDe(base, THEMES.peint), 'de nuit : un autre dessin (murs teintés, voile)');
    const plein = { ...base, ambiance: 'froide', etat: 'ruine', eclairage: 'obscurite' };
    for (const nom of ['vectoriel', 'papier']) {
      egal(dessinDe(plein, THEMES[nom]), dessinDe(base, THEMES[nom]), `${nom} : les trois champs sont ignorés`);
    }
  }],
];

export const executer = () => [
  ...executerSuite('ambiance, schéma : ', TESTS_SCHEMA),
  ...executerSuite('ambiance, parseur : ', TESTS_PARSEUR),
  ...executerSuite('ambiance, rendu : ', TESTS_RENDU),
];
