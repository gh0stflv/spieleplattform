import { Spiel, Zustand } from "../../core/Spiel.js";
import {
  ANZAHL_MAX, GROESSE_MAX, GROESSE_MIN, LAENGEN, SCHIFFSNAMEN, VORLAGEN, flotteGueltig, flotteText, passtDazu,
  regelnBereinigen, regelnFehler, regelnPruefen, schiffGueltig, schiffsListe, zellen, zufaelligeFlotte,
} from "./Flotte.js";
import { PALETTEN, zeichneSchiff } from "./Schiffsbilder.js";

// Schiffe versenken nur im LAN. Ablauf: Spieler 0 wählt die Regeln → beide stellen ihre Flotte auf →
// abwechselnd schießen. Jedes Gerät kennt nur die eigene Flotte: Auf einen Schuss antwortet das Gerät
// des Beschossenen mit Wasser/Treffer/Versenkt. Am Ende decken beide ihre Flotte auf (und werden geprüft).
const BREITE = 760;
const HOEHE = 480;
const GROSS = { x: 40, y: 44, b: 420 }; // großes Feld links
const LX = 492; // Leiste rechts
const LB = 248;
const KLEIN = { x: LX + 24, y: 112, b: 200 }; // eigenes Feld im Kampf
const BUCHSTABEN = "ABCDEFGHIJKLMN";
const ENDE_PAUSE = 6; // Sekunden, um die aufgedeckte Flotte anzuschauen
const FARBE = {
  wasser: "#15304d", linie: "rgba(255,255,255,.09)", treffer: "#ff5b6e",
  text: "#e8eaf0", leise: "#8b93a7", gut: "#7cf29a", akzent: "#5b6cff", block: "#252a37", leiste: "#1b1f2a",
};
const SCHRIFT = 'system-ui, "Segoe UI", sans-serif';

function entwurfLaden() {
  try {
    const gespeichert = JSON.parse(localStorage.getItem("schiffeRegeln"));
    if (gespeichert) return regelnBereinigen(gespeichert);
  } catch { /* egal */ }
  return regelnBereinigen(VORLAGEN.klassisch);
}

function entwurfSpeichern(regeln) {
  try { localStorage.setItem("schiffeRegeln", JSON.stringify(regeln)); } catch { /* egal */ }
}

export class SchiffeVersenken extends Spiel {
  static breite = BREITE;
  static hoehe = HOEHE;
  static ohnePause = true;
  static modi = [{ id: "lan", name: "Im Netzwerk (LAN) spielen", lan: true }];

