import { Spiel, Zustand } from "../../core/Spiel.js";
import { WOERTER } from "./woerter.js";

// "5 Buchstaben": ein Wort mit 5 Buchstaben in 6 Versuchen erraten. Grün = richtige Stelle,
// Gelb = kommt vor, Grau = kommt nicht vor. Tageswort (für alle gleich, einmal pro Tag) oder Endlos.
const ZEILEN = 6;
const LAENGE = 5;
const KACHEL = 54;
const LUECKE = 6;
const GITTER_X = (480 - (LAENGE * KACHEL + (LAENGE - 1) * LUECKE)) / 2;
const GITTER_Y = 16;
const AUFDECKEN_S = 0.28; // Versatz zwischen den Kacheln einer Zeile
const DREHEN_S = 0.36;
const START_TAG = Date.UTC(2026, 0, 1);
const TASTATUR = {
  de: ["QWERTZUIOPÜ", "ASDFGHJKLÖÄ", "YXCVBNM"],
  en: ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"],
};
const ERLAUBT = { de: /^[A-ZÄÖÜ]$/, en: /^[A-Z]$/ };
const FARBE = {
  hg: "#14171f", text: "#e8eaf0", leise: "#8b93a7", rand: "#3a4152", leer: "#1b1f2a",
  treffer: "#3f9b5a", enthalten: "#c9a227", fehlt: "#3a3f4b", taste: "#2c3242", akzent: "#5b6cff", warn: "#ff5b6e",
};
const KACHELFARBE = [FARBE.fehlt, FARBE.enthalten, FARBE.treffer];
const SCHRIFT = 'system-ui, "Segoe UI", sans-serif';

/** Bewertung wie im Original: erst die grünen, dann gelb nur so oft, wie der Buchstabe noch übrig ist. */
export function bewerte(rate, antwort) {
  const farben = new Array(LAENGE).fill(0);
  const uebrig = {};
  for (let i = 0; i < LAENGE; i++) {
    if (rate[i] === antwort[i]) farben[i] = 2;
    else uebrig[antwort[i]] = (uebrig[antwort[i]] ?? 0) + 1;
  }
  for (let i = 0; i < LAENGE; i++) {
    if (farben[i] === 0 && uebrig[rate[i]] > 0) { farben[i] = 1; uebrig[rate[i]]--; }
  }
  return farben;
}

/** Feste Reihenfolge der Wörter für die Tageswörter (gleicher Startwert = auf allen Geräten gleich). */
function tagesReihenfolge(anzahl) {
  let s = 20260101;
  const zufall = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const reihe = Array.from({ length: anzahl }, (_, i) => i);
  for (let i = anzahl - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [reihe[i], reihe[j]] = [reihe[j], reihe[i]];
  }
  return reihe;
}

