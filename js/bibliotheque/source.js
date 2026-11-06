/**
 * D'où vient la bibliothèque de cartes : du dossier de travail (sous-dossier bibliotheque/) s'il est connecté et contient un
 * catalogue.json, sinon du site (fetch de bibliotheque/…, comme avant). Un seul endroit pour index.js, page-bibliotheque.js
 * et la sauvegarde ; les images du dossier sont servies par des URL d'objet (une par fichier, gardées pour la page).
 *   lireFichierBibliotheque('catalogue.json') → { statut: 'ok' | 'absent' | 'erreur', texte, origine: 'dossier' | 'site' }
 *   urlBibliotheque('cartes/foret.webp')      → URL affichable (à appeler après la lecture du catalogue)
 */
import { dossierActif, dossierPret } from '../dossier-travail.js';

const DOSSIER = 'bibliotheque/';
const urls = new Map(); // chemin dans bibliotheque/ → URL d'objet
const segmentSur = (s) => /^[A-Za-z0-9._ -]+$/.test(s) && s !== '.' && s !== '..';

async function fichierDe(dossier, chemin) {
  const segments = String(chemin).split('/');
  if (!segments.every(segmentSur)) throw new Error(`chemin refusé : ${chemin}`);
  let d = dossier;
  for (const s of segments.slice(0, -1)) d = await d.getDirectoryHandle(s);
  return (await d.getFileHandle(segments.at(-1))).getFile();
}

/** Le dossier bibliotheque/ du dossier de travail, ou null (pas de dossier, pas de sous-dossier, démarrage trop long). */
async function dossierBibliotheque() {
  await Promise.race([dossierPret, new Promise((r) => setTimeout(r, 10000))]);
  const racine = dossierActif();
  if (!racine) return null;
  try { return await racine.getDirectoryHandle('bibliotheque'); } catch (e) { if (e?.name !== 'NotFoundError') console.warn('bibliothèque du dossier de travail :', e); return null; }
}

async function preparerUrls(bib, texte) {
  let cartes;
  try { cartes = JSON.parse(texte)?.cartes; } catch { return; }
  await Promise.all((Array.isArray(cartes) ? cartes : []).map(async (c) => {
    if (typeof c?.fichier !== 'string' || urls.has(c.fichier)) return;
    try { urls.set(c.fichier, URL.createObjectURL(await fichierDe(bib, c.fichier))); } catch { /* fichier absent : l'image affichera « introuvable » */ }
  }));
}

export async function lireFichierBibliotheque(chemin) {
  const bib = await dossierBibliotheque();
  if (bib) {
    try {
      const texte = await (await fichierDe(bib, chemin)).text();
      if (chemin === 'catalogue.json') await preparerUrls(bib, texte);
      return { statut: 'ok', texte, origine: 'dossier' };
    } catch (e) { if (e?.name !== 'NotFoundError') console.warn('bibliothèque du dossier de travail :', e); }
  }
  try {
    const rep = await fetch(DOSSIER + chemin, { cache: 'no-store' });
    return rep.ok ? { statut: 'ok', texte: await rep.text(), origine: 'site' } : { statut: 'absent', texte: '', origine: 'site' };
  } catch { return { statut: 'erreur', texte: '', origine: 'site' }; }
}

export const urlBibliotheque = (fichier) => urls.get(fichier) ?? DOSSIER + fichier;
