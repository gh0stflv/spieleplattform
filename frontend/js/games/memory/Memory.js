import { Spiel, Spielobjekt, Zustand } from "../../core/Spiel.js";

// Memory in mehreren Größen von 4 × 4 bis 100 × 100. Die Karten liegen in einer "Welt" mit festem
// Raster; eine Kamera (Zoom + Verschiebung) bestimmt, welcher Ausschnitt auf das Spielfeld kommt.
const RASTER = 100; // Abstand der Karten in Weltkoordinaten
const KARTE = 88; // Kartengröße in Weltkoordinaten
const RAND = 12; // Rand ums Feld in Pixeln
const GROESSEN = { 4: [4, 4], 10: [10, 10], 15: [15, 14], 20: [20, 20], 25: [25, 24], 100: [100, 100] };
const ZOOM_AB = 15; // ab dieser Spaltenzahl kann gezoomt werden
const MAX_KARTE_PX = 110; // so groß wird eine Karte beim Hineinzoomen höchstens
const KLASSISCH = ["🐍", "🎮", "👾", "🚀", "⭐", "🍕", "🎲", "🐙"];
const ZURUECKDREHEN_S = 0.8;
const MAX_PUNKTE = 1000; // 4 × 4
const PUNKTE_PRO_PAAR = 60; // größere Felder
// Gibt es mehr Paare als Emojis, unterscheiden sich Paare zusätzlich durch die Kartenfarbe
const KARTENFARBEN = ["#f4f1e8", "#ffd9d9", "#d4ecff", "#d9f7d4", "#fff0bf", "#e9dcff", "#ffe2c4"];

// Unicode-Bereiche, die als farbige Emojis dargestellt werden (ohne Uhren, Hautfarben und Flaggen)
const BEREICHE = [
  [0x1f300, 0x1f320], [0x1f32d, 0x1f335], [0x1f337, 0x1f37c], [0x1f37e, 0x1f393], [0x1f3a0, 0x1f3ca],
  [0x1f3cf, 0x1f3d3], [0x1f3e0, 0x1f3f0], [0x1f3f8, 0x1f3fa], [0x1f400, 0x1f43e], [0x1f442, 0x1f4fc],
  [0x1f4ff, 0x1f53d], [0x1f54b, 0x1f54e], [0x1f5fb, 0x1f64f], [0x1f680, 0x1f6c5], [0x1f6d0, 0x1f6d2],
  [0x1f6eb, 0x1f6ec], [0x1f6f4, 0x1f6f8], [0x1f910, 0x1f93a], [0x1f940, 0x1f945], [0x1f947, 0x1f94c],
  [0x1f950, 0x1f96b], [0x1f980, 0x1f997], [0x1f9d0, 0x1f9e6],
];
const EMOJIS = BEREICHE.flatMap(([von, bis]) => Array.from({ length: bis - von + 1 }, (_, i) => String.fromCodePoint(von + i)));

function mischen(liste) { // Fisher-Yates
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  return liste;
}

/** Ein eigenes Aussehen (Symbol + Kartenfarbe) für jedes Paar. */
function paarBilder(anzahl) {
  if (anzahl <= KLASSISCH.length) return KLASSISCH.slice(0, anzahl).map((symbol) => ({ symbol, farbe: 0 }));
  const alle = [];
  for (let farbe = 0; farbe < Math.ceil(anzahl / EMOJIS.length); farbe++) {
    for (const symbol of EMOJIS) alle.push({ symbol, farbe });
  }
  return mischen(alle).slice(0, anzahl);
}

const begrenzen = (wert, min, max) => Math.min(max, Math.max(min, wert));

class Karte extends Spielobjekt {
  constructor(x, y, paar, symbol, farbe) {
    super(x, y, KARTE, KARTE); // in Weltkoordinaten
    this.paar = paar;
    this.symbol = symbol;
    this.farbe = farbe;
    this.aufgedeckt = false;
    this.gefunden = false;
    this.drehung = 0; // 0 = Rückseite, 1 = Vorderseite (für Animation)
  }

  /** Dreht die Karte weiter. true, wenn sie sich bewegt hat. */
  update(dt) {
    const ziel = this.aufgedeckt || this.gefunden ? 1 : 0;
    if (this.drehung === ziel) return false;
    this.drehung += Math.sign(ziel - this.drehung) * Math.min(Math.abs(ziel - this.drehung), dt * 6);
    return true;
  }

