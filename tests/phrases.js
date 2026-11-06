/**
 * Phrases de MJ et plan attendu (attentes partielles, voir mini-test.js).
 * Rappel : échelle 1,5 m par case ; x ouest→est, y nord→sud ;
 * l'entrée est au sud sauf indication contraire, « le fond » au nord.
 */

const tous = (type, test, message) => (plan) =>
  plan.objets.filter((o) => o.type === type).every(test) || message;

export const PHRASES = [
  {
    phrase: 'Grande pièce de 4 m par 12, quatre piliers, deux coffres au fond de la salle, une statue immobile devant une porte',
    attendu: {
      largeur: 3, longueur: 8,
      compter: { pilier: 4, coffre: 2, statue: 1 },
      portes: [{ mur: 'sud', position: 1 }],
      objets: [
        { type: 'pilier', x: 0, y: 2 }, { type: 'pilier', x: 2, y: 2 },
        { type: 'pilier', x: 0, y: 5 }, { type: 'pilier', x: 2, y: 5 },
        { type: 'coffre', x: 0, y: 0 }, { type: 'coffre', x: 2, y: 0 },
        { type: 'statue', x: 1, y: 6, rotation: 0 },
      ],
      ignores: ['immobile'],
    },
  },
  {
    phrase: 'Une salle de 6 cases sur 6',
    attendu: { largeur: 6, longueur: 6, compter: {}, portes: [] },
  },
  {
    phrase: 'pièce de 9 mètres par 6 mètres',
    attendu: { largeur: 6, longueur: 4 },
  },
  {
    phrase: 'salle carrée de 9 m',
    attendu: { largeur: 6, longueur: 6 },
  },
  {
    phrase: 'une salle de 7,5 m de large et 15 m de long',
    attendu: { largeur: 5, longueur: 10 },
  },
  {
    phrase: 'Une petite pièce avec un coffre',
    attendu: { largeur: 4, longueur: 4, compter: { coffre: 1 }, objets: [{ type: 'coffre', y: 0, rotation: 180 }] },
  },
  {
    phrase: 'salle de 8 par 8 cases, dix-sept tonneaux',
    attendu: { compter: { tonneau: 17 } },
  },
  {
    phrase: 'salle de 8 par 8 cases, une paire de statues au centre',
    attendu: { compter: { statue: 2 }, verifier: tous('statue', (o) => o.x >= 2 && o.x <= 5 && o.y >= 2 && o.y <= 5, 'statues loin du centre') },
  },
  {
    phrase: 'salle de 6 par 6 cases, une table au centre',
    attendu: { objets: [{ type: 'table', x: 2, y: 2, l: 2, h: 1 }] },
  },
  {
    phrase: 'salle de 6 par 6 cases, quatre tonneaux dans les coins',
    attendu: {
      objets: [
        { type: 'tonneau', x: 0, y: 0 }, { type: 'tonneau', x: 5, y: 0 },
        { type: 'tonneau', x: 0, y: 5 }, { type: 'tonneau', x: 5, y: 5 },
      ],
    },
  },
  {
    phrase: 'salle de 6 par 6 cases, un escalier dans le coin sud-est',
    attendu: { objets: [{ type: 'escalier', x: 5, y: 4, l: 1, h: 2 }] },
  },
  {
    phrase: 'salle de 6 par 8 cases, une bibliothèque contre le mur ouest',
    attendu: { objets: [{ type: 'bibliotheque', x: 0, l: 1, h: 2, rotation: 90 }] },
  },
  {
    phrase: 'salle de 6 par 6 cases, une porte au nord et une porte à l’est',
    attendu: { portes: [{ mur: 'nord', position: 2 }, { mur: 'est', position: 2 }] },
  },
  {
    phrase: 'salle de 6 par 6 cases, une porte au nord, un trône au fond',
    attendu: {
      portes: [{ mur: 'nord' }],
      verifier: tous('trone', (o) => o.y === 5 && o.rotation === 0, 'le fond devrait être au sud quand l’entrée est au nord'),
    },
  },
  {
    phrase: 'salle de 8 par 10 cases, un trône au fond, deux statues de chaque côté du trône',
    attendu: {
      objets: [{ type: 'trone', x: 3, y: 0 }, { type: 'statue', x: 2, y: 0 }, { type: 'statue', x: 4, y: 0 }],
    },
  },
  {
    phrase: 'salle de 6 par 6 cases, deux gargouilles, une statue à côté du puits',
    attendu: { compter: { statue: 3, puits: 1 }, ignores: [] },
  },
  {
    phrase: 'salle de 6 par 10 cases, six piliers de chaque côté',
    attendu: { compter: { pilier: 6 }, verifier: tous('pilier', (o) => o.x === 1 || o.x === 4, 'piliers pas alignés de chaque côté') },
  },
  {
    phrase: 'salle de 8 par 8 cases, des torches le long des murs',
    attendu: { compter: { torche: 4 }, verifier: tous('torche', (o) => o.x === 0 || o.y === 0 || o.x === 7 || o.y === 7, 'torche loin des murs') },
  },
  {
    phrase: 'couloir avec une fosse au milieu et une herse au fond',
    attendu: { largeur: 2, longueur: 10, compter: { fosse: 1 }, portes: [{ mur: 'nord', type: 'herse' }] },
  },
  {
    phrase: 'Salle du trône, sol en marbre',
    attendu: { nom: 'Salle du trône', sol: 'marbre', compter: {} },
  },
  {
    phrase: 'salle de 6 par 6 cases, un tonneau au fond à gauche',
    attendu: { objets: [{ type: 'tonneau', x: 0, y: 0 }] },
  },
  {
    phrase: 'salle de 8 par 8 cases, une grande fosse au centre',
    attendu: { objets: [{ type: 'fosse', l: 2, h: 2, x: 3, y: 3 }] },
  },
  {
    phrase: 'salle de 6 par 6 cases, huit colonnes en cercle',
    attendu: {
      compter: { colonne: 8 },
      verifier: (plan) => new Set(plan.objets.map((o) => `${o.x},${o.y}`)).size === 8 || 'colonnes superposées',
    },
  },
];

