import { api } from "./core/ApiClient.js";
import { Eingabe } from "./core/Eingabe.js";
import { GameLoop } from "./core/GameLoop.js";
import { Raum } from "./core/Raum.js";
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
    window.addEventListener("pagehide", () => this.#raumVerlassen());
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
    this.#raumVerlassen();
    this.loop.stopp();
    this.eingabe.abmelden();
    this.aktuell = null;
    this.el.buehne.hidden = true;
    this.el.auswahl.hidden = false;
    if (verlauf) history.pushState({}, "", "launcher.html");
  }

  starteSpiel(id, verlauf = true) {
    this.#raumVerlassen();
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
      ${this.#startKnoepfe(Klasse)}`);
  }

  /** Ein Startknopf, oder einer pro Modus, wenn das Spiel static modi definiert. */
  #startKnoepfe(Klasse) {
    if (!Klasse.modi?.length) return '<button type="button" class="knopf gross" data-aktion="start">Spiel starten</button>';
    return `<div class="modi">${Klasse.modi.map((m, i) => `
      <button type="button" class="knopf ${i === 0 ? "gross" : "leise"}" data-aktion="start" data-modus="${escapeHtml(m.id)}">
        ${escapeHtml(m.name)}</button>`).join("")}</div>`;
  }

  #zeigeOverlay(html) {
    this.el.overlay.innerHTML = html;
    this.el.overlay.hidden = false;
    this.el.overlay.querySelectorAll("[data-aktion=start]").forEach((knopf) => knopf.addEventListener("click", () => {
      const modus = knopf.dataset.modus ?? this.aktuell.modus;
      if (this.raum) { this.raum.senden({ typ: "neustart" }); return; } // Revanche für alle im Raum
      if (this.aktuell.constructor.modi?.find((m) => m.id === modus)?.lan) { this.#lanMenue(); return; }
      this.el.overlay.hidden = true;
      this.aktuell.starten(modus);
    }));
    this.el.overlay.querySelector("[data-aktion=weiter]")?.addEventListener("click", () => this.aktuell.pausieren());
    this.el.overlay.querySelector("[data-aktion=auswahl]")?.addEventListener("click", () => this.zeigeAuswahl());
    this.el.overlay.querySelector("button")?.focus();
  }

  // ---------- Mehrspieler im lokalen Netzwerk ----------

  #lanMenue(meldung = "") {
    const gast = !this.benutzer;
    let gastName = "";
    try { gastName = localStorage.getItem("gastName") ?? ""; } catch { /* egal */ }
    this.#zeigeOverlay(`
      <h2>Im Netzwerk spielen</h2>
      <p class="hinweis">Alle müssen im selben WLAN/LAN sein und diese Seite über die Netzwerk-Adresse öffnen.</p>
      ${gast ? `<label class="lan-feld">Dein Name <input name="gastname" maxlength="20" placeholder="Gast" value="${escapeHtml(gastName)}"></label>` : ""}
      <button type="button" class="knopf gross" data-lan="erstellen">Raum erstellen</button>
      <form class="lan-beitreten" data-lan="beitreten">
        <input name="code" maxlength="4" placeholder="CODE" autocomplete="off" autocapitalize="characters" aria-label="Raum-Code">
        <button type="submit" class="knopf">Beitreten</button>
      </form>
      <p class="fehler" role="alert">${escapeHtml(meldung)}</p>
      <button type="button" class="knopf leise" data-aktion="auswahl">Zurück</button>`);
    const o = this.el.overlay;
    const nameMerken = () => {
      const feld = o.querySelector("[name=gastname]");
      if (feld) try { localStorage.setItem("gastName", feld.value.trim()); } catch { /* egal */ }
    };
    o.querySelector("[data-lan=erstellen]").addEventListener("click", async () => {
      nameMerken();
      try { this.#raumBetreten(await Raum.erstellen(this.info.id)); } catch (e) { this.#lanMenue(e.message); }
    });
    o.querySelector("[data-lan=beitreten]").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      nameMerken();
      const code = ev.target.code.value;
      if (code.trim().length !== 4) { this.#lanMenue("Der Code hat 4 Zeichen."); return; }
      try { this.#raumBetreten(await Raum.beitreten(code)); } catch (e) { this.#lanMenue(e.message); }
    });
  }

  #raumBetreten(raum) {
    this.raum = raum;
    raum.beiEreignis = (e) => this.#raumEreignis(e);
    raum.beiAenderung = (_r, fehler) => {
      if (fehler) { this.#raumVerlassen(false); this.#lanMenue(fehler); return; }
      if (this.aktuell.zustand === Zustand.BEREIT) this.#lanWarten();
    };
    raum.starte();
    this.#lanWarten();
  }

  async #lanWarten() {
    const raum = this.raum;
    if (raum.voll) { // alle da: jedes Gerät startet für sich, alles Weitere läuft über die Ereignisse
      this.el.overlay.hidden = true;
      this.aktuell.raum = raum;
      this.aktuell.starten("lan");
      return;
    }
    this.#zeigeOverlay(`
      <h2>Raum ${escapeHtml(raum.code)}</h2>
      <p class="raum-code">${escapeHtml(raum.code)}</p>
      <p>Warte auf Mitspieler (${raum.spieler.length}/${raum.maxSpieler}) …</p>
      <ul class="raum-spieler">${raum.spieler.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
      <p class="hinweis lan-adressen">Die anderen öffnen im selben Netzwerk die Plattform, wählen ${escapeHtml(this.info.name)}
        und treten mit dem Code bei.</p>
      <button type="button" class="knopf leise" data-aktion="auswahl">Abbrechen</button>`);
    try {
      const { lan_adressen: adressen } = await api.serverInfo();
      const ziel = this.el.overlay.querySelector(".lan-adressen");
      if (ziel && adressen.length && this.raum === raum) {
        ziel.insertAdjacentHTML("beforeend", `<br>Adresse: ${adressen.map((a) => `<strong>${escapeHtml(a)}</strong>`).join(" oder ")}`);
      }
    } catch { /* Adresse ist nur ein Hinweis */ }
  }

  #raumEreignis(e) {
    const typ = e.daten?.typ;
    if (typ === "neustart") {
      this.el.overlay.hidden = true;
      this.aktuell.starten("lan");
    } else if (typ === "verlassen") {
      const name = this.raum.spieler[e.von] ?? "Jemand";
      this.#raumVerlassen(false);
      this.aktuell.zustand = Zustand.VORBEI;
      this.#zeigeOverlay(`
        <h2>${escapeHtml(name)} hat das Spiel verlassen</h2>
        <button type="button" class="knopf gross" data-aktion="auswahl">Zur Spielauswahl</button>`);
    } else {
      this.aktuell.empfangeEreignis(e);
    }
  }

  #raumVerlassen(melden = true) {
    if (!this.raum) return;
    const raum = this.raum;
    this.raum = null;
    if (this.aktuell) this.aktuell.raum = null;
    raum.stopp();
    if (melden) raum.senden({ typ: "verlassen" }).catch(() => {});
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

  async #spielVorbei({ punkte, dauerS, gewertet, text }) {
    const spielId = this.info.id;
    const titel = escapeHtml(text ?? "Spiel vorbei");
    const knoepfe = `
      <button type="button" class="knopf gross" data-aktion="start">Nochmal</button>
      <button type="button" class="knopf leise" data-aktion="auswahl">Zur Spielauswahl</button>`;
    if (!gewertet) { // z. B. 2 Spieler an einem Gerät: nichts speichern
      this.#zeigeOverlay(`<h2>${titel}</h2><div class="knopfreihe">${knoepfe}</div>`);
      return;
    }
    this.#zeigeOverlay(`<h2>${titel}</h2><p class="ergebnis">${punkte} Punkte</p><p>Speichere …</p>`);

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
      <h2>${titel}</h2>
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
