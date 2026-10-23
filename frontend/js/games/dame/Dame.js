import { RundenSpiel } from "../../core/RundenSpiel.js";

// Regeln wie im englischen/amerikanischen Dame (Checkers): 8×8, Steine ziehen und schlagen nur
// vorwärts, Damen einen Schritt in alle Richtungen, Schlagzwang, Mehrfachsprung.
const N = 8;
const FELD = 480 / N;
const LEER = 0;
// Steinwerte: 1/2 = Stein von Seite 0/1, 3/4 = Dame von Seite 0/1
const seiteVon = (w) => (w === 1 || w === 3 ? 0 : 1);
const istDame = (w) => w >= 3;
const REMIS_NACH = 80; // Halbzüge ohne Schlagen
const FARBEN = [{ stein: "#ff5b6e", rand: "#b8323f" }, { stein: "#f4f1e8", rand: "#a9a59a" }];

const STUFEN = {
  leicht: { tiefe: 2, zufall: 0.35 },
  mittel: { tiefe: 4, zufall: 0.05 },
  schwer: { tiefe: 7, zufall: 0 },
};

class Brett {
  constructor() {
    this.f = new Array(N * N).fill(LEER);
    for (let i = 0; i < N * N; i++) {
      const x = i % N;
      const y = Math.floor(i / N);
      if ((x + y) % 2 === 1) {
        if (y < 3) this.f[i] = 2; // Seite 1 oben
        else if (y > 4) this.f[i] = 1; // Seite 0 unten
      }
    }
    this.zwang = -1; // Stein, der nach einem Sprung weiterspringen muss
    this.ohneSchlagen = 0;
  }

  #richtungen(w) {
    if (istDame(w)) return [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    return seiteVon(w) === 0 ? [[-1, -1], [1, -1]] : [[-1, 1], [1, 1]];
  }

