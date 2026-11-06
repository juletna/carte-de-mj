/**
 * La section « Au hasard » de l'inspecteur de la salle : tire au sort le contenu (monstres, coffres, pièges, mobilier) de LA salle
 * affichée, et sa forme si on le demande (`genererSalle`, js/generateur.js, pur). Le geste est à un clic sans déplier : l'action du
 * bandeau (le dé) génère avec les réglages courants.
 *
 *   const sectionAuHasard = creerSectionAuHasard(ctx);   // `ctx` : celui de main-mj.js (etat, donjon, salle, modifierPlan, annoncerCarte, activerSalle, salles, coquille)
 *   conteneur.append(sectionAuHasard(sel));
 *
 * Tout est automatique par défaut : un champ vide (nombre de monstres, de coffres, de pièges), la famille « Auto », la forme et les
 * dimensions tirées ; on ne renseigne un réglage que pour l'imposer. Deux modes (voir `genererSalle`) : « Remplir » garde la forme, les
 * dimensions et TOUTES les portes et escaliers ; « Nouvelle forme et dimensions » n'est offert qu'à une salle sans liaison, et n'est le
 * défaut que pour une salle vide (une salle déjà soignée garde sa forme tant qu'on n'a pas activé la case). Le texte tiré passe par `ctx.modifierPlan` (le chemin de toute
 * modification du plan : description, carte, sauvegarde, historique). Une salle qui avait déjà un contenu est annulable (« Annuler »).
 * Les réglages et le dernier tirage vivent le temps de la page : rien n'est enregistré.
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';
import { creerSection } from './section.js';
import * as modele from '../donjon.js';
import { pluriel } from '../format.js';
import { FAMILLES, BORNES_SALLE, famillesPresentes, genererSalle, normaliserOptionsSalle, estNomParDefaut, salleAUnContenu, salleReliee, typesDesAutresSalles } from '../generateur.js';

const CHAMPS = [['monstres', 'Monstres'], ['coffres', 'Coffres'], ['pieges', 'Pièges']];

export function creerSectionAuHasard(ctx) {
  // Gardés le temps de la page.
  // monstres, coffres, pièges : null = automatique ; nouvelleForme : null = pas choisi (voir `formeVoulue`).
  const reglages = { famille: '', monstres: null, coffres: null, pieges: null, nouvelleForme: null };
  /** Le dernier tirage appliqué : sert à « Relancer » et à « Tirage N », tant que la description est encore celle qu'il a écrite. */
  let dernier = null;

  const donjon = () => ctx.donjon();

  /** Une nouvelle forme est-elle permise à cette salle ? (sans liaison, sans escalier, portes ordinaires : `genererSalle` revérifie) */
  const formePermise = (d, id) => {
    const plan = d.salles[id]?.plan;
    if (!plan || salleReliee(d, id) || (plan.objets || []).some((o) => o.type === 'escalier')) return false;
    return (plan.portes || []).every((p) => p.type === 'porte' || p.type === 'arche');
  };
  /** Le mode effectif : le choix du MJ s'il y en a un ; sinon « nouvelle forme » pour une salle vide ou déjà tirée ici, « remplir » pour une salle soignée. */
  const formeVoulue = (d, id) => {
    if (!formePermise(d, id)) return false;
    if (reglages.nouvelleForme !== null) return reglages.nouvelleForme;
    const s = d.salles[id];
    return (dernier && dernier.salle === id && s.texte === dernier.texte) || !salleAUnContenu(s);
  };

  /** Applique un tirage à la salle `id` (affichée d'abord). `relancer` : remplace le tirage précédent au lieu de s'empiler dessus. */
  function generer(id, relancer = false) {
    if (ctx.salle().id !== id) ctx.activerSalle(id);
    const d = donjon();
    const s = d.salles[id];
    if (!s) return;
    const nouvelleForme = formeVoulue(d, id); // avant l'éventuel retour en arrière d'une relance
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
      plan: salle.plan, reliee, formes: true, nouvelleForme,
      familles: reglages.famille ? [reglages.famille] : [], typesPresents: typesDesAutresSalles(d, id),
      monstres: reglages.monstres, coffres: reglages.coffres, pieges: reglages.pieges,
    };
    const r = genererSalle(options);
    if (!r.ok) { ctx.annoncerCarte(r.refus ?? 'Rien n’a été tiré.', true); dernier = null; ctx.coquille?.rafraichir({ inspecteur: true }); return; }

    const nomAvant = salle.nom;
    const orphelinesAvant = modele.liaisonsOrphelines(d).length;
    const texteAvant = salle.texte;
    if (estNomParDefaut(salle.nom) && r.nom) { modele.renommerSalle(d, id, r.nom); ctx.salles.majListe(); }
    ctx.modifierPlan(salle.plan, { texte: r.texte, memoire: annulable });
    // Filet de sécurité : une liaison devenue orpheline ne doit jamais survivre à un tirage.
    if (modele.liaisonsOrphelines(d).length > orphelinesAvant) {
      modele.renommerSalle(d, id, nomAvant);
      ctx.modifierPlan(d.salles[id].plan, { texte: texteAvant, memoire: false });
      if (annulable) ctx.historique.pile(d.id, id).pop();
      ctx.salles.majListe();
      ctx.annoncerCarte('Le tirage aurait détaché une porte ou un escalier relié : rien n’a été changé.', true);
      dernier = null;
      ctx.coquille?.rafraichir({ inspecteur: true });
      return;
    }
    dernier = { salle: id, texte: r.texte, graine: r.graine, mode: r.mode, refus: r.refus, resume: r.resume, annulable, nomAvant: nomAvant !== d.salles[id].nom ? nomAvant : null };
    const { monstres, coffres, pieges, reduit } = r.resume;
    ctx.annoncerCarte(`Tirage ${r.graine} : ${pluriel(monstres, 'monstre', 'monstres')}, ${pluriel(coffres, 'coffre', 'coffres')}, ${pluriel(pieges, 'piège', 'pièges')}${reduit ? ' (la salle est trop petite pour tout)' : ''}.${annulable ? ' « Annuler » rétablit la salle.' : ''}`);
    ctx.coquille?.rafraichir({ inspecteur: true });
  }

  return function sectionAuHasard(sel) {
    const d = donjon();
    const s = d.salles[sel.id];
    const reliee = salleReliee(d, sel.id);
    const escalier = (s?.plan?.objets || []).some((o) => o.type === 'escalier');
    const figee = reliee || escalier;
    let activee = formeVoulue(d, sel.id);

    // Famille : « comme le donjon » quand les autres salles en ont, sinon le hasard.
    const presentes = famillesPresentes(typesDesAutresSalles(d, sel.id));
    const famille = h('select', { 'aria-label': 'Type de monstres' },
      h('option', { value: '', textContent: presentes.length ? `Auto · comme le donjon (${presentes.map((f) => FAMILLES[f].libelle).join(', ')})` : 'Auto' }),
      ...Object.entries(FAMILLES).map(([cle, f]) => h('option', { value: cle, textContent: f.libelle })));
    famille.value = reglages.famille;
    famille.addEventListener('change', () => { reglages.famille = famille.value; });

    const champs = h('div', { className: 'hasard-salle-champs' }, ...CHAMPS.map(([cle, libelle]) => {
      const [, min, max] = BORNES_SALLE[cle];
      const entree = h('input', { type: 'number', inputMode: 'numeric', min: String(min), max: String(max), step: '1', placeholder: 'Auto', value: reglages[cle] === null ? '' : String(reglages[cle]), 'aria-label': `${libelle} (de ${min} à ${max}, vide : automatique)` });
      // Vide = automatique ; un nombre est imposé (0 compris) ; vider le champ le remet en automatique.
      entree.addEventListener('change', () => { reglages[cle] = normaliserOptionsSalle({ [cle]: entree.value })[cle]; entree.value = reglages[cle] === null ? '' : String(reglages[cle]); });
      return h('label', { className: 'hasard-salle-champ', title: `Vide : automatique. Sinon de ${min} à ${max}` }, h('span', { className: 'hasard-salle-etiquette', textContent: libelle }), h('span', { className: 'champ-num' }, entree));
    }));

    const forme = h('button', {
      type: 'button', className: 'rang-champ rang-interrupteur', role: 'switch', 'aria-checked': String(activee), disabled: figee,
      title: figee ? 'Impossible : la salle a des portes ou des escaliers reliés' : 'Tire aussi une nouvelle forme et de nouvelles dimensions',
    },
    h('span', { className: 'rang-aperce rang-icone' }, icone('salle')),
    h('span', { className: 'rang-texte' }, h('span', { className: 'rang-valeur', textContent: 'Nouvelle forme et dimensions' })),
    h('span', { className: 'interrupteur', 'aria-hidden': 'true' }));
    const texteAide = () => (reliee ? 'Cette salle a des portes reliées à d’autres salles : sa forme, ses dimensions et ses portes restent, seul son contenu change.'
      : escalier ? 'Cette salle a un escalier : sa forme, ses dimensions et ses portes restent, seul son contenu change.'
        : activee ? 'La forme et les dimensions sont tirées aussi ; les portes gardent leur mur. Décoche pour les garder.'
          : 'La forme, les dimensions et les portes restent : seul le contenu change.');
    const aide = h('p', { className: 'note', textContent: texteAide() });
    forme.addEventListener('click', () => {
      activee = !activee;
      reglages.nouvelleForme = activee;
      forme.setAttribute('aria-checked', String(activee));
      aide.textContent = texteAide();
    });
    const noteAuto = h('p', { className: 'note', textContent: 'Vide = automatique : le tirage choisit.' });

    const generee = dernier && dernier.salle === sel.id && s?.texte === dernier.texte ? dernier : null;
    const corps = [
      h('label', { className: 'hasard-salle-champ' }, h('span', { className: 'hasard-salle-etiquette', textContent: 'Type de monstres' }), famille),
      champs, noteAuto, forme, aide,
    ];
    const bouton = h('button', { type: 'button', className: 'btn' }, icone('de'), 'Générer');
    bouton.addEventListener('click', () => generer(sel.id));
    corps.push(h('div', { className: 'actions' }, bouton));
    if (generee) {
      const relancer = h('button', { type: 'button', className: 'btn btn-discret', title: 'Remplace ce tirage par un autre' }, 'Relancer');
      relancer.addEventListener('click', () => generer(sel.id, true));
      corps.push(h('p', { className: 'note', role: 'status', textContent: `Tirage ${generee.graine}${generee.mode === 'nouvelle' ? ' · nouvelle forme' : ''}${generee.resume.reduit ? ' · la salle est trop petite pour tout' : ''}${generee.refus ? ` · ${generee.refus}` : ''}` }));
      corps.push(h('div', { className: 'actions' }, relancer));
    }

    return creerSection({
      cle: 'donjon:salle-hasard', titre: 'Au hasard', repliee: true,
      action: { libelle: 'Générer au hasard', icone: 'de', executer: () => generer(sel.id) },
      enfants: corps,
    }).element;
  };
}
