"""Spielräume für Mehrspieler im lokalen Netzwerk.

Der Server prüft keine Spielregeln: Er hält nur fest, wer im Raum ist, und
speichert die Züge in fester Reihenfolge. Jeder Client wendet dieselben Züge
in derselben Reihenfolge an, dadurch sehen alle denselben Spielstand.
Räume liegen nur im Arbeitsspeicher und verschwinden beim Neustart.

Zufall: Enthält ein Ereignis "zufall": n (1–30), hängt der Server n Zufallszahlen als
"wuerfe" an. Sie entstehen erst beim Eintreffen, also kann sie vorher niemand kennen
(z. B. Karten ziehen oder würfeln, ohne dass jemand die Reihenfolge vorhersagen kann).
"""
import random
import secrets
import threading
import time

CODE_ZEICHEN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # ohne 0/O/1/I
MAX_ALTER_S = 3 * 3600
MAX_EREIGNISSE = 20000
VERBUNDEN_S = 4  # wer so lange nicht abgefragt hat, gilt als nicht verbunden
MAX_ZUFALL = 30


class RaumFehler(Exception):
    def __init__(self, nachricht, status=400):
        super().__init__(nachricht)
        self.status = status


class Raum:
    def __init__(self, code, spiel_id, max_spieler):
        self.code = code
        self.spiel_id = spiel_id
        self.max_spieler = max_spieler
        self.seed = random.randrange(2**31)
        self.spieler = []        # [{"name", "token", "zuletzt"}] (zuletzt = letzte Abfrage)
        self.ereignisse = []     # [{"nr", "von", "daten"}]
        self.letzte_aktivitaet = time.time()

    def index_von(self, token):
        for i, s in enumerate(self.spieler):
            if secrets.compare_digest(s["token"], token or ""):
                return i
        return None

    def zustand(self, seit=0):
        return {
            "code": self.code,
            "spiel_id": self.spiel_id,
            "max_spieler": self.max_spieler,
            "seed": self.seed,
            "spieler": [s["name"] for s in self.spieler],
            "verbunden": [time.time() - s["zuletzt"] < VERBUNDEN_S for s in self.spieler],
            "voll": len(self.spieler) >= self.max_spieler,
            "anzahl_ereignisse": len(self.ereignisse),
            "ereignisse": self.ereignisse[max(0, seit):],
        }


class RaumService:
    """Ein Objekt pro App, threadsicher (der Flask-Server bedient Anfragen parallel)."""

    def __init__(self):
        self._raeume = {}
        self._sperre = threading.Lock()

    def _aufraeumen(self):
        grenze = time.time() - MAX_ALTER_S
        for code in [c for c, r in self._raeume.items() if r.letzte_aktivitaet < grenze]:
            del self._raeume[code]

    def _raum(self, code):
        raum = self._raeume.get((code or "").upper())
        if raum is None:
            raise RaumFehler("Raum nicht gefunden. Code richtig?", 404)
        raum.letzte_aktivitaet = time.time()
        return raum

    def erstellen(self, spiel_id, name, max_spieler=2):
        if not isinstance(max_spieler, int) or not 2 <= max_spieler <= 8:
            raise RaumFehler("Spieleranzahl muss zwischen 2 und 8 liegen.")
        with self._sperre:
            self._aufraeumen()
            code = "".join(secrets.choice(CODE_ZEICHEN) for _ in range(4))
            while code in self._raeume:
                code = "".join(secrets.choice(CODE_ZEICHEN) for _ in range(4))
            raum = Raum(code, spiel_id, max_spieler)
            self._raeume[code] = raum
            return self._eintreten(raum, name)

    def beitreten(self, code, name):
        with self._sperre:
            raum = self._raum(code)
            if len(raum.spieler) >= raum.max_spieler:
                raise RaumFehler("Der Raum ist schon voll.", 409)
            return self._eintreten(raum, name)

    def _eintreten(self, raum, name):
        token = secrets.token_urlsafe(16)
        raum.spieler.append({"name": (name or "Gast")[:20], "token": token, "zuletzt": time.time()})
        return {"code": raum.code, "token": token, "ich": len(raum.spieler) - 1, **raum.zustand()}

    def wieder_eintreten(self, code, token):
        """Nach dem Neuladen der Seite: denselben Platz mit dem gemerkten Token wieder einnehmen."""
        with self._sperre:
            raum = self._raum(code)
            ich = raum.index_von(token)
            if ich is None:
                raise RaumFehler("Du bist nicht in diesem Raum.", 403)
            raum.spieler[ich]["zuletzt"] = time.time()
            return {"code": raum.code, "token": token, "ich": ich, **raum.zustand()}

    def abfragen(self, code, seit=0, token=None):
        with self._sperre:
            raum = self._raum(code)
            ich = raum.index_von(token) if token else None
            if ich is not None:
                raum.spieler[ich]["zuletzt"] = time.time()
            return raum.zustand(seit)

    def zug(self, code, token, nr, daten):
        """Hängt einen Zug an. nr muss der aktuellen Anzahl entsprechen (sonst war jemand schneller)."""
        with self._sperre:
            raum = self._raum(code)
            von = raum.index_von(token)
            if von is None:
                raise RaumFehler("Du bist nicht in diesem Raum.", 403)
            if nr != len(raum.ereignisse):
                raise RaumFehler("Veralteter Spielstand, bitte neu laden.", 409)
            if len(raum.ereignisse) >= MAX_EREIGNISSE:
                raise RaumFehler("Zu viele Züge in diesem Raum.", 409)
            if isinstance(daten, dict) and "zufall" in daten:
                anzahl = daten.pop("zufall")
                if not isinstance(anzahl, int) or isinstance(anzahl, bool) or not 1 <= anzahl <= MAX_ZUFALL:
                    raise RaumFehler(f"zufall muss zwischen 1 und {MAX_ZUFALL} liegen.")
                daten["wuerfe"] = [secrets.randbelow(2**31) for _ in range(anzahl)]
            raum.ereignisse.append({"nr": nr, "von": von, "daten": daten})
            return {"nr": nr}
