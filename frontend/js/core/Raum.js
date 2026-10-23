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
  #abfrage = null; // laufende Abfrage, damit senden() auf sie warten kann

  constructor(daten) {
    this.code = daten.code;
    this.token = daten.token;
    this.ich = daten.ich;
    this.seed = daten.seed;
    this.maxSpieler = daten.max_spieler;
    this.spieler = daten.spieler;
    this.verbunden = daten.verbunden ?? daten.spieler.map(() => true);
    this.verarbeitet = 0; // beim Wiedereinstieg werden alle Ereignisse ab 0 erneut abgespielt
    this.beiEreignis = () => {};
    this.beiAenderung = () => {};
  }

  static async erstellen(spielId, maxSpieler = 2) {
    return new Raum(await api.raumErstellen(spielId, maxSpieler));
  }

  static async beitreten(code) {
    return new Raum(await api.raumBeitreten(code.trim().toUpperCase()));
  }

  /** Nach dem Neuladen: denselben Platz mit dem gemerkten Token wieder einnehmen. */
  static async wieder(code, token) {
    return new Raum(await api.raumWieder(code, token));
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

  /** Holt neue Ereignisse. Läuft schon eine Abfrage, wird auf diese gewartet. */
  #abfragen() {
    if (!this.#laeuft) return Promise.resolve();
    this.#abfrage ??= this.#abfrageAusfuehren().finally(() => {
      this.#abfrage = null;
      if (this.#laeuft) this.#timer = setTimeout(() => this.#abfragen(), ABFRAGE_MS);
    });
    return this.#abfrage;
  }

  async #abfrageAusfuehren() {
    clearTimeout(this.#timer);
    try {
      const stand = await api.raumAbfragen(this.code, this.verarbeitet, this.token);
      const vorher = `${this.spieler.length}|${this.verbunden.join()}`;
      this.spieler = stand.spieler;
      this.verbunden = stand.verbunden ?? this.verbunden;
      if (`${this.spieler.length}|${this.verbunden.join()}` !== vorher) this.beiAenderung(this);
      for (const e of stand.ereignisse) {
        if (!this.#laeuft || e.nr !== this.verarbeitet) continue;
        this.verarbeitet = e.nr + 1;
        this.beiEreignis(e);
      }
    } catch (fehler) {
      if (fehler.status === 404) { this.#laeuft = false; this.beiAenderung(this, "Der Raum existiert nicht mehr."); }
    }
  }

  /** Schickt ein Ereignis an alle. Es wird erst angewendet, wenn es über die Abfrage zurückkommt. */
  async senden(daten) {
    for (let versuch = 1; ; versuch++) {
      try {
        await api.raumZug(this.code, this.token, this.verarbeitet, daten);
        break;
      } catch (fehler) {
        // 409: jemand war schneller. Neuen Stand holen und nochmal senden, die Spiele prüfen jedes Ereignis selbst.
        if (fehler.status !== 409 || versuch >= 5 || !this.#laeuft) throw fehler;
        await this.#abfragen();
      }
    }
    this.#abfragen();
  }
}
