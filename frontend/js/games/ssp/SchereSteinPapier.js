import { Spiel, Zustand } from "../../core/Spiel.js";

const WAHLEN = ["schere", "stein", "papier"];
const SYMBOL = { schere: "✌️", stein: "✊", papier: "✋" };
const NAME = { schere: "Schere", stein: "Stein", papier: "Papier" };
const SCHLAEGT = { schere: "papier", stein: "schere", papier: "stein" };
const ZIEL_SIEGE = 3;
const ZEIGEN_S = 1.6;

const KNOPF_Y = 360;
const KNOPF_B = 130;
const KNOPF_ABSTAND = 20;
const knopfX = (i) => (480 - 3 * KNOPF_B - 2 * KNOPF_ABSTAND) / 2 + i * (KNOPF_B + KNOPF_ABSTAND);

/** Computer: merkt sich, was du nach deiner letzten Wahl gern nimmst, und kontert das. */
class Gegner {
  constructor() { this.folgen = {}; this.letzte = null; }

  waehle() {
    const statistik = this.letzte && this.folgen[this.letzte];
    if (!statistik || Math.random() < 0.3) return WAHLEN[Math.floor(Math.random() * 3)];
    const erwartet = WAHLEN.reduce((a, b) => ((statistik[a] ?? 0) >= (statistik[b] ?? 0) ? a : b));
    return WAHLEN.find((w) => SCHLAEGT[w] === erwartet);
  }

  lerne(menschWahl) {
    if (this.letzte) {
      this.folgen[this.letzte] ??= {};
      this.folgen[this.letzte][menschWahl] = (this.folgen[this.letzte][menschWahl] ?? 0) + 1;
    }
    this.letzte = menschWahl;
  }
}

export class SchereSteinPapier extends Spiel {
  static ohnePause = true;
  static modi = [
    { id: "computer", name: "Gegen Computer" },
    { id: "lan", name: "Im Netzwerk (LAN) spielen", lan: true },
  ];

  constructor(canvas, rueckrufe) {
    super("Schere Stein Papier", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  get imLan() { return this.modus === "lan"; }
  get gewertet() { return !this.imLan; }
  get ich() { return this.imLan ? this.raum?.ich ?? 0 : 0; }

  spielerName(seite) {
    if (this.imLan) return this.raum?.spieler[seite] ?? `Spieler ${seite + 1}`;
    return seite === 0 ? "Du" : "Computer";
  }

  get ergebnisText() {
    const sieger = this.siege[0] >= ZIEL_SIEGE ? 0 : 1;
    if (sieger === this.ich) return "Du hast gewonnen!";
    return this.imLan ? `${this.spielerName(sieger)} gewinnt!` : "Der Computer gewinnt.";
  }

  zuruecksetzen() {
    this.siege = [0, 0];
    this.runde = 1;
    this.wahl = [null, null];
    this.phase = "waehlen"; // waehlen | zeigen
    this.zeit = 0;
    this.gegner ??= new Gegner();
    this.verlauf = [];
    this.zeiger = -1;
  }

  #status() {
    this.rueckrufe.beiPunkten?.(`${this.siege[0]} : ${this.siege[1]}`, `Runde ${this.runde}`);
  }

  starten(modus) {
    super.starten(modus);
    this.#status();
  }

  pausieren() {} // kein Zeitdruck, Pause nicht nötig

  #waehle(wahl) {
    if (this.zustand !== Zustand.LAEUFT || this.phase !== "waehlen" || this.wahl[this.ich]) return;
    if (this.imLan) {
      this.wahl[this.ich] = "gesendet"; // Platzhalter bis das Ereignis zurückkommt
      this.raum?.senden({ typ: "wahl", runde: this.runde, wahl }).catch(() => { this.wahl[this.ich] = null; });
      return;
    }
    this.wahl[0] = wahl;
    this.wahl[1] = this.gegner.waehle();
    this.gegner.lerne(wahl);
    this.#aufdecken();
  }

  empfangeEreignis({ von, daten }) {
    if (daten?.typ !== "wahl" || daten.runde !== this.runde || !WAHLEN.includes(daten.wahl)) return;
    if (this.phase !== "waehlen" || (von !== 0 && von !== 1)) return;
    this.wahl[von] = daten.wahl;
    if (WAHLEN.includes(this.wahl[0]) && WAHLEN.includes(this.wahl[1])) this.#aufdecken();
  }

