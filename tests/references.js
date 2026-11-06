/**
 * Empreintes de référence de la disposition du plan et du rendu (voir tests/references.test.js).
 * FICHIER GÉNÉRÉ par node tests/regenerer-references.mjs : ne pas le modifier à la main.
 */
export const REFERENCES = {
  disposition: {
    "tirage 1 : 8 salles, 2 boucles": {"salles": 8, "couloirs": 7, "empreinte": "136a5c18aa7d66"},
    "tirage 7 : 14 salles, 4 boucles, 2 secrètes, formes": {"salles": 14, "couloirs": 17, "empreinte": "0c262ee62605ad"},
    "tirage 42 : une seule salle": {"salles": 1, "couloirs": 0, "empreinte": "06870170685b2b"},
    "tirage 5 : 25 salles, 6 boucles": {"salles": 25, "couloirs": 29, "empreinte": "15095b345f2c07"},
    "tirage 31 : 12 salles sans boucle": {"salles": 12, "couloirs": 11, "empreinte": "0c963bc44de4ab"},
    "modèle eglise": {"salles": 3, "couloirs": 2, "empreinte": "0c3fff151c8fd5"},
    "modèle crypte": {"salles": 4, "couloirs": 3, "empreinte": "15f45a8ecb72f7"},
    "modèle cloitre": {"salles": 3, "couloirs": 2, "empreinte": "13f92984eae8c2"},
    "modèle repaire": {"salles": 3, "couloirs": 2, "empreinte": "0036c9b0667014"},
    "salles non reliées": {"salles": 6, "couloirs": 3, "empreinte": "1384b5a8aa55e3"},
    "liaison orpheline : une porte disparue": {"salles": 4, "couloirs": 3, "empreinte": "08f453ca06f8e1"},
  },
  rendu: {
    "vectoriel · dessiner : un exemplaire de tout, grille et repères": {"appels": 10685, "empreinte": "07f4f375924aaa"},
    "vectoriel · dessiner : marques d’interface, sans grille": {"appels": 10192, "empreinte": "11acc163a0d2ff"},
    "papier · dessiner : un exemplaire de tout": {"appels": 10810, "empreinte": "19625ec713c109"},
    "vectoriel · dessinerFenetre : une fenêtre de la salle": {"appels": 10076, "empreinte": "1f42a0e12fc300"},
    "papier · dessinerFenetre : une fenêtre de la salle": {"appels": 10782, "empreinte": "0470858d43d65f"},
    "vectoriel · dessiner : croix, L, octogone": {"appels": 3312, "empreinte": "1795d10759dad3"},
    "papier · dessiner : croix, L, octogone": {"appels": 2126, "empreinte": "1f99d5e7fd04c1"},
    "vectoriel · dessinerPlanDonjon : tous les repères": {"appels": 7574, "empreinte": "026d522b6aa0a1"},
    "vectoriel · dessinerPlanDonjon : miniature teintée, sans noms ni pions": {"appels": 6064, "empreinte": "1e77b6bf3ad1bc"},
    "papier · dessinerPlanDonjon : plan seul": {"appels": 3731, "empreinte": "0f334de00dcbdc"},
  },
};
