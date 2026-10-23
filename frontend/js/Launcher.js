import { api } from "./core/ApiClient.js";
import { Eingabe } from "./core/Eingabe.js";
import { GameLoop } from "./core/GameLoop.js";
import { Raum } from "./core/Raum.js";
import { Zustand } from "./core/Spiel.js";
import { SPIELE } from "./games/index.js";

export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function gespeicherterName() {
  try { return localStorage.getItem("gastName") ?? ""; } catch { return ""; }
}

function nameMerken(name) {
  try { localStorage.setItem("gastName", name); } catch { /* egal */ }
}

// Der Platz im LAN-Raum wird je Tab gemerkt, damit man nach dem Neuladen wieder einsteigen kann
const RAUM_SPEICHER = "lanRaum";

function raumMerken(daten) {
  try {
    if (daten) sessionStorage.setItem(RAUM_SPEICHER, JSON.stringify(daten));
    else sessionStorage.removeItem(RAUM_SPEICHER);
  } catch { /* egal */ }
}

function gemerkterRaum() {
  try { return JSON.parse(sessionStorage.getItem(RAUM_SPEICHER)); } catch { return null; }
}

/** Zeigt die Spielauswahl, startet Spiele und meldet Ergebnisse an die API. */
export class Launcher {
  constructor(wurzel) {
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
      tipp: wurzel.querySelector(".tipp"),
      lanStatus: wurzel.querySelector("#lan-status"),
    };
    this.loop = new GameLoop();
    this.eingabe = new Eingabe(this.el.canvas);
    this.el.zurueck.addEventListener("click", () => this.zeigeAuswahl());
    window.addEventListener("popstate", () => this.#nachUrl());
    // Beim Schließen/Neuladen nur die Abfrage stoppen, nicht den Raum verlassen: Wiedereinstieg bleibt möglich
    window.addEventListener("pagehide", () => this.raum?.stopp());
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
    const params = new URLSearchParams(location.search);
    const id = params.get("spiel");
    if (!id || !SPIELE[id]) { this.zeigeAuswahl(false); return; }
    this.starteSpiel(id, false);
    const gemerkt = gemerkterRaum();
    const code = params.get("raum");
    if (code && gemerkt?.code === code && gemerkt.spielId === id) this.#wiederEinsteigen(gemerkt);
  }

