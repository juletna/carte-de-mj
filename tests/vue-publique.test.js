/**
 * Découpage de presentation.js : la façade réexporte partie.js, passage.js et vue-publique.js sans en perdre ni en doubler un nom,
 * et vue-publique.js (ce que voient la table et l'impression) n'embarque pas le parseur.
 * Puis, à la suite, ce que vue-publique.js laisse voir à la table : `vueTable`, la case montrée, l'encart du plan (`miniPlanTable`,
 * `recevoirMiniPlan`), le masquage vu de la table, et leur relecture côté table, sans qu'une valeur secrète sorte.
 * Les fichiers sont lus par `lire(chemin)` (disque sous Node, fetch dans tests.html).
 */
import * as facade from '../js/presentation.js';
import * as partie from '../js/partie.js';
import * as passage from '../js/passage.js';
import * as vue from '../js/vue-publique.js';
import * as m from '../js/donjon.js';
import * as p from '../js/presentation.js';
import { disposerPlan } from '../js/plan-donjon.js';
import { validerPlan } from '../js/schema.js';
import { donjonDeTest, presentationAvecSecrets } from './aides-partie.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const analyserPlanCroix = () => validerPlan({ largeur: 9, longueur: 9, forme: 'croix', bras: 3 }).plan;
const SENTINELLES = [
  'SENT-NOTE-A', 'SENT-NOTE-B', 'SENT-NOTE-C', 'SENT-TEXTE-A', 'SENT-TEXTE-C', 'SENT-NOM-A', 'SENT-NOM-C', 'SENT-DONJON', 'SENT-PLAN-NOM',
  'SENT-ID-COFFRE', 'SENT-CHAMP-COFFRE', 'SENT-ID-PORTE', 'SENT-CHAMP-PORTE', 'SENT-ID-GOBELIN', 'SENT-CHAMP-GOBELIN',
  'SENT-LIAISON', 'SENT-CONNEXION', 'SENT-CONTENU-C', 'SENT-ID-PORTE-B', 'SENT-NOTE-PARTIE-A', 'SENT-NOTE-PARTIE-B',
];

/** Chemin normalisé d'un import relatif (« ./x.js » ou « ../x.js ») depuis un module du site. */
function resoudre(depuis, cible) {
  const morceaux = depuis.split('/').slice(0, -1);
  for (const m of cible.split('/')) {
    if (m === '..') morceaux.pop();
    else if (m !== '.') morceaux.push(m);
  }
  return morceaux.join('/');
}

