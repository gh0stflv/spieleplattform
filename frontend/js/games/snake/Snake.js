import { Spiel, Spielobjekt, Zustand } from "../../core/Spiel.js";

const ZELLEN = 20;
const ZELLE = 24; // px → 480 / 20
const START_TEMPO = 7; // Felder pro Sekunde
const MAX_TEMPO = 14;
const PUNKTE_PRO_FUTTER = 10;

const RICHTUNGEN = {
  oben: { x: 0, y: -1 }, unten: { x: 0, y: 1 }, links: { x: -1, y: 0 }, rechts: { x: 1, y: 0 },
};
const TASTEN = {
  ArrowUp: "oben", w: "oben", W: "oben",
  ArrowDown: "unten", s: "unten", S: "unten",
  ArrowLeft: "links", a: "links", A: "links",
  ArrowRight: "rechts", d: "rechts", D: "rechts",
};

class Schlange extends Spielobjekt {
  constructor() {
    super(0, 0, ZELLE, ZELLE);
    const mitte = Math.floor(ZELLEN / 2);
    this.glieder = [{ x: mitte, y: mitte }, { x: mitte - 1, y: mitte }, { x: mitte - 2, y: mitte }];
    this.richtung = RICHTUNGEN.rechts;
    this.warteschlange = []; // gepufferte Richtungswechsel, damit schnelle Tastendrücke nicht verloren gehen
    this.wachsen = 0;
  }

  get kopf() { return this.glieder[0]; }

  lenke(name) {
    const neu = RICHTUNGEN[name];
    const letzte = this.warteschlange.at(-1) ?? this.richtung;
    if (neu.x === -letzte.x && neu.y === -letzte.y) return; // keine 180°-Wende
    if (neu === letzte || this.warteschlange.length >= 2) return;
    this.warteschlange.push(neu);
  }

  naechsterKopf() {
    if (this.warteschlange.length) this.richtung = this.warteschlange.shift();
    return { x: this.kopf.x + this.richtung.x, y: this.kopf.y + this.richtung.y };
  }

  bewege(kopf) {
    this.glieder.unshift(kopf);
    if (this.wachsen > 0) this.wachsen--;
    else this.glieder.pop();
  }

  trifft(feld, ohneSchwanz = false) {
    const teile = ohneSchwanz && this.wachsen === 0 ? this.glieder.slice(0, -1) : this.glieder;
    return teile.some((g) => g.x === feld.x && g.y === feld.y);
  }

  zeichnen(ctx) {
    this.glieder.forEach((g, i) => {
      ctx.fillStyle = i === 0 ? "#7CF29A" : `hsl(140, 60%, ${48 - Math.min(i, 20)}%)`;
      ctx.beginPath();
      ctx.roundRect(g.x * ZELLE + 1, g.y * ZELLE + 1, ZELLE - 2, ZELLE - 2, 6);
      ctx.fill();
    });
  }
}

class Futter extends Spielobjekt {
  constructor(feld) {
    super(feld.x, feld.y, ZELLE, ZELLE);
    this.phase = 0;
  }

  update(dt) { this.phase += dt * 4; }

  zeichnen(ctx) {
    const r = ZELLE / 2 - 3 + Math.sin(this.phase) * 1.5;
    ctx.fillStyle = "#FF6B6B";
    ctx.beginPath();
    ctx.arc(this.x * ZELLE + ZELLE / 2, this.y * ZELLE + ZELLE / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Snake extends Spiel {
  constructor(canvas, rueckrufe) {
    super("Snake", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  zuruecksetzen() {
    this.schlange = new Schlange();
    this.futter = new Futter(this.#freiesFeld());
    this.tempo = START_TEMPO;
    this.akku = 0;
  }

  #freiesFeld() {
    const frei = [];
    for (let x = 0; x < ZELLEN; x++) {
      for (let y = 0; y < ZELLEN; y++) {
        if (!this.schlange.trifft({ x, y })) frei.push({ x, y });
      }
    }
    return frei[Math.floor(Math.random() * frei.length)];
  }

  verarbeiteEingabe(taste) {
    if (TASTEN[taste]) this.schlange.lenke(TASTEN[taste]);
  }

  verarbeiteWischen(richtung) {
    this.schlange.lenke(richtung);
  }

  update(dt) {
    this.futter.update(dt);
    this.akku += dt;
    const schritt = 1 / this.tempo;
    while (this.akku >= schritt && this.zustand === Zustand.LAEUFT) {
      this.akku -= schritt;
      this.#schritt();
    }
  }

  #schritt() {
    const kopf = this.schlange.naechsterKopf();
    const wand = kopf.x < 0 || kopf.y < 0 || kopf.x >= ZELLEN || kopf.y >= ZELLEN;
    if (wand || this.schlange.trifft(kopf, true)) {
      this.beenden();
      return;
    }
    this.schlange.bewege(kopf);
    if (kopf.x === this.futter.x && kopf.y === this.futter.y) {
      this.schlange.wachsen += 1;
      this.addierePunkte(PUNKTE_PRO_FUTTER);
      this.tempo = Math.min(MAX_TEMPO, this.tempo + 0.25);
      const feld = this.#freiesFeld();
      if (!feld) { this.beenden(); return; } // Spielfeld voll – gewonnen
      this.futter = new Futter(feld);
    }
  }

  zeichnen() {
    const { ctx } = this;
    ctx.fillStyle = "#14171f";
    ctx.fillRect(0, 0, this.breite, this.hoehe);
    ctx.fillStyle = "#1a1e28";
    for (let x = 0; x < ZELLEN; x++) {
      for (let y = (x % 2); y < ZELLEN; y += 2) ctx.fillRect(x * ZELLE, y * ZELLE, ZELLE, ZELLE);
    }
    this.futter.zeichnen(ctx);
    this.schlange.zeichnen(ctx);
  }
}
