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
 *   salle   « 6 × 8 cases · pierre » ; description (dictée, « Compris »), liaisons orphelines, forme / sol / ambiance, notes, exemples.
 *           « ⋯ » : plan JSON, signaler une erreur de lecture, — , supprimer la salle.
 *   donjon  « 3 salles · 2 personnages » ; les personnages (liste, ajouter, au hasard) et, repliés, les réglages d'affichage.
 *           « ⋯ » : exporter, imprimer, copier, — , supprimer le donjon. (L'arbre liste les salles ; la vue d'ensemble est celle du donjon.)
 *   porte, objet, creature, pion   js/mj/bulle.js (relier, créer la salle derrière, cacher, aspect). « ⋯ » : fermer, délier, supprimer.
 */
import { $ } from '../dom.js';
import { NOMS_SOLS } from '../schema.js';
import { pluriel } from '../format.js';
import { resumeTaille } from './dimensions.js';
import { creerSection } from './section.js';

const BLOCS_SALLE = ['bloc-description', 'bloc-orphelines', 'bloc-forme', 'bloc-notes', 'bloc-exemples'];
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

  inspecteur.enregistrer('salle', {
    titre: (sel) => donjonDe(sel).salles[sel.id]?.nom ?? 'Salle',
    renommer: renommerVia('salle-nom'),
    resume: (sel) => {
      const p = donjonDe(sel).salles[sel.id]?.plan;
      return p ? `${resumeTaille(p.largeur, p.longueur, etat.reglages.echelle)} · ${(NOMS_SOLS[p.sol] ?? 'Pierre').toLowerCase()}` : '';
    },
    rendre: (conteneur, sel) => {
      if (avanceDemande !== sel.id) avanceDemande = null;
      conteneur.append(
        section('salle-description', 'Description', ['bloc-description', 'bloc-orphelines']),
        section('salle-notes', 'Notes du MJ', ['bloc-notes']),
        section('salle-forme', 'Forme et ambiance', ['bloc-forme']),
        section('salle-exemples', 'Exemples', ['bloc-exemples'], { repliee: true }),
        ...(avanceDemande ? [section('salle-avance', 'Avancé', ['bloc-avance'])] : []));
      // Demandé par le menu « ⋯ » : la section s'ouvre même si le MJ l'avait repliée.
      if (avanceDemande) conteneur.querySelector('[data-cle="donjon:salle-avance"] .p-section-bascule[aria-expanded="false"]')?.click();
    },
    menu: (sel) => [
      { libelle: 'Plan JSON…', icone: 'copier', titre: 'Affiche le plan de la salle en JSON, modifiable', executer: () => ouvrirAvance(sel, () => { $('bloc-avance').scrollIntoView?.({ block: 'nearest' }); $('json').focus(); }) },
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
      section('donjon-affichage', 'Affichage', ['bloc-reglages'], { repliee: true })),
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
