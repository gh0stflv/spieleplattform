import { Spiel, Zustand } from "../../core/Spiel.js";
import { KARTEN_FORMAT, farbeVon, rangVon, zeichneKarte } from "../karten.js";

// Spider-Solitaire mit 104 Karten in 10 Spalten. Ziel: acht Reihen König → Ass in einer Farbe,
// die dann abgelegt werden. Klassische Punkte: Start 500, jeder Zug −1, jede fertige Reihe +100.
// Rückgängig zählt selbst als Zug, Hinweise sind frei. Nur gewonnene Spiele kommen in die Bestenliste.
const SPALTEN = 10;
const START_PUNKTE = 500;
const REIHE_PUNKTE = 100;
const B = 66; // Kartenbreite
const H = B * KARTEN_FORMAT;
const LUECKE = (800 - SPALTEN * B) / (SPALTEN + 1);
const OBEN = 52;
const UNTEN = 528; // bis hier dürfen Spalten reichen, darunter liegen Stapel und fertige Reihen
const FUSS_Y = 540;
const ABSTAND_ZU = 9; // senkrechter Versatz verdeckter Karten
const ABSTAND_AUF = 24;
const MAX_VERLAUF = 1000;
const FARBEN_JE_MODUS = { 1: [0], 2: [0, 1], 4: [0, 1, 2, 3] }; // ♠ / ♠♥ / alle vier
const FARBE = {
  filz: "#1d5a3c", filzHell: "#24704b", text: "#f2f4f8", leise: "#b5d3c2", gold: "#ffd84d",
  gut: "#7cf29a", warn: "#ff7b8a", knopf: "#2c3242", akzent: "#5b6cff",
};
const SCHRIFT = 'system-ui, "Segoe UI", sans-serif';

/** Gemischtes Spiel: 54 Karten in den Spalten (4 × 6, 6 × 5, oberste offen), 50 im Stapel. */
export function neuesSpiel(farben, zufall = Math.random) {
  const karten = [];
  for (const f of farben) for (let n = 0; n < 8 / farben.length; n++) for (let r = 0; r < 13; r++) karten.push(f * 13 + r);
  for (let i = karten.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [karten[i], karten[j]] = [karten[j], karten[i]];
  }
  const spalten = Array.from({ length: SPALTEN }, (_, j) => karten.splice(0, j < 4 ? 6 : 5).map((k) => ({ k, offen: false })));
  for (const s of spalten) s[s.length - 1].offen = true;
  return { spalten, stapel: karten };
}

/** Bilden die Karten ab Index i eine bewegliche Folge (offen, eine Farbe, lückenlos absteigend)? */
export function beweglich(spalte, i) {
  if (i < 0 || i >= spalte.length || !spalte[i].offen) return false;
  for (let n = i + 1; n < spalte.length; n++) {
    const oben = spalte[n - 1].k;
    const unten = spalte[n].k;
    if (farbeVon(oben) !== farbeVon(unten) || rangVon(oben) !== rangVon(unten) + 1) return false;
  }
  return true;
}

/** Darf karte auf ziel (oberste Karte einer Spalte, undefined = leere Spalte)? Farbe egal. */
const passtAuf = (karte, ziel) => !ziel || (ziel.offen && rangVon(ziel.k) === rangVon(karte.k) + 1);

export class Spider extends Spiel {
  static breite = 800;
  static hoehe = 640;
  static modi = [
    { id: "1", name: "1 Farbe (leicht)" },
    { id: "2", name: "2 Farben (mittel)" },
    { id: "4", name: "4 Farben (schwer)" },
  ];

