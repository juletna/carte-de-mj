/**
 * Tests des règles de jeu de la Fiche (js/fiche/jeu.js) : bonus, CA, vitesse, jet d'un d20 avec avantage, dégâts, soins, début de tour.
 * Chaque fonction reçoit la fiche `S` en paramètre ; les dés sont imposés. Sans dépendance : marche sous Node et dans tests.html.
 */
import { blank, sample } from '../js/fiche/base.js';
import { skB, svB, hdLeft, hasHaste, fxOf, negFx, acTotal, baseSpeed, speedNow, note, fxVal, manualFx, dropFx, d20, push, spend,
  damage, heal, startTurn, addFx } from '../js/fiche/jeu.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const impose = (valeurs) => { let i = 0; return () => valeurs[i++]; };
/** Une fiche vierge avec des caractéristiques lisibles : DEX 16 (+3), CON 14 (+2), reste à 10. */
const fiche = (extra = {}) => Object.assign(blank(), { stats: { FOR: 10, DEX: 16, CON: 14, INT: 10, SAG: 10, CHA: 10 }, prof: 2 }, extra);
const fx = (extra) => ({ id: 'e' + Math.random(), n: 'Effet', sc: ['atk'], kind: 'flat', val: 1, dur: 'once', left: 1, ...extra });

