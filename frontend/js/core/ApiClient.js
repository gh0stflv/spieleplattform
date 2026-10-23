/** Kapselt alle Aufrufe an die Flask-REST-API (JSON + Session-Cookie). */
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
      credentials: "same-origin",
    });
    const inhalt = await antwort.json().catch(() => null);
    if (!antwort.ok) {
      throw new ApiFehler(inhalt?.fehler ?? `Fehler ${antwort.status}`, antwort.status);
    }
    return inhalt;
  }

  registrieren(name, passwort, email) { return this.#anfrage("POST", "/registrieren", { name, passwort, email }); }
  login(name, passwort) { return this.#anfrage("POST", "/login", { name, passwort }); }
  logout() { return this.#anfrage("POST", "/logout"); }
  ich() { return this.#anfrage("GET", "/ich"); }
  holeSpiele() { return this.#anfrage("GET", "/spiele"); }
  sendeScore(spielId, punkte, dauerS) {
    return this.#anfrage("POST", "/scores", { spiel_id: spielId, punkte, dauer_s: dauerS });
  }
  holeBestenliste(spielId) { return this.#anfrage("GET", `/bestenliste/${encodeURIComponent(spielId)}`); }
  holeProfil() { return this.#anfrage("GET", "/profil"); }
  kontoLoeschen() { return this.#anfrage("DELETE", "/konto"); }

  // Mehrspieler im lokalen Netzwerk
  serverInfo() { return this.#anfrage("GET", "/server"); }
  raumErstellen(spielId, maxSpieler) {
    return this.#anfrage("POST", "/raeume", { spiel_id: spielId, max_spieler: maxSpieler, name: this.gastName() });
  }
  raumBeitreten(code) {
    return this.#anfrage("POST", `/raeume/${encodeURIComponent(code)}/beitreten`, { name: this.gastName() });
  }
  raumAbfragen(code, seit) { return this.#anfrage("GET", `/raeume/${encodeURIComponent(code)}?seit=${seit}`); }
  raumZug(code, token, nr, daten) {
    return this.#anfrage("POST", `/raeume/${encodeURIComponent(code)}/zug`, { token, nr, daten });
  }

  /** Name für nicht eingeloggte Mitspieler (der Server nimmt sonst den Kontonamen). */
  gastName() {
    try { return localStorage.getItem("gastName") || "Gast"; } catch { return "Gast"; }
  }
}

export const api = new ApiClient();
