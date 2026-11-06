/**
 * Les inspecteurs du Monde dans l'atelier (lot C) : les types `monde`, `lieu` et `point` de la colonne de droite (panneau bas sous 760 px).
 * Ils reprennent ce que faisaient le panneau « Ce lieu », la bulle d'un point et la barre du monde, sur le contrat de js/atelier/inspecteur.js :
 *   - monde : nom, résumé ; action Ajouter un lieu (Jouer est dans la barre de la scène) ; ⋯ Exporter, Supprimer ce monde ;
 *   - lieu  : nom, notes, lieu de départ, grille (l'outil Calage de la barre ouvre le calage, dont les réglages remplacent ce panneau),
 *             image, liste des points ; ⋯ Supprimer ce lieu (annulable) ;
 *   - point : nom, Carte | Donjon | Rien, liste déroulante à vignettes (js/mj/univers-liste.js), Visible / Caché ; action Entrer ; ⋯ Supprimer ce point.
 * L'en-tête (type, nom modifiable, résumé, « ⋯ ») est celui de tous les types. Une suppression se confirme en deux temps dans le menu « ⋯ » ; celle d'un lieu s'annule ensuite.
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
import { calagePossible, genreDestination } from '../univers-vue.js';
import { pluriel } from '../format.js';
import { resumeTailleLieu } from './dimensions.js';
import { chargerReglages } from '../stockage.js';
import { vignetteLieu } from './vignette-lieu.js';
import { creerSection } from './section.js';
import { creerListe } from './liste.js';

const NOUVELLE_CARTE = '__nouvelle-carte__';
export { vignetteLieu };

/**
 * Enregistre les trois types. `coquille` : js/atelier/coquille.js ; `U` : `ctx.univers` de main-mj.js (js/mj/univers-ui.js).
 */
