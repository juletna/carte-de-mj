/**
 * Les inspecteurs du côté Donjon : salle, donjon, et les éléments de la carte (porte, objet, creature, pion).
 * Tous suivent le modèle de js/atelier/inspecteur.js : un en-tête (type, nom modifiable, résumé, « ⋯ »), puis un corps qui ne garde
 * que ce qu'on règle souvent.
 *
 * Les champs de ces panneaux existent depuis toujours dans donjon.html (`#reserve`) et leurs écouteurs sont posés par les modules de
 * js/mj/ au démarrage : plutôt que de les recréer, l'inspecteur y POSE les blocs voulus (ce sont les mêmes nœuds, ils gardent leur
 * valeur, leur focus et leurs écouteurs) et les reprend dans la réserve avant chaque effacement (`inspecteur.surEffacement`), si bien
 * qu'ils restent toujours dans la page (`$('description')` répond même quand un autre type est affiché). Le nom, lui, est le champ de
 * l'en-tête : il écrit dans `#salle-nom` / `#donjon-nom` (qui restent dans la réserve) et y déclenche « change ».
 *
 *   salle   « 9 × 12 m · pierre » ; Forme et dimensions (L, H, forme), Apparence (sol, ambiance, état, éclairage), description (dictée, « Compris »), liaisons orphelines, notes, éléments (liste), exemples.
 *           Au hasard : une rangée en bas (le dé génère d'un clic, « Régler… » ouvre sa vue dédiée, qui remplace les sections, avec « ← Salle » pour revenir) ; remplit la salle de monstres, coffres, pièges et mobilier (js/atelier/au-hasard-salle.js).
 *           « ⋯ » : plan JSON, signaler une erreur de lecture, — , supprimer la salle.
 *   donjon  « 3 salles · 2 personnages » ; les personnages (liste, ajouter, au hasard) et, repliée, l'échelle (m par case) avec le plein écran. Le rendu (thème, grille…) est le bouton « Affichage » de la barre.
 *           « ⋯ » : exporter, imprimer, copier, — , supprimer le donjon. (L'arbre liste les salles ; la vue d'ensemble est celle du donjon.)
 *   porte, objet, creature, pion   js/mj/bulle.js (relier, créer la salle derrière, cacher, aspect). « ⋯ » : fermer, délier, supprimer.
 */
import { $, h } from '../dom.js';
import { NOMS_SOLS, NOMS_AMBIANCES, NOMS_ETATS_SALLE, NOMS_ECLAIRAGES } from '../schema.js';
import { pluriel } from '../format.js';
import { tailleEnMetres } from './dimensions.js';
import { svgForme } from '../formes.js';
import { creerSection } from './section.js';
import { creerListe } from './liste.js';
import { creerSectionAuHasard } from './au-hasard-salle.js';
import { creerChampChoix } from './champ-choix.js';
import { dessiner } from '../rendu/moteur.js';
import { themeParNom } from '../rendu/themes/index.js';
import { couleurAmbiance } from '../rendu/lumiere.js';
import { libelleSelection, nomCase } from '../coordonnees.js';
import { descripteur } from '../donjon.js';
import { LISTES } from '../schema.js';

const BLOCS_SALLE = ['bloc-description', 'bloc-orphelines', 'bloc-taille', 'bloc-apparence', 'bloc-notes', 'bloc-exemples'];
const BLOCS_DONJON = ['bloc-personnages', 'bloc-reglages'];
const AUTRES_BLOCS = ['bloc-salle-nom', 'bloc-avance', 'bloc-donjon-nom', 'bloc-plan']; // restent dans la réserve, ou n'en sortent que sur demande
const TYPES_ELEMENT = ['porte', 'objet', 'creature', 'pion'];