  constructor(canvas, rueckrufe) {
    super("Spider-Solitaire", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  get bestenlisteId() { return this.modus === "2" || this.modus === "4" ? `spider-${this.modus}` : "spider"; }
  get bestenlisteName() { return this.modus === "2" || this.modus === "4" ? `${this.modus} Farben` : "1 Farbe"; }
  get gewertet() { return this.gewonnen; }
  get ergebnisText() { return this.gewonnen ? `Gewonnen in ${this.zuege} Zügen!` : "Aufgegeben"; }

  zuruecksetzen() {
    const { spalten, stapel } = neuesSpiel(FARBEN_JE_MODUS[this.modus] ?? FARBEN_JE_MODUS[1]);
    this.spalten = spalten;
    this.stapel = stapel;
    this.abgelegt = []; // Farbe jeder fertigen Reihe
    this.punkte = START_PUNKTE;
    this.zuege = 0;
    this.verlauf = [];
    this.ziehen = null; // { j, i, dx, dy, aktiv } beim Ziehen mit Maus/Finger
    this.zeiger = null;
    this.hinweis = null;
    this.hinweisNr = 0;
    this.meldung = null;
    this.aufgebenFrage = 0;
    this.gewonnen = false;
    this.siegZeit = 0;
    this.knoepfe = [];
  }

  starten(modus) {
    super.starten(modus);
    this.#status();
  }

  #status() { this.rueckrufe.beiPunkten?.(this.punkte); }

  // --- Spielzüge ---

  #merken() {
    this.verlauf.push({
      spalten: this.spalten.map((s) => s.map((c) => ({ ...c }))),
      stapel: [...this.stapel],
      abgelegt: [...this.abgelegt],
      punkte: this.punkte,
    });
    if (this.verlauf.length > MAX_VERLAUF) this.verlauf.shift();
  }

  #zugGezaehlt() {
    this.zuege++;
    this.punkte--;
    this.hinweis = null;
    this.hinweisNr = 0;
    this.meldung = null;
  }

  /** Verschiebt die Folge ab Karte i der Spalte von auf die Spalte nach. false = nicht erlaubt. */
  ziehe(von, i, nach) {
    const quelle = this.spalten[von];
    const ziel = this.spalten[nach];
    if (this.gewonnen || von === nach || !ziel || !beweglich(quelle, i) || !passtAuf(quelle[i], ziel.at(-1))) return false;
    this.#merken();
    ziel.push(...quelle.splice(i));
    this.#zugGezaehlt();
    this.#aufdecken(quelle);
    this.#reiheAbraeumen(nach);
    this.#nachDemZug();
    return true;
  }

  /** Eine neue Karte auf jede Spalte. Geht nur, wenn keine Spalte leer ist. */
  austeilen() {
    if (this.gewonnen || !this.stapel.length) return false;
    if (this.spalten.some((s) => !s.length)) {
      this.#melden("Erst alle leeren Spalten füllen, dann austeilen.");
      return false;
    }
    this.#merken();
    for (const s of this.spalten) s.push({ k: this.stapel.pop(), offen: true });
    this.#zugGezaehlt();
    for (let j = 0; j < SPALTEN; j++) this.#reiheAbraeumen(j);
    this.#nachDemZug();
    return true;
  }

  rueckgaengig() {
    if (this.gewonnen || !this.verlauf.length) return false;
    const alt = this.verlauf.pop();
    Object.assign(this, { spalten: alt.spalten, stapel: alt.stapel, abgelegt: alt.abgelegt, punkte: alt.punkte });
    this.#zugGezaehlt(); // Rückgängig kostet selbst einen Zug
    this.#status();
    return true;
  }

