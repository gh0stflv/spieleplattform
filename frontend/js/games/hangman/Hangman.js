import { Spiel, Zustand } from "../../core/Spiel.js";
import { zufallsWort } from "./woerter.js";

// Hangman: allein (Wort aus der Liste, so lange bis ein Wort verloren geht) oder zu zweit im LAN
// (einer gibt das Wort vor, der andere rät; nach jeder Runde wird gewechselt, 3 Wörter pro Person).
const LEBEN = 8; // Teile des Galgens
const LAN_RUNDEN = 6; // insgesamt, also 3 Wörter je Spieler
const MAX_WORT = 20;
const TASTATUR = {
  de: ["QWERTZUIOPÜ", "ASDFGHJKLÖÄ", "YXCVBNM"],
  en: ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"],
};
const BUCHSTABE = /^[A-ZÄÖÜ]$/;
const ENDE_PAUSE = 2.2;
const FARBE = {
  hg: "#14171f", text: "#e8eaf0", leise: "#8b93a7", gut: "#7cf29a", warn: "#ff5b6e", akzent: "#5b6cff",
  block: "#252a37", holz: "#8a6a3f", seil: "#c9b37c", figur: "#f4f1e8",
};
const SCHRIFT = 'system-ui, "Segoe UI", sans-serif';

/** Buchstabe aus einer Taste: Groß, ß → SS wird nicht erlaubt, nur ein Zeichen. */
const alsBuchstabe = (taste) => (typeof taste === "string" && taste.length === 1 ? taste.toUpperCase() : "");

export class Hangman extends Spiel {
  static ohnePause = true;
  static modi = [
    { id: "de", name: "Allein · Deutsch" },
    { id: "en", name: "Allein · English" },
    { id: "lan", name: "Zu zweit im Netzwerk (LAN)", lan: true },
  ];

  constructor(canvas, rueckrufe) {
    super("Hangman", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  zuruecksetzen() {
    this.wort = ""; // gesuchtes Wort in Großbuchstaben
    this.hinweis = ""; // Kategorie oder Tipp
    this.geraten = new Set(); // alle getippten Buchstaben
    this.fehler = 0;
    this.gewonnen = null; // null = läuft, true/false = Runde vorbei
    this.rundenEnde = 0; // Sekunden bis zur nächsten Runde
    this.woerterGeloest = 0;
    this.knoepfe = [];
    // LAN
    this.runde = 0; // 0 … LAN_RUNDEN - 1; Wortgeber = runde % 2
    this.eingabe = ""; // Text, den der Wortgeber gerade tippt
    this.eingabeSchritt = "wort"; // "wort" → "hinweis"
    this.gesendet = false;
    this.lanPunkte = [0, 0];
  }

  get sprache() { return this.modus === "en" ? "en" : "de"; }
  get imLan() { return this.modus === "lan"; }
  get gewertet() { return !this.imLan; }
  get ich() { return this.raum?.ich ?? 0; }
  get wortgeber() { return this.runde % 2; }
  get rater() { return 1 - this.wortgeber; }
  get #tastatur() { return TASTATUR[this.imLan ? "de" : this.sprache]; }

  spielerName(seite) { return this.raum?.spieler[seite] ?? `Spieler ${seite + 1}`; }

  get ergebnisText() {
    if (!this.imLan) {
      if (!this.woerterGeloest) return "Leider verloren";
      return this.woerterGeloest === 1 ? "1 Wort gelöst!" : `${this.woerterGeloest} Wörter gelöst!`;
    }
    const [a, b] = this.lanPunkte;
    if (a === b) return "Unentschieden!";
    const sieger = a > b ? 0 : 1;
    return sieger === this.ich ? "Du hast gewonnen!" : `${this.spielerName(sieger)} gewinnt!`;
  }

  starten(modus) {
    super.starten(modus);
    if (!this.imLan) this.#neuesWort();
    this.#status();
  }

  #status() {
    if (this.imLan) {
      const [a, b] = this.lanPunkte;
      this.rueckrufe.beiPunkten?.(`${a} : ${b}`, `Runde ${Math.min(this.runde + 1, LAN_RUNDEN)}/${LAN_RUNDEN} · Punkte`);
    } else {
      this.rueckrufe.beiPunkten?.(this.punkte, `${this.woerterGeloest} gelöst · Punkte`);
    }
  }

  #neuesWort() {
    const { wort, kategorie } = zufallsWort(this.sprache);
    this.#wortSetzen(wort, kategorie);
  }