// --- Créatures -----------------------------------------------------------------
PHRASES.push(
  {
    phrase: 'salle de 8 par 10 cases, une porte au sud, les personnages à l’entrée, trois gobelins au fond',
    attendu: {
      verifier: (plan) => {
        const pj = plan.creatures.filter((k) => k.type === 'pj');
        const gob = plan.creatures.filter((k) => k.type === 'gobelin');
        if (pj.length !== 4 || gob.length !== 3) return `attendu 4 PJ et 3 gobelins, obtenu ${pj.length} et ${gob.length}`;
        if (!pj.every((k) => k.y >= 7)) return 'les PJ devraient être près de la porte sud';
        if (!gob.every((k) => k.y === 0 && k.camp === 'monstre')) return 'les gobelins devraient être au fond (y = 0)';
        return gob.map((k) => k.numero).join() === '1,2,3' || 'gobelins mal numérotés';
      },
    },
  },
  {
    phrase: 'salle de 8 par 8 cases, un dragon rouge au centre',
    attendu: {
      verifier: (plan) => {
        const d = plan.creatures[0];
        return (d?.type === 'dragon' && d.taille === 3 && d.couleur === 'rouge' && d.x === 2 && d.y === 2) || `dragon inattendu : ${JSON.stringify(d)}`;
      },
    },
  },
  {
    phrase: 'salle de 8 par 8 cases, un jeune dragon, un rat géant, un nain hostile, deux elfes alliés',
    attendu: {
      ignores: [],
      verifier: (plan) => {
        const par = (t) => plan.creatures.filter((k) => k.type === t);
        if (par('dragon')[0]?.taille !== 2) return 'un jeune dragon devrait faire 2 × 2 cases';
        if (par('rat')[0]?.taille !== 2) return 'un rat géant devrait faire 2 × 2 cases';
        if (par('geant').length) return '« géant » est ici un adjectif, pas une créature';
        if (par('nain')[0]?.camp !== 'monstre') return 'le nain hostile devrait être un monstre';
        return (par('elfe').length === 2 && par('elfe').every((k) => k.camp === 'pnj')) || 'deux elfes alliés attendus';
      },
    },
  },
  {
    phrase: 'salle de 8 par 8 cases, deux loups-garous et deux gardes de chaque côté du roi',
    attendu: {
      verifier: (plan) => {
        const n = (t) => plan.creatures.filter((k) => k.type === t).length;
        return (n('loup-garou') === 2 && n('garde') === 2 && n('roi') === 1) || `obtenu ${JSON.stringify(plan.creatures.map((k) => k.type))}`;
      },
    },
  },
  {
    phrase: 'salle de 6 cases sur 6, un coffre caché au fond, deux gobelins cachés, un gobelin, une porte secrète au mur nord, une porte au mur sud',
    attendu: {
      ignores: [],
      portes: [{ mur: 'nord', cache: true }, { mur: 'sud' }],
      verifier: (plan) => {
        const coffre = plan.objets.filter((o) => o.type === 'coffre');
        if (coffre.length !== 1 || coffre[0].cache !== true) return 'le coffre devrait être caché';
        const g = plan.creatures.filter((k) => k.type === 'gobelin');
        if (g.length !== 3 || g.filter((k) => k.cache).length !== 2) return 'deux gobelins sur trois devraient être cachés';
        return true;
      },
    },
  },
  {
    phrase: 'une pièce de 6 par 6 cases, des tonneaux secrets, deux tables cachées, un coffre',
    attendu: {
      ignores: [],
      verifier: (plan) => {
        const cache = (t) => plan.objets.filter((o) => o.type === t).map((o) => o.cache === true);
        if (!cache('tonneau').length || !cache('tonneau').every(Boolean)) return 'les tonneaux secrets devraient être cachés';
        if (cache('table').length !== 2 || !cache('table').every(Boolean)) return 'les deux tables devraient être cachées';
        return cache('coffre').length === 1 && !cache('coffre')[0] ? true : 'le coffre devrait rester visible, sans champ cache';
      },
    },
  },
);

