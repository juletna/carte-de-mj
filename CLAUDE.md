# Consignes pour les sessions Claude

## Pas de CI (jusqu'au 1er décembre 2026 au moins)

Le quota GitHub Actions du compte est presque épuisé. Ne déclenche aucune CI :

- **Chaque message de commit poussé sur `main` se termine par ` [skip ci]`** dans sa première ligne (le workflow « Tests » ne tourne pas).
- Lance les tests en local avant de pousser : `node tests/node.mjs`.
- Pas de `workflow_dispatch`, pas de `gh workflow run`, pas de surveillance de CI.

Le déploiement GitHub Pages (« pages build and deployment ») tourne à chaque push malgré `[skip ci]` : le dépôt est public, il ne consomme pas le quota.
