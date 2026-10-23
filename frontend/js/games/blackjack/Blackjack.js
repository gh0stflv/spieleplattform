import { Spiel, Zustand } from "../../core/Spiel.js";
import { rangVon, zeichneKarte } from "../karten.js";

// Blackjack gegen die Bank: allein (Bestenliste = Guthaben beim Auszahlen) oder an einem LAN-Tisch.
// Regeln: Blackjack zahlt 3:2, Bank steht ab 17, Verdoppeln auf zwei Karten (auch nach Teilen),
// Teilen bis 4 Hände (Asse nur eine Karte), Versicherung 2:1 bei Ass der Bank. Die Bank bekommt
// ihre zweite Karte erst nach den Spielern; hat sie Blackjack, verliert man nur den ersten Einsatz.
// Alle Aktionen laufen als Ereignisse mit Zufallszahlen ("wuerfe"): allein lokal erzeugt,
// im LAN vom Server, damit niemand die nächsten Karten vorhersagen kann.
const START_GUTHABEN = 1000;
const MIN_EINSATZ = 10;
const NACHKAUF = 1000;
const ZUFALL = 14; // Zufallszahlen pro Ereignis (reicht für eigene Karten und die ganze Bank)
const MAX_HAENDE = 4;
const CHIPS = [10, 25, 50, 100, 250];
const CHIP_FARBEN = { 10: "#e8eaf0", 25: "#3f9b5a", 50: "#5b6cff", 100: "#1d2029", 250: "#c9a227" };
const BANK_TEMPO = 0.55; // Sekunden pro aufgedeckter Bankkarte
const FARBE = {
  filz: "#1d5a3c", filzHell: "#24704b", text: "#f2f4f8", leise: "#b5d3c2", gold: "#ffd84d",
  gut: "#7cf29a", warn: "#ff7b8a", knopf: "#2c3242", akzent: "#5b6cff",
};
const SCHRIFT = 'system-ui, "Segoe UI", sans-serif';

export const karteAus = (zahl) => zahl % 52; // unendlicher Kartenstapel
const punkteVon = (karte) => (rangVon(karte) === 0 ? 11 : Math.min(10, rangVon(karte) + 1));

/** Wert einer Hand; Asse zählen 11, solange die Hand nicht über 21 geht. */
export function handWert(karten) {
  let wert = 0;
  let asse = 0;
  for (const k of karten) { wert += punkteVon(k); if (rangVon(k) === 0) asse++; }
  while (wert > 21 && asse > 0) { wert -= 10; asse--; }
  return { wert, weich: asse > 0 };
}

const istBlackjack = (hand) => hand.karten.length === 2 && handWert(hand.karten).wert === 21 && !hand.geteilt;

export class Blackjack extends Spiel {
  static breite = 720;
  static ohnePause = true;
  static lanSpieler = { min: 2, max: 6 };
  static modi = [
    { id: "allein", name: "Allein gegen die Bank" },
    { id: "lan", name: "Am Tisch im Netzwerk (LAN)", lan: true },
  ];

