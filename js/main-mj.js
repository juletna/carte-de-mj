/**
 * Point d'entrée de la vue MJ : relie la saisie, le parseur, le rendu,
 * les réglages et la sauvegarde.
 */
import { analyser } from './parseur/index.js';
import { validerPlan } from './schema.js';
import { dessiner } from './rendu/moteur.js';
import { creerMicro, voixDisponible } from './voix.js';
import * as stockage from './stockage.js';
import { rapport } from './rapport.js';
import { activerDeplacement } from './deplacement.js';
import { decrire } from './parseur/decrire.js';

const $ = (id) => document.getElementById(id);

const EXEMPLES = [
  'Grande pièce de 4 m par 12, quatre piliers, deux coffres au fond de la salle, une statue immobile devant une porte',
  'Salle du trône de 12 mètres sur 15, un trône au fond, deux statues de chaque côté du trône, six colonnes, des torches le long des murs',
  'Taverne de 8 par 6 cases, sol en bois, trois tables au centre, une bibliothèque contre le mur est, deux lits à gauche, un tonneau au fond à droite',
  'Salle de 12 m sur 15, une porte au sud, les personnages à l’entrée, un jeune dragon rouge au fond, deux tonneaux dans les coins, quatre gobelins devant le dragon, deux squelettes de chaque côté de la porte',
  'Salle carrée de 9 m, huit piliers en cercle, un autel au centre, une porte à l’ouest',
  'Petite crypte avec un sarcophage au centre, des débris et une herse au nord',
  'Salle de 6 cases sur 6, une porte au nord, une porte à l’est, un escalier dans le coin sud-ouest, trois tonneaux dans les coins, une fosse au centre',
];

// --- État de l'application ----------------------------------------------------
const sauve = stockage.charger();
const etat = {
  texte: sauve?.texte ?? EXEMPLES[0],
  plan: null,
  retour: { compris: [], ignores: [] }, // dernier « compris / non compris », pour le rapport
  reglages: { echelle: 1.5, taille: 48, grille: true, ...(sauve?.reglages || {}) },
};

// --- Rendu --------------------------------------------------------------------
function rendre() {
  dessiner($('carte'), etat.plan, { taille: etat.reglages.taille, grille: etat.reglages.grille });
  majCarteRef();
  $('annuler').hidden = historique.length === 0;
  if (document.activeElement !== $('json')) $('json').value = JSON.stringify(etat.plan, null, 2);
  stockage.sauver(etat);
}

/** Analyse le texte et met à jour la carte et le retour « compris / ignoré ». */
function generer() {
  const { plan, compris, ignores } = analyser(etat.texte, { echelle: etat.reglages.echelle });
  etat.plan = plan;
  etat.retour = { compris, ignores };
  $('compris').replaceChildren(...compris.map((ligne) => Object.assign(document.createElement('li'), { textContent: ligne })));
  const zoneIgnores = $('ignores');
  zoneIgnores.hidden = ignores.length === 0;
  zoneIgnores.textContent = ignores.length ? `Mots non compris : ${ignores.join(', ')}` : '';
  rendre();
}

/**
 * Ancienne description, pour pouvoir annuler : déplacer un élément réécrit
 * tout le texte. La pile est vidée dès que le MJ reprend la main sur le texte.
 */
const historique = [];
function memoriser() {
  historique.push(etat.texte);
  if (historique.length > 100) historique.shift();
}

/** Remplace la description et régénère tout : le texte reste la seule référence. */
function changerTexte(texte) {
  etat.texte = texte;
  $('description').value = texte;
  generer();
}

// Mise à jour pendant la frappe, avec un court délai pour rester fluide.
let minuterie;
function genererBientot() {
  clearTimeout(minuterie);
  minuterie = setTimeout(generer, 200);
}

// --- Saisie -------------------------------------------------------------------
$('description').value = etat.texte;
$('description').addEventListener('input', (e) => { historique.length = 0; etat.texte = e.target.value; genererBientot(); });
$('effacer').addEventListener('click', () => { historique.length = 0; changerTexte(''); $('description').focus(); });

$('exemples').replaceChildren(...EXEMPLES.map((ex) => {
  const li = document.createElement('li');
  const a = Object.assign(document.createElement('a'), { textContent: ex, tabIndex: 0 });
  const choisir = () => { historique.length = 0; changerTexte(ex); };
  a.addEventListener('click', choisir);
  a.addEventListener('keydown', (e) => { if (e.key === 'Enter') choisir(); });
  li.append(a);
  return li;
}));

// --- Déplacement sur la carte --------------------------------------------------
// Un élément déplacé réécrit la description, qui régénère la carte et le JSON.
activerDeplacement($('carte'), {
  plan: () => etat.plan,
  taille: () => etat.reglages.taille,
  apercu: (plan) => dessiner($('carte'), plan, { taille: etat.reglages.taille, grille: etat.reglages.grille }),
  deposer: (plan) => {
    memoriser();
    changerTexte(decrire(plan));
  },
});
$('annuler').addEventListener('click', () => {
  if (historique.length) changerTexte(historique.pop());
});