  /** Füllfarbe der Karte im jetzigen Zustand (gefundene farbige Karten blass). */
  get fuellung() {
    if (this.gefunden) return this.farbe ? `${KARTENFARBEN[this.farbe]}59` : "#2d4a3a"; // 59 = 35 % Deckkraft
    return this.drehung > 0.5 ? KARTENFARBEN[this.farbe] : "#5b6cff";
  }

  /** Rechteck auf dem Bildschirm, beim Umdrehen schmaler. */
  rechteck(kamera) {
    const groesse = this.breite * kamera.zoom;
    const skala = Math.abs(Math.cos(this.drehung * Math.PI));
    const b = groesse * Math.max(skala, 0.02);
    return { x: (this.x - kamera.x) * kamera.zoom + (groesse - b) / 2, y: (this.y - kamera.y) * kamera.zoom, b, groesse, skala };
  }

  zeichnen(ctx, kamera) {
    const { x, y: sy, b, groesse, skala } = this.rechteck(kamera);
    const sx = (this.x - kamera.x) * kamera.zoom;
    const vorne = this.drehung > 0.5;
    ctx.fillStyle = this.fuellung;
    ctx.beginPath();
    ctx.roundRect(x, sy, b, groesse, groesse * 0.11);
    ctx.fill();
    if (vorne && skala > 0.2 && groesse >= 12) {
      ctx.save();
      ctx.translate(sx + groesse / 2, sy + groesse / 2);
      ctx.scale(skala, 1);
      ctx.globalAlpha = this.gefunden ? 0.6 : 1;
      ctx.font = `${groesse * 0.55}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.symbol, 0, groesse * 0.04);
      ctx.restore();
    } else if (!vorne && groesse >= 24) {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = `bold ${groesse * 0.35}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", sx + groesse / 2, sy + groesse / 2 + 2);
    }
  }
}

export class Memory extends Spiel {
  static modi = [
    { id: "4", name: "4 × 4 (klassisch)" },
    { id: "10", name: "10 × 10" },
    { id: "15", name: "15 × 14" },
    { id: "20", name: "20 × 20" },
    { id: "25", name: "25 × 24" },
    { id: "100", name: "100 × 100 (riesig, mit Zoom)" },
  ];

  constructor(canvas, rueckrufe) {
    super("Memory", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  get groesse() { return GROESSEN[this.modus] ?? GROESSEN[4]; }
  get klassisch() { return this.groesse === GROESSEN[4]; }
  /** Jede Größe hat ihre eigene Bestenliste. */
  get bestenlisteId() { return this.klassisch ? "memory" : `memory-${this.modus}`; }
  get bestenlisteName() { return `${this.groesse[0]} × ${this.groesse[1]}`; }
  get zoombar() { return this.groesse[0] >= ZOOM_AB; }

  zuruecksetzen() {
    const [spalten, zeilen] = this.groesse;
    const stapel = mischen(paarBilder((spalten * zeilen) / 2).flatMap((bild, paar) => [{ ...bild, paar }, { ...bild, paar }]));
    this.spalten = spalten;
    this.zeilen = zeilen;
    this.karten = stapel.map((k, i) => new Karte((i % spalten) * RASTER, Math.floor(i / spalten) * RASTER, k.paar, k.symbol, k.farbe));
    this.offen = [];
    this.versuche = 0;
    this.gefundenAnzahl = 0;
    this.wartezeit = 0;
    this.knoepfe = [];
    this.version = 0; // zählt Änderungen an den Karten
    this.ueberblick = null; // zwischengespeichertes Bild der Übersicht
    this.feldBreite = spalten * RASTER - (RASTER - KARTE);
    this.feldHoehe = zeilen * RASTER - (RASTER - KARTE);
    this.zoomMin = Math.min((this.breite - 2 * RAND) / this.feldBreite, (this.hoehe - 2 * RAND) / this.feldHoehe);
    this.zoomMax = Math.max(this.zoomMin, MAX_KARTE_PX / KARTE);
    this.kamera = { zoom: this.zoomMin, x: 0, y: 0 };
    this.#kameraBegrenzen();
  }

  // --- Kamera ---

  /** Passt das Feld in eine Richtung ganz hinein, wird es mittig gezeigt, sonst bleibt es am Rand hängen. */
  #kameraBegrenzen() {
    const k = this.kamera;
    k.zoom = begrenzen(k.zoom, this.zoomMin, this.zoomMax);
    const achse = (pos, feld, sicht) => {
      const sichtWelt = sicht / k.zoom;
      const rand = RAND / k.zoom;
      if (feld + 2 * rand <= sichtWelt) return -(sichtWelt - feld) / 2;
      return begrenzen(pos, -rand, feld + rand - sichtWelt);
    };
    k.x = achse(k.x, this.feldBreite, this.breite);
    k.y = achse(k.y, this.feldHoehe, this.hoehe);
  }

  /** Zoomt so, dass der Punkt (px, py) auf dem Bildschirm an seiner Stelle bleibt. */
  #zoomen(faktor, px = this.breite / 2, py = this.hoehe / 2) {
    const k = this.kamera;
    const wx = px / k.zoom + k.x;
    const wy = py / k.zoom + k.y;
    k.zoom = begrenzen(k.zoom * faktor, this.zoomMin, this.zoomMax);
    k.x = wx - px / k.zoom;
    k.y = wy - py / k.zoom;
    this.#kameraBegrenzen();
  }

