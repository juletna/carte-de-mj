/**
 * Tests des commandes à la volée (js/parseur/commandes.js). Sans dépendance : marche sous Node et dans tests.html.
 * Chaque test lève une Error au premier écart ; executer() renvoie la même forme que les autres.
 */
import { analyser } from '../js/parseur/index.js';
import { interpreterCommande as commande } from '../js/parseur/commandes.js';
import { validerPlan } from '../js/schema.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const TEXTE = 'Salle de 8 par 8 cases, une porte au mur sud en D, une porte au mur est en 3, deux coffres en C4 F2, une statue en B6, deux gobelins en A1 H8, un pilier en E5.';
const plan = () => analyser(TEXTE).plan;
const cases = (liste) => liste.map((e) => `${String.fromCharCode(65 + e.x)}${e.y + 1}`).join(' ');
const chevauche = (a, b) => a.x < b.x + (b.taille || 1) && b.x < a.x + (a.taille || 1) && a.y < b.y + (b.taille || 1) && b.y < a.y + (a.taille || 1);

/** La commande est refusée, ne renvoie aucun plan et dit en français ce qui manque. */
function refusee(texte, p, morceaux, quoi = texte) {
  const avant = JSON.stringify(p);
  const r = commande(texte, p);
  verifier(r.ok === false && !r.plan, `« ${quoi} » aurait dû être refusée : ${r.message}`);
  verifier(typeof r.message === 'string' && r.message.length > 10, `« ${quoi} » : pas de message`);
  for (const m of [].concat(morceaux)) verifier(r.message.includes(m), `« ${quoi} » : le message « ${r.message} » devrait contenir « ${m} »`);
  egal(JSON.stringify(p), avant, `« ${quoi} » : le plan reçu ne doit pas bouger`);
  return r;
}

/** Le plan renvoyé est valide et tout tient : dans la pièce, aucun pion sur un autre, aucun objet bloquant sur un pion. */
function plausible(p) {
  const v = validerPlan(p);
  verifier(v.ok, `plan invalide : ${v.erreurs.join(', ')}`);
  for (const k of p.creatures) verifier(k.x >= 0 && k.y >= 0 && k.x + k.taille <= p.largeur && k.y + k.taille <= p.longueur, `le pion ${k.id} sort de la salle`);
  for (let i = 0; i < p.creatures.length; i++) for (let j = i + 1; j < p.creatures.length; j++) {
    verifier(!chevauche(p.creatures[i], p.creatures[j]), `les pions ${p.creatures[i].id} et ${p.creatures[j].id} se superposent`);
  }
  const ids = [...p.portes, ...p.objets, ...p.creatures].map((e) => e.id);
  verifier(new Set(ids).size === ids.length, `identifiants en double : ${ids.join(' ')}`);
}

