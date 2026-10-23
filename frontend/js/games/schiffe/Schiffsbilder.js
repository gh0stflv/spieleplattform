// Stilisierte Schiffe in Draufsicht, nur mit Canvas-Pfaden gezeichnet.
// Gezeichnet wird immer waagerecht mit dem Bug nach rechts in einem Rechteck (laenge × 1 Feld);
// senkrechte Schiffe werden dafür um 90° gedreht (Bug zeigt dann nach unten).

/** Farbsätze: normal, versenkt (dunkelrot) und für die Vorschau beim Setzen (passt / passt nicht). */
export const PALETTEN = {
  normal: { rumpf: "#6c7789", deck: "#98a3b5", dunkel: "#353d4b", hell: "#d6dde7", flugdeck: "#4a5262", markierung: "#f0d27a" },
  versenkt: { rumpf: "#5e2a32", deck: "#7e3d47", dunkel: "#2a1115", hell: "#a65d67", flugdeck: "#45202a", markierung: "#a65d67" },
  gut: { rumpf: "#3d8a58", deck: "#62b47e", dunkel: "#1f4d33", hell: "#b4ecc7", flugdeck: "#2f6b45", markierung: "#d8f6e2" },
  falsch: { rumpf: "#a3404d", deck: "#c95c69", dunkel: "#561b23", hell: "#f3b3bb", flugdeck: "#7d2e38", markierung: "#f8d9dd" },
};

/** Umriss eines Rumpfs: flaches Heck links (abgerundete Ecken), lang zulaufender Bug rechts. */
function rumpfPfad(ctx, L, W, { rand, bug, heck }) {
  const p = W * rand;
  const h = W - 2 * p;
  const m = W / 2;
  const k = h * heck;
  const spitze = L - p;
  const bugStart = Math.max(L * 0.35, spitze - h * bug);
  const zug = (spitze - bugStart) * 0.62;
  ctx.beginPath();
  ctx.moveTo(p + k, p);
  ctx.lineTo(bugStart, p);
  ctx.bezierCurveTo(bugStart + zug, p, spitze, m - h * 0.12, spitze, m);
  ctx.bezierCurveTo(spitze, m + h * 0.12, bugStart + zug, W - p, bugStart, W - p);
  ctx.lineTo(p + k, W - p);
  ctx.quadraticCurveTo(p, W - p, p, W - p - k);
  ctx.lineTo(p, p + k);
  ctx.quadraticCurveTo(p, p, p + k, p);
  ctx.closePath();
  return { p, h, m, bugStart };
}

/** Rumpf mit Rand, hellerem Deck darauf und einer Glanzlinie oben. */
function rumpf(ctx, L, W, f, form) {
  const mass = rumpfPfad(ctx, L, W, form);
  ctx.fillStyle = f.rumpf;
  ctx.fill();
  ctx.lineWidth = Math.max(1, W * 0.04);
  ctx.strokeStyle = f.dunkel;
  ctx.stroke();
  const innen = { ...form, rand: form.rand + 0.07, bug: form.bug * 0.95 };
  rumpfPfad(ctx, L - W * 0.04, W, innen);
  ctx.fillStyle = f.deck;
  ctx.fill();
  ctx.strokeStyle = f.hell;
  ctx.globalAlpha *= 0.55;
  ctx.lineWidth = Math.max(1, W * 0.03);
  ctx.beginPath();
  ctx.moveTo(mass.p + mass.h * 0.5, mass.p + W * 0.05);
  ctx.lineTo(mass.bugStart, mass.p + W * 0.05);
  ctx.stroke();
  ctx.globalAlpha /= 0.55;
  return mass;
}

function kasten(ctx, x, y, b, h, r, fuellung, rand) {
  ctx.beginPath();
  ctx.roundRect(x, y, b, h, r);
  ctx.fillStyle = fuellung;
  ctx.fill();
  if (rand) { ctx.strokeStyle = rand; ctx.lineWidth = Math.max(1, h * 0.08); ctx.stroke(); }
}

