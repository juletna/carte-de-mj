/**
 * Sauvegarde complète (bouton « Sauvegarde » de la barre commune, sur toutes les pages) : un clic pour tout sauvegarder dans un .zip,
 * un clic pour tout restaurer. Le dialogue est construit à la demande par `ouvrirSauvegarde()`.
 * La logique (zip, validation, remplacement sans perte) est dans sauvegarde.js et zip.js ; ici, seulement le DOM,
 * le localStorage, IndexedDB et le téléchargement. Avant de remplacer quoi que ce soit, l'état actuel est téléchargé.
 * La section « Dossier de travail » (choisir, reconnecter, dissocier, trancher un conflit) pilote js/dossier-travail.js.
 */
import { $, h, deuxTemps, fichierChoisi } from '../dom.js';
import { icone } from '../icones.js';
import { lireZip, creerZip } from '../zip.js';
import { contenuSauvegarde, lireSauvegarde, entreesImages, resumeSauvegarde, restaurer, bibliothequeManquante, nomSauvegarde, nomAvantRestauration, TAILLE_MAX_SAUVEGARDE } from '../sauvegarde.js';
import { listerImages, remplacerToutesImages } from '../bibliotheque/images.js';
import { validerCatalogue } from '../bibliotheque/catalogue.js';
import { lireFichierBibliotheque } from '../bibliotheque/source.js';
import { dossierDisponible, etatDossier, surEtatDossier, choisirDossier, reconnecter, dissocier, resoudreConflit } from '../dossier-travail.js';

/** Propose le téléchargement d'un fichier binaire (même méthode que stockage.js). */
function proposerZip(octets, nom) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([octets], { type: 'application/zip' }));
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Les images importées ; si IndexedDB est indisponible, une liste vide et un avertissement (le reste se sauvegarde quand même). */
async function imagesDuNavigateur() {
  try { return { images: await listerImages(), avertissement: '' }; } catch (e) { return { images: [], avertissement: `Images importées non incluses : ${e.message}.` }; }
}

/** Les ids du catalogue de la bibliothèque (site ou dossier de travail), ou null s'il ne se charge pas (on ne bloque jamais pour ça). */
async function idsDuCatalogue() {
  try {
    const r = await lireFichierBibliotheque('catalogue.json');
    return r.statut === 'ok' ? validerCatalogue(JSON.parse(r.texte)).cartes.map((c) => c.id) : null;
  } catch { return null; }
}