const TESTS = [
  ['ajoute trois gobelins : numérotés à la suite, dans la salle, sans chevauchement, plan d’origine intact', () => {
    const p = plan();
    const avant = JSON.stringify(p);
    const r = commande('ajoute trois gobelins', p);
    verifier(r.ok, r.message);
    egal(JSON.stringify(p), avant, 'le plan reçu n’est pas modifié');
    plausible(r.plan);
    egal(r.plan.creatures.length, p.creatures.length + 3, 'trois pions de plus');
    egal(r.plan.creatures.filter((k) => k.type === 'gobelin').map((k) => k.numero), [1, 2, 3, 4, 5], 'numéros à la suite');
    egal(r.ajoutes.length, 3, 'identifiants ajoutés');
    egal(r.plan.creatures.slice(0, p.creatures.length), p.creatures, 'les pions existants sont identiques (id, numéro, position)');
    egal([r.plan.portes, r.plan.entree, r.plan.largeur], [p.portes, p.entree, p.largeur], 'portes et entrée inchangées');
    verifier(r.message.startsWith('Ajouté'), r.message);
  }],

  ['ajoute : « un », « 3 », majuscules, accents et plusieurs éléments', () => {
    const p = plan();
    for (const t of ['Ajoute TROIS Gobelins', 'ajoute 3 gobelins', 'ajouter trois gobelins !', 'mets trois gobelins', 'rajoute trois gobelins.']) {
      const r = commande(t, p);
      verifier(r.ok && r.plan.creatures.length === p.creatures.length + 3, `« ${t} » : ${r.message}`);
    }
    const r = commande('ajoute un tonneau et deux torches', p);
    verifier(r.ok, r.message);
    egal([r.plan.objets.length - p.objets.length, r.plan.objets.filter((o) => o.type === 'torche').length], [3, 2], 'tonneau + torches');
    plausible(r.plan);
  }],

  ['ajoute un coffre en C4 : case exacte ; case occupée ou hors salle : refus clair, rien ne bouge', () => {
    const p = plan();
    const r = commande('ajoute un coffre en D1', p);
    verifier(r.ok, r.message);
    const nouveau = r.plan.objets.find((o) => !p.objets.some((q) => q.id === o.id));
    egal([nouveau.type, nouveau.x, nouveau.y], ['coffre', 3, 0], 'coffre en D1');
    plausible(r.plan);
    refusee('ajoute un coffre en C4', p, ['C4', 'occupée'], 'case déjà prise par un coffre');
    refusee('ajoute un pilier en A1', p, ['A1', 'occupée'], 'case prise par un pion');
    refusee('ajoute un coffre en Z9', p, ['hors de la salle', 'H8'], 'hors salle');
    refusee('ajoute un coffre en A12', p, ['hors de la salle'], 'hors salle (rangée)');
    // Un pion peut monter sur un objet, pas sur un pion.
    verifier(commande('ajoute un gobelin en C4', p).ok, 'un pion peut se poser sur un coffre');
    refusee('ajoute un gobelin en A1', p, ['occupée'], 'pion sur pion');
  }],

  ['ajoute un gobelin caché : cache: true, jamais confondu avec les visibles', () => {
    const p = plan();
    const r = commande('ajoute un gobelin caché', p);
    verifier(r.ok, r.message);
    const nouveau = r.plan.creatures.find((k) => k.id === r.ajoutes[0]);
    egal([nouveau.cache, nouveau.type, nouveau.numero], [true, 'gobelin', 3], 'gobelin caché numéro 3');
    verifier(/caché/.test(r.message) && /invisible à la table/.test(r.message), r.message);
    verifier(!p.creatures.some((k) => k.cache), 'le plan d’origine n’a rien de caché');
    const c = commande('ajoute un coffre secret en D1', p);
    verifier(c.ok && c.plan.objets.find((o) => o.id === c.ajoutes[0]).cache === true, 'coffre secret : caché aussi');
  }],

  ['ajoute : positions du parseur (devant la porte, à gauche, au fond), repère absent refusé', () => {
    const p = plan();
    for (const t of ['ajoute un gobelin devant la porte', 'ajoute deux gobelins à gauche', 'ajoute un dragon au fond', 'ajoute un gobelin devant le coffre', 'ajoute quatre piliers au centre']) {
      const r = commande(t, p);
      verifier(r.ok, `« ${t} » : ${r.message}`);
      plausible(r.plan);
    }
    refusee('ajoute un gobelin devant le trône', p, ['trône'], 'repère absent');
    const sansPorte = { ...p, portes: [] };
    refusee('ajoute un gobelin devant la porte', sansPorte, ['aucune porte'], 'aucune porte');
  }],

  ['ajoute : une salle pleine ne déborde pas ; quand ça ne rentre pas, rien n’est ajouté', () => {
    let p = analyser('Salle de 3 par 3 cases, une porte au mur sud en B.').plan;
    const r = commande('ajoute 30 gobelins', p);
    verifier(r.ok, r.message);
    plausible(r.plan);
    verifier(r.ajoutes.length < 30 && /pas trouvé de place/.test(r.message), `trop de pions ou message absent : ${r.message}`);
    p = r.plan;
    for (let i = 0; i < 20 && commande('ajoute un gobelin', p).ok; i++) p = commande('ajoute un gobelin', p).plan;
    plausible(p);
    refusee('ajoute un gobelin', p, ['place', 'Rien n’a été modifié'], 'salle pleine de pions');
  }],

  ['ajoute : les cases devant les portes restent libres tant qu’il y a de la place', () => {
    const p = plan();
    const r = commande('ajoute quatre piliers', p);
    verifier(r.ok, r.message);
    const devantSud = r.plan.objets.concat(r.plan.creatures).some((e) => e.x === 3 && e.y === 7 && !p.objets.concat(p.creatures).some((q) => q.id === e.id));
    verifier(!devantSud, 'rien de nouveau juste devant la porte sud (D8)');
  }],

  ['ajoute une porte, un mot inconnu, un verbe inconnu : refus qui dit quoi faire', () => {
    const p = plan();
    refusee('ajoute une porte', p, ['portes', 'Donjon'], 'porte');
    refusee('ajoute un ogre truc', p, ['« truc »'], 'mot inconnu');
    refusee('ajoute', p, ['Que faut-il ajouter'], 'verbe seul');
    refusee('ajoute quelque chose', p, ['quelque', 'chose'], 'rien de reconnu');
    refusee('danse sur la table', p, ['commence par ajoute, supprime ou déplace'], 'verbe inconnu');
    refusee('', p, ['Écris une commande'], 'vide');
    refusee('   ', p, ['Écris une commande'], 'espaces');
  }],

  ['supprime le coffre : deux coffres → ambigu, le message dit quoi préciser', () => {
    const p = plan();
    const r = refusee('supprime le coffre', p, ['2 coffres', 'C4', 'F2', 'Précise', 'supprime le coffre 1', 'supprime le coffre en', 'tous les coffres', 'Rien n’a été modifié']);
    verifier(!r.plan, 'aucun plan');
    // Précisé par la case, par le rang (de haut en bas puis de gauche à droite), ou par « tous ».
    const parCase = commande('supprime le coffre en C4', p);
    verifier(parCase.ok && parCase.plan.objets.filter((o) => o.type === 'coffre').length === 1, parCase.message);
    egal(cases(parCase.plan.objets.filter((o) => o.type === 'coffre')), 'F2', 'reste F2');
    const parRang = commande('supprime le coffre 2', p);
    egal(cases(parRang.plan.objets.filter((o) => o.type === 'coffre')), 'F2', 'le coffre 2 = C4 (F2 est plus haut, c’est le 1)');
    const tous = commande('supprime tous les coffres', p);
    verifier(tous.ok && !tous.plan.objets.some((o) => o.type === 'coffre') && tous.supprimes.length === 2, tous.message);
    const pluriel = commande('supprime les coffres', p);
    verifier(pluriel.ok && pluriel.supprimes.length === 2, 'le pluriel vaut « tous »');
    egal(commande('supprime le coffre 2', p).plan.objets.length, p.objets.length - 1, 'un seul objet retiré');
  }],

  ['supprime : un seul candidat n’a pas besoin de précision ; absent ou introuvable → refus clair', () => {
    const p = plan();
    const r = commande('supprime la statue', p);
    verifier(r.ok && !r.plan.objets.some((o) => o.type === 'statue') && /Supprimé : statue \(B6\)/.test(r.message), r.message);
    egal(r.supprimes, [p.objets.find((o) => o.type === 'statue').id], 'id supprimé');
    verifier(commande('enlève le pilier', p).ok && commande('retire la statue', p).ok && commande('efface le pilier', p).ok, 'synonymes');
    refusee('supprime le dragon', p, ['aucun dragon'], 'type absent');
    refusee('supprime le gobelin 5', p, ['pas de gobelin 5', 'gobelin 1', 'gobelin 2'], 'numéro absent');
    refusee('supprime le gobelin caché', p, ['Aucun gobelin caché'], 'aucun caché');
    refusee('supprime le coffre en A8', p, ['Aucun coffre', 'A8'], 'aucun à cette case');
    refusee('supprime la porte', p, ['portes'], 'porte');
    refusee('supprime', p, ['Que faut-il supprimer'], 'sans objet');
    refusee('supprime le truc', p, ['Nomme-le'], 'aucun nom du lexique');
    refusee('supprime 2 gobelins', p, ['Je ne sais pas lequel'], 'quantité sans précision');
  }],

  ['supprime le gobelin 2 : retire le bon pion et lui seul ; caché / visible se distinguent', () => {
    let p = plan();
    p = commande('ajoute un gobelin caché', p).plan; // gobelin 3, caché
    const r = commande('supprime le gobelin 2', p);
    verifier(r.ok, r.message);
    egal(r.plan.creatures.filter((k) => k.type === 'gobelin').map((k) => k.numero), [1, 3], 'le 2 a disparu, pas les autres');
    const cache = commande('supprime le gobelin caché', p);
    verifier(cache.ok && cache.plan.creatures.filter((k) => k.type === 'gobelin').every((k) => !k.cache) && cache.supprimes.length === 1, cache.message);
    const ambigu = refusee('supprime le gobelin', p, ['3 gobelins', 'supprime le gobelin caché'], 'gobelins ambigus');
    verifier(/gobelin 3 caché/.test(ambigu.message), 'le message désigne le caché');
  }],

  ['déplace la statue à gauche : seule la statue bouge ; les autres éléments gardent identifiant et état', () => {
    const p = plan();
    p.creatures[0].etat = 'blesse';
    const statue = p.objets.find((o) => o.type === 'statue');
    const r = commande('déplace la statue à gauche', p);
    verifier(r.ok, r.message);
    plausible(r.plan);
    const apres = r.plan.objets.find((o) => o.id === statue.id);
    verifier(apres.x === 0, `la statue doit être contre le mur gauche (vu de l’entrée sud : ouest), obtenu ${apres.x},${apres.y}`);
    egal(r.deplaces, [statue.id], 'identifiant déplacé');
    egal(r.plan.objets.filter((o) => o.id !== statue.id), p.objets.filter((o) => o.id !== statue.id), 'les autres objets sont identiques');
    egal(r.plan.creatures, p.creatures, 'les pions (état compris) sont identiques');
    verifier(/Déplacé : statue, B6 → /.test(r.message), r.message);
  }],

  ['déplace le gobelin 2 en C4 : un pion monte sur un coffre ; état et numéro conservés ; case prise par un pion refusée', () => {
    const p = plan();
    p.creatures[1].etat = 'mort';
    const r = commande('déplace le gobelin 2 en C4', p);
    verifier(r.ok, r.message);
    const k = r.plan.creatures[1];
    egal([k.id, k.numero, k.etat, k.x, k.y], [p.creatures[1].id, 2, 'mort', 2, 3], 'même pion, état conservé, en C4');
    plausible(r.plan);
    refusee('déplace le gobelin 2 en A1', p, ['A1', 'occupée'], 'case prise par le gobelin 1');
    refusee('déplace le gobelin 2 en Q4', p, ['hors de la salle'], 'hors salle');
    for (const t of ['déplace le gobelin 2 vers C4', 'déplace le gobelin 2 sur C4', 'déplace le gobelin 2 à C4']) {
      verifier(commande(t, p).ok, `« ${t} »`);
    }
  }],

  ['déplace : « de C4 à D5 », relatif à un autre élément, ambiguïtés, destination manquante ou incompréhensible', () => {
    const p = plan();
    const r = commande('déplace le coffre de C4 à D5', p);
    verifier(r.ok, r.message);
    egal(cases(r.plan.objets.filter((o) => o.type === 'coffre')), 'D5 F2', 'le coffre de C4 est en D5');
    verifier(commande('déplace le gobelin 1 devant la statue', p).ok, 'devant la statue');
    verifier(commande('déplace le gobelin 1 devant la porte', p).ok, 'devant la porte');
    const murEst = commande('déplace le gobelin 1 devant la porte est', p);
    verifier(murEst.ok, `devant la porte est : ${murEst.message}`);
    egal(cases(murEst.plan.creatures.filter((k) => k.numero === 1 && k.type === 'gobelin')), 'G3', 'le gobelin 1 est devant la porte est (porte en 3, mur est)');
    verifier(commande('déplace le gobelin 1 devant la porte du mur est', p).ok, 'devant la porte du mur est');
    refusee('déplace le gobelin 1 devant la porte nord', p, ['pas de porte au mur nord'], 'mur sans porte');
    verifier(commande('déplace le gobelin 1 au fond', p).ok, 'au fond');
    refusee('déplace le coffre à gauche', p, ['2 coffres', 'Précise', 'déplace le coffre 1'], 'deux coffres');
    refusee('déplace le coffre', p, ['2 coffres'], 'ambigu avant même la destination');
    refusee('déplace la statue', p, ['Où faut-il déplacer', 'à gauche'], 'sans destination');
    refusee('déplace la statue n’importe où', p, ['« n importe ou »'], 'destination incompréhensible');
    refusee('déplace la statue devant le trône', p, ['trône'], 'repère absent');
    refusee('déplace les gobelins à gauche', p, ['un élément à la fois'], 'pluriel');
    refusee('déplace le dragon à gauche', p, ['aucun dragon'], 'type absent');
    refusee('déplace la statue en B6', p, ['déjà là'], 'déjà à cette case');
  }],

  ['les portes ne bougent jamais (donc aucune liaison ne peut se casser)', () => {
    const p = plan();
    const portes = JSON.stringify(p.portes);
    for (const t of ['ajoute trois gobelins', 'ajoute 5 piliers', 'supprime la statue', 'déplace la statue à gauche', 'déplace le gobelin 2 en C4', 'supprime tous les coffres']) {
      const r = commande(t, p);
      verifier(r.ok, `${t} : ${r.message}`);
      egal(JSON.stringify(r.plan.portes), portes, `« ${t} » : portes inchangées (mur, position, id)`);
      egal(r.plan.entree, p.entree, 'entrée inchangée');
    }
  }],

  ['un pion de grande taille (dragon, 3 × 3) se place et se déplace sans sortir ni se superposer', () => {
    const p = plan();
    const r = commande('ajoute un dragon', p);
    verifier(r.ok, r.message);
    plausible(r.plan);
    const d = r.plan.creatures.find((k) => k.type === 'dragon');
    egal(d.taille, 3, 'taille 3');
    const m = commande('déplace le dragon en F5', r.plan);
    verifier(m.ok, m.message);
    plausible(m.plan);
    const m2 = commande('déplace le dragon en G7', r.plan);
    verifier(m2.ok === false || m2.plan.creatures.find((k) => k.type === 'dragon').x + 3 <= 8, 'ne déborde pas du bord');
  }],
  ['supprimer, déplacer : l’aspect cité (« la torche éteinte », « le coffre ouvert ») choisit le bon objet parmi plusieurs du même type', () => {
    const p = analyser('Salle de 10 par 8 cases, une porte au mur sud, deux torches en B2 H2, une torche éteinte en E1, un coffre ouvert en B6, un coffre fermé en F6, un coffre vide en H6, un brasero bleu en D4.').plan;
    const aspects = (q, type) => q.objets.filter((o) => o.type === type).map((o) => `${o.variante ?? '-'}@${cases([o])}`).sort();
    egal(aspects(p, 'torche'), ['-@B2', '-@H2', 'eteinte@E1'], 'le plan de départ');
    // Sans l'aspect : ambigu, et le message propose de le préciser.
    refusee('supprime la torche', p, ['3 torches', 'éteinte'], 'supprime la torche');
    const e = commande('supprime la torche éteinte', p);
    verifier(e.ok, e.message); plausible(e.plan);
    egal(aspects(e.plan, 'torche'), ['-@B2', '-@H2'], 'seule l’éteinte est supprimée');
    egal(e.supprimes.length, 1, 'un seul supprimé');
    egal(aspects(commande('supprime la torche éteinte', p).plan, 'coffre'), aspects(p, 'coffre'), 'les coffres ne bougent pas');
    // Le défaut se nomme aussi ; avec deux candidats, il faut encore un numéro ou une case.
    refusee('supprime la torche normale', p, ['2 torches'], 'supprime la torche normale');
    const n = commande('supprime la torche normale en H2', p);
    verifier(n.ok, n.message);
    egal(aspects(n.plan, 'torche'), ['-@B2', 'eteinte@E1'], 'la normale de H2');
    const o = commande('supprime le coffre ouvert', p);
    verifier(o.ok, o.message);
    egal(aspects(o.plan, 'coffre'), ['-@F6', 'vide@H6'], 'seul le coffre ouvert part');
    const v = commande('supprime les coffres vides', p);
    verifier(v.ok, v.message);
    egal(v.supprimes.length, 1, 'tous les coffres vides : un');
    const f = commande('supprime le brasero à flamme bleue', p);
    verifier(f.ok, f.message);
    egal(f.plan.objets.some((x) => x.type === 'brasero'), false, '« à flamme bleue » : mots de liaison compris');
    refusee('supprime le coffre brisé', p, ['Aucun coffre brisé'], 'supprime le coffre brisé');
    // Déplacer : « déplace le coffre ouvert en B3 ».
    const d = commande('déplace le coffre ouvert en B3', p);
    verifier(d.ok, d.message); plausible(d.plan);
    egal(d.plan.objets.filter((x) => x.type === 'coffre').map((x) => `${x.variante ?? '-'}@${cases([x])}`).sort(), ['-@F6', 'ouvert@B3', 'vide@H6'].sort(), 'le coffre ouvert est déplacé, il garde son aspect');
    const d2 = commande('déplace la torche éteinte à gauche', p);
    verifier(d2.ok, d2.message);
    egal(d2.plan.objets.find((x) => x.variante === 'eteinte').variante, 'eteinte', 'l’aspect est gardé');
    refusee('supprime la torche éteinte en B2', p, ['Aucune torche éteinte en B2'], 'supprime la torche éteinte en B2');
  }],
];

export const executer = () => executerSuite('commandes : ', TESTS);
