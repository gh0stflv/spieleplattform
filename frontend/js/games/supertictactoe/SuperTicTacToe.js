import { RundenSpiel } from "../../core/RundenSpiel.js";
import { Zustand } from "../../core/Spiel.js";

const LINIEN = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const RAND = 6;
const GROSS = (480 - 2 * RAND) / 3;
const KLEIN = GROSS / 3;
const OFFEN = 0;
const REMIS = 3; // kleines Feld voll ohne Sieger
const FARBEN = ["#ff5b6e", "#5bc8ff"];

const STUFEN = {
  leicht: { tiefe: 1, zufall: 0.4 },
  mittel: { tiefe: 3, zufall: 0.05 },
  schwer: { tiefe: 5, zufall: 0 },
};

function liniensieger(felder) {
  for (const [a, b, c] of LINIEN) {
    if (felder[a] && felder[a] !== REMIS && felder[a] === felder[b] && felder[a] === felder[c]) return felder[a];
  }
  return 0;
}

/** Spielstand ohne Darstellung: Werte 1 = X (Seite 0), 2 = O (Seite 1). */
class Stand {
  constructor() {
    this.zellen = Array.from({ length: 9 }, () => new Array(9).fill(0));
    this.gross = new Array(9).fill(OFFEN);
    this.ziel = -1; // Feld, in dem gespielt werden muss, -1 = frei
  }

  erlaubt(index) {
    const b = Math.floor(index / 9);
    return this.gross[b] === OFFEN && this.zellen[b][index % 9] === 0 && (this.ziel === -1 || this.ziel === b);
  }

  zuege() {
    const liste = [];
    for (let b = 0; b < 9; b++) {
      if (this.gross[b] !== OFFEN || (this.ziel !== -1 && this.ziel !== b)) continue;
      for (let c = 0; c < 9; c++) if (this.zellen[b][c] === 0) liste.push(b * 9 + c);
    }
    return liste;
  }

  /** Setzt und liefert alles zurück, was zum Rückgängigmachen nötig ist. */
  setze(index, wert) {
    const b = Math.floor(index / 9);
    const c = index % 9;
    const vorher = { index, ziel: this.ziel, gross: this.gross[b] };
    this.zellen[b][c] = wert;
    const sieger = liniensieger(this.zellen[b]);
    if (sieger) this.gross[b] = sieger;
    else if (this.zellen[b].every((z) => z !== 0)) this.gross[b] = REMIS;
    this.ziel = this.gross[c] === OFFEN ? c : -1;
    return vorher;
  }

  zurueck({ index, ziel, gross }) {
    const b = Math.floor(index / 9);
    this.zellen[b][index % 9] = 0;
    this.gross[b] = gross;
    this.ziel = ziel;
  }

  /** 1 oder 2 = Sieger, REMIS = unentschieden, 0 = läuft. */
  ende() {
    const sieger = liniensieger(this.gross);
    if (sieger) return sieger;
    return this.gross.every((g) => g !== OFFEN) ? REMIS : 0;
  }

  /** Heuristik aus Sicht von wert. */
  bewerte(wert) {
    const gegner = 3 - wert;
    let summe = 0;
    const linienWert = (felder, gewicht) => {
      for (const linie of LINIEN) {
        let meine = 0;
        let seine = 0;
        for (const i of linie) {
          if (felder[i] === wert) meine++;
          else if (felder[i] === gegner) seine++;
          else if (felder[i] === REMIS) { meine = -9; seine = -9; }
        }
        if (meine > 0 && seine === 0) summe += gewicht * (meine === 2 ? 4 : 1);
        if (seine > 0 && meine === 0) summe -= gewicht * (seine === 2 ? 4 : 1);
      }
    };
    linienWert(this.gross, 30);
    for (let b = 0; b < 9; b++) {
      if (this.gross[b] === wert) summe += b === 4 ? 25 : 18;
      else if (this.gross[b] === gegner) summe -= b === 4 ? 25 : 18;
      else if (this.gross[b] === OFFEN) linienWert(this.zellen[b], 1);
    }
    return summe;
  }
}

function besterZug(stand, wert, tiefe) {
  const suche = (t, alpha, beta, amZug) => {
    const e = stand.ende();
    if (e === wert) return 10000 + t;
    if (e === 3 - wert) return -10000 - t;
    if (e === REMIS) return 0;
    if (t === 0) return stand.bewerte(wert);
    let bester = amZug === wert ? -Infinity : Infinity;
    for (const z of stand.zuege()) {
      const rueck = stand.setze(z, amZug);
      const w = suche(stand.ziel === -1 ? Math.max(0, t - 2) : t - 1, alpha, beta, 3 - amZug);
      stand.zurueck(rueck);
      if (amZug === wert) { bester = Math.max(bester, w); alpha = Math.max(alpha, w); }
      else { bester = Math.min(bester, w); beta = Math.min(beta, w); }
      if (alpha >= beta) break;
    }
    return bester;
  };
  let zug = stand.zuege()[0];
  let bestWert = -Infinity;
  for (const z of stand.zuege()) {
    const rueck = stand.setze(z, wert);
    const w = suche(tiefe - 1, -Infinity, Infinity, 3 - wert) + Math.random(); // Zufall bei Gleichstand
    stand.zurueck(rueck);
    if (w > bestWert) { bestWert = w; zug = z; }
  }
  return zug;
}

