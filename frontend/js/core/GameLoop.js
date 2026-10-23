/** Ruft spiel.tick(dt) über requestAnimationFrame auf (dt in Sekunden, gedeckelt). */
export class GameLoop {
  #spiel = null;
  #letzte = 0;
  #id = 0;

  start(spiel) {
    this.stopp();
    this.#spiel = spiel;
    this.#letzte = performance.now();
    const schritt = (jetzt) => {
      const dt = Math.min((jetzt - this.#letzte) / 1000, 0.1);
      this.#letzte = jetzt;
      this.#spiel.tick(dt);
      this.#id = requestAnimationFrame(schritt);
    };
    this.#id = requestAnimationFrame(schritt);
  }

  stopp() {
    cancelAnimationFrame(this.#id);
    this.#spiel = null;
  }
}
