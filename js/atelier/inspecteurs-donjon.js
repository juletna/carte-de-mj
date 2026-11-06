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
  inspecteur.surEffacement(() => { for (const b of blocs) if (b.parentElement !== reserve) reserve.append(b); });
  const poser = (conteneur, ids) => conteneur.append(...ids.map((id) => $(id)));

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
      return p ? `${p.largeur} × ${p.longueur} cases · ${(NOMS_SOLS[p.sol] ?? 'Pierre').toLowerCase()}` : '';
    },
    rendre: (conteneur, sel) => {
      if (avanceDemande !== sel.id) avanceDemande = null;
      poser(conteneur, avanceDemande ? [...BLOCS_SALLE, 'bloc-avance'] : BLOCS_SALLE);
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
    rendre: (conteneur) => poser(conteneur, BLOCS_DONJON),
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
