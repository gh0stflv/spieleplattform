import { Spiel, Zustand } from "../../core/Spiel.js";

const SPALTEN = 7;
const ZEILEN = 6;
const ZELLE = 480 / SPALTEN;
const OBEN = 480 - ZEILEN * ZELLE; // Platz für den Stein über dem Brett
const LEER = 0;
const ROT = 1; // Spieler 1 (beginnt)
const GELB = 2; // Spieler 2 bzw. Computer
const FARBEN = { [ROT]: "#ff5b6e", [GELB]: "#ffd84d" };
const FALL_TEMPO = 2400; // px pro Sekunde²
const BOT_DENKPAUSE = 0.45;

// Schwierigkeit → Suchtiefe, Fehlerquote und Grundpunkte für einen Sieg
const STUFEN = {
  leicht: { tiefe: 2, zufall: 0.35, punkte: 100 },
  mittel: { tiefe: 4, zufall: 0.1, punkte: 200 },
  schwer: { tiefe: 7, zufall: 0, punkte: 300 },
};

/** Reines Spielbrett ohne Darstellung: wird auch von der KI für die Suche benutzt. */
class Brett {
  constructor() {
    this.felder = Array.from({ length: SPALTEN }, () => []); // je Spalte von unten nach oben
    this.zuege = 0;
  }

  passt(spalte) { return this.felder[spalte].length < ZEILEN; }
  freieSpalten() { return [3, 2, 4, 1, 5, 0, 6].filter((s) => this.passt(s)); } // Mitte zuerst
  voll() { return this.zuege === SPALTEN * ZEILEN; }
  feld(s, z) { return this.felder[s]?.[z] ?? LEER; }

  setze(spalte, spieler) {
    this.felder[spalte].push(spieler);
    this.zuege++;
    return this.felder[spalte].length - 1;
  }

  nimmZurueck(spalte) {
    this.felder[spalte].pop();
    this.zuege--;
  }

  /** Gibt die vier Gewinnfelder zurück, falls der letzte Stein in spalte gewonnen hat. */
  gewinnReihe(spalte) {
    const z = this.felder[spalte].length - 1;
    const spieler = this.feld(spalte, z);
    for (const [ds, dz] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const reihe = [[spalte, z]];
      for (const r of [1, -1]) {
        let s = spalte + ds * r;
        let y = z + dz * r;
        while (this.feld(s, y) === spieler) { reihe.push([s, y]); s += ds * r; y += dz * r; }
      }
      if (reihe.length >= 4) return reihe;
    }
    return null;
  }

  /** Heuristik für die KI: zählt offene Zweier/Dreier in allen Viererfenstern. */
  bewerte(spieler) {
    const gegner = spieler === ROT ? GELB : ROT;
    let wert = 0;
    for (let z = 0; z < ZEILEN; z++) if (this.feld(3, z) === spieler) wert += 3;
    for (let s = 0; s < SPALTEN; s++) {
      for (let z = 0; z < ZEILEN; z++) {
        for (const [ds, dz] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
          const es = s + ds * 3;
          const ez = z + dz * 3;
          if (es >= SPALTEN || ez < 0 || ez >= ZEILEN) continue;
          let meine = 0;
          let seine = 0;
          for (let i = 0; i < 4; i++) {
            const f = this.feld(s + ds * i, z + dz * i);
            if (f === spieler) meine++;
            else if (f === gegner) seine++;
          }
          if (seine === 0) wert += [0, 1, 5, 50][meine] ?? 0;
          else if (meine === 0) wert -= [0, 1, 6, 80][seine] ?? 0;
        }
      }
    }
    return wert;
  }
}

/** Minimax mit Alpha-Beta-Schnitt. */
function besterZug(brett, spieler, tiefe) {
  const gegner = spieler === ROT ? GELB : ROT;
  const suche = (t, alpha, beta, amZug) => {
    let bester = amZug === spieler ? -Infinity : Infinity;
    for (const s of brett.freieSpalten()) {
      brett.setze(s, amZug);
      let wert;
      if (brett.gewinnReihe(s)) wert = (amZug === spieler ? 1 : -1) * (100000 + t);
      else if (brett.voll() || t === 0) wert = brett.bewerte(spieler);
      else wert = suche(t - 1, alpha, beta, amZug === ROT ? GELB : ROT);
      brett.nimmZurueck(s);
      if (amZug === spieler) { bester = Math.max(bester, wert); alpha = Math.max(alpha, wert); }
      else { bester = Math.min(bester, wert); beta = Math.min(beta, wert); }
      if (alpha >= beta) break;
    }
    return bester;
  };
  let zug = brett.freieSpalten()[0];
  let bestWert = -Infinity;
  for (const s of brett.freieSpalten()) {
    brett.setze(s, spieler);
    const wert = brett.gewinnReihe(s) ? Infinity : suche(tiefe - 1, -Infinity, Infinity, gegner);
    brett.nimmZurueck(s);
    if (wert > bestWert) { bestWert = wert; zug = s; }
  }
  return zug;
}

