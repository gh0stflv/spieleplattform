import { Spiel, Zustand } from "./Spiel.js";

const BOT_DENKPAUSE = 0.45;
const ENDE_PAUSE = 1.2;

/**
 * Basis für rundenbasierte Spiele für 2 Personen: gegen den Computer, zu zweit an einem Gerät oder im LAN.
 * Unterklassen implementieren zuruecksetzen(), zugAnwenden(), ergebnis(), botZug() und zeichnen().
 * Spieler sind 0 (beginnt) und 1. Gegen den Computer ist der Mensch 0.
 */
export class RundenSpiel extends Spiel {
  static modi = [
    { id: "mittel", name: "Gegen Computer: Mittel" },
    { id: "leicht", name: "Gegen Computer: Leicht" },
    { id: "schwer", name: "Gegen Computer: Schwer" },
    { id: "zwei", name: "2 Spieler an einem Gerät" },
    { id: "lan", name: "Im Netzwerk (LAN) spielen", lan: true },
  ];

  /** Grundpunkte für einen Sieg je Stufe. */
  static siegPunkte = { leicht: 100, mittel: 200, schwer: 300 };

  /** Namen der Seiten, z. B. ["Rot", "Gelb"]. */
  static seiten = ["Spieler 1", "Spieler 2"];
  static symbole = ["", ""];

  get stufe() { return this.constructor.siegPunkte[this.modus] !== undefined ? this.modus : null; }
  get gegenComputer() { return this.stufe !== null; }
  get imLan() { return this.modus === "lan"; }
  get gewertet() { return this.gegenComputer; }

  /** Die Seite, die auf diesem Gerät spielt (bei 2 Spielern an einem Gerät: wer gerade dran ist). */
  get ich() {
    if (this.imLan) return this.raum?.ich ?? 0;
    if (this.gegenComputer) return 0;
    return this.amZug;
  }

  starten(modus) {
    this.amZug = 0;
    this.sieger = undefined; // undefined = läuft, null = unentschieden, 0/1 = Sieger
    this.botWartet = 0;
    this.endeWartet = 0;
    this.wartetAufNetz = false;
    this.zuegeGesamt = 0;
    super.starten(modus);
    this.#zeigeStatus();
  }

  spielerName(seite) {
    if (this.imLan) return this.raum?.spieler[seite] ?? this.constructor.seiten[seite];
    if (this.gegenComputer) return seite === 0 ? "Du" : "Computer";
    return this.constructor.seiten[seite];
  }

  get ergebnisText() {
    if (this.sieger === null) return "Unentschieden!";
    if (this.gegenComputer) return this.sieger === 0 ? "Du hast gewonnen!" : "Der Computer gewinnt.";
    if (this.imLan && this.sieger === this.raum?.ich) return "Du hast gewonnen!";
    return `${this.spielerName(this.sieger)} gewinnt!`;
  }

  #zeigeStatus(text) {
    const symbol = this.constructor.symbole[this.amZug];
    this.rueckrufe.beiPunkten?.(text ?? this.spielerName(this.amZug), `${symbol ? `${symbol} ` : ""}Am Zug`);
  }

  /** Darf auf diesem Gerät gerade jemand ziehen? */
  get menschAmZug() {
    if (this.zustand !== Zustand.LAEUFT || this.sieger !== undefined || this.beschaeftigt()) return false;
    if (this.imLan) return Boolean(this.raum) && this.amZug === this.raum.ich && !this.wartetAufNetz;
    if (this.gegenComputer) return this.amZug === 0;
    return true;
  }

  /** Eigener Zug über die Oberfläche. Im LAN wird er erst angewendet, wenn er vom Server zurückkommt. */
  ziehe(zug) {
    if (!this.menschAmZug || !this.zugErlaubt(zug, this.amZug)) return false;
    if (this.imLan) {
      this.wartetAufNetz = true;
      this.raum.senden({ typ: "zug", zug }).catch(() => { this.wartetAufNetz = false; });
    } else {
      this.#fuehreAus(zug);
    }
    return true;
  }

  empfangeEreignis({ von, daten }) {
    if (daten?.typ !== "zug" || this.zustand !== Zustand.LAEUFT || this.sieger !== undefined) return;
    if (von !== this.amZug || !this.zugErlaubt(daten.zug, von)) return;
    if (von === this.raum?.ich) this.wartetAufNetz = false;
    this.#fuehreAus(daten.zug);
  }

  #fuehreAus(zug) {
    const seite = this.amZug;
    const nochmal = this.zugAnwenden(zug, seite) === "nochmal"; // z. B. Mehrfachsprung bei Dame
    this.zuegeGesamt++;
    const ergebnis = this.ergebnis();
    if (ergebnis !== undefined) {
      this.sieger = ergebnis;
      this.endeWartet = ENDE_PAUSE;
      this.#punkteBerechnen();
      this.#zeigeStatus(ergebnis === null ? "Unentschieden" : `${this.spielerName(ergebnis)} gewinnt`);
      return;
    }
    if (!nochmal) this.amZug = 1 - seite;
    if (this.gegenComputer && this.amZug === 1) this.botWartet = BOT_DENKPAUSE;
    this.#zeigeStatus();
  }

  #punkteBerechnen() {
    if (!this.gegenComputer) return;
    const basis = this.constructor.siegPunkte[this.stufe];
    if (this.sieger === 0) this.punkte = basis + this.siegBonus();
    else if (this.sieger === null) this.punkte = Math.round(basis / 4);
    else this.punkte = 0;
  }

  update(dt) {
    this.animieren(dt);
    if (this.beschaeftigt()) return;
    if (this.endeWartet > 0) {
      this.endeWartet -= dt;
      if (this.endeWartet <= 0) this.beenden();
      return;
    }
    if (this.botWartet > 0) {
      this.botWartet -= dt;
      if (this.botWartet <= 0) {
        const zug = this.botZug(this.stufe);
        if (zug !== undefined && this.zugErlaubt(zug, 1)) this.#fuehreAus(zug);
      }
    }
  }

  // --- von Unterklassen ---
  /** true, wenn zug für seite gerade erlaubt ist (auch gegen manipulierte LAN-Daten). */
  zugErlaubt(_zug, _seite) { throw new Error("zugErlaubt() fehlt"); }
  /** Wendet den Zug an. Rückgabe "nochmal", wenn dieselbe Seite direkt weiterzieht. */
  zugAnwenden(_zug, _seite) { throw new Error("zugAnwenden() fehlt"); }
  /** undefined = läuft weiter, null = unentschieden, 0/1 = Sieger. */
  ergebnis() { throw new Error("ergebnis() fehlt"); }
  /** Zug des Computers (Seite 1) für die Stufe "leicht" | "mittel" | "schwer". */
  botZug(_stufe) { throw new Error("botZug() fehlt"); }
  /** Zusatzpunkte bei einem Sieg, z. B. für schnelle Siege. */
  siegBonus() { return 0; }
  /** Animationen fortschreiben. */
  animieren(_dt) {}
  /** true, solange eine Animation läuft und niemand ziehen darf. */
  beschaeftigt() { return false; }
}