export function heute(datum = new Date()) {
  const y = datum.getFullYear();
  const m = String(datum.getMonth() + 1).padStart(2, "0");
  const d = String(datum.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function tageswort(sprache, tag = heute()) {
  const liste = WOERTER[sprache];
  const [y, m, d] = tag.split("-").map(Number);
  const nr = Math.round((Date.UTC(y, m - 1, d) - START_TAG) / 864e5);
  const reihe = tagesReihenfolge(liste.length);
  return liste[reihe[((nr % liste.length) + liste.length) % liste.length]];
}

function speicherLesen(sprache) {
  try { return JSON.parse(localStorage.getItem(`wort5-${sprache}`)) ?? { tage: {} }; } catch { return { tage: {} }; }
}

function speicherSchreiben(sprache, daten) {
  try { localStorage.setItem(`wort5-${sprache}`, JSON.stringify(daten)); } catch { /* egal */ }
}

/** Statistik der Tageswörter: gespielt, gewonnen, Serie, beste Serie, Verteilung der Versuche. */
export function statistik(daten, tag = heute()) {
  const tage = Object.entries(daten.tage).filter(([, e]) => e.gewonnen !== null).sort(([a], [b]) => (a < b ? -1 : 1));
  const verteilung = new Array(ZEILEN).fill(0);
  let serie = 0;
  let beste = 0;
  let vorher = null;
  for (const [datum, e] of tage) {
    const folgetag = vorher && Math.round((Date.parse(datum) - Date.parse(vorher)) / 864e5) === 1;
    serie = e.gewonnen ? (folgetag ? serie + 1 : 1) : 0;
    beste = Math.max(beste, serie);
    if (e.gewonnen) verteilung[e.raten.length - 1]++;
    vorher = datum;
  }
  // Die Serie zählt nur, wenn zuletzt heute oder gestern gewonnen wurde
  const abstand = vorher ? Math.round((Date.parse(tag) - Date.parse(vorher)) / 864e5) : 99;
  if (abstand > 1) serie = 0;
  return { gespielt: tage.length, gewonnen: tage.filter(([, e]) => e.gewonnen).length, serie, beste, verteilung };
}

export class Wort5 extends Spiel {
  static hoehe = 600;
  static ohnePause = true;
  static modi = [
    { id: "tag-de", name: "Tageswort · Deutsch" },
    { id: "tag-en", name: "Word of the day · English" },
    { id: "endlos-de", name: "Endlos · Deutsch" },
    { id: "endlos-en", name: "Endless · English" },
  ];

  constructor(canvas, rueckrufe) {
    super("5 Buchstaben", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  get sprache() { return this.modus?.endsWith("en") ? "en" : "de"; }
  get tagesModus() { return this.modus?.startsWith("tag") ?? false; }
  get gewertet() { return !this.tagesModus; }
  get bestenlisteId() { return this.sprache === "en" ? "wort5-en" : "wort5"; }
  get bestenlisteName() { return this.sprache === "en" ? "English" : "Deutsch"; }

  get ergebnisText() {
    if (this.tagesModus) return this.status === "gewonnen" ? `Geschafft in ${this.raten.length}/${ZEILEN}!` : `Das Wort war ${this.antwort}`;
    if (!this.geloest) return `Das Wort war ${this.antwort}`;
    return `${this.geloest} ${this.geloest === 1 ? "Wort" : "Wörter"} geschafft (das letzte war ${this.antwort})`;
  }

  zuruecksetzen() {
    this.antwort = "";
    this.raten = []; // [{ wort, farben }]
    this.eingabe = "";
    this.status = null; // null = läuft, "gewonnen", "verloren"
    this.tasten = new Map(); // Buchstabe → beste Farbe (0/1/2), erst nach dem Aufdecken
    this.aufdecken = null; // { zeile, t }
    this.wackeln = 0;
    this.meldung = "";
    this.meldungZeit = 0;
    this.geloest = 0;
    this.knoepfe = [];
    this.statistik = null;
  }

  starten(modus) {
    super.starten(modus);
    if (this.tagesModus) this.#tagLaden();
    else this.#neuesWort();
    this.#status();
  }

  #status() {
    if (this.tagesModus) this.rueckrufe.beiPunkten?.(heute(), "Tageswort");
    else this.rueckrufe.beiPunkten?.(this.punkte, `${this.geloest} geschafft · Punkte`);
  }

  #neuesWort() {
    const liste = WOERTER[this.sprache];
    let wort;
    do wort = liste[Math.floor(Math.random() * liste.length)]; while (wort === this.antwort && liste.length > 1);
    this.antwort = wort;
    this.raten = [];
    this.eingabe = "";
    this.status = null;
    this.tasten = new Map();
    this.aufdecken = null;
    this.meldungZeit = 0;
  }

  /** Tageswort: Wort bestimmen und schon gespielte Versuche von heute wiederherstellen. */
  #tagLaden() {
    this.antwort = tageswort(this.sprache);
    const eintrag = speicherLesen(this.sprache).tage[heute()];
    for (const wort of eintrag?.raten ?? []) this.#werten(wort, false);
    this.#nachAufdecken();
    if (this.status) this.statistik = statistik(speicherLesen(this.sprache));
  }

  #tagSpeichern() {
    const daten = speicherLesen(this.sprache);
    daten.tage[heute()] = { raten: this.raten.map((r) => r.wort), gewonnen: this.status === null ? null : this.status === "gewonnen" };
    speicherSchreiben(this.sprache, daten);
  }

  #melden(text) {
    this.meldung = text;
    this.meldungZeit = 1.6;
  }

  #werten(wort, animiert = true) {
    const farben = bewerte(wort, this.antwort);
    this.raten.push({ wort, farben });
    if (farben.every((f) => f === 2)) this.status = "gewonnen";
    else if (this.raten.length >= ZEILEN) this.status = "verloren";
    if (animiert) this.aufdecken = { zeile: this.raten.length - 1, t: 0 };
  }

  /** Erst wenn alle Kacheln umgedreht sind: Tastatur färben und Ergebnis zeigen. */
  #nachAufdecken() {
    this.aufdecken = null;
    for (const { wort, farben } of this.raten) {
      [...wort].forEach((b, i) => this.tasten.set(b, Math.max(this.tasten.get(b) ?? 0, farben[i])));
    }
    if (!this.status) return;
    if (this.tagesModus) {
      this.statistik = statistik(speicherLesen(this.sprache));
      return;
    }
    if (this.status === "gewonnen") {
      this.geloest++;
      this.addierePunkte((ZEILEN + 1 - this.raten.length) * 20 + 10);
      this.#melden(["Genial!", "Großartig!", "Stark!", "Gut!", "Puh!", "Knapp!"][this.raten.length - 1]);
    }
    this.#status();
  }

  #abschicken() {
    if (this.eingabe.length < LAENGE) {
      this.#melden("Zu wenige Buchstaben");
      this.wackeln = 0.4;
      return;
    }
    this.#werten(this.eingabe);
    this.eingabe = "";
    if (this.tagesModus) this.#tagSpeichern();
  }

  /** Nach einem Wort: Endlos geht weiter (oder endet bei verlorenem Wort), Tageswort endet. */
  #weiter() {
    if (this.tagesModus || this.status === "verloren") this.beenden();
    else this.#neuesWort();
  }

  get #darfTippen() { return this.zustand === Zustand.LAEUFT && !this.status && !this.aufdecken; }

  verarbeiteEingabe(taste) {
    if (this.zustand !== Zustand.LAEUFT || this.aufdecken) return;
    if (this.status) {
      if (taste === "Enter") this.#weiter();
      return;
    }
    if (taste === "Enter") this.#abschicken();
    else if (taste === "Backspace") this.eingabe = this.eingabe.slice(0, -1);
    else {
      const b = typeof taste === "string" && taste.length === 1 ? taste.toUpperCase() : "";
      if (ERLAUBT[this.sprache].test(b) && this.eingabe.length < LAENGE) this.eingabe += b;
    }
  }

  verarbeiteKlick(x, y) {
    const knopf = this.knoepfe.find((k) => !k.aus && x >= k.x && x < k.x + k.b && y >= k.y && y < k.y + k.h);
    knopf?.aktion();
  }

  update(dt) {
    if (this.meldungZeit > 0) this.meldungZeit -= dt;
    if (this.wackeln > 0) this.wackeln = Math.max(0, this.wackeln - dt);
    if (this.aufdecken) {
      this.aufdecken.t += dt;
      if (this.aufdecken.t >= (LAENGE - 1) * AUFDECKEN_S + DREHEN_S) this.#nachAufdecken();
    }
  }

  // --- Zeichnen ---

  #text(text, x, y, { groesse = 14, farbe = FARBE.text, fett = false, ausrichtung = "center" } = {}) {
    const { ctx } = this;
    ctx.font = `${fett ? "700 " : ""}${groesse}px ${SCHRIFT}`;
    ctx.fillStyle = farbe;
    ctx.textAlign = ausrichtung;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  }

  #knopf(x, y, b, h, text, aktion, { farbe = FARBE.taste, groesse = 15, aus = false } = {}) {
    const { ctx } = this;
    ctx.globalAlpha = aus ? 0.45 : 1;
    ctx.fillStyle = farbe;
    ctx.beginPath();
    ctx.roundRect(x, y, b, h, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
    this.#text(text, x + b / 2, y + h / 2 + 1, { groesse, fett: true });
    this.knoepfe.push({ x, y, b, h, aktion, aus });
  }

  #kachel(zeile, spalte) {
    const { ctx } = this;
    let x = GITTER_X + spalte * (KACHEL + LUECKE);
    const y = GITTER_Y + zeile * (KACHEL + LUECKE);
    const fertig = this.raten[zeile];
    const istEingabe = zeile === this.raten.length && !this.status;
    const buchstabe = fertig ? fertig.wort[spalte] : istEingabe ? this.eingabe[spalte] ?? "" : "";
    if (istEingabe && this.wackeln > 0) x += Math.sin(this.wackeln * 60) * 6 * (this.wackeln / 0.4);
    // Umdrehen: Höhe schrumpft bis zur Hälfte, dann kommt die Farbe
    let skala = 1;
    let gefaerbt = Boolean(fertig);
    if (fertig && this.aufdecken?.zeile === zeile) {
      const t = (this.aufdecken.t - spalte * AUFDECKEN_S) / DREHEN_S;
      if (t < 0) gefaerbt = false;
      else if (t < 1) { skala = Math.abs(Math.cos(t * Math.PI)); gefaerbt = t >= 0.5; }
    }
    const h = KACHEL * Math.max(skala, 0.04);
    const ky = y + (KACHEL - h) / 2;
    ctx.beginPath();
    ctx.roundRect(x, ky, KACHEL, h, 6);
    if (gefaerbt) {
      ctx.fillStyle = KACHELFARBE[fertig.farben[spalte]];
      ctx.fill();
    } else {
      ctx.fillStyle = FARBE.leer;
      ctx.fill();
      ctx.strokeStyle = buchstabe ? "#5a6276" : FARBE.rand;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (buchstabe && skala > 0.2) {
      ctx.save();
      ctx.translate(x + KACHEL / 2, y + KACHEL / 2);
      ctx.scale(1, skala);
      this.#text(buchstabe, 0, 2, { groesse: 28, fett: true });
      ctx.restore();
    }
  }

  #tastatur(y0) {
    const reihen = TASTATUR[this.sprache];
    const b = this.sprache === "de" ? 38 : 42;
    const h = 52;
    const aktiv = this.#darfTippen;
    reihen.forEach((reihe, r) => {
      const extra = r === 2 ? 2 * (66 + 4) : 0;
      let x = (this.breite - (reihe.length * (b + 4) - 4 + extra)) / 2;
      const y = y0 + r * (h + 8);
      if (r === 2) { this.#knopf(x, y, 66, h, "Enter", () => this.verarbeiteEingabe("Enter"), { groesse: 13, aus: !aktiv }); x += 70; }
      for (const z of reihe) {
        const farbe = this.tasten.has(z) ? KACHELFARBE[this.tasten.get(z)] : FARBE.taste;
        this.#knopf(x, y, b, h, z, () => this.verarbeiteEingabe(z), { farbe, aus: !aktiv });
        x += b + 4;
      }
      if (r === 2) {
        this.#knopf(x, y, 66, h, "", () => this.verarbeiteEingabe("Backspace"), { aus: !aktiv });
        this.#loeschSymbol(x + 33, y + h / 2, aktiv);
      }
    });
  }

  /** Löschtaste als Zeichnung (das Zeichen ⌫ fehlt in manchen Schriften). */
  #loeschSymbol(x, y, aktiv) {
    const { ctx } = this;
    ctx.globalAlpha = aktiv ? 1 : 0.45;
    ctx.strokeStyle = FARBE.text;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.lineTo(x - 6, y - 9);
    ctx.lineTo(x + 13, y - 9);
    ctx.lineTo(x + 13, y + 9);
    ctx.lineTo(x - 6, y + 9);
    ctx.closePath();
    ctx.moveTo(x - 1, y - 4);
    ctx.lineTo(x + 7, y + 4);
    ctx.moveTo(x + 7, y - 4);
    ctx.lineTo(x - 1, y + 4);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  #statistikZeichnen() {
    const { ctx } = this;
    const s = this.statistik;
    const y0 = 380;
    ctx.fillStyle = "#1b1f2a";
    ctx.beginPath();
    ctx.roundRect(20, y0, this.breite - 40, 205, 12);
    ctx.fill();
    const werte = [["Gespielt", s.gespielt], ["Gewonnen %", s.gespielt ? Math.round((100 * s.gewonnen) / s.gespielt) : 0],
      ["Serie", s.serie], ["Beste Serie", s.beste]];
    werte.forEach(([name, wert], i) => {
      const x = 75 + i * 110;
      this.#text(String(wert), x, y0 + 26, { groesse: 24, fett: true });
      this.#text(name, x, y0 + 50, { groesse: 11, farbe: FARBE.leise });
    });
    const max = Math.max(1, ...s.verteilung);
    s.verteilung.forEach((n, i) => {
      const y = y0 + 72 + i * 18;
      const b = 24 + (300 * n) / max;
      const heutige = this.status === "gewonnen" && this.raten.length === i + 1;
      this.#text(String(i + 1), 52, y + 7, { groesse: 12, farbe: FARBE.leise });
      ctx.fillStyle = heutige ? FARBE.treffer : FARBE.fehlt;
      ctx.fillRect(64, y, b, 14);
      this.#text(String(n), 64 + b - 8, y + 7, { groesse: 11, fett: true, ausrichtung: "right" });
    });
    this.#knopf(this.breite - 150, y0 + 150, 120, 40, "Fertig", () => this.#weiter(), { farbe: FARBE.akzent });
  }

  zeichnen() {
    const { ctx } = this;
    this.knoepfe = [];
    ctx.fillStyle = FARBE.hg;
    ctx.fillRect(0, 0, this.breite, this.hoehe);
    if (this.zustand === Zustand.BEREIT) return;
    for (let z = 0; z < ZEILEN; z++) for (let s = 0; s < LAENGE; s++) this.#kachel(z, s);

    const fertigAufgedeckt = this.status && !this.aufdecken;
    if (fertigAufgedeckt && this.tagesModus && this.statistik) {
      if (this.status === "verloren") this.#text(`Das Wort war ${this.antwort}`, this.breite / 2, 365, { groesse: 15, fett: true, farbe: FARBE.warn });
      this.#statistikZeichnen();
      return;
    }
    if (fertigAufgedeckt) {
      const text = this.status === "gewonnen" ? `${this.meldung || "Richtig!"} +${(ZEILEN + 1 - this.raten.length) * 20 + 10}` : `Das Wort war ${this.antwort}`;
      this.#text(text, this.breite / 2, 385, { groesse: 16, fett: true, farbe: this.status === "gewonnen" ? FARBE.treffer : FARBE.warn });
      const knopf = this.status === "gewonnen" ? "Nächstes Wort" : "Ergebnis";
      this.#knopf(this.breite / 2 - 90, 412, 180, 44, `${knopf} (Enter)`, () => this.#weiter(), { farbe: FARBE.akzent });
      return;
    }
    if (this.meldungZeit > 0) this.#text(this.meldung, this.breite / 2, 385, { groesse: 15, fett: true });
    this.#tastatur(404);
  }
}
