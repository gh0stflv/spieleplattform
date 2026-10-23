class ScoreFehler(Exception):
    pass


class ScoreService:
    def __init__(self, db):
        self.db = db

    def spiel(self, spiel_id):
        return self.db.execute("SELECT * FROM spiel WHERE id = ?", (spiel_id,)).fetchone()

    def plausibilitaet_pruefen(self, spiel, punkte, dauer_s):
        """Grobe Anti-Cheat-Prüfung anhand der Grenzwerte in der Tabelle spiel."""
        if not isinstance(punkte, int) or isinstance(punkte, bool) or punkte < 0:
            raise ScoreFehler("Ungültige Punktzahl.")
        if not isinstance(dauer_s, (int, float)) or isinstance(dauer_s, bool) or dauer_s <= 0:
            raise ScoreFehler("Ungültige Spieldauer.")
        if dauer_s > 6 * 3600:
            raise ScoreFehler("Spieldauer unrealistisch lang.")
        if spiel["max_punkte"] is not None and punkte > spiel["max_punkte"]:
            raise ScoreFehler("Punktzahl über dem Maximum.")
        if punkte > 0 and dauer_s < spiel["min_dauer_s"]:
            raise ScoreFehler("Spiel zu kurz für diese Punktzahl.")
        if punkte > spiel["max_punkte_pro_s"] * dauer_s:
            raise ScoreFehler("Punktzahl für die Spieldauer unplausibel.")

    def speichern(self, benutzer_id, spiel_id, punkte, dauer_s) -> int:
        spiel = self.spiel(spiel_id)
        if spiel is None:
            raise ScoreFehler("Unbekanntes Spiel.")
        self.plausibilitaet_pruefen(spiel, punkte, dauer_s)
        cur = self.db.execute(
            "INSERT INTO score (benutzer_id, spiel_id, punkte, dauer_s) VALUES (?, ?, ?, ?)",
            (benutzer_id, spiel_id, punkte, float(dauer_s)))
        self.db.commit()
        return cur.lastrowid

    def bestenliste(self, spiel_id, limit=10):
        """Bester Score je Benutzer, absteigend sortiert."""
        zeilen = self.db.execute(
            """SELECT b.id AS benutzer_id, b.name, MAX(s.punkte) AS punkte, MIN(s.zeitpunkt) AS zeitpunkt
               FROM score s JOIN benutzer b ON b.id = s.benutzer_id
               WHERE s.spiel_id = ?
               GROUP BY b.id
               ORDER BY punkte DESC, zeitpunkt ASC
               LIMIT ?""", (spiel_id, limit)).fetchall()
        return [{"platz": i + 1, **dict(z)} for i, z in enumerate(zeilen)]

    def platz(self, spiel_id, benutzer_id):
        """Platz des Benutzers (nach seinem Bestwert) oder None."""
        best = self.db.execute(
            "SELECT MAX(punkte) AS p FROM score WHERE spiel_id = ? AND benutzer_id = ?",
            (spiel_id, benutzer_id)).fetchone()["p"]
        if best is None:
            return None
        besser = self.db.execute(
            """SELECT COUNT(*) AS n FROM (
                 SELECT benutzer_id, MAX(punkte) AS p FROM score WHERE spiel_id = ? GROUP BY benutzer_id
               ) WHERE p > ?""", (spiel_id, best)).fetchone()["n"]
        return besser + 1