/** La section « Dossier de travail » : état, boutons, choix en cas de conflit. Se met à jour seule quand l'état change. */
function sectionDossier() {
  const etat = h('p', { id: 'dossier-etat', className: 'note', role: 'status' });
  const erreur = h('p', { id: 'dossier-erreur', className: 'note erreur', role: 'alert', hidden: true });
  const conflitTexte = h('p', { id: 'dossier-conflit', className: 'note', hidden: true });
  const choisir = h('button', { type: 'button', className: 'btn', title: 'Choisis un dossier de ton ordinateur : l\'appli y recopie tout, en direct' }, icone('importer'), 'Choisir un dossier…');
  const reconnecterBtn = h('button', { type: 'button', className: 'btn btn-primaire', title: 'Redonne à l\'appli le droit d\'écrire dans le dossier' }, 'Reconnecter');
  const dissocierBtn = h('button', { type: 'button', className: 'btn btn-discret', title: 'Oublie le dossier ; ses fichiers restent où ils sont' }, 'Dissocier');
  const prendre = h('button', { type: 'button', className: 'btn btn-danger', title: 'Remplace ce navigateur par le contenu du dossier (une sauvegarde .zip de ce navigateur est téléchargée d\'abord)' }, 'Prendre le dossier');
  const garder = h('button', { type: 'button', className: 'btn', title: 'Remplace le contenu du dossier par celui de ce navigateur (l’ancien contenu est copié avant dans copies/)' }, 'Garder ce navigateur');
  const actions = h('div', { className: 'actions' }, choisir, reconnecterBtn, dissocierBtn);
  const actionsConflit = h('div', { className: 'actions', hidden: true }, prendre, garder);
  const racine = h('section', { className: 'dossier-travail', 'aria-labelledby': 'dossier-titre' },
    h('h3', { id: 'dossier-titre', textContent: 'Dossier de travail' }),
    h('p', { className: 'note', textContent: 'Choisis un dossier une fois : l\'appli y recopie tout en direct (et y lit la bibliothèque de cartes). Dans un dossier Google Drive ou iCloud, deux ordinateurs restent à jour. N\'ouvre pas l\'appli sur deux ordinateurs en même temps.' }),
    etat, erreur, conflitTexte, actionsConflit, actions);

  const afficher = (e) => {
    const dispo = dossierDisponible();
    etat.textContent = e.texte;
    choisir.hidden = !dispo || ['connecte', 'synchronisation', 'a-reconnecter', 'conflit'].includes(e.etat);
    choisir.className = `btn${e.etat === 'aucun' || e.etat === 'erreur' ? ' btn-primaire' : ''}`;
    reconnecterBtn.hidden = e.etat !== 'a-reconnecter';
    dissocierBtn.hidden = !['connecte', 'a-reconnecter', 'conflit', 'erreur'].includes(e.etat);
    actions.hidden = choisir.hidden && reconnecterBtn.hidden && dissocierBtn.hidden;
    const c = e.etat === 'conflit' ? e.conflit : null;
    actionsConflit.hidden = !c;
    conflitTexte.hidden = !c;
    if (c) conflitTexte.textContent = `Dans le dossier : ${c.dossier}${c.modifie ? ` (modifié le ${c.modifie.slice(0, 10)})` : ''}. Dans ce navigateur : ${c.navigateur}. Prendre le dossier remplace ce navigateur, après avoir téléchargé son état dans un .zip ; garder ce navigateur remplace le contenu du dossier, après l’avoir copié dans copies/.`;
  };
  const echec = (err) => { erreur.hidden = false; erreur.textContent = `Dossier de travail : ${err.message}`; };
  const agir = (bouton, travail, recharger = false) => bouton.addEventListener('click', async () => {
    erreur.hidden = true;
    bouton.disabled = true;
    try { const ok = await travail(); if (recharger && ok !== false && ['connecte', 'aucun'].includes(etatDossier().etat)) setTimeout(() => location.reload(), 600); } catch (err) { echec(err); } finally { bouton.disabled = false; }
  });
  // La bibliothèque et les images changent de source avec le dossier : on recharge la page pour que tout la relise.
  agir(choisir, choisirDossier, true);
  agir(reconnecterBtn, reconnecter, true);
  agir(dissocierBtn, dissocier, true);
  agir(prendre, () => resoudreConflit('dossier'));
  agir(garder, () => resoudreConflit('navigateur'), true);
  surEtatDossier(afficher);
  afficher(etatDossier());
  return racine;
}

/** Ouvre le dialogue de sauvegarde (construit au premier appel). */
export function ouvrirSauvegarde() {
  let dialogue = $('dialogue-sauvegarde');
  if (!dialogue) {
    dialogue = h('dialog', { id: 'dialogue-sauvegarde', className: 'dialogue-sauvegarde', 'aria-labelledby': 'sauvegarde-titre' },
      h('h2', { id: 'sauvegarde-titre', textContent: 'Sauvegarde complète' }),
      h('p', { className: 'note', textContent: 'Un seul fichier pour tout garder ou tout retrouver : donjons, personnages, mondes, modèles, parties, réglages et images importées. Avec un dossier de travail (plus bas), le .zip ne sert plus que pour passer à un autre navigateur.' }),
      h('div', { className: 'actions' },
        h('button', { id: 'sauvegarder-tout', type: 'button', className: 'btn btn-primaire', title: 'Télécharge un fichier .zip' }, icone('sauvegarde'), 'Tout sauvegarder'),
        h('label', { className: 'btn', title: 'Remplace tout ce que ce navigateur garde par le contenu d\'une sauvegarde .zip' }, icone('importer'), 'Tout restaurer… ',
          h('input', { id: 'restaurer', type: 'file', accept: '.zip,application/zip', hidden: true }))),
      h('p', { id: 'restaurer-detail', className: 'note', hidden: true }),
      h('div', { className: 'actions' }, h('button', { id: 'restaurer-confirmer', type: 'button', className: 'btn btn-danger', hidden: true })),
      h('p', { id: 'sauvegarde-etat', className: 'note', role: 'status', hidden: true }),
      h('p', { id: 'sauvegarde-erreur', className: 'note erreur', role: 'alert', hidden: true }),
      sectionDossier(),
      h('div', { className: 'actions' }, h('button', { type: 'button', className: 'btn btn-discret', textContent: 'Fermer', onclick: () => dialogue.close() })));
    document.body.append(dialogue);
    dialogue.addEventListener('click', (e) => { if (e.target === dialogue) dialogue.close(); });
    brancherSauvegarde();
  }
  if (!dialogue.open) dialogue.showModal();
}

