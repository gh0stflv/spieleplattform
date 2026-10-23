from abc import ABC, abstractmethod

from .statistik import Statistik


class Erfolg(ABC):
    def __init__(self, id, name, beschreibung, schwellwert, spiel_id=None):
        self.id = id
        self.name = name
        self.beschreibung = beschreibung
        self.schwellwert = schwellwert
        self.spiel_id = spiel_id

    @abstractmethod
    def ist_erfuellt(self, statistik: Statistik) -> bool:
        ...

    def als_dict(self):
        return {"id": self.id, "name": self.name, "beschreibung": self.beschreibung}


class PunkteErfolg(Erfolg):
    """Mindestpunktzahl in einem bestimmten Spiel."""

    def ist_erfuellt(self, statistik):
        return statistik.bestwerte.get(self.spiel_id, 0) >= self.schwellwert


class AnzahlErfolg(Erfolg):
    """Mindestanzahl gespielter Runden über alle Spiele."""

    def ist_erfuellt(self, statistik):
        return statistik.spiele_gesamt >= self.schwellwert


class VielfaltErfolg(Erfolg):
    """Jedes verfügbare Spiel mindestens einmal gespielt."""

    def ist_erfuellt(self, statistik):
        return bool(statistik.alle_spiele) and statistik.alle_spiele <= statistik.gespielte_spiele


_TYPEN = {"punkte": PunkteErfolg, "anzahl": AnzahlErfolg, "vielfalt": VielfaltErfolg}


def erfolg_aus_zeile(zeile) -> Erfolg:
    klasse = _TYPEN[zeile["typ"]]
    return klasse(zeile["id"], zeile["name"], zeile["beschreibung"],
                  zeile["schwellwert"], zeile["spiel_id"])
