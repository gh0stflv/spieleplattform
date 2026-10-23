"""SQLite-Zugriff: eine Verbindung pro Request, Schema und Startdaten."""
import sqlite3

from flask import current_app, g

SCHEMA = """
CREATE TABLE IF NOT EXISTS benutzer (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email         TEXT UNIQUE,
    passwort_hash TEXT NOT NULL,
    erstellt_am   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS spiel (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    beschreibung     TEXT NOT NULL,
    steuerung        TEXT NOT NULL,
    max_punkte       INTEGER,
    max_punkte_pro_s REAL NOT NULL,
    min_dauer_s      REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS score (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    benutzer_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
    spiel_id    TEXT NOT NULL REFERENCES spiel(id),
    punkte      INTEGER NOT NULL,
    dauer_s     REAL NOT NULL,
    zeitpunkt   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_score_spiel ON score(spiel_id, punkte DESC);

CREATE TABLE IF NOT EXISTS erfolg (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    beschreibung TEXT NOT NULL,
    typ          TEXT NOT NULL CHECK (typ IN ('punkte', 'anzahl', 'vielfalt')),
    schwellwert  INTEGER NOT NULL,
    spiel_id     TEXT REFERENCES spiel(id)
);

CREATE TABLE IF NOT EXISTS benutzer_erfolg (
    benutzer_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
    erfolg_id   TEXT NOT NULL REFERENCES erfolg(id),
    erreicht_am TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (benutzer_id, erfolg_id)
);
"""

SPIELE = [
    # id, name, beschreibung, steuerung, max_punkte, max_punkte_pro_s, min_dauer_s
    ("snake", "Snake", "Friss so viel Futter wie möglich, ohne dich selbst oder die Wand zu treffen.",
     "Pfeiltasten oder WASD (Handy: wischen) · Leertaste = Pause", None, 25, 1),
    ("memory", "Memory", "Finde alle Kartenpaare mit möglichst wenigen Versuchen.",
     "Karte anklicken oder antippen · Leertaste = Pause", 1000, 250, 4),
    ("viergewinnt", "Vier gewinnt", "Bring vier Steine in eine Reihe: gegen den Computer, zu zweit oder im LAN.",
     "Spalte anklicken oder ← → und Enter · Tasten 1–7", 400, 200, 3),
    ("supertictactoe", "Super Tic-Tac-Toe", "Tic-Tac-Toe aus 9 Feldern: Dein Zug bestimmt, wo der Gegner spielen muss.",
     "Feld anklicken · im leuchtenden Bereich spielen", 400, 100, 5),
    ("ssp", "Schere Stein Papier", "Wer zuerst 3 Runden gewinnt. Der Computer lernt deine Gewohnheiten!",
     "Klicken oder Tasten 1 = Schere, 2 = Stein, 3 = Papier", 200, 60, 4),
    ("dame", "Dame", "Klassisches Dame: diagonal ziehen, Schlagzwang, Mehrfachsprung, Damen ganz hinten.",
     "Stein anklicken, dann Zielfeld", 450, 100, 10),
    ("schiffe", "Schiffe versenken", "Finde und versenke die gegnerische Flotte. Bei einem Treffer darfst du nochmal.",
     "Feld anklicken · beim Aufstellen R = neu verteilen, Enter = bereit", 500, 60, 15),
]

ERFOLGE = [
    # id, name, beschreibung, typ, schwellwert, spiel_id
    ("erste-runde", "Erste Runde", "Spiele dein erstes Spiel.", "anzahl", 1, None),
    ("dauerzocker", "Dauerzocker", "Spiele 10 Runden.", "anzahl", 10, None),
    ("schlangenbeschwoerer", "Schlangenbeschwörer", "Erreiche 200 Punkte in Snake.", "punkte", 200, "snake"),
    ("gedaechtniskuenstler", "Gedächtniskünstler", "Erreiche 800 Punkte in Memory.", "punkte", 800, "memory"),
    ("allrounder", "Allrounder", "Spiele jedes Spiel mindestens einmal.", "vielfalt", 0, None),
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
    """Legt Tabellen an und schreibt Spiele und Erfolge (idempotent)."""
    with app.app_context():
        db = verbindung()
        db.executescript(SCHEMA)
        db.executemany(
            "INSERT OR REPLACE INTO spiel VALUES (?, ?, ?, ?, ?, ?, ?)", SPIELE)
        db.executemany(
            "INSERT OR REPLACE INTO erfolg VALUES (?, ?, ?, ?, ?, ?)", ERFOLGE)
        db.commit()
    app.teardown_appcontext(schliessen)