export function enregistrerInspecteursDonjon(coquille, ctx) {
  const { etat } = ctx;
  const { inspecteur } = coquille;
  const reserve = $('reserve');
  const blocs = [...BLOCS_SALLE, ...BLOCS_DONJON, ...AUTRES_BLOCS].map((id) => $(id));

  // Avant chaque effacement du corps de l'inspecteur, les blocs retournent dans la réserve (hors écran, mais dans la page).
  // Le compteur « Personnages » est déplacé dans le bandeau de sa section : il retourne aussi à sa place, sinon `$('personnages-compte')` ne répond plus
  // et l'enregistrement qui suit une suppression (rendre → personnages.maj) échouait avant d'écrire.
  const compte = $('personnages-compte'), hoteCompte = compte.parentElement;
  inspecteur.surEffacement(() => {
    for (const b of blocs) if (b.parentElement !== reserve) reserve.append(b);
    if (compte.parentElement !== hoteCompte) hoteCompte.append(compte);
  });
  /**
   * Les blocs de la réserve, rangés en sections (js/atelier/section.js, docs/design-panneaux.md) : la section porte le titre et le pli ;
   * un bloc qui était un <details> est gardé ouvert (son résumé est masqué en CSS), un titre interne fait doublon et est masqué de même.
   */
  const section = (cle, titre, ids, options = {}) => {
    const blocsSection = ids.map((id) => $(id));
    for (const b of blocsSection) {
      if (b.tagName === 'DETAILS') b.open = true;
      for (const d of b.querySelectorAll(':scope > details')) d.open = true;
    }
    return creerSection({ cle: `donjon:${cle}`, titre, enfants: blocsSection, ...options }).element;
  };

  // Apparence de la salle : quatre rangées à popover (sol, ambiance, état, éclairage) devant les <select> d'origine, qui restent la source.
  const COULEURS_SOL = { pierre: '#55555c', bois: '#7a5a36', terre: '#6b4e35', sable: '#cdb98a', herbe: '#4f7a3f', marbre: '#d8d6d2', glace: '#a8d4e6' };
  /**
   * La miniature d'un choix. Sol et état : une petite salle de 4 × 4 dessinée par le vrai moteur (thème de l'utilisateur), avec ce seul
   * réglage changé (l'état cadré sur un coin de mur, pour ne pas ressembler au sol). Ambiance et éclairage : leur lumière dessinée seule
   * (une lueur colorée, une intensité), car sur une pierre unique elles se voient à peine.
   */
  const miniatureSalle = (champ) => (valeur) => {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    if (champ === 'ambiance' || champ === 'eclairage') {
      const dpr = window.devicePixelRatio || 1, cote = 84;
      canvas.width = canvas.height = Math.round(cote * dpr);
      canvas.style.width = canvas.style.height = `${cote}px`;
      const c = canvas.getContext('2d');
      c.scale(dpr, dpr);
      c.fillStyle = '#17161b';
      c.fillRect(0, 0, cote, cote);
      const [r, g, bl] = champ === 'ambiance' ? couleurAmbiance(valeur).map((v) => Math.min(255, Math.round(v * 1.8))) : [255, 226, 160]; // teintes du moteur, éclaircies : ce sont des lueurs faibles
      const { rayon, alpha } = champ === 'ambiance' ? { rayon: 0.62, alpha: 0.95 } : ({ obscurite: { rayon: 0.16, alpha: 0.5 }, penombre: { rayon: 0.42, alpha: 0.75 }, eclairee: { rayon: 0.75, alpha: 1 } }[valeur] ?? { rayon: 0.4, alpha: 0.7 });
      const lueur = c.createRadialGradient(cote / 2, cote / 2, 0, cote / 2, cote / 2, cote * rayon);
      lueur.addColorStop(0, `rgba(${r}, ${g}, ${bl}, ${alpha})`);
      lueur.addColorStop(1, `rgba(${r}, ${g}, ${bl}, 0)`);
      c.fillStyle = lueur;
      c.fillRect(0, 0, cote, cote);
      canvas.dataset.cadrage = 'plein';
      return canvas;
    }
    const plan = { ...ctx.salle().plan, largeur: 4, longueur: 4, forme: 'rectangle', bras: undefined, position: undefined, portes: [], objets: [], creatures: [], [champ]: valeur };
    dessiner(canvas, plan, { taille: 14, grille: false, reperes: false, theme: themeParNom(etat.reglages.theme), details: etat.reglages.details, relief: etat.reglages.relief, vue: 'mj' });
    if (champ === 'etat') canvas.dataset.cadrage = 'coin';
    return canvas;
  };
  const blocApparence = $('bloc-apparence');
  blocApparence.append(...[['salle-sol', 'sol', 'Sol', 'sol', COULEURS_SOL, null], ['salle-ambiance', 'ambiance', 'Ambiance', 'ambiance', undefined, 'ambiance'], ['salle-etat', 'état', 'État', 'etat', undefined, 'etat'], ['salle-eclairage', 'éclairage', 'Éclairage', 'eclairage', undefined, 'eclairage']]
    .map(([id, detail, titre, champ, couleurs, badge]) => creerChampChoix({ select: $(id), detail, titre, couleurs, badge, miniature: miniatureSalle(champ) }).element));

  const hasard = creerSectionAuHasard(ctx); // « Au hasard » : le contenu (et la forme) de la salle, js/atelier/au-hasard-salle.js
  const donjonDe = (sel) => etat.donjons[sel.contexte?.donjon ?? sel.id] ?? ctx.donjon();
  /** Le nom de l'en-tête écrit dans le champ historique (dont les écouteurs enregistrent, nettoient et sauvegardent). */
  const renommerVia = (idChamp) => (_sel, valeur) => {
    const champ = $(idChamp);
    champ.value = valeur;
    champ.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // « Plan JSON » et « Signaler une erreur » sont rares : le bloc n'est posé dans le corps que si le menu l'a demandé.
  let avanceDemande = null; // identifiant de la salle pour laquelle le MJ a ouvert l'avancé
  const ouvrirAvance = (sel, apres) => {
    avanceDemande = sel.id;
    inspecteur.rafraichir();
    $('bloc-avance').open = true;
    apres?.();
  };

  /** La section « Éléments » : les portes, le mobilier et les créatures de la salle, en liste. Pas de « + » ici : le catalogue est à un clic dans les onglets Portes · Mobilier · Créatures du panneau (tiroir sur téléphone). */
  const sectionElements = (sel) => {
    const salle = donjonDe(sel).salles[sel.id];
    const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const rangees = [];
    for (const [genre, cle] of Object.entries(LISTES)) {
      for (const e of salle?.plan?.[cle] ?? []) {
        const [debut, ...suite] = libelleSelection({ genre, element: e }).split(' · ');
        rangees.push({
          nom: majuscule(debut), icone: genre, position: suite.join(' · '), compacte: true,
          choisie: etat.selection && etat.selection.genre === genre && JSON.stringify(etat.selection) === JSON.stringify(descripteur(genre, e)),
          surChoix: () => { etat.selection = descripteur(genre, e); etat.message = ''; ctx.rendre(); },
        });
      }
    }
    return creerSection({
      cle: 'donjon:salle-elements', titre: 'Éléments', compte: String(rangees.length),
      enfants: [rangees.length ? creerListe(rangees) : h('p', { className: 'note', textContent: 'Rien pour l’instant : ajoute des portes, du mobilier ou des créatures depuis le catalogue.' })],
    }).element;
  };

  /** La section « Liaisons » : les salles que les portes et escaliers de celle-ci relient, en liste ; un clic va à la salle liée. */
  const sectionLiaisons = (sel) => {
    const d = donjonDe(sel);
    const rangees = [];
    for (const l of d.liaisons) {
      const ici = l.a.salle === sel.id ? l.a : l.b.salle === sel.id ? l.b : null;
      if (!ici) continue;
      const autre = ici === l.a ? l.b : l.a;
      const voisine = d.salles[autre.salle];
      if (!voisine) continue;
      rangees.push({
        nom: voisine.nom, vide: 'Salle sans nom', icone: 'liaison', compacte: true,
        position: ici.escalier ? `par l’escalier en ${nomCase(ici.x, ici.y)}` : `par la porte ${ici.mur}`,
        titre: `Aller à « ${voisine.nom} »`,
        surChoix: () => ctx.activerSalle(autre.salle),
      });
    }
    if (!rangees.length) return null; // rien à dire : pas de section « Liaisons 0 »
    return creerSection({ cle: 'donjon:salle-liaisons', titre: 'Liaisons', compte: String(rangees.length), enfants: [creerListe(rangees)] }).element;
  };

  inspecteur.enregistrer('salle', {
    titre: (sel) => donjonDe(sel).salles[sel.id]?.nom ?? 'Salle',
    renommer: renommerVia('salle-nom'),
    etiquette: () => '', // l'onglet « Salle » au-dessus porte déjà l'icône et le mot ; la taille et le sol sont dans les sections Forme et dimensions et Apparence
    rendre: (conteneur, sel) => {
      if (avanceDemande !== sel.id) avanceDemande = null;
      const salle = donjonDe(sel).salles[sel.id];
      const p = salle?.plan;
      const mot = (noms, v, defaut) => (v && v !== defaut ? (noms[v] ?? '').toLowerCase() : '');
      // Les aperçus des sections repliées : l'état sans déplier. Description et Éléments, qu'on utilise vraiment, s'ouvrent d'office.
      const apercuTaille = p ? (tailleEnMetres(p.largeur, p.longueur, etat.reglages.echelle) || `${p.largeur} × ${p.longueur} cases`) : '';
      const apercuApparence = p ? [(NOMS_SOLS[p.sol] ?? 'Pierre').toLowerCase(), (NOMS_AMBIANCES[p.ambiance] ?? 'Neutre').toLowerCase(), mot(NOMS_ETATS_SALLE, p.etat, 'neuve'), mot(NOMS_ECLAIRAGES, p.eclairage, 'penombre')].filter(Boolean).join(', ') : '';
      const notes = (salle?.notes ?? '').trim().replace(/\s+/g, ' ');
      const apercuNotes = notes ? (notes.length > 32 ? `${notes.slice(0, 31)}…` : notes) : 'vide';
      // « Au hasard » a sa propre vue (flux aval de l'édition : consignes, tirage, relance) : elle remplace les sections, avec un retour.
      if (hasard.ouverte(sel.id)) { conteneur.append(hasard.vue(sel)); return; }
      conteneur.append(
        section('salle-taille', 'Forme et dimensions', ['bloc-taille'], { repliee: true, apercu: apercuTaille, apercuIcone: p ? svgForme(p.forme || 'rectangle') : '' }),
        section('salle-apparence', 'Apparence', ['bloc-apparence'], { repliee: true, apercu: apercuApparence }),
        section('salle-description', 'Description', ['bloc-description', 'bloc-orphelines']),
        section('salle-notes', 'Notes du MJ', ['bloc-notes'], { repliee: true, apercu: apercuNotes }),
        ...[sectionLiaisons(sel)].filter(Boolean),
        sectionElements(sel),
        section('salle-exemples', 'Exemples', ['bloc-exemples'], { repliee: true }),
        ...(avanceDemande ? [section('salle-avance', 'Avancé', ['bloc-avance'])] : []),
        hasard.ligne(sel));
      // Demandé par le menu « ⋯ » : la section s'ouvre même si le MJ l'avait repliée.
      if (avanceDemande) conteneur.querySelector('[data-cle="donjon:salle-avance"] .p-section-bascule[aria-expanded="false"]')?.click();
    },
    menu: (sel) => [
      { libelle: 'Plan JSON…', icone: 'json', titre: 'Affiche le plan de la salle en JSON, modifiable', executer: () => ouvrirAvance(sel, () => { $('bloc-avance').scrollIntoView?.({ block: 'nearest' }); $('json').focus(); }) },
      { libelle: 'Signaler une erreur de lecture', icone: 'alerte', titre: 'Copie la description, ce qui a été compris et la carte, à coller dans ton message', executer: () => ouvrirAvance(sel, () => $('copier-rapport').click()) },
    ],
    destructives: (sel) => [{
      libelle: 'Supprimer la salle', confirmation: 'Supprimer la salle et ses liaisons ?',
      titre: 'Supprime la salle et ses liaisons',
      executer: () => ctx.salles.supprimer(sel.id),
    }],
  });

  inspecteur.enregistrer('donjon', {
    titre: (sel) => donjonDe(sel).nom,
    renommer: renommerVia('donjon-nom'),
    resume: (sel) => {
      const d = donjonDe(sel);
      const salles = Object.keys(d.salles).length, persos = (d.personnages || []).length;
      return `${pluriel(salles, 'salle', 'salles')} · ${persos ? pluriel(persos, 'personnage', 'personnages') : 'aucun personnage'}`;
    },
    rendre: (conteneur) => conteneur.append(
      section('donjon-personnages', 'Personnages', ['bloc-personnages'], { compte }),
      section('donjon-echelle', 'Échelle', ['bloc-reglages'], { repliee: true })),
    menu: () => [
      { libelle: 'Exporter', icone: 'exporter', titre: 'Enregistre le donjon entier (salles, notes, liaisons, éléments cachés)', executer: () => ctx.menu.exporter() },
      { libelle: 'Imprimer', icone: 'fiche', titre: 'Plans de ce donjon à l’échelle des figurines, version MJ ou joueurs', executer: () => { ctx.sauvegarder(); location.href = 'impression.html'; } },
      { libelle: 'Copier', icone: 'copier', titre: 'Copie le donjon entier, à coller dans un message. Attention : les notes et les éléments cachés sont dedans.', executer: () => ctx.menu.copierDonjon() },
    ],
    destructives: () => [{
      libelle: 'Supprimer ce donjon', confirmation: ctx.menu.annonceSuppression(),
      executer: () => ctx.menu.supprimerDonjon(),
    }],
  });

  for (const type of TYPES_ELEMENT) {
    inspecteur.enregistrer(type, {
      titre: () => ctx.bulle.titre(),
      etiquette: () => ctx.bulle.etiquette(),
      resume: () => ctx.bulle.resume(),
      rendre: (conteneur) => ctx.bulle.rendreDans(conteneur),
      actions: () => ctx.bulle.actions(),
      menu: () => ctx.bulle.menu(),
      destructives: () => ctx.bulle.destructives(),
    });
  }
}
