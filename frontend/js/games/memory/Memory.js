import { Spiel, Spielobjekt, Zustand } from "../../core/Spiel.js";

const SPALTEN = 4;
const ZEILEN = 4;
const ABSTAND = 12;
const SYMBOLE = ["🐍", "🎮", "👾", "🚀", "⭐", "🍕", "🎲", "🐙"];
const ZURUECKDREHEN_S = 0.8;
const MAX_PUNKTE = 1000;

class Karte extends Spielobjekt {
  constructor(x, y, groesse, symbol) {
    super(x, y, groesse, groesse);
    this.symbol = symbol;
    this.aufgedeckt = false;
    this.gefunden = false;
    this.drehung = 0; // 0 = Rückseite, 1 = Vorderseite (für Animation)
  }

  update(dt) {
    const ziel = this.aufgedeckt || this.gefunden ? 1 : 0;
    this.drehung += Math.sign(ziel - this.drehung) * Math.min(Math.abs(ziel - this.drehung), dt * 6);
  }

  zeichnen(ctx) {
    const skala = Math.abs(Math.cos(this.drehung * Math.PI));
    const vorne = this.drehung > 0.5;
    const b = this.breite * Math.max(skala, 0.02);
    const x = this.x + (this.breite - b) / 2;
    ctx.fillStyle = this.gefunden ? "#2d4a3a" : vorne ? "#f4f1e8" : "#5b6cff";
    ctx.beginPath();
    ctx.roundRect(x, this.y, b, this.hoehe, 10);
    ctx.fill();
    if (vorne && skala > 0.2) {
      ctx.save();
      ctx.translate(this.x + this.breite / 2, this.y + this.hoehe / 2);
      ctx.scale(skala, 1);
      ctx.globalAlpha = this.gefunden ? 0.6 : 1;
      ctx.font = `${this.breite * 0.5}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.symbol, 0, 4);
      ctx.restore();
    } else if (!vorne) {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = `bold ${this.breite * 0.35}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", this.x + this.breite / 2, this.y + this.hoehe / 2 + 2);
    }
  }
}

export class Memory extends Spiel {
  constructor(canvas, rueckrufe) {
    super("Memory", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  zuruecksetzen() {
    const symbole = [...SYMBOLE, ...SYMBOLE];
    for (let i = symbole.length - 1; i > 0; i--) { // Fisher-Yates
      const j = Math.floor(Math.random() * (i + 1));
      [symbole[i], symbole[j]] = [symbole[j], symbole[i]];
    }
    const groesse = (this.breite - ABSTAND * (SPALTEN + 1)) / SPALTEN;
    this.karten = symbole.map((s, i) => new Karte(
      ABSTAND + (i % SPALTEN) * (groesse + ABSTAND),
      ABSTAND + Math.floor(i / SPALTEN) * (groesse + ABSTAND),
      groesse, s));
    this.offen = [];
    this.versuche = 0;
    this.wartezeit = 0;
  }

  /** Punkte: 1000 minus Abzug für Fehlversuche und Zeit, mindestens 10. */
  berechnePunkte() {
    const fehlversuche = this.versuche - this.karten.length / 2;
    return Math.max(10, Math.min(MAX_PUNKTE, MAX_PUNKTE - fehlversuche * 40 - Math.floor(this.spielzeit) * 2));
  }

  verarbeiteKlick(x, y) {
    if (this.zustand !== Zustand.LAEUFT || this.wartezeit > 0) return;
    const karte = this.karten.find((k) => k.enthaelt(x, y));
    if (!karte || karte.aufgedeckt || karte.gefunden) return;
    karte.aufgedeckt = true;
    this.offen.push(karte);
    if (this.offen.length === 2) {
      this.versuche++;
      const [a, b] = this.offen;
      if (a.symbol === b.symbol) {
        a.gefunden = b.gefunden = true;
        this.offen = [];
        if (this.karten.every((k) => k.gefunden)) {
          this.punkte = this.berechnePunkte();
          this.rueckrufe.beiPunkten?.(this.punkte);
          this.beenden();
        }
      } else {
        this.wartezeit = ZURUECKDREHEN_S;
      }
    }
  }

  update(dt) {
    this.karten.forEach((k) => k.update(dt));
    if (this.wartezeit > 0) {
      this.wartezeit -= dt;
      if (this.wartezeit <= 0) {
        this.offen.forEach((k) => { k.aufgedeckt = false; });
        this.offen = [];
      }
    }
    this.rueckrufe.beiPunkten?.(this.versuche, "Versuche");
  }

  zeichnen() {
    const { ctx } = this;
    ctx.fillStyle = "#14171f";
    ctx.fillRect(0, 0, this.breite, this.hoehe);
    this.karten.forEach((k) => k.zeichnen(ctx));
  }
}
