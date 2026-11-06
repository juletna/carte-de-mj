/** La bibliothèque de cartes : vocabulaire, validation du catalogue, filtres et recherche (js/bibliotheque/). */
import { NIVEAUX, SOUS_TYPES, MILIEUX, ANCIENS_NIVEAUX, normaliserNiveau, migrerEntree, libelleZoom, IDS_NIVEAUX } from '../js/bibliotheque/vocabulaire.js';
import { validerCatalogue, validerCarte, fichierValide, filtrer, chercher, selectionner, creditAffiche } from '../js/bibliotheque/catalogue.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const carte = (o = {}) => ({ id: 'foret-01', titre: 'Clairière aux ruines', fichier: 'cartes/foret-01.webp', niveau: 'zone', milieux: ['foret', 'ruines'], tags: ['chemin', 'sanctuaire'], description: 'Un chemin et des colonnes brisées.', ...o });
const catalogue = (cartes) => ({ format: 'carte-de-mj-bibliotheque', version: 1, cartes });
const CARTES = validerCatalogue(catalogue([
  carte(),
  carte({ id: 'port-01', titre: 'Le Port-aux-Brumes', fichier: 'cartes/port.png', niveau: 'localite', milieux: ['ville', 'cote'], tags: ['quai'], description: 'Un port animé.' }),
  carte({ id: 'monde-01', titre: 'Les Marches', fichier: 'cartes/monde.svg', niveau: 'monde', milieux: ['montagne', 'foret'], tags: [], description: '' }),
])).cartes;

