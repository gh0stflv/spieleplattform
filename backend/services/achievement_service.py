from models import Statistik, erfolg_aus_zeile


class AchievementService:
    def __init__(self, db):
        self.db = db

    def alle(self):
        return [erfolg_aus_zeile(z) for z in self.db.execute("SELECT * FROM erfolg ORDER BY rowid")]

    def erreichte_ids(self, benutzer_id):
        return {z["erfolg_id"] for z in self.db.execute(
            "SELECT erfolg_id FROM benutzer_erfolg WHERE benutzer_id = ?", (benutzer_id,))}

    def pruefe_nach_spiel(self, benutzer_id):
        """Vergibt neu erfüllte Erfolge und gibt sie zurück."""
        statistik = Statistik.laden(self.db, benutzer_id)
        schon = self.erreichte_ids(benutzer_id)
        neu = [e for e in self.alle() if e.id not in schon and e.ist_erfuellt(statistik)]
        self.db.executemany(
            "INSERT INTO benutzer_erfolg (benutzer_id, erfolg_id) VALUES (?, ?)",
            [(benutzer_id, e.id) for e in neu])
        self.db.commit()
        return neu
