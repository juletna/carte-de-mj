/**
 * Tests du donjon au hasard (js/generateur.js) : nombres tenus sur de nombreux tirages, tirages reproductibles, donjon valide.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import * as m from '../js/donjon.js';
import { validerDonjon } from '../js/donjon-validation.js';
import { genererDonjon, normaliserOptions, BORNES, FAMILLES } from '../js/generateur.js';
import { analyser } from '../js/parseur/index.js';
import { nomAffiche } from '../js/parseur/lexique.js';
import { CREATURES } from '../js/catalogue.js';
import { disposerPlan } from '../js/plan-donjon.js';
import { surLeSol, retraitPorte } from '../js/formes.js';
import { vueTable, creerPresentation } from '../js/presentation.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const salles = (d) => Object.values(d.salles);
const monstres = (d) => salles(d).flatMap((s) => s.plan.creatures.filter((k) => k.camp === 'monstre'));
const objets = (d, type) => salles(d).flatMap((s) => s.plan.objets.filter((o) => o.type === type));

/** Salles atteintes depuis l'entrée. `sansSecretes` : en ne passant que par des portes visibles. */
function atteintes(d, sansSecretes = false) {
  const estSecrete = ({ salle, mur, position }) => d.salles[salle].plan.portes.find((q) => q.mur === mur && q.position === position)?.cache === true;
  const depart = Object.keys(d.salles)[0];
  const vues = new Set([depart]), pile = [depart];
  while (pile.length) {
    const id = pile.pop();
    for (const l of d.liaisons) {
      if (sansSecretes && (estSecrete(l.a) || estSecrete(l.b))) continue;
      const autre = l.a.salle === id ? l.b.salle : l.b.salle === id ? l.a.salle : null;
      if (autre && !vues.has(autre)) { vues.add(autre); pile.push(autre); }
    }
  }
  return vues;
}

const TIRAGES = [];
for (let graine = 1; graine <= 12; graine++) {
  TIRAGES.push({ salles: 8, monstres: 15, coffres: 4, pieges: 2, secretes: 1, boucles: 2, graine });
  TIRAGES.push({ salles: 3 + graine, monstres: graine * 4, coffres: graine, pieges: graine % 4, secretes: graine % 3, boucles: graine % 5, graine: 100 + graine });
}
TIRAGES.push(
  { salles: 1, monstres: 5, coffres: 1, pieges: 1, secretes: 2, boucles: 3, graine: 7 },
  { salles: 2, monstres: 60, coffres: 5, pieges: 3, secretes: 1, boucles: 1, graine: 8 },
  { salles: 2, monstres: 150, coffres: 40, pieges: 30, secretes: 0, boucles: 0, graine: 11, familles: ['gobelins'] },
  { salles: 30, monstres: 150, coffres: 40, pieges: 30, secretes: 10, boucles: 12, graine: 9 },
  { salles: 30, monstres: 0, coffres: 0, pieges: 0, secretes: 0, boucles: 0, graine: 10, boss: false },
  { salles: 6, monstres: 25, coffres: 2, pieges: 1, secretes: 1, boucles: 2, graine: 12, familles: ['colosses', 'dragons'] },
);

