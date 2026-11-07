/**
 * Le PARCOURS de calibrage de l'écran de la table, dans le popover « Affichage » (groupe « Écran de la table », bouton « Calibrer l'écran… »).
 * Quatre étapes (maquette : docs/maquettes/calibrage-table.html) : Orienter (rotation, miroir), Mesurer (taille du rectangle au dixième de pixel,
 * « Une case vaut » en mm), Vérifier (texte), Terminé (Remplir / Échelle réelle). Un aperçu de la table (« Ce que voient les joueurs ») reste en haut :
 * c'est la vue table en mode aperçu (`presentation.html?vue=table&apercu=1`, comme la vue « À la table » de la régie), qui reçoit les mêmes messages
 * `calibrage` que la fenêtre, donc montre la même chose sans second rendu.
 *
 *   const p = creerParcours({ calibrage: () => ctx.calibrage, lire: () => r, surReglage: () => { sauver; diffuser }, fermer: () => popover.fermer() });
 *   p.element  la section (à poser dans le popover) ; p.maj()  la remet d'accord avec le calibrage et les réglages ; p.annuler()  abandonne et ferme.
 *
 * La logique (étapes, brouillon de taille, messages) est dans js/calibrage.js, sans DOM ; ce module ne fait que la montrer et la commander.
 * Rotation, miroir et taille visée sont ceux de l'Affichage (`lire()`, une seule valeur) ; la taille en pixels est un brouillon du calibrage.
 */
import { h } from '../dom.js';
import { ETAPES_CALIBRAGE } from '../protocole-table.js';
import { CASE_MM_MIN, CASE_MM_MAX, CASE_MM_PAR_DEFAUT } from '../affichage.js';
import { accrocherMm, graduationsMm, standardGrise, caseMmDe, appliquerCaseMm, appliquerRotation, basculerMiroir, texteTaille } from '../calibrage.js';

/** Taille (px) à laquelle l'aperçu de la table est dessiné avant d'être réduit à la place disponible (ratio 16 : 10). */
const ECRAN = { largeur: 1600, hauteur: 1000 };
const TITRES = { orienter: 'Orienter', mesurer: 'Mesurer', verifier: 'Vérifier', termine: 'Table calibrée' };

/** Le texte « n mm » (virgule française, un chiffre après la virgule seulement s'il le faut). */
export const texteMm = (mm) => `${String(Math.round(mm * 10) / 10).replace('.', ',')} mm`;

