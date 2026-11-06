---
name: generer-carte
description: Génère une carte illustrée (monde, région, zone, village, bâtiment, souterrain) pour la bibliothèque de carte-de-mj à partir de la description du MJ, avec gpt-image-1, puis l'ajoute au catalogue après validation. À utiliser quand le MJ demande de « générer », « dessiner », « créer » une carte, une image de forêt, de village, de monde, ou veut enrichir sa bibliothèque.
---

# Générer une carte

Tout est en français avec le MJ. Les prompts envoyés au générateur sont en anglais, composés par `js/bibliotheque/prompt.js` :
**le même code que l'onglet « Générer une carte » de la Bibliothèque**. Le skill et l'appli proposent donc les mêmes choix et donnent le même prompt :
- **style** (`--style`) : `peint-v2` dessin animé coloré (défaut), `parchemin-v1` vieille carte sur parchemin, `peint-v1` aquarelle peinte.
  Un style = un fichier `assets/styles-cartes/<id>.md`, déclaré dans `STYLES` ;
- **format** (`--format`) : `paysage` 16:9 pour l'écran et la table (défaut), `portrait` 2:3 pour l'impression, `carre`. Les formats et leurs grilles
  sont dans `FORMATS`. Le paysage est demandé en 3:2 (aucun générateur ne fait du 16:9) puis recadré au centre en 1536 × 864, ici par le script, dans l'appli à l'import.

Pour ajouter un style ou un format, modifie `js/bibliotheque/prompt.js` (et crée le fichier de style) : les deux côtés suivent tout seuls.
Les cartes et les images de référence vivent dans `bibliotheque/` à la racine, **ignoré par git** : n'y ajoute jamais rien à un commit.
Si le MJ utilise le « dossier de travail » de l'appli (bouton Sauvegarde, voir le README), la bibliothèque peut vivre dans ce dossier : exporte
`CARTE_DE_MJ_BIBLIOTHEQUE=/chemin/absolu/du/dossier/bibliotheque` avant les scripts `outils/cartes/*.mjs`, qui écrivent alors là (cartes, références,
catalogue) au lieu de `<dépôt>/bibliotheque/`. Sans la variable, rien ne change. L'appli relit le catalogue du dossier au rechargement de la page.
Claude ne dessine pas : `outils/cartes/generer.mjs` appelle l'API d'images (`gpt-image-1`).
Sans clé ni Claude, le MJ peut faire la même chose dans l'appli : onglet « Générer une carte » de la Bibliothèque (prompt à copier dans ChatGPT, puis import).
Si la clé est absente, rappelle-lui cette voie.

## Avant de commencer

1. Teste la **présence** de la clé, sans l'afficher : `[ -n "$OPENAI_API_KEY" ] && echo présente || echo absente`.
   Absente : explique que chacun apporte la sienne (`export OPENAI_API_KEY=…` dans le terminal qui lance Claude), ne la demande jamais dans la conversation,
   ne l'écris dans aucun fichier. Tu peux quand même préparer le prompt avec `--essai`.
2. Regarde s'il existe des références pour le style choisi : `ls bibliotheque/references/<style>/`. S'il n'y en a pas, c'est normal au premier usage : le script démarre sans.

## Déroulé

1. **Comprendre la demande.** Il te faut le *niveau* (`monde`, `region`, `zone` = lieu extérieur à l'échelle des figurines, `localite` = village/ville/port,
   `batiment` = intérieur, `souterrain`) et la *scène* ; le style et le format ont des valeurs par défaut (dessin animé, paysage 16:9), ne les demande
   que si le MJ en parle (« façon vieille carte », « pour imprimer »). Si le niveau manque, déduis-le (« une forêt avec des ruines » → `zone`) et dis-le ;
   ne pose une question que si c'est vraiment ambigu. Un monde ou une région n'ont pas de grille ; les autres ont une grille demandée, qui dépend du format.
2. **Écrire la scène** en anglais, concrète et à l'échelle : ce qu'il y a, où, en quelle taille (« a circular shrine 6 squares across in the east »,
   « a path 2 squares wide crossing from north to south »). Pas de texte, pas de personnages ni de créatures, pas de rose des vents : le style les interdit déjà,
   ne les demande pas dans la scène. Les noms de lieux peuvent y figurer pour situer les choses : le rappel final interdit de les écrire sur l'image.
   Choisis un `id` (minuscules, chiffres, tirets, ex. `foret-ruines-01` ; si le fichier existe déjà, ajoute un suffixe).