// --- Copier pour signaler -----------------------------------------------------
$('copier-rapport').addEventListener('click', async () => {
  const texte = rapport({ texte: etat.texte, ...etat.retour, plan: etat.plan });
  const message = $('message-copie');
  message.hidden = false;
  try {
    await navigator.clipboard.writeText(texte);
    message.textContent = 'Copié ! Collez-le dans votre message.';
  } catch {
    // Presse-papiers refusé (page non sécurisée…) : on montre le texte à copier à la main.
    $('json').closest('details').open = true;
    $('json').value = texte;
    $('json').select();
    message.textContent = 'Copie automatique impossible : le texte est sélectionné dans la zone JSON, faites Cmd+C.';
  }
  clearTimeout(message.minuterie);
  message.minuterie = setTimeout(() => { message.hidden = true; }, 4000);
});

// --- Micro --------------------------------------------------------------------
const messageMicro = $('message-micro');
const micro = creerMicro({
  onTexte: (texte) => { etat.texte = texte; $('description').value = texte; genererBientot(); },
  onEtat: (actif) => { $('micro').classList.toggle('actif', actif); $('micro').textContent = actif ? '⏹ Arrêter' : '🎙️ Dicter'; },
  onErreur: (msg) => { messageMicro.hidden = false; messageMicro.textContent = msg; },
});
if (!voixDisponible) {
  $('micro').disabled = true;
  messageMicro.hidden = false;
  messageMicro.textContent = 'La dictée vocale n’est pas disponible dans ce navigateur (Firefox, par exemple). La saisie au clavier marche partout.';
} else {
  $('micro').addEventListener('click', () => { messageMicro.hidden = true; micro.basculer($('description').value); });
}

// --- Réglages -----------------------------------------------------------------
const r = etat.reglages;
$('echelle').value = r.echelle;
$('taille').value = r.taille;
$('taille-val').textContent = `${r.taille} px`;
$('grille').checked = r.grille;

$('echelle').addEventListener('change', (e) => {
  const v = parseFloat(e.target.value);
  if (v > 0) { r.echelle = v; generer(); }
});
$('taille').addEventListener('input', (e) => {
  r.taille = Number(e.target.value);
  $('taille-val').textContent = `${r.taille} px`;
  rendre();
});
$('grille').addEventListener('change', (e) => { r.grille = e.target.checked; rendre(); });

// Calibrage : une carte bancaire mesure 85,6 × 53,98 mm ; une case visée = 25 mm.
function majCarteRef() {
  const ref = $('carte-ref');
  ref.hidden = !$('calibrage').checked;
  ref.style.width = `${(r.taille * 85.6) / 25}px`;
  ref.style.height = `${(r.taille * 53.98) / 25}px`;
}
$('calibrage').addEventListener('change', (e) => { $('aide-calibrage').hidden = !e.target.checked; majCarteRef(); });

// --- Plein écran (vue table) --------------------------------------------------
$('plein-ecran').addEventListener('click', () => $('scene').requestFullscreen?.());
$('quitter-plein-ecran').addEventListener('click', () => document.exitFullscreen());
document.addEventListener('fullscreenchange', () => { $('quitter-plein-ecran').hidden = !document.fullscreenElement; });

// --- Fichiers -----------------------------------------------------------------
$('exporter').addEventListener('click', () => stockage.exporter(etat));

$('importer').addEventListener('change', async (e) => {
  const fichier = e.target.files[0];
  e.target.value = '';
  if (!fichier) return;
  try {
    const donnees = await stockage.importer(fichier);
    appliquerPlan(donnees.plan, donnees.texte);
  } catch {
    afficherErreursJson(['fichier illisible : ce n’est pas un JSON valide']);
  }
});

$('appliquer-json').addEventListener('click', () => {
  try {
    appliquerPlan(JSON.parse($('json').value), null);
  } catch (err) {
    afficherErreursJson([`JSON invalide : ${err.message}`]);
  }
});

/** Remplace le plan courant par un plan venu d'un fichier ou de l'éditeur. */
function appliquerPlan(brut, texte) {
  const { ok, erreurs, plan } = validerPlan(brut);
  afficherErreursJson(erreurs);
  if (!plan) return;
  // Le JSON modifié réécrit la description, qui régénère la carte : tout reste aligné.
  memoriser();
  changerTexte(texte || decrire(plan));
  if (!ok) $('compris').prepend(Object.assign(document.createElement('li'), { textContent: 'plan chargé, avec des éléments écartés' }));
}

function afficherErreursJson(erreurs) {
  const zone = $('erreurs-json');
  zone.hidden = erreurs.length === 0;
  zone.textContent = erreurs.join(' · ');
}

// --- Démarrage ----------------------------------------------------------------
generer();
