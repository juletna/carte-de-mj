# Exemples des cartes de choix

Vignettes des cartes cliquables de l'onglet « Générer une carte » de la Bibliothèque (zoom et style).
Tant qu'un fichier manque, l'appli dessine une vignette de repli en SVG (`js/bibliotheque/vignettes.js`) : rien ne casse, déposer
une image la remplace.

## Noms attendus

| Fichier | Carte |
| --- | --- |
| `zoom-monde.webp` | Zoom Monde : vue d'ensemble, voyage (vue cavalière, de très haut) |
| `zoom-lieu.webp` | Zoom Lieu : un endroit à explorer (vue cavalière à 45°) |
| `zoom-plateau.webp` | Zoom Plateau : jeu en cases (vue presque verticale, grille) |
| `style-peint-v2.webp` | Style « Dessin animé coloré » |
| `style-parchemin-v1.webp` | Style « Vieille carte sur parchemin » |
| `style-peint-v1.webp` | Style « Aquarelle peinte » |

## Format

- webp, proportions **16:9** (par exemple 640 × 360), le plus petit qui reste net ;
- moins de **150 Ko** par image ;
- de vraies images générées avec le prompt correspondant (même style, même vue), sans texte ni personnage.

Une nouvelle clé (nouveau style, nouveau zoom) se déclare dans `CLES_VIGNETTES` et dans le dessin de repli de `js/bibliotheque/vignettes.js`.
