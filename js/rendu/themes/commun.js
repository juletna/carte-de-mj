/**
 * Primitives Canvas communes aux thèmes (vectoriel, papier) : un rectangle, un rectangle arrondi, un rond, chacun rempli
 * puis cerné si on le demande. L'ordre des appels au contexte est celui que les journaux de rendu de tests/references.js
 * fixent : ne pas le changer. Les corps d'objets restent dans chaque thème, ils ne se ressemblent pas.
 */
export function rect(ctx, x, y, w, h, fond, trait, epaisseur = 1) {
  ctx.beginPath(); ctx.rect(x, y, w, h);
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (trait) { ctx.strokeStyle = trait; ctx.lineWidth = epaisseur; ctx.stroke(); }
}
export function rectArrondi(ctx, x, y, w, h, r, fond, trait, epaisseur = 1) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (trait) { ctx.strokeStyle = trait; ctx.lineWidth = epaisseur; ctx.stroke(); }
}
export function rond(ctx, x, y, r, fond, trait, epaisseur = 1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fond) { ctx.fillStyle = fond; ctx.fill(); }
  if (trait) { ctx.strokeStyle = trait; ctx.lineWidth = epaisseur; ctx.stroke(); }
}
