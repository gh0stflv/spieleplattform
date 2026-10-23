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
}

export const api = new ApiClient();