  #verschieben(dx, dy) {
    this.kamera.x -= dx / this.kamera.zoom;
    this.kamera.y -= dy / this.kamera.zoom;
    this.#kameraBegrenzen();
  }

  get #darfZoomen() { return this.zoombar && this.zustand === Zustand.LAEUFT; }

  verarbeiteRad(x, y, delta) {
    if (!this.#darfZoomen) return false;
    this.#zoomen(Math.exp(-delta * 0.0015), x, y);
    return true;
  }

  verarbeiteZiehen(dx, dy) {
    if (!this.#darfZoomen) return false;
    this.#verschieben(dx, dy);
    return true;
  }

  verarbeiteEingabe(taste) {
    if (!this.#darfZoomen) return;
    if (taste === "+" || taste === "=") this.#zoomen(1.4);
    else if (taste === "-") this.#zoomen(1 / 1.4);
    else if (taste === "0") this.#zoomen(0);
    else {
      const schritt = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] }[taste];
      if (schritt) this.#verschieben(...schritt);
    }
  }

  // --- Spiel ---

  /** 4 × 4: 1000 minus Abzug für Fehlversuche und Zeit. Größer: 60 pro Paar minus Abzüge. Mindestens 10. */
  berechnePunkte() {
    const paare = this.karten.length / 2;
    const fehlversuche = this.versuche - paare;
    if (this.klassisch) {
      return Math.max(10, Math.min(MAX_PUNKTE, MAX_PUNKTE - fehlversuche * 40 - Math.floor(this.spielzeit) * 2));
    }
    const hoechstens = paare * PUNKTE_PRO_PAAR;
    return Math.max(10, Math.min(hoechstens, Math.round(hoechstens - fehlversuche * 10 - this.spielzeit / 2)));
  }

  verarbeiteKlick(x, y) {
    if (this.zustand !== Zustand.LAEUFT) return;
    const knopf = this.knoepfe.find((k) => x >= k.x && x < k.x + k.b && y >= k.y && y < k.y + k.h);
    if (knopf) { knopf.aktion(); return; }
    if (this.wartezeit > 0) return;
    const wx = x / this.kamera.zoom + this.kamera.x;
    const wy = y / this.kamera.zoom + this.kamera.y;
    const spalte = Math.floor(wx / RASTER);
    const zeile = Math.floor(wy / RASTER);
    if (spalte < 0 || zeile < 0 || spalte >= this.spalten || zeile >= this.zeilen) return;
    const karte = this.karten[zeile * this.spalten + spalte];
    if (!karte.enthaelt(wx, wy) || karte.aufgedeckt || karte.gefunden) return;
    karte.aufgedeckt = true;
    this.offen.push(karte);
    if (this.offen.length < 2) return;
    this.versuche++;
    const [a, b] = this.offen;
    if (a.paar !== b.paar) { this.wartezeit = ZURUECKDREHEN_S; return; }
    a.gefunden = b.gefunden = true;
    this.offen = [];
    this.gefundenAnzahl += 2;
    if (this.gefundenAnzahl === this.karten.length) {
      this.punkte = this.berechnePunkte();
      this.rueckrufe.beiPunkten?.(this.punkte);
      this.beenden();
    }
  }

  update(dt) {
    let bewegt = false;
    for (const k of this.karten) bewegt = k.update(dt) || bewegt;
    if (bewegt) this.version++; // gespeicherte Übersicht ist veraltet
    if (this.wartezeit > 0) {
      this.wartezeit -= dt;
      if (this.wartezeit <= 0) {
        this.offen.forEach((k) => { k.aufgedeckt = false; });
        this.offen = [];
      }
    }
    const paare = this.karten.length / 2;
    this.rueckrufe.beiPunkten?.(this.klassisch ? this.versuche : `${this.versuche} · Paare ${this.gefundenAnzahl / 2}/${paare}`, "Versuche");
  }

  zeichnen() {
    const { ctx, kamera } = this;
    ctx.fillStyle = "#14171f";
    ctx.fillRect(0, 0, this.breite, this.hoehe);
    // nur Karten im sichtbaren Ausschnitt zeichnen (wichtig bei 10.000 Karten)
    const von = (pos) => Math.max(0, Math.floor(pos / RASTER));
    const sp0 = von(kamera.x);
    const ze0 = von(kamera.y);
    const sp1 = Math.min(this.spalten - 1, Math.floor((kamera.x + this.breite / kamera.zoom) / RASTER));
    const ze1 = Math.min(this.zeilen - 1, Math.floor((kamera.y + this.hoehe / kamera.zoom) / RASTER));
    if (KARTE * kamera.zoom < 8) { // weit herausgezoomt: nur Farbflächen, als Bild zwischengespeichert
      const schluessel = `${kamera.zoom}|${kamera.x}|${kamera.y}|${this.version}`;
      if (this.ueberblick?.schluessel !== schluessel) {
        this.ueberblick ??= { bild: new OffscreenCanvas(this.canvas.width, this.canvas.height) };
        const bild = this.ueberblick.bild.getContext("2d");
        const dpr = this.canvas.width / this.breite;
        bild.setTransform(dpr, 0, 0, dpr, 0, 0);
        bild.clearRect(0, 0, this.breite, this.hoehe);
        const pfade = new Map(); // ein Pfad je Farbe statt tausender einzelner Befehle
        for (let ze = ze0; ze <= ze1; ze++) {
          for (let sp = sp0; sp <= sp1; sp++) {
            const karte = this.karten[ze * this.spalten + sp];
            const { x, y, b, groesse } = karte.rechteck(kamera);
            let pfad = pfade.get(karte.fuellung);
            if (!pfad) { pfad = new Path2D(); pfade.set(karte.fuellung, pfad); }
            pfad.rect(x, y, b, groesse);
          }
        }
        for (const [farbe, pfad] of pfade) { bild.fillStyle = farbe; bild.fill(pfad); }
        this.ueberblick.schluessel = schluessel;
      }
      ctx.drawImage(this.ueberblick.bild, 0, 0, this.breite, this.hoehe);
    } else {
      for (let ze = ze0; ze <= ze1; ze++) {
        for (let sp = sp0; sp <= sp1; sp++) this.karten[ze * this.spalten + sp].zeichnen(ctx, kamera);
      }
    }
    this.knoepfe = [];
    if (this.zoombar && this.zustand === Zustand.LAEUFT) this.#zoomKnoepfe();
  }

  /** + / − / Übersicht oben rechts, damit man auch ohne Mausrad (z. B. am Handy) zoomen kann. */
  #zoomKnoepfe() {
    const { ctx } = this;
    const b = 36;
    const x = this.breite - b - 8;
    [["+", () => this.#zoomen(1.6)], ["−", () => this.#zoomen(1 / 1.6)], ["", () => this.#zoomen(0)]].forEach(([text, aktion], i) => {
      const y = 8 + i * (b + 6);
      ctx.fillStyle = "rgba(20,23,31,.8)";
      ctx.beginPath();
      ctx.roundRect(x, y, b, b, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#e8eaf0";
      ctx.font = `700 20px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + b / 2, y + b / 2 + 1);
      if (!text) { // Übersicht: vier Ecken
        const a = 10;
        const e = 6;
        ctx.strokeStyle = "#e8eaf0";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (const [cx, cy, sx, sy] of [[x + a, y + a, 1, 1], [x + b - a, y + a, -1, 1], [x + a, y + b - a, 1, -1], [x + b - a, y + b - a, -1, -1]]) {
          ctx.moveTo(cx, cy + sy * e);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + sx * e, cy);
        }
        ctx.stroke();
      }
      this.knoepfe.push({ x, y, b, h: b, aktion });
    });
    if (this.kamera.zoom === this.zoomMin && this.versuche === 0) {
      ctx.fillStyle = "rgba(20,23,31,.85)";
      ctx.beginPath();
      ctx.roundRect(this.breite / 2 - 170, this.hoehe - 40, 340, 28, 8);
      ctx.fill();
      ctx.fillStyle = "#e8eaf0";
      ctx.font = `13px system-ui, sans-serif`;
      ctx.fillText("Mausrad / + − zum Zoomen · Ziehen zum Verschieben", this.breite / 2, this.hoehe - 26);
    }
  }
}
