---
name: generer-carte
description: Génère une carte illustrée (monde, lieu, plateau extérieur, intérieur ou souterrain) pour carte-de-mj à partir de la description du MJ, avec gpt-image-1, puis l'ajoute à la liste de cartes de l'appli après validation. À utiliser quand le MJ demande de « générer », « dessiner », « créer » une carte, une image de forêt, de village, de monde, ou veut enrichir sa bibliothèque.
---

# Générer une carte

Tout est en français avec le MJ. Les prompts envoyés au générateur sont en anglais, composés par `js/bibliotheque/prompt.js` :
**le même code que le panneau « Générer une carte » de la page Bibliothèque**. Le skill et l'appli proposent donc les mêmes choix et donnent le même prompt :
- **style** (`--style`) : `peint-v2` dessin animé coloré (défaut), `parchemin-v1` vieille carte sur parchemin, `peint-v1` aquarelle peinte.
  Un style = un fichier `assets/styles-cartes/<id>.md`, déclaré dans `STYLES` ;
- **format** (`--format`) : `paysage` 16:9 pour l'écran et la table (défaut), `portrait` 2:3 pour l'impression, `carre`. Les formats et leurs grilles
  sont dans `FORMATS`. Le paysage est demandé en 3:2 (aucun générateur ne fait du 16:9) puis recadré au centre en 1536 × 864, ici par le script, dans l'appli à l'import.

Pour ajouter un style ou un format, modifie `js/bibliotheque/prompt.js` (et crée le fichier de style) : les deux côtés suivent tout seuls.
Tout vit dans le **dossier de travail** de l'appli (bouton Sauvegarde, voir le README), hors de git : n'y ajoute jamais rien à un commit.
Exporte `CARTE_DE_MJ_DOSSIER=/chemin/absolu/du/dossier` (la racine, celle qui contient `images/`) avant les scripts `outils/cartes/*.mjs`.
Sans cette variable, ils s'arrêtent en disant quoi exporter (sauf `generer.mjs --essai`). L'ancienne `CARTE_DE_MJ_BIBLIOTHEQUE` est encore comprise
(on en prend le parent), avec un avertissement.

Disposition :
- `generees/<id>.<ext>` et `<id>.prompt.txt` : les brouillons, **pas** dans la liste de l'appli ;
- `references/<style>/` : les images de référence de style, jamais affichées dans la liste ;
- `images/<id>.<ext>` + `images/index.json` : la liste de l'appli. Une carte n'y entre qu'avec `ajouter.mjs`, après validation du MJ.

Ne touche jamais à `dossier-carte-de-mj.json` ni à `donnees/`. L'appli voit une carte ajoutée au retour sur son onglet ou au rechargement.
Claude ne dessine pas : `outils/cartes/generer.mjs` appelle l'API d'images (`gpt-image-1`).
Sans clé ni Claude, le MJ peut faire la même chose dans l'appli : panneau « Générer une carte » de la page Bibliothèque (prompt à copier dans ChatGPT, puis import).
Si la clé est absente, rappelle-lui cette voie.

## Avant de commencer

1. Vérifie que `CARTE_DE_MJ_DOSSIER` est défini (`[ -n "$CARTE_DE_MJ_DOSSIER" ] && echo ok`) ; sinon demande au MJ le chemin de son dossier de travail et exporte-le. Teste la **présence** de la clé, sans l'afficher : `[ -n "$OPENAI_API_KEY" ] && echo présente || echo absente`.
   Absente : explique que chacun apporte la sienne (`export OPENAI_API_KEY=…` dans le terminal qui lance Claude), ne la demande jamais dans la conversation,
   ne l'écris dans aucun fichier. Tu peux quand même préparer le prompt avec `--essai`.
2. Regarde s'il existe des références pour le style choisi : `ls "$CARTE_DE_MJ_DOSSIER/references/<style>/"`. S'il n'y en a pas, c'est normal au premier usage : le script démarre sans.

