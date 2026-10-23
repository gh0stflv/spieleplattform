/** Leitet Tastatur, Klicks, Wischgesten, Mausrad und Ziehen an das aktive Spiel weiter. */
const SPIELTASTEN = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]);
const ZIEHEN_AB_PX = 8; // erst ab dieser Strecke wird aus einem Klick ein Ziehen

export class Eingabe {
  #spiel = null;
  #canvas;
  #wischStart = null;
  #letzte = null; // letzte Zeigerposition beim Ziehen
  #gezogen = false;

  constructor(canvas) {
    this.#canvas = canvas;
    window.addEventListener("keydown", (e) => this.#taste(e));
    canvas.addEventListener("pointerdown", (e) => this.#zeigerRunter(e));
    canvas.addEventListener("pointerup", (e) => this.#zeigerHoch(e));
    canvas.addEventListener("pointermove", (e) => {
      if (!this.#spiel) return;
      if (this.#wischStart) this.#ziehen(e);
      if (e.pointerType !== "mouse") return;
      const { x, y } = this.#position(e);
      this.#spiel.verarbeiteZeiger(x, y);
    });
    canvas.addEventListener("wheel", (e) => {
      if (!this.#spiel) return;
      const { x, y } = this.#position(e);
      if (this.#spiel.verarbeiteRad(x, y, e.deltaY)) e.preventDefault(); // Seite nur scrollen, wenn das Spiel nichts damit macht
    }, { passive: false });
  }

  registriere(spiel) { this.#spiel = spiel; }
  abmelden() { this.#spiel = null; }

  #taste(e) {
    if (!this.#spiel || e.target.closest?.("input, textarea, button")) return;
    if (SPIELTASTEN.has(e.key)) e.preventDefault();
    const pauseTasten = this.#spiel.constructor.ohnePause ? ["Escape"] : [" ", "p", "Escape"];
    if (pauseTasten.includes(e.key)) {
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
    this.#letzte = this.#wischStart;
    this.#gezogen = false;
    try { this.#canvas.setPointerCapture(e.pointerId); } catch { /* z. B. synthetische Ereignisse */ }
    const { x, y } = this.#position(e);
    this.#spiel.verarbeiteDruck(x, y);
  }

  /** Bei gedrückter Taste: Verschiebung in Spielkoordinaten melden, wenn das Spiel Ziehen unterstützt. */
  #ziehen(e) {
    if (!this.#gezogen && Math.hypot(e.clientX - this.#wischStart.x, e.clientY - this.#wischStart.y) < ZIEHEN_AB_PX) return;
    const r = this.#canvas.getBoundingClientRect();
    const dx = ((e.clientX - this.#letzte.x) / r.width) * this.#spiel.breite;
    const dy = ((e.clientY - this.#letzte.y) / r.height) * this.#spiel.hoehe;
    this.#letzte = { x: e.clientX, y: e.clientY };
    if (this.#spiel.verarbeiteZiehen(dx, dy)) this.#gezogen = true;
  }

  #zeigerHoch(e) {
    if (!this.#spiel || !this.#wischStart) return;
    const dx = e.clientX - this.#wischStart.x;
    const dy = e.clientY - this.#wischStart.y;
    this.#wischStart = null;
    if (this.#gezogen) { // war ein Verschieben, kein Klick
      const { x, y } = this.#position(e);
      this.#spiel.verarbeiteLoslassen(x, y);
      return;
    }
    if (Math.hypot(dx, dy) > 30) {
      const richtung = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "rechts" : "links") : (dy > 0 ? "unten" : "oben");
      this.#spiel.verarbeiteWischen(richtung);
    } else {
      const { x, y } = this.#position(e);
      this.#spiel.verarbeiteKlick(x, y);
    }
  }
}
