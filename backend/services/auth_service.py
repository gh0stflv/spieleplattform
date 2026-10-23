import re
import sqlite3

from werkzeug.security import generate_password_hash

from models import Benutzer

NAME_MUSTER = re.compile(r"^[A-Za-z0-9_\-äöüÄÖÜß]{3,20}$")
MIN_PASSWORT = 8


class AuthFehler(Exception):
    pass


class AuthService:
    def __init__(self, db):
        self.db = db

    def registrieren(self, name: str, passwort: str, email: str | None = None) -> Benutzer:
        name = (name or "").strip()
        email = (email or "").strip() or None
        if not NAME_MUSTER.match(name):
            raise AuthFehler("Name: 3–20 Zeichen, nur Buchstaben, Zahlen, _ und -.")
        if len(passwort or "") < MIN_PASSWORT:
            raise AuthFehler(f"Passwort muss mindestens {MIN_PASSWORT} Zeichen haben.")
        try:
            cur = self.db.execute(
                "INSERT INTO benutzer (name, email, passwort_hash) VALUES (?, ?, ?)",
                (name, email, generate_password_hash(passwort)))
            self.db.commit()
        except sqlite3.IntegrityError:
            raise AuthFehler("Name oder E-Mail ist schon vergeben.") from None
        return self.finde(cur.lastrowid)

    def login(self, name: str, passwort: str) -> Benutzer:
        zeile = self.db.execute(
            "SELECT * FROM benutzer WHERE name = ?", ((name or "").strip(),)).fetchone()
        benutzer = Benutzer.aus_zeile(zeile) if zeile else None
        if not benutzer or not benutzer.pruefe_passwort(passwort or ""):
            raise AuthFehler("Name oder Passwort falsch.")
        return benutzer

    def finde(self, benutzer_id) -> Benutzer | None:
        zeile = self.db.execute("SELECT * FROM benutzer WHERE id = ?", (benutzer_id,)).fetchone()
        return Benutzer.aus_zeile(zeile) if zeile else None

    def loeschen(self, benutzer_id):
        """Löscht Konto inkl. Scores und Erfolgen (ON DELETE CASCADE)."""
        self.db.execute("DELETE FROM benutzer WHERE id = ?", (benutzer_id,))
        self.db.commit()