export function enregistrerInspecteursMonde(coquille, U) {
  const insp = coquille.inspecteur;
  const redessiner = () => insp.rafraichir();
  const avecCle = (el, cle) => { el.dataset.cle = cle; return el; };
  const option = (valeur, texte, disabled = false) => h('option', { value: valeur, textContent: texte, disabled });
  const mondeDe = (sel, c) => c.univers?.[sel.type === 'monde' ? sel.id : sel.contexte?.monde] ?? null;

  // Mémoire du champ qui a le focus (une fois pour toutes : l'en-tête et le corps sont les mêmes pour tous les types).
  insp.element.addEventListener('focusin', (e) => { if (e.target.dataset?.cle) U.saisie.cle = e.target.dataset.cle; });
  insp.element.addEventListener('focusout', (e) => { if (e.relatedTarget && !insp.element.contains(e.relatedTarget)) U.saisie.cle = null; });
  /** Prépare le contenu : une zone de style `.univers-insp` posée dans le corps de l'inspecteur ; rend cette zone. */
  function preparer(corps) {
    const zone = h('div', { className: 'univers-insp' });
    corps.append(zone);
    return zone;
  }
  /** Rend le focus au champ qui l'avait avant le redessin (le nom d'un point neuf, d'un monde neuf…) : dans le corps ou dans l'en-tête. */
  function retrouverFocus() {
    const cle = U.saisie.cle;
    if (!cle) return;
    const el = insp.element.querySelector(`[data-cle="${cle}"]`);
    if (!el || el.hidden) return;
    el.focus({ preventScroll: true });
    if (el.select && (cle === 'monde-nom' || (cle === 'nom' && !el.value))) el.select();
  }
  /** Une section du panneau (js/atelier/section.js) : bandeau repliable, puis son contenu. `cle` garde le pli pour la session. */
  const section = (cle, titre, enfants, options = {}) => creerSection({ cle: `monde:${cle}`, titre, enfants, ...options }).element;
  const soustitre = (nom) => h('p', { className: 'note', textContent: nom });

  // --- Monde -----------------------------------------------------------------------------------------------------------------
  insp.enregistrer('monde', {
    titre: (sel, c) => mondeDe(sel, c)?.nom ?? '?',
    renommer: (_sel, valeur) => U.renommerMonde(valeur),
    nomCle: 'monde-nom',
    nomVide: 'Nom du monde',
    resume: (sel, c) => {
      const u = mondeDe(sel, c);
      if (!u) return '';
      const lieux = Object.keys(u.lieux).length;
      const depart = u.lieux[u.racine]?.nom;
      return lieux ? `${pluriel(lieux, 'lieu', 'lieux')}${depart ? ` · départ : ${depart}` : ''}` : 'Aucun lieu';
    },
    actions: (sel) => [
      { libelle: 'Ajouter un lieu', icone: 'plus', executer: () => U.ajouterLieuLibre() },
    ],
    menu: () => [{ libelle: 'Exporter', icone: 'exporter', executer: () => { U.exporterMonde(); } }],
    destructives: (sel, c) => [{
      libelle: 'Supprimer ce monde', confirmation: `Supprimer « ${mondeDe(sel, c)?.nom ?? '?'} » ?`,
      titre: 'Supprime le monde et sa partie en cours. Ses donjons restent intacts, mais ce monde ne se rouvre que depuis un fichier exporté.',
      executer: () => U.supprimerLeMonde(),
    }],
    rendre(corps, sel, c) {
      const conteneur = preparer(corps);
      const u = mondeDe(sel, c);
      if (!u) { conteneur.append(soustitre('Ce monde n’existe plus.')); return; }
      retrouverFocus();
    },
  });

  // --- Lieu ------------------------------------------------------------------------------------------------------------------
  insp.enregistrer('lieu', {
    etiquette: (sel) => (U.calage.actif() && U.lieu() === sel.id ? 'Calage' : 'Lieu'),
    titre: (sel, c) => mondeDe(sel, c)?.lieux?.[sel.id]?.nom ?? '?',
    renommer: (_sel, valeur) => U.renommerLieu(valeur),
    nomCle: 'lieu-nom',
    nomVide: 'Nom du lieu',
    resume: (sel, c) => {
      const l = mondeDe(sel, c)?.lieux?.[sel.id];
      if (!l || (U.calage.actif() && U.lieu() === sel.id)) return '';
      const info = U.infosEnCache(l.image);
      const taille = resumeTailleLieu(grilleEffective(l, info ?? null).grille, info?.largeur, info?.hauteur, chargerReglages().echelle);
      return [taille, l.points.length ? pluriel(l.points.length, 'point', 'points') : 'Aucun point', mondeDe(sel, c).racine === l.id ? 'départ du monde' : ''].filter(Boolean).join(' · ');
    },
    destructives: (sel, c) => {
      if (U.calage.actif()) return [];
      const u = mondeDe(sel, c);
      const l = u?.lieux?.[sel.id];
      const entrees = l ? modele.pointsVers(u, l.id).length : 0;
      return [{
        libelle: 'Supprimer ce lieu', confirmation: `Supprimer « ${l?.nom ?? '?'} » ?${entrees ? ` ${pluriel(entrees, 'point y mène', 'points y mènent')} : signalés ensuite comme orphelins.` : ''}`,
        titre: 'Retire ce lieu ; tu pourras annuler juste après',
        executer: () => U.supprimerLeLieu(),
      }];
    },
    rendre(corps, sel, c) {
      const conteneur = preparer(corps);
      const u = mondeDe(sel, c);
      const l = u?.lieux?.[sel.id];
      if (!l) { conteneur.append(soustitre('Ce lieu n’existe plus.')); return; }
      if (U.lieu() !== l.id) { conteneur.append(soustitre('Ouvre ce lieu dans l’arbre pour le modifier.')); return; }
      if (U.calage.actif()) { conteneur.append(U.calage.panneau()); return; } // l'outil Calage : ses réglages prennent la place du lieu
      const orph = modele.orphelins(u, U.donjons()).filter((o) => o.lieu === l.id);
      const notes = avecCle(h('textarea', { rows: 3, maxLength: 20000, value: l.notes, spellcheck: true, placeholder: 'Ce que les joueurs savent, ce qui se cache ici…', 'aria-label': 'Notes du lieu' }), 'lieu-notes');
      notes.addEventListener('change', () => U.notesDuLieu(notes.value));
      const depart = h('label', { className: 'ligne case' }, avecCle(h('input', { type: 'checkbox', checked: u.racine === l.id }), 'lieu-depart'), ' Lieu de départ du monde');
      depart.firstChild.addEventListener('change', (e) => { if (e.target.checked) U.lieuDeDepart(); else e.target.checked = true; });
      const info = U.infosEnCache(l.image);
      if (info === undefined) U.infosDe(l.image).then(() => { if (U.lieu() === l.id && coquille.selection()?.id === l.id) redessiner(); }); // le niveau de la carte arrive avec ses informations
      const eff = grilleEffective(l, info ?? null);
      const taille = String(eff.grille?.case).replace('.', ',');
      const etatGrille = { lieu: `Grille calée : cases de ${taille} px`, catalogue: `Grille du catalogue : cases de ${taille} px`, aucune: 'Pas de grille', ambiance: 'Carte d’ambiance, sans grille' }[eff.origine];
      const peutCaler = !info || calagePossible(info.niveau);
      conteneur.append(
        ...(orph.length ? [h('p', { className: 'note erreur' }, icone('alerte'), ` ${pluriel(orph.length, 'point mène', 'points mènent')} vers une destination qui n’existe plus : ils sont signalés, rien n’a été retiré.`)] : []),
        listePoints(u, l),
        section('lieu-notes', 'Notes', [notes]),
        section('lieu-carte', 'Carte', [
          depart,
          ...(peutCaler ? [h('div', { className: 'ligne' }, h('span', { className: 'univers-etat-grille doux', textContent: etatGrille }), avecCle(btn('Caler la grille', () => U.definirMode('grille'), { icone: 'grille', classe: 'btn-discret' }), 'caler'))] : []),
          h('div', { className: 'actions' }, btn('Changer l’image', () => U.changerImage(), { icone: 'bibliotheque', classe: 'btn-discret' }))]));
      retrouverFocus();
    },
  });

  function listePoints(u, l) {
    const choisi = U.pointId();
    const ICONE_GENRE = { carte: 'monde', donjon: 'donjon', '': 'point' };
    const rangees = l.points.map((p) => {
      const orph = U.orphelinDe(p);
      const dest = modele.nomDestination(u, p.vers, U.donjons());
      return {
        nom: p.nom, vide: 'Point sans nom', choisie: p.id === choisi,
        icone: orph ? 'alerte' : p.cache ? 'oeil-barre' : ICONE_GENRE[genreDestination(p.vers)],
        alerte: !!orph,
        detail: p.vers ? ['vers ', { fort: dest }, ...(orph ? [` (${orph})`] : [])] : dest,
        titre: [orph, p.cache ? 'Caché à la table' : ''].filter(Boolean).join(' · ') || undefined,
        surChoix: () => U.selectionnerPoint(p.id),
      };
    });
    return section('lieu-points', 'Points', [
      rangees.length
        ? creerListe(rangees)
        : h('p', { className: 'note', textContent: 'Aucun point : choisis l’outil Point, puis clique sur la carte.' })], {
      compte: l.points.length || null,
      aide: 'Choisis l’outil Point, puis clique sur une zone vide de la carte : son panneau s’ouvre, nomme-le et choisis où il mène. Clique sur un point (outil Sélection) pour rouvrir son panneau, double-clique pour entrer. Glisse un point, ou utilise les flèches du clavier, pour le déplacer. Un clic dans le vide lâche le point.',
      action: { libelle: 'Poser un point au centre de la carte', icone: 'plus', executer: () => U.poserPoint(0.5, 0.5) },
    });
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
        if (d) { U.saisie.cle = 'g-donjon'; U.changerDestination({ donjon: d.id }); } else U.dire('Aucun donjon dans ce navigateur : crée-en un d’abord, dans Préparer.', { erreur: true });
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

  const pointDe = (sel, c) => mondeDe(sel, c)?.lieux?.[sel.contexte?.lieu]?.points?.find((p) => p.id === sel.id);
  insp.enregistrer('point', {
    titre: (sel, c) => pointDe(sel, c)?.nom ?? '',
    renommer: (_sel, valeur) => { U.modifierPoint({ nom: valeur }); U.rendre({ inspecteur: false }); },
    nomCle: 'nom',
    nomVide: 'Nom du point',
    resume: (sel, c) => {
      const p = pointDe(sel, c);
      const u = mondeDe(sel, c);
      if (!p || !u) return '';
      return `${p.vers ? `→ ${modele.nomDestination(u, p.vers, U.donjons())}` : 'Ne mène nulle part'}${p.cache ? ' · caché' : ''}`;
    },
    actions: () => [{ libelle: 'Entrer', executer: () => U.entrerDansPoint() }], // sans icône : la flèche du système pointe à gauche
    destructives: (sel, c) => [{
      libelle: 'Supprimer ce point', confirmation: `Supprimer « ${pointDe(sel, c)?.nom || 'sans nom'} » ?`,
      executer: () => U.supprimerPoint(),
    }],
    rendre(corps, sel, c) {
      const conteneur = preparer(corps);
      const u = mondeDe(sel, c);
      const p = U.pointCourant();
      if (!u || !p || p.id !== sel.id) { conteneur.append(soustitre('Ce point n’existe plus.')); return; }
      const orph = U.orphelinDe(p);
      const cache = avecCle(h('input', { type: 'checkbox', checked: !!p.cache, role: 'switch' }), 'cache');
      cache.addEventListener('change', () => { U.modifierPoint({ cache: cache.checked }); U.saisie.cle = 'cache'; U.rendre(); });
      const interrupteur = h('label', { className: 'univers-interrupteur', title: 'Caché : le point n’apparaît à la table qu’une fois révélé en jeu' }, cache, h('span', { className: 'univers-glissiere', 'aria-hidden': 'true' }),
        h('span', { textContent: p.cache ? 'Caché' : 'Visible' }));
      conteneur.append(
        section('point-destination', 'Destination', destination(p, u)),
        ...(orph ? [h('p', { className: 'note erreur' }, icone('alerte'), ` Destination perdue : ${orph}. Choisis-en une autre ; rien n’a été retiré.`)] : []),
        section('point-table', 'À la table', [interrupteur]));
      retrouverFocus();
    },
  });
}
