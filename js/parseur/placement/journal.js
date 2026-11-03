/**
 * Placement, le journal : les phrases qui disent au MJ où chaque chose a été posée, et ce qui n'a pas trouvé place.
 * Du texte seulement : rien ici ne modifie le plan.
 */
import { definition, nomAffiche } from '../lexique.js';

const LIBELLES = {
  fond: 'au fond', entree: "à l'entrée", centre: 'au centre', grille: 'répartition régulière',
  ligne: 'en ligne', cercle: 'en cercle', cotes: 'de chaque côté', coins: 'dans les coins',
  coin: 'dans un coin', 'coin-relatif': 'dans un coin', perimetre: 'le long des murs',
  aleatoire: 'éparpillés', lateral: 'sur le côté',
};
const LIBELLES_REL = { devant: 'devant', derriere: 'derrière', cote: 'à côté de', autour: 'autour de', flancs: 'de chaque côté de', face: 'en face de' };

/** La ligne des portes (« 2 portes : porte (mur sud), ... »), ou null s'il n'y en a pas. */
export function lignePortes(portes, implicite) {
  if (!portes.length) return null;
  const resume = portes.map((p) => `${p.type} (mur ${p.mur})`).join(', ');
  return `${portes.length} porte${portes.length > 1 ? 's' : ''} : ${resume}${implicite ? ' — ajoutée car citée comme repère' : ''}`;
}

/**
 * La ligne d'une intention posée : combien, quoi, où, et combien n'ont pas trouvé de place.
 * `zone` est la disposition retenue (celle de la phrase, sinon celle de l'objet) ; `poses` ce qui a été posé ;
 * `l` la largeur voulue (la taille de la première pose prévaut pour une créature).
 */
export function ligneObjet(it, zone, poses, l, plan) {
  const pos = it.position;
  const def = definition(it.type);
  let ou = LIBELLES[zone] || '';
  if (zone === 'mur') ou = `contre le mur ${pos.mur}`;
  if (zone === 'cases') ou = pos.libelle;
  if (zone === 'relation') ou = `${LIBELLES_REL[pos.relation]} ${nomAffiche(pos.cible.type)}`;
  if (zone === 'relation' && pos.cible.genre === 'porte' && pos.cible.mur) {
    ou += ` du mur ${pos.cible.mur}`;
    if (!plan.portes.some((p) => p.mur === pos.cible.mur)) {
      const reprise = plan.portes.find((p) => p.type === pos.cible.type) || plan.portes[0];
      if (reprise) ou += ` ⚠ pas de porte au mur ${pos.cible.mur} : repère pris sur la porte du mur ${reprise.mur}`;
    }
  }
  if (!pos.zone) ou += ' (par défaut)';
  let nom = nomAffiche(it.type, it.n);
  if (it.couleur) nom += ` ${it.couleur}${it.n > 1 && !/s$/.test(it.couleur) ? 's' : ''}`;
  if (it.camp && it.camp !== def.camp) nom += it.camp === 'monstre' ? ' (hostile)' : ' (allié)';
  const cotePose = poses[0]?.taille ?? l; // « de D1 à E2 » impose une autre taille que celle par défaut
  if (def.genre === 'creature' && cotePose > 1) nom += ` (${cotePose}×${cotePose} cases)`;
  let ligne = `${it.n} ${nom} — ${ou}`;
  if (poses.length < it.n) ligne += ` ⚠ ${it.n - poses.length} sans place`;
  return ligne;
}

/** La ligne d'un élément resté sans place sur le sol d'une forme découpée. */
export function ligneSansPlace(type) {
  return `⚠ ${nomAffiche(type)} : aucune place sur le sol de cette forme`;
}
