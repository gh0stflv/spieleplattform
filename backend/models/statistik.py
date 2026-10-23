from dataclasses import dataclass, field


@dataclass
class Statistik:
    """Aggregierte Werte eines Benutzers über alle Spiele."""
    benutzer_id: int
    spiele_gesamt: int = 0
    spielzeit_s: float = 0.0
    bestwerte: dict[str, int] = field(default_factory=dict)        # spiel_id -> beste Punkte
    gespielte_spiele: set[str] = field(default_factory=set)
    alle_spiele: set[str] = field(default_factory=set)

    @classmethod
    def laden(cls, db, benutzer_id):
        stat = cls(benutzer_id)
        for z in db.execute(
                "SELECT spiel_id, COUNT(*) AS n, SUM(dauer_s) AS zeit, MAX(punkte) AS best "
                "FROM score WHERE benutzer_id = ? GROUP BY spiel_id", (benutzer_id,)):
            stat.spiele_gesamt += z["n"]
            stat.spielzeit_s += z["zeit"] or 0
            stat.bestwerte[z["spiel_id"]] = z["best"]
            stat.gespielte_spiele.add(z["spiel_id"])
        # Spiele ohne Wertung (max_punkte = 0, z. B. Schach nur im LAN) zählen für "Allrounder" nicht
        stat.alle_spiele = {z["id"] for z in db.execute(
            "SELECT id FROM spiel WHERE max_punkte IS NULL OR max_punkte > 0")}
        return stat

    def als_dict(self):
        return {
            "spiele_gesamt": self.spiele_gesamt,
            "spielzeit_s": round(self.spielzeit_s),
            "bestwerte": self.bestwerte,
        }
