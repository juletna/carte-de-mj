/**
 * Le catalogue (js/catalogue.js) : des données cohérentes, et les mêmes réponses qu'avant son extraction
 * (les listes d'objets féminins, symétriques, au large et de couche ont migré depuis decrire, placement, moteur, deplacement et rapport).
 * Que chaque type du catalogue ait son dessin dans les deux thèmes est vérifié dans themes.test.js.
 */
import { OBJETS, CREATURES, OUVERTURES, nomDe, estFeminin, estSymetrique, estAuLarge, coucheDe, lettreDe, COUCHE_PAR_DEFAUT } from '../js/catalogue.js';
import { PORTES, nomAffiche, trouverObjet, definition } from '../js/parseur/lexique.js';
import { decrire } from '../js/parseur/decrire.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const TOUS = [...OBJETS, ...CREATURES, ...OUVERTURES];
const types = (liste, test) => TOUS.map((d) => d.type).filter((t) => liste.includes(t) === test);

const TESTS = [
  ['chaque type est unique, et chaque mot ne désigne qu’un type : sinon l’un masquerait l’autre', () => {
    const vus = new Set();
    for (const d of TOUS) { verifier(!vus.has(d.type), `type en double : ${d.type}`); vus.add(d.type); }
    const mots = new Map();
    for (const d of TOUS) for (const mot of d.mots) {
      verifier(!mots.has(mot), `« ${mot} » désigne ${mots.get(mot)} et ${d.type}`);
      mots.set(mot, d.type);
      verifier(/^[a-z]+( [a-z]+)*$/.test(mot), `« ${mot} » : sans accents ni majuscules, au singulier`);
    }
  }],
  ['un objet a une taille, une zone par défaut et sa propre lettre sur la carte du rapport', () => {
    const lettres = new Set();
    for (const o of OBJETS) {
      verifier(Number.isInteger(o.l) && o.l >= 1 && Number.isInteger(o.h) && o.h >= 1, `${o.type} : taille`);
      verifier(['grille', 'centre', 'fond', 'coins', 'cotes', 'perimetre', 'aleatoire'].includes(o.zone), `${o.type} : zone « ${o.zone} »`);
      verifier(typeof o.lettre === 'string' && o.lettre.length === 1 && !lettres.has(o.lettre), `${o.type} : lettre « ${o.lettre} » absente ou déjà prise`);
      lettres.add(o.lettre);
    }
  }],
  ['une créature a un camp, une taille et une abréviation', () => {
    for (const k of CREATURES) {
      verifier(['pj', 'pnj', 'monstre'].includes(k.camp), `${k.type} : camp`);
      verifier([1, 2, 3, 4].includes(k.taille), `${k.type} : taille`);
      verifier(typeof k.abr === 'string' && k.abr.length >= 2 && k.abr.length <= 3, `${k.type} : abréviation`);
    }
  }],
  ['les accords : féminins, symétriques, objets écartés du mur et couches sont ceux d’avant', () => {
    const FEMININS = ['colonne', 'statue', 'table', 'chaise', 'caisse', 'fosse', 'bibliotheque', 'torche', 'fontaine',
      'porte', 'herse', 'arche', 'goule', 'liche', 'araignee', 'harpie', 'manticore', 'wyverne', 'hydre'];
    egal(types(FEMININS, true).filter(estFeminin), types(FEMININS, true), 'féminins');
    egal(types(FEMININS, false).filter(estFeminin), [], 'aucun autre féminin');
    const SYMETRIQUES = ['pilier', 'colonne', 'tonneau', 'caisse', 'fosse', 'debris', 'puits', 'fontaine'];
    egal(TOUS.map((d) => d.type).filter(estSymetrique), TOUS.map((d) => d.type).filter((t) => SYMETRIQUES.includes(t)), 'symétriques');
    egal(TOUS.map((d) => d.type).filter(estAuLarge), ['pilier', 'colonne', 'statue'], 'au large');
    egal(TOUS.map((d) => [d.type, coucheDe(d.type)]).filter(([, c]) => c !== COUCHE_PAR_DEFAUT).sort((a, b) => a[1] - b[1]), [['fosse', 0], ['debris', 1], ['torche', 9]], 'couches');
    egal(coucheDe('inconnu'), COUCHE_PAR_DEFAUT, 'un type inconnu est à la couche par défaut');
  }],
  ['les noms affichés : accents du catalogue, pluriels, et un type inconnu reste tel quel', () => {
    egal([nomDe('trone'), nomDe('bibliotheque'), nomDe('debris'), nomDe('pj'), nomDe('araignee'), nomDe('elementaire'), nomDe('geant'), nomDe('coffre')],
      ['trône', 'bibliothèque', 'débris', 'personnage', 'araignée', 'élémentaire', 'géant', 'coffre'], 'noms');
    egal([nomAffiche('coffre', 3), nomAffiche('tonneau', 2), nomAffiche('debris', 4), nomAffiche('trone', 2), nomAffiche('puits', 2)],
      ['coffres', 'tonneaux', 'débris', 'trônes', 'puits'], 'pluriels');
    egal([nomAffiche('fut'), nomAffiche('inconnu'), nomAffiche('constructor')], ['fût', 'inconnu', 'constructor'], 'un mot accentué du lexique, des mots qui ne sont pas des types');
  }],
  ['la lettre du rapport, et les mots du lexique retrouvent leur type avec ses données', () => {
    egal([lettreDe('coffre'), lettreDe('torche'), lettreDe('gobelin')], ['K', '*', undefined], 'lettres');
    egal(trouverObjet('malle').def.type, 'coffre', 'un mot d’objet');
    egal(trouverObjet('portails').pluriel, true, 'un pluriel');
    egal(definition('colonne').feminin, true, 'la définition porte les champs du catalogue');
    egal(Object.keys(PORTES).length, OUVERTURES.flatMap((d) => d.mots).length, 'une entrée par mot de porte');
    egal(PORTES.arcade, 'arche', 'mot de porte → type');
  }],
  ['la description accorde au genre du catalogue et omet l’orientation d’un objet symétrique', () => {
    const plan = { largeur: 6, longueur: 6, sol: 'pierre', portes: [{ mur: 'sud', position: 2, type: 'porte' }],
      objets: [{ id: 'o1', type: 'table', x: 1, y: 1, l: 2, h: 1, rotation: 90, cache: true }, { id: 'o2', type: 'pilier', x: 4, y: 4, l: 1, h: 1, rotation: 90 }],
      creatures: [{ id: 'c1', type: 'goule', camp: 'monstre', x: 3, y: 3, taille: 1, numero: 1, cache: true }] };
    const texte = decrire(plan);
    verifier(/une table cachée en B2 tournée vers l’est/.test(texte), `table : ${texte}`);
    verifier(/un pilier en E5(?!.*tourné)/.test(texte), `pilier symétrique : ${texte}`);
    verifier(/une goule cachée en D4/.test(texte), `goule : ${texte}`);
  }],
];

export const executer = () => executerSuite('catalogue : ', TESTS);
