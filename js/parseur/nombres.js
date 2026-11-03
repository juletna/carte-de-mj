/**
 * Conversion des nombres écrits en lettres en chiffres.
 * « quatre piliers » → « 4 piliers », « dix-sept » → « 17 »,
 * « une paire de coffres » → « 2 de coffres ».
 * Les articles « un / une » deviennent « 1 » : c'est voulu, ils
 * portent la quantité (« une statue » = 1 statue).
 */

const VALEURS = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7,
  huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14,
  quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50,
};

// Quantités approximatives : on choisit une valeur raisonnable.
const APPROX = { quelques: 3, plusieurs: 3, nombreux: 6, nombreuses: 6 };

// « une paire », « une dizaine »… : le mot suivant remplace le « 1 ».
const MULTIPLES = { paire: 2, dizaine: 10, douzaine: 12, quinzaine: 15, vingtaine: 20 };

export function convertirNombres(texte) {
  const mots = texte.split(' ');
  const sortie = [];

  for (let i = 0; i < mots.length; i++) {
    const mot = mots[i];

    if (Object.hasOwn(APPROX, mot)) { sortie.push(String(APPROX[mot])); continue; }
    if (!Object.hasOwn(VALEURS, mot)) { sortie.push(mot); continue; }

    let total = VALEURS[mot];
    let j = i + 1;
    // Nombres composés : dix sept, vingt deux, vingt et un…
    while (j < mots.length) {
      const suivant = mots[j];
      if (suivant === 'et' && total >= 20 && total % 10 === 0 && (mots[j + 1] === 'un' || mots[j + 1] === 'une')) {
        total += 1; j += 2; continue;
      }
      if (Object.hasOwn(VALEURS, suivant) && VALEURS[suivant] < 10 && total >= 10 && total % 10 === 0) {
        total += VALEURS[suivant]; j++; continue;
      }
      break;
    }
    if (total === 1 && Object.hasOwn(MULTIPLES, mots[j])) { total = MULTIPLES[mots[j]]; j++; }

    sortie.push(String(total));
    i = j - 1;
  }
  return sortie.join(' ');
}
