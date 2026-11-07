/**
 * Tests du modèle d'univers (js/univers.js) et de sa relecture (js/univers-validation.js).
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import * as u from '../js/univers.js';
import { validerUnivers, lireUnivers } from '../js/univers-validation.js';
import { svgFondNeutre, urlFondNeutre, lignesDuNom, FOND_LARGEUR, FOND_HAUTEUR } from '../js/univers-fond.js';
import { creerDonjon } from '../js/donjon.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const IMG = (id = 'monde-01') => ({ source: 'bibliotheque', id });
/** Un univers de trois lieux : monde → région → zone, et un point vers un donjon. */
function exemple() {
  const univ = u.creerUnivers({ nom: 'Les Marches du Nord' });
  const monde = u.ajouterLieu(univ, { nom: 'Le continent', image: IMG() });
  const foret = u.ajouterLieu(univ, { nom: 'Forêt de Brume', image: IMG('foret-01') });
  const zone = u.ajouterLieu(univ, { nom: 'Clairière', image: { source: 'navigateur', id: 'img-k3j9x2' } });
  u.ajouterPoint(univ, monde.id, { nom: 'Forêt', x: 0.42, y: 0.31, vers: { lieu: foret.id } });
  u.ajouterPoint(univ, foret.id, { nom: 'Clairière', x: 0.5, y: 0.5, vers: { lieu: zone.id } });
  return { univ, monde, foret, zone };
}

