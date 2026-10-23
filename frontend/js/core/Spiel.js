/** Gemeinsame Basis aller Spiele. Neue Spiele erben von Spiel und werden in games/index.js registriert. */
export const Zustand = Object.freeze({
  BEREIT: "BEREIT",
  LAEUFT: "LAEUFT",
  PAUSE: "PAUSE",
  VORBEI: "VORBEI",
});

export class Spiel {
  static breite = 480;
  static hoehe = 480;

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ beiPunkten?: (p:number)=>void, beiEnde?: (ergebnis:{punkte:number, dauerS:number})=>void,
   *           beiZustand?: (z:string)=>void }} rueckrufe
   */
  constructor(name, canvas, rueckrufe = {}) {
    if (new.target === Spiel) throw new TypeError("Spiel ist abstrakt");
    this.name = name;
    this.canvas = canvas;
    this.rueckrufe = rueckrufe;
    this.punkte = 0;
    this.zustand = Zustand.BEREIT;
    this.spielzeit = 0; // Sekunden, ohne Pausen
    this.#canvasVorbereiten();
  }

  get breite() { return this.constructor.breite; }
  get hoehe() { return this.constructor.hoehe; }

  #canvasVorbereiten() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.breite * dpr;
    this.canvas.height = this.hoehe * dpr;
    this.canvas.style.aspectRatio = `${this.breite} / ${this.hoehe}`;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  #setzeZustand(zustand) {
    this.zustand = zustand;
    this.rueckrufe.beiZustand?.(zustand);
  }

  starten() {
    this.punkte = 0;
    this.spielzeit = 0;
    this.zuruecksetzen();
    this.rueckrufe.beiPunkten?.(0);
    this.#setzeZustand(Zustand.LAEUFT);
  }

  pausieren() {
    if (this.zustand === Zustand.LAEUFT) this.#setzeZustand(Zustand.PAUSE);
    else if (this.zustand === Zustand.PAUSE) this.#setzeZustand(Zustand.LAEUFT);
  }

  beenden() {
    if (this.zustand === Zustand.VORBEI) return;
    this.#setzeZustand(Zustand.VORBEI);
    this.meldeErgebnis();
  }

  /** Wird vom GameLoop jeden Frame aufgerufen. */
  tick(dt) {
    if (this.zustand === Zustand.LAEUFT) {
      this.spielzeit += dt;
      this.update(dt);
    }
    this.zeichnen();
  }

  addierePunkte(anzahl) {
    this.punkte += anzahl;
    this.rueckrufe.beiPunkten?.(this.punkte);
  }

  meldeErgebnis() {
    this.rueckrufe.beiEnde?.({ punkte: Math.round(this.punkte), dauerS: Math.round(this.spielzeit * 10) / 10 });
  }

  // --- von Unterklassen zu implementieren ---
  zuruecksetzen() { throw new Error(`${this.name}: zuruecksetzen() fehlt`); }
  update(_dt) { throw new Error(`${this.name}: update() fehlt`); }
  zeichnen() { throw new Error(`${this.name}: zeichnen() fehlt`); }
  verarbeiteEingabe(_taste) {}
  verarbeiteKlick(_x, _y) {}
  verarbeiteWischen(_richtung) {}
}

/** Basis für alles, was im Spiel gezeichnet wird. */
export class Spielobjekt {
  constructor(x, y, breite, hoehe) {
    if (new.target === Spielobjekt) throw new TypeError("Spielobjekt ist abstrakt");
    Object.assign(this, { x, y, breite, hoehe });
  }

  enthaelt(px, py) {
    return px >= this.x && px < this.x + this.breite && py >= this.y && py < this.y + this.hoehe;
  }

  update(_dt) {}
  zeichnen(_ctx) { throw new Error("zeichnen() fehlt"); }
}
