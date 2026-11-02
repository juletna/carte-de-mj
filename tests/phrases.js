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
