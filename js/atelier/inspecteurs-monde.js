/**
 * Les inspecteurs du Monde dans l'atelier (lot C) : les types `monde`, `lieu` et `point` de la colonne de droite (panneau bas sous 760 px).
 * Ils reprennent ce que faisaient le panneau « Ce lieu », la bulle d'un point et la barre du monde, sur le contrat de js/atelier/inspecteur.js :
 *   - monde : nom, résumé (lieux, départ de la partie s'il n'est pas la carte du monde) ; le nœud monde PORTE la carte du monde (le lieu racine) :
 *             son panneau montre ce que montre un lieu (notes, carte), ou « Choisir la carte du monde » s'il n'en a pas (Ajouter un lieu
 *             est dans l'arbre, Jouer dans la barre de la scène) ; ⋯ Changer l'image, Exporter, Retirer la carte du monde (annulable), Supprimer ce monde ;
 *   - lieu  : nom, notes, départ de la partie, grille (l'outil Calage de la barre ouvre le calage, dont les réglages remplacent ce panneau),
 *             orphelins ; ⋯ Changer l'image, Supprimer ce lieu (annulable) ; les points, eux, se règlent dans leur bulle sur la carte ;
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
  const AIDE_POINTS = 'Sur la carte : un clic dans le vide pose un point, glisser le déplace, Suppr efface le point choisi.';
  const section = (cle, titre, enfants, options = {}) => creerSection({ cle: `monde:${cle}`, titre, enfants, ...options }).element;
  const soustitre = (nom) => h('p', { className: 'note', textContent: nom });
  /** La carte du monde est-elle celle que la scène affiche ? (Le panneau du monde est alors celui de cette carte.) */
  const carteAffichee = (u) => !!u && U.lieu() !== null && U.lieu() === modele.carteDuMonde(u);

  // --- Monde -----------------------------------------------------------------------------------------------------------------
  insp.enregistrer('monde', {
    etiquette: (sel, c) => (carteAffichee(mondeDe(sel, c)) && U.calage.actif() ? 'Calage' : 'Monde'),
    titre: (sel, c) => mondeDe(sel, c)?.nom ?? '?',
    renommer: (_sel, valeur) => U.renommerMonde(valeur),
    nomCle: 'monde-nom',
    nomVide: 'Nom du monde',
    resume: (sel, c) => {
      const u = mondeDe(sel, c);
      if (!u) return '';
      if (U.calage.actif() && carteAffichee(u)) return '';
      const lieux = Object.keys(u.lieux).length;
      const depart = modele.lieuDeDepart(u);
      const ailleurs = depart && depart !== modele.carteDuMonde(u) ? u.lieux[depart]?.nom : ''; // le départ n'est dit que s'il n'est pas la carte du monde
      return lieux ? `${pluriel(lieux, 'lieu', 'lieux')}${ailleurs ? ` · départ : ${ailleurs}` : ''}` : 'Aucune carte';
    },
    // (Pas d'action « Ajouter un lieu » ici : c'est la dernière ligne de la branche du monde, dans l'arbre.)
    menu: (sel, c) => {
      if (U.calage.actif()) return [];
      const u = mondeDe(sel, c);
      const carte = u && carteAffichee(u) ? u.lieux[modele.carteDuMonde(u)] : null;
      return [...(carte ? [actionImage(carte)] : []), { libelle: 'Exporter', icone: 'exporter', executer: () => { U.exporterMonde(); } }];
    },
    destructives: (sel, c) => {
      const u = mondeDe(sel, c);
      const carte = u && !U.calage.actif() ? modele.carteDuMonde(u) : null;
      return [
        ...(carte && carteAffichee(u) ? [{
          libelle: 'Retirer la carte du monde', confirmation: `Retirer « ${u.lieux[carte].nom} » ?`,
          titre: 'Retire cette carte du monde ; tu pourras annuler juste après',
          executer: () => U.supprimerLeLieu(),
        }] : []),
        {
          libelle: 'Supprimer ce monde', confirmation: `Supprimer « ${u?.nom ?? '?'} » ?`,
          titre: 'Supprime le monde et sa partie en cours. Ses donjons restent intacts, mais ce monde ne se rouvre que depuis un fichier exporté.',
          executer: () => U.supprimerLeMonde(),
        }];
    },
    rendre(corps, sel, c) {
      const conteneur = preparer(corps);
      const u = mondeDe(sel, c);
      if (!u) { conteneur.append(soustitre('Ce monde n’existe plus.')); return; }
      const idCarte = modele.carteDuMonde(u);
      const l = idCarte ? u.lieux[idCarte] : null;
      if (!l) { // un monde sans carte : la première est celle du monde (elle prend son nom)
        conteneur.append(section('monde-carte', 'Carte du monde', [
          h('p', { className: 'note', textContent: 'Ce monde n’a pas encore de carte. Choisis celle qui le contient tout entier : l’archipel, le continent, la région…' }),
          h('div', { className: 'actions' }, avecCle(btn('Choisir la carte du monde', () => U.ajouterLieuLibre(), { icone: 'bibliotheque', classe: 'btn-discret' }), 'carte-du-monde'))]));
        retrouverFocus();
        return;
      }
      if (U.lieu() !== l.id) { conteneur.append(soustitre('Ouvre la carte du monde dans l’arbre pour la modifier.')); return; }
      if (U.calage.actif()) { conteneur.append(U.calage.panneau()); return; }
      contenuCarte(conteneur, u, l);
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
      const info = l.image ? U.infosEnCache(l.image) : null;
      const taille = l.image ? resumeTailleLieu(grilleEffective(l, info ?? null).grille, info?.largeur, info?.hauteur, chargerReglages().echelle) : 'à illustrer';
      return [taille, l.points.length ? pluriel(l.points.length, 'point', 'points') : 'Aucun point', modele.lieuDeDepart(mondeDe(sel, c)) === l.id ? 'départ de la partie' : ''].filter(Boolean).join(' · ');
    },
    menu: (sel, c) => {
      const l = mondeDe(sel, c)?.lieux?.[sel.id];
      return l && U.lieu() === l.id && !U.calage.actif() ? [actionImage(l)] : [];
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
      contenuCarte(conteneur, u, l);
    },
  });

  /** Changer l'image d'une carte : rare, donc dans le « ⋯ » (un lieu sans image a aussi « Choisir une image » sur son fond, dans la scène). */
  const actionImage = (l) => ({ libelle: l.image ? 'Changer l’image' : 'Choisir une image', icone: 'bibliotheque', executer: () => U.changerImage() });

  /** Le corps d'un lieu, et de la carte du monde dans le panneau du monde : orphelins, notes (la place libre leur revient), carte (départ, grille). */
  function contenuCarte(conteneur, u, l) {
    const notes = avecCle(h('textarea', { rows: 12, className: 'univers-notes', maxLength: 20000, value: l.notes, spellcheck: true, placeholder: 'Ce que les joueurs savent, ce qui se cache ici…', 'aria-label': 'Notes du lieu' }), 'lieu-notes');
    notes.addEventListener('change', () => U.notesDuLieu(notes.value));
    const departCoche = avecCle(h('input', { type: 'checkbox', checked: modele.lieuDeDepart(u) === l.id, role: 'switch' }), 'lieu-depart');
    departCoche.addEventListener('change', () => { if (departCoche.checked) U.definirDepart(); else departCoche.checked = true; }); // on change de départ en le cochant ailleurs
    const depart = h('label', { className: 'univers-interrupteur', title: 'La partie commence sur ce lieu (par défaut, la carte du monde). Pour changer, coche un autre lieu.' }, departCoche, h('span', { className: 'univers-glissiere', 'aria-hidden': 'true' }),
      h('span', { textContent: 'Départ de la partie' }));
    const info = l.image ? U.infosEnCache(l.image) : null; // sans image : ni informations, ni grille
    if (info === undefined) U.infosDe(l.image).then(() => { if (U.lieu() === l.id && [l.id, u.id].includes(coquille.selection()?.id)) redessiner(); }); // le niveau de la carte arrive avec ses informations
    const eff = grilleEffective(l, info ?? null);
    const taille = String(eff.grille?.case).replace('.', ',');
    const etatGrille = { lieu: `Grille calée : cases de ${taille} px`, catalogue: `Grille du catalogue : cases de ${taille} px`, aucune: 'Pas de grille', ambiance: 'Carte d’ambiance, sans grille' }[eff.origine];
    const peutCaler = !!l.image && (!info || calagePossible(info.niveau));
    conteneur.append(
      ...alerteOrphelins(l),
      section('lieu-notes', 'Notes', [notes]),
      section('lieu-carte', 'Carte', [
        depart,
        ...(peutCaler ? [h('div', { className: 'ligne' }, h('span', { className: 'univers-etat-grille doux', textContent: etatGrille }), avecCle(btn('Caler la grille', () => U.definirMode('grille'), { icone: 'grille', classe: 'btn-discret' }), 'caler'))] : [])], { aide: AIDE_POINTS }));
    retrouverFocus();
  }

  /**
   * Les points de la carte ne sont plus listés ici : la carte les montre, et chacun se règle dans sa bulle. Le panneau ne garde que ce que la
   * carte ne dit pas : les points dont la destination n'existe plus, chacun cliquable (sa bulle s'ouvre).
   */
  function alerteOrphelins(l) {
    const orph = l.points.filter((p) => U.orphelinDe(p));
    if (!orph.length) return [];
    return [h('div', { className: 'note erreur univers-orphelins' },
      h('p', {}, icone('alerte'), ` ${pluriel(orph.length, 'point mène', 'points mènent')} vers une destination qui n’existe plus (rien n’a été retiré) :`),
      h('div', { className: 'actions' }, ...orph.map((p) => btn(p.nom || 'Point sans nom', () => U.selectionnerPoint(p.id), { classe: 'btn-discret', titre: U.orphelinDe(p) }))))];
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
      choisir('carte', 'Carte', 'g-carte', () => { if (genre !== 'carte') { U.saisie.choixGenre = 'carte'; U.saisie.cle = 'g-carte'; U.rendre(); } }), // la bulle et le panneau bas suivent
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
      conteneur.append(
        section('point-destination', 'Destination', destination(p, u)),
        ...noteOrphelin(p),
        section('point-table', 'À la table', [interrupteur(p), departCarte(p)]));
      retrouverFocus();
    },
  });

  /** Visible / Caché à la table (panneau bas et bulle). */
  function interrupteur(p) {
    const cache = avecCle(h('input', { type: 'checkbox', checked: !!p.cache, role: 'switch' }), 'cache');
    cache.addEventListener('change', () => { U.modifierPoint({ cache: cache.checked }); U.saisie.cle = 'cache'; U.rendre(); });
    return h('label', { className: 'univers-interrupteur', title: 'Caché : le point n’apparaît à la table qu’une fois révélé en jeu' }, cache, h('span', { className: 'univers-glissiere', 'aria-hidden': 'true' }),
      h('span', { textContent: p.cache ? 'Caché' : 'Visible' }));
  }
  /** « Point de départ de la carte » : là où la table atterrit en découvrant la carte (un seul par carte ; cocher un autre décoche celui-ci). */
  function departCarte(p) {
    const depart = avecCle(h('input', { type: 'checkbox', checked: !!p.depart }), 'depart');
    depart.addEventListener('change', () => { U.modifierPoint({ depart: depart.checked }); U.saisie.cle = 'depart'; U.rendre(); });
    return h('label', { className: 'univers-case', title: 'À la table, la carte s’ouvre sur ce point quand elle dépasse l’écran. Un seul point par carte.' }, depart, h('span', { textContent: 'Point de départ de la carte' }));
  }
  function noteOrphelin(p) {
    const orph = U.orphelinDe(p);
    return orph ? [h('p', { className: 'note erreur' }, icone('alerte'), ` Destination perdue : ${orph}. Choisis-en une autre ; rien n’a été retiré.`)] : [];
  }

  // --- La bulle d'un point, sur la carte (ordinateur) : tout ce qui le concerne, sans toucher au panneau -------------------------------
  // Le nom en tête (Entrée : fini, on peut cliquer le point suivant), la destination, Visible / Caché, puis Entrer et Supprimer.
  U.definirBulle((conteneur, p, u) => {
    const nom = avecCle(h('input', { type: 'text', className: 'univers-bulle-nom', value: p.nom, maxLength: 80, spellcheck: false, autocomplete: 'off', placeholder: 'Nom du point', 'aria-label': 'Nom du point' }), 'nom');
    nom.addEventListener('input', () => U.nommerPoint(nom.value));
    nom.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); U.fermerBulle(); } });
    const fermer = btn('Fermer', () => U.fermerBulle(), { icone: 'fermer', iconeSeule: true, classe: 'btn-discret', titre: 'Fermer (Échap)' });
    const supprimer = btn('Supprimer', () => U.supprimerPoint(), { icone: 'supprimer', classe: 'btn-discret univers-bulle-supprimer', titre: 'Supprime ce point (Suppr) ; « Annuler » le remet' });
    conteneur.append(
      h('div', { className: 'univers-bulle-tete' }, nom, fermer),
      h('div', { className: 'univers-bulle-corps' },
        h('p', { className: 'univers-bulle-titre', textContent: 'Mène vers' }),
        ...destination(p, u),
        ...noteOrphelin(p),
        interrupteur(p),
        departCarte(p)),
      h('div', { className: 'univers-bulle-pied' },
        ...(p.vers ? [btn('Entrer', () => U.entrerDansPoint(), { classe: 'btn-discret', titre: 'Va à la destination (double-clic sur le point : même chose)' })] : []),
        supprimer));
  });
}
