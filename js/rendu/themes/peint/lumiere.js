/**
 * La couche de lumière du thème peint : pénombre teintée, trous radiaux autour des sources, halos colorés, flammes animées.
 * Les calculs (opacité, couleurs, liste des sources, vacillement) sont dans rendu/lumiere.js ; ici, seulement le dessin.
 *
 * Deux temps, pour que l'animation ne redessine que l'essentiel (voir moteur.js) :
 *   creerCouche(decor, {ambiance})   une fois par salle : la « couche sombre » (le décor multiplié par la couleur d'ambiance) et un voile de travail
 *   eclairer(ctx, couche, {...})     à chaque image : le voile (la couche sombre percée autour des sources) à l'opacité de la pénombre, les halos
 *                                    colorés en `screen`, puis, si elles sont animées, les flammes. Les pions et les marques sont dessinés après, par le moteur.
 */
import { creerToile } from '../../toile.js';
import { couleurAmbiance, intensiteHalo, vacille, FLAMME_PAR_DEFAUT } from '../../lumiere.js';
import { ENCRE } from './trait.js';

/**
 * La couche sombre d'un décor déjà dessiné (`decor` : un canevas), ou `null` quand le navigateur ne sait pas fabriquer de canevas hors écran
 * (le voile est alors un simple aplat, voir `eclairer`).
 * @param {{width:number, height:number}} decor
 * @param {{ambiance?:string}} [options]
 */
export function creerCouche(decor, { ambiance } = {}) {
  const l = decor.width, h = decor.height, sombre = creerToile(l, h), voile = creerToile(l, h);
  if (!sombre || !voile) return null;
  const g = sombre.getContext('2d');
  g.drawImage(decor, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = `rgb(${couleurAmbiance(ambiance).join(',')})`;
  g.fillRect(0, 0, l, h);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(40,40,60,0.15)';
  g.fillRect(0, 0, l, h);
  return { sombre, voile, l, h };
}

/**
 * Pose la lumière sur `ctx`, qui contient le décor (en pixels physiques ; la transformation en vigueur est remise à la fin).
 * @param {object|null} couche  celle de `creerCouche`
 * @param {{sources:object[], opacite:number, ms?:number, salle:number[], anime?:boolean}} p
 *        sources = listeSources() ; opacite = celle du voile (opaciteVoile) ; ms = l'instant (vacillement) ; salle = matrice [a,b,c,d,e,f] du repère de la salle ;
 *        anime = dessiner aussi les flammes (sinon les objets ont leur petite flamme fixe)
 */
export function eclairer(ctx, couche, { sources, opacite, ms = 0, salle, anime = false }) {
  const t = ms / 1000;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (opacite > 0) {
    if (couche) {
      const v = couche.voile.getContext('2d');
      v.setTransform(1, 0, 0, 1, 0, 0);
      v.globalCompositeOperation = 'source-over';
      v.clearRect(0, 0, couche.l, couche.h);
      v.drawImage(couche.sombre, 0, 0);
      v.setTransform(...salle);
      v.globalCompositeOperation = 'destination-out';
      for (const s of sources) {
        const rr = s.r * (0.93 + 0.08 * (s.m ? pulse(t, s.x) : vacille(t, s.x))), g = v.createRadialGradient(s.x, s.y, 0, s.x, s.y, rr);
        g.addColorStop(0, `rgba(0,0,0,${Math.min(1, s.k + 0.3)})`);
        g.addColorStop(0.45, `rgba(0,0,0,${s.k * 0.8})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        v.fillStyle = g;
        v.fillRect(s.x - rr, s.y - rr, rr * 2, rr * 2);
      }
      ctx.globalAlpha = opacite;
      ctx.drawImage(couche.voile, 0, 0);
      ctx.globalAlpha = 1;
    } else { // pas de canevas hors écran : un voile uni (pas de trous)
      ctx.fillStyle = `rgba(${couleurAmbiance().join(',')},${opacite})`;
      ctx.fillRect(0, 0, ctx.canvas?.width || 0, ctx.canvas?.height || 0);
    }
  }
  ctx.setTransform(...salle);
  ctx.globalCompositeOperation = 'screen';
  const force = intensiteHalo(opacite);
  for (const s of sources) {
    const rr = s.r * 0.7, a = s.k * (0.3 + 0.12 * (s.m ? pulse(t, s.y) : vacille(t, s.y))) * force, g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rr);
    g.addColorStop(0, `rgba(${s.c},${a})`);
    g.addColorStop(1, `rgba(${s.c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(s.x - rr, s.y - rr, rr * 2, rr * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  if (anime) for (const s of sources) if (s.s) flamme(ctx, s.x, s.y, s.s, t, s.graine, s.petite, s.f, s.m);
  ctx.restore();
}

/** Pulsation d'un feu magique : un nombre autour de 0,5, lent et régulier (le vacillement d'une flamme ordinaire est vif et irrégulier). */
const pulse = (t, s) => 0.5 + 0.3 * Math.sin(t * 2.1 + s) + 0.12 * Math.sin(t * 3.4 + s * 1.7);

/** Une flamme qui danse : goutte cernée d'encre (orange par défaut, `f.flamme`) au cœur clair (`f.coeur`) ; `s` px de haut, `t` en secondes, `graine` décale la phase. `magique` : plus lente, qui pulse. */
function flamme(ctx, x, y, s, t, graine, petite, f = FLAMME_PAR_DEFAUT, magique = false) {
  if (magique) { s *= 1 + 0.1 * Math.sin(t * 2.1 + graine); t *= 0.45; }
  const forme = (k, dec) => {
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      let rr = s * k * (0.85 + 0.14 * Math.sin(a * 3 + t * 7 + graine) + 0.08 * Math.sin(a * 5 - t * 11 + graine));
      rr *= 1 + 0.75 * Math.max(0, -Math.sin(a)) * (0.85 + 0.3 * vacille(t, graine));
      ctx.lineTo(x + Math.cos(a) * rr * 0.8 + Math.sin(t * 4 + graine) * dec * Math.max(0, -Math.sin(a)), y + Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  forme(1, s * 0.15); ctx.fillStyle = f.flamme; ctx.fill(); ctx.lineWidth = petite ? 0.6 : 1.3; ctx.strokeStyle = ENCRE; ctx.stroke();
  forme(0.55, s * 0.1); ctx.fillStyle = f.coeur; ctx.fill();
}