  constructor(canvas, rueckrufe) {
    super("Schiffe versenken", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  zuruecksetzen() {
    this.phase = "regeln"; // regeln → aufstellen → kampf → ende
    this.regeln = null;
    this.zahnrad = false; // eigene Regeln offen (nur Spieler 0)
    this.entwurf = entwurfLaden();
    this.schiffe = []; // eigene Flotte
    this.senkrecht = false;
    this.gewaehlt = null; // Schiffslänge, die als Nächstes gesetzt wird (null = längste übrige)
    this.zeiger = null; // [x, y] Feld unter der Maus
    this.bereit = [false, false];
    this.bereitGesendet = false;
    this.amZug = 0;
    this.offen = null; // Schuss, auf dessen Antwort alle warten: { von, x, y }
    this.wartet = false; // eigener Schuss ist unterwegs
    this.schuesse = [new Map(), new Map()]; // Schüsse auf das Feld von Seite s: Index → "wasser" | "treffer" | "versenkt"
    this.versenkt = [[], []]; // versenkte Schiffe von Seite s
    this.letzter = null; // { ziel, x, y }
    this.meldung = "";
    this.aufgedeckt = [null, null];
    this.unstimmig = false; // Flotte des Gegners passte nicht zu seinen Antworten
    this.sieger = undefined;
    this.endeWartet = 0;
    this.knoepfe = [];
  }

  starten(modus) {
    super.starten(modus);
    this.#status();
  }

  get gewertet() { return false; }
  get ich() { return this.raum?.ich ?? 0; }
  get gegner() { return 1 - this.ich; }
  get g() { return this.regeln?.groesse ?? 10; }

  spielerName(seite) { return this.raum?.spieler[seite] ?? `Spieler ${seite + 1}`; }

  get ergebnisText() {
    if (this.sieger === undefined) return null;
    const text = this.sieger === this.ich ? "Du hast gewonnen!" : `${this.spielerName(this.sieger)} gewinnt!`;
    return this.unstimmig ? `${text} (Achtung: Die Flotte des Gegners passte nicht zu seinen Antworten.)` : text;
  }

  #status() {
    const melde = (wert, text) => this.rueckrufe.beiPunkten?.(wert, text);
    if (this.phase === "regeln") melde("werden gewählt", "Regeln");
    else if (this.phase === "aufstellen") melde(`${this.schiffe.length}/${schiffsListe(this.regeln).length}`, "Aufstellung");
    else if (this.phase === "kampf") melde(this.amZug === this.ich ? "Du" : this.spielerName(this.amZug), "Am Zug");
    else melde(this.sieger === this.ich ? "Gewonnen" : "Verloren", "Ende");
  }

  #senden(daten) { return this.raum?.senden(daten) ?? Promise.resolve(); }

  // --- Ereignisse aus dem Raum (auf allen Geräten in derselben Reihenfolge) ---

  empfangeEreignis({ von, daten }) {
    if (this.zustand !== Zustand.LAEUFT || (von !== 0 && von !== 1)) return;
    switch (daten?.typ) {
      case "regeln": this.#regelnEmpfangen(von, daten.regeln); break;
      case "bereit": this.#bereitEmpfangen(von); break;
      case "schuss": this.#schussEmpfangen(von, daten); break;
      case "antwort": this.#antwortEmpfangen(von, daten); break;
      case "flotte": this.#flotteEmpfangen(von, daten.schiffe); break;
      default:
    }
    this.#status();
  }

  #regelnEmpfangen(von, r) {
    if (von !== 0 || this.phase !== "regeln") return;
    const regeln = regelnPruefen(r);
    if (!regeln) return;
    this.regeln = regeln;
    this.phase = "aufstellen";
  }

