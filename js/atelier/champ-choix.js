/**
 * Un champ « à choix » de l'inspecteur (docs/design-panneaux.md, rangées de champ) : une rangée [aperçu · valeur · détail ▾] qui
 * ouvre, au clic, la liste des choix en popover ancré dessous. Il pilote un <select> existant : le <select> reste la source de vérité
 * (ses écouteurs, ses valeurs, son remplissage) et sort de l'écran ; la rangée le reflète.
 *
 *   const champ = creerChampChoix({ select, detail: 'sol', couleurs?: { valeur: '#hex' }, miniature?: (valeur) => <canvas>|null, titre?: 'Sol' });   → { element, maj }
 * `miniature(valeur)` : un aperçu dessiné (un canvas) de ce choix ; sans elle, ou si elle ne rend rien, un carré de la couleur de `couleurs`.
 *
 * `maj()` relit la valeur du <select> ; elle est rappelée toute seule quand le <select> reçoit l'événement « synchro » (js/mj/salle-forme.js
 * l'envoie après chaque rendu) ou « change ». Choisir une ligne écrit la valeur du <select> et y déclenche « change ».
 * Un clic ailleurs ou Échap referme le popover.
 */
import { h } from '../dom.js';

export function creerChampChoix({ select, detail, couleurs = {}, miniature = null, titre = detail }) {
  const apercu = (valeur) => {
    let dessin = null;
    try { dessin = miniature?.(valeur) ?? null; } catch (err) { console.error(`Miniature de « ${titre} » :`, err); } // une miniature ratée ne casse pas le champ
    if (dessin) return h('span', { className: 'rang-aperce rang-rendu' }, dessin);
    const a = h('span', { className: 'rang-aperce rang-couleur' });
    if (couleurs[valeur]) a.style.background = couleurs[valeur];
    return a;
  };
  const texte = (o) => (o ? o.textContent : '');
  const valeur = h('span', { className: 'rang-valeur' });
  const aperceCourant = h('span', { className: 'rang-aperce-hote' });
  const rangee = h('button', { type: 'button', className: 'rang-champ', 'aria-haspopup': 'true', 'aria-expanded': 'false' },
    aperceCourant,
    h('span', { className: 'rang-texte' }, valeur, h('span', { className: 'rang-etiquette', textContent: ` · ${detail}` })),
    h('span', { className: 'rang-fin', 'aria-hidden': 'true', textContent: '▾' }));
  const liste = h('div', { className: 'popover-aspect popover-choix', role: 'listbox', 'aria-label': titre, hidden: true });
  const hote = h('div', { className: 'rang-hote' }, rangee, liste);

  function maj() {
    const o = select.selectedOptions?.[0];
    valeur.textContent = texte(o);
    rangee.title = `${titre} : ${texte(o)}`;
    aperceCourant.replaceChildren(apercu(select.value));
  }
  function ouvrir(oui) {
    if (oui) {
      liste.replaceChildren(h('p', { className: 'popover-titre', textContent: titre }), ...[...select.options].map((o) => {
        const b = h('button', { type: 'button', className: 'rang-choix', role: 'option', 'aria-selected': String(o.value === select.value) }, apercu(o.value), h('span', { textContent: o.textContent }));
        b.addEventListener('click', () => {
          const change = o.value !== select.value;
          select.value = o.value;
          ouvrir(false);
          if (change) select.dispatchEvent(new Event('change', { bubbles: true }));
          maj();
        });
        return b;
      }));
    }
    liste.hidden = !oui;
    rangee.setAttribute('aria-expanded', String(oui));
  }
  rangee.addEventListener('click', () => ouvrir(liste.hidden));
  hote.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !liste.hidden) { e.preventDefault(); e.stopPropagation(); ouvrir(false); rangee.focus(); } });
  document.addEventListener('pointerdown', (e) => { if (!liste.hidden && !hote.contains(e.target)) ouvrir(false); }, true);
  select.addEventListener('synchro', maj);
  select.addEventListener('change', maj);
  maj();
  return { element: hote, maj };
}
