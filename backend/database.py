"""SQLite-Zugriff: eine Verbindung pro Request, Schema und Startdaten."""
import sqlite3

from flask import current_app, g

SCHEMA = """
CREATE TABLE IF NOT EXISTS spiel (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    beschreibung     TEXT NOT NULL,
    steuerung        TEXT NOT NULL,
    max_punkte       INTEGER,
    max_punkte_pro_s REAL NOT NULL,
    min_dauer_s      REAL NOT NULL,
    variante_von     TEXT  -- gesetzt bei Varianten: eigene Bestenliste, aber keine eigene Kachel
);

CREATE TABLE IF NOT EXISTS score (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    spiel_id  TEXT NOT NULL REFERENCES spiel(id),
    punkte    INTEGER NOT NULL,
    dauer_s   REAL NOT NULL,
    zeitpunkt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_score_spiel ON score(spiel_id, punkte DESC);
"""

# Tabellen aus der Zeit mit Benutzerkonten, werden beim Start entfernt
ALTE_TABELLEN = ("benutzer_erfolg", "erfolg", "score", "benutzer")

SPIELE = [
    # id, name, beschreibung, steuerung, max_punkte, max_punkte_pro_s, min_dauer_s
    ("snake", "Snake", "Friss so viel Futter wie möglich, ohne dich selbst oder die Wand zu treffen.",
     "Pfeiltasten oder WASD (Handy: wischen) · Leertaste = Pause", None, 25, 1),
    ("memory", "Memory", "Finde alle Kartenpaare mit möglichst wenigen Versuchen.",
     "Karte anklicken · Größe wählen: 4 × 4 bis 100 × 100 (Mausrad = zoomen, ziehen = verschieben)", 1000, 250, 4),
    ("viergewinnt", "Vier gewinnt", "Bring vier Steine in eine Reihe: gegen den Computer, zu zweit oder im LAN.",
     "Spalte anklicken oder ← → und Enter · Tasten 1–7", 400, 200, 3),
    ("supertictactoe", "Super Tic-Tac-Toe", "Tic-Tac-Toe aus 9 Feldern: Dein Zug bestimmt, wo der Gegner spielen muss.",
     "Feld anklicken · im leuchtenden Bereich spielen", 400, 100, 5),
    ("dame", "Dame", "Klassisches Dame: diagonal ziehen, Schlagzwang, Mehrfachsprung, Damen ganz hinten.",
     "Stein anklicken, dann Zielfeld", 450, 100, 10),
    # max_punkte = 0: keine Wertung, wird nur im LAN gespielt
    ("schach", "Schach", "Schach zu zweit im LAN: volle Regeln, Schachuhr, Remis und Aufgeben.",
     "Figur anklicken, dann Zielfeld · nur im Netzwerk (LAN)", 0, 0, 0),
    ("schiffe", "Schiffe versenken", "Versenke die Flotte deines Gegners im LAN. Regeln und Flotte frei einstellbar.",
     "Schiffe setzen: klicken, R = drehen · Schießen: Feld anklicken · nur im Netzwerk (LAN)", 0, 0, 0),
    ("hangman", "Hangman", "Errate das Wort, bevor das Männchen hängt. Allein (Deutsch/English) oder zu zweit im LAN.",
     "Buchstaben tippen oder anklicken", None, 60, 3),
    ("wort5", "5 Buchstaben", "Errate das Wort mit 5 Buchstaben in 6 Versuchen. Tageswort oder endlos, Deutsch oder English.",
     "Wort tippen, Enter = prüfen · Grün = richtige Stelle, Gelb = kommt vor", None, 50, 3),
    ("blackjack", "Blackjack", "Komm näher an 21 als die Bank. Allein (Bestenliste beim Auszahlen) oder am LAN-Tisch mit bis zu 6 Leuten.",
     "Chips klicken, Setzen · H = Karte, S = Stehen, D = Verdoppeln, T = Teilen", None, 2000, 10),
    # Start 500, −1 pro Zug, +100 pro Reihe: höchstens 1300, ein Sieg dauert mindestens eine Minute
    ("spider", "Spider-Solitaire", "Ordne alle Karten zu Reihen von König bis Ass. Mit 1, 2 oder 4 Farben.",
     "Karte anklicken = automatisch ziehen, oder ziehen und ablegen · Z = Rückgängig, H = Hinweis, D = Austeilen", 1300, 20, 30),
]

# Varianten mit eigener Bestenliste: id, name, Hauptspiel, Paare (Grenzwerte werden daraus berechnet)
MEMORY_GROESSEN = [("10", "10 × 10", 50), ("15", "15 × 14", 105), ("20", "20 × 20", 200),
                   ("25", "25 × 24", 300), ("100", "100 × 100", 5000)]
VARIANTEN = [
    # max. 60 Punkte pro Paar, höchstens 2 Paare pro Sekunde
    (f"memory-{gr}", f"Memory {name}", "", "", paare * 60, 120, paare * 0.5, "memory")
    for gr, name, paare in MEMORY_GROESSEN
] + [
    ("wort5-en", "5 Buchstaben English", "", "", None, 50, 3, "wort5"),
    ("spider-2", "Spider-Solitaire 2 Farben", "", "", 1300, 20, 30, "spider"),
    ("spider-4", "Spider-Solitaire 4 Farben", "", "", 1300, 20, 30, "spider"),
]


def verbindung():
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def schliessen(_fehler=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def initialisieren(app):
    """Legt Tabellen an und schreibt die Spiele (idempotent)."""
    with app.app_context():
        db = verbindung()
        spalten = {z["name"] for z in db.execute("PRAGMA table_info(score)")}
        if "benutzer_id" in spalten:  # alte Datenbank mit Benutzerkonten
            for tabelle in ALTE_TABELLEN:
                db.execute(f"DROP TABLE IF EXISTS {tabelle}")
        db.executescript(SCHEMA)
        if "variante_von" not in {z["name"] for z in db.execute("PRAGMA table_info(spiel)")}:
            db.execute("ALTER TABLE spiel ADD COLUMN variante_von TEXT")
        db.executemany(
            "INSERT OR REPLACE INTO spiel VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [(*z, None) for z in SPIELE] + VARIANTEN)
        # entfernte Spiele samt ihren Ergebnissen löschen
        ids = [z[0] for z in SPIELE + VARIANTEN]
        platzhalter = ", ".join("?" * len(ids))
        db.execute(f"DELETE FROM score WHERE spiel_id NOT IN ({platzhalter})", ids)
        db.execute(f"DELETE FROM spiel WHERE id NOT IN ({platzhalter})", ids)
        db.commit()
    app.teardown_appcontext(schliessen)