  #wortSetzen(wort, hinweis) {
    this.wort = wort;
    this.hinweis = hinweis;
    this.geraten = new Set();
    this.fehler = 0;
    this.gewonnen = null;
    this.rundenEnde = 0;
  }

  /** Punkte für ein gelöstes Wort: Länge, verschiedene Buchstaben und übrige Leben zählen. */
  #wortPunkte() {
    const verschieden = new Set(this.wort).size;
    return 50 + verschieden * 10 + (LEBEN - this.fehler) * 15;
  }

  get #darfRaten() {
    if (this.zustand !== Zustand.LAEUFT || !this.wort || this.gewonnen !== null) return false;
    return !this.imLan || this.ich === this.rater;
  }

  /** Buchstabe raten (lokal, oder als Ereignis aus dem Raum). */
  #raten(b) {
    if (!BUCHSTABE.test(b) || this.geraten.has(b) || this.gewonnen !== null) return;
    this.geraten.add(b);
    if (!this.wort.includes(b)) this.fehler++;
    const geloest = [...this.wort].every((z) => this.geraten.has(z));
    if (geloest) {
      this.gewonnen = true;
      if (this.imLan) this.lanPunkte[this.rater] += this.#wortPunkte();
      else { this.woerterGeloest++; this.addierePunkte(this.#wortPunkte()); }
      this.rundenEnde = ENDE_PAUSE;
    } else if (this.fehler >= LEBEN) {
      this.gewonnen = false;
      if (this.imLan) this.lanPunkte[this.wortgeber] += 10 * LEBEN;
      this.rundenEnde = ENDE_PAUSE;
    } else if (this.imLan) {
      this.lanPunkte[this.wortgeber] += this.wort.includes(b) ? 0 : 10;
    }
    this.#status();
  }

  // --- Ereignisse aus dem LAN-Raum ---

  empfangeEreignis({ von, daten }) {
    if (this.zustand !== Zustand.LAEUFT || this.runde >= LAN_RUNDEN) return;
    if (daten?.typ === "wort" && von === this.wortgeber && !this.wort) {
      const wort = typeof daten.wort === "string" ? daten.wort.toUpperCase() : "";
      if (!wort || wort.length > MAX_WORT || ![...wort].every((z) => BUCHSTABE.test(z))) return;
      this.#wortSetzen(wort, typeof daten.hinweis === "string" ? daten.hinweis.slice(0, 30) : "");
    } else if (daten?.typ === "buchstabe" && von === this.rater && this.wort) {
      this.#raten(alsBuchstabe(daten.b));
    }
    this.#status();
  }

  #wortSenden() {
    const wort = this.eingabe.trim().toUpperCase();
    if (wort.length < 2 || this.gesendet) return;
    this.gesendet = true;
    this.raum?.senden({ typ: "wort", wort, hinweis: this.hinweisEingabe?.trim() ?? "" }).catch(() => { this.gesendet = false; });
  }

  /** Nächste Runde (LAN) oder nächstes Wort (allein); am Ende Spiel beenden. */
  #weiter() {
    if (!this.imLan) {
      if (this.gewonnen) this.#neuesWort();
      else this.beenden();
      return;
    }
    this.runde++;
    this.wort = "";
    this.hinweis = "";
    this.eingabe = "";
    this.hinweisEingabe = "";
    this.eingabeSchritt = "wort";
    this.gesendet = false;
    this.gewonnen = null;
    this.rundenEnde = 0;
    if (this.runde >= LAN_RUNDEN) this.beenden();
    this.#status();
  }

  update(dt) {
    if (this.rundenEnde > 0) {
      this.rundenEnde -= dt;
      if (this.rundenEnde <= 0) this.#weiter();
    }
  }

  // --- Eingabe ---

  verarbeiteEingabe(taste) {
    if (this.zustand !== Zustand.LAEUFT) return;
    if (this.imLan && !this.wort && this.ich === this.wortgeber && !this.gesendet) { // Wortgeber tippt
      const ziel = this.eingabeSchritt === "wort" ? "eingabe" : "hinweisEingabe";
      if (taste === "Backspace") this[ziel] = (this[ziel] ?? "").slice(0, -1);
      else if (taste === "Enter") {
        if (this.eingabeSchritt === "wort") { if (this.eingabe.trim().length >= 2) this.eingabeSchritt = "hinweis"; }
        else this.#wortSenden();
      } else if (this.eingabeSchritt === "wort") {
        const b = alsBuchstabe(taste);
        if (BUCHSTABE.test(b) && this.eingabe.length < MAX_WORT) this.eingabe += b;
      } else if (taste.length === 1 && (this.hinweisEingabe ?? "").length < 30) {
        this.hinweisEingabe = (this.hinweisEingabe ?? "") + taste;
      }
      return;
    }
    if (!this.#darfRaten) return;
    const b = alsBuchstabe(taste);
    if (!BUCHSTABE.test(b) || this.geraten.has(b)) return;
    if (this.imLan) this.raum?.senden({ typ: "buchstabe", b }).catch(() => {});
    else this.#raten(b);
  }

  verarbeiteKlick(x, y) {
    const knopf = this.knoepfe.find((k) => !k.aus && x >= k.x && x < k.x + k.b && y >= k.y && y < k.y + k.h);
    knopf?.aktion();
  }

  // --- Zeichnen ---

  #text(text, x, y, { groesse = 14, farbe = FARBE.text, fett = false, ausrichtung = "left", schrift = SCHRIFT } = {}) {
    const { ctx } = this;
    ctx.font = `${fett ? "700 " : ""}${groesse}px ${schrift}`;
    ctx.fillStyle = farbe;
    ctx.textAlign = ausrichtung;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  }

  #galgen() {
    const { ctx } = this;
    const f = this.fehler;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const strich = (farbe, breite, punkte) => {
      ctx.strokeStyle = farbe;
      ctx.lineWidth = breite;
      ctx.beginPath();
      ctx.moveTo(...punkte[0]);
      for (const p of punkte.slice(1)) ctx.lineTo(...p);
      ctx.stroke();
    };
    const kreis = (x, y, r) => { ctx.strokeStyle = FARBE.figur; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); };
    // Teile: 1 Boden, 2 Pfosten, 3 Balken, 4 Seil, 5 Kopf, 6 Körper, 7 Arme, 8 Beine
    if (f >= 1) strich(FARBE.holz, 8, [[30, 230], [150, 230]]);
    if (f >= 2) strich(FARBE.holz, 8, [[60, 230], [60, 40]]);
    if (f >= 3) strich(FARBE.holz, 8, [[56, 40], [150, 40]]);
    if (f >= 3) strich(FARBE.holz, 5, [[60, 80], [100, 40]]);
    if (f >= 4) strich(FARBE.seil, 3, [[150, 40], [150, 70]]);
    if (f >= 5) kreis(150, 86, 16);
    if (f >= 6) strich(FARBE.figur, 4, [[150, 102], [150, 160]]);
    if (f >= 7) { strich(FARBE.figur, 4, [[150, 115], [125, 145]]); strich(FARBE.figur, 4, [[150, 115], [175, 145]]); }
    if (f >= 8) { strich(FARBE.figur, 4, [[150, 160], [130, 200]]); strich(FARBE.figur, 4, [[150, 160], [170, 200]]); }
    if (f >= LEBEN) { // Gesicht
      strich(FARBE.warn, 2, [[143, 81], [148, 86]]); strich(FARBE.warn, 2, [[148, 81], [143, 86]]);
      strich(FARBE.warn, 2, [[152, 81], [157, 86]]); strich(FARBE.warn, 2, [[157, 81], [152, 86]]);
    }
  }

  #wortZeichnen(y) {
    const wort = this.wort;
    const n = wort.length;
    const breite = Math.min(34, (this.breite - 40) / n);
    const x0 = (this.breite - n * breite) / 2 + breite / 2;
    const zeigen = this.gewonnen !== null || (this.imLan && this.ich === this.wortgeber);
    for (let i = 0; i < n; i++) {
      const z = wort[i];
      const x = x0 + i * breite;
      const bekannt = this.geraten.has(z);
      this.ctx.strokeStyle = bekannt ? FARBE.gut : FARBE.leise;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(x - breite * 0.38, y + 18);
      this.ctx.lineTo(x + breite * 0.38, y + 18);
      this.ctx.stroke();
      if (bekannt || zeigen) {
        this.#text(z, x, y, { groesse: breite * 0.85, fett: true, ausrichtung: "center",
          farbe: bekannt ? FARBE.text : this.gewonnen === false ? FARBE.warn : FARBE.leise });
      }
    }
  }

  #tastaturZeichnen(y0, aktiv) {
    const { ctx } = this;
    const reihen = this.#tastatur;
    const b = 38;
    const h = 40;
    reihen.forEach((reihe, r) => {
      const x0 = (this.breite - reihe.length * (b + 4)) / 2;
      [...reihe].forEach((z, i) => {
        const x = x0 + i * (b + 4);
        const y = y0 + r * (h + 6);
        const benutzt = this.geraten.has(z);
        const richtig = benutzt && this.wort.includes(z);
        ctx.fillStyle = benutzt ? (richtig ? "#2f7a4a" : "#3a2a30") : FARBE.block;
        ctx.globalAlpha = !aktiv && !benutzt ? 0.45 : 1;
        ctx.beginPath();
        ctx.roundRect(x, y, b, h, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
        this.#text(z, x + b / 2, y + h / 2 + 1, { groesse: 17, fett: true, ausrichtung: "center",
          farbe: benutzt ? (richtig ? FARBE.text : FARBE.leise) : FARBE.text });
        if (aktiv && !benutzt) this.knoepfe.push({ x, y, b, h, aktion: () => this.verarbeiteEingabe(z) });
      });
    });
  }

  #eingabeZeichnen() {
    // Wortgeber tippt das Wort (und optional einen Tipp)
    this.#text("Du gibst das Wort vor", this.breite / 2, 60, { groesse: 22, fett: true, ausrichtung: "center" });
    this.#text(`${this.spielerName(this.rater)} muss es erraten. Nicht zeigen!`, this.breite / 2, 92, { farbe: FARBE.leise, ausrichtung: "center" });
    const feld = (y, titel, inhalt, aktiv, platzhalter) => {
      this.#text(titel, 60, y - 24, { groesse: 13, farbe: FARBE.leise });
      this.ctx.fillStyle = FARBE.block;
      this.ctx.beginPath();
      this.ctx.roundRect(60, y - 4, this.breite - 120, 46, 8);
      this.ctx.fill();
      if (aktiv) { this.ctx.strokeStyle = FARBE.akzent; this.ctx.lineWidth = 2; this.ctx.stroke(); }
      const zeiger = aktiv && Math.floor(this.spielzeit * 2) % 2 === 0 ? "|" : "";
      this.#text(inhalt ? inhalt + zeiger : (aktiv ? zeiger : platzhalter), 76, y + 19,
        { groesse: 22, fett: Boolean(inhalt), farbe: inhalt ? FARBE.text : FARBE.leise });
    };
    const wortAktiv = this.eingabeSchritt === "wort";
    feld(160, "Wort (nur Buchstaben, 2–20)", this.eingabe, wortAktiv, "Wort tippen …");
    feld(250, "Tipp (optional, z. B. Kategorie)", this.hinweisEingabe ?? "", !wortAktiv, "Tipp tippen oder leer lassen");
    const hinweis = wortAktiv ? "Enter = weiter" : "Enter = Wort abschicken · Backspace = löschen";
    this.#text(hinweis, this.breite / 2, 320, { farbe: FARBE.leise, ausrichtung: "center" });
    if (this.gesendet) this.#text("Gesendet, warte …", this.breite / 2, 350, { farbe: FARBE.gut, ausrichtung: "center" });
    else if (wortAktiv) {
      this.#knopf(this.breite / 2 - 70, 345, 140, 40, "Weiter", () => this.verarbeiteEingabe("Enter"), this.eingabe.trim().length < 2);
    } else {
      this.#knopf(this.breite / 2 - 70, 345, 140, 40, "Abschicken", () => this.#wortSenden(), false);
    }
  }

  #knopf(x, y, b, h, text, aktion, aus) {
    this.ctx.globalAlpha = aus ? 0.4 : 1;
    this.ctx.fillStyle = FARBE.akzent;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, b, h, 8);
    this.ctx.fill();
    this.ctx.globalAlpha = 1;
    this.#text(text, x + b / 2, y + h / 2 + 1, { groesse: 14, fett: true, ausrichtung: "center" });
    this.knoepfe.push({ x, y, b, h, aktion, aus });
  }

  zeichnen() {
    const { ctx } = this;
    this.knoepfe = [];
    ctx.fillStyle = FARBE.hg;
    ctx.fillRect(0, 0, this.breite, this.hoehe);
    if (this.zustand === Zustand.BEREIT) return;
    if (this.imLan && !this.wort) {
      if (this.runde >= LAN_RUNDEN) return;
      if (this.ich === this.wortgeber) this.#eingabeZeichnen();
      else {
        this.#text(`${this.spielerName(this.wortgeber)} denkt sich ein Wort aus …`, this.breite / 2, 200, { groesse: 18, ausrichtung: "center" });
        this.#text(`Runde ${this.runde + 1} von ${LAN_RUNDEN}`, this.breite / 2, 232, { farbe: FARBE.leise, ausrichtung: "center" });
      }
      return;
    }
    this.#galgen();
    // Infos rechts oben
    const rechts = this.breite - 20;
    this.#text(this.hinweis ? `Tipp: ${this.hinweis}` : "Kein Tipp", rechts, 50, { groesse: 15, ausrichtung: "right", farbe: FARBE.leise });
    const leben = LEBEN - this.fehler;
    this.#text(`${"♥".repeat(leben)}${"♡".repeat(this.fehler)}`, rechts, 82, { groesse: 20, ausrichtung: "right", farbe: leben <= 2 ? FARBE.warn : FARBE.gut });
    if (this.imLan) {
      const rolle = this.ich === this.rater ? "Du rätst" : `${this.spielerName(this.rater)} rät`;
      this.#text(rolle, rechts, 112, { groesse: 15, fett: true, ausrichtung: "right" });
    } else {
      this.#text(`Wort ${this.woerterGeloest + 1}`, rechts, 112, { groesse: 15, fett: true, ausrichtung: "right" });
    }
    const falsche = [...this.geraten].filter((z) => !this.wort.includes(z)).join(" ");
    this.#text(falsche ? `Falsch: ${falsche}` : "", rechts, 142, { groesse: 13, ausrichtung: "right", farbe: FARBE.warn });

    this.#wortZeichnen(272);
    if (this.gewonnen !== null) {
      const text = this.gewonnen ? "Richtig! 🎉" : `Verloren – es war ${this.wort}`;
      this.#text(text, this.breite / 2, 318, { groesse: 18, fett: true, ausrichtung: "center", farbe: this.gewonnen ? FARBE.gut : FARBE.warn });
    }
    this.#tastaturZeichnen(336, this.#darfRaten);
  }
}
