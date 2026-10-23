/** Leitet Tastatur, Klicks und Wischgesten an das aktive Spiel weiter. */
const SPIELTASTEN = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]);

export class Eingabe {
  #spiel = null;
  #canvas;
  #wischStart = null;

  constructor(canvas) {
    this.#canvas = canvas;
    window.addEventListener("keydown", (e) => this.#taste(e));
    canvas.addEventListener("pointerdown", (e) => this.#zeigerRunter(e));
    canvas.addEventListener("pointerup", (e) => this.#zeigerHoch(e));
    canvas.addEventListener("pointermove", (e) => {
      if (!this.#spiel || e.pointerType !== "mouse") return;
      const { x, y } = this.#position(e);
      this.#spiel.verarbeiteZeiger(x, y);
    });
  }

  registriere(spiel) { this.#spiel = spiel; }
  abmelden() { this.#spiel = null; }

  #taste(e) {
    if (!this.#spiel || e.target.closest?.("input, textarea, button")) return;
    if (SPIELTASTEN.has(e.key)) e.preventDefault();
    if (e.key === " " || e.key === "p" || e.key === "Escape") {
      this.#spiel.pausieren();
      return;
    }
    this.#spiel.verarbeiteEingabe(e.key);
  }

  #position(e) {
    const r = this.#canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * this.#spiel.breite,
      y: ((e.clientY - r.top) / r.height) * this.#spiel.hoehe,
    };
  }

  #zeigerRunter(e) {
    if (!this.#spiel) return;
    this.#wischStart = { x: e.clientX, y: e.clientY };
  }

  #zeigerHoch(e) {
    if (!this.#spiel || !this.#wischStart) return;
    const dx = e.clientX - this.#wischStart.x;
    const dy = e.clientY - this.#wischStart.y;
    this.#wischStart = null;
    if (Math.hypot(dx, dy) > 30) {
      const richtung = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "rechts" : "links") : (dy > 0 ? "unten" : "oben");
      this.#spiel.verarbeiteWischen(richtung);
    } else {
      const { x, y } = this.#position(e);
      this.#spiel.verarbeiteKlick(x, y);
    }
  }
}
