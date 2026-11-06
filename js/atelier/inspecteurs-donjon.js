/**
 * Les inspecteurs du côté Donjon : salle, donjon, et les éléments de la carte (porte, objet, creature, pion).
 *
 * Les champs de ces panneaux existent depuis toujours dans donjon.html (`#reserve`) et leurs écouteurs sont posés par les modules de
 * js/mj/ au démarrage : plutôt que de les recréer, l'inspecteur y POSE les blocs voulus (ce sont les mêmes nœuds, ils gardent leur
 * valeur, leur focus et leurs écouteurs) et les reprend dans la réserve avant chaque effacement (`inspecteur.surEffacement`), si bien
 * qu'ils restent toujours dans la page (`$('description')` répond même quand un autre type est affiché).
 *
 *   salle   le nom, la description (dictée, « Compris »), les liaisons orphelines, les notes, la forme et l'ambiance, les exemples,
 *           l'avancé (plan JSON, signaler une erreur). « ⋯ » : supprimer la salle.
 *   donjon  le nom, les salles (miniature), les personnages, l'affichage (échelle, thème, détails, grille, relief, pénombre, flammes,
 *           plein écran). Actions : exporter, imprimer, copier. « ⋯ » : supprimer le donjon.
 *   porte, objet, creature, pion   js/mj/bulle.js (relier, créer la salle derrière, cacher, aspect). « ⋯ » : délier, supprimer.
 */
import { $ } from '../dom.js';

const BLOCS_SALLE = ['bloc-salle-nom', 'bloc-description', 'bloc-orphelines', 'bloc-notes', 'bloc-forme', 'bloc-exemples', 'bloc-avance'];
const BLOCS_DONJON = ['bloc-donjon-nom', 'bloc-plan', 'bloc-personnages', 'bloc-reglages'];
const TYPES_ELEMENT = ['porte', 'objet', 'creature', 'pion'];

export function enregistrerInspecteursDonjon(coquille, ctx) {
  const { etat } = ctx;
  const { inspecteur } = coquille;
  const reserve = $('reserve');
  const blocs = [...BLOCS_SALLE, ...BLOCS_DONJON].map((id) => $(id));

  // Avant chaque effacement du corps de l'inspecteur, les blocs retournent dans la réserve (hors écran, mais dans la page).
  inspecteur.surEffacement(() => { for (const b of blocs) if (b.parentElement !== reserve) reserve.append(b); });
  const poser = (conteneur, ids) => conteneur.append(...ids.map((id) => $(id)));

  const donjonDe = (sel) => etat.donjons[sel.contexte?.donjon ?? sel.id] ?? ctx.donjon();

  inspecteur.enregistrer('salle', {
    titre: (sel) => donjonDe(sel).salles[sel.id]?.nom ?? 'Salle',
    rendre: (conteneur) => poser(conteneur, BLOCS_SALLE),
    destructives: (sel) => [{
      libelle: 'Supprimer cette salle', confirmation: 'Supprimer la salle et ses liaisons ?',
      titre: 'Supprime la salle et ses liaisons',
      executer: () => ctx.salles.supprimer(sel.id),
    }],
  });

  inspecteur.enregistrer('donjon', {
    titre: (sel) => `Donjon · ${donjonDe(sel).nom}`,
    rendre: (conteneur) => {
      poser(conteneur, BLOCS_DONJON);
      ctx.salles.majMiniCarte(); // la miniature se redessine à la largeur du panneau
      $('titre-plan').textContent = `Salles · ${Object.keys(ctx.donjon().salles).length}`;
    },
    actions: () => [
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
      rendre: (conteneur) => ctx.bulle.rendreDans(conteneur),
      actions: () => ctx.bulle.actions(),
      destructives: () => ctx.bulle.destructives(),
    });
  }
}