  constructor(canvas, rueckrufe) {
    super("Blackjack", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  get imLan() { return this.modus === "lan"; }
  get gewertet() { return !this.imLan; }
  get ich() { return this.raum?.ich ?? 0; }
  get #meiner() { return this.spieler[this.ich]; }

  get ergebnisText() {
    if (this.imLan) return "Tisch geschlossen";
    return this.punkte > 0 ? `Ausgezahlt: ${this.punkte} Chips` : "Pleite! Die Bank gewinnt.";
  }

  zuruecksetzen() {
    const namen = this.raum?.spieler ?? ["Du"];
    this.spieler = namen.map((name) => ({ name, guthaben: START_GUTHABEN, nachgekauft: 0, ...this.#leereRunde() }));
    this.bank = [];
    this.bankAnzeige = 0; // so viele Bankkarten sind schon aufgedeckt (Animation)
    this.bankZeit = 0;
    this.phase = "einsatz"; // einsatz → versicherung → spielen → auswertung
    this.amZug = null; // { s, h } = Spieler und Hand
    this.runde = 1;
    this.entwurf = 0; // eigener Einsatz, der gerade zusammengeklickt wird
    this.letzterEinsatz = 0;
    this.wartet = false;
    this.knoepfe = [];
  }

  #leereRunde() {
    return { einsatz: 0, haende: [], versicherung: 0, entschieden: false };
  }

  starten(modus) {
    super.starten(modus);
    this.#status();
  }

  #status() {
    const ich = this.#meiner;
    if (ich) this.rueckrufe.beiPunkten?.(this.#guthabenAnzeige(ich), `Runde ${this.runde} · Guthaben`);
  }

  // --- Ereignisse ---

  /** Eigene Aktion: allein sofort mit eigenen Zufallszahlen, im LAN über den Server. */
  #aktion(daten) {
    if (this.imLan) {
      if (this.wartet) return;
      this.wartet = true;
      this.raum?.senden({ ...daten, zufall: ZUFALL }).catch(() => {}).finally(() => { this.wartet = false; });
    } else {
      const wuerfe = Array.from({ length: ZUFALL }, () => Math.floor(Math.random() * 2 ** 31));
      this.#verarbeiten(0, { ...daten, wuerfe });
    }
  }

  empfangeEreignis({ von, daten }) {
    if (this.zustand !== Zustand.LAEUFT || !this.spieler[von]) return;
    this.#verarbeiten(von, daten ?? {});
  }

  #verarbeiten(von, daten) {
    const w = Array.isArray(daten.wuerfe) ? daten.wuerfe.filter(Number.isInteger) : [];
    if (w.length < ZUFALL && ["einsatz", "versicherung", "karte", "stehen", "verdoppeln", "teilen"].includes(daten.typ)) return;
    const s = this.spieler[von];
    switch (daten.typ) {
      case "einsatz": this.#einsatz(von, s, daten.betrag, w); break;
      case "versicherung": this.#versicherung(s, daten.ja === true, w); break;
      case "karte": case "stehen": case "verdoppeln": case "teilen": this.#spielzug(von, daten.typ, w); break;
      case "naechste": if (this.phase === "auswertung" && this.#bankFertig) this.#naechsteRunde(); break;
      case "nachkaufen":
        if (s.guthaben < MIN_EINSATZ && this.phase !== "spielen") { s.guthaben += NACHKAUF; s.nachgekauft++; }
        break;
      default:
    }
    this.#status();
  }

  get #aktive() { return this.spieler.filter((s) => s.guthaben >= MIN_EINSATZ || s.einsatz > 0); }

  #einsatz(von, s, betrag, w) {
    if (this.phase !== "einsatz" || s.einsatz || !Number.isInteger(betrag) || betrag < MIN_EINSATZ || betrag > s.guthaben) return;
    s.einsatz = betrag;
    s.guthaben -= betrag;
    s.haende = [{ karten: [karteAus(w[0]), karteAus(w[1])], einsatz: betrag, fertig: false, geteilt: false }];
    if (von === this.ich) this.letzterEinsatz = betrag;
    const offen = this.spieler.filter((x) => x.guthaben >= MIN_EINSATZ && !x.einsatz);
    if (offen.length) return; // warten auf die anderen
    this.bank = [karteAus(w[2])];
    this.bankAnzeige = 1;
    if (rangVon(this.bank[0]) === 0) this.phase = "versicherung";
    else this.#spielBeginnen(w.slice(3));
  }

  #versicherung(s, ja, w) {
    if (this.phase !== "versicherung" || !s.einsatz || s.entschieden) return;
    s.entschieden = true;
    const preis = Math.floor(s.einsatz / 2);
    if (ja && preis > 0 && s.guthaben >= preis && !istBlackjack(s.haende[0])) { s.versicherung = preis; s.guthaben -= preis; }
    if (this.spieler.every((x) => !x.einsatz || x.entschieden)) this.#spielBeginnen(w);
  }

  #spielBeginnen(rest) {
    this.phase = "spielen";
    for (const s of this.spieler) for (const h of s.haende) if (istBlackjack(h)) h.fertig = true;
    this.amZug = this.#naechsteHand(0, 0);
    if (!this.amZug) this.#bankSpielt(rest);
  }