// --- « devant la porte est » : le mur nommé désigne la porte, « est » verbe reste un verbe ---------
const BASE = 'salle de 6 par 6 cases, une porte au sud, une porte à l’est';
PHRASES.push(
  {
    phrase: `${BASE}, une statue devant la porte est`,
    attendu: { ignores: [], objets: [{ type: 'statue', x: 4, y: 2 }], compris: ['devant porte du mur est'] },
  },
  {
    phrase: `${BASE}, une statue devant la porte du mur est`,
    attendu: { ignores: [], objets: [{ type: 'statue', x: 4, y: 2 }] },
  },
  {
    phrase: `${BASE}, une statue devant la porte de l’est`,
    attendu: { ignores: [], objets: [{ type: 'statue', x: 4, y: 2 }] },
  },
  {
    phrase: `${BASE}, une statue devant la porte sud, un coffre devant la porte est`,
    attendu: { ignores: [], objets: [{ type: 'statue', x: 2, y: 4 }, { type: 'coffre', x: 4, y: 2 }] },
  },
  {
    phrase: `${BASE}, une statue devant la porte`,
    attendu: { objets: [{ type: 'statue', x: 2, y: 4 }], compris: ['devant porte'] },
  },
  {
    // Aucune porte à l'ouest : le repère n'est pas remplacé en silence.
    phrase: `${BASE}, une statue devant la porte ouest`,
    attendu: { objets: [{ type: 'statue', x: 2, y: 4 }], compris: ['pas de porte au mur ouest'] },
  },
  {
    // Sans aucune porte, celle qui est citée est créée sur le mur nommé, sans devenir l'entrée.
    phrase: 'salle de 6 par 6 cases, une statue devant la porte est',
    attendu: { portes: [{ mur: 'est' }], objets: [{ type: 'statue', x: 4, y: 2 }] },
  },
  {
    // « est » est ici un verbe : la porte est au nord, et la statue est devant elle.
    phrase: 'salle de 6 par 6 cases, la porte est au nord, une statue devant la porte',
    attendu: { portes: [{ mur: 'nord' }], objets: [{ type: 'statue', x: 2, y: 1 }], ignores: [] },
  },
  {
    phrase: 'salle de 6 par 6 cases, une statue devant la porte, la porte est au nord',
    attendu: { portes: [{ mur: 'nord' }], objets: [{ type: 'statue', x: 2, y: 1 }] },
  },

  // --- Nom de salle contenant un mot du lexique : jamais de pion fantôme ---
  {
    phrase: 'Salle de garde de 6 par 5 cases, une porte au sud',
    attendu: { nom: 'Salle de garde', largeur: 6, longueur: 5, ignores: [], verifier: (plan) => plan.creatures.length === 0 || `pions : ${plan.creatures.map((k) => k.type)}` },
  },
  {
    phrase: 'Salle des gardes de 6 par 5 cases',
    attendu: { nom: 'Salle des gardes', largeur: 6, longueur: 5, verifier: (plan) => plan.creatures.length === 0 || 'pion créé par le nom' },
  },
  {
    phrase: 'Chambre du garde de 6 par 5 cases',
    attendu: { nom: 'Chambre du garde', verifier: (plan) => plan.creatures.length === 0 || 'pion créé par le nom' },
  },
  {
    phrase: 'Salle de mage de 6 par 6 cases, une table',
    attendu: { nom: 'Salle de mage', compter: { table: 1 }, verifier: (plan) => plan.creatures.length === 0 || 'pion créé par le nom' },
  },
  {
    phrase: 'Crypte de vampire de 6 par 6 cases, un sarcophage',
    attendu: { nom: 'Crypte de vampire', compter: { sarcophage: 1 }, verifier: (plan) => plan.creatures.length === 0 || 'pion créé par le nom' },
  },
  {
    // Le nom ne retire qu'un groupe : les gardes cités ensuite existent bien.
    phrase: 'Salle de garde de 6 par 6 cases, deux gardes au fond',
    attendu: { nom: 'Salle de garde', verifier: (plan) => (plan.creatures.length === 2 && plan.creatures.every((k) => k.type === 'garde')) || `pions : ${plan.creatures.map((k) => k.type)}` },
  },
  {
    phrase: 'Une salle de 6 par 6 cases avec un garde',
    attendu: { verifier: (plan) => (plan.creatures.length === 1 && plan.creatures[0].type === 'garde') || 'un garde attendu' },
  },
  {
    phrase: 'Salle de 6 par 6 cases, deux gardes',
    attendu: { verifier: (plan) => plan.creatures.length === 2 || 'deux gardes attendus' },
  },
  {
    // Un « de » qui n'ouvre pas la phrase n'est pas un nom de salle : le garde cité existe.
    phrase: 'Salle de 6 par 6 cases, une porte, la salle de garde est au nord, un garde',
    attendu: { verifier: (plan) => plan.creatures.some((k) => k.type === 'garde') || 'le garde cité doit exister' },
  },
);

