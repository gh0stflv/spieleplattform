import { RundenSpiel } from "../../core/RundenSpiel.js";
import { Zustand } from "../../core/Spiel.js";
import { N, Stellung, UMWANDLUNG, seiteVon, typ } from "./Regeln.js";

// Schach nur im LAN: Spieler 0 (hat den Raum erstellt) spielt Weiß und wählt die Bedenkzeit.
// Neben dem Brett liegt eine Leiste mit Uhren, Zugliste und Knöpfen für Remis und Aufgeben.
const FELD = 60;
const BRETT = FELD * N;
const LX = BRETT + 12; // linke Kante der Leiste
const LB = 216; // Breite der Leiste
const UHREN = [
  { name: "Ohne Uhr", minuten: 0, bonus: 0 },
  { name: "3 + 2", minuten: 3, bonus: 2 },
  { name: "5 + 0", minuten: 5, bonus: 0 },
  { name: "10 + 0", minuten: 10, bonus: 0 },
  { name: "15 + 10", minuten: 15, bonus: 10 },
];
const KULANZ = 1.5; // so lange wartet der Gegner nach Ablauf, ob der Zug noch übers Netz kommt
const AUFGEBEN_FRAGEN = 3; // Sekunden, in denen ein zweiter Klick die Aufgabe bestätigt
const FIGUR = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const FARBE = {
  hell: "#d8cfb9", dunkel: "#7a849a", leiste: "#1b1f2a", block: "#252a37",
  text: "#e8eaf0", leise: "#8b93a7", gut: "#7cf29a", akzent: "#5b6cff", warn: "#ff5b6e",
};
const SCHRIFT = 'system-ui, "Segoe UI", sans-serif';

function uhrText(s) {
  if (s < 10) return s.toFixed(1);
  const ganz = Math.ceil(s);
  return `${Math.floor(ganz / 60)}:${String(ganz % 60).padStart(2, "0")}`;
}

export class Schach extends RundenSpiel {
  static breite = BRETT + 240;
  static hoehe = BRETT;
  static ohnePause = true;
  static modi = [{ id: "lan", name: "Im Netzwerk (LAN) spielen", lan: true }];
  static seiten = ["Weiß", "Schwarz"];
  static symbole = ["♔", "♚"];

  constructor(canvas, rueckrufe) {
    super("Schach", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  zuruecksetzen() {
    this.stellung = new Stellung();
    this.erlaubteCache = { nr: -1, zuege: [] };
    this.uhr = null; // Eintrag aus UHREN, null = noch nicht gewählt
    this.zeit = [0, 0]; // Restzeit in Sekunden
    this.zugStart = [0, 0]; // Restzeit zu Beginn des laufenden Zugs: mehr darf niemand melden
    this.ueberZeit = 0;
    this.zeitGemeldet = false;
    this.notation = [];
    this.auswahl = -1;
    this.letzter = null;
    this.umwandlung = null; // [von, nach], solange die Figurenwahl offen ist
    this.remisAngebot = null; // Seite, die gerade Remis anbietet
    this.angebotBeiZug = [-1, -1]; // höchstens ein Angebot pro Zug und Seite
    this.aufgebenFragen = 0;
    this.grund = "";
    this.knoepfe = [];
  }

  starten(modus) {
    super.starten(modus);
    this.rueckrufe.beiPunkten?.("wird gewählt", "Bedenkzeit");
  }

  get #gedreht() { return this.raum?.ich === 1; }
  #anzeige(i) { return this.#gedreht ? N * N - 1 - i : i; }
  get #mitUhr() { return Boolean(this.uhr?.minuten); }
  get #laeuft() {
    return this.zustand === Zustand.LAEUFT && this.sieger === undefined && this.uhr !== null && Boolean(this.raum);
  }

  get menschAmZug() {
    return this.uhr !== null && super.menschAmZug && !(this.#mitUhr && this.zeit[this.amZug] <= 0);
  }

  get ergebnisText() {
    return this.grund ? `${super.ergebnisText} (${this.grund})` : super.ergebnisText;
  }

  #erlaubte() {
    if (this.erlaubteCache.nr !== this.notation.length) {
      this.erlaubteCache = { nr: this.notation.length, zuege: this.stellung.zuege() };
    }
    return this.erlaubteCache.zuege;
  }

  #senden(daten) { this.raum?.senden(daten).catch(() => {}); }

  #zeigeAmZug() {
    this.rueckrufe.beiPunkten?.(this.spielerName(this.amZug), `${Schach.symbole[this.amZug]} Am Zug`);
  }