  #bereitEmpfangen(von) {
    if (this.phase !== "aufstellen" || this.bereit[von]) return;
    this.bereit[von] = true;
    if (this.bereit[0] && this.bereit[1]) {
      this.phase = "kampf";
      this.amZug = 0;
      this.meldung = "";
    }
  }

  #schussEmpfangen(von, { x, y }) {
    if (this.phase !== "kampf" || this.offen || von !== this.amZug) return;
    const ziel = 1 - von;
    const g = this.g;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= g || y >= g) return;
    if (this.schuesse[ziel].has(y * g + x)) return;
    this.offen = { von, x, y };
    if (von === this.ich) this.wartet = false;
    if (ziel === this.ich) this.#antworten(x, y);
  }

  /** Nur auf dem Gerät des Beschossenen: Ergebnis aus der eigenen Flotte bestimmen und senden. */
  #antworten(x, y) {
    const g = this.g;
    const schiff = this.schiffe.find((s) => zellen(s).some(([a, b]) => a === x && b === y));
    let antwort = { typ: "antwort", x, y, ergebnis: "wasser" };
    if (schiff) {
      const versenkt = zellen(schiff).every(([a, b]) => (a === x && b === y) || this.schuesse[this.ich].has(b * g + a));
      antwort = versenkt ? { ...antwort, ergebnis: "versenkt", schiff } : { ...antwort, ergebnis: "treffer" };
    }
    this.#senden(antwort).catch(() => {});
  }

  #antwortEmpfangen(von, { x, y, ergebnis, schiff }) {
    const o = this.offen;
    if (this.phase !== "kampf" || !o || von === o.von || x !== o.x || y !== o.y) return;
    if (!["wasser", "treffer", "versenkt"].includes(ergebnis)) return;
    const g = this.g;
    const ziel = von;
    const treffer = this.schuesse[ziel];
    if (ergebnis === "versenkt") {
      // Das versenkte Schiff muss das beschossene Feld enthalten, alle anderen Felder waren schon Treffer
      if (!schiffGueltig(this.regeln, schiff)) return;
      const felder = zellen(schiff);
      if (!felder.some(([a, b]) => a === x && b === y)) return;
      if (!felder.every(([a, b]) => (a === x && b === y) || treffer.get(b * g + a) === "treffer")) return;
      for (const [a, b] of felder) treffer.set(b * g + a, "versenkt");
      this.versenkt[ziel].push({ ...schiff });
    } else {
      treffer.set(y * g + x, ergebnis);
    }
    this.offen = null;
    this.letzter = { ziel, x, y };
    const schuetze = o.von === this.ich ? "Du" : this.spielerName(o.von);
    const feld = `${BUCHSTABEN[x]}${y + 1}`;
    if (ergebnis === "wasser") this.meldung = `${feld}: Wasser`;
    else if (ergebnis === "treffer") this.meldung = `${feld}: Treffer! (${schuetze})`;
    else this.meldung = `${feld}: ${SCHIFFSNAMEN[schiff.laenge]} versenkt! (${schuetze})`;

    if (this.versenkt[ziel].length === schiffsListe(this.regeln).length) { this.#spielEnde(o.von); return; }
    if (ergebnis === "wasser" || !this.regeln.nochmal) this.amZug = 1 - this.amZug;
  }

  #spielEnde(sieger) {
    this.sieger = sieger;
    this.phase = "ende";
    this.endeWartet = ENDE_PAUSE;
    this.meldung = "";
    this.#senden({ typ: "flotte", schiffe: this.schiffe }).catch(() => {});
  }

  #flotteEmpfangen(von, schiffe) {
    if (this.phase !== "ende" || von === this.ich || this.aufgedeckt[von]) return;
    if (!flotteGueltig(this.regeln, schiffe)) { this.unstimmig = true; return; }
    this.aufgedeckt[von] = schiffe;
    // Jede Antwort muss zur aufgedeckten Flotte passen
    const g = this.g;
    const belegt = new Set(schiffe.flatMap((s) => zellen(s).map(([a, b]) => b * g + a)));
    for (const [feld, ergebnis] of this.schuesse[von]) {
      if ((ergebnis !== "wasser") !== belegt.has(feld)) this.unstimmig = true;
    }
  }

  update(dt) {
    if (this.endeWartet > 0) {
      this.endeWartet -= dt;
      if (this.endeWartet <= 0) this.beenden();
    }
  }

  // --- Aufstellung ---

  /** Wie viele Schiffe je Länge noch gesetzt werden müssen. */
  #uebrig() {
    const uebrig = { ...this.regeln.flotte };
    for (const s of this.schiffe) uebrig[s.laenge]--;
    return uebrig;
  }

  #aktuelleLaenge() {
    const uebrig = this.#uebrig();
    if (this.gewaehlt && uebrig[this.gewaehlt] > 0) return this.gewaehlt;
    return LAENGEN.find((l) => uebrig[l] > 0) ?? null;
  }

  /** Schiff der aktuellen Länge an Feld (x, y), so verschoben, dass es ins Feld passt. */
  #vorschau(x, y) {
    const laenge = this.#aktuelleLaenge();
    if (!laenge) return null;
    const g = this.g;
    const senkrecht = laenge > 1 && this.senkrecht;
    return {
      x: senkrecht ? x : Math.min(x, g - laenge),
      y: senkrecht ? Math.min(y, g - laenge) : y,
      laenge,
      senkrecht,
    };
  }

  get #darfAufstellen() {
    return this.zustand === Zustand.LAEUFT && this.phase === "aufstellen" && !this.bereitGesendet;
  }

  #zufaellig() {
    const flotte = zufaelligeFlotte(this.regeln);
    if (flotte) this.schiffe = flotte;
    this.#status();
  }

  #fertig() {
    if (!flotteGueltig(this.regeln, this.schiffe)) return;
    this.bereitGesendet = true;
    this.#senden({ typ: "bereit" }).catch(() => { this.bereitGesendet = false; });
  }

  // --- Eingabe ---

  #feldAus(x, y, { x: ox, y: oy, b } = GROSS) {
    if (x < ox || y < oy || x >= ox + b || y >= oy + b) return null;
    const c = b / this.g;
    return [Math.floor((x - ox) / c), Math.floor((y - oy) / c)];
  }

  verarbeiteZeiger(x, y) { this.zeiger = this.#feldAus(x, y); }

  verarbeiteEingabe(taste) {
    if ((taste === "r" || taste === "R") && this.#darfAufstellen) this.senkrecht = !this.senkrecht;
  }

  verarbeiteKlick(x, y) {
    const knopf = this.knoepfe.find((k) => !k.aus && x >= k.x && x < k.x + k.b && y >= k.y && y < k.y + k.h);
    if (knopf) { knopf.aktion(); return; }
    const feld = this.#feldAus(x, y);
    if (!feld || this.zustand !== Zustand.LAEUFT) return;
    this.zeiger = feld;
    const [fx, fy] = feld;
    if (this.#darfAufstellen) {
      const i = this.schiffe.findIndex((s) => zellen(s).some(([a, b]) => a === fx && b === fy));
      if (i >= 0) { // Schiff wieder aufnehmen
        const [s] = this.schiffe.splice(i, 1);
        this.gewaehlt = s.laenge;
        this.senkrecht = s.senkrecht;
      } else {
        const neu = this.#vorschau(fx, fy);
        if (neu && passtDazu(this.regeln, this.schiffe, neu)) this.schiffe.push(neu);
      }
      this.#status();
      return;
    }
    if (this.phase === "kampf" && this.amZug === this.ich && !this.offen && !this.wartet) {
      if (this.schuesse[this.gegner].has(fy * this.g + fx) || this.#randVersenkter(this.gegner).has(fy * this.g + fx)) return;
      this.wartet = true;
      this.#senden({ typ: "schuss", x: fx, y: fy }).catch(() => { this.wartet = false; });
    }
  }

  /** Felder rund um versenkte Schiffe: Dort kann (ohne Berührung) kein Schiff liegen. */
  #randVersenkter(seite) {
    const rand = new Set();
    if (!this.regeln || this.regeln.beruehren) return rand;
    const g = this.g;
    for (const s of this.versenkt[seite]) {
      for (const [x, y] of zellen(s)) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < g && ny < g && !this.schuesse[seite].has(ny * g + nx)) rand.add(ny * g + nx);
          }
        }
      }
    }
    return rand;
  }

  // --- Zeichnen: Hilfen ---

  #knopf(x, y, b, h, text, aktion, { art, aus = false, schrift = 13 } = {}) {
    const { ctx } = this;
    ctx.globalAlpha = aus ? 0.4 : 1;
    ctx.fillStyle = { gut: "#2f7a4a", hell: FARBE.akzent, gewaehlt: "#3b4470" }[art] ?? "#2c3242";
    ctx.beginPath();
    ctx.roundRect(x, y, b, h, 8);
    ctx.fill();
    ctx.fillStyle = FARBE.text;
    ctx.font = `600 ${schrift}px ${SCHRIFT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + b / 2, y + h / 2);
    ctx.globalAlpha = 1;
    this.knoepfe.push({ x, y, b, h, aktion, aus });
  }

  #text(text, x, y, { groesse = 14, farbe = FARBE.text, fett = false, ausrichtung = "left" } = {}) {
    const { ctx } = this;
    ctx.font = `${fett ? "700 " : ""}${groesse}px ${SCHRIFT}`;
    ctx.fillStyle = farbe;
    ctx.textAlign = ausrichtung;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  }

  /** Wasserfläche mit Gitter, optional mit A–J / 1–10 am Rand. */
  #raster({ x: ox, y: oy, b }, beschriften) {
    const { ctx } = this;
    const g = this.g;
    const c = b / g;
    ctx.fillStyle = FARBE.wasser;
    ctx.fillRect(ox, oy, b, b);
    ctx.strokeStyle = FARBE.linie;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= g; i++) {
      ctx.moveTo(ox + i * c, oy); ctx.lineTo(ox + i * c, oy + b);
      ctx.moveTo(ox, oy + i * c); ctx.lineTo(ox + b, oy + i * c);
    }
    ctx.stroke();
    if (!beschriften) return;
    for (let i = 0; i < g; i++) {
      this.#text(BUCHSTABEN[i], ox + i * c + c / 2, oy - 10, { groesse: 11, farbe: FARBE.leise, ausrichtung: "center" });
      this.#text(String(i + 1), ox - 8, oy + i * c + c / 2, { groesse: 11, farbe: FARBE.leise, ausrichtung: "right" });
    }
  }

  #schiff(bereich, s, farben, deckkraft = 1) {
    const c = bereich.b / this.g;
    zeichneSchiff(this.ctx, s.laenge, bereich.x + s.x * c, bereich.y + s.y * c, c, s.senkrecht, farben, deckkraft);
  }

  /** Markierungen der Schüsse auf ein Feld: Punkt = Wasser, Kreuz = Treffer, dunkelrot = versenkt. */
  #schuesseZeichnen(bereich, seite) {
    const { ctx } = this;
    const g = this.g;
    const c = bereich.b / g;
    for (const s of this.versenkt[seite]) this.#schiff(bereich, s, PALETTEN.versenkt);
    for (const [feld, ergebnis] of this.schuesse[seite]) {
      const mx = bereich.x + (feld % g) * c + c / 2;
      const my = bereich.y + Math.floor(feld / g) * c + c / 2;
      if (ergebnis === "wasser") {
        ctx.fillStyle = "rgba(255,255,255,.45)";
        ctx.beginPath(); ctx.arc(mx, my, Math.max(1.5, c * 0.1), 0, Math.PI * 2); ctx.fill();
      } else {
        const r = c * 0.26;
        ctx.strokeStyle = FARBE.treffer;
        ctx.lineWidth = Math.max(2, c * 0.1);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(mx - r, my - r); ctx.lineTo(mx + r, my + r);
        ctx.moveTo(mx + r, my - r); ctx.lineTo(mx - r, my + r);
        ctx.stroke();
      }
    }
    if (this.letzter?.ziel === seite) {
      ctx.strokeStyle = "rgba(255,216,77,.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(bereich.x + this.letzter.x * c + 1, bereich.y + this.letzter.y * c + 1, c - 2, c - 2);
    }
  }

  #markiere(bereich, x, y, farbe) {
    const c = bereich.b / this.g;
    this.ctx.fillStyle = farbe;
    this.ctx.fillRect(bereich.x + x * c, bereich.y + y * c, c, c);
  }

  /** Kleines Schiffsbild für Listen, mittig auf Höhe y. */
  #symbol(x, y, laenge, groesse = 10) {
    const c = groesse + 2;
    zeichneSchiff(this.ctx, laenge, x, y - c / 2, c, false);
  }

  // --- Zeichnen: Phasen ---

  zeichnen() {
    this.knoepfe = [];
    this.ctx.fillStyle = "#14171f";
    this.ctx.fillRect(0, 0, BREITE, HOEHE);
    if (this.phase === "regeln") {
      if (this.ich === 0 && this.zahnrad) this.#einstellungenZeichnen();
      else this.#regelwahlZeichnen();
      return;
    }
    this.ctx.fillStyle = FARBE.leiste;
    this.ctx.fillRect(LX - 12, 0, BREITE - LX + 12, HOEHE);
    if (this.phase === "aufstellen") this.#aufstellungZeichnen();
    else this.#kampfZeichnen();
  }

  #regelKarte(x, y, regeln, aktion) {
    const { ctx } = this;
    const b = 300;
    const h = 170;
    ctx.fillStyle = FARBE.block;
    ctx.beginPath();
    ctx.roundRect(x, y, b, h, 12);
    ctx.fill();
    ctx.strokeStyle = FARBE.akzent;
    ctx.lineWidth = 2;
    ctx.stroke();
    this.#text(regeln.name, x + 20, y + 30, { groesse: 18, fett: true });
    const zeilen = [
      `${regeln.groesse} × ${regeln.groesse} Felder`,
      `Flotte: ${flotteText(regeln)}`,
      regeln.nochmal ? "Nach Treffer nochmal schießen" : "Immer abwechselnd schießen",
      regeln.beruehren ? "Schiffe dürfen sich berühren" : "Schiffe berühren sich nicht",
    ];
    zeilen.forEach((z, i) => this.#text(z, x + 20, y + 66 + i * 24, { groesse: 13, farbe: FARBE.leise }));
    this.knoepfe.push({ x, y, b, h, aktion, aus: false });
  }

  #regelwahlZeichnen() {
    this.#text("Schiffe versenken", BREITE / 2, 52, { groesse: 26, fett: true, ausrichtung: "center" });
    if (this.ich !== 0) {
      this.#text(`${this.spielerName(0)} wählt die Spielregeln …`, BREITE / 2, 220, { farbe: FARBE.leise, ausrichtung: "center" });
      return;
    }
    this.#text("Regeln wählen – Klick auf eine Karte startet das Spiel", BREITE / 2, 88, { groesse: 13, farbe: FARBE.leise, ausrichtung: "center" });
    const senden = (regeln) => this.#senden({ typ: "regeln", regeln: regelnBereinigen(regeln) }).catch(() => {});
    this.#regelKarte(64, 120, VORLAGEN.klassisch, () => senden(VORLAGEN.klassisch));
    this.#regelKarte(396, 120, VORLAGEN.deutsch, () => senden(VORLAGEN.deutsch));
    this.#knopf(BREITE / 2 - 110, 330, 220, 48, "⚙  Eigene Regeln", () => { this.zahnrad = true; }, { schrift: 15 });
  }

  #einstellungenZeichnen() {
    const e = this.entwurf;
    const minusPlus = (x, y, wert, aendern, { min, max }) => {
      this.#knopf(x, y, 34, 32, "−", () => aendern(-1), { aus: wert <= min, schrift: 18 });
      this.#text(String(wert), x + 62, y + 16, { groesse: 16, fett: true, ausrichtung: "center" });
      this.#knopf(x + 90, y, 34, 32, "+", () => aendern(1), { aus: wert >= max, schrift: 18 });
    };
    const schalter = (x, y, an, umschalten) => this.#knopf(x, y, 124, 32, an ? "Ja" : "Nein", umschalten, { art: an ? "gut" : undefined });

    this.#text("⚙  Eigene Regeln", 40, 36, { groesse: 22, fett: true });

    // links: Feld und Spielweise
    this.#text("Spielfeld", 40, 96, { fett: true });
    this.#text(`${e.groesse} × ${e.groesse}`, 40, 116, { groesse: 12, farbe: FARBE.leise });
    minusPlus(220, 90, e.groesse, (d) => { e.groesse += d; }, { min: GROESSE_MIN, max: GROESSE_MAX });
    this.#text("Nach Treffer nochmal", 40, 160, { fett: true });
    this.#text("sonst immer abwechselnd", 40, 180, { groesse: 12, farbe: FARBE.leise });
    schalter(220, 154, e.nochmal, () => { e.nochmal = !e.nochmal; });
    this.#text("Berührung erlaubt", 40, 224, { fett: true });
    this.#text("Schiffe dürfen aneinander liegen", 40, 244, { groesse: 12, farbe: FARBE.leise });
    schalter(220, 218, e.beruehren, () => { e.beruehren = !e.beruehren; });
    this.#text("Vorlage laden", 40, 296, { fett: true });
    this.#knopf(40, 312, 148, 34, "Klassisch", () => { this.entwurf = regelnBereinigen(VORLAGEN.klassisch); });
    this.#knopf(196, 312, 148, 34, "Deutsche Variante", () => { this.entwurf = regelnBereinigen(VORLAGEN.deutsch); });

    // rechts: Flotte
    this.#text("Flotte", 400, 66, { fett: true });
    LAENGEN.forEach((l, i) => {
      const y = 84 + i * 46;
      const anzahl = e.flotte[l] ?? 0;
      this.#text(SCHIFFSNAMEN[l], 400, y + 8, { groesse: 13, farbe: anzahl ? FARBE.text : FARBE.leise });
      this.#symbol(400, y + 26, l, 9);
      minusPlus(596, y, anzahl, (d) => {
        const neu = anzahl + d;
        if (neu) e.flotte[l] = neu; else delete e.flotte[l];
      }, { min: 0, max: ANZAHL_MAX });
    });

    // unten: Prüfung und Start
    const fehler = regelnFehler(e);
    const liste = schiffsListe(e);
    const felder = liste.reduce((a, b) => a + b, 0);
    this.#text(fehler || `${liste.length} Schiffe · ${felder} Felder · passt ✓`, 40, 392,
      { groesse: 14, fett: true, farbe: fehler ? FARBE.treffer : FARBE.gut });
    this.#knopf(400, 410, 150, 48, "Zurück", () => { this.zahnrad = false; });
    this.#knopf(566, 410, 154, 48, "Los geht's", () => {
      entwurfSpeichern(e);
      this.#senden({ typ: "regeln", regeln: regelnBereinigen(e) }).catch(() => {});
    }, { art: "hell", aus: Boolean(fehler), schrift: 15 });
  }

  #aufstellungZeichnen() {
    const ich = this.ich;
    this.#text(this.bereit[ich] || this.bereitGesendet ? "Deine Flotte" : "Stelle deine Flotte auf", GROSS.x, 16, { fett: true });
    this.#raster(GROSS, true);
    for (const s of this.schiffe) this.#schiff(GROSS, s, PALETTEN.normal);
    if (this.#darfAufstellen && this.zeiger) {
      const neu = this.#vorschau(...this.zeiger);
      const aufSchiff = this.schiffe.some((s) => zellen(s).some(([a, b]) => a === this.zeiger[0] && b === this.zeiger[1]));
      if (aufSchiff) this.#markiere(GROSS, ...this.zeiger, "rgba(255,255,255,.18)");
      else if (neu) this.#schiff(GROSS, neu, passtDazu(this.regeln, this.schiffe, neu) ? PALETTEN.gut : PALETTEN.falsch, 0.8);
    }

    // Leiste: Schiffe zum Setzen
    this.#text("Schiffe", LX, 22, { fett: true });
    const uebrig = this.#uebrig();
    const aktuell = this.#aktuelleLaenge();
    LAENGEN.filter((l) => this.regeln.flotte[l]).forEach((l, i) => {
      const y = 40 + i * 38;
      const fertig = uebrig[l] === 0;
      const gewaehlt = l === aktuell && this.#darfAufstellen;
      this.#knopf(LX, y, LB, 32, "", () => { this.gewaehlt = l; }, { art: gewaehlt ? "gewaehlt" : undefined, aus: fertig || !this.#darfAufstellen });
      this.ctx.globalAlpha = fertig ? 0.45 : 1;
      this.#text(SCHIFFSNAMEN[l], LX + 10, y + 16, { groesse: 13 });
      this.#symbol(LX + 120, y + 16, l, 8);
      this.#text(fertig ? "✓" : `${uebrig[l]}×`, LX + LB - 10, y + 16, { groesse: 13, fett: true, ausrichtung: "right" });
      this.ctx.globalAlpha = 1;
    });

    const darf = this.#darfAufstellen;
    this.#text("Klick: setzen · R: drehen", LX, 286, { groesse: 12, farbe: FARBE.leise });
    this.#text("Schiff anklicken: wieder aufnehmen", LX, 304, { groesse: 12, farbe: FARBE.leise });
    const halb = (LB - 8) / 2;
    this.#knopf(LX, 322, halb, 40, this.senkrecht ? "↻ Senkrecht" : "↻ Waagerecht", () => { this.senkrecht = !this.senkrecht; }, { aus: !darf });
    this.#knopf(LX + halb + 8, 322, halb, 40, "🎲 Zufällig", () => this.#zufaellig(), { aus: !darf });
    this.#knopf(LX, 370, halb, 40, "Leeren", () => { this.schiffe = []; this.gewaehlt = null; this.#status(); }, { aus: !darf || !this.schiffe.length });
    this.#knopf(LX + halb + 8, 370, halb, 40, "✓ Fertig", () => this.#fertig(),
      { art: "gut", aus: !darf || !flotteGueltig(this.regeln, this.schiffe) });

    const gegner = this.gegner;
    const name = this.spielerName(gegner);
    const zeile = this.bereit[gegner] ? `${name} ist bereit ✓` : `${name} stellt noch auf …`;
    this.#text(zeile, LX, 438, { groesse: 13, farbe: this.bereit[gegner] ? FARBE.gut : FARBE.leise });
    if (this.bereitGesendet) this.#text("Du bist bereit. Warte …", LX, 460, { groesse: 13, farbe: FARBE.gut });
  }

  #kampfZeichnen() {
    const ich = this.ich;
    const gegner = this.gegner;
    const g = this.g;
    this.#text(`Meer von ${this.spielerName(gegner)}`, GROSS.x, 16, { fett: true });
    this.#raster(GROSS, true);
    const aufgedeckt = this.aufgedeckt[gegner];
    if (aufgedeckt) for (const s of aufgedeckt) this.#schiff(GROSS, s, PALETTEN.normal, 0.5);
    const rand = this.#randVersenkter(gegner);
    const c = GROSS.b / g;
    this.ctx.fillStyle = "rgba(255,255,255,.12)";
    for (const feld of rand) {
      this.ctx.beginPath();
      this.ctx.arc(GROSS.x + (feld % g) * c + c / 2, GROSS.y + Math.floor(feld / g) * c + c / 2, Math.max(1.5, c * 0.08), 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.#schuesseZeichnen(GROSS, gegner);
    const zielen = this.phase === "kampf" && this.amZug === ich && !this.offen && !this.wartet;
    if (zielen && this.zeiger) {
      const [zx, zy] = this.zeiger;
      const frei = !this.schuesse[gegner].has(zy * g + zx) && !rand.has(zy * g + zx);
      this.#markiere(GROSS, zx, zy, frei ? "rgba(124,242,154,.35)" : "rgba(255,255,255,.08)");
    }

    // Leiste: Status
    let titel;
    let farbe = FARBE.text;
    if (this.phase === "ende") {
      titel = this.sieger === ich ? "Gewonnen! 🎉" : `${this.spielerName(this.sieger)} gewinnt`;
      farbe = this.sieger === ich ? FARBE.gut : FARBE.treffer;
    } else if (this.offen || this.wartet) titel = "Schuss unterwegs …";
    else if (zielen) { titel = "Du bist dran!"; farbe = FARBE.gut; }
    else titel = `${this.spielerName(this.amZug)} zielt …`;
    this.ctx.fillStyle = FARBE.block;
    this.ctx.beginPath();
    this.ctx.roundRect(LX, 10, LB, 62, 8);
    this.ctx.fill();
    this.#text(titel, LX + 12, 30, { groesse: 16, fett: true, farbe });
    this.#text(this.meldung || (this.phase === "ende" ? "Alle Schiffe versenkt" : "Klick ins Meer zum Schießen"),
      LX + 12, 54, { groesse: 12, farbe: FARBE.leise });
    if (this.phase === "ende") {
      this.#knopf(LX + LB - 82, 21, 72, 40, "Weiter", () => { this.endeWartet = 0; this.beenden(); }, { art: "hell" });
    }

    // eigenes Feld
    this.#text("Deine Flotte", LX, 94, { groesse: 13, fett: true });
    this.#raster(KLEIN, false);
    for (const s of this.schiffe) this.#schiff(KLEIN, s, PALETTEN.normal);
    this.#schuesseZeichnen(KLEIN, ich);

    // gegnerische Flotte: was noch schwimmt
    this.#text(`Flotte von ${this.spielerName(gegner)}`, LX, 334, { groesse: 13, fett: true });
    const versenktJe = {};
    for (const s of this.versenkt[gegner]) versenktJe[s.laenge] = (versenktJe[s.laenge] ?? 0) + 1;
    LAENGEN.filter((l) => this.regeln.flotte[l]).forEach((l, i) => {
      const y = 356 + i * 19;
      const gesamt = this.regeln.flotte[l];
      const schwimmt = gesamt - (versenktJe[l] ?? 0);
      this.ctx.globalAlpha = schwimmt ? 1 : 0.4;
      this.#symbol(LX, y, l, 7);
      this.#text(`${SCHIFFSNAMEN[l]}  ${schwimmt}/${gesamt}`, LX + 60, y, { groesse: 12 });
      this.ctx.globalAlpha = 1;
    });

  }
}
