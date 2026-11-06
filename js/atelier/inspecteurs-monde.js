/**
 * Les inspecteurs du Monde dans l'atelier (lot C) : les types `monde`, `lieu` et `point` de la colonne de droite (panneau bas sous 760 px).
 * Ils reprennent ce que faisaient le panneau « Ce lieu », la bulle d'un point et la barre du monde, sur le contrat de js/atelier/inspecteur.js :
 *   - monde : nom, résumé, ajouter un lieu ; actions Jouer ce monde et Exporter ; ⋯ Supprimer ce monde ;
 *   - lieu  : nom, notes, lieu de départ, grille (l'outil Grille de la barre ouvre le calage, dont les réglages remplacent ce panneau),
 *             image, liste des points ; ⋯ Supprimer ce lieu (annulable) ;
 *   - point : nom, Carte | Donjon | Rien, liste déroulante à vignettes (js/mj/univers-liste.js), Visible / Caché ; action Entrer ; ⋯ Supprimer ce point.
 * Une suppression demande d'abord une confirmation dans le panneau (rien ne part sur un seul clic) ; celle d'un lieu s'annule ensuite.
 * `rendre` ne garde aucun état : tout vient de `U` (js/mj/univers-ui.js) et du stockage. Le champ qui avait le focus (`U.saisie.cle`, `data-cle`)
 * le retrouve après un redessin. Tout texte venu d'un fichier passe par textContent.
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';
import * as modele from '../univers.js';
import * as images from '../univers-images.js';
import { btn } from '../univers-boutons.js';
import { grilleEffective } from '../univers-grille.js';
import { creerListeDeroulante } from '../mj/univers-liste.js';
import { aide } from '../mj/univers-menu.js';
import { calagePossible, genreDestination, lienJouer } from '../univers-vue.js';
import { pluriel } from '../format.js';

const NOUVELLE_CARTE = '__nouvelle-carte__';
const cleImage = (ref) => `${ref?.source}:${ref?.id}`;
const urlsVignettes = new Map(); // clé d'image → URL, pour que la vignette d'un lieu n'attende qu'une fois

/** La vignette d'un lieu : l'icône du monde d'abord, puis l'image dès qu'elle est connue. `classe` : 'petite' (32 px) ou '' (40 px). */
export function vignetteLieu(ref, classe = 'petite') {
  const boite = h('span', { className: `univers-vignette ${classe}`.trim(), 'aria-hidden': 'true' }, icone('monde'));
  if (!ref) return boite;
  const cle = cleImage(ref);
  const poser = (url) => { if (url) boite.replaceChildren(h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async' })); };
  if (urlsVignettes.has(cle)) poser(urlsVignettes.get(cle));
  else images.urlImage(ref).then((url) => { if (url) { urlsVignettes.set(cle, url); poser(url); } });
  return boite;
}

/**
 * Enregistre les trois types. `coquille` : js/atelier/coquille.js ; `U` : `ctx.univers` de main-mj.js (js/mj/univers-ui.js).
 */
export function enregistrerInspecteursMonde(coquille, U) {
  const insp = coquille.inspecteur;
  let confirmation = null; // { type, id } : la suppression qui attend un second clic
  const redessiner = () => insp.rafraichir();
  const avecCle = (el, cle) => { el.dataset.cle = cle; return el; };
  const champ = (libelle, ...enfants) => h('label', { className: 'ligne' }, h('span', { textContent: libelle }), ...enfants);
  const option = (valeur, texte, disabled = false) => h('option', { value: valeur, textContent: texte, disabled });
  const mondeDe = (sel, c) => c.univers?.[sel.type === 'monde' ? sel.id : sel.contexte?.monde] ?? null;

  // Mémoire du champ qui a le focus (une fois pour toutes : le corps de l'inspecteur est le même pour tous les types).
  insp.corps.addEventListener('focusin', (e) => { if (e.target.dataset?.cle) U.saisie.cle = e.target.dataset.cle; });
  insp.corps.addEventListener('focusout', (e) => { if (e.relatedTarget && !insp.corps.contains(e.relatedTarget)) U.saisie.cle = null; });
  /** Prépare le contenu : une zone de style `.univers-insp` posée dans le corps de l'inspecteur ; rend cette zone. */
  function preparer(corps, sel) {
    if (confirmation && !(confirmation.type === sel.type && confirmation.id === sel.id)) confirmation = null;
    const zone = h('div', { className: 'univers-insp' });
    corps.append(zone);
    return zone;
  }
  /** Rend le focus au champ qui l'avait avant le redessin (le nom d'un point neuf, le nom d'un monde neuf…). */
  function retrouverFocus(conteneur) {
    const cle = U.saisie.cle;
    if (!cle) return;
    const el = conteneur.querySelector(`[data-cle="${cle}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    if (el.select && (cle === 'monde-nom' || (cle === 'nom' && !el.value))) el.select();
  }
  /** Le bandeau « Supprimer ? » : une confirmation explicite, dans le panneau. */
  function bandeauConfirmation(sel, texte, faire) {
    if (!confirmation || confirmation.type !== sel.type || confirmation.id !== sel.id) return null;
    return h('div', { className: 'univers-confirmation', role: 'alert' },
      h('p', { className: 'note erreur', textContent: texte }),
      h('div', { className: 'actions' },
        btn('Confirmer la suppression', () => { confirmation = null; faire(); }, { classe: 'btn-danger' }),
        btn('Garder', () => { confirmation = null; redessiner(); }, { classe: 'btn-discret' })));
  }
  const demander = (sel) => { confirmation = { type: sel.type, id: sel.id }; redessiner(); };
  const soustitre = (nom) => h('p', { className: 'note', textContent: nom });

  // --- Monde -----------------------------------------------------------------------------------------------------------------
  insp.enregistrer('monde', {
    titre: (sel, c) => `Monde · ${mondeDe(sel, c)?.nom ?? '?'}`,
    actions: (sel) => [
      { libelle: 'Jouer ce monde', icone: 'jouer', executer: () => { location.href = lienJouer(sel.id); } },
      { libelle: 'Exporter', icone: 'exporter', executer: () => { U.exporterMonde(); } },
    ],
    destructives: (sel) => [{ libelle: 'Supprimer ce monde', executer: () => demander(sel) }],
    rendre(corps, sel, c) {
      const conteneur = preparer(corps, sel);
      const u = mondeDe(sel, c);
      if (!u) { conteneur.append(soustitre('Ce monde n’existe plus.')); return; }
      const bandeau = bandeauConfirmation(sel, `Supprimer « ${u.nom} » et sa partie en cours ? Ses donjons restent intacts, mais ce monde ne se rouvre que depuis un fichier exporté.`, () => U.supprimerLeMonde());
      if (bandeau) conteneur.append(bandeau);
      const nom = avecCle(h('input', { type: 'text', maxLength: 80, value: u.nom, spellcheck: false, 'aria-label': 'Nom du monde' }), 'monde-nom');
      nom.addEventListener('change', () => { U.renommerMonde(nom.value); insp.titre.textContent = `Monde · ${U.monde()?.nom ?? nom.value}`; });
      nom.addEventListener('keydown', (e) => { if (e.key === 'Enter') nom.blur(); });
      const lieux = Object.keys(u.lieux).length;
      const depart = u.lieux[u.racine]?.nom;
      conteneur.append(
        champ('Nom', nom),
        soustitre(lieux ? `${pluriel(lieux, 'lieu', 'lieux')}${depart ? ` · départ : ${depart}` : ''}.` : 'Aucun lieu : ajoute la première carte (le continent, la région, le village…).'),
        h('div', { className: 'actions' }, btn('Ajouter un lieu', () => U.ajouterLieuLibre(), { icone: 'plus' })),
        h('p', { className: 'note', textContent: 'Choisis un lieu dans l’arbre pour ouvrir sa carte ; l’outil Point y pose les liaisons vers d’autres cartes ou des donjons.' }));
      retrouverFocus(conteneur);
    },
  });

  // --- Lieu ------------------------------------------------------------------------------------------------------------------
  insp.enregistrer('lieu', {
    titre: (sel, c) => `${U.calage.actif() && U.lieu() === sel.id ? 'Grille' : 'Lieu'} · ${mondeDe(sel, c)?.lieux?.[sel.id]?.nom ?? '?'}`,
    destructives: (sel) => (U.calage.actif() ? [] : [{ libelle: 'Supprimer ce lieu', executer: () => demander(sel) }]),
    rendre(corps, sel, c) {
      const conteneur = preparer(corps, sel);
      const u = mondeDe(sel, c);
      const l = u?.lieux?.[sel.id];
      if (!l) { conteneur.append(soustitre('Ce lieu n’existe plus.')); return; }
      if (U.lieu() !== l.id) { conteneur.append(soustitre('Ouvre ce lieu dans l’arbre pour le modifier.')); return; }
      if (U.calage.actif()) { conteneur.append(U.calage.panneau()); return; } // l'outil Grille : ses réglages prennent la place du lieu
      const entrees = modele.pointsVers(u, l.id).length;
      const bandeau = bandeauConfirmation(sel, `Retirer « ${l.nom} » ?${entrees ? ` ${pluriel(entrees, 'point y mène', 'points y mènent')} : ils resteront signalés comme orphelins.` : ''} Tu pourras annuler juste après.`, () => U.supprimerLeLieu());
      if (bandeau) conteneur.append(bandeau);
      const orph = modele.orphelins(u, U.donjons()).filter((o) => o.lieu === l.id);
      const nom = avecCle(h('input', { type: 'text', maxLength: 80, value: l.nom, spellcheck: false }), 'lieu-nom');
      nom.addEventListener('change', () => { U.renommerLieu(nom.value); insp.titre.textContent = `Lieu · ${U.lieuCourant()?.nom ?? nom.value}`; });
      nom.addEventListener('keydown', (e) => { if (e.key === 'Enter') nom.blur(); });
      const notes = avecCle(h('textarea', { rows: 3, maxLength: 20000, value: l.notes, spellcheck: true }), 'lieu-notes');
      notes.addEventListener('change', () => U.notesDuLieu(notes.value));
      const depart = h('label', { className: 'ligne case' }, avecCle(h('input', { type: 'checkbox', checked: u.racine === l.id }), 'lieu-depart'), ' Lieu de départ du monde');
      depart.firstChild.addEventListener('change', (e) => { if (e.target.checked) U.lieuDeDepart(); else e.target.checked = true; });
      const info = U.infosEnCache(l.image);
      if (info === undefined) U.infosDe(l.image).then(() => { if (U.lieu() === l.id && coquille.selection()?.id === l.id) redessiner(); }); // le niveau de la carte arrive avec ses informations
      const eff = grilleEffective(l, info ?? null);
      const etatGrille = { lieu: `Grille calée : cases de ${String(eff.grille?.case).replace('.', ',')} px.`, catalogue: `Grille du catalogue : cases de ${String(eff.grille?.case).replace('.', ',')} px.`, aucune: 'Pas de grille.', ambiance: 'Carte d’ambiance, sans grille.' }[eff.origine];
      const peutCaler = !info || calagePossible(info.niveau);
      conteneur.append(
        champ('Nom', nom), champ('Notes', notes), depart,
        ...(peutCaler ? [h('p', { className: 'note univers-etat-grille', textContent: etatGrille })] : []),
        h('div', { className: 'actions' },
          ...(peutCaler ? [avecCle(btn('Caler la grille', () => U.definirMode('grille'), { icone: 'grille' }), 'caler')] : []),
          btn('Changer l’image', () => U.changerImage(), { icone: 'bibliotheque' })),
        ...(orph.length ? [h('p', { className: 'note erreur' }, icone('alerte'), ` ${pluriel(orph.length, 'point mène', 'points mènent')} vers une destination qui n’existe plus : ils sont signalés, rien n’a été retiré.`)] : []),
        listePoints(u, l));
      retrouverFocus(conteneur);
    },
  });

  function listePoints(u, l) {
    const choisi = U.pointId();
    const items = l.points.map((p) => {
      const orph = U.orphelinDe(p);
      const b = btn(p.nom || 'Point sans nom', () => U.selectionnerPoint(p.id), { classe: `btn-discret univers-ligne-point${p.id === choisi ? ' choisi' : ''}` });
      if (orph) { b.prepend(icone('alerte')); b.title = orph; }
      if (p.cache) { b.prepend(icone('oeil-barre')); b.title = `${b.title ? `${b.title} · ` : ''}Caché à la table`; }
      return h('li', {}, b, h('span', { className: 'doux', textContent: ` → ${modele.nomDestination(u, p.vers, U.donjons())}${orph ? ` (${orph})` : ''}` }));
    });
    const auCentre = btn('Point au centre', () => U.poserPoint(0.5, 0.5), { icone: 'point', classe: 'btn-discret', titre: 'Pose un point au centre de la carte (pour le clavier) ; déplace-le ensuite avec les flèches' });
    return h('section', {},
      h('h3', {}, `Points (${l.points.length}) `, aide('Choisis l’outil Point, puis clique sur une zone vide de la carte pour poser un point : son panneau s’ouvre, nomme-le et choisis où il mène. Clique sur un point (outil Sélection) pour rouvrir son panneau, double-clique pour entrer. Glisse un point, ou utilise les flèches du clavier, pour le déplacer. Un clic dans le vide lâche le point.')),
      items.length ? h('ul', { className: 'univers-liste' }, ...items) : h('p', { className: 'note', textContent: 'Aucun point : choisis l’outil Point, puis clique sur la carte.' }),
      auCentre);
  }

  // --- Point -----------------------------------------------------------------------------------------------------------------
  /**
   * Destination du point, sur deux lignes : le sélecteur [ Carte | Donjon | Rien ], puis selon le choix un seul menu de lieux
   * (dont « ＋ Nouvelle carte… », qui ouvre la bibliothèque), ou le donjon et sa salle d'arrivée côte à côte, ou rien.
   */
  function destination(p, u) {
    const donjons = U.donjons();
    const genre = genreDestination(p.vers);
    const actif = U.saisie.choixGenre ?? genre;
    const choisir = (id, libelle, cle, faire) => {
      const b = avecCle(btn(libelle, faire, { classe: 'univers-segment-bouton' }), cle);
      b.setAttribute('aria-pressed', String(actif === id));
      return b;
    };
    const segments = h('div', { className: 'univers-segment', role: 'group', 'aria-label': 'Où mène ce point' },
      choisir('carte', 'Carte', 'g-carte', () => { if (genre !== 'carte') { U.saisie.choixGenre = 'carte'; U.saisie.cle = 'g-carte'; redessiner(); } }),
      choisir('donjon', 'Donjon', 'g-donjon', () => {
        if (genre === 'donjon') return;
        const d = Object.values(donjons)[0];
        if (d) { U.saisie.cle = 'g-donjon'; U.changerDestination({ donjon: d.id }); } else U.dire('Aucun donjon dans ce navigateur : crée-en un d’abord, dans Donjons.', { erreur: true });
      }),
      choisir('', 'Rien', 'g-rien', () => { U.saisie.cle = 'g-rien'; U.changerDestination(null); }));
    const lignes = [];
    if (actif === 'carte') {
      const autres = modele.listerLieux(u).filter((x) => x.id !== U.lieu() || x.id === p.vers?.lieu);
      const avant = genre === 'carte' ? p.vers.lieu : '';
      const opts = [
        ...(genre === 'carte' && !(p.vers.lieu in u.lieux) ? [{ valeur: p.vers.lieu, libelle: '(lieu disparu)', desactive: true }] : []),
        ...autres.map((x) => ({ valeur: x.id, libelle: x.nom, image: u.lieux[x.id]?.image ?? null })),
        { valeur: NOUVELLE_CARTE, libelle: 'Nouvelle carte…', ajout: true },
      ];
      const liste = creerListeDeroulante({
        libelle: 'Lieu de destination', options: opts, valeur: avant, vide: 'Choisir un lieu…', cle: 'lieu',
        vignette: (o) => vignetteLieu(o.image),
        surChoix: (o) => { if (o.valeur === NOUVELLE_CARTE) U.destinationNouvelleCarte(); else { U.saisie.cle = 'lieu'; U.changerDestination({ lieu: o.valeur }); } },
      });
      lignes.push(h('div', { className: 'univers-ligne-destination' }, liste.element));
    } else if (actif === 'donjon') {
      const listeDonjon = creerListeDeroulante({
        libelle: 'Donjon', cle: 'donjon', valeur: p.vers.donjon, vide: 'Choisir un donjon…',
        options: [
          ...(!donjons[p.vers.donjon] ? [{ valeur: p.vers.donjon, libelle: '(donjon disparu)', desactive: true }] : []),
          ...Object.values(donjons).map((d) => ({ valeur: d.id, libelle: d.nom })),
        ],
        surChoix: (o) => { U.saisie.cle = 'donjon'; U.changerDestination({ donjon: o.valeur }); },
      });
      const enfants = [listeDonjon.element];
      const d = donjons[p.vers.donjon];
      if (d) {
        const salle = avecCle(h('select', { 'aria-label': 'Salle d’arrivée' }, option('', 'Salle affichée'), ...Object.values(d.salles).map((x) => option(x.id, x.nom))), 'salle');
        if (p.vers.salle && !(p.vers.salle in d.salles)) salle.append(option(p.vers.salle, '(salle disparue)', true));
        salle.value = p.vers.salle ?? '';
        salle.title = 'Salle d’arrivée : « Salle affichée » garde celle que le donjon montrait';
        salle.addEventListener('change', () => U.changerDestination({ donjon: d.id, ...(salle.value ? { salle: salle.value } : {}) }));
        enfants.push(salle);
      }
      lignes.push(h('div', { className: 'univers-ligne-destination' }, ...enfants));
    }
    return [segments, ...lignes];
  }

  insp.enregistrer('point', {
    titre: (sel, c) => `Point · ${mondeDe(sel, c)?.lieux?.[sel.contexte?.lieu]?.points?.find((p) => p.id === sel.id)?.nom || 'sans nom'}`,
    actions: () => [{ libelle: 'Entrer', executer: () => U.entrerDansPoint() }], // sans icône : la flèche du système pointe à gauche
    destructives: (sel) => [{ libelle: 'Supprimer ce point', executer: () => demander(sel) }],
    rendre(corps, sel, c) {
      const conteneur = preparer(corps, sel);
      const u = mondeDe(sel, c);
      const p = U.pointCourant();
      if (!u || !p || p.id !== sel.id) { conteneur.append(soustitre('Ce point n’existe plus.')); return; }
      const orph = U.orphelinDe(p);
      const bandeau = bandeauConfirmation(sel, `Supprimer le point « ${p.nom || 'sans nom'} » ?`, () => U.supprimerPoint());
      if (bandeau) conteneur.append(bandeau);
      const nomPoint = avecCle(h('input', { type: 'text', className: 'univers-point-nom', maxLength: 80, value: p.nom, spellcheck: false, placeholder: 'Nom du point', 'aria-label': 'Nom du point' }), 'nom');
      // Le nom s'enregistre en quittant le champ (ou Entrée) sans redessiner le panneau : un clic sur un autre bouton ne doit pas être perdu.
      nomPoint.addEventListener('change', () => { U.modifierPoint({ nom: nomPoint.value }); insp.titre.textContent = `Point · ${nomPoint.value.trim() || 'sans nom'}`; U.rendre({ inspecteur: false }); });
      nomPoint.addEventListener('keydown', (e) => { if (e.key === 'Enter') nomPoint.blur(); });
      const cache = avecCle(h('input', { type: 'checkbox', checked: !!p.cache, role: 'switch' }), 'cache');
      cache.addEventListener('change', () => { U.modifierPoint({ cache: cache.checked }); U.saisie.cle = 'cache'; U.rendre(); });
      const interrupteur = h('label', { className: 'univers-interrupteur', title: 'Caché : le point n’apparaît à la table qu’une fois révélé en jeu' }, cache, h('span', { className: 'univers-glissiere', 'aria-hidden': 'true' }),
        h('span', { textContent: p.cache ? 'Caché' : 'Visible' }));
      conteneur.append(
        nomPoint,
        ...destination(p, u),
        ...(orph ? [h('p', { className: 'note erreur' }, icone('alerte'), ` Destination perdue : ${orph}. Choisis-en une autre ; rien n’a été retiré.`)] : []),
        interrupteur);
      retrouverFocus(conteneur);
    },
  });
}