## Déroulé

1. **Comprendre la demande.** Il te faut le *zoom*, classé par phase de jeu (`--niveau monde` : vue d'ensemble, voyage ; `lieu` : un endroit à explorer,
   désert, forêt, village vu en entier, île ; `plateau` : jeu en cases avec figurines, 1 case = 1,5 m, avec `--sous-type exterieur|interieur|souterrain`) et la *scène* ; le style et le format ont des valeurs par défaut (dessin animé, paysage 16:9), ne les demande
   que si le MJ en parle (« façon vieille carte », « pour imprimer »). Si le niveau manque, déduis-le (« une clairière avec un sanctuaire où se battre » → `plateau` extérieur ; « la forêt des ruines » → `lieu`) et dis-le ;
   ne pose une question que si c'est vraiment ambigu. La vue est imposée par le zoom (cavalière à 45° pour monde et lieu, dessus en trois-quarts pour le plateau) : ne la demande pas dans la scène. Monde et lieu n'ont pas de grille ; le plateau a une grille demandée, qui dépend du format. Les anciens niveaux (`region`, `localite`, `zone`, `batiment`, `souterrain`) sont encore compris et convertis.
2. **Écrire la scène** en anglais, concrète et à l'échelle : ce qu'il y a, où, en quelle taille (« a circular shrine 6 squares across in the east »,
   « a path 2 squares wide crossing from north to south »). Pas de texte, pas de personnages ni de créatures, pas de rose des vents : le style les interdit déjà,
   ne les demande pas dans la scène. Les noms de lieux peuvent y figurer pour situer les choses : le rappel final interdit de les écrire sur l'image.
   Choisis un `id` (minuscules, chiffres, tirets, ex. `foret-ruines-01` ; si le fichier existe déjà, ajoute un suffixe).
3. **Montrer ce qui va partir.** Lance d'abord :
   `node outils/cartes/generer.mjs --niveau plateau --sous-type exterieur --id foret-ruines-01 --scene "…" [--style …] [--format …] --essai`
   (montre le prompt complet, les références retenues, le fichier de sortie, sans appeler l'API). Résume en une phrase pour le MJ ; une génération coûte de l'argent,
   alors demande son accord si la demande est floue. Si le MJ a donné la scène complète, enchaîne.
4. **Générer.** Même commande sans `--essai`. Options : `--ref chemin` (répétable) pour imposer des références,
   `--sans-reference` pour partir de zéro, `--type webp|png` (en paysage, png obligatoire : le recadrage se fait en png).
   Sans `--ref`, les 3 premières images de `references/<style>/` du dossier de travail servent de point de départ du style.
   Le script écrit le brouillon `generees/<id>.png` (paysage) ou `.webp`, et `<id>.prompt.txt` (le prompt utilisé), n'écrase jamais, et affiche un JSON
   (brouillon, fichier relatif, style, format, largeur, hauteur, grille demandée).
   Une erreur d'API (quota, filtre de contenu, clé refusée) s'affiche telle quelle : rapporte-la sans réessayer en boucle.
5. **Montrer l'image** (lis le brouillon avec l'outil Read pour l'afficher) et **demande validation** : fidèle à la demande ? échelle plausible (portes à 1 case, arbres à 2–3 cases) ?
   pas de texte ni de personnages parasites ? vue de dessus ? bords nets ? Le MJ répond par : valider, relancer, varier, ou corriger.
   - **Relancer** : même commande avec un autre `id` (`-b`, `-c`). Les essais écartés restent sur le disque ; propose de les supprimer à la fin, ne les supprime pas sans accord.
   - **Varier** : garde la scène et change un point (saison, heure, état : « at night », « after a fire »), ou passe l'image validée en `--ref` pour une variante cohérente.
   - **Corriger** : ajoute la correction à la scène (« no bridge », « bigger trees ») ; ne modifie pas le fichier de style.
6. **Proposer les métadonnées** une fois l'image validée, et laisser le MJ les corriger :
   - `titre` court en français ; `niveau` (et `sousType` pour un plateau) ; `milieux` (plusieurs, parmi `foret plaine montagne desert eau cote marais neige ville ruines souterrain`) ;
   - `tags` : 5 à 8 mots français (éléments visibles, ambiance, moment : `chemin`, `colonnes`, `sanctuaire`, `nuit`…) ;
   - `description` : une ou deux phrases en français, utiles pour retrouver la carte.
7. **Ajouter à la liste de l'appli.** Écris l'entrée dans un fichier temporaire (hors dépôt, ex. dossier temporaire de la session) :
   ```json
   { "id": "foret-ruines-01", "titre": "Clairière aux ruines", "fichier": "generees/foret-ruines-01.png",
     "largeur": 1536, "hauteur": 864, "niveau": "plateau", "sousType": "exterieur", "milieux": ["foret","ruines"],
     "tags": ["chemin","colonnes"], "description": "…", "grille": { "case": 48, "dx": 0, "dy": 0 },
     "origine": { "type": "generee", "outil": "gpt-image-1", "style": "peint-v2", "le": "2026-11-06" } }
   ```
   `fichier` est le brouillon (chemin relatif au dossier de travail, ou absolu) ; `largeur`, `hauteur` et `grille` viennent du JSON affiché par le générateur
   (omets `grille` pour `monde` et `lieu`) ; mets dans `origine.style` le style utilisé. Sans `origine`, le style par défaut et la date du jour sont posés ;
   `licence` (`libre`) et `credit` aussi. Puis : `node outils/cartes/ajouter.mjs entree.json`. Le script copie l'image vers `images/<id>.<ext>`,
   ajoute l'entrée complète à `images/index.json` (créé s'il manque), refuse un id déjà pris, un fichier existant ou une entrée invalide en disant pourquoi
   (corrige et relance), et n'écrase rien. L'index est relu juste avant l'écriture, puis écrit de façon atomique.