/** Geschützturm: hinten rund, vorne abgeflacht, mit Rohren. richtung +1 = zum Bug, -1 = zum Heck. */
function turm(ctx, x, m, r, richtung, f, rohre = 2) {
  ctx.strokeStyle = f.dunkel;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1, r * 0.3);
  for (let i = 0; i < rohre; i++) {
    const dy = rohre === 1 ? 0 : (i - (rohre - 1) / 2) * r * 0.55;
    ctx.beginPath();
    ctx.moveTo(x, m + dy);
    ctx.lineTo(x + richtung * r * 2.3, m + dy);
    ctx.stroke();
  }
  const rund = r;
  const flach = r * 0.3;
  ctx.beginPath();
  ctx.roundRect(x - r * 1.05, m - r, r * 2.1, r * 2, richtung > 0 ? [rund, flach, flach, rund] : [flach, rund, rund, flach]);
  ctx.fillStyle = f.rumpf;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.2);
  ctx.stroke();
  // Sehschlitz an der Front
  ctx.strokeStyle = f.hell;
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.beginPath();
  ctx.moveTo(x + richtung * r * 0.55, m - r * 0.45);
  ctx.lineTo(x + richtung * r * 0.55, m + r * 0.45);
  ctx.stroke();
}

/** Kleines Nebengeschütz. */
function geschuetz(ctx, x, y, r, f) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = f.rumpf;
  ctx.fill();
  ctx.strokeStyle = f.dunkel;
  ctx.lineWidth = Math.max(0.8, r * 0.35);
  ctx.stroke();
}

/** Längs verlaufende Decksplanken. */
function planken(ctx, von, bis, m, W, f) {
  ctx.save();
  ctx.globalAlpha *= 0.28;
  ctx.strokeStyle = f.dunkel;
  ctx.lineWidth = Math.max(0.6, W * 0.015);
  ctx.beginPath();
  for (const dy of [-0.2, -0.07, 0.07, 0.2]) {
    ctx.moveTo(von, m + W * dy);
    ctx.lineTo(bis, m + W * dy);
  }
  ctx.stroke();
  ctx.restore();
}

/** Aufbauten (Brücke): unterste Stufe vorne zugespitzt, darauf kleinere Stufen und ein Mast. */
function aufbau(ctx, x, m, b, h, f, stufen = 2) {
  const links = x - b / 2;
  const rechts = x + b / 2;
  ctx.beginPath();
  ctx.moveTo(links + h * 0.15, m - h / 2);
  ctx.lineTo(rechts - h * 0.35, m - h / 2);
  ctx.lineTo(rechts, m);
  ctx.lineTo(rechts - h * 0.35, m + h / 2);
  ctx.lineTo(links + h * 0.15, m + h / 2);
  ctx.quadraticCurveTo(links, m + h / 2, links, m + h * 0.35);
  ctx.lineTo(links, m - h * 0.35);
  ctx.quadraticCurveTo(links, m - h / 2, links + h * 0.15, m - h / 2);
  ctx.fillStyle = f.rumpf;
  ctx.fill();
  ctx.strokeStyle = f.dunkel;
  ctx.lineWidth = Math.max(1, h * 0.08);
  ctx.stroke();
  for (let i = 1; i < stufen; i++) {
    const s = 1 - i * 0.3;
    kasten(ctx, x - (b * s) / 2 + b * 0.05 * i, m - (h * s) / 2, b * s * 0.8, h * s, h * 0.15 * s, i === stufen - 1 ? f.hell : f.deck, f.dunkel);
  }
  // Brückenfenster vorne
  ctx.fillStyle = f.dunkel;
  ctx.fillRect(rechts - h * 0.62, m - h * 0.22, h * 0.1, h * 0.44);
  // Mast mit Rah
  const mx = x - b * 0.05;
  ctx.strokeStyle = f.dunkel;
  ctx.lineWidth = Math.max(1, h * 0.07);
  ctx.beginPath();
  ctx.moveTo(mx, m - h * 0.62);
  ctx.lineTo(mx, m + h * 0.62);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mx, m, h * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = f.dunkel;
  ctx.fill();
}

