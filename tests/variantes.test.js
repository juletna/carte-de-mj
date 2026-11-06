/**
 * Tests du mécanisme de variante d'objet (catalogue.js : `variantes`) et des feux : accès purs, validation du schéma, lecture du texte (« une torche à flamme
 * bleue »), description accordée et relisible, teintes de flamme (rendu/feu.js) et leur passage à la source de lumière. Sans dépendance.
 */
import { OBJETS, variantesDe, variantePourMot, varianteDe, varianteParDefaut, nomVariante, aUneVariante } from '../js/catalogue.js';
import { validerPlan } from '../js/schema.js';
import { analyser } from '../js/parseur/index.js';
import { decrire } from '../js/parseur/decrire.js';
import { TEINTES_FLAMME, teinteFlamme } from '../js/rendu/feu.js';
import { listeSources, FLAMME_PAR_DEFAUT } from '../js/rendu/lumiere.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const FEUX = ['torche', 'brasero', 'bougies', 'feudecamp'];
const variantesPlan = (texte) => analyser(texte).plan.objets.map((o) => `${o.type}:${o.variante ?? '-'}`);

const TESTS = [
  ['chaque variante a un id sans accent, un nom et des mots reconnus ; la première est la défaut, et un mot ne désigne qu’une variante par type', () => {
    for (const o of OBJETS.filter((x) => x.variantes)) {
      const mots = new Map();
      egal(o.variantes[0].id, varianteParDefaut(o.type), `${o.type} : la première est la défaut`);
      for (const v of o.variantes) {
        verifier(/^[a-z]+$/.test(v.id) && v.nom && v.mots.length, `${o.type}/${v.id} : champs`);
        for (const m of v.mots) { verifier(/^[a-z]+$/.test(m), `« ${m} » : sans accents`); verifier(!mots.has(m), `« ${m} » est à ${mots.get(m)} et ${v.id}`); mots.set(m, v.id); }
      }
    }
    egal(FEUX.map((t) => variantesDe(t).map((v) => v.id)), FEUX.map(() => ['normale', 'eteinte', 'bleue', 'verte', 'violette', 'argentee', 'infernale']), 'variantes des feux');
    egal(variantesDe('coffre'), [], 'pas de variantes');
  }],
  ['varianteDe : la variante effective, la défaut quand elle est absente ou inconnue ; nomVariante s’accorde au genre et au nombre', () => {
    egal([varianteDe({ type: 'torche' }), varianteDe({ type: 'torche', variante: 'bleue' }), varianteDe({ type: 'torche', variante: 'rose' }), varianteDe({ type: 'coffre', variante: 'bleue' })], ['normale', 'bleue', 'normale', null], 'effective');
    egal([aUneVariante({ type: 'torche', variante: 'eteinte' }), aUneVariante({ type: 'torche' })], [true, false], 'aUneVariante');
    egal([nomVariante('torche', 'eteinte'), nomVariante('brasero', 'eteinte'), nomVariante('torche', 'eteinte', 2), nomVariante('brasero', 'infernale', 2), nomVariante('bougies', 'infernale', 2), nomVariante('brasero', 'bleue', 2)],
      ['éteinte', 'éteint', 'éteintes', 'infernaux', 'infernales', 'bleus'], 'accords');
    egal([variantePourMot('torche', 'eteintes'), variantePourMot('torche', 'magique'), variantePourMot('feudecamp', 'follet'), variantePourMot('torche', 'cheval')], ['eteinte', 'bleue', 'argentee', null], 'mots');
  }],
  ['schéma : la variante est gardée si elle est connue et n’est pas la défaut, sinon retirée (avertie seulement si inconnue)', () => {
    const v = validerPlan({ largeur: 6, longueur: 6, objets: [
      { type: 'torche', x: 0, y: 0, variante: 'eteinte' }, { type: 'torche', x: 1, y: 0, variante: 'normale' }, { type: 'torche', x: 2, y: 0, variante: 'rose' }, { type: 'coffre', x: 3, y: 3, variante: 'bleue' }, { type: 'torche', x: 4, y: 0 }] });
    egal(v.plan.objets.map((o) => o.variante), ['eteinte', undefined, undefined, undefined, undefined], 'gardée ou retirée');
    verifier(!JSON.stringify(v.plan.objets[1]).includes('variante') && !JSON.stringify(v.plan.objets[4]).includes('variante'), 'aucun champ inventé');
    verifier(v.erreurs.some((e) => e.includes('« rose »')) && v.erreurs.some((e) => e.includes('« bleue »')) && !v.erreurs.some((e) => e.includes('normale')), 'avertissements');
  }],
  ['le parseur lit la couleur ou l’état d’un feu : « à flamme bleue », « éteintes », « de feu vert », « magiques », « feu follet »', () => {
    egal(variantesPlan('salle 6 par 6, une torche à flamme bleue'), ['torche:bleue'], 'à flamme bleue');
    egal(variantesPlan('salle 6 par 6, deux torches éteintes'), ['torche:eteinte', 'torche:eteinte'], 'éteintes');
    egal(variantesPlan('salle 6 par 6, un brasero de feu vert'), ['brasero:verte'], 'de feu vert');
    egal(variantesPlan('salle 6 par 6, des bougies magiques').every((s) => s === 'bougies:bleue'), true, 'magiques');
    egal(variantesPlan('salle 6 par 6, un brasero infernal'), ['brasero:infernale'], 'infernal');
    egal(variantesPlan('salle 6 par 6, un feu de camp violet'), ['feudecamp:violette'], 'feu de camp violet');
    egal(variantesPlan('salle 6 par 6, une torche feu follet'), ['torche:argentee'], 'feu follet');
    egal(variantesPlan('salle 6 par 6, une torche allumée'), ['torche:-'], 'allumée = la défaut, rien dans le plan');
    egal(variantesPlan('salle 6 par 6, un coffre bleu'), ['coffre:-'], 'un objet sans variantes les ignore');
    egal(analyser('salle 6 par 6, une torche à flamme bleue, un brasero éteint').ignores, [], 'rien n’est signalé comme incompris');
  }],
  ['la description nomme la variante, accordée, et se relit à l’identique', () => {
    const r = analyser('salle 8 par 8, une torche à flamme bleue, deux torches éteintes, un brasero de feu vert, deux bougies infernales, un feu de camp argenté');
    const texte = decrire(r.plan);
    for (const motif of [/une torche bleue en/, /deux torches éteintes en/, /un brasero vert en/, /deux bougies infernales en/, /un feu de camp argenté en/]) verifier(motif.test(texte), `${motif} : ${texte}`);
    const relu = analyser(texte).plan;
    egal(relu.objets.map((o) => [o.type, o.variante]), r.plan.objets.map((o) => [o.type, o.variante]), 'relecture');
  }],
  ['rendu/feu.js : une teinte par variante déclarée, l’orange d’origine pour la normale, éteint sans lumière', () => {
    for (const t of FEUX) for (const v of variantesDe(t)) verifier(TEINTES_FLAMME[v.id], `pas de teinte pour ${v.id}`);
    egal([teinteFlamme({ type: 'torche' }).flamme, teinteFlamme({ type: 'torche', variante: 'rose' }).c, teinteFlamme({ type: 'coffre' }).eteint], ['#f2862a', null, false], 'défaut');
    egal([teinteFlamme({ type: 'torche', variante: 'eteinte' }).eteint, teinteFlamme({ type: 'torche', variante: 'bleue' }).magique], [true, true], 'états');
    for (const [id, t] of Object.entries(TEINTES_FLAMME)) if (t.c) verifier(/^\d{1,3},\d{1,3},\d{1,3}$/.test(t.c), `${id} : couleur de source`);
  }],
  ['listeSources : la couleur de flamme est validée (orange par défaut) et « magique » passe tel quel', () => {
    const [a, b, c] = listeSources([
      { x: 10, y: 10, r: 50 }, { x: 60, y: 10, r: 50, f: { flamme: '#2f7be8', coeur: '#a8e4ff' }, m: true }, { x: 110, y: 10, r: 50, f: { flamme: 'rouge', coeur: 3 }, m: 'oui' }]);
    egal([a.f, a.m], [FLAMME_PAR_DEFAUT, false], 'défaut');
    egal([b.f, b.m], [{ flamme: '#2f7be8', coeur: '#a8e4ff' }, true], 'bleue magique');
    egal([c.f, c.m], [FLAMME_PAR_DEFAUT, false], 'invalide → défaut');
  }],
];

export const executer = () => executerSuite('variantes : ', TESTS);