  /** Erste Hand ab (s, h), die noch spielen muss. */
  #naechsteHand(s0, h0) {
    for (let s = s0; s < this.spieler.length; s++) {
      const haende = this.spieler[s].haende;
      for (let h = s === s0 ? h0 : 0; h < haende.length; h++) if (!haende[h].fertig) return { s, h };
    }
    return null;
  }

  /** Darf diese Hand jetzt verdoppeln / teilen? (für Knöpfe und Prüfung) */
  #darf(art) {
    if (this.phase !== "spielen" || !this.amZug) return false;
    const s = this.spieler[this.amZug.s];
    const hand = s.haende[this.amZug.h];
    if (art === "verdoppeln") return hand.karten.length === 2 && s.guthaben >= hand.einsatz && !hand.asseGeteilt;
    if (art === "teilen") {
      return hand.karten.length === 2 && punkteVon(hand.karten[0]) === punkteVon(hand.karten[1])
        && s.haende.length < MAX_HAENDE && s.guthaben >= hand.einsatz;
    }
    return true;
  }

  #spielzug(von, art, w) {
    if (this.phase !== "spielen" || this.amZug?.s !== von || !this.#darf(art)) return;
    const s = this.spieler[von];
    const hand = s.haende[this.amZug.h];
    let rest = w;
    if (art === "karte") {
      hand.karten.push(karteAus(w[0]));
      rest = w.slice(1);
      if (handWert(hand.karten).wert >= 21) hand.fertig = true;
    } else if (art === "stehen") {
      hand.fertig = true;
    } else if (art === "verdoppeln") {
      s.guthaben -= hand.einsatz;
      hand.einsatz *= 2;
      hand.verdoppelt = true;
      hand.karten.push(karteAus(w[0]));
      rest = w.slice(1);
      hand.fertig = true;
    } else if (art === "teilen") {
      const asse = rangVon(hand.karten[0]) === 0;
      s.guthaben -= hand.einsatz;
      const neu = { karten: [hand.karten[1], karteAus(w[1])], einsatz: hand.einsatz, fertig: asse, geteilt: true, asseGeteilt: asse };
      hand.karten = [hand.karten[0], karteAus(w[0])];
      Object.assign(hand, { geteilt: true, asseGeteilt: asse, fertig: asse });
      s.haende.splice(this.amZug.h + 1, 0, neu);
      for (const x of [hand, neu]) if (handWert(x.karten).wert === 21) x.fertig = true;
      rest = w.slice(2);
    }
    this.amZug = this.#naechsteHand(this.amZug.s, this.amZug.h);
    if (!this.amZug) this.#bankSpielt(rest);
  }

  /** Bank zieht bis mindestens 17 (steht auch auf weicher 17), dann wird abgerechnet. */
  #bankSpielt(rest) {
    this.phase = "auswertung";
    this.amZug = null;
    const zahlen = [...rest];
    const ziehen = () => karteAus(zahlen.shift() ?? 0);
    this.bank.push(ziehen()); // zweite Karte
    const alleRaus = this.spieler.every((s) => s.haende.every((h) => handWert(h.karten).wert > 21 || istBlackjack(h)));
    if (!alleRaus) while (handWert(this.bank).wert < 17) this.bank.push(ziehen());
    this.bankZeit = BANK_TEMPO;
    for (const s of this.spieler) s.guthabenVorher = s.guthaben; // bis die Bank aufgedeckt ist, nichts verraten
    this.#abrechnen();
  }

  /** Angezeigtes Guthaben: während die Bank aufdeckt, noch der Stand vor der Abrechnung. */
  #guthabenAnzeige(s) {
    return this.phase === "auswertung" && !this.#bankFertig ? s.guthabenVorher : s.guthaben;
  }

  #abrechnen() {
    const bankWert = handWert(this.bank).wert;
    const bankBJ = this.bank.length === 2 && bankWert === 21;
    for (const s of this.spieler) {
      if (!s.einsatz) continue;
      s.gewinn = -s.versicherung;
      if (s.versicherung && bankBJ) { s.guthaben += s.versicherung * 3; s.gewinn += s.versicherung * 3; }
      if (bankBJ) {
        // Nur der erste Einsatz geht verloren; Verdopplungen und geteilte Hände gibt es zurück
        const gesamt = s.haende.reduce((a, h) => a + h.einsatz, 0);
        const zurueck = istBlackjack(s.haende[0]) ? gesamt : gesamt - s.einsatz;
        s.guthaben += zurueck;
        s.gewinn += zurueck - gesamt;
        for (const h of s.haende) h.ergebnis = istBlackjack(h) ? "Unentschieden" : "Bank hat Blackjack";
        continue;
      }
      for (const h of s.haende) {
        const wert = handWert(h.karten).wert;
        let auszahlung = 0;
        if (wert > 21) h.ergebnis = "Überkauft";
        else if (istBlackjack(h)) { auszahlung = h.einsatz * 2.5; h.ergebnis = "Blackjack!"; }
        else if (bankWert > 21 || wert > bankWert) { auszahlung = h.einsatz * 2; h.ergebnis = "Gewonnen"; }
        else if (wert === bankWert) { auszahlung = h.einsatz; h.ergebnis = "Unentschieden"; }
        else h.ergebnis = "Verloren";
        auszahlung = Math.floor(auszahlung);
        s.guthaben += auszahlung;
        s.gewinn += auszahlung - h.einsatz;
      }
    }
  }

  #naechsteRunde() {
    for (const s of this.spieler) Object.assign(s, this.#leereRunde(), { gewinn: undefined });
    this.bank = [];
    this.bankAnzeige = 0;
    this.phase = "einsatz";
    this.runde++;
    this.entwurf = Math.min(this.letzterEinsatz, this.#meiner.guthaben);
    if (!this.imLan && this.#meiner.guthaben < MIN_EINSATZ) { this.punkte = 0; this.beenden(); }
  }

  get #bankFertig() { return this.bankAnzeige >= this.bank.length; }

  update(dt) {
    if (this.phase === "auswertung" && !this.#bankFertig) {
      this.bankZeit -= dt;
      if (this.bankZeit <= 0) { this.bankAnzeige++; this.bankZeit = BANK_TEMPO; this.#status(); }
    }
  }

  /** Allein: Guthaben auszahlen und das Spiel beenden (das kommt in die Bestenliste). */
  #auszahlen() {
    if (this.imLan || this.phase !== "einsatz") return;
    this.punkte = this.#meiner.guthaben;
    this.beenden();
  }

  // --- Eingabe ---

  verarbeiteKlick(x, y) {
    const knopf = this.knoepfe.find((k) => !k.aus && x >= k.x && x < k.x + k.b && y >= k.y && y < k.y + k.h);
    knopf?.aktion();
  }

  verarbeiteEingabe(taste) {
    const t = taste.toLowerCase();
    if (this.phase === "spielen" && this.amZug?.s === this.ich) {
      const art = { h: "karte", k: "karte", s: "stehen", d: "verdoppeln", v: "verdoppeln", t: "teilen" }[t];
      if (art && this.#darf(art)) this.#aktion({ typ: art });
    } else if (t === "enter" || taste === " ") {
      if (this.phase === "einsatz" && this.entwurf >= MIN_EINSATZ && !this.#meiner.einsatz) this.#setzen();
      else if (this.phase === "auswertung" && this.#bankFertig) this.#naechste();
    }
  }

  #setzen() { this.#aktion({ typ: "einsatz", betrag: this.entwurf }); }
  #naechste() {
    if (this.imLan) this.raum?.senden({ typ: "naechste" }).catch(() => {});
    else this.#verarbeiten(0, { typ: "naechste" });
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

  #knopf(x, y, b, h, text, aktion, { farbe = FARBE.knopf, aus = false, groesse = 14 } = {}) {
    const { ctx } = this;
    ctx.globalAlpha = aus ? 0.4 : 1;
    ctx.fillStyle = farbe;
    ctx.beginPath();
    ctx.roundRect(x, y, b, h, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    this.#text(text, x + b / 2, y + h / 2 + 1, { groesse, fett: true });
    this.knoepfe.push({ x, y, b, h, aktion, aus });
  }

  #karte(karte, x, y, b, verdeckt = false) {
    zeichneKarte(this.ctx, karte, x, y, b, { verdeckt });
  }

  #hand(karten, mx, y, b, { verdeckt = 0, anzahl = karten.length } = {}) {
    const versatz = b * 0.42;
    const breite = b + versatz * (Math.max(anzahl, 1) - 1);
    const x0 = mx - breite / 2;
    for (let i = 0; i < anzahl; i++) this.#karte(karten[i], x0 + i * versatz, y, b, i >= karten.length - verdeckt && verdeckt > 0);
    return { x0, breite };
  }

  #chip(x, y, wert, r = 16) {
    const { ctx } = this;
    ctx.fillStyle = CHIP_FARBEN[wert] ?? FARBE.gold;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.setLineDash([r * 0.5, r * 0.45]);
    ctx.strokeStyle = wert === 10 ? "#5b6cff" : "#f2f4f8";
    ctx.lineWidth = r * 0.22;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    this.#text(String(wert), x, y + 1, { groesse: r * 0.62, fett: true, farbe: wert === 10 || wert === 250 ? "#1d2029" : "#f2f4f8" });
  }

  zeichnen() {
    const { ctx } = this;
    this.knoepfe = [];
    const verlauf = ctx.createRadialGradient(360, 120, 40, 360, 200, 520);
    verlauf.addColorStop(0, FARBE.filzHell);
    verlauf.addColorStop(1, FARBE.filz);
    ctx.fillStyle = verlauf;
    ctx.fillRect(0, 0, this.breite, this.hoehe);
    if (this.zustand === Zustand.BEREIT) return;

    // Bank
    this.#text("BLACKJACK ZAHLT 3 : 2  ·  BANK STEHT AUF 17  ·  VERSICHERUNG ZAHLT 2 : 1", 360, 160, { groesse: 11, farbe: "rgba(255,255,255,.35)", fett: true });
    const sichtbar = Math.min(this.bankAnzeige, this.bank.length);
    if (this.bank.length) {
      if (this.phase === "auswertung") this.#hand(this.bank, 360, 30, 64, { anzahl: sichtbar });
      else this.#hand([this.bank[0], 0], 360, 30, 64, { verdeckt: 1 }); // zweite Karte kommt erst nach den Spielern
      const wert = handWert(this.bank.slice(0, sichtbar)).wert;
      this.#text(`Bank: ${wert}${this.#bankFertig && wert > 21 ? " – überkauft!" : ""}`, 360, 18, { groesse: 13, fett: true });
    } else {
      this.#text("Bank", 360, 18, { groesse: 13, fett: true, farbe: FARBE.leise });
    }

    this.#spielerZeichnen();
    this.#steuerung();
  }

  #spielerZeichnen() {
    const n = this.spieler.length;
    const breite = this.breite / n;
    const b = n === 1 ? 60 : n <= 3 ? 50 : 40;
    this.spieler.forEach((s, i) => {
      const mx = breite * (i + 0.5);
      const haende = s.haende;
      const hb = breite / Math.max(1, haende.length);
      haende.forEach((h, j) => {
        const hx = mx - breite / 2 + hb * (j + 0.5);
        const aktiv = this.amZug?.s === i && this.amZug.h === j;
        const { x0, breite: hw } = this.#hand(h.karten, hx, 196, b);
        if (aktiv) {
          this.ctx.strokeStyle = FARBE.gold;
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.roundRect(x0 - 5, 191, hw + 10, b * 1.42 + 10, 8);
          this.ctx.stroke();
        }
        const wert = handWert(h.karten);
        const zeigeErgebnis = this.phase === "auswertung" && this.#bankFertig && h.ergebnis;
        const farbe = zeigeErgebnis ? (/Gewonnen|Blackjack/.test(h.ergebnis) ? FARBE.gut : h.ergebnis === "Unentschieden" ? FARBE.text : FARBE.warn) : FARBE.text;
        const text = zeigeErgebnis ? h.ergebnis : `${wert.wert > 21 ? "Überkauft" : istBlackjack(h) ? "Blackjack" : wert.wert}${h.verdoppelt ? " ×2" : ""}`;
        this.#text(text, hx, 196 + b * 1.42 + 14, { groesse: 12, fett: true, farbe });
        if (h.einsatz) this.#chip(hx, 180, h.einsatz >= 250 ? 250 : h.einsatz >= 100 ? 100 : h.einsatz >= 50 ? 50 : h.einsatz >= 25 ? 25 : 10, 11);
      });
      // Name und Guthaben
      const ich = i === this.ich;
      const y = 318;
      const name = n === 1 ? "" : `${s.name}${ich ? " (du)" : ""}`;
      if (name) this.#text(name, mx, y, { groesse: 13, fett: true, farbe: ich ? FARBE.gold : FARBE.text });
      const einsatz = s.haende.reduce((a, h) => a + h.einsatz, 0) || (ich && this.phase === "einsatz" ? this.entwurf : 0);
      let zeile = `Guthaben ${this.#guthabenAnzeige(s)}${einsatz ? `  ·  Einsatz ${einsatz}` : ""}`;
      if (s.versicherung) zeile += `  ·  versichert ${s.versicherung}`;
      this.#text(zeile, mx, y + 18, { groesse: 12, farbe: FARBE.leise });
      if (this.phase === "auswertung" && this.#bankFertig && s.gewinn !== undefined) {
        this.#text(`${s.gewinn > 0 ? "+" : ""}${s.gewinn}`, mx, y + 36, { groesse: 15, fett: true, farbe: s.gewinn > 0 ? FARBE.gut : s.gewinn < 0 ? FARBE.warn : FARBE.text });
      } else if (this.phase === "einsatz" && n > 1) {
        const status = s.einsatz ? "gesetzt ✓" : s.guthaben < MIN_EINSATZ ? "pleite" : "setzt …";
        this.#text(status, mx, y + 36, { groesse: 12, farbe: s.einsatz ? FARBE.gut : FARBE.leise });
      } else if (this.phase === "versicherung" && n > 1 && s.einsatz) {
        this.#text(s.entschieden ? "entschieden ✓" : "überlegt …", mx, y + 36, { groesse: 12, farbe: FARBE.leise });
      }
    });
  }

  #steuerung() {
    const ich = this.#meiner;
    const y = 400;
    const mitte = this.breite / 2;
    const hinweis = (text) => this.#text(text, mitte, y + 26, { groesse: 15, farbe: FARBE.leise });
    if (this.phase === "einsatz") {
      if (ich.einsatz) { hinweis("Warte auf die anderen Einsätze …"); return; }
      if (ich.guthaben < MIN_EINSATZ) {
        if (this.imLan) this.#knopf(mitte - 110, y + 4, 220, 44, `Nachkaufen (+${NACHKAUF})`, () => this.raum?.senden({ typ: "nachkaufen" }).catch(() => {}), { farbe: FARBE.akzent });
        else hinweis("Kein Guthaben mehr");
        return;
      }
      CHIPS.forEach((wert, i) => {
        const x = 46 + i * 46;
        const aus = this.entwurf + wert > ich.guthaben;
        this.ctx.globalAlpha = aus ? 0.35 : 1;
        this.#chip(x, y + 26, wert, 20);
        this.ctx.globalAlpha = 1;
        this.knoepfe.push({ x: x - 20, y: y + 6, b: 40, h: 40, aus, aktion: () => { this.entwurf += wert; } });
      });
      this.#knopf(280, y + 6, 70, 40, "Löschen", () => { this.entwurf = 0; }, { aus: !this.entwurf, groesse: 13 });
      this.#knopf(358, y + 6, 70, 40, "Alles", () => { this.entwurf = ich.guthaben; }, { groesse: 13 });
      this.#knopf(436, y + 6, 140, 40, this.entwurf ? `Setzen: ${this.entwurf}` : "Einsatz wählen", () => this.#setzen(),
        { farbe: FARBE.akzent, aus: this.entwurf < MIN_EINSATZ || this.wartet });
      if (!this.imLan) this.#knopf(588, y + 6, 116, 40, "Auszahlen", () => this.#auszahlen(), { groesse: 13 });
      return;
    }
    if (this.phase === "versicherung") {
      if (!ich.einsatz || ich.entschieden) { hinweis("Warte auf die Entscheidung der anderen …"); return; }
      const preis = Math.floor(ich.einsatz / 2);
      this.#text(`Die Bank zeigt ein Ass. Versichern für ${preis}?`, mitte, y - 6, { groesse: 13, fett: true });
      this.#knopf(mitte - 150, y + 8, 140, 42, "Versichern", () => this.#aktion({ typ: "versicherung", ja: true }),
        { farbe: FARBE.akzent, aus: ich.guthaben < preis || istBlackjack(ich.haende[0]) });
      this.#knopf(mitte + 10, y + 8, 140, 42, "Nein danke", () => this.#aktion({ typ: "versicherung", ja: false }));
      return;
    }
    if (this.phase === "spielen") {
      if (this.amZug?.s !== this.ich) { hinweis(`${this.spieler[this.amZug.s].name} ist dran …`); return; }
      const aktionen = [["Karte (H)", "karte"], ["Stehen (S)", "stehen"], ["Verdoppeln (D)", "verdoppeln"], ["Teilen (T)", "teilen"]];
      aktionen.forEach(([text, art], i) => {
        this.#knopf(mitte - 290 + i * 148, y + 6, 136, 44, text, () => this.#aktion({ typ: art }),
          { farbe: i === 0 ? FARBE.akzent : FARBE.knopf, aus: !this.#darf(art) || this.wartet });
      });
      return;
    }
    if (this.#bankFertig) {
      this.#knopf(mitte - 110, y + 4, 220, 44, "Nächste Runde (Enter)", () => this.#naechste(), { farbe: FARBE.akzent });
    }
  }
}