export class VierGewinnt extends Spiel {
  static modi = [
    { id: "mittel", name: "Gegen Computer: Mittel" },
    { id: "leicht", name: "Gegen Computer: Leicht" },
    { id: "schwer", name: "Gegen Computer: Schwer" },
    { id: "zwei", name: "2 Spieler an einem Gerät" },
    { id: "lan", name: "Im Netzwerk (LAN) spielen", lan: true },
  ];

  constructor(canvas, rueckrufe) {
    super("Vier gewinnt", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  get gegenComputer() { return STUFEN[this.modus] !== undefined; }
  get imNetz() { return this.modus === "lan" && this.raum; }
  /** Im LAN spielt Raum-Spieler 0 Rot, Spieler 1 Gelb. */
  get meineFarbe() { return this.raum?.ich === 1 ? GELB : ROT; }
  get gewertet() { return this.gegenComputer; }

  get ergebnisText() {
    if (!this.sieger) return "Unentschieden!";
    if (this.modus === "lan") return this.sieger === this.meineFarbe ? "Du hast gewonnen!" : `${this.#name(this.sieger)} gewinnt!`;
    if (!this.gegenComputer) return `${this.sieger === ROT ? "Rot" : "Gelb"} gewinnt!`;
    return this.sieger === ROT ? "Du hast gewonnen!" : "Der Computer gewinnt.";
  }

  zuruecksetzen() {
    this.brett = new Brett();
    this.amZug = ROT;
    this.auswahl = 3;
    this.fallend = null; // { spalte, zeile, y, v, spieler }
    this.sieger = null;
    this.gewinnReihe = null;
    this.botWartet = 0;
    this.endeWartet = 0;
    this.wartetAufNetz = false;
  }

  #name(farbe) {
    if (this.modus === "lan") return this.raum?.spieler[farbe === ROT ? 0 : 1] ?? (farbe === ROT ? "Rot" : "Gelb");
    if (this.gegenComputer) return farbe === ROT ? "Du" : "Computer";
    return farbe === ROT ? "Rot" : "Gelb";
  }

  #zeigeAmZug() {
    this.rueckrufe.beiPunkten?.(this.#name(this.amZug), this.amZug === ROT ? "🔴 Am Zug" : "🟡 Am Zug");
  }

  starten(modus) {
    super.starten(modus);
    this.#zeigeAmZug();
  }

  #menschAmZug() {
    if (this.zustand !== Zustand.LAEUFT || this.fallend || this.gewinnReihe) return false;
    if (this.modus === "lan") return this.imNetz && this.amZug === this.meineFarbe && !this.wartetAufNetz;
    return !(this.gegenComputer && this.amZug === GELB);
  }

  /** Eigener Zug: offline sofort, im LAN erst wenn er vom Server zurückkommt. */
  #zieheSelbst(spalte) {
    if (!this.brett.passt(spalte)) return;
    if (this.modus !== "lan") { this.#werfe(spalte); return; }
    this.wartetAufNetz = true;
    this.raum.senden({ typ: "zug", spalte }).catch(() => { this.wartetAufNetz = false; });
  }

  empfangeEreignis({ von, daten }) {
    if (daten?.typ !== "zug" || this.zustand !== Zustand.LAEUFT) return;
    const farbe = von === 0 ? ROT : GELB;
    if (farbe !== this.amZug || this.fallend || !Number.isInteger(daten.spalte)) return;
    if (daten.spalte < 0 || daten.spalte >= SPALTEN) return;
    if (farbe === this.meineFarbe) this.wartetAufNetz = false;
    this.auswahl = daten.spalte;
    this.#werfe(daten.spalte);
  }

