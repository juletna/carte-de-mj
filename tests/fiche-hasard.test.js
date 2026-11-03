/**
 * Tests de la fiche au hasard (js/fiche-hasard.js) : tirages reproductibles, règles tenues sur de nombreux tirages, fiche lisible par l'outil.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import * as m from '../js/donjon.js';
import { genererFiches, normaliserOptions, decrireTirage, BORNES, CLASSES, RACES, GRAINE_MAX } from '../js/fiche-hasard.js';
import { genererDonjon } from '../js/generateur.js';
import { resumerFiche, ajouterPersonnage, STATS } from '../js/personnages.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const mod = (v) => Math.floor((v - 10) / 2);
/** Les compétences reconnues par l'outil Fiche (SKILLS de fiche.html). */
const COMPETENCES = ['Acrobaties', 'Arcanes', 'Athlétisme', 'Discrétion', 'Dressage', 'Escamotage', 'Histoire', 'Intimidation', 'Intuition', 'Investigation', 'Médecine', 'Nature', 'Perception', 'Persuasion', 'Religion', 'Représentation', 'Survie', 'Tromperie'];

const TESTS = [
  ['le même numéro et les mêmes paramètres redonnent les mêmes fiches ; sans numéro, un nouveau tirage', () => {
    const a = genererFiches({ graine: 1234, nombre: 3, niveau: 5 });
    egal(a.graine, 1234, 'le numéro est rendu');
    egal(genererFiches({ graine: 1234, nombre: 3, niveau: 5 }), a, 'même tirage');
    verifier(JSON.stringify(genererFiches({ graine: 1235, nombre: 3, niveau: 5 })) !== JSON.stringify(a), 'autre numéro, autres fiches');
    egal(genererFiches({ graine: 1234, nombre: 1, niveau: 5 }).fiches[0], a.fiches[0], 'en demander moins garde les premières');
    const sans = genererFiches({});
    verifier(Number.isInteger(sans.graine) && sans.graine >= 1 && sans.graine <= GRAINE_MAX, 'un numéro est tiré');
    egal(genererFiches({ graine: sans.graine }), sans, 'et il permet de retrouver la fiche');
  }],
  ['les options sont bornées et les valeurs inconnues écartées', () => {
    egal(normaliserOptions({}), { nombre: 1, niveau: 1, classe: null, race: null, graine: null }, 'défauts');
    egal(normaliserOptions({ nombre: 99, niveau: 0, classe: 'constructor', race: '__proto__', graine: 'x' }), { nombre: BORNES.nombre[2], niveau: 1, classe: null, race: null, graine: null }, 'bornes');
    egal(normaliserOptions({ nombre: '3', niveau: '7', classe: 'barde', race: 'nain', graine: '42' }), { nombre: 3, niveau: 7, classe: 'barde', race: 'nain', graine: 42 }, 'venues d’un formulaire');
    egal(normaliserOptions({ nombre: '', niveau: '', graine: '' }), { nombre: 1, niveau: 1, classe: null, race: null, graine: null }, 'champs vides');
    egal(normaliserOptions({ graine: GRAINE_MAX + 1 }).graine, null, 'numéro trop grand');
  }],
  ['classe, race et niveau demandés sont tenus', () => {
    for (const [cle, classe] of Object.entries(CLASSES)) {
      const { fiches, resume } = genererFiches({ graine: 7, classe: cle, race: 'nain', niveau: 3, nombre: 2 });
      egal(fiches.map((f) => [f.cls, f.race, f.lvl]), [[classe.nom, 'Nain', 3], [classe.nom, 'Nain', 3]], cle);
      egal(resume[0], { nom: fiches[0].name, race: 'Nain', classe: classe.nom, niveau: 3 }, 'résumé');
    }
    egal(decrireTirage({ nom: 'Mira', race: 'Humain', classe: 'Barde', niveau: 1 }), 'Mira (Humain, Barde, niveau 1)', 'phrase');
  }],
  ['dans un groupe, les noms sont différents et les classes ne se répètent qu’une fois toutes tirées', () => {
    for (let graine = 1; graine <= 50; graine++) {
      const { fiches } = genererFiches({ graine, nombre: BORNES.nombre[2] });
      egal(new Set(fiches.map((f) => f.name)).size, fiches.length, `noms, tirage ${graine}`);
      egal(new Set(fiches.map((f) => f.cls)).size, fiches.length, `classes, tirage ${graine}`);
    }
  }],
  ['sur de nombreux tirages, une fiche respecte les règles et le format de l’outil Fiche', () => {
    for (let graine = 1; graine <= 300; graine++) {
      const niveau = 1 + (graine % 20);
      const [f] = genererFiches({ graine, niveau }).fiches;
      const de = Object.values(CLASSES).find((c) => c.nom === f.cls).de;
      const ou = `tirage ${graine} (${f.cls}, niveau ${niveau})`;
      for (const s of STATS) verifier(Number.isInteger(f.stats[s]) && f.stats[s] >= 3 && f.stats[s] <= 20, `${s}=${f.stats[s]}, ${ou}`);
      egal(Object.keys(f.stats), STATS, `ordre des caractéristiques, ${ou}`);
      egal(f.prof, 2 + Math.floor((niveau - 1) / 4), `maîtrise, ${ou}`);
      egal(f.init, mod(f.stats.DEX), `initiative, ${ou}`);
      egal(f.hp, f.hpMax, `PV pleins, ${ou}`);
      verifier(f.hpMax >= niveau, `PV ${f.hpMax}, ${ou}`);
      if (niveau === 1) egal(f.hpMax, Math.max(1, de + mod(f.stats.CON)), `PV au niveau 1, ${ou}`);
      egal(f.hd, { die: de, used: 0 }, `dé de vie, ${ou}`);
      verifier(f.ac >= 8 && f.ac <= 30, `CA ${f.ac}, ${ou}`);
      egal(f.slots.length, 9, `9 niveaux de sorts, ${ou}`);
      verifier(f.slots.every((s) => s.used === 0 && s.max >= 0 && s.max <= 9), `emplacements, ${ou}`);
      for (const c of Object.keys(f.skills)) verifier(COMPETENCES.includes(c), `compétence inconnue ${c}, ${ou}`);
      verifier(f.saveProf.length === 2 && f.saveProf.every((s) => STATS.includes(s)), `sauvegardes, ${ou}`);
      verifier(f.attacks.length > 0, `attaques, ${ou}`);
      for (const a of f.attacks) {
        verifier(/^\d+d\d+([+-]\d+)?$/.test(a.dmg), `dégâts « ${a.dmg} », ${ou}`);
        verifier(Number.isInteger(a.hit), `toucher, ${ou}`);
        if (a.ammo) verifier(f.ammo.some((x) => x.n === a.ammo), `munition ${a.ammo} absente, ${ou}`);
      }
      verifier(f.res.every((r) => ['court', 'long'].includes(r.rest) && r.max >= 1 && r.max <= 20 && r.used === 0), `capacités, ${ou}`);
      verifier(f.inv.every((o) => o.n && o.q >= 1 && o.type), `sac, ${ou}`);
    }
  }],
  ['les paliers suivent le niveau : sorts, maîtrise, caractéristique principale', () => {
    const fiche = (classe, niveau) => genererFiches({ graine: 11, classe, niveau, race: 'humain' }).fiches[0];
    const sorts = (f) => f.slots.map((s) => s.max);
    egal(sorts(fiche('magicien', 1)), [2, 0, 0, 0, 0, 0, 0, 0, 0], 'magicien niveau 1');
    egal(sorts(fiche('magicien', 20)), [4, 3, 3, 3, 3, 2, 2, 1, 1], 'magicien niveau 20');
    egal(sorts(fiche('paladin', 1)), [0, 0, 0, 0, 0, 0, 0, 0, 0], 'paladin niveau 1 : pas encore de sort');
    egal(sorts(fiche('paladin', 5)), [4, 2, 0, 0, 0, 0, 0, 0, 0], 'paladin niveau 5');
    egal(sorts(fiche('occultiste', 1)), [1, 0, 0, 0, 0, 0, 0, 0, 0], 'occultiste niveau 1');
    egal(sorts(fiche('occultiste', 5)), [0, 0, 2, 0, 0, 0, 0, 0, 0], 'occultiste niveau 5');
    egal(sorts(fiche('occultiste', 20)), [0, 0, 0, 0, 4, 0, 0, 0, 0], 'occultiste niveau 20');
    egal(sorts(fiche('guerrier', 20)), [0, 0, 0, 0, 0, 0, 0, 0, 0], 'guerrier : aucun sort');
    egal(fiche('magicien', 5).attacks[0].dmg, '2d10', 'sort mineur au niveau 5');
    verifier(fiche('guerrier', 20).stats.FOR >= fiche('guerrier', 1).stats.FOR, 'la caractéristique principale monte');
  }],
  ['le Donjon la lit comme une autre fiche, et elle ne dépend d’aucun autre tirage', () => {
    const { fiches: [f] } = genererFiches({ graine: 3, classe: 'guerrier', niveau: 4 });
    const r = resumerFiche(f);
    egal([r.nom, r.classe, r.niveau, r.pv, r.pvMax, r.vitesse], [f.name, 'Guerrier', 4, f.hp, f.hpMax, f.speed], 'le résumé');
    egal(r.ca, f.ac + 2, 'le bouclier équipé compte dans la CA du résumé');
    egal(r.attaques.length, f.attacks.length, 'ses attaques');
    egal(resumerFiche(r), r, 'relire le résumé le laisse tel quel');
    const d = m.creerDonjon({ texte: 'Salle de 6 par 6 cases.' });
    verifier(ajouterPersonnage(d, r), 'associée au donjon');
    egal(m.validerDonjon(JSON.parse(JSON.stringify(d))).donjon.personnages[0].fiche, r, 'elle survit à la relecture du donjon');
    const a = genererDonjon({ graine: 77, salles: 3 }), b = genererDonjon({ graine: 77, salles: 3 });
    egal(Object.values(a.donjon.salles).map((s) => s.texte), Object.values(b.donjon.salles).map((s) => s.texte), 'le générateur de donjon reste reproductible');
    verifier(Object.keys(RACES).length > 1, 'plusieurs races');
  }],
];

export const executer = () => executerSuite('fiche au hasard : ', TESTS);
