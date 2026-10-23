import { RundenSpiel } from "../../core/RundenSpiel.js";
import { Zustand } from "../../core/Spiel.js";

const N = 10;
const FLOTTE = [5, 4, 3, 3, 2];
const GROSS = 36; // Zielbrett
const KLEIN = 10.5; // eigenes Brett im Kampf
const GX = 6;
const GY = 70;
const KX = 480 - N * KLEIN - 6;
const KY = GY + 20;
const KNOPF = { y: 440, h: 34 };

const STUFEN = ["leicht", "mittel", "schwer"];

/** Zufällige gültige Flotte: Liste von Schiffen, jedes als Liste von Feldindizes. */
function zufallsFlotte() {
  for (;;) {
    const belegt = new Set();
    const schiffe = [];
    let ok = true;
    for (const laenge of FLOTTE) {
      let gesetzt = false;
      for (let versuch = 0; versuch < 200 && !gesetzt; versuch++) {
        const waagerecht = Math.random() < 0.5;
        const x = Math.floor(Math.random() * (waagerecht ? N - laenge + 1 : N));
        const y = Math.floor(Math.random() * (waagerecht ? N : N - laenge + 1));
        const felder = Array.from({ length: laenge }, (_, i) => (waagerecht ? y * N + x + i : (y + i) * N + x));
        // Schiffe dürfen sich nicht berühren (auch nicht diagonal)
        const nah = felder.some((f) => nachbarn(f, true).concat(f).some((n) => belegt.has(n)));
        if (!nah) {
          felder.forEach((f) => belegt.add(f));
          schiffe.push(felder);
          gesetzt = true;
        }
      }
      if (!gesetzt) { ok = false; break; }
    }
    if (ok) return schiffe;
  }
}

function nachbarn(f, diagonal = false) {
  const x = f % N;
  const y = Math.floor(f / N);
  const liste = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || (!diagonal && dx && dy)) continue;
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < N && ny < N) liste.push(ny * N + nx);
    }
  }
  return liste;
}

/** Prüft eine Flotte aus dem Netzwerk: richtige Längen, gerade, im Feld, ohne Überschneidung. */
function flotteGueltig(schiffe) {
  if (!Array.isArray(schiffe) || schiffe.length !== FLOTTE.length) return false;
  const laengen = schiffe.map((s) => (Array.isArray(s) ? s.length : -1)).sort((a, b) => b - a);
  if (laengen.join() !== [...FLOTTE].sort((a, b) => b - a).join()) return false;
  const alle = new Set();
  for (const s of schiffe) {
    if (!s.every((f) => Number.isInteger(f) && f >= 0 && f < N * N)) return false;
    const sortiert = [...s].sort((a, b) => a - b);
    const schritt = sortiert.length > 1 ? sortiert[1] - sortiert[0] : 1;
    if (schritt !== 1 && schritt !== N) return false;
    for (let i = 1; i < sortiert.length; i++) {
      if (sortiert[i] - sortiert[i - 1] !== schritt) return false;
      if (schritt === 1 && Math.floor(sortiert[i] / N) !== Math.floor(sortiert[0] / N)) return false;
    }
    for (const f of s) { if (alle.has(f)) return false; alle.add(f); }
  }
  return true;
}

