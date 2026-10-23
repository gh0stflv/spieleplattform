// Gemeinsames Zeichnen von Spielkarten (Blackjack, Spider, …).
// Karte = Zahl 0–51: Farbe * 13 + Rang (Rang 0 = Ass … 12 = König; Farbe ♠ ♥ ♦ ♣).
export const RANG = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "B", "D", "K"];
export const FARBEN = ["♠", "♥", "♦", "♣"];
export const KARTEN_FORMAT = 1.42; // Höhe / Breite

export const rangVon = (karte) => karte % 13;
export const farbeVon = (karte) => Math.floor(karte / 13) % 4;

const SCHRIFT = 'system-ui, "Segoe UI", sans-serif';

function text(ctx, inhalt, x, y, groesse, farbe, ausrichtung = "center", fett = false) {
  ctx.font = `${fett ? "700 " : ""}${groesse}px ${SCHRIFT}`;
  ctx.fillStyle = farbe;
  ctx.textAlign = ausrichtung;
  ctx.textBaseline = "middle";
  ctx.fillText(inhalt, x, y);
}

/**
 * Zeichnet eine Karte mit der linken oberen Ecke bei (x, y) und Breite b.
 * kompakt: Rang und Farbe stehen nebeneinander ganz oben, damit sie auch bei
 * senkrecht überlappenden Karten (Solitaire) lesbar bleiben.
 */
export function zeichneKarte(ctx, karte, x, y, b, { verdeckt = false, kompakt = false } = {}) {
  const h = b * KARTEN_FORMAT;
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 3, b, h, b * 0.1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x, y, b, h, b * 0.1);
  if (verdeckt) {
    ctx.fillStyle = "#2f3f9a";
    ctx.fill();
    ctx.strokeStyle = "#e8eaf0";
    ctx.lineWidth = Math.max(1, b * 0.03);
    ctx.beginPath();
    ctx.roundRect(x + b * 0.1, y + b * 0.1, b * 0.8, h - b * 0.2, b * 0.06);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = "#fbfaf6";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.18)";
  ctx.lineWidth = 1;
  ctx.stroke();
  const farbe = farbeVon(karte);
  const ton = farbe === 1 || farbe === 2 ? "#c8283c" : "#1d2029";
  const rang = RANG[rangVon(karte)];
  if (kompakt) {
    text(ctx, rang, x + b * 0.08, y + b * 0.17, b * 0.27, ton, "left", true);
    text(ctx, FARBEN[farbe], x + b * 0.92, y + b * 0.17, b * 0.25, ton, "right");
    text(ctx, FARBEN[farbe], x + b * 0.5, y + h * 0.6, b * 0.62, ton);
    return;
  }
  text(ctx, rang, x + b * 0.08, y + b * 0.2, b * 0.3, ton, "left", true);
  text(ctx, FARBEN[farbe], x + b * 0.08, y + b * 0.48, b * 0.24, ton, "left");
  text(ctx, FARBEN[farbe], x + b * 0.58, y + h * 0.62, b * 0.62, ton);
}