  #aufdecken(spalte) {
    const oben = spalte.at(-1);
    if (oben) oben.offen = true;
  }

  /** Liegt unten in der Spalte eine komplette Reihe König → Ass einer Farbe, wird sie abgelegt. */
  #reiheAbraeumen(j) {
    const s = this.spalten[j];
    const i = s.length - 13;
    if (i < 0 || rangVon(s[i].k) !== 12 || !beweglich(s, i)) return;
    this.abgelegt.push(farbeVon(s[i].k));
    s.splice(i);
    this.punkte += REIHE_PUNKTE;
    this.#aufdecken(s);
  }

  #nachDemZug() {
    if (this.abgelegt.length === 8) {
      this.gewonnen = true;
      this.punkte = Math.max(0, this.punkte);
      this.siegZeit = 2.5;
    }
    this.#status();
  }

  /** Sinnvolle Züge, beste zuerst: auf gleiche Farbe, deckt eine Karte auf, macht eine Spalte frei. */
  hinweise() {
    const liste = [];
    const leer = this.spalten.findIndex((s) => !s.length);
    this.spalten.forEach((s, von) => {
      if (!s.length) return;
      let i = s.length - 1;
      while (i > 0 && beweglich(s, i - 1)) i--;
      const darunter = s[i - 1];
      const liegtSchonPassend = darunter?.offen && rangVon(darunter.k) === rangVon(s[i].k) + 1;
      if (leer >= 0 && darunter && !liegtSchonPassend) liste.push({ von, i, nach: leer, wert: darunter.offen ? 0 : 1 });
      this.spalten.forEach((z, nach) => {
        const oben = z.at(-1);
        if (nach === von || !oben || !passtAuf(s[i], oben)) return;
        const gleicheFarbe = farbeVon(oben.k) === farbeVon(s[i].k);
        if (liegtSchonPassend && !gleicheFarbe) return; // nur ein Seitenwechsel ohne Nutzen
        const wert = (gleicheFarbe ? 4 : 0) + (darunter && !darunter.offen ? 2 : 0) + (darunter ? 0 : 1);
        liste.push({ von, i, nach, wert });
      });
    });
    return liste.sort((a, b) => b.wert - a.wert);
  }

  #zeigeHinweis() {
    const liste = this.hinweise();
    if (liste.length) {
      this.hinweis = { ...liste[this.hinweisNr % liste.length], zeit: 1.8 };
      this.hinweisNr++;
    } else if (this.stapel.length) {
      this.hinweis = { austeilen: true, zeit: 1.8 };
    } else {
      this.#melden("Keine sinnvollen Züge mehr – Rückgängig oder Aufgeben.");
    }
  }

  /** Ziel für einen Klick: passende Karte gleicher Farbe, sonst irgendeine passende, sonst eine leere Spalte. */
  #bestesZiel(von, i) {
    const karte = this.spalten[von][i];
    const reihenfolge = Array.from({ length: SPALTEN - 1 }, (_, n) => (von + 1 + n) % SPALTEN);
    const passend = reihenfolge.filter((n) => this.spalten[n].length && passtAuf(karte, this.spalten[n].at(-1)));
    return passend.find((n) => farbeVon(this.spalten[n].at(-1).k) === farbeVon(karte.k))
      ?? passend[0]
      ?? (i > 0 ? reihenfolge.find((n) => !this.spalten[n].length) : undefined);
  }

  #melden(text) { this.meldung = { text, zeit: 2.5 }; }

  #aufgeben() {
    if (this.gewonnen) return;
    if (this.aufgebenFrage > 0) this.beenden();
    else this.aufgebenFrage = 3;
  }

  update(dt) {
    if (this.hinweis && (this.hinweis.zeit -= dt) <= 0) this.hinweis = null;
    if (this.meldung && (this.meldung.zeit -= dt) <= 0) this.meldung = null;
    if (this.aufgebenFrage > 0) this.aufgebenFrage -= dt;
    if (this.gewonnen && (this.siegZeit -= dt) <= 0) this.beenden();
  }

  // --- Eingabe ---

  #spalteX(j) { return LUECKE + j * (B + LUECKE); }

  /** y-Position jeder Karte einer Spalte; lange Spalten werden zusammengeschoben. */
  #kartenY(j) {
    const s = this.spalten[j];
    if (!s.length) return [];
    const schritte = s.slice(0, -1).map((c) => (c.offen ? ABSTAND_AUF : ABSTAND_ZU));
    const summe = schritte.reduce((a, b) => a + b, 0);
    const faktor = Math.min(1, (UNTEN - H - OBEN) / (summe || 1));
    const ys = [OBEN];
    for (const schritt of schritte) ys.push(ys.at(-1) + schritt * faktor);
    return ys;
  }

  /** Spalte und Karte unter (x, y); i = -1 heißt: Spalte getroffen, aber keine Karte. */
  #treffer(x, y) {
    for (let j = 0; j < SPALTEN; j++) {
      const sx = this.#spalteX(j);
      if (x < sx || x >= sx + B) continue;
      const ys = this.#kartenY(j);
      for (let i = ys.length - 1; i >= 0; i--) if (y >= ys[i] && y < ys[i] + H) return { j, i };
      return { j, i: -1 };
    }
    return null;
  }

  verarbeiteDruck(x, y) {
    const t = this.#treffer(x, y);
    const greifbar = t && !this.gewonnen && this.zustand === Zustand.LAEUFT && beweglich(this.spalten[t.j], t.i);
    this.ziehen = greifbar ? { ...t, dx: 0, dy: 0, aktiv: false } : null;
  }

  verarbeiteZiehen(dx, dy) {
    if (!this.ziehen || this.zustand !== Zustand.LAEUFT) return false;
    this.ziehen.dx += dx;
    this.ziehen.dy += dy;
    this.ziehen.aktiv = true;
    return true;
  }

  verarbeiteLoslassen() {
    const z = this.ziehen;
    this.ziehen = null;
    if (!z?.aktiv) return;
    // Ziel ist die Spalte, über der die Mitte der gezogenen Karte losgelassen wird
    const mitte = this.#spalteX(z.j) + B / 2 + z.dx;
    const nach = Math.round((mitte - LUECKE - B / 2) / (B + LUECKE));
    if (nach >= 0 && nach < SPALTEN) this.ziehe(z.j, z.i, nach);
  }

  verarbeiteZeiger(x, y) { this.zeiger = { x, y }; }

  verarbeiteKlick(x, y) {
    this.ziehen = null;
    if (this.zustand !== Zustand.LAEUFT) return;
    const knopf = this.knoepfe.find((k) => !k.aus && x >= k.x && x < k.x + k.b && y >= k.y && y < k.y + k.h);
    if (knopf) { knopf.aktion(); return; }
    const t = this.#treffer(x, y);
    if (!t || t.i < 0 || this.gewonnen) return;
    const karte = this.spalten[t.j][t.i];
    if (!karte.offen) return;
    if (!beweglich(this.spalten[t.j], t.i)) {
      this.#melden("Nur Karten einer Farbe in lückenloser Folge lassen sich zusammen bewegen.");
      return;
    }
    const nach = this.#bestesZiel(t.j, t.i);
    if (nach === undefined) this.#melden("Dafür gibt es gerade keinen Platz.");
    else this.ziehe(t.j, t.i, nach);
  }

  verarbeiteEingabe(taste) {
    if (this.zustand !== Zustand.LAEUFT) return;
    const t = taste.toLowerCase();
    if (t === "z" || t === "backspace") this.rueckgaengig();
    else if (t === "h") this.#zeigeHinweis();
    else if (t === "d" || t === "enter") this.austeilen();
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

  #knopf(x, y, b, h, text, aktion, { farbe = FARBE.knopf, aus = false } = {}) {
    const { ctx } = this;
    ctx.globalAlpha = aus ? 0.4 : 1;
    ctx.fillStyle = farbe;
    ctx.beginPath();
    ctx.roundRect(x, y, b, h, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    this.#text(text, x + b / 2, y + h / 2 + 1, { groesse: 13, fett: true });
    this.knoepfe.push({ x, y, b, h, aktion, aus });
  }

  #rahmen(x, y, b, h, farbe, breite = 3) {
    const { ctx } = this;
    ctx.strokeStyle = farbe;
    ctx.lineWidth = breite;
    ctx.beginPath();
    ctx.roundRect(x - 3, y - 3, b + 6, h + 6, 9);
    ctx.stroke();
  }

  zeichnen() {
    const { ctx } = this;
    this.knoepfe = [];
    const verlauf = ctx.createRadialGradient(400, 160, 60, 400, 300, 640);
    verlauf.addColorStop(0, FARBE.filzHell);
    verlauf.addColorStop(1, FARBE.filz);
    ctx.fillStyle = verlauf;
    ctx.fillRect(0, 0, this.breite, this.hoehe);
    if (this.zustand === Zustand.BEREIT) return;

    this.#kopfzeile();
    const gegriffen = this.ziehen?.aktiv ? this.ziehen : null;
    const ueber = !this.ziehen && this.zeiger ? this.#treffer(this.zeiger.x, this.zeiger.y) : null;
    for (let j = 0; j < SPALTEN; j++) this.#spalteZeichnen(j, gegriffen, ueber);
    this.#fusszeile();
    if (gegriffen) this.#gegriffeneZeichnen(gegriffen);

    if (this.meldung) {
      ctx.font = `600 14px ${SCHRIFT}`;
      const b = ctx.measureText(this.meldung.text).width + 32;
      ctx.fillStyle = "rgba(20,23,31,.9)";
      ctx.beginPath();
      ctx.roundRect(400 - b / 2, UNTEN - 46, b, 36, 10);
      ctx.fill();
      this.#text(this.meldung.text, 400, UNTEN - 27, { groesse: 14, fett: true, farbe: FARBE.gold });
    }
    if (this.gewonnen) {
      ctx.fillStyle = "rgba(20,23,31,.82)";
      ctx.fillRect(0, 230, this.breite, 130);
      this.#text("Gewonnen!", 400, 272, { groesse: 40, fett: true, farbe: FARBE.gold });
      this.#text(`${this.punkte} Punkte · ${this.zuege} Züge`, 400, 322, { groesse: 18 });
    }
  }

  #kopfzeile() {
    this.#knopf(LUECKE, 8, 150, 34, "Rückgängig (Z)", () => this.rueckgaengig(), { aus: !this.verlauf.length || this.gewonnen });
    this.#knopf(LUECKE + 160, 8, 120, 34, "Hinweis (H)", () => this.#zeigeHinweis(), { aus: this.gewonnen });
    const frage = this.aufgebenFrage > 0;
    this.#knopf(800 - LUECKE - 150, 8, 150, 34, frage ? "Wirklich aufgeben?" : "Aufgeben", () => this.#aufgeben(),
      { farbe: frage ? "#a33a48" : FARBE.knopf, aus: this.gewonnen });
    this.#text(`${this.bestenlisteName}  ·  Züge ${this.zuege}  ·  Reihen ${this.abgelegt.length} / 8`, 470, 26,
      { groesse: 13, fett: true, farbe: FARBE.leise });
  }

  #spalteZeichnen(j, gegriffen, ueber) {
    const { ctx } = this;
    const x = this.#spalteX(j);
    const s = this.spalten[j];
    const ys = this.#kartenY(j);
    if (!s.length) {
      ctx.strokeStyle = "rgba(255,255,255,.25)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.roundRect(x, OBEN, B, H, B * 0.1);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const bis = gegriffen?.j === j ? gegriffen.i : s.length;
    for (let i = 0; i < bis; i++) zeichneKarte(ctx, s[i].k, x, ys[i], B, { verdeckt: !s[i].offen, kompakt: true });

    const h = this.hinweis;
    if (h && !h.austeilen) {
      if (h.von === j) this.#rahmen(x, ys[h.i], B, ys.at(-1) + H - ys[h.i], FARBE.gold);
      if (h.nach === j) this.#rahmen(x, ys.at(-1) ?? OBEN, B, H, FARBE.gut);
    }
    if (ueber?.j === j && ueber.i >= 0 && beweglich(s, ueber.i) && !this.gewonnen) {
      this.#rahmen(x, ys[ueber.i], B, ys.at(-1) + H - ys[ueber.i], "rgba(255,255,255,.55)", 2);
    }
  }

  #gegriffeneZeichnen(z) {
    const s = this.spalten[z.j];
    const ys = this.#kartenY(z.j);
    const x = this.#spalteX(z.j) + z.dx;
    for (let i = z.i; i < s.length; i++) zeichneKarte(this.ctx, s[i].k, x, ys[i] + z.dy, B, { kompakt: true });
  }

  #fusszeile() {
    const { ctx } = this;
    // fertige Reihen links, jeweils der König obenauf
    if (!this.abgelegt.length) {
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(LUECKE, FUSS_Y, B, H, B * 0.1);
      ctx.stroke();
      this.#text("Fertige", LUECKE + B / 2, FUSS_Y + H / 2 - 8, { groesse: 11, farbe: FARBE.leise });
      this.#text("Reihen", LUECKE + B / 2, FUSS_Y + H / 2 + 8, { groesse: 11, farbe: FARBE.leise });
    }
    this.abgelegt.forEach((farbe, n) => zeichneKarte(ctx, farbe * 13 + 12, LUECKE + n * 22, FUSS_Y, B, { kompakt: true }));

    // Stapel rechts: ein Häufchen pro verbleibendem Austeilen
    const haeufchen = Math.ceil(this.stapel.length / SPALTEN);
    if (!haeufchen) return;
    const rechts = 800 - LUECKE - B;
    const links = rechts - (haeufchen - 1) * 14;
    for (let n = 0; n < haeufchen; n++) zeichneKarte(ctx, 0, links + n * 14, FUSS_Y, B, { verdeckt: true });
    if (this.hinweis?.austeilen) this.#rahmen(links, FUSS_Y, rechts - links + B, H, FARBE.gold);
    this.#text("Austeilen (D)", links - 12, FUSS_Y + H / 2 - 9, { groesse: 13, fett: true, ausrichtung: "right" });
    this.#text(`noch ${haeufchen}×`, links - 12, FUSS_Y + H / 2 + 10, { groesse: 12, farbe: FARBE.leise, ausrichtung: "right" });
    this.knoepfe.push({ x: links, y: FUSS_Y, b: rechts - links + B, h: H, aktion: () => this.austeilen(), aus: this.gewonnen });
  }
}
