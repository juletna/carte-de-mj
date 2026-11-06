/** Accueil (index.html) : pose l'icône de chaque entrée (`data-icone="nom"`, voir js/icones.js). Le texte reste lisible sans l'icône. */
import { iconeHtml } from './icones.js';

for (const e of document.querySelectorAll('[data-icone]')) e.innerHTML = iconeHtml(e.dataset.icone);