const TESTS = [
  ['bonus de compétence et de sauvegarde : modificateur plus maîtrise (ou expertise)', () => {
    const S = fiche({ saveProf: ['DEX'], skills: { Discrétion: 1, Acrobaties: 2 } });
    egal([skB(S, 'Discrétion'), skB(S, 'Acrobaties'), skB(S, 'Athlétisme')], [5, 7, 0], 'compétences');
    egal([svB(S, 'DEX'), svB(S, 'CON'), svB(S, 'FOR')], [5, 2, 0], 'sauvegardes');
    S.lvl = 3; S.hd.used = 1;
    egal([hdLeft(S), hdLeft({ lvl: 1, hd: { used: 4 } })], [2, 0], 'dés de vie restants, jamais négatifs');
  }],
  ['CA totale : la base, plus les objets équipés, plus les effets de CA ; la vitesse suit l’état, la hâte et l’épuisement', () => {
    const S = fiche({ ac: 12, speed: 9 });
    S.inv = [{ n: 'Bouclier', type: 'equip', eq: true, acb: 2 }, { n: 'Cotte', type: 'equip', eq: false, acb: 4 }, { n: 'Corde', type: 'objet', q: 1 }];
    egal(acTotal(S), 14, 'bouclier équipé seulement');
    S.fx = [fx({ sc: ['ac'], kind: 'flat', val: 2 }), fx({ sc: ['atk'], kind: 'flat', val: 9 }), fx({ sc: ['ac'], kind: 'adv' })];
    egal(acTotal(S), 16, 'un effet de CA fixe, ni les autres portées ni les autres genres');
    egal([baseSpeed(S), speedNow(S)], [9, 9], 'vitesse normale');
    S.turn.dash = true; egal(speedNow(S), 18, 'foncer double');
    S.turn.dash = false; S.exh = 2; egal(baseSpeed(S), 6, 'épuisement : −1,5 m par niveau');
    S.fx = [fx({ haste: true, sc: ['ac'] })]; egal([hasHaste(S), baseSpeed(S)], [true, 15], 'hâte : le double, puis l’épuisement');
    S.conds = ['Entravé']; egal(baseSpeed(S), 0, 'entravé : immobile');
    egal(baseSpeed(fiche({ speed: 1, exh: 6 })), 0, 'jamais négative');
  }],
  ['d20 : avantage, désavantage, annulation, états, épuisement, effets', () => {
    const S = fiche();
    egal(d20(S, 3, 'Test', 'chk', impose([12, 7])), { ...d20(S, 3, 'Test', 'chk', impose([12, 7])), tot: 15, det: '12 +3', nat: 12, m: 3, d20: true, l: 'Test', scope: 'chk' }, 'normal : le premier dé, le second ignoré');
    S.adv = 1; let r = d20(S, 0, 'x', 'atk', impose([4, 17]));
    egal([r.nat, r.tot, r.det], [17, 17, '4|17 avantage (choisi)'], 'avantage choisi');
    S.adv = 2; r = d20(S, 0, 'x', 'atk', impose([4, 17]));
    egal([r.nat, r.det], [4, '4|17 désavantage (choisi)'], 'désavantage choisi');
    S.adv = 1; S.conds = ['À terre']; r = d20(S, 0, 'x', 'atk', impose([4, 17]));
    egal([r.nat, r.det], [4, '4 (avantage et désavantage s\'annulent)'], 'avantage et désavantage s’annulent : un seul dé');
    S.adv = 0; S.conds = ['Effrayé']; r = d20(S, 0, 'x', 'chk', impose([15, 3]));
    egal([r.nat, r.det], [3, '15|3 désavantage (Effrayé)'], 'état qui joue sur les tests');
    r = d20(S, 0, 'x', 'save', impose([15, 3]));
    egal(r.nat, 15, 'le même état ne joue pas sur les sauvegardes');
    S.conds = []; S.exh = 2; r = d20(S, 2, 'x', 'chk', impose([10, 1]));
    egal([r.tot, r.m, r.det], [8, -2, '10 +2 −4 épuisement'], 'épuisement : −2 par niveau');
  }],
  ['d20 : les effets actifs s’ajoutent, ceux « à ajouter après le jet » non, un avantage à usage unique est consommé', () => {
    const S = fiche();
    S.fx = [fx({ id: 'b', n: 'Bénédiction', sc: ['atk'], kind: 'die', val: '1d4', dur: 'rounds', left: 5 }),
      fx({ id: 'a', n: 'Aide', sc: ['atk'], kind: 'adv', dur: 'once' }),
      fx({ id: 'm', n: 'Inspiration', sc: ['atk'], kind: 'die', val: '1d6', dur: 'once' }),
      fx({ id: 'c', n: 'Autre portée', sc: ['dmg'], kind: 'flat', val: 9, dur: 'rounds' })];
    const r = d20(S, 5, 'Arc', 'atk', impose([8, 14, 3]));
    egal([r.nat, r.tot, r.det], [14, 22, '8|14 avantage (Aide) +5 +3 Bénédiction'], 'avantage, bénédiction ajoutée, inspiration laissée');
    egal(S.fx.map((f) => f.id), ['b', 'm', 'c'], 'l’avantage à usage unique est consommé');
    verifier(manualFx(S.fx[1]) && !manualFx(S.fx[0]), 'inspiration manuelle, bénédiction automatique');
    egal(fxOf(S, 'atk').map((f) => f.id), ['b', 'm'], 'effets d’une portée');
    dropFx(S, ['b']); egal(S.fx.map((f) => f.id), ['m', 'c'], 'dropFx');
  }],
  ['fxVal, negFx : valeur d’un effet (critique : dés doublés), effets qui retirent', () => {
    egal([fxVal(fx({ kind: 'die', val: '1d4' }), false, impose([3])), fxVal(fx({ kind: 'die', val: '1d4' }), true, impose([3, 2])), fxVal(fx({ kind: 'dieneg', val: '1d4' }), false, impose([3]))], [3, 5, -3], 'dés');
    egal([fxVal(fx({ kind: 'flat', val: -2 })), fxVal(fx({ kind: 'flat', val: 'x' })), fxVal(fx({ kind: 'adv' })), fxVal(fx({ kind: 'reroll' }))], [-2, 0, null, null], 'fixe et sans valeur');
    egal([negFx(fx({ kind: 'dieneg' })), negFx(fx({ kind: 'dis' })), negFx(fx({ kind: 'flat', val: -1 })), negFx(fx({ kind: 'flat', val: 1 })), negFx(fx({ kind: 'die' }))], [true, true, true, false, false], 'négatifs');
  }],
  ['dégâts : les PV temporaires d’abord, jamais sous 0 ; à 0 PV un échec de plus et un message ; la concentration demande un jet', () => {
    const S = fiche({ hp: 10, hpMax: 10, tmp: 4 });
    egal([damage(S, 3), S.hp, S.tmp], [null, 10, 1], 'les temporaires absorbent');
    egal([damage(S, 6), S.hp, S.tmp], [null, 5, 0], 'puis les PV');
    egal([damage(S, 50), S.hp], [null, 0], 'jamais sous 0');
    egal([damage(S, 2), S.saves.f, S.hp], ['PV à 0 : un échec de sauvegarde contre la mort', 1, 0], 'à 0 PV : un échec, et le message');
    egal([damage(S, 0), S.saves.f], [null, 1], 'zéro dégât ne compte pas');
    for (let i = 0; i < 5; i++) damage(S, 1);
    egal(S.saves.f, 3, 'trois échecs au plus');
    const C = fiche({ hp: 30, hpMax: 30, conc: true });
    damage(C, 8); egal(C.concDD, 10, 'DD 10 au minimum');
    damage(C, 30); egal(C.concDD, 15, 'la moitié des dégâts quand elle dépasse 10');
    damage(C, 8); egal(C.concDD, 15, 'jamais en dessous du DD déjà posé');
    const D = fiche({ hp: 99, hpMax: 99, conc: true }); damage(D, 90); egal(D.concDD, 30, 'DD 30 au plus');
    const E = fiche({ hp: 30, hpMax: 30, conc: true }); damage(E, 0); egal(E.concDD, 0, 'sans dégât, pas de jet');
  }],
  ['soins : jamais au-dessus du maximum ; remonter de 0 PV efface les jets contre la mort', () => {
    const S = fiche({ hp: 0, hpMax: 10 }); S.saves = { s: 2, f: 1 };
    heal(S, 4); egal([S.hp, S.saves], [4, { s: 0, f: 0 }], 'retour à la vie');
    S.saves = { s: 1, f: 1 }; heal(S, 100); egal([S.hp, S.saves], [10, { s: 1, f: 1 }], 'plafonné, et sans effet sur les jets quand on n’est pas à 0');
    const Z = fiche({ hp: 0, hpMax: 10 }); Z.saves = { s: 2, f: 1 }; heal(Z, 0); egal([Z.hp, Z.saves], [0, { s: 2, f: 1 }], 'soigner de 0 ne relève pas');
  }],
  ['début de tour : un round de plus, actions rendues, effets en rounds décomptés et rendus quand ils prennent fin', () => {
    const S = fiche({ mode: 'combat', round: 2, phase: 'wait' });
    S.turn.action = true;
    S.fx = [fx({ id: 'r1', n: 'Fléau', dur: 'rounds', left: 1 }), fx({ id: 'r3', n: 'Bénédiction', dur: 'rounds', left: 3 }), fx({ id: 'u', dur: 'once' })];
    const fin = startTurn(S);
    egal([S.round, S.phase, S.turn.action], [3, 'mine', false], 'round, phase, actions');
    egal(fin.map((f) => f.n), ['Fléau'], 'effets terminés');
    egal(S.fx.map((f) => [f.id, f.left]), [['r3', 2], ['u', 1]], 'les autres restent, décomptés');
  }],
  ['dépenser une action, noter, ajouter un effet, pousser un jet', () => {
    const S = fiche({ mode: 'combat' });
    spend(S, 'bonus'); egal(S.turn.bonus, true, 'bonus dépensé');
    spend(S, 'none'); spend(S, ''); spend(S, undefined); egal(S.turn.action, false, 'rien ne se dépense sans action');
    S.fx = [fx({ haste: true })];
    spend(S, 'action'); egal([S.turn.action, S.turn.haste], [true, false], 'première action');
    spend(S, 'action'); egal([S.turn.action, S.turn.haste], [true, true], 'sous hâte, la seconde action est celle de la hâte');
    const E = fiche({ mode: 'explo' }); spend(E, 'action'); egal(E.turn.action, false, 'hors combat, rien ne se dépense');
    note(S, 'Idée', 'x'); note(S, 'Note', 'y'); egal(S.log.map((e) => e.x), ['y', 'x'], 'le journal : le plus récent d’abord');
    S.fxSrc = '  Mira '; const p = { n: 'P', sc: ['atk'], kind: 'flat', val: 1, dur: 'once' };
    addFx(S, p); const ajoute = S.fx[1];
    egal([ajoute.n, ajoute.src, ajoute.sc], ['P', 'Mira', ['atk']], 'effet ajouté, source nettoyée');
    verifier(ajoute.sc !== p.sc && typeof ajoute.id === 'string' && ajoute.id, 'portée recopiée, identifiant posé');
    S.rbOpen = true; for (let i = 0; i < 45; i++) push(S, { tot: i });
    egal([S.rolls.length, S.rolls[0].tot, S.rbOpen], [40, 44, false], 'quarante jets gardés, le plus récent en tête, détail refermé');
  }],
  ['l’exemple joue sans erreur : un tour complet', () => {
    const S = sample();
    push(S, d20(S, S.init, 'Initiative', 'chk', impose([12, 3])));
    S.mode = 'combat'; startTurn(S);
    const r = d20(S, +S.attacks[0].hit, S.attacks[0].n, 'atk', impose([20, 5]));
    egal([r.nat, r.tot], [20, 27], 'critique avec l’arc long');
    damage(S, 10); egal(S.hp, 18, 'dégâts');
    heal(S, 100); egal(S.hp, 28, 'soins');
  }],
];

export async function executer() {
  return executerSuite('fiche (règles) : ', TESTS);
}