const TESTS = [
  ['le vocabulaire : les 3 niveaux, les 3 sous-types de plateau et les 11 milieux du contrat, chacun avec un libellé', () => {
    egal(NIVEAUX.map((n) => n.id), ['monde', 'lieu', 'plateau'], 'niveaux');
    egal(SOUS_TYPES.map((t) => t.id), ['exterieur', 'interieur', 'souterrain'], 'sous-types');
    egal(MILIEUX.map((m) => m.id), ['foret', 'plaine', 'montagne', 'desert', 'eau', 'cote', 'marais', 'neige', 'ville', 'ruines', 'souterrain'], 'milieux');
    verifier([...NIVEAUX, ...MILIEUX].every((x) => x.libelle), 'libellé absent');
  }],
  ['un catalogue valide est repris tel quel, un champ inconnu est ignoré', () => {
    const r = validerCatalogue(catalogue([carte({ secret: 'x', grille: { case: 70, dx: 0, dy: 0 }, origine: { type: 'generee', outil: 'gpt-image-1', style: 'peint-v1', le: '2026-11-06', autre: 1 } })]));
    egal(r.avertissements, [], 'avertissements');
    egal(r.cartes.length, 1, 'cartes');
    verifier(!('secret' in r.cartes[0]), 'champ inconnu gardé');
    egal(r.cartes[0].grille, { case: 70, dx: 0, dy: 0 }, 'grille');
    egal(r.cartes[0].origine, { type: 'generee', outil: 'gpt-image-1', style: 'peint-v1', le: '2026-11-06' }, 'origine');
  }],
  ['migration : les 6 anciens niveaux se convertissent à la lecture, sans rien perdre', () => {
    const attendu = {
      monde: { niveau: 'monde' }, region: { niveau: 'lieu' }, localite: { niveau: 'lieu' },
      zone: { niveau: 'plateau', sousType: 'exterieur' }, batiment: { niveau: 'plateau', sousType: 'interieur' }, souterrain: { niveau: 'plateau', sousType: 'souterrain' },
    };
    for (const [ancien, voulu] of Object.entries(attendu)) {
      egal(normaliserNiveau({ niveau: ancien }), voulu, `normaliserNiveau ${ancien}`);
      const r = validerCarte({ titre: 'x', niveau: ancien, milieux: [] }, { avecFichier: false });
      egal([r.carte?.niveau, r.carte?.sousType], [voulu.niveau, voulu.sousType], `validerCarte ${ancien}`);
      const e = migrerEntree({ id: 'a', niveau: ancien, titre: 'x', blob: 1 });
      egal([e.niveau, e.sousType, e.id, e.titre, e.blob], [voulu.niveau, voulu.sousType, 'a', 'x', 1], `migrerEntree ${ancien}`);
    }
    egal(Object.keys(ANCIENS_NIVEAUX).sort(), ['batiment', 'localite', 'region', 'souterrain', 'zone'], 'anciens niveaux');
    egal(normaliserNiveau({ niveau: 'plateau' }), { niveau: 'plateau', sousType: 'exterieur' }, 'plateau sans sous-type : extérieur');
    egal(normaliserNiveau({ niveau: 'plateau', sousType: 'souterrain' }), { niveau: 'plateau', sousType: 'souterrain' }, 'sous-type gardé');
    egal(normaliserNiveau({ niveau: 'lieu', sousType: 'interieur' }), { niveau: 'lieu' }, 'un lieu n’a pas de sous-type');
    egal(normaliserNiveau({ niveau: 'galaxie' }), null, 'inconnu');
    egal(normaliserNiveau({ niveau: 'constructor' }), null, 'pas de clé héritée');
    egal(migrerEntree({ niveau: 'galaxie' }), { niveau: 'galaxie' }, 'niveau inconnu : entrée telle quelle');
    egal([libelleZoom({ niveau: 'zone' }), libelleZoom({ niveau: 'region' }), libelleZoom({ niveau: 'monde' })], ['Plateau · Extérieur', 'Lieu', 'Monde'], 'libellés');
    egal(IDS_NIVEAUX, ['monde', 'lieu', 'plateau'], 'ids');
  }],
  ['une entrée invalide est écartée en le disant, les autres restent', () => {
    const r = validerCatalogue(catalogue([carte({ id: 'Mauvais Id' }), carte({ niveau: 'galaxie' }), carte({ milieux: ['lave'] }), carte({ titre: ' ' }), 42, carte({ id: 'ok' })]));
    egal(r.cartes.map((c) => c.id), ['ok'], 'cartes gardées');
    egal(r.avertissements.length, 5, 'avertissements');
    verifier(r.avertissements[1].includes('galaxie'), 'le niveau fautif est cité');
  }],
  ['un identifiant en double est écarté', () => {
    const r = validerCatalogue(catalogue([carte(), carte({ titre: 'Autre' })]));
    egal(r.cartes.length, 1, 'cartes');
    verifier(r.avertissements[0].includes('double'), 'double signalé');
  }],
  ['un fichier qui sort du dossier ou d\u2019une extension inconnue est refusé', () => {
    for (const f of ['../secret.png', 'cartes/../../x.png', '/etc/passwd.png', 'http://x.org/a.png', 'C:\\a.png', 'cartes\\a.png', 'a.gif', 'a', 'cartes//a.png', 'a.png?x=1', 'data:image/png;base64,AA.png', '%2e%2e/a.png', '']) {
      verifier(!fichierValide(f), `« ${f} » devrait être refusé`);
      verifier(validerCatalogue(catalogue([carte({ fichier: f })])).cartes.length === 0, `« ${f} » accepté par le catalogue`);
    }
    for (const f of ['a.webp', 'cartes/a.PNG', 'x/y/a.jpg', 'a.jpeg', 'a.svg']) verifier(fichierValide(f), `« ${f} » devrait passer`);
  }],
  ['un catalogue inutilisable donne une liste vide et un avertissement, sans lever d\u2019erreur', () => {
    for (const brut of [null, [], 'x', { format: 'autre', cartes: [] }, { format: 'carte-de-mj-bibliotheque' }]) {
      const r = validerCatalogue(brut);
      egal(r.cartes, [], 'cartes');
      verifier(r.avertissements.length === 1, 'un avertissement attendu');
    }
  }],
  ['les métadonnées d\u2019une image importée se valident sans fichier ni identifiant', () => {
    const r = validerCarte({ titre: 'Ma taverne', niveau: 'batiment', milieux: ['ville'], tags: ['bar'] }, { avecFichier: false });
    verifier(r.carte && r.carte.titre === 'Ma taverne' && !('id' in r.carte), 'carte attendue');
    verifier(validerCarte({ titre: 'x', niveau: 'nul' }, { avecFichier: false }).erreur, 'niveau inconnu refusé');
  }],
  ['filtre par niveau, et par milieux cumulables', () => {
    egal(filtrer(CARTES, { niveau: 'plateau' }).map((c) => c.id), ['foret-01'], 'niveau (zone converti en plateau)');
    egal(filtrer(CARTES, { niveau: 'plateau', sousType: 'interieur' }), [], 'sous-type');
    egal(filtrer(CARTES, { niveau: 'lieu' }).map((c) => c.id), ['port-01'], 'localité convertie en lieu');
    egal(filtrer(CARTES, { milieux: ['foret'] }).map((c) => c.id), ['foret-01', 'monde-01'], 'un milieu');
    egal(filtrer(CARTES, { milieux: ['foret', 'ruines'] }).map((c) => c.id), ['foret-01'], 'deux milieux : tous requis');
    egal(filtrer(CARTES, {}).length, 3, 'sans filtre');
    egal(filtrer(CARTES, { niveau: 'monde', milieux: ['ville'] }), [], 'niveau + milieu sans résultat');
  }],
  ['la recherche ignore accents et casse, sur titre, tags, description et noms des milieux', () => {
    egal(chercher(CARTES, 'CLAIRIERE').map((c) => c.id), ['foret-01'], 'titre sans accent');
    egal(chercher(CARTES, 'sanctuaire').map((c) => c.id), ['foret-01'], 'tag');
    egal(chercher(CARTES, 'anime').map((c) => c.id), ['port-01'], 'description (animé)');
    egal(chercher(CARTES, 'forêt').map((c) => c.id), ['foret-01', 'monde-01'], 'nom du milieu (forêt)');
    egal(chercher(CARTES, 'cote').map((c) => c.id), ['port-01'], 'milieu côte');
    egal(chercher(CARTES, 'foret ruines').map((c) => c.id), ['foret-01'], 'plusieurs mots : tous requis');
    egal(chercher(CARTES, '  ').length, 3, 'texte vide : tout');
    egal(chercher(CARTES, 'dragon'), [], 'rien');
  }],
  ['sélection = filtres puis recherche ; le crédit n\u2019apparaît que s\u2019il existe', () => {
    egal(selectionner(CARTES, { milieux: ['foret'], requete: 'marches' }).map((c) => c.id), ['monde-01'], 'sélection');
    egal(creditAffiche(carte()), '', 'sans crédit');
    egal(creditAffiche({ credit: 'Ana', licence: 'CC-BY 4.0' }), 'Ana — CC-BY 4.0', 'avec crédit');
  }],
];

export function executer() { return executerSuite('Bibliothèque : ', TESTS); }