function brancherSauvegarde() {
  const zone = $('sauvegarde-etat'), erreur = $('sauvegarde-erreur'), detail = $('restaurer-detail'), confirmer = $('restaurer-confirmer');
  let lue = null; // la sauvegarde choisie, en attente de confirmation
  const dire = (texte, erreurs = []) => {
    zone.hidden = !texte; zone.textContent = texte || '';
    erreur.hidden = erreurs.length === 0; erreur.textContent = erreurs.join(' · ');
  };
  const annuler = () => { lue = null; detail.hidden = true; confirmer.hidden = true; };

  $('sauvegarder-tout').addEventListener('click', async () => {
    annuler();
    try {
      const { images, avertissement } = await imagesDuNavigateur();
      const maintenant = new Date();
      const contenu = await contenuSauvegarde({ stock: localStorage, images, maintenant });
      proposerZip(creerZip(contenu.fichiers), nomSauvegarde(maintenant));
      dire(`Sauvegarde téléchargée : ${resumeSauvegarde(contenu.manifeste)}.${avertissement ? ` ${avertissement}` : ''}`);
    } catch (e) { dire('', [`Sauvegarde impossible : ${e.message}`]); }
  });

  $('restaurer').addEventListener('change', async (e) => {
    const fichier = fichierChoisi(e);
    annuler();
    if (!fichier) return;
    try {
      if (fichier.size > TAILLE_MAX_SAUVEGARDE) throw new Error('fichier trop volumineux (500 Mo au plus)');
      lue = lireSauvegarde(await lireZip(new Uint8Array(await fichier.arrayBuffer())));
    } catch (err) { dire('', [`Restauration refusée : ${err.message}`]); return; }
    const quand = lue.manifeste.cree ? ` faite le ${lue.manifeste.cree.slice(0, 10)}` : '';
    dire('', lue.avertissements);
    detail.textContent = `Cette sauvegarde${quand} contient : ${resumeSauvegarde(lue.manifeste)}. « Tout remplacer » efface ce que ce navigateur garde aujourd’hui (donjons, personnages, mondes, modèles, parties, réglages, images importées) et le remplace par cela. Une sauvegarde de l’état actuel est téléchargée d’abord. Ferme avant les autres onglets de Carte de MJ (Présentation, Fiche) : ils pourraient réécrire leurs anciennes données.`;
    detail.hidden = false;
    confirmer.hidden = false;
  });

  deuxTemps(confirmer, 'Tout remplacer', 'Confirmer', async () => {
    const choisie = lue;
    annuler();
    if (!choisie) return;
    try {
      const { images } = await imagesDuNavigateur();
      const maintenant = new Date();
      // 1. Filet de sécurité : l'état actuel part en téléchargement avant tout remplacement.
      const avant = await contenuSauvegarde({ stock: localStorage, images, maintenant });
      proposerZip(creerZip(avant.fichiers), nomAvantRestauration(maintenant));
      // 2. localStorage (remis tel quel si une écriture échoue), puis les images (une transaction : tout ou rien).
      const r = restaurer({ manifeste: choisie.manifeste, stock: localStorage });
      if (!r.ok) { dire('', [r.erreur]); return; }
      if (choisie.images.length || images.length) {
        try { await remplacerToutesImages(entreesImages(choisie)); } catch (err) {
          restaurer({ manifeste: avant.manifeste, stock: localStorage });
          dire('', [`Images non restaurées (${err.message}) ; le reste a été remis comme avant.`]);
          return;
        }
      }
      // 3. Images de la bibliothèque citées mais absentes du disque : à signaler, sans bloquer.
      const catalogue = await idsDuCatalogue();
      const manquantes = catalogue ? bibliothequeManquante(choisie.manifeste.bibliotheque, catalogue) : [];
      const notes = [choisie.avertissements.join(' · '), manquantes.length ? `${manquantes.length} image(s) de la bibliothèque citée(s) sont absentes du dossier bibliotheque/ : ${manquantes.slice(0, 5).join(', ')}.` : ''].filter(Boolean);
      dire(`Tout est restauré : ${resumeSauvegarde(choisie.manifeste)}. La page se recharge… ${notes.join(' ')}`);
      setTimeout(() => location.reload(), notes.length ? 4000 : 1800);
    } catch (err) { dire('', [`Restauration impossible : ${err.message}`]); }
  });
}