function schornstein(ctx, x, m, r, f) {
  ctx.beginPath();
  ctx.ellipse(x, m, r * 1.25, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = f.rumpf;
  ctx.fill();
  ctx.strokeStyle = f.dunkel;
  ctx.lineWidth = Math.max(1, r * 0.25);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, m, r * 0.8, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = f.dunkel;
  ctx.fill();
}

/** Kleines Flugzeug von oben (für den Flugzeugträger), Nase nach rechts. */
function flugzeug(ctx, x, y, s, f) {
  ctx.fillStyle = f.hell;
  ctx.beginPath();
  ctx.moveTo(x + s, y);
  ctx.lineTo(x + s * 0.2, y - s * 0.14);
  ctx.lineTo(x - s * 0.05, y - s * 0.9);
  ctx.lineTo(x - s * 0.3, y - s * 0.9);
  ctx.lineTo(x - s * 0.25, y - s * 0.14);
  ctx.lineTo(x - s * 0.75, y - s * 0.12);
  ctx.lineTo(x - s * 0.95, y - s * 0.45);
  ctx.lineTo(x - s * 1.05, y - s * 0.45);
  ctx.lineTo(x - s * 1.0, y);
  ctx.lineTo(x - s * 1.05, y + s * 0.45);
  ctx.lineTo(x - s * 0.95, y + s * 0.45);
  ctx.lineTo(x - s * 0.75, y + s * 0.12);
  ctx.lineTo(x - s * 0.25, y + s * 0.14);
  ctx.lineTo(x - s * 0.3, y + s * 0.9);
  ctx.lineTo(x - s * 0.05, y + s * 0.9);
  ctx.lineTo(x + s * 0.2, y + s * 0.14);
  ctx.closePath();
  ctx.fill();
}

function flugzeugtraeger(ctx, L, W, f) {
  rumpfPfad(ctx, L, W, { rand: 0.1, bug: 0.9, heck: 0.15 });
  ctx.fillStyle = f.rumpf;
  ctx.fill();
  ctx.strokeStyle = f.dunkel;
  ctx.lineWidth = Math.max(1, W * 0.04);
  ctx.stroke();
  // Flugdeck: breiter als der Rumpf, vorne schräg abgeschnitten
  const o = W * 0.05;
  const u = W * 0.95;
  ctx.beginPath();
  ctx.moveTo(W * 0.2, o);
  ctx.lineTo(L - W * 0.55, o);
  ctx.lineTo(L - W * 0.12, W * 0.32);
  ctx.lineTo(L - W * 0.12, W * 0.62);
  ctx.lineTo(L - W * 0.5, u);
  ctx.lineTo(W * 0.35, u);
  ctx.lineTo(W * 0.12, W * 0.7);
  ctx.lineTo(W * 0.12, W * 0.25);
  ctx.closePath();
  ctx.fillStyle = f.flugdeck;
  ctx.fill();
  ctx.stroke();
  // Start- und Landebahn
  ctx.strokeStyle = f.markierung;
  ctx.lineWidth = Math.max(1, W * 0.035);
  ctx.setLineDash([W * 0.18, W * 0.12]);
  ctx.beginPath();
  ctx.moveTo(W * 0.3, W * 0.5);
  ctx.lineTo(L - W * 0.3, W * 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha *= 0.6;
  ctx.beginPath();
  ctx.moveTo(W * 0.3, W * 0.3);
  ctx.lineTo(L * 0.55, W * 0.18);
  ctx.moveTo(W * 0.3, W * 0.7);
  ctx.lineTo(L * 0.55, W * 0.82);
  ctx.stroke();
  ctx.globalAlpha /= 0.6;
  // Insel (Brücke) an Steuerbord
  kasten(ctx, L * 0.6, W * 0.66, W * 0.85, W * 0.26, W * 0.06, f.deck, f.dunkel);
  kasten(ctx, L * 0.6 + W * 0.15, W * 0.7, W * 0.4, W * 0.17, W * 0.04, f.hell, f.dunkel);
  schornstein(ctx, L * 0.6 + W * 0.68, W * 0.79, W * 0.07, f);
  // geparkte Flugzeuge
  for (const [fx, fy] of [[0.13, 0.27], [0.23, 0.27], [0.33, 0.27], [0.8, 0.3]]) flugzeug(ctx, L * fx, W * fy, W * 0.13, f);
}

function schlachtschiff(ctx, L, W, f) {
  const { m, bugStart } = rumpf(ctx, L, W, f, { rand: 0.12, bug: 2.3, heck: 0.25 });
  planken(ctx, W * 0.3, bugStart + W * 0.3, m, W, f);
  const r = W * 0.16;
  turm(ctx, W * 0.72, m, r, -1, f, 3);
  turm(ctx, W * 1.32, m, r, -1, f, 3);
  turm(ctx, L - W * 1.85, m, r, 1, f, 3);
  turm(ctx, L - W * 1.25, m, r, 1, f, 3);
  for (const dx of [-0.55, -0.15, 0.25]) {
    for (const dy of [-0.24, 0.24]) geschuetz(ctx, L * 0.5 + W * dx, m + W * dy, W * 0.05, f);
  }
  schornstein(ctx, L * 0.5 - W * 0.62, m, W * 0.12, f);
  aufbau(ctx, L * 0.5, m, W * 0.85, W * 0.4, f, 3);
}

function kreuzer(ctx, L, W, f) {
  const { m, bugStart } = rumpf(ctx, L, W, f, { rand: 0.14, bug: 2.1, heck: 0.25 });
  planken(ctx, W * 0.3, bugStart + W * 0.25, m, W, f);
  const r = W * 0.14;
  turm(ctx, W * 0.68, m, r, -1, f);
  turm(ctx, L - W * 1.6, m, r, 1, f);
  turm(ctx, L - W * 1.05, m, r, 1, f);
  for (const dy of [-0.23, 0.23]) geschuetz(ctx, L * 0.4, m + W * dy, W * 0.045, f);
  schornstein(ctx, L * 0.42 - W * 0.32, m, W * 0.1, f);
  aufbau(ctx, L * 0.42 + W * 0.17, m, W * 0.66, W * 0.36, f, 2);
}

function zerstoerer(ctx, L, W, f) {
  const { m } = rumpf(ctx, L, W, f, { rand: 0.17, bug: 2.0, heck: 0.25 });
  turm(ctx, W * 0.5, m, W * 0.11, -1, f, 1);
  turm(ctx, L - W * 0.95, m, W * 0.12, 1, f, 1);
  // Torpedorohre zwischen Heckgeschütz und Schornstein
  for (const dy of [-0.09, 0.09]) kasten(ctx, W * 0.82, m + W * dy - W * 0.035, W * 0.38, W * 0.07, W * 0.035, f.dunkel);
  schornstein(ctx, L * 0.5 - W * 0.12, m, W * 0.09, f);
  aufbau(ctx, L * 0.5 + W * 0.4, m, W * 0.55, W * 0.3, f, 2);
}

function uboot(ctx, L, W, f) {
  const p = W * 0.1;
  const h = W * 0.44;
  const m = W / 2;
  // Kreuzleitwerk am Heck
  ctx.strokeStyle = f.dunkel;
  ctx.lineWidth = Math.max(1, W * 0.06);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(p + W * 0.18, m - h * 0.62);
  ctx.lineTo(p + W * 0.18, m + h * 0.62);
  ctx.stroke();
  // Rumpf: stumpfer Bug rechts, spitz zulaufendes Heck links
  ctx.beginPath();
  ctx.moveTo(p, m);
  ctx.bezierCurveTo(p + W * 0.35, m - h * 0.2, W * 0.6, m - h / 2, W, m - h / 2);
  ctx.lineTo(L - W * 0.45, m - h / 2);
  ctx.bezierCurveTo(L - p * 0.4, m - h / 2, L - p * 0.4, m + h / 2, L - W * 0.45, m + h / 2);
  ctx.lineTo(W, m + h / 2);
  ctx.bezierCurveTo(W * 0.6, m + h / 2, p + W * 0.35, m + h * 0.2, p, m);
  ctx.closePath();
  ctx.fillStyle = f.dunkel;
  ctx.fill();
  ctx.strokeStyle = f.rumpf;
  ctx.lineWidth = Math.max(1, W * 0.035);
  ctx.stroke();
  // Glanz und Luken
  ctx.save();
  ctx.globalAlpha *= 0.6;
  ctx.strokeStyle = f.rumpf;
  ctx.beginPath();
  ctx.moveTo(W * 0.75, m - h * 0.24);
  ctx.lineTo(L - W * 0.5, m - h * 0.24);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = f.rumpf;
  for (const fx of [0.28, 0.82]) {
    ctx.beginPath();
    ctx.arc(L * fx, m, W * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  // Turm mit Tiefenrudern
  const tx = L * 0.58;
  ctx.strokeStyle = f.rumpf;
  ctx.lineWidth = Math.max(1, W * 0.05);
  ctx.beginPath();
  ctx.moveTo(tx + W * 0.05, m - h * 0.62);
  ctx.lineTo(tx + W * 0.05, m + h * 0.62);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(tx, m, W * 0.27, W * 0.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = f.rumpf;
  ctx.fill();
  ctx.strokeStyle = f.hell;
  ctx.lineWidth = Math.max(1, W * 0.025);
  ctx.stroke();
  ctx.fillStyle = f.hell;
  ctx.beginPath();
  ctx.arc(tx + W * 0.13, m, W * 0.03, 0, Math.PI * 2);
  ctx.fill();
}

function schnellboot(ctx, L, W, f) {
  const { m } = rumpf(ctx, L, W, f, { rand: 0.24, bug: 1.6, heck: 0.15 });
  // Kielwasser-Streifen am Heck
  ctx.save();
  ctx.globalAlpha *= 0.5;
  ctx.strokeStyle = f.hell;
  ctx.lineWidth = Math.max(1, W * 0.03);
  ctx.beginPath();
  ctx.moveTo(W * 0.03, m - W * 0.12);
  ctx.lineTo(W * 0.2, m - W * 0.12);
  ctx.moveTo(W * 0.03, m + W * 0.12);
  ctx.lineTo(W * 0.2, m + W * 0.12);
  ctx.stroke();
  ctx.restore();
  // Kajüte mit Windschutzscheibe
  kasten(ctx, W * 0.3, m - W * 0.13, W * 0.26, W * 0.26, W * 0.06, f.rumpf, f.dunkel);
  ctx.fillStyle = f.dunkel;
  ctx.beginPath();
  ctx.moveTo(W * 0.56, m - W * 0.13);
  ctx.lineTo(W * 0.64, m - W * 0.08);
  ctx.lineTo(W * 0.64, m + W * 0.08);
  ctx.lineTo(W * 0.56, m + W * 0.13);
  ctx.closePath();
  ctx.fill();
  geschuetz(ctx, W * 0.74, m, W * 0.05, f);
}

const ZEICHNER = { 6: flugzeugtraeger, 5: schlachtschiff, 4: kreuzer, 3: zerstoerer, 2: uboot, 1: schnellboot };

/** Zeichnet ein Schiff der Länge laenge mit linker oberer Ecke (x, y) und Feldgröße c. */
export function zeichneSchiff(ctx, laenge, x, y, c, senkrecht, farben = PALETTEN.normal, deckkraft = 1) {
  ctx.save();
  ctx.globalAlpha *= deckkraft;
  if (senkrecht) {
    ctx.translate(x + c, y);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(x, y);
  }
  ctx.lineJoin = "round";
  (ZEICHNER[laenge] ?? schnellboot)(ctx, laenge * c, c, farben);
  ctx.restore();
}
