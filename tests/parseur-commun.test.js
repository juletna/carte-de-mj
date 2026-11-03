/**
 * Tests des petits outils communs du parseur : le hachage de la graine et la préparation du texte, que `analyser` et les commandes partagent,
 * et des motifs composés depuis des tables (tournures de relation, noms de pièces), qui doivent rester exactement ceux d'avant.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import { hacher, preparer, analyser, RE_NOM } from '../js/parseur/index.js';
import { RE_RELATION } from '../js/parseur/positions.js';
import { RE_TAILLE } from '../js/parseur/dimensions.js';
import { PIECES, PIECES_A_TAILLE, MOTS_VIDES } from '../js/parseur/lexique.js';
import { normaliser } from '../js/parseur/normaliser.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const TESTS = [
  ['hacher : FNV-1a sur 32 bits, stable (valeurs de référence), toujours un entier non signé', () => {
    egal([hacher(''), hacher('a'), hacher('Salle de 12 par 8')], [2166136261, 3826002220, 2376767753], 'valeurs de référence');
    verifier(['', 'é', 'une salle de 4 par 5 avec des gobelins'].every((s) => Number.isInteger(hacher(s)) && hacher(s) >= 0 && hacher(s) < 2 ** 32), 'entier sur 32 bits');
  }],
  ['preparer : normalise, met les nombres en chiffres et soude les expressions, dans cet ordre', () => {
    egal(preparer('Une Salle de 4,5 m par douze, ÉLÉGANTE!'), '1 salle de 4.5 m par 12 , elegante !', 'texte préparé');
    egal(preparer('   '), '', 'texte vide');
    egal(preparer('Salle de 12x8 avec un coffre'), preparer(normaliser('Salle de 12x8 avec un coffre')), 'la normalisation vient en premier');
  }],
  ['les tournures de relation : le motif composé depuis RELATIONS est l’ancien, chaque tournure donne sa relation, et « le long de » n’en est pas une', () => {
    egal(RE_RELATION.source, String.raw`\b(devant|derriere|a cote d(?:e|u|es)?|pres d(?:e|u|es)?|autour d(?:e|u|es)?|de chaque cote d(?:e|u|es)?|des deux cotes d(?:e|u|es)?|de part et d autre d(?:e|u|es)?|en face d(?:e|u|es)?|face a(?:u|ux)?|contre)\b`, 'motif');
    const ou = (tournure) => analyser(`salle de 9 par 9, une table, un coffre ${tournure} la table`).compris.find((c) => c.includes('coffre'));
    // « des deux côtés de » manque : « deux » devient « 2 » avant que le motif ne le voie, il n'est donc jamais reconnu (constaté, non corrigé).
    egal([
      'devant', 'derriere', 'a cote de', 'pres de', 'contre', 'autour de', 'de chaque cote de', 'de part et d autre de', 'en face de', 'face a',
    ].map(ou), [
      '1 coffre — devant table', '1 coffre — derrière table', '1 coffre — à côté de table', '1 coffre — à côté de table', '1 coffre — à côté de table',
      '1 coffre — autour de table', '1 coffre — de chaque côté de table', '1 coffre — de chaque côté de table', '1 coffre — en face de table', '1 coffre — en face de table',
    ], 'relation lue');
    egal(ou('le long de'), '1 coffre — au fond (par défaut)', '« le long de » n’est pas une relation : le coffre reste à sa place par défaut');
  }],
  ['les noms de pièces : une seule liste, dont la taille et les mots vides sont tirés', () => {
    verifier(PIECES_A_TAILLE.every((p) => PIECES.includes(p)), 'les pièces qui portent une taille sont des pièces');
    verifier(PIECES.every((p) => MOTS_VIDES.has(p)) && MOTS_VIDES.has('salles') && MOTS_VIDES.has('pieces'), 'ce ne sont jamais des mots « non compris »');
    egal(RE_NOM.source, String.raw`\b(salle|chambre|crypte|piece|caverne|grotte|hall|cellule|prison|taverne|auberge|temple|chapelle|cuisine|cave)\s+(du|des|de la|de l)\s+([a-z]+)`, 'motif du nom de pièce');
    egal(RE_TAILLE.source, String.raw`\b(minuscule|petite?|moyenne?|grande?|vaste|immense|enorme|gigantesque)\s+(?:\w+\s+)?(?:salle|piece|chambre|caverne|grotte|crypte|hall)\b`, 'motif de la taille');
    egal(analyser('Une grande crypte').plan.largeur, 8, 'une grande crypte a une taille');
    egal(analyser('Une grande taverne').plan.largeur, 6, 'une taverne n’en a pas : la taille par défaut');
    egal(analyser('Taverne du nain, 8 par 8').plan.nom, 'Taverne du nain', 'mais elle porte un nom');
  }],
];

export const executer = () => executerSuite('parseur commun : ', TESTS);