export class SuperTicTacToe extends RundenSpiel {
  static seiten = ["X", "O"];
  static symbole = ["❌", "⭕"];

  constructor(canvas, rueckrufe) {
    super("Super Tic-Tac-Toe", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  zuruecksetzen() {
    this.stand = new Stand();
    this.letzter = -1;
    this.zeiger = -1;
    this.puls = 0;
  }

  zugErlaubt(index) {
    return Number.isInteger(index) && index >= 0 && index < 81 && this.stand.erlaubt(index);
  }

  zugAnwenden(index, seite) {
    this.stand.setze(index, seite + 1);
    this.letzter = index;
  }

  ergebnis() {
    const e = this.stand.ende();
    if (e === REMIS) return null;
    return e ? e - 1 : undefined;
  }

  botZug(stufe) {
    const { tiefe, zufall } = STUFEN[stufe];
    const zuege = this.stand.zuege();
    if (Math.random() < zufall) return zuege[Math.floor(Math.random() * zuege.length)];
    return besterZug(this.stand, 2, tiefe);
  }

  siegBonus() {
    return Math.max(0, 40 - Math.ceil(this.zuegeGesamt / 2)) * 2;
  }

  animieren(dt) { this.puls += dt; }

  #index(x, y) {
    const gx = Math.floor((x - RAND) / GROSS);
    const gy = Math.floor((y - RAND) / GROSS);
    if (gx < 0 || gy < 0 || gx > 2 || gy > 2) return -1;
    const kx = Math.floor((x - RAND - gx * GROSS) / KLEIN);
    const ky = Math.floor((y - RAND - gy * GROSS) / KLEIN);
    return (gy * 3 + gx) * 9 + Math.min(2, ky) * 3 + Math.min(2, kx);
  }

  verarbeiteKlick(x, y) {
    const i = this.#index(x, y);
    if (i >= 0) this.ziehe(i);
  }

  verarbeiteZeiger(x, y) { this.zeiger = this.#index(x, y); }

  #zelle(index) {
    const b = Math.floor(index / 9);
    const c = index % 9;
    return {
      x: RAND + (b % 3) * GROSS + (c % 3) * KLEIN,
      y: RAND + Math.floor(b / 3) * GROSS + Math.floor(c / 3) * KLEIN,
    };
  }

  #zeichen(ctx, wert, x, y, groesse, breite) {
    const m = groesse * 0.22;
    ctx.lineWidth = breite;
    ctx.lineCap = "round";
    ctx.strokeStyle = FARBEN[wert - 1];
    ctx.beginPath();
    if (wert === 1) {
      ctx.moveTo(x + m, y + m); ctx.lineTo(x + groesse - m, y + groesse - m);
      ctx.moveTo(x + groesse - m, y + m); ctx.lineTo(x + m, y + groesse - m);
    } else {
      ctx.arc(x + groesse / 2, y + groesse / 2, groesse / 2 - m, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  zeichnen() {
    const { ctx, stand } = this;
    ctx.fillStyle = "#14171f";
    ctx.fillRect(0, 0, this.breite, this.hoehe);

    const aktiv = this.zustand === Zustand.LAEUFT && this.sieger === undefined;
    for (let b = 0; b < 9; b++) {
      const bx = RAND + (b % 3) * GROSS;
      const by = RAND + Math.floor(b / 3) * GROSS;
      const erlaubt = aktiv && stand.gross[b] === OFFEN && (stand.ziel === -1 || stand.ziel === b);
      ctx.fillStyle = erlaubt
        ? `rgba(91,108,255,${0.16 + 0.06 * Math.sin(this.puls * 4)})`
        : "#191d27";
      ctx.beginPath();
      ctx.roundRect(bx + 4, by + 4, GROSS - 8, GROSS - 8, 10);
      ctx.fill();

      // feine Linien im kleinen Feld
      ctx.strokeStyle = "#2f3547";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 1; i < 3; i++) {
        ctx.moveTo(bx + i * KLEIN, by + 10); ctx.lineTo(bx + i * KLEIN, by + GROSS - 10);
        ctx.moveTo(bx + 10, by + i * KLEIN); ctx.lineTo(bx + GROSS - 10, by + i * KLEIN);
      }
      ctx.stroke();

      for (let c = 0; c < 9; c++) {
        const wert = stand.zellen[b][c];
        if (!wert) continue;
        const { x, y } = this.#zelle(b * 9 + c);
        ctx.globalAlpha = stand.gross[b] !== OFFEN ? 0.35 : 1;
        this.#zeichen(ctx, wert, x, y, KLEIN, 5);
        ctx.globalAlpha = 1;
      }
      if (stand.gross[b] === 1 || stand.gross[b] === 2) this.#zeichen(ctx, stand.gross[b], bx, by, GROSS, 12);
    }

    if (this.letzter >= 0) {
      const { x, y } = this.#zelle(this.letzter);
      ctx.strokeStyle = "rgba(255,255,255,.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 4, y + 4, KLEIN - 8, KLEIN - 8);
    }
    if (this.menschAmZug && this.zeiger >= 0 && stand.erlaubt(this.zeiger)) {
      const { x, y } = this.#zelle(this.zeiger);
      ctx.globalAlpha = 0.35;
      this.#zeichen(ctx, this.amZug + 1, x, y, KLEIN, 5);
      ctx.globalAlpha = 1;
    }
  }
}

export { Stand, besterZug };