8. **Conclure** : dis où est le fichier, que la carte est dans la liste de l'appli (elle la voit au retour sur son onglet ou au rechargement), et que la grille est celle *demandée*
   (le calage fin se fera dans l'appli). Le brouillon reste dans `generees/` : propose de le supprimer, sans le faire sans accord.

## Promouvoir une image en référence de style

Quand le MJ dit qu'une image validée est une bonne représentante du style (« garde-la comme référence ») :

1. Copie `images/<id>.<ext>` (ou le brouillon de `generees/`) vers `references/<style>/<id>.<ext>` et le prompt vers `references/<style>/<id>.prompt.txt`
   (`cp`, jamais `mv` : la carte reste dans la liste). Chaque style a son dossier de références.
2. Les références ne sont **pas** des entrées de la liste. Deux ou trois bonnes suffisent (le script en prend 3 au plus, par ordre alphabétique) :
   si le dossier en contient davantage, dis lesquelles servent et propose de renommer pour changer le choix.
3. N'y mets que des images **générées par nous**, jamais l'œuvre d'un autre créateur. Tout reste hors de git.

## À ne pas faire

- Ne jamais afficher, écrire, journaliser ou committer `OPENAI_API_KEY` (pas de `echo $OPENAI_API_KEY`, pas de `env`).
- Ne jamais committer le contenu du dossier de travail ni de `bibliotheque/` (ignoré par git ; vérifie `git status` si un doute).
- Ne jamais toucher à `dossier-carte-de-mj.json` ni à `donnees/`, ni retirer ou modifier une entrée de `images/index.json` : seul `ajouter.mjs` y écrit, en ajoutant.
- Ne pas modifier un fichier de style pour un cas particulier : une nouvelle version de style est un nouveau fichier (`peint-v3.md`), déclaré dans `STYLES`.
- Ne pas composer de prompt à la main ni dupliquer les règles ailleurs : tout passe par `js/bibliotheque/prompt.js`, pour que le skill et l'appli restent identiques.