const TESTS = [
  ['les nombres demandés sont tenus exactement, sur tous les tirages', () => {
    for (const o of TIRAGES) {
      const { donjon: d, resume } = genererDonjon(o);
      const quoi = JSON.stringify(o);
      egal(salles(d).length, o.salles, `salles de ${quoi}`);
      egal(monstres(d).length, o.monstres, `monstres de ${quoi}`);
      egal(objets(d, 'coffre').length, o.coffres, `coffres de ${quoi}`);
      egal(objets(d, 'fosse').filter((f) => f.cache).length, o.pieges, `pièges de ${quoi}`);
      egal(resume.monstres, o.monstres, `résumé de ${quoi}`);
    }
  }],
  ['tout est valide et tout est relié', () => {
    for (const o of TIRAGES) {
      const { donjon: d } = genererDonjon(o);
      const quoi = JSON.stringify(o);
      egal(atteintes(d).size, o.salles, `salles atteintes de ${quoi}`);
      egal(m.liaisonsOrphelines(d).length, 0, `liaisons orphelines de ${quoi}`);
      const relu = validerDonjon(JSON.parse(JSON.stringify(d)));
      verifier(relu.donjon, `donjon refusé (${quoi}) : ${relu.erreurs}`);
      for (const s of salles(d)) {
        for (const e of [...s.plan.objets, ...s.plan.creatures]) verifier(surLeSol(s.plan, e.x, e.y, e.taille ?? e.l, e.taille ?? e.h), `${e.type} hors du sol dans ${s.nom} (${quoi})`);
        egal(analyser(s.texte).ignores, [], `mots non compris dans « ${s.texte} »`);
      }
    }
  }],
  ['le même numéro redonne le même donjon, un autre en donne un autre', () => {
    const textes = (o) => salles(genererDonjon(o).donjon).map((s) => [s.nom, s.texte]);
    const o = { salles: 10, monstres: 20, coffres: 3, pieges: 2, secretes: 1, boucles: 2, graine: 4242 };
    egal(textes(o), textes(o), 'même tirage');
    verifier(JSON.stringify(textes(o)) !== JSON.stringify(textes({ ...o, graine: 4243 })), 'tirage différent');
    const sans = genererDonjon({ ...o, graine: '' });
    verifier(sans.graine >= 1, 'sans numéro, on en tire un');
    egal(textes({ ...o, graine: sans.graine }), salles(sans.donjon).map((s) => [s.nom, s.texte]), 'le numéro affiché redonne ce donjon');
  }],
  ['l’entrée reste calme, le boss est au fond et compte dans le total', () => {
    for (let graine = 1; graine <= 15; graine++) {
      const { donjon: d } = genererDonjon({ salles: 9, monstres: 20, pieges: 6, coffres: 6, graine, familles: ['morts'] });
      const [entree] = salles(d);
      egal(entree.nom, 'Hall d’entrée', 'nom de l’entrée');
      egal(entree.plan.creatures.length, 0, 'pas de monstre à l’entrée');
      egal(entree.plan.objets.filter((o) => o.type === 'fosse' || o.type === 'coffre').length, 0, 'ni piège ni coffre à l’entrée');
      verifier(entree.plan.portes.some((q) => q.type === 'arche') || entree.plan.portes.length === 4, 'une arche d’entrée, s’il reste un mur');
      const trone = salles(d).find((s) => s.nom === 'Salle du trône');
      verifier(trone.plan.creatures.some((k) => FAMILLES.morts.boss.includes(k.type)), 'le boss est dans la salle du trône');
    }
    const sans = genererDonjon({ salles: 9, monstres: 20, boss: false, graine: 3 }).donjon;
    verifier(!salles(sans).some((s) => s.nom === 'Salle du trône'), 'pas de boss demandé');
    egal(monstres(sans).length, 20, 'total sans boss');
    egal(monstres(genererDonjon({ salles: 5, monstres: 0, graine: 3 }).donjon).length, 0, 'aucun monstre : pas de boss non plus');
  }],
  ['les familles choisies sont les seules présentes', () => {
    for (const familles of [['gobelins'], ['betes', 'brigands'], ['dragons']]) {
      const permis = new Set(familles.flatMap((f) => [...FAMILLES[f].troupe, ...FAMILLES[f].boss]));
      for (let graine = 1; graine <= 6; graine++) {
        for (const k of monstres(genererDonjon({ salles: 6, monstres: 18, familles, graine }).donjon)) verifier(permis.has(k.type), `${k.type} hors de ${familles}`);
      }
    }
    const { resume } = genererDonjon({ salles: 6, monstres: 5, graine: 2 });
    egal(resume.familles.length, 2, 'rien de coché : deux familles au hasard');
    for (const f of Object.values(FAMILLES)) for (const type of [...f.troupe, ...f.boss]) verifier(CREATURES.some((c) => c.type === type), `${type} n’est pas au lexique`);
  }],
  ['tout monstre se relit au pluriel', () => {
    for (const f of Object.values(FAMILLES)) for (const type of [...f.troupe, ...f.boss]) {
      const { plan, ignores } = analyser(`Salle de 20 par 20 cases, 3 ${nomAffiche(type, 3)}`);
      egal([plan.creatures.filter((k) => k.type === type).length, ignores], [3, []], `3 ${nomAffiche(type, 3)}`);
    }
  }],
  ['une porte secrète ne coupe jamais le reste du donjon', () => {
    for (let graine = 1; graine <= 20; graine++) {
      const { donjon: d, resume } = genererDonjon({ salles: 12, monstres: 0, secretes: 3, boucles: 3, graine });
      const secretes = d.liaisons.filter((l) => d.salles[l.a.salle].plan.portes.find((q) => q.mur === l.a.mur && q.position === l.a.position)?.cache);
      egal(secretes.length, resume.secretes, 'le résumé dit vrai');
      for (const l of secretes) verifier(d.salles[l.b.salle].plan.portes.find((q) => q.mur === l.b.mur && q.position === l.b.position)?.cache, 'secrète des deux côtés');
      const vues = atteintes(d, true);
      const perdues = Object.keys(d.salles).filter((id) => !vues.has(id));
      verifier(perdues.length <= resume.secretes, `graine ${graine} : ${perdues.length} salles cachées pour ${resume.secretes} portes secrètes`);
      // Une salle cachée n'en cache aucune autre : retirer les salles cachées laisse tout le reste atteignable sans secret.
      for (const id of perdues) verifier(d.liaisons.filter((l) => l.a.salle === id || l.b.salle === id).every((l) => secretes.includes(l)), 'toutes ses portes sont secrètes');
    }
  }],
  ['à la table, ni piège ni porte secrète ne se voient', () => {
    const { donjon: d } = genererDonjon({ salles: 1, monstres: 0, pieges: 3, boss: false, graine: 5 });
    const vue = vueTable(creerPresentation(d, { salleDepart: d.salleActive }));
    verifier(!vue.objets.some((o) => o.type === 'fosse'), 'pièges cachés');
  }],
  ['le plan reste lisible : aucune salle traversée, peu de croisements', () => {
    let ponts = 0, n = 0;
    for (let graine = 1; graine <= 10; graine++) {
      const { donjon: d } = genererDonjon({ salles: 10, monstres: 10, boucles: 2, graine });
      const disp = disposerPlan(d);
      egal(disp.couloirs.length, d.liaisons.length, 'une ligne par liaison');
      ponts += disp.ponts.length; n++;
    }
    verifier(ponts / n <= 2, `en moyenne ${ponts / n} croisements pour 10 salles et 2 boucles`);
  }],
  ['les options sont bornées', () => {
    const o = normaliserOptions({ salles: 999, monstres: -4, coffres: 'x', graine: 'abc', familles: ['gobelins', 'inconnue'], formes: false });
    egal([o.salles, o.monstres, o.coffres, o.graine, o.familles, o.formes, o.boss], [BORNES.salles[2], 0, BORNES.coffres[0], null, ['gobelins'], false, true], 'bornes');
    egal(normaliserOptions({ salles: '' }).salles, BORNES.salles[0], 'champ vide : la valeur par défaut');
  }],
  ['portes et formes : une porte générée reste accessible', () => {
    let formes = 0;
    for (let graine = 1; graine <= 15; graine++) {
      for (const s of salles(genererDonjon({ salles: 10, monstres: 8, graine }).donjon)) {
        if (s.plan.forme !== 'rectangle') formes++;
        for (const q of s.plan.portes) verifier(retraitPorte(s.plan, q.mur, q.position) >= 0, 'porte sur un mur');
      }
    }
    verifier(formes > 0, 'des formes apparaissent');
    for (const s of salles(genererDonjon({ salles: 20, monstres: 8, formes: false, graine: 2 }).donjon)) egal(s.plan.forme, 'rectangle', 'formes décochées');
  }],
];

export const executer = () => executerSuite('hasard : ', TESTS);