// --- Lot 5 : brasero, bougies, tapis, bannière, feu de camp, flaque, rocher, champignons, toile d'araignée, ossements ---
// Singulier / pluriel / synonymes / accents, puis les mots qui existaient déjà ou qui s'écrivent de la même façon (feu, os, toile, bloc, tapisserie…).
const salle = (contenu) => `salle de 12 par 12 cases, ${contenu}`;
const un = (phrase, compter, plus = {}) => ({ phrase: salle(phrase), attendu: { compter, ...plus } });
PHRASES.push(
  // brasero : « brasero » n'est plus une torche
  un('un brasero', { brasero: 1 }, { ignores: [] }),
  un('deux braseros', { brasero: 2 }),
  un('un brasier et une vasque de feu', { brasero: 2 }, { ignores: [] }),
  un('des vasques de feu', { brasero: 2 }),
  un('une torche, un flambeau', { torche: 2 }),
  // bougies : « chandelier » n'est plus une torche
  un('une bougie', { bougies: 1 }, { ignores: [] }),
  un('trois bougies', { bougies: 3 }),
  un('une chandelle, un chandelier, un cierge', { bougies: 3 }, { ignores: [] }),
  un('des chandelles', { bougies: 5 }),
  // tapis : le singulier et le pluriel s'écrivent pareil ; la taille par défaut est 3 par 2, un grand tapis 4 par 3
  { phrase: salle('un tapis'), attendu: { compter: { tapis: 1 }, ignores: [], objets: [{ type: 'tapis', l: 3, h: 2 }] } },
  { phrase: salle('un grand tapis'), attendu: { compter: { tapis: 1 }, ignores: [], objets: [{ type: 'tapis', l: 4, h: 3 }] } },
  un('deux tapis', { tapis: 2 }),
  un('une carpette', { tapis: 1 }),
  un('des tapis', { tapis: 2 }),
  // bannière
  un('une bannière', { banniere: 1 }, { ignores: [] }),
  un('une banniere et deux étendards', { banniere: 3 }),
  un('une tenture, une tapisserie', { banniere: 2 }, { ignores: [] }),
  un('des bannières', { banniere: 4 }),
  { phrase: salle('une bannière'), attendu: { verifier: (plan) => plan.objets.every((o) => o.x === 0 || o.y === 0 || o.x === plan.largeur - 1 || o.y === plan.longueur - 1) || 'la bannière est contre un mur' } },
  // feu de camp : « feu » seul est un feu de camp, sauf « en feu », « de feu », « feu follet »…
  un('un feu de camp', { feudecamp: 1 }, { ignores: [] }),
  un('un feu', { feudecamp: 1 }, { ignores: [] }),
  un('un foyer et un feu de bois', { feudecamp: 2 }, { ignores: [] }),
  un('deux feux de camp', { feudecamp: 2 }),
  un('des feux', { feudecamp: 2 }),
  un('trois gobelins autour du feu', { feudecamp: 1 }, { ignores: [] }),
  un('une porte en feu', {}, { ignores: ['feu'] }),
  un('une boule de feu', {}, { ignores: ['boule', 'feu'] }),
  un('un feu follet', {}, { ignores: ['feu', 'follet'] }),
  un('une vasque de feu', { brasero: 1 }, { ignores: [] }),
  // flaque
  un('une flaque', { flaque: 1 }, { ignores: [], objets: [{ type: 'flaque', l: 2, h: 1 }] }),
  un('une flaque d\'eau', { flaque: 1 }, { ignores: [] }),
  un('deux mares', { flaque: 2 }),
  // rocher : « éboulis » reste un tas de débris
  un('un rocher', { rocher: 1 }, { ignores: [] }),
  un('deux rochers et un roc', { rocher: 3 }),
  un('un bloc de pierre', { rocher: 1 }, { ignores: [] }),
  un('des éboulis', { debris: 5 }),
  un('des débris', { debris: 5 }),
  // champignons : lumineux est lu, pas signalé ; un adjectif d'éclairage collé à l'objet ne change pas la salle
  un('un champignon', { champignons: 1 }, { ignores: [] }),
  un('des champignons lumineux', { champignons: 2 }, { ignores: [] }),
  { phrase: salle('des champignons lumineux'), attendu: { verifier: (plan) => plan.eclairage === undefined || 'les champignons lumineux n’éclairent pas la salle' } },
  // toile d'araignée : « araignée » seule reste un pion
  un('une toile d\'araignée', { toile: 1 }, { ignores: [], verifier: (plan) => plan.creatures.length === 0 || 'la toile ne crée pas d’araignée' }),
  un('deux toiles d\'araignée', { toile: 2 }),
  un('une toile', { toile: 1 }, { ignores: [] }),
  { phrase: salle('une araignée'), attendu: { compter: {}, verifier: (plan) => (plan.creatures.length === 1 && plan.creatures[0].type === 'araignee') || 'une araignée est un pion' } },
  { phrase: salle('quatre toiles dans les coins'), attendu: { compter: { toile: 4 }, verifier: (plan) => plan.objets.every((o) => (o.x === 0 || o.x === plan.largeur - 1) && (o.y === 0 || o.y === plan.longueur - 1)) || 'toiles dans les coins' } },
  // ossements : « squelette » reste un pion
  un('des ossements', { ossements: 5 }, { ignores: [] }),
  un('un os, un crâne', { ossements: 2 }, { ignores: [] }),
  un('un tas d\'os et un tas d\'ossements', { ossements: 2 }, { ignores: [] }),
  { phrase: salle('un squelette'), attendu: { compter: {}, verifier: (plan) => (plan.creatures.length === 1 && plan.creatures[0].type === 'squelette') || 'un squelette est un pion' } },
  // tout ensemble
  un('un brasero, des bougies, un tapis, une bannière, un feu de camp, une flaque, un rocher, des champignons lumineux, une toile d\'araignée, des ossements',
    { brasero: 1, bougies: 5, tapis: 1, banniere: 1, feudecamp: 1, flaque: 1, rocher: 1, champignons: 2, toile: 1, ossements: 5 }, { ignores: [] }),
);
