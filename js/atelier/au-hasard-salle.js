/**
 * Le tirage au hasard de la salle : remplit LA salle affichée (monstres, coffres, pièges, mobilier, et sa forme si on le demande ;
 * `genererSalle`, js/generateur.js, pur). Ce n'est pas un réglage de la salle mais un flux en aval : consignes, tirage, on juge, on
 * relance ou on annule. Il a donc sa propre vue dans l'inspecteur, pas une section parmi les autres :
 *   - `ligne(sel)` : une rangée en tête de la salle, deux icônes (le dé génère d'un clic avec les réglages courants ; les curseurs ouvrent la vue) ;
 *   - `vue(sel)`   : la vue dédiée, qui remplace les sections de la salle (retour « ← Salle ») : consignes, Générer, Relancer, résumé.
 *
 *   const hasard = creerSectionAuHasard(ctx);   // `ctx` : celui de main-mj.js (etat, donjon, salle, modifierPlan, annoncerCarte, activerSalle, salles, coquille)
 *   if (hasard.ouverte(sel.id)) conteneur.append(hasard.vue(sel)); else conteneur.append(…, hasard.ligne(sel));
 *
 * Tout est aléatoire par défaut : un champ vide (nombre de monstres, de coffres, de pièges), la famille, la forme, les dimensions et
 * l'apparence tirées ; on ne renseigne un réglage que pour l'imposer (deux états : fixé ou aléatoire). Le champ « Forme » (Aléatoire · Forme actuelle · une forme) donne deux
 * modes (voir `genererSalle`) : « Forme actuelle » remplit seulement (forme, dimensions et TOUTES les portes et escaliers restent) ;
 * « Aléatoire » ou une forme précise changent forme et dimensions comme à la main (les portes et escaliers, reliés ou non, gardent leur mur
 * et leur place : leurs liaisons suivent) ; Aléatoire est le défaut de toute salle. Le texte tiré passe par `ctx.modifierPlan` (le chemin de toute
 * modification du plan : description, carte, sauvegarde, historique, liaisons). Une salle qui avait déjà un contenu, ou dont la forme
 * change, est annulable en un seul pas (« Annuler » rétablit aussi les liaisons).
 * Les réglages et le dernier tirage vivent le temps de la page : rien n'est enregistré.
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';
import { creerSection } from './section.js';
import { creerChampMulti } from './champ-multi.js';
import { FORMES, LIBELLES_FORMES, svgForme } from '../formes.js';
import * as modele from '../donjon.js';
import { pluriel } from '../format.js';
import { NOMS_SOLS, NOMS_AMBIANCES, NOMS_ETATS_SALLE, NOMS_ECLAIRAGES } from '../schema.js';
import { FAMILLES, BORNES_SALLE, famillesPresentes, genererSalle, normaliserOptionsSalle, estNomParDefaut, salleAUnContenu, salleReliee, typesDesAutresSalles } from '../generateur.js';

/** Les réglages d'apparence : champ du plan, libellé, noms des valeurs. Vide (« Aléatoire ») : le tirage choisit ; une valeur est imposée. */
const APPARENCE = [['sol', 'Sol', NOMS_SOLS], ['ambiance', 'Ambiance', NOMS_AMBIANCES], ['etat', 'État', NOMS_ETATS_SALLE], ['eclairage', 'Éclairage', NOMS_ECLAIRAGES]];
const CHAMPS = [['monstres', 'Monstres'], ['coffres', 'Coffres'], ['pieges', 'Pièges']];