  #spruenge(i) {
    const w = this.f[i];
    const x = i % N;
    const y = Math.floor(i / N);
    const liste = [];
    for (const [dx, dy] of this.#richtungen(w)) {
      const mx = x + dx; const my = y + dy;
      const zx = x + 2 * dx; const zy = y + 2 * dy;
      if (zx < 0 || zy < 0 || zx >= N || zy >= N) continue;
      const mitte = this.f[my * N + mx];
      if (mitte !== LEER && seiteVon(mitte) !== seiteVon(w) && this.f[zy * N + zx] === LEER) {
        liste.push([i, zy * N + zx]);
      }
    }
    return liste;
  }

  #schritte(i) {
    const w = this.f[i];
    const x = i % N;
    const y = Math.floor(i / N);
    const liste = [];
    for (const [dx, dy] of this.#richtungen(w)) {
      const zx = x + dx; const zy = y + dy;
      if (zx >= 0 && zy >= 0 && zx < N && zy < N && this.f[zy * N + zx] === LEER) liste.push([i, zy * N + zx]);
    }
    return liste;
  }

  /** Alle erlaubten Züge [von, nach] für seite (Schlagzwang beachtet). */
  zuege(seite) {
    if (this.zwang >= 0) return this.#spruenge(this.zwang);
    let spruenge = [];
    const schritte = [];
    for (let i = 0; i < N * N; i++) {
      if (this.f[i] === LEER || seiteVon(this.f[i]) !== seite) continue;
      spruenge = spruenge.concat(this.#spruenge(i));
      if (!spruenge.length) schritte.push(...this.#schritte(i));
    }
    return spruenge.length ? spruenge : schritte;
  }

  /** Führt aus; Rückgabe: { nochmal, rueck } (rueck zum Zurücknehmen in der KI). */
  ziehe([von, nach]) {
    const w = this.f[von];
    const rueck = { von, nach, w, zwang: this.zwang, ohne: this.ohneSchlagen, geschlagen: -1, gw: LEER };
    this.f[nach] = w;
    this.f[von] = LEER;
    const sprung = Math.abs(nach - von) > N + 1;
    if (sprung) {
      const mitte = (von + nach) / 2;
      rueck.geschlagen = mitte;
      rueck.gw = this.f[mitte];
      this.f[mitte] = LEER;
      this.ohneSchlagen = 0;
    } else {
      this.ohneSchlagen++;
    }
    const zeile = Math.floor(nach / N);
    const befoerdert = !istDame(w) && ((seiteVon(w) === 0 && zeile === 0) || (seiteVon(w) === 1 && zeile === N - 1));
    if (befoerdert) this.f[nach] = w + 2;
    this.zwang = -1;
    const nochmal = sprung && !befoerdert && this.#spruenge(nach).length > 0;
    if (nochmal) this.zwang = nach;
    return { nochmal, rueck };
  }

  zurueck({ von, nach, w, zwang, ohne, geschlagen, gw }) {
    this.f[von] = w;
    this.f[nach] = LEER;
    if (geschlagen >= 0) this.f[geschlagen] = gw;
    this.zwang = zwang;
    this.ohneSchlagen = ohne;
  }

  /** Wertung aus Sicht von seite: Material, Damen, Vorrücken. */
  bewerte(seite) {
    let wert = 0;
    for (let i = 0; i < N * N; i++) {
      const w = this.f[i];
      if (w === LEER) continue;
      const y = Math.floor(i / N);
      const vorruecken = seiteVon(w) === 0 ? 7 - y : y;
      const v = istDame(w) ? 175 : 100 + vorruecken * 3;
      wert += seiteVon(w) === seite ? v : -v;
    }
    return wert;
  }
}

function besterZug(brett, seite, tiefe) {
  const suche = (t, alpha, beta, amZug) => {
    const zuege = brett.zuege(amZug);
    if (!zuege.length) return amZug === seite ? -10000 - t : 10000 + t;
    if (brett.ohneSchlagen >= REMIS_NACH) return 0;
    if (t <= 0 && brett.zwang < 0) return brett.bewerte(seite);
    let bester = amZug === seite ? -Infinity : Infinity;
    for (const z of zuege) {
      const { nochmal, rueck } = brett.ziehe(z);
      const w = suche(nochmal ? t : t - 1, alpha, beta, nochmal ? amZug : 1 - amZug);
      brett.zurueck(rueck);
      if (amZug === seite) { bester = Math.max(bester, w); alpha = Math.max(alpha, w); }
      else { bester = Math.min(bester, w); beta = Math.min(beta, w); }
      if (alpha >= beta) break;
    }
    return bester;
  };
  let bestZug = null;
  let bestWert = -Infinity;
  for (const z of brett.zuege(seite)) {
    const { nochmal, rueck } = brett.ziehe(z);
    const w = suche(nochmal ? tiefe : tiefe - 1, -Infinity, Infinity, nochmal ? seite : 1 - seite) + Math.random();
    brett.zurueck(rueck);
    if (w > bestWert) { bestWert = w; bestZug = z; }
  }
  return bestZug;
}

export class Dame extends RundenSpiel {
  static seiten = ["Rot", "Weiß"];
  static symbole = ["🔴", "⚪"];

  constructor(canvas, rueckrufe) {
    super("Dame", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  zuruecksetzen() {
    this.brett = new Brett();
    this.auswahl = -1;
    this.letzter = null;
    this.bewegung = null; // { w, von, nach, t }
  }

  /** Seite 1 sieht im LAN das Brett gedreht, damit die eigenen Steine unten stehen. */
  get #gedreht() { return this.imLan && this.raum?.ich === 1; }
  #anzeige(i) { return this.#gedreht ? N * N - 1 - i : i; }

  zugErlaubt(zug, seite) {
    if (!Array.isArray(zug) || zug.length !== 2) return false;
    return this.brett.zuege(seite).some(([v, n]) => v === zug[0] && n === zug[1]);
  }

  zugAnwenden(zug) {
    const w = this.brett.f[zug[0]];
    const { nochmal } = this.brett.ziehe(zug);
    this.letzter = zug;
    this.bewegung = { w, von: zug[0], nach: zug[1], t: 0 };
    this.auswahl = nochmal ? zug[1] : -1;
    return nochmal ? "nochmal" : undefined;
  }

  ergebnis() {
    const naechste = this.brett.zwang >= 0 ? this.amZug : 1 - this.amZug;
    if (!this.brett.zuege(naechste).length) return 1 - naechste;
    if (this.brett.ohneSchlagen >= REMIS_NACH) return null;
    return undefined;
  }

  botZug(stufe) {
    const { tiefe, zufall } = STUFEN[stufe];
    const zuege = this.brett.zuege(1);
    if (Math.random() < zufall) return zuege[Math.floor(Math.random() * zuege.length)];
    return besterZug(this.brett, 1, tiefe);
  }

  siegBonus() {
    const eigene = this.brett.f.filter((w) => w !== LEER && seiteVon(w) === 0).length;
    return eigene * 10;
  }

  animieren(dt) {
    if (!this.bewegung) return;
    this.bewegung.t += dt / 0.18;
    if (this.bewegung.t >= 1) this.bewegung = null;
  }

  beschaeftigt() { return this.bewegung !== null; }

  verarbeiteKlick(x, y) {
    if (!this.menschAmZug) return;
    const i = this.#anzeige(Math.floor(y / FELD) * N + Math.floor(x / FELD));
    const zuege = this.brett.zuege(this.amZug);
    if (this.auswahl >= 0 && zuege.some(([v, n]) => v === this.auswahl && n === i)) {
      this.ziehe([this.auswahl, i]);
      return;
    }
    if (this.brett.zwang >= 0) return; // Mehrfachsprung: Stein ist festgelegt
    this.auswahl = zuege.some(([v]) => v === i) ? i : -1;
  }

  #mitte(i) {
    const a = this.#anzeige(i);
    return { x: (a % N) * FELD + FELD / 2, y: Math.floor(a / N) * FELD + FELD / 2 };
  }

  #stein(ctx, w, x, y) {
    const farbe = FARBEN[seiteVon(w)];
    const r = FELD * 0.38;
    ctx.fillStyle = farbe.rand;
    ctx.beginPath(); ctx.arc(x, y + 3, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = farbe.stein;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = farbe.rand;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r * 0.68, 0, Math.PI * 2); ctx.stroke();
    if (istDame(w)) {
      ctx.fillStyle = "#ffd84d";
      ctx.font = `${FELD * 0.4}px system-ui, "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("👑", x, y + 2);
    }
  }

  zeichnen() {
    const { ctx, brett } = this;
    for (let a = 0; a < N * N; a++) {
      const x = a % N;
      const y = Math.floor(a / N);
      ctx.fillStyle = (x + y) % 2 ? "#3b4152" : "#c9c2ae";
      ctx.fillRect(x * FELD, y * FELD, FELD, FELD);
    }
    const markiere = (i, farbe) => {
      const a = this.#anzeige(i);
      ctx.fillStyle = farbe;
      ctx.fillRect((a % N) * FELD, Math.floor(a / N) * FELD, FELD, FELD);
    };
    if (this.letzter) { markiere(this.letzter[0], "rgba(255,216,77,.18)"); markiere(this.letzter[1], "rgba(255,216,77,.18)"); }

    const zuege = this.menschAmZug ? brett.zuege(this.amZug) : [];
    if (this.menschAmZug) {
      // Steine, die ziehen können, dezent markieren; Ziele des gewählten Steins als Punkte
      for (const v of new Set(zuege.map(([von]) => von))) markiere(v, "rgba(91,108,255,.25)");
      if (this.auswahl >= 0) markiere(this.auswahl, "rgba(124,242,154,.45)");
    }

    for (let i = 0; i < N * N; i++) {
      const w = brett.f[i];
      if (w === LEER || (this.bewegung && this.bewegung.nach === i)) continue;
      const { x, y } = this.#mitte(i);
      this.#stein(ctx, w, x, y);
    }
    if (this.bewegung) {
      const a = this.#mitte(this.bewegung.von);
      const b = this.#mitte(this.bewegung.nach);
      const t = Math.min(1, this.bewegung.t);
      const e = t * (2 - t);
      this.#stein(ctx, brett.f[this.bewegung.nach], a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e);
    }
    if (this.auswahl >= 0) {
      ctx.fillStyle = "rgba(124,242,154,.8)";
      for (const [v, n] of zuege) {
        if (v !== this.auswahl) continue;
        const { x, y } = this.#mitte(n);
        ctx.beginPath(); ctx.arc(x, y, FELD * 0.14, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

export { Brett, besterZug };