/** Computer-Schütze: leicht = zufällig, mittel = Schachbrett + jagt nach Treffern, schwer = Wahrscheinlichkeitskarte. */
function computerSchuss(stufe, schuesse, trefferOffen, versenkt, restLaengen) {
  const frei = [];
  for (let f = 0; f < N * N; f++) if (!schuesse.has(f)) frei.push(f);
  const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];
  if (stufe === "leicht") return zufall(frei);

  // Felder neben versenkten Schiffen können nichts enthalten
  const gesperrt = new Set(versenkt.flatMap((s) => s.flatMap((f) => nachbarn(f, true))));
  const offen = new Set(trefferOffen);

  if (stufe === "schwer") {
    // Alle noch möglichen Schiffslagen zählen; Lagen durch offene Treffer zählen stark
    const dicht = new Map();
    for (const laenge of restLaengen) {
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          for (const [dx, dy] of [[1, 0], [0, 1]]) {
            if (x + dx * (laenge - 1) >= N || y + dy * (laenge - 1) >= N) continue;
            const felder = Array.from({ length: laenge }, (_, i) => (y + dy * i) * N + x + dx * i);
            if (felder.some((f) => gesperrt.has(f) || (schuesse.has(f) && !offen.has(f)))) continue;
            const treffer = felder.filter((f) => offen.has(f)).length;
            if (offen.size && !treffer) continue;
            const gewicht = treffer ? 20 ** treffer : 1;
            for (const f of felder) if (!schuesse.has(f)) dicht.set(f, (dicht.get(f) ?? 0) + gewicht);
          }
        }
      }
    }
    let bestes = [];
    let max = -1;
    for (const [f, w] of dicht) {
      if (w > max) { max = w; bestes = [f]; } else if (w === max) bestes.push(f);
    }
    if (bestes.length) return zufall(bestes);
  }

  // Treffer, die noch zu keinem versenkten Schiff gehören → Nachbarn in Linie bevorzugen
  if (trefferOffen.length) {
    let kandidaten = [];
    if (trefferOffen.length >= 2) {
      const sortiert = [...trefferOffen].sort((a, b) => a - b);
      const waagerecht = Math.floor(sortiert[0] / N) === Math.floor(sortiert[1] / N);
      const schritt = waagerecht ? 1 : N;
      const vorne = sortiert[0] - schritt;
      const hinten = sortiert.at(-1) + schritt;
      if (vorne >= 0 && (!waagerecht || Math.floor(vorne / N) === Math.floor(sortiert[0] / N))) kandidaten.push(vorne);
      if (hinten < N * N && (!waagerecht || Math.floor(hinten / N) === Math.floor(sortiert[0] / N))) kandidaten.push(hinten);
    }
    kandidaten = kandidaten.filter((f) => !schuesse.has(f));
    if (!kandidaten.length) kandidaten = trefferOffen.flatMap((t) => nachbarn(t)).filter((f) => !schuesse.has(f));
    if (kandidaten.length) return zufall(kandidaten);
  }

  const moeglich = frei.filter((f) => !gesperrt.has(f));
  if (!moeglich.length) return zufall(frei);
  const schachbrett = moeglich.filter((f) => (f % N + Math.floor(f / N)) % 2 === 0);
  if (schachbrett.length) return zufall(schachbrett);

  return zufall(moeglich);
}

export class SchiffeVersenken extends RundenSpiel {
  static seiten = ["Spieler 1", "Spieler 2"];
  static symbole = ["🎯", "🎯"];
  static modi = RundenSpiel.modi.filter((m) => m.id !== "zwei"); // verdeckte Flotten: nicht an einem Gerät

  constructor(canvas, rueckrufe) {
    super("Schiffe versenken", canvas, rueckrufe);
    this.zuruecksetzen();
  }

  zuruecksetzen() {
    this.phase = "aufstellen"; // aufstellen | warten | kampf
    this.flotte = [zufallsFlotte(), null];
    this.schuesse = [new Set(), new Set()]; // schuesse[s] = Felder, auf die Seite s geschossen hat
    this.meldung = null; // { text, farbe, zeit }
    this.zeiger = -1;
    this.flottenEreignisse = [null, null];
  }

  starten(modus) {
    super.starten(modus);
    if (this.imLan && this.raum?.ich === 1) this.flotte = [null, zufallsFlotte()];
    this.rueckrufe.beiPunkten?.("Flotte aufstellen", "⚓");
  }

  get #meine() { return this.ich; }

  // ----- Aufstellen -----
  #neuVerteilen() {
    if (this.phase !== "aufstellen") return;
    this.flotte[this.#meine] = zufallsFlotte();
  }

  #bereit() {
    if (this.phase !== "aufstellen") return;
    const meine = this.flotte[this.#meine];
    if (this.imLan) {
      this.phase = "warten";
      this.raum.senden({ typ: "flotte", schiffe: meine }).catch(() => { this.phase = "aufstellen"; });
      return;
    }
    this.flotte[1] = zufallsFlotte();
    this.#kampfBeginnen();
  }

