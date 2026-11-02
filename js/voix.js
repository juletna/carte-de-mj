/**
 * Dictée vocale via la Web Speech API (fr-FR).
 *
 * Disponible dans Chrome, Edge et Safari ; absente de Firefox.
 * Attention : dans Chrome/Edge, la reconnaissance passe par les serveurs
 * de Google (connexion requise, la voix quitte la machine).
 */
const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;

export const voixDisponible = Boolean(Reconnaissance);

/**
 * Crée un micro prêt à l'emploi.
 * @param {{onTexte:(texte:string, final:boolean)=>void, onEtat:(actif:boolean)=>void, onErreur:(msg:string)=>void}} rappels
 * @returns {{basculer:()=>void} | null} null si l'API n'existe pas
 */
export function creerMicro({ onTexte, onEtat, onErreur }) {
  if (!Reconnaissance) return null;
  const rec = new Reconnaissance();
  rec.lang = 'fr-FR';
  rec.interimResults = true; // texte provisoire pendant qu'on parle
  rec.continuous = true;

  let actif = false;
  let base = ''; // texte déjà validé avant cette session de dictée

  rec.onresult = (e) => {
    let final = '', provisoire = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript; else provisoire += r[0].transcript;
    }
    if (final) base = (base + ' ' + final).trim();
    onTexte((base + ' ' + provisoire).trim(), Boolean(final) && !provisoire);
  };
  rec.onerror = (e) => {
    const messages = {
      'not-allowed': "Accès au micro refusé. Autorise-le dans les réglages du navigateur.",
      'no-speech': 'Aucune parole détectée.',
      network: 'La dictée a besoin d’une connexion Internet dans ce navigateur.',
    };
    onErreur(messages[e.error] || `Erreur de dictée : ${e.error}`);
  };
  rec.onend = () => { actif = false; onEtat(false); };

  return {
    basculer(texteActuel = '') {
      if (actif) { rec.stop(); return; }
      base = texteActuel.trim();
      rec.start();
      actif = true;
      onEtat(true);
    },
  };
}