  #aufdecken() {
    this.phase = "zeigen";
    this.zeit = 0;
    const [a, b] = this.wahl;
    this.rundenSieger = a === b ? null : SCHLAEGT[a] === b ? 0 : 1;
  }

  #rundeBeenden() {
    if (this.rundenSieger !== null) this.siege[this.rundenSieger]++;
    this.verlauf.push({ wahl: [...this.wahl], sieger: this.rundenSieger });
    if (this.siege[0] >= ZIEL_SIEGE || this.siege[1] >= ZIEL_SIEGE) {
      if (!this.imLan && this.siege[0] >= ZIEL_SIEGE) this.punkte = 100 + (ZIEL_SIEGE - this.siege[1]) * 30;
      this.#status();
      this.beenden();
      return;
    }
    this.runde++;
    this.wahl = [null, null];
    this.phase = "waehlen";
    this.#status();
  }

  update(dt) {
    this.zeit += dt;
    if (this.phase === "zeigen" && this.zeit >= ZEIGEN_S) this.#rundeBeenden();
  }

  verarbeiteEingabe(taste) {
    const i = ["1", "2", "3"].indexOf(taste);
    if (i >= 0) this.#waehle(WAHLEN[i]);
  }

  #knopf(x, y) {
    if (y < KNOPF_Y || y > KNOPF_Y + KNOPF_B) return -1;
    return [0, 1, 2].find((i) => x >= knopfX(i) && x <= knopfX(i) + KNOPF_B) ?? -1;
  }

  verarbeiteKlick(x, y) {
    const i = this.#knopf(x, y);
    if (i >= 0) this.#waehle(WAHLEN[i]);
  }

  verarbeiteZeiger(x, y) { this.zeiger = this.#knopf(x, y); }

  #text(text, x, y, groesse, farbe = "#e8eaf0", gewicht = "600") {
    const { ctx } = this;
    ctx.fillStyle = farbe;
    ctx.font = `${gewicht} ${groesse}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  }

  zeichnen() {
    const { ctx } = this;
    ctx.fillStyle = "#14171f";
    ctx.fillRect(0, 0, this.breite, this.hoehe);

    const gegnerSeite = 1 - this.ich;
    this.#text(this.spielerName(gegnerSeite), 360, 40, 18, "#9aa1b4");
    this.#text(this.imLan ? "Du" : "Du", 120, 40, 18, "#9aa1b4");
    this.#text(`${this.siege[this.ich]}`, 120, 78, 34, "#7cf29a", "800");
    this.#text(`${this.siege[gegnerSeite]}`, 360, 78, 34, "#ff6b6b", "800");
    this.#text(`Wer zuerst ${ZIEL_SIEGE} Runden gewinnt`, 240, 78, 13, "#9aa1b4", "400");

    if (this.phase === "zeigen") {
      // „Schütteln“, dann zeigen
      const wackeln = this.zeit < 0.6 ? Math.sin(this.zeit * 30) * 14 : 0;
      const zeigen = this.zeit >= 0.6;
      this.#text(zeigen ? SYMBOL[this.wahl[this.ich]] : "✊", 120, 210 + wackeln, 90);
      this.#text(zeigen ? SYMBOL[this.wahl[gegnerSeite]] : "✊", 360, 210 + wackeln, 90);
      if (zeigen) {
        const text = this.rundenSieger === null ? "Unentschieden"
          : this.rundenSieger === this.ich ? `${NAME[this.wahl[this.ich]]} schlägt ${NAME[this.wahl[gegnerSeite]]}!`
            : `${NAME[this.wahl[gegnerSeite]]} schlägt ${NAME[this.wahl[this.ich]]}`;
        const farbe = this.rundenSieger === null ? "#e8eaf0" : this.rundenSieger === this.ich ? "#7cf29a" : "#ff6b6b";
        this.#text(text, 240, 310, 20, farbe, "700");
      }
    } else {
      const meine = this.wahl[this.ich];
      const seine = this.wahl[gegnerSeite];
      this.#text(meine ? "✔️" : "❔", 120, 210, 70);
      this.#text(seine ? "✔️" : "❔", 360, 210, 70);
      this.#text(meine ? "Warte auf die andere Wahl …" : "Wähle!", 240, 310, 18, "#9aa1b4", "500");
    }

    const aktiv = this.zustand === Zustand.LAEUFT && this.phase === "waehlen" && !this.wahl[this.ich];
    WAHLEN.forEach((w, i) => {
      const x = knopfX(i);
      ctx.fillStyle = aktiv ? (this.zeiger === i ? "#4152e6" : "#2a2f40") : "#1d212c";
      ctx.beginPath();
      ctx.roundRect(x, KNOPF_Y, KNOPF_B, KNOPF_B - 30, 14);
      ctx.fill();
      ctx.globalAlpha = aktiv ? 1 : 0.4;
      this.#text(SYMBOL[w], x + KNOPF_B / 2, KNOPF_Y + 38, 42);
      this.#text(`${i + 1} · ${NAME[w]}`, x + KNOPF_B / 2, KNOPF_Y + 82, 13, "#c9cede", "500");
      ctx.globalAlpha = 1;
    });
  }
}