  #werfe(spalte) {
    if (!this.brett.passt(spalte)) return;
    const zeile = this.brett.setze(spalte, this.amZug);
    this.fallend = { spalte, zeile, y: OBEN / 2, v: 0, spieler: this.amZug };
  }

  #landen() {
    const { spalte, spieler } = this.fallend;
    this.fallend = null;
    const reihe = this.brett.gewinnReihe(spalte);
    if (reihe || this.brett.voll()) {
      this.sieger = reihe ? spieler : null;
      this.gewinnReihe = reihe ?? [];
      this.endeWartet = 1.2; // Gewinnreihe kurz zeigen
      this.#punkteBerechnen();
      return;
    }
    this.amZug = spieler === ROT ? GELB : ROT;
    if (this.gegenComputer && this.amZug === GELB) this.botWartet = BOT_DENKPAUSE;
    this.#zeigeAmZug();
  }

  #punkteBerechnen() {
    if (!this.gegenComputer) return;
    const stufe = STUFEN[this.modus];
    const eigeneZuege = Math.ceil(this.brett.zuege / 2);
    if (this.sieger === ROT) this.punkte = stufe.punkte + Math.max(0, 22 - eigeneZuege) * 5;
    else if (!this.sieger) this.punkte = stufe.punkte / 4;
    else this.punkte = 0;
  }

  #botZug() {
    const stufe = STUFEN[this.modus];
    const frei = this.brett.freieSpalten();
    const spalte = Math.random() < stufe.zufall
      ? frei[Math.floor(Math.random() * frei.length)]
      : besterZug(this.brett, GELB, stufe.tiefe);
    this.auswahl = spalte;
    this.#werfe(spalte);
  }

  verarbeiteEingabe(taste) {
    if (!this.#menschAmZug()) return;
    if (taste === "ArrowLeft" || taste === "a") this.auswahl = Math.max(0, this.auswahl - 1);
    else if (taste === "ArrowRight" || taste === "d") this.auswahl = Math.min(SPALTEN - 1, this.auswahl + 1);
    else if (taste === "Enter" || taste === "ArrowDown" || taste === "s") this.#zieheSelbst(this.auswahl);
    else if (/^[1-7]$/.test(taste)) { this.auswahl = Number(taste) - 1; this.#zieheSelbst(this.auswahl); }
  }

  verarbeiteKlick(x) {
    if (!this.#menschAmZug()) return;
    this.auswahl = Math.min(SPALTEN - 1, Math.max(0, Math.floor(x / ZELLE)));
    this.#zieheSelbst(this.auswahl);
  }

  verarbeiteZeiger(x) {
    if (this.#menschAmZug()) this.auswahl = Math.min(SPALTEN - 1, Math.max(0, Math.floor(x / ZELLE)));
  }

  update(dt) {
    if (this.endeWartet > 0) {
      this.endeWartet -= dt;
      if (this.endeWartet <= 0) this.beenden();
      return;
    }
    if (this.fallend) {
      const f = this.fallend;
      const ziel = OBEN + (ZEILEN - 1 - f.zeile) * ZELLE + ZELLE / 2;
      f.v += FALL_TEMPO * dt;
      f.y += f.v * dt;
      if (f.y >= ziel) this.#landen();
      return;
    }
    if (this.botWartet > 0) {
      this.botWartet -= dt;
      if (this.botWartet <= 0) this.#botZug();
    }
  }

  #stein(ctx, x, y, spieler, hervorheben = false) {
    const r = ZELLE * 0.4;
    ctx.fillStyle = FARBEN[spieler];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.18)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    if (hervorheben) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  zeichnen() {
    const { ctx } = this;
    ctx.fillStyle = "#14171f";
    ctx.fillRect(0, 0, this.breite, this.hoehe);

    // Vorschau-Stein über der gewählten Spalte
    if (this.#menschAmZug()) {
      ctx.globalAlpha = 0.85;
      this.#stein(ctx, this.auswahl * ZELLE + ZELLE / 2, OBEN / 2, this.amZug);
      ctx.globalAlpha = 1;
    }
    if (this.fallend) {
      this.#stein(ctx, this.fallend.spalte * ZELLE + ZELLE / 2, this.fallend.y, this.fallend.spieler);
    }

    // Brett mit Löchern (evenodd), liegende Steine dahinter
    const gewinn = new Set((this.gewinnReihe ?? []).map(([s, z]) => `${s},${z}`));
    for (let s = 0; s < SPALTEN; s++) {
      for (let z = 0; z < ZEILEN; z++) {
        const f = this.brett.feld(s, z);
        const fallendHier = this.fallend && this.fallend.spalte === s && this.fallend.zeile === z;
        if (f !== LEER && !fallendHier) {
          this.#stein(ctx, s * ZELLE + ZELLE / 2, OBEN + (ZEILEN - 1 - z) * ZELLE + ZELLE / 2, f, gewinn.has(`${s},${z}`));
        }
      }
    }
    ctx.fillStyle = "#3446d6";
    ctx.beginPath();
    ctx.roundRect(0, OBEN, this.breite, ZEILEN * ZELLE, 12);
    for (let s = 0; s < SPALTEN; s++) {
      for (let z = 0; z < ZEILEN; z++) {
        const x = s * ZELLE + ZELLE / 2;
        const y = OBEN + z * ZELLE + ZELLE / 2;
        ctx.moveTo(x + ZELLE * 0.4, y);
        ctx.arc(x, y, ZELLE * 0.4, 0, Math.PI * 2, true);
      }
    }
    ctx.fill("evenodd");
  }
}

export { Brett, besterZug, ROT, GELB };
