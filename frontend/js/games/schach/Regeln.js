// Schachregeln ohne Oberfläche: Zuggenerator, Rochade, en passant, Umwandlung, Matt/Patt und Remisregeln.
// Felder 0–63, Index = y * 8 + x, y = 0 ist die 8. Reihe (oben). Figuren wie in FEN:
// Großbuchstaben = Weiß (Seite 0), Kleinbuchstaben = Schwarz (Seite 1), "." = leer.
// Ein Zug ist [von, nach] oder [von, nach, umwandlung] mit umwandlung = "q" | "r" | "b" | "n".
export const N = 8;
const LEER = ".";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const DATEIEN = "abcdefgh";
export const UMWANDLUNG = ["q", "r", "b", "n"];
/** Deutsche Figurenbuchstaben für die Zugliste: König, Dame, Turm, Läufer, Springer. */
export const DEUTSCH = { k: "K", q: "D", r: "T", b: "L", n: "S", p: "" };

const SPRINGER = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const GERADE = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAGONAL = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALLE = [...GERADE, ...DIAGONAL];

export const seiteVon = (f) => (f === LEER ? -1 : f === f.toUpperCase() ? 0 : 1);
export const typ = (f) => f.toLowerCase();
export const feldName = (i) => `${DATEIEN[i % N]}${N - Math.floor(i / N)}`;
const imBrett = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

export class Stellung {
  constructor(fen = START_FEN) {
    if (fen === null) return; // leere Hülle für #kopie()
    const [brett, seite, rochade, ep, halb, voll] = fen.trim().split(/\s+/);
    this.f = [];
    for (const z of brett.replaceAll("/", "")) {
      if (/\d/.test(z)) this.f.push(...LEER.repeat(Number(z)));
      else this.f.push(z);
    }
    this.amZug = seite === "b" ? 1 : 0;
    this.rochade = rochade === "-" ? "" : rochade; // noch erlaubte Rochaden, z. B. "KQkq"
    this.ep = ep && ep !== "-" ? DATEIEN.indexOf(ep[0]) + (N - Number(ep[1])) * N : -1; // übersprungenes Feld
    this.halbzuege = Number(halb ?? 0); // seit dem letzten Bauernzug oder Schlagen (50-Züge-Regel)
    this.zugNr = Number(voll ?? 1);
    this.wiederholungen = new Map(); // Stellung → wie oft sie vorkam
    this.#merken();
  }