3. **Montrer ce qui va partir.** Lance d'abord :
   `node outils/cartes/generer.mjs --niveau zone --id foret-ruines-01 --scene "…" [--style …] [--format …] --essai`
   (montre le prompt complet, les références retenues, le fichier de sortie, sans appeler l'API). Résume en une phrase pour le MJ ; une génération coûte de l'argent,
   alors demande son accord si la demande est floue. Si le MJ a donné la scène complète, enchaîne.
4. **Générer.** Même commande sans `--essai`. Options : `--ref chemin` (répétable) pour imposer des références,
   `--sans-reference` pour partir de zéro, `--type webp|png` (en paysage, png obligatoire : le recadrage se fait en png).
   Sans `--ref`, les 3 premières images de `bibliotheque/references/<style>/` servent de point de départ du style.
   Le script écrit `bibliotheque/cartes/<id>.png` (paysage) ou `.webp`, et `<id>.prompt.txt` (le prompt utilisé), n'écrase jamais, et affiche un JSON
   (fichier, style, format, largeur, hauteur, grille demandée).
   Une erreur d'API (quota, filtre de contenu, clé refusée) s'affiche telle quelle : rapporte-la sans réessayer en boucle.
5. **Montrer l'image** (lis le fichier avec l'outil Read pour l'afficher) et **demande validation** : fidèle à la demande ? échelle plausible (portes à 1 case, arbres à 2–3 cases) ?
   pas de texte ni de personnages parasites ? vue de dessus ? bords nets ? Le MJ répond par : valider, relancer, varier, ou corriger.
   - **Relancer** : même commande avec un autre `id` (`-b`, `-c`). Les essais écartés restent sur le disque ; propose de les supprimer à la fin, ne les supprime pas sans accord.
   - **Varier** : garde la scène et change un point (saison, heure, état : « at night », « after a fire »), ou passe l'image validée en `--ref` pour une variante cohérente.
   - **Corriger** : ajoute la correction à la scène (« no bridge », « bigger trees ») ; ne modifie pas le fichier de style.
6. **Proposer les métadonnées** une fois l'image validée, et laisser le MJ les corriger :
   - `titre` court en français ; `niveau` ; `milieux` (plusieurs, parmi `foret plaine montagne desert eau cote marais neige ville ruines souterrain`) ;
   - `tags` : 5 à 8 mots français (éléments visibles, ambiance, moment : `chemin`, `colonnes`, `sanctuaire`, `nuit`…) ;
   - `description` : une ou deux phrases en français, utiles pour retrouver la carte.
7. **Ajouter au catalogue.** Écris l'entrée dans un fichier temporaire (hors dépôt, ex. dossier temporaire de la session) :
   ```json
   { "id": "foret-ruines-01", "titre": "Clairière aux ruines", "fichier": "cartes/foret-ruines-01.png",
     "largeur": 1536, "hauteur": 864, "niveau": "zone", "milieux": ["foret","ruines"],
     "tags": ["chemin","colonnes"], "description": "…", "grille": { "case": 48, "dx": 0, "dy": 0 },
     "origine": { "type": "generee", "outil": "gpt-image-1", "style": "peint-v2", "le": "2026-11-06" } }
   ```
   `fichier`, `largeur`, `hauteur` et `grille` viennent du JSON affiché par le générateur (omets `grille` pour `monde` et `region`) ;
   mets dans `origine.style` le style utilisé. Sans `origine`, le style par défaut et la date du jour sont posés ; `licence` (`libre`) et `credit` aussi.
   Puis : `node outils/cartes/ajouter.mjs entree.json`. Le script crée `bibliotheque/catalogue.json` s'il manque, refuse un id déjà pris
   ou une entrée invalide en disant pourquoi (corrige et relance), et n'écrase rien.
8. **Conclure** : dis où est le fichier, que la carte est dans la bibliothèque de l'appli (serveur local : `python3 outils/serveur.py`), et que la grille est celle *demandée*
   (le calage fin se fera dans l'appli).

## Promouvoir une image en référence de style

Quand le MJ dit qu'une image validée est une bonne représentante du style (« garde-la comme référence ») :

1. Copie `bibliotheque/cartes/<id>.<type>` vers `bibliotheque/references/<style>/<id>.<type>` et le prompt vers `bibliotheque/references/<style>/<id>.prompt.txt`
   (`cp`, jamais `mv` : la carte reste au catalogue). Chaque style a son dossier de références.
2. Les références ne sont **pas** des entrées du catalogue. Deux ou trois bonnes suffisent (le script en prend 3 au plus, par ordre alphabétique) :
   si le dossier en contient davantage, dis lesquelles servent et propose de renommer pour changer le choix.
3. N'y mets que des images **générées par nous**, jamais l'œuvre d'un autre créateur. Tout reste hors de git.

## À ne pas faire

- Ne jamais afficher, écrire, journaliser ou committer `OPENAI_API_KEY` (pas de `echo $OPENAI_API_KEY`, pas de `env`).
- Ne jamais committer le contenu de `bibliotheque/` (ignoré par git ; vérifie `git status` si un doute).
- Ne pas modifier un fichier de style pour un cas particulier : une nouvelle version de style est un nouveau fichier (`peint-v3.md`), déclaré dans `STYLES`.
- Ne pas composer de prompt à la main ni dupliquer les règles ailleurs : tout passe par `js/bibliotheque/prompt.js`, pour que le skill et l'appli restent identiques.
