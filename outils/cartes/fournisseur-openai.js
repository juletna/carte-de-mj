/**
 * Le seul fichier qui connaît le fournisseur d'images (OpenAI, gpt-image-1). Pour en changer : réécrire `construireRequete` et `appeler`.
 * La clé vient de OPENAI_API_KEY ; elle n'est ni écrite, ni affichée.
 */
export const MODELE = 'gpt-image-1';
const URL_GENERATION = 'https://api.openai.com/v1/images/generations';
const URL_EDITION = 'https://api.openai.com/v1/images/edits';

/** Décrit la requête sans l'envoyer (pour --essai). `references` : [{ nom, type }] (les octets ne sont lus qu'à l'envoi). */
export function construireRequete({ prompt, taille = '1024x1536', format = 'webp', qualite = 'high', references = [] }) {
  const champs = { model: MODELE, prompt, size: taille, quality: qualite, output_format: format, n: 1 };
  return references.length
    ? { methode: 'POST', url: URL_EDITION, type: 'multipart/form-data', champs, images: references.map((r) => r.nom) }
    : { methode: 'POST', url: URL_GENERATION, type: 'application/json', champs, images: [] };
}

/** Envoie la requête ; `references` : [{ nom, type, octets }]. Rend les octets de l'image. */
export async function appeler(requete, { cle, references = [] }) {
  if (!cle) throw new Error('OPENAI_API_KEY absente de l\'environnement.');
  const entetes = { Authorization: `Bearer ${cle}` };
  let corps;
  if (requete.type === 'application/json') {
    entetes['Content-Type'] = 'application/json';
    corps = JSON.stringify(requete.champs);
  } else {
    corps = new FormData();
    for (const [k, v] of Object.entries(requete.champs)) corps.append(k, String(v));
    for (const r of references) corps.append('image[]', new Blob([r.octets], { type: r.type }), r.nom);
  }
  const reponse = await fetch(requete.url, { method: requete.methode, headers: entetes, body: corps });
  const texte = await reponse.text();
  let json;
  try { json = JSON.parse(texte); } catch { json = null; }
  if (!reponse.ok) throw new Error(`API ${reponse.status} : ${json?.error?.message ?? texte.slice(0, 300)}`);
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error('Réponse sans image.');
  return Buffer.from(b64, 'base64');
}
