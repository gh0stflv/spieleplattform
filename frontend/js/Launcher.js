import { api } from "./core/ApiClient.js";
import { Eingabe } from "./core/Eingabe.js";
import { GameLoop } from "./core/GameLoop.js";
import { Zustand } from "./core/Spiel.js";
import { SPIELE } from "./games/index.js";
import { escapeHtml } from "./seiten/kopfzeile.js";

/** Zeigt die Spielauswahl, startet Spiele und meldet Ergebnisse an die API. */
export class Launcher {
  constructor(wurzel, benutzer) {
    this.benutzer = benutzer;
    this.spiele = [];
    this.aktuell = null;
    this.el = {
      auswahl: wurzel.querySelector("#auswahl"),
      kacheln: wurzel.querySelector("#kacheln"),
      buehne: wurzel.querySelector("#buehne"),
      titel: wurzel.querySelector("#spiel-titel"),
      anzeige: wurzel.querySelector("#anzeige"),
      canvas: wurzel.querySelector("#spielfeld"),
      overlay: wurzel.querySelector("#overlay"),
      zurueck: wurzel.querySelector("#zurueck"),
    };
    this.loop = new GameLoop();
    this.eingabe = new Eingabe(this.el.canvas);
    this.el.zurueck.addEventListener("click", () => this.zeigeAuswahl());
    window.addEventListener("popstate", () => this.#nachUrl());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.aktuell?.zustand === Zustand.LAEUFT) this.aktuell.pausieren();
    });
  }

  async laden() {
    this.spiele = (await api.holeSpiele()).filter((s) => SPIELE[s.id]);
    this.el.kacheln.innerHTML = this.spiele.map((s) => `
      <button type="button" class="kachel" data-id="${escapeHtml(s.id)}">
        <span class="kachel-bild kachel-${escapeHtml(s.id)}"></span>
        <h3>${escapeHtml(s.name)}</h3>
        <p>${escapeHtml(s.beschreibung)}</p>
        <small>🎮 ${escapeHtml(s.steuerung)}</small>
      </button>`).join("");
    this.el.kacheln.querySelectorAll(".kachel").forEach((k) =>
      k.addEventListener("click", () => this.starteSpiel(k.dataset.id)));
    this.#nachUrl();
  }

  #nachUrl() {
    const id = new URLSearchParams(location.search).get("spiel");
    if (id && SPIELE[id]) this.starteSpiel(id, false);
    else this.zeigeAuswahl(false);
  }

  zeigeAuswahl(verlauf = true) {
    this.loop.stopp();
    this.eingabe.abmelden();
    this.aktuell = null;
    this.el.buehne.hidden = true;
    this.el.auswahl.hidden = false;
    if (verlauf) history.pushState({}, "", "launcher.html");
  }

  starteSpiel(id, verlauf = true) {
    const info = this.spiele.find((s) => s.id === id);
    if (!info) return;
    if (verlauf) history.pushState({}, "", `launcher.html?spiel=${encodeURIComponent(id)}`);
    this.info = info;
    this.el.auswahl.hidden = true;
    this.el.buehne.hidden = false;
    this.el.titel.textContent = info.name;
    const Klasse = SPIELE[id];
    this.aktuell = new Klasse(this.el.canvas, {
      beiPunkten: (wert, bezeichnung = "Punkte") => { this.el.anzeige.textContent = `${bezeichnung}: ${wert}`; },
      beiZustand: (z) => this.#zustandGeaendert(z),
      beiEnde: (ergebnis) => this.#spielVorbei(ergebnis),
    });
    this.eingabe.registriere(this.aktuell);
    this.loop.start(this.aktuell);
    this.el.anzeige.textContent = "";
    this.#zeigeOverlay(`
      <h2>${escapeHtml(info.name)}</h2>
      <p>${escapeHtml(info.beschreibung)}</p>
      <p class="steuerung">🎮 ${escapeHtml(info.steuerung)}</p>
      ${this.benutzer ? "" : '<p class="hinweis">Als Gast wird dein Ergebnis nicht gespeichert. <a href="login.html">Einloggen</a></p>'}
      <button type="button" class="knopf gross" data-aktion="start">Spiel starten</button>`);
  }

  #zeigeOverlay(html) {
    this.el.overlay.innerHTML = html;
    this.el.overlay.hidden = false;
    this.el.overlay.querySelector("[data-aktion=start]")?.addEventListener("click", () => {
      this.el.overlay.hidden = true;
      this.aktuell.starten();
    });
    this.el.overlay.querySelector("[data-aktion=weiter]")?.addEventListener("click", () => this.aktuell.pausieren());
    this.el.overlay.querySelector("[data-aktion=auswahl]")?.addEventListener("click", () => this.zeigeAuswahl());
    this.el.overlay.querySelector("button")?.focus();
  }

  #zustandGeaendert(zustand) {
    if (zustand === Zustand.PAUSE) {
      this.#zeigeOverlay(`
        <h2>Pause</h2>
        <button type="button" class="knopf gross" data-aktion="weiter">Weiter</button>
        <button type="button" class="knopf leise" data-aktion="auswahl">Zur Spielauswahl</button>`);
    } else if (zustand === Zustand.LAEUFT) {
      this.el.overlay.hidden = true;
    }
  }

  async #spielVorbei({ punkte, dauerS }) {
    const spielId = this.info.id;
    const knoepfe = `
      <button type="button" class="knopf gross" data-aktion="start">Nochmal</button>
      <button type="button" class="knopf leise" data-aktion="auswahl">Zur Spielauswahl</button>`;
    this.#zeigeOverlay(`<h2>Spiel vorbei</h2><p class="ergebnis">${punkte} Punkte</p><p>Speichere …</p>`);

    let meldung = "";
    if (this.benutzer) {
      try {
        const antwort = await api.sendeScore(spielId, punkte, dauerS);
        meldung = `<p>Dein bester Platz: <strong>#${antwort.platz}</strong></p>`;
        if (antwort.neue_erfolge.length) {
          meldung += `<div class="neue-erfolge">🏆 Neuer Erfolg: ${antwort.neue_erfolge
            .map((e) => `<strong>${escapeHtml(e.name)}</strong>`).join(", ")}</div>`;
        }
      } catch (fehler) {
        meldung = `<p class="fehler">Nicht gespeichert: ${escapeHtml(fehler.message)}</p>`;
      }
    } else {
      meldung = '<p class="hinweis">Als Gast nicht gespeichert. <a href="login.html">Einloggen</a></p>';
    }

    let tabelle = "";
    try {
      tabelle = this.#bestenlisteHtml(await api.holeBestenliste(spielId));
    } catch {
      tabelle = '<p class="fehler">Bestenliste nicht verfügbar.</p>';
    }
    if (this.aktuell?.zustand !== Zustand.VORBEI || this.info.id !== spielId) return; // inzwischen neu gestartet
    this.#zeigeOverlay(`
      <h2>Spiel vorbei</h2>
      <p class="ergebnis">${punkte} Punkte</p>
      ${meldung}
      <h3>Bestenliste</h3>
      ${tabelle}
      <div class="knopfreihe">${knoepfe}</div>`);
  }

  #bestenlisteHtml(liste) {
    if (!liste.length) return "<p>Noch keine Einträge. Sei die erste Person!</p>";
    const zeilen = liste.map((z) => `
      <tr class="${this.benutzer && z.benutzer_id === this.benutzer.id ? "ich" : ""}">
        <td>${z.platz}</td><td>${escapeHtml(z.name)}</td><td>${z.punkte}</td>
      </tr>`).join("");
    return `<table class="bestenliste"><thead><tr><th>#</th><th>Name</th><th>Punkte</th></tr></thead>
      <tbody>${zeilen}</tbody></table>`;
  }
}
