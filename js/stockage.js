/**
 * Sauvegarde locale (localStorage) et export/import en fichier JSON.
 * Tout reste dans le navigateur : rien n'est envoyé nulle part.
 */
const CLE = 'jdr-carte:v1';

/** Lit l'état sauvegardé, ou null (navigation privée, données effacées…). */
export function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

export function sauver(etat) {
  try {
    localStorage.setItem(CLE, JSON.stringify(etat));
  } catch {
    // Stockage indisponible : l'outil marche quand même, sans mémoire.
  }
}

/** Propose le téléchargement du donjon en fichier .json. */
export function exporter(etat) {
  const donnees = { format: 'jdr-carte', version: 1, salles: [etat.plan], texte: etat.texte, reglages: etat.reglages };
  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(etat.plan.nom || 'salle').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Lit un fichier choisi par l'utilisateur. Accepte un export ou un plan seul. */
export async function importer(fichier) {
  const donnees = JSON.parse(await fichier.text());
  if (donnees.format === 'jdr-carte') return { plan: donnees.salles?.[0], texte: donnees.texte || '', reglages: donnees.reglages };
  return { plan: donnees, texte: '' };
}
