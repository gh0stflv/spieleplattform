import { api } from "./ApiClient.js";

const ABFRAGE_MS = 300;

/**
 * Verbindung zu einem Spielraum im lokalen Netzwerk.
 * Alle Ereignisse (auch die eigenen) kommen in fester Reihenfolge über beiEreignis an,
 * dadurch bleibt der Spielstand auf allen Geräten gleich.
 */
export class Raum {
  #timer = 0;
  #laeuft = false;
  #abfrageLaeuft = false;

  constructor(daten) {
    this.code = daten.code;
    this.token = daten.token;
    this.ich = daten.ich;
    this.seed = daten.seed;
    this.maxSpieler = daten.max_spieler;
    this.spieler = daten.spieler;
    this.verarbeitet = 0;
    this.beiEreignis = () => {};
    this.beiAenderung = () => {};
  }

  static async erstellen(spielId, maxSpieler = 2) {
    return new Raum(await api.raumErstellen(spielId, maxSpieler));
  }

  static async beitreten(code) {
    return new Raum(await api.raumBeitreten(code.trim().toUpperCase()));
  }

  get voll() { return this.spieler.length >= this.maxSpieler; }

  starte() {
    this.#laeuft = true;
    this.#abfragen();
  }

  stopp() {
    this.#laeuft = false;
    clearTimeout(this.#timer);
  }

  async #abfragen() {
    if (!this.#laeuft || this.#abfrageLaeuft) return;
    this.#abfrageLaeuft = true;
    clearTimeout(this.#timer);
    try {
      const stand = await api.raumAbfragen(this.code, this.verarbeitet);
      const vorher = this.spieler.length;
      this.spieler = stand.spieler;
      if (this.spieler.length !== vorher) this.beiAenderung(this);
      for (const e of stand.ereignisse) {
        if (!this.#laeuft || e.nr !== this.verarbeitet) continue;
        this.verarbeitet = e.nr + 1;
        this.beiEreignis(e);
      }
    } catch (fehler) {
      if (fehler.status === 404) { this.#laeuft = false; this.beiAenderung(this, "Der Raum existiert nicht mehr."); }
    } finally {
      this.#abfrageLaeuft = false;
      if (this.#laeuft) this.#timer = setTimeout(() => this.#abfragen(), ABFRAGE_MS);
    }
  }

  /** Schickt ein Ereignis an alle. Es wird erst angewendet, wenn es über die Abfrage zurückkommt. */
  async senden(daten) {
    try {
      await api.raumZug(this.code, this.token, this.verarbeitet, daten);
    } catch (fehler) {
      if (fehler.status !== 409) throw fehler; // 409: jemand war schneller, neu abfragen reicht
    }
    this.#abfragen();
  }
}