/** Tous les modules que `racine` charge, de proche en proche. */
async function fermeture(racine, lire) {
  const vus = new Set();
  const aVoir = [racine];
  while (aVoir.length) {
    const chemin = aVoir.pop();
    if (vus.has(chemin)) continue;
    vus.add(chemin);
    const source = await lire(chemin);
    for (const m of source.matchAll(/(?:import|export)\s*(?:[^'"]*?from\s*)?['"](\.[^'"]+)['"]/g)) aVoir.push(resoudre(chemin, m[1]));
  }
  return vus;
}

const TESTS_PRESENTATION = [
  ['vueTable : aucune valeur secrète ne sort (notes, cachés, autres salles, liaisons)', () => {
    const { pres, a } = presentationAvecSecrets();
    const sortie = JSON.stringify(p.vueTable(pres));
    for (const s of SENTINELLES) verifier(!sortie.includes(s), `« ${s} » est sorti dans la vue table : ${sortie.slice(0, 300)}`);
    verifier(!sortie.includes('cache'), 'aucun champ cache dans la vue table');
    verifier(!sortie.includes('liaison') && !sortie.includes('"vers"'), 'aucune information de liaison');
    const vue = p.vueTable(pres);
    verifier(vue.largeur === 8 && vue.objets.some((o) => o.type === 'pilier') && vue.creatures.length === 3, 'le visible est bien là (pilier, 2 pj et le gobelin visible)');
    verifier(!vue.objets.some((o) => o.type === 'coffre') && vue.portes.length === 1 && vue.portes[0].mur === 'est', 'ni le coffre caché, ni la porte secrète');
    verifier(!vue.creatures.some((k) => k.x === 7 && k.y === 7), 'ni le gobelin caché');
    // Dans une autre salle : rien de la première non plus.
    p.passerPorte(pres, a.id, 'p2', { groupe: false });
    const sortieB = JSON.stringify(p.vueTable(pres));
    for (const s of SENTINELLES.filter((x) => x !== 'SENT-ID-COFFRE')) verifier(!sortieB.includes(s), `« ${s} » est sorti depuis la deuxième salle`);
    verifier(!sortieB.includes('"pilier"'), 'rien de la première salle');
  }],

  ['case montrée : seulement une case de sol de la salle', () => {
    const plan = analyserPlanCroix();
    egal(p.recevoirCaseVisee({ x: 4, y: 4 }, plan), { x: 4, y: 4 }, 'au centre');
    egal(p.recevoirCaseVisee({ x: 4, y: 4, nom: 'SECRET' }, plan), { x: 4, y: 4 }, 'champ inconnu écarté');
    egal(p.recevoirCaseVisee({ x: 0, y: 0 }, plan), null, 'case retirée');
    egal(p.recevoirCaseVisee({ x: 99, y: 0 }, plan), null, 'hors de la salle');
    for (const brut of [null, undefined, 'x', {}, { x: 1.5, y: 1 }, { x: '1', y: 1 }]) egal(p.recevoirCaseVisee(brut, plan), null, `refusé : ${JSON.stringify(brut)}`);
    egal(p.recevoirCaseVisee({ x: 4, y: 4 }, null), null, 'pas de plan');
  }],

  ['encart de la table : seulement les salles découvertes, sans nom, ni identifiant, ni pion', () => {
    const { d, a, b, c } = donjonDeTest();
    const pres = p.creerPresentation(d, { salleDepart: a.id });
    const debut = p.miniPlanTable(pres);
    egal(Object.keys(debut.plans).length, 1, 'au départ : la salle de départ seule');
    egal(debut.couloirs, [], 'aucun couloir vers une salle non découverte');
    const complet = disposerPlan(d);
    egal([debut.largeur, debut.longueur], [complet.largeur, complet.longueur], 'le cadre est celui du plan complet');
    egal(debut.plans[debut.actif].largeur, 8, 'elle est la salle active');
    p.afficherATable(pres, b.id);
    const deux = p.miniPlanTable(pres);
    egal(Object.keys(deux.plans).length, 2, 'deux salles découvertes');
    egal(deux.couloirs.length, 1, 'le couloir entre les deux');
    egal(deux.plans[deux.actif].largeur, 6, 'la surbrillance suit la salle en cours');
    egal(deux.positions.s0, debut.positions.s0, 'une salle ne bouge pas quand une autre se découvre');
    egal([deux.largeur, deux.longueur], [debut.largeur, debut.longueur], 'le cadre ne change pas non plus');
    const sortie = JSON.stringify(deux);
    for (const s of ['Crypte', 'Couloir', 'Trésor', a.id, b.id, c.id, 'liaison']) verifier(!sortie.includes(s), `« ${s} » est sorti dans l’encart`);
    for (const plan of Object.values(deux.plans)) egal([plan.nom, plan.creatures], ['', []], 'ni nom, ni pion');
    verifier(!Object.values(deux.plans).some((q) => q.largeur === 4), 'rien de la salle non découverte');
    verifier(!sortie.includes('"cache"'), 'aucun champ cache');
    p.afficherATable(pres, a.id);
    egal(Object.keys(p.miniPlanTable(pres).plans).length, 2, 'revenir en arrière n’oublie rien');
    egal(p.miniPlanTable({ donjon: { salles: {} }, salleCourante: 'x' }), null, 'pas de salle courante : pas d’encart');
  }],

  ['encart de la table : les portes pas encore ouvertes sont marquées, sans rien dire de ce qu’il y a derrière', () => {
    const { d, a, b } = donjonDeTest();
    const pres = p.creerPresentation(d, { salleDepart: a.id });
    const portes = (mini) => mini.portesFermees.map((q) => [mini.plans[q.salle].largeur, q.mur, q.position]);
    egal(portes(p.miniPlanTable(pres)), [[8, 'est', 2]], 'au départ : la porte est de A, pas la porte secrète');
    p.afficherATable(pres, b.id);
    egal(portes(p.miniPlanTable(pres)), [[6, 'sud', 2]], 'A et B sont reliées : leur porte est ouverte, reste celle vers C');
    const sans = m.ajouterSalle(d, { nom: 'Vide', texte: 'Salle de 5 par 5 cases, une porte au mur est en 2.' });
    const pres2 = p.creerPresentation(d, { salleDepart: sans.id });
    const mini = p.miniPlanTable(pres2);
    egal(portes(mini), [[5, 'est', 1]], 'une porte reliée à rien est marquée pareil');
    verifier(!JSON.stringify(mini.portesFermees).includes(sans.id), 'aucun identifiant de salle');
    const secrete = pres.donjon.salles[a.id].plan.portes.find((q) => q.cache);
    p.revelerElement(pres, a.id, secrete.id);
    p.afficherATable(pres, a.id);
    verifier(portes(p.miniPlanTable(pres)).some(([l, mur]) => l === 8 && mur === secrete.mur), 'révélée : elle compte comme non ouverte');
    egal(p.portesNonOuvertes(pres, disposerPlan(pres.donjon)).length, p.miniPlanTable(pres).portesFermees.length, 'la régie voit les mêmes');
    const relue = p.recevoirMiniPlan(p.miniPlanTable(pres));
    egal(relue.portesFermees, p.miniPlanTable(pres).portesFermees, 'la table les relit');
    const base = p.miniPlanTable(pres);
    for (const faux of [{ salle: 'autre', mur: 'est', position: 0 }, { salle: base.actif, mur: 'haut', position: 0 }, { salle: base.actif, mur: 'est', position: -1 }, { salle: 'constructor', mur: 'est', position: 0 }]) {
      egal(p.recevoirMiniPlan({ ...base, portesFermees: [faux] }), null, `refusé : ${JSON.stringify(faux)}`);
    }
    verifier(!JSON.stringify(p.recevoirMiniPlan({ ...base, portesFermees: [{ salle: base.actif, mur: 'est', position: 0, nom: 'SECRET' }] })).includes('SECRET'), 'champ inconnu écarté');
  }],

  ['encart de la table : un élément caché reste caché, révélé il apparaît', () => {
    const { d, a } = donjonDeTest();
    const pres = p.creerPresentation(d, { salleDepart: a.id });
    const types = () => { const m0 = p.miniPlanTable(pres); return m0.plans[m0.actif].objets.map((o) => o.type); };
    const coffre = pres.donjon.salles[a.id].plan.objets.find((o) => o.type === 'coffre');
    verifier(!types().includes('coffre'), 'coffre caché : absent');
    p.revelerElement(pres, a.id, coffre.id);
    verifier(types().includes('coffre'), 'révélé : présent');
    p.recacherElement(pres, a.id, coffre.id);
    verifier(!types().includes('coffre'), 'recaché : absent');
  }],

  ['encart de la table : un couloir derrière une porte secrète non révélée ne se devine pas', () => {
    const { d, a } = donjonDeTest();
    const caveau = m.ajouterSalle(d, { nom: 'Caveau', texte: 'Salle de 5 par 5 cases, une porte au mur sud en C.' });
    const secrete = d.salles[a.id].plan.portes.find((q) => q.mur === 'nord');
    m.relier(d, { salle: a.id, mur: 'nord', position: secrete.position }, { salle: caveau.id, mur: 'sud', position: 2 });
    const pres = p.creerPresentation(d, { salleDepart: a.id });
    const idPorte = pres.donjon.salles[a.id].plan.portes.find((q) => q.mur === 'nord').id;
    p.afficherATable(pres, caveau.id);
    egal(p.miniPlanTable(pres).couloirs, [], 'les deux salles sont connues, la porte reste secrète');
    p.revelerElement(pres, a.id, idPorte);
    egal(p.miniPlanTable(pres).couloirs.length, 1, 'révélée : le couloir apparaît');
    p.recacherElement(pres, a.id, idPorte);
    egal(p.miniPlanTable(pres).couloirs, [], 'recachée : il disparaît');
  }],

  ['encart de la table : la fenêtre table relit ce qu’elle reçoit, champ par champ', () => {
    const { d, a, b } = donjonDeTest();
    const pres = p.creerPresentation(d, { salleDepart: a.id });
    p.afficherATable(pres, b.id);
    const mini = p.miniPlanTable(pres);
    const relue = p.recevoirMiniPlan(mini);
    egal(relue.actif, mini.actif, 'la salle active');
    egal(relue.disposition.positions, mini.positions, 'les positions');
    egal(relue.disposition.couloirs, mini.couloirs, 'les couloirs');
    egal(Object.keys(relue.donjon.salles), Object.keys(mini.plans), 'les salles');
    const piegee = { ...mini, nom: 'SECRET', couloirs: [{ chemin: [{ x: 1, y: 1, nom: 'SECRET' }], nom: 'SECRET' }] };
    piegee.plans = { ...mini.plans, [mini.actif]: { ...mini.plans[mini.actif], nom: 'SECRET', notes: 'SECRET', creatures: [{ id: 'c', type: 'gobelin', camp: 'monstre', x: 0, y: 0, taille: 1, numero: 1 }], objets: [{ id: 'o', type: 'coffre', x: 0, y: 0, cache: true }] } };
    const propre = p.recevoirMiniPlan(piegee);
    verifier(!JSON.stringify(propre).includes('SECRET'), 'les champs inconnus sont écartés');
    egal(propre.donjon.salles[mini.actif].plan.creatures, [], 'aucun pion');
    egal(propre.donjon.salles[mini.actif].plan.objets, [], 'un objet marqué caché est écarté');
    for (const brut of [null, 'x', {}, { ...mini, largeur: 'grand' }, { ...mini, actif: 'absente' }, { ...mini, positions: { autre: mini.positions[mini.actif] } }, { ...mini, couloirs: [{ chemin: [{ x: -1, y: 0 }] }] }, { ...mini, plans: {} }]) {
      egal(p.recevoirMiniPlan(brut), null, `refusé : ${JSON.stringify(brut)?.slice(0, 40)}`);
    }
  }],

  ['vueTable : un élément révélé apparaît, recaché il disparaît ; salle absente → null', () => {
    const { pres, a } = presentationAvecSecrets();
    const types = () => p.vueTable(pres).objets.map((o) => o.type).sort().join(',');
    egal(types(), 'pilier', 'caché : absent');
    p.revelerElement(pres, a.id, 'SENT-ID-COFFRE');
    egal(types(), 'coffre,pilier', 'révélé : présent');
    const vue = p.vueTable(pres);
    verifier(!('cache' in vue.objets[0]) && !JSON.stringify(vue).includes('SENT-CHAMP-COFFRE'), 'sans cache, sans champ inconnu');
    verifier(!JSON.stringify(vue).includes('SENT-NOTE-A'), 'les notes restent chez le MJ');
    p.revelerElement(pres, a.id, 'SENT-ID-PORTE');
    egal(p.vueTable(pres).portes.length, 2, 'porte secrète révélée : visible');
    p.recacherElement(pres, a.id, 'SENT-ID-COFFRE');
    egal(types(), 'pilier', 'recaché : absent de nouveau');
    egal(p.vueTable({ donjon: { salles: {} }, salleCourante: 'x', reveles: {} }), null, 'pas de salle courante');
    // Valeur « cache » inattendue (1, "oui") : traitée comme cachée.
    pres.donjon.salles[a.id].plan.objets[1].cache = 'oui';
    verifier(!p.vueTable(pres).objets.some((o) => o.id === pres.donjon.salles[a.id].plan.objets[1].id), 'cache truthy : masqué');
  }],

  ['vueTable : côté table, un plan reçu est relu et tout élément caché écarté', () => {
    const { pres } = presentationAvecSecrets();
    const vue = p.vueTable(pres);
    const recu = p.recevoirVueTable(JSON.parse(JSON.stringify(vue)));
    egal(recu.objets.length, vue.objets.length, 'rien de perdu pour un plan légitime');
    const piege = JSON.parse(JSON.stringify(vue));
    piege.objets.push({ id: 'z', type: 'coffre', x: 0, y: 0, l: 1, h: 1, rotation: 0, cache: true });
    piege.nom = 'SENT-NOM';
    piege.connexions = [{ vers: 'SENT-CONNEXION' }];
    const sortie = JSON.stringify(p.recevoirVueTable(piege));
    verifier(!sortie.includes('SENT-') && !sortie.includes('"z"'), 'élément caché, nom et connexions écartés');
    egal(p.recevoirVueTable('n’importe quoi'), null, 'valeur absurde → null');
    egal(p.recevoirVueTable({ largeur: 0 }), null, 'plan invalide → null');
  }],

  ['masquage : un élément masqué ne part pas vers la table, ni dans la carte ni dans l’encart ; caché et masqué se cumulent', () => {
    const { pres, a } = presentationAvecSecrets();
    const coffre = 'SENT-ID-COFFRE';
    p.revelerElement(pres, a.id, coffre);
    verifier(Object.values(p.miniPlanTable(pres).plans)[0].objets.some((o) => o.id === coffre), 'montré : présent dans l’encart');
    p.definirMasque(pres, a.id, 'objets', true);
    egal(p.vueTable(pres).objets, [], 'révélé mais masqué : absent de la table');
    egal(Object.values(p.miniPlanTable(pres).plans)[0].objets, [], 'aucun objet de la salle dans l’encart');
    p.definirMasque(pres, a.id, 'objets', false);
    verifier(p.vueTable(pres).objets.some((o) => o.id === coffre), 'remontré : le révélé revient');
    p.recacherElement(pres, a.id, coffre);
    verifier(!p.vueTable(pres).objets.some((o) => o.id === coffre), 'catégorie montrée, élément caché : toujours absent');
    const pion = pres.donjon.salles[a.id].plan.creatures.find((k) => k.camp === 'monstre');
    egal(p.categorieMasquee(pres, a.id, 'creature', pion), null, 'rien de masqué');
    p.definirMasque(pres, a.id, 'monstres', true);
    egal(p.categorieMasquee(pres, a.id, 'creature', pion), 'monstres', 'pion masqué');
    egal(p.categorieMasquee(pres, a.id, 'creature', { camp: 'pj' }), null, 'un pion de joueur ne l’est jamais');
    egal(p.categorieMasquee(pres, a.id, 'porte', {}), null, 'une porte non plus');
  }],

  ['secrets : après commandes, notes de partie et états, aucune sentinelle ne sort vers la table', () => {
    const { pres, a } = presentationAvecSecrets();
    for (const t of ['ajoute un gobelin caché', 'ajoute deux piliers', 'supprime le pilier 1', 'déplace le gobelin 1 en C1']) {
      const r = p.appliquerCommande(pres, a.id, t);
      verifier(r.ok, `${t} : ${r.message}`);
    }
    p.definirNotePartie(pres, a.id, 'SENT-NOTE-PARTIE-A');
    p.definirEtat(pres, a.id, pres.donjon.salles[a.id].plan.creatures[0].id, 'blesse');
    const sortie = JSON.stringify(p.vueTable(pres));
    for (const s of SENTINELLES) verifier(!sortie.includes(s), `« ${s} » est sorti dans la vue table`);
    verifier(!sortie.includes('"cache"') && sortie.includes('"etat":"blesse"'), 'pas de cache ; l’état, lui, est visible');
    const ajoute = pres.donjon.salles[a.id].plan.creatures.filter((k) => k.cache && k.id !== 'SENT-ID-GOBELIN');
    egal(ajoute.length, 1, 'le gobelin ajouté caché existe côté régie');
    verifier(!sortie.includes(`"id":"${ajoute[0].id}"`), 'mais pas côté table');
    // Les portes secrètes non révélées restent absentes, même après des commandes.
    egal(p.vueTable(pres).portes.map((q) => q.mur), ['est'], 'porte secrète toujours absente');
  }],

  ['table : le mode de taille ne contient aucun secret et ne passe pas par le plan (vueTable inchangée)', () => {
    const { pres } = presentationAvecSecrets();
    const vue = JSON.stringify(p.vueTable(pres));
    verifier(!/modeTable|"mode"|calibre/.test(vue), 'ni mode ni calibrage dans le plan envoyé à la table');
  }],
];

export async function executer({ lire }) {
  const chargés = [...await fermeture('js/vue-publique.js', lire)];
  const TESTS = [
    ['la façade presentation.js réexporte les trois modules, sans perdre ni doubler un nom', () => {
      const modules = { partie, passage, 'vue-publique': vue };
      const vus = new Map();
      for (const [nom, m] of Object.entries(modules)) {
        for (const cle of Object.keys(m)) {
          verifier(!vus.has(cle), `« ${cle} » est exporté par ${vus.get(cle)} et par ${nom}`);
          vus.set(cle, nom);
        }
      }
      for (const cle of vus.keys()) verifier(cle in facade, `la façade ne réexporte pas « ${cle} »`);
      egal(Object.keys(facade).filter((c) => !vus.has(c)), ['ETATS'], 'la façade ne définit rien elle-même (hors ETATS, venu du schéma)');
    }],
    ['vue-publique.js ne charge pas le parseur de phrases : l’impression et la table n’en ont pas besoin', () => {
      const parseur = chargés.filter((c) => ['js/parseur/index.js', 'js/parseur/decrire.js', 'js/parseur/commandes.js'].includes(c));
      egal(parseur, [], 'modules du parseur chargés par vue-publique.js');
      verifier(!chargés.includes('js/partie.js') && !chargés.includes('js/passage.js'), 'vue-publique.js ne dépend ni de partie.js ni de passage.js');
    }],
  ];
  return [...executerSuite('découpage de la présentation : ', TESTS), ...executerSuite('présentation : ', TESTS_PRESENTATION)];
}