  #beenden(sieger, grund) {
    this.grund = grund;
    this.auswahl = -1;
    this.umwandlung = null;
    this.partieBeenden(sieger);
  }

  // --- Regeln für RundenSpiel ---

  zugErlaubt(zug, seite) {
    return this.uhr !== null && seite === this.stellung.amZug && this.stellung.erlaubt(zug);
  }

  zugAnwenden(zug) {
    this.notation.push(this.stellung.ziehe(zug));
    this.letzter = zug;
    this.auswahl = -1;
    this.umwandlung = null;
    this.remisAngebot = null; // ein Zug lehnt ein offenes Angebot ab
  }

  ergebnis() {
    const e = this.stellung.ergebnis();
    if (!e) return undefined;
    this.grund = e.grund;
    return e.sieger;
  }

  botZug() { return undefined; } // Schach gibt es nur im LAN

  zugZusatz() { return { rest: this.zeit[this.amZug] }; }

  // --- Ereignisse aus dem Raum (kommen auf allen Geräten in derselben Reihenfolge an) ---

  empfangeEreignis(ereignis) {
    const { von, daten } = ereignis;
    if (this.zustand !== Zustand.LAEUFT || this.sieger !== undefined || (von !== 0 && von !== 1)) return;
    switch (daten?.typ) {
      case "einstellung": this.#einstellen(von, daten.uhr); break;
      case "zug": this.#zugEmpfangen(ereignis); break;
      case "zeit": this.#zeitAbgelaufen(daten); break;
      case "remis": this.#remis(von, daten.antwort); break;
      case "aufgeben":
        if (this.uhr) this.#beenden(1 - von, `${this.spielerName(von)} hat aufgegeben`);
        break;
      default:
    }
  }

  #einstellen(von, nr) {
    if (von !== 0 || this.uhr || !Number.isInteger(nr) || !UHREN[nr]) return;
    this.uhr = UHREN[nr];
    this.zeit = [this.uhr.minuten * 60, this.uhr.minuten * 60];
    this.zugStart = [...this.zeit];
    this.#zeigeAmZug();
  }

  #zugEmpfangen(ereignis) {
    const { von, daten } = ereignis;
    if (von !== this.amZug || !this.zugErlaubt(daten.zug, von)) return;
    if (this.#mitUhr) { // die gemeldete Restzeit des Ziehenden gilt, damit alle Uhren gleich stehen
      const rest = Number.isFinite(daten.rest) ? Math.min(Math.max(daten.rest, 0), this.zugStart[von]) : this.zugStart[von];
      this.zeit[von] = rest + this.uhr.bonus;
    }
    super.empfangeEreignis(ereignis);
    this.zugStart[this.amZug] = this.zeit[this.amZug];
    this.ueberZeit = 0;
    this.zeitGemeldet = false;
  }

  /** Gilt nur, wenn seitdem kein Zug kam (sonst hat der Zug das Rennen gewonnen). */
  #zeitAbgelaufen({ seite, zug }) {
    if (!this.#mitUhr || seite !== this.amZug || zug !== this.notation.length) return;
    this.zeit[seite] = 0;
    const gegner = 1 - seite;
    if (this.stellung.kannMattsetzen(gegner)) this.#beenden(gegner, "Zeit abgelaufen");
    else this.#beenden(null, "Zeit abgelaufen, aber zu wenig Material");
  }

  /** {typ: "remis"} bietet an, {typ: "remis", antwort: true/false} antwortet auf das Angebot des Gegners. */
  #remis(von, antwort) {
    if (!this.uhr) return;
    if (this.remisAngebot === 1 - von) {
      if (antwort === false) this.remisAngebot = null;
      else this.#beenden(null, "Remis vereinbart"); // Zusage, oder beide haben gleichzeitig angeboten
      return;
    }
    if (antwort === undefined && this.remisAngebot === null && this.angebotBeiZug[von] !== this.notation.length) {
      this.remisAngebot = von;
      this.angebotBeiZug[von] = this.notation.length;
    }
  }

  update(dt) {
    super.update(dt);
    if (this.aufgebenFragen > 0) this.aufgebenFragen -= dt;
    if (!this.#laeuft || !this.#mitUhr || !this.notation.length) return; // Uhr läuft ab dem ersten Zug von Weiß
    const seite = this.amZug;
    this.zeit[seite] = Math.max(0, this.zeit[seite] - dt);
    if (this.zeit[seite] > 0 || this.zeitGemeldet) return;
    this.ueberZeit += dt;
    if (seite !== this.raum.ich && this.ueberZeit < KULANZ) return;
    this.zeitGemeldet = true;
    this.raum.senden({ typ: "zeit", seite, zug: this.notation.length }).catch(() => { this.zeitGemeldet = false; });
  }

  // --- Eingabe ---

  verarbeiteKlick(x, y) {
    const knopf = this.knoepfe.find((k) => !k.aus && x >= k.x && x < k.x + k.b && y >= k.y && y < k.y + k.h);
    if (knopf) { knopf.aktion(); return; }
    if (this.umwandlung) { this.umwandlung = null; return; } // daneben geklickt: Wahl abbrechen
    if (x >= BRETT || !this.menschAmZug) return;
    const i = this.#anzeige(Math.floor(y / FELD) * N + Math.floor(x / FELD));
    const zuege = this.#erlaubte();
    const passend = zuege.filter(([v, n]) => v === this.auswahl && n === i);
    if (passend.length > 1) { this.umwandlung = [this.auswahl, i]; return; } // Bauer erreicht die letzte Reihe
    if (passend.length) { this.ziehe(passend[0]); this.auswahl = -1; return; }
    this.auswahl = zuege.some(([v]) => v === i) ? i : -1;
  }

  // --- Zeichnen ---

  zeichnen() {
    this.knoepfe = [];
    this.ctx.fillStyle = "#14171f";
    this.ctx.fillRect(0, 0, this.breite, this.hoehe);
    this.#brettZeichnen();
    this.#leisteZeichnen();
    if (this.zustand !== Zustand.LAEUFT || !this.raum) return;
    if (!this.uhr) this.#uhrWahlZeichnen();
    else if (this.umwandlung) this.#umwandlungZeichnen();
  }

  #mitte(i) {
    const a = this.#anzeige(i);
    return { x: (a % N) * FELD + FELD / 2, y: Math.floor(a / N) * FELD + FELD / 2 };
  }

  #figur(f, x, y, groesse) {
    const { ctx } = this;
    const weiss = seiteVon(f) === 0;
    const zeichen = `${FIGUR[typ(f)]}︎`; // ︎: als Schriftzeichen, nicht als Emoji
    ctx.font = `${groesse * 0.8}px "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = groesse * 0.05;
    ctx.strokeStyle = weiss ? "#2a2f3c" : "#e8e4d8";
    ctx.strokeText(zeichen, x, y + groesse * 0.04);
    ctx.fillStyle = weiss ? "#fbf8ef" : "#1d2029";
    ctx.fillText(zeichen, x, y + groesse * 0.04);
  }

  #brettZeichnen() {
    const { ctx, stellung } = this;
    for (let a = 0; a < N * N; a++) {
      const x = a % N;
      const y = Math.floor(a / N);
      ctx.fillStyle = (x + y) % 2 ? FARBE.dunkel : FARBE.hell;
      ctx.fillRect(x * FELD, y * FELD, FELD, FELD);
    }
    const markiere = (i, farbe) => {
      const a = this.#anzeige(i);
      ctx.fillStyle = farbe;
      ctx.fillRect((a % N) * FELD, Math.floor(a / N) * FELD, FELD, FELD);
    };
    if (this.letzter) { markiere(this.letzter[0], "rgba(255,216,77,.35)"); markiere(this.letzter[1], "rgba(255,216,77,.35)"); }
    if (this.uhr && stellung.imSchach()) markiere(stellung.f.indexOf(stellung.amZug === 0 ? "K" : "k"), "rgba(255,91,110,.6)");
    if (this.auswahl >= 0) markiere(this.auswahl, "rgba(124,242,154,.5)");

    ctx.font = `600 11px ${SCHRIFT}`;
    for (let k = 0; k < N; k++) {
      ctx.fillStyle = k % 2 ? FARBE.hell : FARBE.dunkel;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(String(this.#gedreht ? k + 1 : N - k), 3, k * FELD + 3);
      ctx.fillStyle = (k + N - 1) % 2 ? FARBE.hell : FARBE.dunkel;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("abcdefgh"[this.#gedreht ? N - 1 - k : k], k * FELD + FELD - 3, BRETT - 2);
    }

    for (let i = 0; i < N * N; i++) {
      if (stellung.f[i] === ".") continue;
      const { x, y } = this.#mitte(i);
      this.#figur(stellung.f[i], x, y, FELD);
    }

    if (this.auswahl >= 0 && this.menschAmZug) { // Ziele: Punkt, beim Schlagen ein Ring
      const ziele = new Set(this.#erlaubte().filter(([v]) => v === this.auswahl).map(([, n]) => n));
      ctx.fillStyle = "rgba(20,23,31,.35)";
      ctx.strokeStyle = "rgba(20,23,31,.35)";
      ctx.lineWidth = 5;
      for (const n of ziele) {
        const { x, y } = this.#mitte(n);
        ctx.beginPath();
        if (stellung.f[n] === ".") { ctx.arc(x, y, FELD * 0.15, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.arc(x, y, FELD * 0.44, 0, Math.PI * 2); ctx.stroke(); }
      }
    }
  }

  #kuerzen(text, max) {
    const { ctx } = this;
    if (ctx.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
    return `${t}…`;
  }

  #knopf(x, y, b, h, text, aktion, { art, aus = false } = {}) {
    const { ctx } = this;
    ctx.globalAlpha = aus ? 0.4 : 1;
    ctx.fillStyle = { gut: "#2f7a4a", warn: "#b8323f", hell: FARBE.akzent }[art] ?? "#2c3242";
    ctx.beginPath();
    ctx.roundRect(x, y, b, h, 8);
    ctx.fill();
    ctx.fillStyle = FARBE.text;
    ctx.font = `600 13px ${SCHRIFT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + b / 2, y + h / 2);
    ctx.globalAlpha = 1;
    this.knoepfe.push({ x, y, b, h, aktion, aus });
  }

  #spielerZeichnen(seite, y) {
    const { ctx } = this;
    const aktiv = this.#laeuft && this.amZug === seite;
    ctx.fillStyle = aktiv ? "rgba(91,108,255,.28)" : FARBE.block;
    ctx.beginPath();
    ctx.roundRect(LX, y, LB, 60, 8);
    ctx.fill();
    if (aktiv) { ctx.strokeStyle = FARBE.akzent; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `600 15px ${SCHRIFT}`;
    ctx.fillStyle = FARBE.text;
    const platz = LB - 24 - (this.#mitUhr ? 78 : 0);
    ctx.fillText(this.#kuerzen(`${Schach.symbole[seite]} ${this.spielerName(seite)}`, platz), LX + 12, y + 21);
    ctx.font = `12px ${SCHRIFT}`;
    ctx.fillStyle = FARBE.leise;
    ctx.fillText(`${Schach.seiten[seite]}${seite === this.raum?.ich ? " · du" : ""}`, LX + 12, y + 43);
    if (!this.#mitUhr) return;
    ctx.font = `700 24px ui-monospace, Consolas, monospace`;
    ctx.textAlign = "right";
    ctx.fillStyle = aktiv && this.zeit[seite] < 10 ? FARBE.warn : FARBE.text;
    ctx.fillText(uhrText(this.zeit[seite]), LX + LB - 12, y + 31);
  }

  #zuglisteZeichnen(y, h) {
    const { ctx } = this;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = `600 12px ${SCHRIFT}`;
    ctx.fillStyle = FARBE.leise;
    ctx.fillText("ZÜGE", LX, y + 8);
    const zeilen = Math.ceil(this.notation.length / 2);
    if (!zeilen) {
      ctx.font = `13px ${SCHRIFT}`;
      ctx.fillText("Noch keine Züge", LX, y + 34);
      return;
    }
    const platz = Math.floor((h - 24) / 20);
    const erste = Math.max(0, zeilen - platz); // die neuesten Züge bleiben sichtbar
    ctx.font = `14px ${SCHRIFT}`;
    for (let z = erste; z < zeilen; z++) {
      const zy = y + 34 + (z - erste) * 20;
      ctx.textAlign = "right";
      ctx.fillStyle = FARBE.leise;
      ctx.fillText(`${z + 1}.`, LX + 30, zy);
      ctx.textAlign = "left";
      for (const s of [0, 1]) {
        const nr = 2 * z + s;
        if (nr >= this.notation.length) break;
        ctx.fillStyle = nr === this.notation.length - 1 ? FARBE.gut : FARBE.text;
        ctx.fillText(this.notation[nr], LX + 40 + s * 85, zy);
      }
    }
  }

  #leisteZeichnen() {
    const { ctx } = this;
    ctx.fillStyle = FARBE.leiste;
    ctx.fillRect(BRETT, 0, this.breite - BRETT, this.hoehe);
    const ich = this.raum?.ich ?? 0;
    const gegner = 1 - ich;
    this.#spielerZeichnen(gegner, 10);
    this.#zuglisteZeichnen(80, 210);
    this.#spielerZeichnen(ich, 334);

    let meldung = "";
    let farbe = FARBE.text;
    if (this.sieger !== undefined) meldung = this.grund;
    else if (this.remisAngebot === gegner) { meldung = `${this.spielerName(gegner)} bietet Remis an`; farbe = FARBE.gut; }
    else if (this.remisAngebot === ich) { meldung = "Remis angeboten …"; farbe = FARBE.leise; }
    else if (this.#laeuft && this.stellung.imSchach()) { meldung = "Schach!"; farbe = FARBE.warn; }
    ctx.font = `600 14px ${SCHRIFT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = farbe;
    ctx.fillText(this.#kuerzen(meldung, LB), LX + LB / 2, 312);

    const an = this.#laeuft;
    const y = 410;
    if (an && this.remisAngebot === gegner) {
      this.#knopf(LX, y, 104, 52, "Annehmen", () => this.#senden({ typ: "remis", antwort: true }), { art: "gut" });
      this.#knopf(LX + 112, y, 104, 52, "Ablehnen", () => this.#senden({ typ: "remis", antwort: false }));
      return;
    }
    const angeboten = this.remisAngebot === ich || this.angebotBeiZug[ich] === this.notation.length;
    this.#knopf(LX, y, 104, 52, "Remis anbieten", () => this.#senden({ typ: "remis" }), { aus: !an || angeboten });
    const fragen = this.aufgebenFragen > 0;
    this.#knopf(LX + 112, y, 104, 52, fragen ? "Wirklich?" : "Aufgeben", () => {
      if (this.aufgebenFragen > 0) this.#senden({ typ: "aufgeben" });
      else this.aufgebenFragen = AUFGEBEN_FRAGEN;
    }, { art: fragen ? "warn" : undefined, aus: !an });
  }

  #uhrWahlZeichnen() {
    const { ctx } = this;
    ctx.fillStyle = "rgba(14,16,22,.85)";
    ctx.fillRect(0, 0, BRETT, BRETT);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = FARBE.text;
    ctx.font = `700 24px ${SCHRIFT}`;
    ctx.fillText("Bedenkzeit", BRETT / 2, 104);
    ctx.font = `13px ${SCHRIFT}`;
    ctx.fillStyle = FARBE.leise;
    if (this.raum.ich !== 0) {
      ctx.fillText(`${this.spielerName(0)} wählt die Bedenkzeit …`, BRETT / 2, 140);
      return;
    }
    ctx.fillText("Minuten pro Spieler + Sekunden pro Zug", BRETT / 2, 136);
    UHREN.forEach((u, nr) => {
      this.#knopf(140, 166 + nr * 52, 200, 44, u.name, () => this.#senden({ typ: "einstellung", uhr: nr }),
        { art: nr === 3 ? "hell" : undefined });
    });
  }

  #umwandlungZeichnen() {
    const { ctx } = this;
    ctx.fillStyle = "rgba(14,16,22,.7)";
    ctx.fillRect(0, 0, BRETT, BRETT);
    ctx.fillStyle = FARBE.text;
    ctx.font = `600 16px ${SCHRIFT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Umwandeln in:", BRETT / 2, 186);
    UMWANDLUNG.forEach((u, nr) => {
      const x = 120 + nr * FELD;
      const y = 210;
      ctx.fillStyle = FARBE.hell;
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, FELD - 6, FELD - 6, 8);
      ctx.fill();
      this.#figur(this.amZug === 0 ? u.toUpperCase() : u, x + FELD / 2, y + FELD / 2, FELD);
      this.knoepfe.push({ x, y, b: FELD, h: FELD, aktion: () => {
        const [von, nach] = this.umwandlung;
        this.umwandlung = null;
        this.ziehe([von, nach, u]);
        this.auswahl = -1;
      } });
    });
  }
}
