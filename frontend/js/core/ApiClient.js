/** Kapselt alle Aufrufe an die Flask-REST-API (JSON). */
export class ApiFehler extends Error {
  constructor(nachricht, status) {
    super(nachricht);
    this.status = status;
  }
}

export class ApiClient {
  async #anfrage(methode, pfad, daten) {
    const antwort = await fetch(`/api${pfad}`, {
      method: methode,
      headers: daten ? { "Content-Type": "application/json" } : {},
      body: daten ? JSON.stringify(daten) : undefined,
      keepalive: methode !== "GET",
    });
    const inhalt = await antwort.json().catch(() => null);
    if (!antwort.ok) {
      throw new ApiFehler(inhalt?.fehler ?? `Fehler ${antwort.status}`, antwort.status);
    }
    return inhalt;
  }

  holeSpiele() { return this.#anfrage("GET", "/spiele"); }
  sendeScore(spielId, name, punkte, dauerS) {
    return this.#anfrage("POST", "/scores", { spiel_id: spielId, name, punkte, dauer_s: dauerS });
  }
  holeBestenliste(spielId) { return this.#anfrage("GET", `/bestenliste/${encodeURIComponent(spielId)}`); }

  // Mehrspieler im lokalen Netzwerk
  serverInfo() { return this.#anfrage("GET", "/server"); }
  raumErstellen(spielId, maxSpieler) {
    return this.#anfrage("POST", "/raeume", { spiel_id: spielId, max_spieler: maxSpieler, name: this.gastName() });
  }
  raumBeitreten(code) {
    return this.#anfrage("POST", `/raeume/${encodeURIComponent(code)}/beitreten`, { name: this.gastName() });
  }
  raumWieder(code, token) { return this.#anfrage("POST", `/raeume/${encodeURIComponent(code)}/wieder`, { token }); }
  raumAbfragen(code, seit, token) {
    return this.#anfrage("GET", `/raeume/${encodeURIComponent(code)}?seit=${seit}&token=${encodeURIComponent(token)}`);
  }
  raumZug(code, token, nr, daten) {
    return this.#anfrage("POST", `/raeume/${encodeURIComponent(code)}/zug`, { token, nr, daten });
  }

  /** Name für LAN-Räume und die Bestenliste, im Browser gespeichert (es gibt keine Konten). */
  gastName() {
    try { return localStorage.getItem("gastName") || "Gast"; } catch { return "Gast"; }
  }
}

export const api = new ApiClient();