  #kopie() {
    const k = new Stellung(null);
    Object.assign(k, this, { f: this.f.slice() });
    return k;
  }

  /** Greift seite das Feld an? */
  angegriffen(feld, seite) {
    const x = feld % N;
    const y = Math.floor(feld / N);
    const steht = (fx, fy, typen) => {
      if (!imBrett(fx, fy)) return false;
      const f = this.f[fy * N + fx];
      return seiteVon(f) === seite && typen.includes(typ(f));
    };
    const py = seite === 0 ? y + 1 : y - 1; // weiße Bauern schlagen nach oben
    if (steht(x - 1, py, "p") || steht(x + 1, py, "p")) return true;
    if (SPRINGER.some(([dx, dy]) => steht(x + dx, y + dy, "n"))) return true;
    if (ALLE.some(([dx, dy]) => steht(x + dx, y + dy, "k"))) return true;
    const strahl = (richtungen, typen) => richtungen.some(([dx, dy]) => {
      let sx = x + dx;
      let sy = y + dy;
      while (imBrett(sx, sy) && this.f[sy * N + sx] === LEER) { sx += dx; sy += dy; }
      return steht(sx, sy, typen);
    });
    return strahl(GERADE, "rq") || strahl(DIAGONAL, "bq");
  }

  imSchach(seite = this.amZug) {
    return this.angegriffen(this.f.indexOf(seite === 0 ? "K" : "k"), 1 - seite);
  }

  /** Züge ohne Rücksicht darauf, ob der eigene König danach im Schach steht. */
  #pseudoZuege(seite) {
    const zuege = [];
    const gegner = 1 - seite;
    for (let i = 0; i < N * N; i++) {
      const f = this.f[i];
      if (seiteVon(f) !== seite) continue;
      const x = i % N;
      const y = Math.floor(i / N);
      const schritt = (richtungen, weit) => {
        for (const [dx, dy] of richtungen) {
          let sx = x + dx;
          let sy = y + dy;
          while (imBrett(sx, sy)) {
            const ziel = this.f[sy * N + sx];
            if (seiteVon(ziel) === seite) break;
            zuege.push([i, sy * N + sx]);
            if (ziel !== LEER || !weit) break;
            sx += dx; sy += dy;
          }
        }
      };
      switch (typ(f)) {
        case "p": {
          const r = seite === 0 ? -1 : 1;
          const letzte = seite === 0 ? 0 : N - 1;
          const dazu = (nach) => {
            if (Math.floor(nach / N) === letzte) for (const u of UMWANDLUNG) zuege.push([i, nach, u]);
            else zuege.push([i, nach]);
          };
          const vor = i + r * N;
          if (this.f[vor] === LEER) {
            dazu(vor);
            const grundreihe = seite === 0 ? 6 : 1;
            if (y === grundreihe && this.f[vor + r * N] === LEER) zuege.push([i, vor + r * N]);
          }
          for (const dx of [-1, 1]) {
            if (!imBrett(x + dx, y + r)) continue;
            const nach = (y + r) * N + x + dx;
            if (seiteVon(this.f[nach]) === gegner || nach === this.ep) dazu(nach);
          }
          break;
        }
        case "n": schritt(SPRINGER, false); break;
        case "b": schritt(DIAGONAL, true); break;
        case "r": schritt(GERADE, true); break;
        case "q": schritt(ALLE, true); break;
        case "k": {
          schritt(ALLE, false);
          const reihe = seite === 0 ? 56 : 0;
          if (i !== reihe + 4 || this.angegriffen(i, gegner)) break;
          const [kurz, lang] = seite === 0 ? ["K", "Q"] : ["k", "q"];
          const turm = seite === 0 ? "R" : "r";
          const frei = (...felder) => felder.every((d) => this.f[reihe + d] === LEER);
          if (this.rochade.includes(kurz) && this.f[reihe + 7] === turm && frei(5, 6)
            && !this.angegriffen(reihe + 5, gegner)) zuege.push([i, reihe + 6]);
          if (this.rochade.includes(lang) && this.f[reihe] === turm && frei(1, 2, 3)
            && !this.angegriffen(reihe + 3, gegner)) zuege.push([i, reihe + 2]);
          break;
        }
        default:
      }
    }
    return zuege;
  }

  /** Alle erlaubten Züge der Seite am Zug. */
  zuege() {
    const seite = this.amZug;
    return this.#pseudoZuege(seite).filter((z) => {
      const danach = this.#kopie();
      danach.#setzen(z);
      return !danach.imSchach(seite);
    });
  }

  /** Prüft auch Daten aus dem Netz: nur echte, erlaubte Züge der Seite am Zug. */
  erlaubt(zug) {
    if (!Array.isArray(zug) || zug.length < 2 || zug.length > 3) return false;
    const [von, nach, umw = null] = zug;
    return this.zuege().some(([v, n, u = null]) => v === von && n === nach && u === umw);
  }

  /** Setzt den Zug auf dem Brett um, ohne Notation und Wiederholungszählung. */
  #setzen([von, nach, umw]) {
    const f = this.f[von];
    const t = typ(f);
    const seite = seiteVon(f);
    let geschlagen = this.f[nach];
    if (t === "p" && nach === this.ep) { // en passant: der geschlagene Bauer steht hinter dem Zielfeld
      const hinter = nach + (seite === 0 ? N : -N);
      geschlagen = this.f[hinter];
      this.f[hinter] = LEER;
    }
    this.f[nach] = umw ? (seite === 0 ? umw.toUpperCase() : umw) : f;
    this.f[von] = LEER;
    if (t === "k" && Math.abs(nach - von) === 2) { // Rochade: Turm springt über den König
      const kurz = nach > von;
      this.f[kurz ? von + 1 : von - 1] = this.f[kurz ? von + 3 : von - 4];
      this.f[kurz ? von + 3 : von - 4] = LEER;
    }
    const streiche = (z) => { this.rochade = this.rochade.replace(z, ""); };
    if (t === "k") for (const z of seite === 0 ? "KQ" : "kq") streiche(z);
    for (const [feld, z] of [[63, "K"], [56, "Q"], [7, "k"], [0, "q"]]) {
      if (von === feld || nach === feld) streiche(z); // Turm gezogen oder geschlagen
    }
    this.ep = t === "p" && Math.abs(nach - von) === 2 * N ? (von + nach) / 2 : -1;
    this.halbzuege = t === "p" || geschlagen !== LEER ? 0 : this.halbzuege + 1;
    if (seite === 1) this.zugNr++;
    this.amZug = 1 - seite;
  }

  /** Führt einen (erlaubten) Zug aus und gibt ihn in deutscher Kurznotation zurück, z. B. "Sxf3+". */
  ziehe(zug) {
    let text = this.#notation(zug);
    this.#setzen(zug);
    this.#merken();
    if (this.imSchach()) text += this.zuege().length ? "+" : "#";
    return text;
  }

  #notation([von, nach, umw]) {
    const f = this.f[von];
    const t = typ(f);
    if (t === "k" && Math.abs(nach - von) === 2) return nach > von ? "0-0" : "0-0-0";
    const schlag = this.f[nach] !== LEER || (t === "p" && nach === this.ep);
    let text = DEUTSCH[t];
    if (t === "p") {
      if (schlag) text = DATEIEN[von % N];
    } else {
      // Mehrdeutig, wenn eine gleiche Figur dasselbe Ziel hat: Linie, sonst Reihe, sonst beides
      const andere = this.zuege().filter(([v, n]) => n === nach && v !== von && this.f[v] === f);
      if (andere.length) {
        if (!andere.some(([v]) => v % N === von % N)) text += DATEIEN[von % N];
        else if (!andere.some(([v]) => Math.floor(v / N) === Math.floor(von / N))) text += N - Math.floor(von / N);
        else text += feldName(von);
      }
    }
    return `${text}${schlag ? "x" : ""}${feldName(nach)}${umw ? `=${DEUTSCH[umw]}` : ""}`;
  }

  /** Schlüssel für die Stellungswiederholung (en passant zählt nur, wenn es wirklich möglich ist). */
  #schluessel() {
    const ep = this.ep >= 0 && this.zuege().some(([v, n]) => n === this.ep && typ(this.f[v]) === "p") ? this.ep : "-";
    return `${this.f.join("")} ${this.amZug} ${this.rochade} ${ep}`;
  }

  #merken() {
    const s = this.#schluessel();
    this.wiederholungen.set(s, (this.wiederholungen.get(s) ?? 0) + 1);
  }

  #figuren(seite) {
    const liste = [];
    this.f.forEach((f, i) => { if (seiteVon(f) === seite && typ(f) !== "k") liste.push({ t: typ(f), feld: i }); });
    return liste;
  }

  /** Kein Matt mehr möglich: nur Könige, eine einzelne Leichtfigur, oder nur Läufer auf gleichfarbigen Feldern. */
  zuWenigMaterial() {
    const figuren = [...this.#figuren(0), ...this.#figuren(1)];
    if (figuren.some(({ t }) => "pqr".includes(t))) return false;
    if (figuren.length <= 1) return true;
    const farben = new Set(figuren.map(({ feld }) => (feld % N + Math.floor(feld / N)) % 2));
    return figuren.every(({ t }) => t === "b") && farben.size === 1;
  }

  /** Für die Zeitüberschreitung: Hat seite überhaupt genug Material, um mattzusetzen? */
  kannMattsetzen(seite) {
    const eigene = this.#figuren(seite);
    if (!eigene.length) return false;
    return !(eigene.length === 1 && "bn".includes(eigene[0].t) && !this.#figuren(1 - seite).length);
  }

  /** undefined = läuft weiter, sonst { sieger: 0 | 1 | null, grund }. */
  ergebnis() {
    if (!this.zuege().length) {
      return this.imSchach() ? { sieger: 1 - this.amZug, grund: "Schachmatt" } : { sieger: null, grund: "Patt" };
    }
    if (this.zuWenigMaterial()) return { sieger: null, grund: "zu wenig Material" };
    if (this.halbzuege >= 100) return { sieger: null, grund: "50-Züge-Regel" };
    if (this.wiederholungen.get(this.#schluessel()) >= 3) return { sieger: null, grund: "dreifache Wiederholung" };
    return undefined;
  }
}