  /** Nach dem Neuladen: Raum wieder betreten, alle bisherigen Ereignisse werden erneut abgespielt. */
  async #wiederEinsteigen({ code, token }) {
    this.#zeigeOverlay(`<h2>Verbinde wieder mit Raum ${escapeHtml(code)} …</h2>`);
    try {
      this.#raumBetreten(await Raum.wieder(code, token));
    } catch (e) {
      raumMerken(null);
      this.#lanMenue(`Wiedereinstieg nicht möglich: ${e.message}`);
    }
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
    this.el.tipp.hidden = Boolean(Klasse.ohnePause);
    this.el.buehne.style.setProperty("--spielbreite", `${Klasse.breite}px`); // breitere Spiele, z. B. Schach mit Seitenleiste
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
    // Spiele mit static lanSpieler = { min, max } lassen den Ersteller die Spielerzahl wählen
    const { min = 2, max = 2 } = this.aktuell.constructor.lanSpieler ?? {};
    const auswahl = max > min ? `
      <label class="lan-feld">Spieler im Raum
        <select name="anzahl">${Array.from({ length: max - min + 1 }, (_, i) => min + i)
          .map((n) => `<option value="${n}">${n}</option>`).join("")}</select>
      </label>` : "";
    this.#zeigeOverlay(`
      <h2>Im Netzwerk spielen</h2>
      <p class="hinweis">Alle müssen im selben WLAN/LAN sein und diese Seite über die Netzwerk-Adresse öffnen.</p>
      <label class="lan-feld">Dein Name <input name="gastname" maxlength="20" placeholder="Gast" value="${escapeHtml(gespeicherterName())}"></label>
      ${auswahl}
      <button type="button" class="knopf gross" data-lan="erstellen">Raum erstellen</button>
      <form class="lan-beitreten" data-lan="beitreten">
        <input name="code" maxlength="4" placeholder="CODE" autocomplete="off" autocapitalize="characters" aria-label="Raum-Code">
        <button type="submit" class="knopf">Beitreten</button>
      </form>
      <p class="fehler" role="alert">${escapeHtml(meldung)}</p>
      <button type="button" class="knopf leise" data-aktion="auswahl">Zurück</button>`);
    const o = this.el.overlay;
    const nameUebernehmen = () => nameMerken(o.querySelector("[name=gastname]").value.trim());
    o.querySelector("[data-lan=erstellen]").addEventListener("click", async () => {
      nameUebernehmen();
      const anzahl = Number(o.querySelector("[name=anzahl]")?.value ?? min);
      try { this.#raumBetreten(await Raum.erstellen(this.info.id, anzahl)); } catch (e) { this.#lanMenue(e.message); }
    });
    o.querySelector("[data-lan=beitreten]").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      nameUebernehmen();
      const code = ev.target.code.value;
      if (code.trim().length !== 4) { this.#lanMenue("Der Code hat 4 Zeichen."); return; }
      try { this.#raumBetreten(await Raum.beitreten(code)); } catch (e) { this.#lanMenue(e.message); }
    });
  }

  #raumBetreten(raum) {
    this.raum = raum;
    raumMerken({ code: raum.code, token: raum.token, spielId: this.info.id });
    history.replaceState({}, "", `launcher.html?spiel=${encodeURIComponent(this.info.id)}&raum=${encodeURIComponent(raum.code)}`);
    raum.beiEreignis = (e) => this.#raumEreignis(e);
    raum.beiAenderung = (_r, fehler) => {
      if (fehler) { this.#raumVerlassen(false); this.#lanMenue(fehler); return; }
      if (this.aktuell.zustand === Zustand.BEREIT) this.#lanWarten();
      this.#lanStatusZeigen();
    };
    raum.starte();
    this.#lanWarten();
  }

  /** Hinweis unter dem Spielfeld, wenn Mitspieler gerade nicht verbunden sind (z. B. Seite neu laden). */
  #lanStatusZeigen() {
    const raum = this.raum;
    const weg = raum ? raum.spieler.filter((_n, i) => i !== raum.ich && raum.verbunden[i] === false) : [];
    this.el.lanStatus.hidden = !weg.length;
    if (weg.length) this.el.lanStatus.textContent = `⏳ ${weg.map(escapeHtml).join(", ")} ist gerade nicht verbunden … wartet auf Wiedereinstieg`;
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
    raumMerken(null);
    this.el.lanStatus.hidden = true;
    if (this.info) history.replaceState({}, "", `launcher.html?spiel=${encodeURIComponent(this.info.id)}`);
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
    const spielId = this.aktuell.bestenlisteId ?? this.info.id; // Varianten (z. B. Memory 10 × 10) haben eigene Listen
    const listenName = this.aktuell.bestenlisteName ?? "";
    const titel = escapeHtml(text ?? "Spiel vorbei");
    const knoepfe = `
      <button type="button" class="knopf gross" data-aktion="start">Nochmal</button>
      <button type="button" class="knopf leise" data-aktion="auswahl">Zur Spielauswahl</button>`;
    if (!gewertet) { // z. B. 2 Spieler an einem Gerät oder LAN: nichts speichern
      this.#zeigeOverlay(`<h2>${titel}</h2><div class="knopfreihe">${knoepfe}</div>`);
      return;
    }
    this.#zeigeOverlay(`<h2>${titel}</h2><p class="ergebnis">${punkte} Punkte</p><p>Lade Bestenliste …</p>`);
    const ergebnis = { spielId, kachel: this.info.id, listenName, punkte, dauerS, eingetragen: null };
    await this.#zeigeBestenliste(titel, knoepfe, ergebnis);
  }

  /** Ergebnis, Formular zum Eintragen mit Namen und die Top 10. */
  async #zeigeBestenliste(titel, knoepfe, ergebnis, meldung = "") {
    const { spielId, punkte } = ergebnis;
    let tabelle;
    try {
      tabelle = this.#bestenlisteHtml(await api.holeBestenliste(spielId));
    } catch {
      tabelle = '<p class="fehler">Bestenliste nicht verfügbar.</p>';
    }
    if (this.aktuell?.zustand !== Zustand.VORBEI || this.info.id !== ergebnis.kachel) return; // inzwischen neu gestartet
    const formular = ergebnis.eingetragen || punkte <= 0 ? "" : `
      <form class="eintragen">
        <input name="name" maxlength="20" placeholder="Dein Name" value="${escapeHtml(gespeicherterName())}"
          aria-label="Dein Name" required>
        <button type="submit" class="knopf">In Bestenliste eintragen</button>
      </form>`;
    this.#zeigeOverlay(`
      <h2>${titel}</h2>
      <p class="ergebnis">${punkte} Punkte</p>
      ${formular}
      ${meldung}
      <h3>Bestenliste${ergebnis.listenName ? ` · ${escapeHtml(ergebnis.listenName)}` : ""}</h3>
      ${tabelle}
      <div class="knopfreihe">${knoepfe}</div>`);
    const form = this.el.overlay.querySelector(".eintragen");
    if (!form) return;
    form.name.focus();
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const name = form.name.value.trim();
      form.querySelector("button").disabled = true;
      try {
        const antwort = await api.sendeScore(spielId, name, punkte, ergebnis.dauerS);
        nameMerken(antwort.name);
        ergebnis.eingetragen = antwort.name;
        await this.#zeigeBestenliste(titel, knoepfe, ergebnis,
          `<p>Eingetragen als <strong>${escapeHtml(antwort.name)}</strong>. Dein bester Platz: <strong>#${antwort.platz}</strong></p>`);
      } catch (fehler) {
        await this.#zeigeBestenliste(titel, knoepfe, ergebnis,
          `<p class="fehler">Nicht gespeichert: ${escapeHtml(fehler.message)}</p>`);
      }
    });
  }

  #bestenlisteHtml(liste) {
    if (!liste.length) return "<p>Noch keine Einträge. Sei die erste Person!</p>";
    const eigener = gespeicherterName().toLowerCase();
    const zeilen = liste.map((z) => `
      <tr class="${eigener && z.name.toLowerCase() === eigener ? "ich" : ""}">
        <td>${z.platz}</td><td>${escapeHtml(z.name)}</td><td>${z.punkte}</td>
      </tr>`).join("");
    return `<table class="bestenliste"><thead><tr><th>#</th><th>Name</th><th>Punkte</th></tr></thead>
      <tbody>${zeilen}</tbody></table>`;
  }
}