  #kampfBeginnen() {
    this.phase = "kampf";
    this.amZug = 0;
    this.rueckrufe.beiPunkten?.(this.spielerName(0), "🎯 Am Zug");
  }

  empfangeEreignis(e) {
    if (e.daten?.typ === "flotte") {
      if ((e.von === 0 || e.von === 1) && flotteGueltig(e.daten.schiffe) && !this.flottenEreignisse[e.von]) {
        this.flottenEreignisse[e.von] = e.daten.schiffe;
        this.flotte[e.von] = e.daten.schiffe;
        if (this.flottenEreignisse[0] && this.flottenEreignisse[1]) this.#kampfBeginnen();
      }
      return;
    }
    super.empfangeEreignis(e);
  }

  // ----- RundenSpiel -----
  zugErlaubt(feld, seite) {
    return this.phase === "kampf" && Number.isInteger(feld) && feld >= 0 && feld < N * N
      && !this.schuesse[seite].has(feld);
  }

  #schiffBei(seite, feld) { return this.flotte[seite]?.find((s) => s.includes(feld)); }
  #versenkt(seite, schiff) { return schiff.every((f) => this.schuesse[1 - seite].has(f)); }

  zugAnwenden(feld, seite) {
    this.schuesse[seite].add(feld);
    const schiff = this.#schiffBei(1 - seite, feld);
    const ich = seite === this.#meine || (this.gegenComputer && seite === 0);
    if (!schiff) {
      this.meldung = { text: ich ? "Wasser" : "Daneben!", farbe: "#5bc8ff", zeit: 0, ich };
      return undefined;
    }
    const versenkt = this.#versenkt(1 - seite, schiff);
    this.meldung = { text: versenkt ? "Versenkt! 💥" : "Treffer! 🔥", farbe: ich ? "#7cf29a" : "#ff6b6b", zeit: 0, ich };
    return "nochmal"; // nach einem Treffer darf man nochmal
  }

  ergebnis() {
    for (const seite of [0, 1]) {
      const gegner = this.flotte[1 - seite];
      if (gegner && gegner.every((s) => this.#versenkt(1 - seite, s))) return seite;
    }
    return undefined;
  }

  botZug(stufe) {
    const schuesse = this.schuesse[1];
    const versenkt = this.flotte[0].filter((s) => this.#versenkt(0, s));
    const trefferOffen = [...schuesse].filter((f) => {
      const s = this.#schiffBei(0, f);
      return s && !versenkt.includes(s);
    });
    const rest = this.flotte[0].filter((s) => !versenkt.includes(s)).map((s) => s.length);
    return computerSchuss(STUFEN.includes(stufe) ? stufe : "mittel", schuesse, trefferOffen, versenkt, rest);
  }

  siegBonus() { return Math.max(0, 100 - this.schuesse[0].size) * 2; }

  animieren(dt) { if (this.meldung) this.meldung.zeit += dt; }
  beschaeftigt() { return this.phase !== "kampf" || (this.meldung !== null && this.meldung.zeit < 0.5); }

  // ----- Eingabe -----
  #knoepfe() {
    return [
      { id: "mischen", text: "🎲 Neu verteilen", x: GX, b: 200 },
      { id: "bereit", text: "✔ Bereit", x: GX + N * GROSS - 150, b: 150 },
    ];
  }

  #feldUnter(x, y) {
    const fx = Math.floor((x - GX) / GROSS);
    const fy = Math.floor((y - GY) / GROSS);
    return fx >= 0 && fy >= 0 && fx < N && fy < N ? fy * N + fx : -1;
  }

  verarbeiteKlick(x, y) {
    if (this.zustand !== Zustand.LAEUFT) return;
    if (this.phase === "aufstellen") {
      if (y >= KNOPF.y && y <= KNOPF.y + KNOPF.h) {
        const k = this.#knoepfe().find((k) => x >= k.x && x <= k.x + k.b);
        if (k?.id === "mischen") this.#neuVerteilen();
        if (k?.id === "bereit") this.#bereit();
      }
      return;
    }
    const f = this.#feldUnter(x, y);
    if (f >= 0) this.ziehe(f);
  }

  verarbeiteEingabe(taste) {
    if (this.phase !== "aufstellen") return;
    if (taste === "r" || taste === "R") this.#neuVerteilen();
    if (taste === "Enter") this.#bereit();
  }

  verarbeiteZeiger(x, y) { this.zeiger = this.#feldUnter(x, y); }

  // ----- Zeichnen -----
  #text(t, x, y, groesse, farbe = "#e8eaf0", ausrichtung = "left", gewicht = 600) {
    const { ctx } = this;
    ctx.fillStyle = farbe;
    ctx.font = `${gewicht} ${groesse}px system-ui, "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = ausrichtung;
    ctx.textBaseline = "middle";
    ctx.fillText(t, x, y);
  }

  #brett(x0, y0, z, schiffe, schuesse, zeigeSchiffe) {
    const { ctx } = this;
    ctx.fillStyle = "#123049";
    ctx.fillRect(x0, y0, N * z, N * z);
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      ctx.moveTo(x0 + i * z, y0); ctx.lineTo(x0 + i * z, y0 + N * z);
      ctx.moveTo(x0, y0 + i * z); ctx.lineTo(x0 + N * z, y0 + i * z);
    }
    ctx.stroke();
    for (const s of schiffe ?? []) {
      const versenkt = s.every((f) => schuesse.has(f));
      if (!zeigeSchiffe && !versenkt) continue;
      const xs = s.map((f) => f % N);
      const ys = s.map((f) => Math.floor(f / N));
      const lx = Math.min(...xs); const ly = Math.min(...ys);
      ctx.fillStyle = versenkt ? "#5a2a33" : "#8b93a8";
      ctx.beginPath();
      ctx.roundRect(x0 + lx * z + z * 0.12, y0 + ly * z + z * 0.12,
        (Math.max(...xs) - lx + 1) * z - z * 0.24, (Math.max(...ys) - ly + 1) * z - z * 0.24, z * 0.35);
      ctx.fill();
    }
    for (const f of schuesse) {
      const cx = x0 + (f % N) * z + z / 2;
      const cy = y0 + Math.floor(f / N) * z + z / 2;
      const treffer = schiffe?.some((s) => s.includes(f));
      if (treffer) {
        ctx.strokeStyle = "#ff5b6e";
        ctx.lineWidth = Math.max(2, z * 0.12);
        ctx.beginPath();
        ctx.moveTo(cx - z * 0.28, cy - z * 0.28); ctx.lineTo(cx + z * 0.28, cy + z * 0.28);
        ctx.moveTo(cx + z * 0.28, cy - z * 0.28); ctx.lineTo(cx - z * 0.28, cy + z * 0.28);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(255,255,255,.45)";
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1.5, z * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  zeichnen() {
    const { ctx } = this;
    ctx.fillStyle = "#14171f";
    ctx.fillRect(0, 0, this.breite, this.hoehe);
    const ich = this.#meine;

    if (this.phase !== "kampf") {
      this.#text("Deine Flotte", GX, 30, 20, "#e8eaf0", "left", 700);
      this.#text(this.phase === "warten" ? "Warte, bis die andere Seite bereit ist …" : "Gefällt dir die Aufstellung?",
        GX, 54, 14, "#9aa1b4", "left", 400);
      this.#brett(GX, GY, GROSS, this.flotte[ich], new Set(), true);
      if (this.phase === "aufstellen") {
        for (const k of this.#knoepfe()) {
          ctx.fillStyle = k.id === "bereit" ? "#5b6cff" : "#2a2f40";
          ctx.beginPath();
          ctx.roundRect(k.x, KNOPF.y, k.b, KNOPF.h, 10);
          ctx.fill();
          this.#text(k.text, k.x + k.b / 2, KNOPF.y + KNOPF.h / 2, 15, "#fff", "center", 700);
        }
      }
      return;
    }

    const gegner = 1 - ich;
    const meinZug = this.menschAmZug;
    this.#text(meinZug ? "Dein Schuss!" : `${this.spielerName(this.amZug)} schießt …`, GX, 30, 20,
      meinZug ? "#7cf29a" : "#9aa1b4", "left", 700);
    this.#text("Feld anklicken, um zu schießen. Bei Treffer nochmal.", GX, 54, 13, "#9aa1b4", "left", 400);
    this.#brett(GX, GY, GROSS, this.flotte[gegner], this.schuesse[ich], this.sieger !== undefined);
    if (meinZug && this.zeiger >= 0 && !this.schuesse[ich].has(this.zeiger)) {
      ctx.strokeStyle = "#7cf29a";
      ctx.lineWidth = 3;
      ctx.strokeRect(GX + (this.zeiger % N) * GROSS + 2, GY + Math.floor(this.zeiger / N) * GROSS + 2, GROSS - 4, GROSS - 4);
    }

    this.#text("Deine Flotte", KX, KY - 10, 11, "#9aa1b4", "left", 600);
    this.#brett(KX, KY, KLEIN, this.flotte[ich], this.schuesse[gegner], true);
    const rest = (seite) => this.flotte[seite].filter((s) => !s.every((f) => this.schuesse[1 - seite].has(f))).length;
    this.#text(`Deine Schiffe: ${rest(ich)}`, KX, KY + N * KLEIN + 18, 12, "#c9cede", "left", 500);
    this.#text(`Gegner: ${rest(gegner)}`, KX, KY + N * KLEIN + 36, 12, "#c9cede", "left", 500);

    if (this.meldung && this.meldung.zeit < 1.2) {
      // eigene Schüsse groß auf dem Zielbrett, gegnerische klein beim eigenen Brett
      ctx.globalAlpha = Math.min(1, 2.4 - this.meldung.zeit * 2);
      if (this.meldung.ich) {
        this.#text(this.meldung.text, GX + (N * GROSS) / 2, GY + (N * GROSS) / 2, 34, this.meldung.farbe, "center", 800);
      } else {
        this.#text(this.meldung.text, KX + (N * KLEIN) / 2, KY + N * KLEIN + 64, 15, this.meldung.farbe, "center", 800);
      }
      ctx.globalAlpha = 1;
    }
  }
}

export { zufallsFlotte, flotteGueltig, computerSchuss };