export function creerParcours({ calibrage, lire, surReglage, fermer = () => {}, doc = document }) {
  const cal = () => calibrage();
  let apercu = null; // l'iframe, créée au premier calibrage et retirée à la fin
  let mode = null; // le choix de l'étape « Terminé » ; null : celui qu'on vient de calibrer (échelle réelle)

  const bouton = (texte, classe, action) => { const b = h('button', { type: 'button', className: `btn ${classe}`.trim(), textContent: texte }); b.addEventListener('click', action); return b; };
  const pas = (id, texte, etiquette) => h('button', { type: 'button', id, className: 'pop-ib', 'aria-label': etiquette, title: etiquette, textContent: texte });

  // --- En-tête, progression, aperçu ---
  const titre = h('b', { className: 'pop-parcours-titre' });
  const compteur = h('small', { className: 'pop-parcours-compteur', 'aria-live': 'polite' });
  const segments = ETAPES_CALIBRAGE.map(() => h('i'));
  const progres = h('div', { className: 'pop-progres', 'aria-hidden': 'true' }, ...segments);
  const cadreApercu = h('div', { className: 'pop-parcours-ecran', 'aria-hidden': 'true' });
  const etiquette = h('span', { className: 'pop-parcours-etiquette', textContent: 'Ce que voient les joueurs' });
  const zoneApercu = h('div', { className: 'pop-parcours-apercu', 'aria-hidden': 'true' }, cadreApercu, etiquette);

  // --- Étape Orienter ---
  const rotationVal = h('output', { className: 'pop-parcours-val', id: 'parcours-rotation-val' });
  const miroir = h('button', { type: 'button', id: 'parcours-miroir', className: 'pop-interrupteur', role: 'switch', 'aria-checked': 'false', 'aria-label': 'Image en miroir (symétrie)' });
  const orienter = h('div', { className: 'pop-parcours-etape', 'data-etape': 'orienter' },
    h('p', { className: 'pop-note', textContent: 'Tourne l’image jusqu’à ce que le F de la table soit à l’endroit, dans le sens où tu veux lire la carte.' }),
    h('div', { className: 'pop-rang' }, h('span', { className: 'pop-lib', textContent: 'Orientation' }),
      h('span', { className: 'pop-pas' }, pas('parcours-gauche', '↺', 'Tourner à gauche'), rotationVal, pas('parcours-droite', '↻', 'Tourner à droite'))),
    h('div', { className: 'pop-rang', title: 'Pour un projecteur sous la table dont le montage n’a pas de miroir' },
      h('span', { className: 'pop-lib' }, 'Image en miroir', h('small', { textContent: 'projecteur sous la table' })), miroir));

  // --- Étape Mesurer ---
  const tailleVal = h('output', { className: 'pop-parcours-val', id: 'calibrage-val', 'aria-live': 'polite' });
  const moins = pas('parcours-moins', '−', 'Un dixième de pixel de moins'), plus = pas('parcours-plus', '+', 'Un dixième de pixel de plus');
  const mmVal = h('output', { className: 'pop-parcours-val', id: 'parcours-mm-val' });
  const standard = h('button', { type: 'button', id: 'parcours-standard', className: 'pop-reinit', textContent: `Standard : ${CASE_MM_PAR_DEFAUT} mm` });
  const curseurMm = h('input', { type: 'range', id: 'parcours-mm', className: 'pop-reglette-champ', min: String(CASE_MM_MIN), max: String(CASE_MM_MAX), step: '0.5', 'aria-label': 'Une case vaut, en millimètres' });
  const graduations = h('div', { className: 'pop-graduations', 'aria-hidden': 'true' },
    ...graduationsMm().map((g) => h('span', { className: g.standard ? 'std' : '', style: `--p:${g.pct / 100}`, textContent: String(g.mm) })));
  const mesurer = h('div', { className: 'pop-parcours-etape', 'data-etape': 'mesurer' },
    h('p', { className: 'pop-note', textContent: 'Pose une carte bancaire sur le rectangle de la table et ajuste jusqu’à ce qu’elle coïncide.' }),
    h('div', { className: 'pop-rang' }, h('span', { className: 'pop-lib', textContent: 'Taille du rectangle' }), h('span', { className: 'pop-pas' }, moins, tailleVal, plus)),
    h('p', { className: 'pop-note', textContent: '− et + règlent au dixième de pixel. Maintenir le bouton accélère.' }),
    h('div', { className: 'pop-rang' }, h('span', { className: 'pop-lib', textContent: 'Une case vaut' }), standard, mmVal),
    h('div', { className: 'pop-reglette' }, curseurMm, graduations),
    h('p', { className: 'pop-note', textContent: 'La poignée s’accroche à 25 mm, la case standard (1 pouce ≈ 25,4 mm). À changer seulement avec un tapis ou des figurines hors norme.' }));

  // --- Étape Vérifier ---
  const verifier = h('div', { className: 'pop-parcours-etape', 'data-etape': 'verifier' },
    h('p', { className: 'pop-note', textContent: 'Trois cases et un pion de test à l’échelle : c’est ce que verront les joueurs. Pose une figurine sur une case : elle doit y tenir, ni trop à l’étroit ni trop au large. Sinon, reviens à l’étape précédente.' }));

  // --- Étape Terminé ---
  const choix = ['remplir', 'reel'].map((v) => h('button', { type: 'button', role: 'radio', 'aria-checked': 'false', 'data-valeur': v, textContent: v === 'reel' ? 'Échelle réelle' : 'Remplir' }));
  const choixSeg = h('div', { className: 'pop-seg', role: 'radiogroup', 'aria-label': 'Taille à la table' }, ...choix);
  const termine = h('div', { className: 'pop-parcours-etape', 'data-etape': 'termine' },
    h('div', { className: 'pop-rang' }, h('span', { className: 'pop-lib', textContent: 'Taille à la table' }), choixSeg),
    h('p', { className: 'pop-note', textContent: 'Échelle réelle est choisi pour toi : c’est ce qu’on vient de calibrer, les salles sont à la bonne taille pour les figurines (une grande salle défile). Remplir adapte la carte à l’écran.' }),
    h('p', { className: 'pop-note', textContent: 'Enregistré à la fermeture.' }));

  const etapes = { orienter, mesurer, verifier, termine };

  // --- Actions ---
  const annulerBtn = bouton('Annuler', 'btn-discret pop-gauche', () => annuler());
  const retourBtn = bouton('Retour', 'btn-discret', () => cal()?.precedente());
  const recommencerBtn = bouton('Recommencer', 'btn-discret', () => cal()?.aller('orienter'));
  const suivantBtn = bouton('Suivant', 'btn-primaire', () => {
    const c = cal(); if (!c) return;
    if (c.etape() === 'termine') { const m = mode ?? 'reel'; fermer({ rendreFocus: true }); c.terminer({ mode: m }); } else c.suivante();
  });
  const actions = h('div', { className: 'pop-rang pop-parcours-actions' }, annulerBtn, retourBtn, recommencerBtn, suivantBtn);

  const element = h('div', { className: 'atelier-affichage-groupe pop-parcours', id: 'parcours-calibrage', hidden: true, role: 'group', 'aria-label': 'Calibrage de l’écran de la table' },
    h('div', { className: 'pop-parcours-tete' }, titre, compteur), progres, zoneApercu, orienter, mesurer, verifier, termine, actions);

  /** Abandonne le parcours (rien n'est enregistré) et referme le popover. */
  function annuler() { fermer({ rendreFocus: true }); cal()?.annuler(); }

  // --- Commandes ---
  const ecrire = () => { surReglage(); maj(); };
  for (const [id, delta] of [['parcours-gauche', -90], ['parcours-droite', 90]]) element.querySelector(`#${id}`).addEventListener('click', () => { appliquerRotation(lire(), delta); ecrire(); });
  miroir.addEventListener('click', () => { basculerMiroir(lire()); ecrire(); });
  /** Un bouton ± : un clic règle d'un pas ; maintenu, il répète puis accélère. Au clavier, le clic (detail 0) règle d'un pas. */
  function repeter(b, delta) {
    let minuterie = null, n = 0;
    const arret = () => { clearTimeout(minuterie); minuterie = null; };
    const tour = () => { n += 1; cal()?.ajuster(n > 15 ? delta * 10 : delta); minuterie = setTimeout(tour, 70); };
    b.addEventListener('pointerdown', (e) => { if (e.button) return; n = 0; cal()?.ajuster(delta); minuterie = setTimeout(tour, 450); });
    for (const t of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) b.addEventListener(t, arret);
    b.addEventListener('click', (e) => { if (e.detail === 0) cal()?.ajuster(delta); });
  }
  repeter(moins, -0.1); repeter(plus, 0.1);
  curseurMm.addEventListener('input', () => {
    const v = accrocherMm(Number(curseurMm.value));
    curseurMm.value = String(v);
    appliquerCaseMm(lire(), v); ecrire();
  });
  standard.addEventListener('click', () => { appliquerCaseMm(lire(), CASE_MM_PAR_DEFAUT); ecrire(); });
  for (const b of choix) b.addEventListener('click', () => { mode = b.dataset.valeur; maj(); });

  // --- L'aperçu : la vue table en mode aperçu, créée à la première étape et retirée à la fin ---
  function ajusterApercu() {
    if (!apercu) return;
    const l = cadreApercu.clientWidth;
    if (l) apercu.style.transform = `scale(${l / ECRAN.largeur})`;
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(ajusterApercu).observe(cadreApercu);
  function montrerApercu(oui) {
    if (oui && !apercu) {
      apercu = h('iframe', { title: 'Aperçu de la table', tabIndex: -1, 'aria-hidden': 'true', src: new URL('presentation.html?vue=table&apercu=1', doc.baseURI).href });
      Object.assign(apercu.style, { width: `${ECRAN.largeur}px`, height: `${ECRAN.hauteur}px` });
      cadreApercu.append(apercu);
      ajusterApercu();
    } else if (!oui && apercu) { apercu.remove(); apercu = null; }
  }

  /** Remet le parcours d'accord avec le calibrage et les réglages. Rend vrai tant qu'un calibrage est en cours. */
  function maj() {
    const c = cal(), etape = c?.etape() ?? null, actif = etape !== null;
    element.hidden = !actif;
    montrerApercu(actif);
    if (!actif) { mode = null; return false; }
    const r = lire() ?? {}, i = ETAPES_CALIBRAGE.indexOf(etape);
    titre.textContent = etape === 'termine' ? TITRES.termine : 'Calibrer l’écran de la table';
    compteur.textContent = `étape ${i + 1} sur ${ETAPES_CALIBRAGE.length}`;
    segments.forEach((s, k) => s.classList.toggle('on', k <= i));
    for (const [cle, el] of Object.entries(etapes)) el.hidden = cle !== etape;
    const rot = r.rotationTable || 0, mm = caseMmDe(r);
    rotationVal.textContent = `${rot}°`;
    miroir.setAttribute('aria-checked', String(r.miroirTable === true));
    tailleVal.textContent = texteTaille(c.taille());
    mmVal.textContent = texteMm(mm);
    if (document.activeElement !== curseurMm || Number(curseurMm.value) !== mm) curseurMm.value = String(mm);
    standard.disabled = standardGrise(mm);
    const choisi = mode ?? 'reel';
    for (const b of choix) b.setAttribute('aria-checked', String(b.dataset.valeur === choisi));
    retourBtn.hidden = i === 0 || etape === 'termine';
    recommencerBtn.hidden = etape !== 'termine';
    suivantBtn.textContent = etape === 'termine' ? 'Fermer' : etape === 'verifier' ? 'C’est bon' : 'Suivant';
    return true;
  }
  return { element, maj, annuler, actif: () => cal()?.actif() === true, aApercu: () => apercu !== null };
}
