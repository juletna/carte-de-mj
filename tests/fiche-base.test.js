/**
 * Tests des données de la Fiche (js/fiche/base.js) : listes, types d'objet, remise à niveau d'une fiche, empreinte, chargement de la base du navigateur.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import { SKILLS, CONDS, COND_ADV, PRESETS, presetDispo, SCOPES, TYPES_OBJET, ITYPES, ACT_L, ETAT_INTERFACE, snapP, sample, blank, complete, chargerBase, slots, freshTurn } from '../js/fiche/base.js';
import { CLE_FICHES, CLE_FICHE_ANCIENNE } from '../js/fiche/format.js';
import { STATS } from '../js/fiche/regles.js';
import { verifier, egal, executerSuite } from './mini-test.js';

/** Un rangement simulé : lire(cle) rend le JSON rangé sous cette clé (comme main.js sur localStorage), ou rien. */
const rangement = (contenu) => (cle) => (cle in contenu ? JSON.parse(JSON.stringify(contenu[cle])) : undefined);
const clone = (x) => JSON.parse(JSON.stringify(x));

const TESTS = [
  ['les listes de la règle sont cohérentes', () => {
    egal(SKILLS.length, 18, 'dix-huit compétences');
    verifier(SKILLS.every(([nom, car]) => nom && STATS.includes(car)), 'chaque compétence dépend d’une caractéristique connue');
    egal(new Set(SKILLS.map((s) => s[0])).size, 18, 'sans doublon');
    verifier(Object.keys(COND_ADV).every((c) => CONDS.includes(c)), 'les états à avantage sont des états');
    verifier(PRESETS.every((p) => p.sc.every((s) => SCOPES.some((x) => x[0] === s))), 'les effets prédéfinis jouent sur des portées connues');
    egal(slots([3, 0]), [{ max: 3, used: 0 }, { max: 0, used: 0 }], 'emplacements de sorts');
    egal(Object.keys(freshTurn()), ['action', 'bonus', 'react', 'obj', 'haste', 'move', 'dash'], 'un tour neuf');
  }],
  ['TYPES_OBJET : une entrée par type ; la liste de choix et les ressources en dérivent', () => {
    egal(ITYPES, [['objet', 'Objet simple'], ['soin', 'Soin (consommable)'], ['conso', 'Consommable'], ['charges', 'Objet à charges'], ['equip', 'Équipement (bonus CA)']], 'choix, dans l’ordre');
    egal(Object.keys(TYPES_OBJET).filter((t) => TYPES_OBJET[t].ressource), ['soin', 'conso', 'charges'], 'types qui apparaissent dans « Ressources »');
    egal(Object.keys(TYPES_OBJET).filter((t) => TYPES_OBJET[t].sansCout), ['objet', 'equip'], 'types sans « Coûte »');
    for (const t of ['constructor', '__proto__', 'toString', 'inconnu', undefined]) verifier(!TYPES_OBJET[t]?.ressource && !TYPES_OBJET[t]?.sansCout, `type inconnu ${t}`);
    egal(Object.keys(ACT_L), ['action', 'bonus', 'obj', 'none'], 'actions');
  }],
  ['l’exemple et la fiche vierge : complets, indépendants, au bon format', () => {
    const e = sample(), v = blank();
    egal([e.example, v.example, e.name, v.name], [true, false, 'Elwyn Brisevent', 'Nouveau personnage'], 'identité');
    egal(Object.keys(e.stats), STATS, 'toutes les caractéristiques');
    egal(Object.keys(e), Object.keys(v), 'les mêmes champs');
    e.inv.push({ n: 'x' }); e.stats.FOR = 1; egal([sample().inv.length, sample().stats.FOR], [7, 11], 'chaque appel rend une fiche neuve');
    egal(e.slots.length, 9, 'neuf niveaux de sorts');
  }],
  ['complete : remet à niveau une fiche ancienne ou abîmée, sans toucher à ce qui est bon', () => {
    const f = complete({ example: false, name: 'Brann', lvl: 4, stats: { FOR: 'x', DEX: 14 }, inv: [{ n: 'Potion de soins', q: 1 }, null, 3, { n: 'Corde', q: 1, type: 'objet' }], slots: [1, 2], sheet: 'hp', rolls: 5, log: [null, { x: 'ok' }] });
    egal([f.name, f.lvl, f.stats.DEX, f.stats.FOR, f.stats.INT], ['Brann', 4, 14, 10, 10], 'ce qui est bon reste, le reste est complété');
    egal(f.inv, [{ n: 'Potion de soins', q: 1, type: 'soin', dice: '2d4+2', act: 'action' }, { n: 'Corde', q: 1, type: 'objet' }], 'les entrées illisibles du sac sont écartées, la potion reconnue');
    egal(f.edition, '2014', 'une fiche sans règles suit 2014');
    egal(complete({ example: false, edition: 'autre', stats: {} }).edition, '2014', 'des règles inconnues aussi');
    egal(complete({ example: false, edition: 'constructor', stats: {} }).edition, '2014', 'même un nom hérité de Object');
    const f24 = complete({ example: false, edition: '2024', stats: {}, inv: [{ n: 'Potion de soins', q: 1 }] });
    egal([f24.edition, f24.inv[0].act], ['2024', 'bonus'], 'une fiche 2024 garde ses règles, la potion reconnue les suit');
    egal(PRESETS.filter((p) => presetDispo(p, '2014') && /Inspiration( héroïque)?$/.test(p.n)).map((p) => p.kind), ['adv'], 'en 2014, l’Inspiration donne l’avantage');
    egal(PRESETS.filter((p) => presetDispo(p, '2024') && /Inspiration( héroïque)?$/.test(p.n)).map((p) => p.kind), ['reroll'], 'en 2024, elle relance');
    egal(PRESETS.filter((p) => presetDispo(p, 'libre')).length, PRESETS.length, 'en mode libre, tout est proposé');
    egal([f.slots.length, f.sheet, Array.isArray(f.rolls)], [9, null, true], 'emplacements refaits, feuille fermée, jets en liste');
    egal(f.log, [{ x: 'ok' }], 'journal filtré');
    const ex = complete({ example: true, stats: {} });
    egal([ex.name, ex.stats.FOR], ['Elwyn Brisevent', 10], 'une fiche d’exemple se complète sur l’exemple');
  }],
  ['empreinte : sans l’état d’interface, pour savoir si la fiche a bougé', () => {
    const f = sample();
    const avant = snapP(f);
    Object.assign(f, { tab: 'sac', sheet: 'hp', pad: '12', openItem: 3, showCustom: true, rbOpen: true });
    egal(snapP(f), avant, 'l’interface ne change pas l’empreinte');
    f.hp -= 1; verifier(snapP(f) !== avant, 'les PV, si');
    egal(Object.keys(ETAT_INTERFACE), ['sheet', 'pad', 'openItem', 'showCustom', 'rbOpen'], 'ce qu’on remet à zéro en changeant de personnage');
    verifier(Object.isFrozen(ETAT_INTERFACE), 'table figée');
  }],
  ['chargerBase : rien de rangé → l’exemple ; sinon la base, complétée', () => {
    const vide = chargerBase(rangement({}));
    const [id] = Object.keys(vide.persos);
    egal([Object.keys(vide.persos).length, vide.actif === id, vide.persos[id].example, vide.persos[id].name], [1, true, true, 'Elwyn Brisevent'], 'exemple');
    const base = { actif: 'b', persos: { a: { name: 'A', stats: { FOR: 12 } }, b: { name: 'B', stats: { FOR: 14 }, lvl: 7 } } };
    const lue = chargerBase(rangement({ [CLE_FICHES]: base }));
    egal([lue.actif, Object.keys(lue.persos), lue.persos.b.lvl, lue.persos.a.lvl, lue.persos.a.stats.DEX], ['b', ['a', 'b'], 7, 1, 10], 'les fiches sont complétées');
    egal(chargerBase(rangement({ [CLE_FICHES]: { actif: 'zzz', persos: base.persos } })).actif, 'a', 'actif inconnu : la première fiche');
  }],
  ['chargerBase : l’ancienne clé sert tant que la nouvelle est absente ou vide', () => {
    const ancien = { name: 'Ancien', stats: { FOR: 9 } };
    for (const nouvelle of [undefined, null, 3, {}, { persos: 3 }, { persos: {} }]) {
      const contenu = { [CLE_FICHE_ANCIENNE]: ancien };
      if (nouvelle !== undefined) contenu[CLE_FICHES] = nouvelle;
      const b = chargerBase(rangement(contenu));
      egal([Object.keys(b.persos).length, b.persos[b.actif].name, b.persos[b.actif].stats.FOR], [1, 'Ancien', 9], `nouvelle clé ${JSON.stringify(nouvelle)}`);
    }
    const sansStats = chargerBase(rangement({ [CLE_FICHE_ANCIENNE]: { name: 'Sans stats' } }));
    egal(Object.values(sansStats.persos).map((p) => p.name), ['Elwyn Brisevent'], 'ancienne fiche sans caractéristiques : l’exemple');
  }],
  ['chargerBase : PERTE CONNUE, conservée telle quelle — un personnage sans caractéristiques en objet disparaît de la base, en silence', () => {
    const base = { actif: 'a', persos: { a: { name: 'Sans stats' }, b: { name: 'Stats nulles', stats: null }, c: { name: 'Gardé', stats: { FOR: 12 } }, d: 'texte', e: null, f: { name: 'Stats en liste', stats: [] } } };
    const lue = chargerBase(rangement({ [CLE_FICHES]: base }));
    egal(Object.keys(lue.persos), ['c', 'f'], 'seuls restent ceux dont `stats` est un objet (une liste en est un pour ce test-ci, pas pour estFiche)');
    egal(lue.actif, 'c', 'l’actif écarté : la première fiche restante');
    // Si plus aucun personnage ne tient, la base est refaite depuis l'ancienne clé ou l'exemple : les fiches écartées ne sont gardées nulle part.
    const tout = chargerBase(rangement({ [CLE_FICHES]: { actif: 'a', persos: { a: { name: 'Perdu' } } } }));
    egal(Object.values(tout.persos).map((p) => p.name), ['Elwyn Brisevent'], 'remplacée par l’exemple');
    // À corriger plus tard (mise de côté, comme stockage.js pour les donjons) ; ce test change alors avec elle.
  }],
];

export async function executer() {
  return executerSuite('fiche (base) : ', TESTS);
}