export function creerSectionAuHasard(ctx) {
  // Gardés le temps de la page.
  // monstres, coffres, pièges : null = aléatoire ; forme : null = aléatoire (forme et dimensions tirées), 'actuelle', ou l'identifiant d'une forme imposée.
  const reglages = { familles: [], monstres: null, coffres: null, pieges: null, forme: null, apparence: {} };
  /** Le dernier tirage appliqué : sert à « Relancer » et à « Tirage N », tant que la description est encore celle qu'il a écrite. */
  let dernier = null;
  /** La salle dont la vue « Au hasard » est ouverte (null : aucune). Changer de salle la referme d'elle-même (`ouverte(id)`). */
  let vueOuverte = null;
  const redessiner = () => ctx.coquille?.rafraichir({ inspecteur: true });

  const donjon = () => ctx.donjon();

  /** Applique un tirage à la salle `id` (affichée d'abord). `relancer` : remplace le tirage précédent au lieu de s'empiler dessus. */
  function generer(id, relancer = false) {
    if (ctx.salle().id !== id) ctx.activerSalle(id);
    const d = donjon();
    const s = d.salles[id];
    if (!s) return;
    const forme = reglages.forme; // le choix du MJ, tel quel
    const reprise = relancer && dernier && dernier.salle === id && s.texte === dernier.texte;
    let annulable = salleAUnContenu(s);
    if (reprise) {
      // Le tirage précédent est défait (texte et nom) : la salle redevient ce qu'elle était, puis reçoit le nouveau tirage.
      annulable = dernier.annulable;
      if (annulable) document.getElementById('annuler')?.click();
      if (dernier.nomAvant != null) modele.renommerSalle(d, id, dernier.nomAvant);
    }
    const salle = d.salles[id];
    const reliee = salleReliee(d, id);
    const options = {
      plan: salle.plan, reliee, formes: true, forme,
      familles: [...reglages.familles], typesPresents: typesDesAutresSalles(d, id),
      monstres: reglages.monstres, coffres: reglages.coffres, pieges: reglages.pieges, apparence: reglages.apparence,
    };
    const r = genererSalle(options);
    if (!r.ok) { ctx.annoncerCarte(r.refus ?? 'Rien n’a été tiré.', true); dernier = null; ctx.coquille?.rafraichir({ inspecteur: true }); return; }

    const nomAvant = salle.nom;
    const orphelinesAvant = modele.liaisonsOrphelines(d).length;
    const texteAvant = salle.texte;
    const ancresAvant = modele.ancresDeSalle(d, id);
    // Une nouvelle forme change la salle même vide : « Annuler » est offert (une seule entrée, qui rétablit aussi les liaisons).
    annulable = annulable || r.mode === 'nouvelle';
    if (estNomParDefaut(salle.nom) && r.nom) { modele.renommerSalle(d, id, r.nom); ctx.salles.majListe(); }
    // Comme la saisie à la main : le plan à la nouvelle forme, dont les portes déplacées entraînent leurs liaisons (suivrePortes).
    ctx.modifierPlan(r.mode === 'nouvelle' ? r.plan : salle.plan, { texte: r.texte, memoire: annulable, suivrePortes: r.mode === 'nouvelle' });
    // Filet de sécurité : une liaison devenue orpheline ne doit jamais survivre à un tirage.
    if (modele.liaisonsOrphelines(d).length > orphelinesAvant) {
      modele.renommerSalle(d, id, nomAvant);
      modele.restaurerAncres(d, ancresAvant);
      ctx.modifierPlan(d.salles[id].plan, { texte: texteAvant, memoire: false });
      if (annulable) ctx.historique.pile(d.id, id).pop();
      ctx.salles.majListe();
      ctx.annoncerCarte('Le tirage aurait détaché une porte ou un escalier relié : rien n’a été changé.', true);
      dernier = null;
      ctx.coquille?.rafraichir({ inspecteur: true });
      return;
    }
    dernier = { salle: id, texte: r.texte, graine: r.graine, mode: r.mode, forme: r.mode === 'nouvelle' ? LIBELLES_FORMES[r.plan.forme ?? 'rectangle'] : null, refus: r.refus, resume: r.resume, annulable, nomAvant: nomAvant !== d.salles[id].nom ? nomAvant : null };
    const { monstres, coffres, pieges, reduit } = r.resume;
    const repli = forme !== 'actuelle' && r.mode === 'remplir' && r.refus ? ` ${r.refus}` : ''; // la nouvelle forme n'a pas pu garder les portes : on le dit
    const laForme = r.mode === 'nouvelle' ? ` Forme : ${LIBELLES_FORMES[r.plan.forme ?? 'rectangle']}, ${r.plan.largeur} par ${r.plan.longueur} cases.` : '';
    ctx.annoncerCarte(`Tirage ${r.graine} : ${pluriel(monstres, 'monstre', 'monstres')}, ${pluriel(coffres, 'coffre', 'coffres')}, ${pluriel(pieges, 'piège', 'pièges')}${reduit ? ' (la salle est trop petite pour tout)' : ''}.${laForme}${repli}${annulable ? ' « Annuler » rétablit la salle.' : ''}`);
    ctx.coquille?.rafraichir({ inspecteur: true });
  }

  /** Vrai quand le tirage impose quelque chose (un point doré le dit sur l'icône réglages). */
  const reglagesImposes = () => reglages.familles.length > 0 || CHAMPS.some(([cle]) => reglages[cle] !== null) || reglages.forme !== null || Object.keys(reglages.apparence).length > 0;

  /** La rangée de la salle, en tête des sections : le dé génère tout de suite ; l'icône réglages ouvre la vue dédiée. */
  function ligne(sel) {
    const de = h('button', { type: 'button', className: 'btn btn-icone', title: 'Générer au hasard (remplit la salle, annulable)', 'aria-label': 'Générer au hasard' }, icone('de'));
    de.addEventListener('click', () => generer(sel.id));
    const regler = h('button', { type: 'button', className: `btn btn-icone btn-discret hasard-ligne-regler${reglagesImposes() ? ' impose' : ''}`, title: 'Régler le tirage', 'aria-label': reglagesImposes() ? 'Régler le tirage (des consignes sont imposées)' : 'Régler le tirage' }, icone('affichage'));
    regler.addEventListener('click', () => { vueOuverte = sel.id; redessiner(); });
    return h('section', { className: 'hasard-ligne', 'aria-label': 'Au hasard' }, h('span', { className: 'hasard-ligne-titre', textContent: 'Au hasard' }), de, regler);
  }

  /** La vue dédiée : un retour, puis les consignes du tirage. */
  function vue(sel) {
    const d = donjon();
    const s = d.salles[sel.id];
    const reliee = salleReliee(d, sel.id);
    const escalier = (s?.plan?.objets || []).some((o) => o.type === 'escalier');

    // Famille : « comme le donjon » quand les autres salles en ont, sinon le hasard.
    const presentes = famillesPresentes(typesDesAutresSalles(d, sel.id));
    const famille = creerChampMulti({
      titre: 'Type de monstres', icone: 'creature',
      auto: 'Aléatoire', autoDetail: presentes.length ? `comme le donjon (${presentes.map((f) => FAMILLES[f].libelle).join(', ')})` : '',
      options: Object.entries(FAMILLES).map(([cle, f]) => ({ valeur: cle, libelle: f.libelle })),
      valeurs: reglages.familles, surChangement: (valeurs) => { reglages.familles = valeurs; },
    });

    const champs = h('div', { className: 'hasard-salle-champs' }, ...CHAMPS.map(([cle, libelle]) => {
      const [, min, max] = BORNES_SALLE[cle];
      const entree = h('input', { type: 'number', inputMode: 'numeric', min: String(min), max: String(max), step: '1', placeholder: 'Aléatoire', value: reglages[cle] === null ? '' : String(reglages[cle]), 'aria-label': `${libelle} (de ${min} à ${max}, vide : aléatoire)` });
      // Vide = aléatoire ; un nombre est imposé (0 compris) ; vider le champ, le picto ↺ ou ↓ sur le minimum le remet en aléatoire.
      const auto = h('button', { type: 'button', className: 'hasard-salle-auto', title: `${libelle} : revenir en aléatoire`, 'aria-label': `${libelle} : revenir en aléatoire` }, (() => { try { return icone('reinitialiser'); } catch { return '↺'; } })()); // un fichier d'icônes plus ancien en cache ne casse pas le champ
      const majAuto = () => { auto.hidden = entree.value === ''; };
      const enAuto = () => { reglages[cle] = null; entree.value = ''; majAuto(); };
      entree.addEventListener('input', majAuto);
      entree.addEventListener('change', () => { reglages[cle] = normaliserOptionsSalle({ [cle]: entree.value })[cle]; entree.value = reglages[cle] === null ? '' : String(reglages[cle]); majAuto(); });
      entree.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' && entree.value !== '' && Number(entree.value) <= min) { e.preventDefault(); enAuto(); } });
      auto.addEventListener('click', () => { enAuto(); entree.focus(); });
      majAuto();
      return h('div', { className: 'hasard-salle-champ', title: `Vide : aléatoire. Sinon de ${min} à ${max}` }, h('span', { className: 'hasard-salle-entete' }, h('span', { className: 'hasard-salle-etiquette', textContent: libelle }), auto), h('span', { className: 'champ-num' }, entree));
    }));

    const apparence = h('div', { className: 'hasard-salle-apparence' }, ...APPARENCE.map(([cle, libelle, noms]) => {
      const menu = h('select', { 'aria-label': `${libelle} (Aléatoire : le tirage choisit)` },
        h('option', { value: '', textContent: 'Aléatoire' }), ...Object.entries(noms).map(([v, nom]) => h('option', { value: v, textContent: nom })));
      menu.value = reglages.apparence[cle] ?? '';
      menu.addEventListener('change', () => { if (menu.value) reglages.apparence[cle] = menu.value; else delete reglages.apparence[cle]; });
      return h('label', { className: 'ligne' }, libelle, menu);
    }));

    // Forme : aléatoire (forme et dimensions tirées), la forme actuelle (on remplit seulement), ou une forme imposée. Un choix à la fois, avec sa miniature.
    // Les miniatures sont des caractères ou nos propres SVG (svgForme) : aucune icône récente à charger, la liste s'ouvre avec un icones.js plus ancien en cache.
    /** Un picto d'une icône maison ; un fichier d'icônes plus ancien en cache ne casse pas la grille (repli : un caractère). */
    const picto = (nom, repli) => { try { return icone(nom); } catch { return h('span', { textContent: repli }); } };
    const pictoForme = (svg) => { const e = h('span', { className: 'hasard-forme-svg' }); e.innerHTML = svg; return e; }; // svgForme : uniquement nos propres rectangles
    const textesForme = () => {
      const f = reglages.forme;
      if (f === 'actuelle') return 'La forme, les dimensions et les portes restent : seul le contenu change.';
      if (f) return `Nouvelle forme imposée : ${LIBELLES_FORMES[f]} ; les dimensions sont tirées.${reliee ? ' Les portes reliées suivent la nouvelle forme.' : ''}${escalier ? ' Les escaliers gardent leur place.' : ''}`;
      return `La forme et les dimensions sont tirées aussi ; les portes gardent leur mur.${reliee ? ' Les portes reliées suivent la nouvelle forme.' : ''}${escalier ? ' Les escaliers gardent leur place.' : ''}`;
    };
    const aide = h('p', { className: 'note', textContent: textesForme() });
    // La forme : la même grille de pictos que la section « Forme et dimensions », avec « Aléatoire » et « Forme actuelle » en tête (un seul choix).
    const choixForme = [
      { valeur: null, libelle: 'Aléatoire', pic: () => picto('de', '?') },
      { valeur: 'actuelle', libelle: 'Forme actuelle', pic: () => picto('salle', '▭') },
      ...FORMES.map((f) => ({ valeur: f, libelle: LIBELLES_FORMES[f], pic: () => pictoForme(svgForme(f)) })),
    ];
    const grilleForme = h('div', { className: 'hasard-formes', role: 'radiogroup', 'aria-label': 'Forme' });
    const boutonsForme = choixForme.map((c) => {
      const b = h('button', { type: 'button', className: 'btn', role: 'radio', title: c.libelle, 'aria-label': c.libelle }, c.pic(), h('span', { textContent: c.libelle }));
      b.addEventListener('click', () => { reglages.forme = c.valeur; majGrille(); aide.textContent = textesForme(); });
      return [c, b];
    });
    function majGrille() { for (const [c, b] of boutonsForme) b.setAttribute('aria-checked', String(c.valeur === reglages.forme)); }
    grilleForme.append(...boutonsForme.map(([, b]) => b));
    majGrille();
    const noteAuto = h('p', { className: 'note', textContent: 'Vide = aléatoire : le tirage choisit.' });

    const generee = dernier && dernier.salle === sel.id && s?.texte === dernier.texte ? dernier : null;
    const corps = [
      h('div', { className: 'hasard-salle-champ' }, h('span', { className: 'hasard-salle-etiquette', textContent: 'Type de monstres' }), famille.element),
      champs, noteAuto, apparence,
      h('div', { className: 'hasard-salle-champ' }, h('span', { className: 'hasard-salle-etiquette', textContent: 'Forme' }), grilleForme), aide,
    ];
    const bouton = h('button', { type: 'button', className: 'btn btn-primaire' }, icone('de'), generee ? 'Générer un autre tirage' : 'Générer');
    bouton.addEventListener('click', () => generer(sel.id));
    const actions = [bouton];
    if (generee) {
      const relancer = h('button', { type: 'button', className: 'btn', title: 'Remplace ce tirage par un autre, avec les mêmes consignes' }, 'Relancer');
      relancer.addEventListener('click', () => generer(sel.id, true));
      actions.push(relancer);
    }
    corps.push(h('div', { className: 'actions' }, ...actions));
    if (generee) corps.push(h('p', { className: 'note', role: 'status', textContent: `Tirage ${generee.graine}${generee.mode === 'nouvelle' ? ` · nouvelle forme : ${generee.forme}` : ''}${generee.resume.reduit ? ' · la salle est trop petite pour tout' : ''}${generee.refus ? ` · ${generee.refus}` : ''}` }));

    const retour = h('button', { type: 'button', className: 'hasard-vue-retour', 'aria-label': 'Retour à la salle' }, picto('retour', '←'), h('span', { textContent: 'Salle' }));
    retour.addEventListener('click', () => { vueOuverte = null; redessiner(); });
    return h('div', { className: 'hasard-vue' },
      h('div', { className: 'hasard-vue-tete' }, retour, h('h3', { className: 'hasard-vue-titre', textContent: 'Au hasard' })),
      h('div', { className: 'hasard-vue-corps' }, ...corps));
  }

  return { ligne, vue, ouverte: (id) => vueOuverte === id, fermer: () => { vueOuverte = null; } };
}
