# Consignes pour les sessions Claude

## Pas de CI (jusqu'au 1er décembre 2026 au moins)

Le quota GitHub Actions du compte est presque épuisé. Ne déclenche aucune CI :

- **Chaque message de commit poussé sur `main` se termine par ` [skip ci]`** dans sa première ligne (le workflow « Tests » ne tourne pas).
- Lance les tests en local avant de pousser : `node tests/node.mjs`.
- Pas de `workflow_dispatch`, pas de `gh workflow run`, pas de surveillance de CI.

Le déploiement GitHub Pages (« pages build and deployment ») tourne à chaque push malgré `[skip ci]` : le dépôt est public, il ne consomme pas le quota.

## Design des panneaux

Avant de créer ou de modifier un panneau latéral (arbre, inspecteur de Monde ou de Donjons, onglets de Jouer, panneau bas du téléphone), lis **`docs/design-panneaux.md`** et suis ses règles : niveaux de texte, composant section, listes, alignement. Quand une étape de sa « Migration » est livrée, coche-la et mets à jour le tableau d'état dans ce même fichier.
