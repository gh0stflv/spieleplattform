// Regeln und Aufstellung für Schiffe versenken, ohne Oberfläche.
// Ein Schiff ist { x, y, laenge, senkrecht }: (x, y) ist das linke bzw. obere Ende.
// Regeln: { groesse, flotte: { laenge: anzahl }, nochmal, beruehren }.
export const LAENGEN = [6, 5, 4, 3, 2, 1];
export const SCHIFFSNAMEN = {
  6: "Flugzeugträger", 5: "Schlachtschiff", 4: "Kreuzer", 3: "Zerstörer", 2: "U-Boot", 1: "Schnellboot",
};
export const GROESSE_MIN = 6;
export const GROESSE_MAX = 14;
export const ANZAHL_MAX = 6;

export const VORLAGEN = {
  klassisch: { name: "Klassisch", groesse: 10, flotte: { 5: 1, 4: 1, 3: 2, 2: 1 }, nochmal: true, beruehren: false },
  deutsch: { name: "Deutsche Variante", groesse: 10, flotte: { 5: 1, 4: 2, 3: 3, 2: 4 }, nochmal: true, beruehren: false },
};

export function zellen({ x, y, laenge, senkrecht }) {
  return Array.from({ length: laenge }, (_, i) => (senkrecht ? [x, y + i] : [x + i, y]));
}

/** Alle zu setzenden Schiffslängen, längste zuerst. */
export function schiffsListe(regeln) {
  const liste = [];
  for (const laenge of LAENGEN) for (let i = 0; i < (regeln.flotte[laenge] ?? 0); i++) liste.push(laenge);
  return liste;
}

/** Kurzbeschreibung der Flotte, z. B. "1×5, 2×3". */
export function flotteText(regeln) {
  return LAENGEN.filter((l) => regeln.flotte[l]).map((l) => `${regeln.flotte[l]}×${l}`).join(", ");
}

/** Zufallszahlen mit festem Startwert, damit alle Geräte zum selben Ergebnis kommen. */
function zufallszahlen(seed) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** raster: 1 = Schiff. Liegt das Schiff im Feld, ohne Überlappung (und ohne Berührung, falls verboten)? */
function frei(raster, g, beruehren, schiff) {
  for (const [x, y] of zellen(schiff)) {
    if (x < 0 || y < 0 || x >= g || y >= g || raster[y * g + x]) return false;
    if (beruehren) continue;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < g && ny < g && raster[ny * g + nx]) return false;
      }
    }
  }
  return true;
}

function rasterAus(g, schiffe) {
  const raster = new Uint8Array(g * g);
  for (const s of schiffe) for (const [x, y] of zellen(s)) raster[y * g + x] = 1;
  return raster;
}

export function passtDazu(regeln, schiffe, neu) {
  return frei(rasterAus(regeln.groesse, schiffe), regeln.groesse, regeln.beruehren, neu);
}

/** Verteilt die ganze Flotte zufällig. null, wenn es nach allen Versuchen nicht geklappt hat. */
export function zufaelligeFlotte(regeln, zufall = Math.random, versuche = 200) {
  const g = regeln.groesse;
  const liste = schiffsListe(regeln);
  for (let v = 0; v < versuche; v++) {
    const schiffe = [];
    const raster = new Uint8Array(g * g);
    for (const laenge of liste) {
      const moeglich = [];
      for (const senkrecht of laenge > 1 ? [false, true] : [false]) {
        for (let y = 0; y < g; y++) {
          for (let x = 0; x < g; x++) {
            const s = { x, y, laenge, senkrecht };
            if (frei(raster, g, regeln.beruehren, s)) moeglich.push(s);
          }
        }
      }
      if (!moeglich.length) break;
      const s = moeglich[Math.floor(zufall() * moeglich.length)];
      schiffe.push(s);
      for (const [x, y] of zellen(s)) raster[y * g + x] = 1;
    }
    if (schiffe.length === liste.length) return schiffe;
  }
  return null;
}

const passtSpeicher = new Map();

/** Passt die Flotte aufs Feld? Mit festem Startwert geprüft, also auf jedem Gerät gleich. */
export function flottePasst(regeln) {
  const schluessel = JSON.stringify(regeln);
  if (!passtSpeicher.has(schluessel)) {
    passtSpeicher.set(schluessel, zufaelligeFlotte(regeln, zufallszahlen(1), 50) !== null);
  }
  return passtSpeicher.get(schluessel);
}

/** Bereinigte Kopie (nur bekannte Felder, Zahlen im erlaubten Bereich), ohne zu prüfen, ob alles passt. */
export function regelnBereinigen(r) {
  const zahl = (wert, min, max, sonst) => (Number.isInteger(wert) && wert >= min && wert <= max ? wert : sonst);
  const flotte = {};
  for (const l of LAENGEN) {
    const n = zahl(r?.flotte?.[l], 0, ANZAHL_MAX, 0);
    if (n) flotte[l] = n;
  }
  return {
    groesse: zahl(r?.groesse, GROESSE_MIN, GROESSE_MAX, 10),
    flotte,
    nochmal: r?.nochmal === true,
    beruehren: r?.beruehren === true,
  };
}

/** Leerer Text, wenn die Regeln spielbar sind, sonst der Grund. */
export function regelnFehler(regeln) {
  const liste = schiffsListe(regeln);
  if (!liste.length) return "Mindestens ein Schiff einstellen";
  if (liste[0] > regeln.groesse) return "Ein Schiff ist länger als das Feld";
  // Schnelle Abschätzung: ohne Berührung braucht jedes Schiff samt Abstand (laenge + 1) × 2 Felder
  // in einem um eins größeren Feld
  const flaeche = regeln.beruehren ? regeln.groesse ** 2 : (regeln.groesse + 1) ** 2;
  const bedarf = liste.reduce((summe, l) => summe + (regeln.beruehren ? l : (l + 1) * 2), 0);
  if (bedarf > flaeche || !flottePasst(regeln)) return "Die Flotte passt nicht aufs Feld";
  return "";
}

/** Prüft Regeln aus dem Netz: bereinigte Regeln oder null. */
export function regelnPruefen(r) {
  if (!r || typeof r !== "object") return null;
  const regeln = regelnBereinigen(r);
  if (regeln.groesse !== r.groesse) return null;
  return regelnFehler(regeln) ? null : regeln;
}

/** Ist das ein Schiff mit gültigen Werten, das ganz im Feld liegt? */
export function schiffGueltig(regeln, s) {
  if (!s || typeof s !== "object") return false;
  const { x, y, laenge, senkrecht } = s;
  if (![x, y, laenge].every(Number.isInteger) || typeof senkrecht !== "boolean" || !regeln.flotte[laenge]) return false;
  return zellen(s).every(([a, b]) => a >= 0 && b >= 0 && a < regeln.groesse && b < regeln.groesse);
}

/** Ist das eine vollständige, regelkonforme Aufstellung? */
export function flotteGueltig(regeln, schiffe) {
  if (!Array.isArray(schiffe)) return false;
  const soll = schiffsListe(regeln).join();
  const ist = schiffe.map((s) => s?.laenge).sort((a, b) => b - a).join();
  if (soll !== ist) return false;
  const gesetzt = [];
  for (const s of schiffe) {
    if (!schiffGueltig(regeln, s) || !passtDazu(regeln, gesetzt, s)) return false;
    gesetzt.push(s);
  }
  return true;
}