const TESTS = [
  ['fond neutre d’un lieu sans image : paysage 16:9, nom échappé et coupé', () => {
    egal(FOND_LARGEUR / FOND_HAUTEUR, 16 / 9, 'format 16:9');
    const svg = svgFondNeutre('<script>alert(1)</script> & "Île"');
    verifier(!svg.includes('<script>') && svg.includes('&lt;script&gt;') && svg.includes('&amp;'), 'le nom vient d’un fichier : échappé');
    egal(lignesDuNom('Le Repaire des gobelins de la forêt de Brume'), ['Le Repaire des', 'gobelins de la forêt de Brume'].map((l) => l.slice(0, 30)), 'deux lignes au plus');
    egal(lignesDuNom('   '), [], 'nom vide : pas de texte');
    verifier(urlFondNeutre('Île').startsWith('data:image/svg+xml'), 'URL de données');
    verifier(svgFondNeutre('').includes('width="1600" height="900"'), 'dimensions naturelles');
  }],
  ['lieu sans image : créé tout de suite, points conservés quand l’image arrive, grille ignorée', () => {
    const univ = u.creerUnivers({ nom: 'Archipel' });
    const sans = u.ajouterLieu(univ, { nom: 'Île du Phare', grille: { case: 50, dx: 0, dy: 0 } });
    verifier(!('image' in sans) && !('grille' in sans) && u.lieuSansImage(sans), 'ni image ni grille');
    egal([univ.racine, sans.type], [sans.id, 'carte'], 'il peut être la carte du monde');
    const autre = u.ajouterLieu(univ, { nom: 'Port', image: null });
    verifier(u.lieuSansImage(autre), 'image null : sans image');
    const p = u.ajouterPoint(univ, sans.id, { nom: 'Phare', x: 0.25, y: 0.75, vers: { lieu: autre.id } });
    let erreur = '';
    try { u.ajouterLieu(univ, { nom: 'x', image: { source: 'http', id: 'a' } }); } catch (e) { erreur = e.message; }
    egal(erreur, 'image invalide', 'une image donnée mais mal formée reste refusée');
    try { u.definirImageLieu(univ, sans.id, undefined); } catch (e) { erreur = e.message; }
    egal(erreur, 'image invalide', 'pour retirer l’image il faut passer null');
    u.definirImageLieu(univ, sans.id, IMG('ile-01'));
    egal(sans.image, IMG('ile-01'), 'image posée après coup');
    egal([p.x, p.y], [0.25, 0.75], 'les points gardent leur place relative');
    u.definirGrilleLieu(univ, sans.id, { case: 64, dx: 0, dy: 0 });
    u.definirImageLieu(univ, sans.id, null);
    verifier(u.lieuSansImage(sans) && !('grille' in sans), 'image retirée : la grille calée sur elle s’en va');
  }],
  ['lieu sans image : export puis relecture, lieu valide gardé avec ses points', () => {
    const univ = u.creerUnivers({ nom: 'Archipel' });
    const sans = u.ajouterLieu(univ, { nom: 'Île' });
    const avec = u.ajouterLieu(univ, { nom: 'Port', image: IMG() });
    u.ajouterPoint(univ, sans.id, { nom: 'Quai', x: 0.1, y: 0.9, vers: { lieu: avec.id } });
    const texte = u.texteUnivers(univ);
    verifier(!texte.includes('"image":null') && !texte.includes('"image": null'), 'pas d’image nulle dans le fichier');
    const v = lireUnivers(texte);
    verifier(!v.avertissements.length, `relu sans avertissement : ${JSON.stringify(v.avertissements)}`);
    egal(v.univers, univ, 'même univers');
    const brut = JSON.parse(texte);
    brut.lieux[sans.id].image = null; brut.lieux[sans.id].grille = { case: 40, dx: 0, dy: 0 };
    const v2 = validerUnivers(brut);
    verifier(v2.univers && u.lieuSansImage(v2.univers.lieux[sans.id]) && !('grille' in v2.univers.lieux[sans.id]), 'image null acceptée, grille ignorée');
    egal(v2.univers.lieux[sans.id].points.length, 1, 'points gardés');
  }],
  ['un univers neuf est vide ; le premier lieu devient la racine', () => {
    const univ = u.creerUnivers({ nom: '  Mon monde ' });
    egal([univ.format, univ.version, univ.nom, univ.racine, Object.keys(univ.lieux)], ['carte-de-mj-univers', 1, 'Mon monde', null, []], 'neuf');
    const l = u.ajouterLieu(univ, { nom: 'A', image: IMG() });
    egal(univ.racine, l.id, 'racine');
    const l2 = u.ajouterLieu(univ, { nom: '', image: IMG('b') });
    egal([univ.racine, l2.nom, l2.type, l2.points], [l.id, 'Lieu 2', 'carte', []], 'le second ne prend pas la racine');
    egal(u.creerUnivers({ nom: '' }).nom, 'Univers', 'nom par défaut');
  }],
  ['les bornes : image invalide, 200 lieux, 100 points, noms de 80 caractères', () => {
    const univ = u.creerUnivers();
    let erreur = '';
    try { u.ajouterLieu(univ, { nom: 'x', image: { source: 'http', id: 'a' } }); } catch (e) { erreur = e.message; }
    egal(erreur, 'image invalide', 'source inconnue');
    for (let i = 0; i < u.MAX_LIEUX; i++) u.ajouterLieu(univ, { nom: `L${i}`, image: IMG() });
    erreur = '';
    try { u.ajouterLieu(univ, { nom: 'trop', image: IMG() }); } catch (e) { erreur = e.message; }
    verifier(erreur.includes('200'), 'le 201e lieu est refusé');
    const l = Object.values(univ.lieux)[0];
    for (let i = 0; i < u.MAX_POINTS; i++) u.ajouterPoint(univ, l.id, { x: 0.1, y: 0.1 });
    erreur = '';
    try { u.ajouterPoint(univ, l.id, { x: 0.1, y: 0.1 }); } catch (e) { erreur = e.message; }
    verifier(erreur.includes('100'), 'le 101e point est refusé');
    egal(u.renommerLieu(univ, l.id, 'n'.repeat(200)).nom.length, 80, 'nom coupé');
  }],
  ['un point : fractions bornées, destination vérifiée, déplacement, cache, suppression', () => {
    const { univ, monde, foret } = exemple();
    const p = u.ajouterPoint(univ, monde.id, { nom: 'Bord', x: 1.7, y: -3 });
    egal([p.x, p.y, 'vers' in p, 'cache' in p], [1, 0, false, false], 'bornées, sans destination');
    egal(u.ajouterPoint(univ, monde.id, { x: 'abc', y: null }).x, 0.5, 'valeur non numérique : le milieu');
    let erreur = '';
    try { u.ajouterPoint(univ, monde.id, { vers: { lieu: foret.id, donjon: 'd' } }); } catch (e) { erreur = e.message; }
    egal(erreur, 'destination invalide', 'lieu et donjon à la fois');
    u.deplacerPoint(univ, monde.id, p.id, 0.25, 0.75);
    u.modifierPoint(univ, monde.id, p.id, { cache: true, vers: { donjon: 'donjon-1', salle: 's-1' }, nom: 'Crypte' });
    egal(univ.lieux[monde.id].points.find((q) => q.id === p.id), { id: p.id, nom: 'Crypte', x: 0.25, y: 0.75, vers: { donjon: 'donjon-1', salle: 's-1' }, cache: true }, 'modifié');
    u.modifierPoint(univ, monde.id, p.id, { cache: false, vers: null });
    egal(Object.keys(univ.lieux[monde.id].points.find((q) => q.id === p.id)).sort(), ['id', 'nom', 'x', 'y'], 'cache et destination effacés');
    u.supprimerPoint(univ, monde.id, p.id);
    verifier(!univ.lieux[monde.id].points.some((q) => q.id === p.id), 'supprimé');
  }],
  ['« Annuler » une suppression : le point revient à son rang, avec son identifiant s’il est libre', () => {
    const { univ, monde, foret } = exemple();
    const b = u.ajouterPoint(univ, monde.id, { nom: 'B', x: 0.2, y: 0.2 });
    u.ajouterPoint(univ, monde.id, { nom: 'C', x: 0.3, y: 0.3 });
    const ids = () => univ.lieux[monde.id].points.map((q) => q.nom);
    const retire = u.supprimerPoint(univ, monde.id, b.id);
    egal(u.retablirPoint(univ, monde.id, retire, 1).id, b.id, 'même identifiant');
    egal(ids(), ['Forêt', 'B', 'C'], 'à son rang');
    const copie = u.retablirPoint(univ, monde.id, { ...retire }, 99);
    verifier(copie.id !== b.id, 'identifiant déjà pris : un neuf');
    egal(ids().at(-1), 'B', 'rang trop grand : à la fin');
    u.retablirPoint(univ, foret.id, retire);
    egal(univ.lieux[foret.id].points.at(-1).nom, 'B', 'sans rang : à la fin');
  }],
  ['supprimer un lieu laisse ses entrées orphelines (signalées, pas retirées) ; la racine passe à un autre', () => {
    const { univ, monde, foret, zone } = exemple();
    egal(u.orphelins(univ), [], 'rien d’orphelin au départ');
    const retire = u.supprimerLieu(univ, foret.id);
    egal(u.orphelins(univ).map((o) => [o.lieu, o.raison]), [[monde.id, 'le lieu n’existe plus']], 'le point du monde est orphelin');
    egal(univ.lieux[monde.id].points.length, 1, 'le point est toujours là');
    u.retablirLieu(univ, retire);
    egal(u.orphelins(univ), [], 'rétabli : plus d’orphelin');
    u.supprimerLieu(univ, monde.id);
    verifier(univ.racine && univ.racine in univ.lieux, 'une nouvelle racine existe');
    for (const id of Object.keys(univ.lieux)) u.supprimerLieu(univ, id);
    egal(univ.racine, null, 'plus de lieu, plus de racine');
    verifier(zone.id, 'zone');
  }],
  ['annuler la suppression du lieu de départ lui rend son statut de départ ; un autre lieu ne le prend pas', () => {
    const { univ, monde, foret } = exemple();
    egal(univ.racine, monde.id, 'le monde est le lieu de départ');
    const retire = u.supprimerLieu(univ, monde.id);
    verifier(univ.racine !== monde.id, 'la racine est passée à un autre lieu');
    u.retablirLieu(univ, retire, { racine: true });
    egal(univ.racine, monde.id, 'rétabli : de nouveau le lieu de départ');
    const f = u.supprimerLieu(univ, foret.id);
    u.retablirLieu(univ, f, { racine: false });
    egal(univ.racine, monde.id, 'un lieu qui n’était pas le départ ne le devient pas');
  }],
  ['le départ de la partie est distinct de la carte du monde ; sans `depart`, c’est la racine', () => {
    const { univ, monde, foret, zone } = exemple();
    egal([u.carteDuMonde(univ), u.lieuDeDepart(univ)], [monde.id, monde.id], 'vieux monde sans depart : la racine');
    u.definirDepart(univ, foret.id);
    egal([univ.racine, univ.depart, u.lieuDeDepart(univ), u.carteDuMonde(univ)], [monde.id, foret.id, foret.id, monde.id], 'départ ailleurs, la carte du monde ne bouge pas');
    u.definirDepart(univ, monde.id);
    verifier(!('depart' in univ), 'choisir la carte du monde retire le réglage');
    univ.depart = 'l-disparu';
    egal(u.lieuDeDepart(univ), monde.id, 'un départ qui désigne un lieu disparu vaut la racine');
    let erreur = '';
    try { u.definirDepart(univ, 'l-inconnu'); } catch (e) { erreur = e.message; }
    egal(erreur, 'lieu inconnu', 'départ inconnu refusé');
    egal(u.lieuDeDepart(u.creerUnivers()), null, 'monde sans lieu : pas de départ');
    verifier(zone.id, 'zone');
  }],
  ['supprimer le lieu de départ le retire ; l’annuler le rétablit (racine ou autre lieu)', () => {
    const { univ, monde, foret } = exemple();
    u.definirDepart(univ, foret.id);
    const f = u.supprimerLieu(univ, foret.id);
    verifier(!('depart' in univ), 'le départ est retiré avec son lieu');
    egal(u.lieuDeDepart(univ), monde.id, 'la partie recommence sur la carte du monde');
    u.retablirLieu(univ, f, { depart: true });
    egal([univ.racine, univ.depart], [monde.id, foret.id], 'rétabli comme départ, sans toucher la racine');
    const g = u.supprimerLieu(univ, foret.id);
    u.retablirLieu(univ, g, { depart: false });
    verifier(!('depart' in univ), 'sans l’indication, il ne redevient pas le départ');
    // La racine qui était aussi le départ (cas des vieux mondes).
    const m = u.supprimerLieu(univ, monde.id);
    verifier(univ.racine !== monde.id && u.lieuDeDepart(univ) === univ.racine, 'la racine suivante porte aussi le départ');
    u.retablirLieu(univ, m, { racine: true, depart: true });
    egal([univ.racine, u.lieuDeDepart(univ)], [monde.id, monde.id], 'rétablis tous deux');
    verifier(!('depart' in univ), 'départ = carte du monde : rien d’écrit');
    // La racine retirée alors que le départ est ailleurs : le départ ne bouge pas.
    const { univ: v, monde: m2, foret: f2 } = exemple();
    u.definirDepart(v, f2.id);
    const retiree = u.supprimerLieu(v, m2.id);
    egal(u.lieuDeDepart(v), f2.id, 'le départ reste');
    u.retablirLieu(v, retiree, { racine: true, depart: false });
    egal([v.racine, v.depart], [m2.id, f2.id], 'rétablie comme carte du monde, départ intact');
  }],
  ['renommer le monde renomme sa carte tant qu’elle porte son nom', () => {
    const univ = u.creerUnivers({ nom: 'Archipel' });
    u.renommerUnivers(univ, 'Sans carte');
    egal(univ.nom, 'Sans carte', 'monde sans lieu');
    const carte = u.ajouterLieu(univ, { nom: univ.nom, image: IMG() });
    u.renommerUnivers(univ, 'Archipel des Clochers');
    egal([univ.nom, carte.nom], ['Archipel des Clochers', 'Archipel des Clochers'], 'la carte suit');
    u.renommerLieu(univ, carte.id, 'Carte générale');
    u.renommerUnivers(univ, 'Clochers d’or');
    egal([univ.nom, carte.nom], ['Clochers d’or', 'Carte générale'], 'un nom donné à part est respecté');
    u.renommerUnivers(univ, '   ');
    egal([univ.nom, carte.nom], ['Clochers d’or', 'Carte générale'], 'nom vide : rien ne change');
  }],
  ['les destinations vers un donjon sont vérifiées dans les donjons du navigateur', () => {
    const { univ, monde } = exemple();
    const d = creerDonjon({ nom: 'Crypte' });
    const salle = Object.keys(d.salles)[0];
    u.ajouterPoint(univ, monde.id, { nom: 'Entrée', vers: { donjon: d.id, salle } });
    u.ajouterPoint(univ, monde.id, { nom: 'Mauvaise salle', vers: { donjon: d.id, salle: 's-absente' } });
    u.ajouterPoint(univ, monde.id, { nom: 'Disparu', vers: { donjon: 'donjon-zzz' } });
    const dons = { [d.id]: d };
    egal(u.orphelins(univ, dons).map((o) => o.raison), ['la salle n’existe plus', 'le donjon n’existe plus'], 'deux orphelins');
    egal(u.nomDestination(univ, { donjon: d.id, salle }, dons), `${d.nom} › ${d.salles[salle].nom}`, 'nom avec salle');
    egal(u.nomDestination(univ, undefined), 'sans destination', 'sans destination');
    egal(u.pointsVersDonjon(univ, d.id).length, 2, 'points vers le donjon');
  }],
  ['pointsVers et lieuxInaccessibles', () => {
    const { univ, monde, foret, zone } = exemple();
    egal(u.pointsVers(univ, foret.id).map((x) => x.lieu), [monde.id], 'qui mène à la forêt');
    egal(u.lieuxInaccessibles(univ), [], 'tout est accessible');
    const seul = u.ajouterLieu(univ, { nom: 'Seul', image: IMG('s') });
    egal(u.lieuxInaccessibles(univ), [seul.id], 'un lieu relié à rien');
    u.supprimerPoint(univ, monde.id, univ.lieux[monde.id].points[0].id);
    egal(u.lieuxInaccessibles(univ).sort(), [foret.id, zone.id, seul.id].sort(), 'couper le pont isole la suite');
  }],
  ['export puis relecture : même univers, sans image dans le fichier', () => {
    const { univ, monde } = exemple();
    u.modifierPoint(univ, monde.id, univ.lieux[monde.id].points[0].id, { cache: true });
    const texte = u.texteUnivers(univ);
    verifier(!texte.includes('data:') && !texte.includes('blob:'), 'aucune image dans le fichier');
    const { univers, avertissements } = lireUnivers(texte);
    egal(avertissements, [], 'sans avertissement');
    egal(JSON.parse(JSON.stringify(univers)), JSON.parse(texte), 'identique');
    let erreur = '';
    try { lireUnivers('pas du json'); } catch (e) { erreur = e.message; }
    verifier(erreur.includes('pas un univers'), 'texte illisible');
  }],
  ['validation : refus du fichier qui n’est pas un univers, de la version future, d’un fichier vide de lieux', () => {
    const { univ } = exemple();
    const brut = () => JSON.parse(JSON.stringify(univ));
    for (const [mauvais, morceau] of [
      [null, 'objet JSON'], [[], 'objet JSON'], [{ ...brut(), format: 'autre' }, 'pas un univers'], [{ ...brut(), version: 2 }, 'plus récente'],
      [{ ...brut(), version: 0 }, 'version invalide'], [{ ...brut(), id: '../x' }, 'identifiant'], [{ ...brut(), lieux: [] }, 'pas de lieux'],
      [{ ...brut(), lieux: { a: { id: 'a', image: { source: 'x', id: 'y' } } } }, 'aucun lieu exploitable'],
    ]) {
      const v = validerUnivers(mauvais);
      verifier(!v.univers && v.erreurs.join().includes(morceau), `« ${morceau} » : ${JSON.stringify(v.erreurs)}`);
    }
  }],
  ['validation : un lieu ou un point abîmé est écarté en le disant, le reste est gardé', () => {
    const { univ, monde, foret } = exemple();
    const b = JSON.parse(JSON.stringify(univ));
    b.lieux.mauvais = { id: 'mauvais', nom: 'Image abîmée', image: { source: 'http', id: 'x' }, points: [] };
    b.lieux[monde.id].points.push({ id: 'p-a', nom: 'sans position' }, 'pas un objet', { id: 'p-b', x: 0.1, y: 0.2, vers: { n: 'importe quoi' } }, { id: 'p-c', nom: 'Hors', x: 1.5, y: 0.5, vers: { lieu: 'l-disparu' } });
    b.lieux[foret.id].notes = 'n'.repeat(20001);
    b.racine = 'inconnue';
    const v = validerUnivers(b);
    verifier(v.univers && !v.ok, 'relu mais avec des avertissements');
    egal(Object.keys(v.univers.lieux).length, 3, 'le lieu à l’image abîmée est écarté');
    const pts = v.univers.lieux[monde.id].points;
    egal(pts.map((p) => p.id), [univ.lieux[monde.id].points[0].id, 'p-b', 'p-c'], 'points gardés');
    verifier(!('vers' in pts[1]), 'destination invalide effacée');
    egal([pts[2].x, pts[2].vers], [1, { lieu: 'l-disparu' }], 'destination orpheline conservée, position ramenée');
    egal(v.univers.lieux[foret.id].notes.length, 20000, 'notes coupées');
    egal(v.univers.racine, monde.id, 'racine remplacée par le premier lieu');
    const texte = v.avertissements.join(' | ');
    for (const m of ['Image abîmée', 'sans position', 'pas un objet', 'destination du point', 'ramené', 'notes coupées', 'carte du monde']) verifier(texte.includes(m), `avertissement « ${m} » absent : ${texte}`);
    egal(u.orphelins(v.univers).map((o) => o.point), ['p-c'], 'l’orphelin reste signalé');
  }],
  ['validation : `depart` facultatif, relu s’il désigne un lieu, ignoré en le disant sinon', () => {
    const { univ, monde, foret } = exemple();
    const copie = (m) => JSON.parse(JSON.stringify({ ...univ, ...m }));
    const sans = validerUnivers(copie({}));
    verifier(sans.ok && !('depart' in sans.univers), 'un vieux fichier sans depart se relit comme avant');
    const bon = validerUnivers(copie({ depart: foret.id }));
    verifier(bon.ok, 'départ valide, aucun avertissement');
    egal([bon.univers.racine, bon.univers.depart], [monde.id, foret.id], 'départ gardé');
    verifier(!('depart' in validerUnivers(copie({ depart: monde.id })).univers), 'départ = carte du monde : rien de gardé');
    for (const mauvais of ['l-disparu', 42, {}]) {
      const v = validerUnivers(copie({ depart: mauvais }));
      verifier(!v.ok && !('depart' in v.univers) && v.avertissements.join().includes('lieu de départ'), `départ ${JSON.stringify(mauvais)} ignoré avec avertissement`);
      egal(u.lieuDeDepart(v.univers), monde.id, 'la partie commence sur la carte du monde');
    }
    verifier(validerUnivers(copie({ depart: null })).ok, 'null : comme absent');
    egal(lireUnivers(JSON.stringify(copie({ depart: foret.id }))).univers.depart, foret.id, 'lireUnivers');
  }],
  ['validation : identifiants de point en double, trop de lieux, ni HTML ni prototype interprétés', () => {
    const { univ, monde } = exemple();
    const b = JSON.parse(JSON.stringify(univ));
    const p0 = b.lieux[monde.id].points[0];
    b.lieux[monde.id].points.push({ ...p0 });
    const v = validerUnivers(b);
    const ids = v.univers.lieux[monde.id].points.map((p) => p.id);
    egal(new Set(ids).size, 2, 'le doublon a un nouvel identifiant');
    const trop = { ...b, lieux: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`l${i}`, { id: `l${i}`, image: IMG(), points: [] }])) };
    verifier(validerUnivers(trop).erreurs.join().includes('trop de lieux'), '201 lieux');
    const piege = JSON.parse('{"format":"carte-de-mj-univers","version":1,"id":"u1","nom":"<img src=x onerror=1>","lieux":{"__proto__":{"id":"__proto__","image":{"source":"bibliotheque","id":"a"}},"l1":{"id":"l1","image":{"source":"bibliotheque","id":"a"},"grille":{"case":-3}}}}');
    const w = validerUnivers(piege);
    verifier(w.univers, 'relu');
    verifier(Object.getPrototypeOf(w.univers.lieux) === null, 'dictionnaire sans prototype');
    egal(w.univers.nom, '<img src=x onerror=1>', 'le nom reste du texte (affiché en textContent)');
    verifier(!('grille' in w.univers.lieux.l1) && w.avertissements.join().includes('grille'), 'grille invalide écartée');
  }],
  ['le champ grille facultatif d’un lieu est relu', () => {
    const { univ, monde } = exemple();
    const b = JSON.parse(JSON.stringify(univ));
    b.lieux[monde.id].grille = { case: 70, dx: 5, dy: 0 };
    egal(validerUnivers(b).univers.lieux[monde.id].grille, { case: 70, dx: 5, dy: 0 }, 'grille gardée');
  }],
  ['point de départ de la carte : un seul par lieu, atterrissage par le lien d’origine d’abord', () => {
    const { univ, monde, foret } = exemple();
    const [versForet] = monde.points;
    const a = u.ajouterPoint(univ, monde.id, { nom: 'Port', x: 0.9, y: 0.8 });
    const b = u.ajouterPoint(univ, monde.id, { nom: 'Gué', x: 0.1, y: 0.2 });
    egal(u.pointAtterrissage(monde), null, 'aucun départ : null (la table reste centrée)');
    u.modifierPoint(univ, monde.id, a.id, { depart: true });
    u.modifierPoint(univ, monde.id, b.id, { depart: true });
    verifier(!a.depart && b.depart === true, 'cocher un autre point décoche le précédent');
    egal(u.pointDepartCarte(monde).id, b.id, 'le point de départ est le dernier coché');
    egal(u.pointAtterrissage(monde), { x: 0.1, y: 0.2 }, 'sans origine : le point de départ');
    egal(u.pointAtterrissage(monde, { lieu: 'inconnu' }), { x: 0.1, y: 0.2 }, 'origine sans lien : le point de départ');
    egal(u.pointAtterrissage(monde, { lieu: foret.id }), { x: versForet.x, y: versForet.y }, 'au retour de la forêt : le point qui y mène, pas le départ');
    u.modifierPoint(univ, monde.id, b.id, { depart: false });
    verifier(!('depart' in b), 'décocher retire le champ');
    egal(u.pointAtterrissage(monde, { lieu: foret.id }), { x: versForet.x, y: versForet.y }, 'le lien d’origine marche sans point de départ');
    const don = u.ajouterPoint(univ, monde.id, { nom: 'Donjon', x: 0.7, y: 0.7, vers: { donjon: 'd1' } });
    egal(u.pointAtterrissage(monde, { donjon: 'd1' }), { x: don.x, y: don.y }, 'au retour d’un donjon : le point qui y mène');
    egal(u.pointAtterrissage(null), null, 'pas de lieu : null');
  }],
  ['relecture : depart conservé, un seul par lieu (le surplus est retiré en le disant)', () => {
    const { univ, monde } = exemple();
    const a = u.ajouterPoint(univ, monde.id, { nom: 'A', x: 0.1, y: 0.1 });
    const b = u.ajouterPoint(univ, monde.id, { nom: 'B', x: 0.2, y: 0.2 });
    a.depart = true; b.depart = true; // un fichier à la main, avec deux départs
    const v = validerUnivers(JSON.parse(JSON.stringify(univ)));
    verifier(v.univers.lieux[monde.id].points.filter((q) => q.depart).length === 1, 'un seul départ gardé');
    verifier(v.avertissements.some((t) => t.includes('un seul point de départ')), 'dit à l’utilisateur');
    verifier(v.univers.lieux[monde.id].points.find((q) => q.id === a.id).depart === true, 'le premier est gardé');
  }],
];

export const executer = () => executerSuite('univers : ', TESTS);
