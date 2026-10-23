"""Startpunkt: python app.py  →  http://127.0.0.1:5000"""
import os
import secrets
from pathlib import Path

from flask import Flask, send_from_directory

import database
from routes import auth, games, raeume, scores
from services import RaumService

BACKEND = Path(__file__).resolve().parent
FRONTEND = BACKEND.parent / "frontend"


def geheimer_schluessel():
    """SECRET_KEY aus Umgebungsvariable oder einmalig erzeugt in instance/."""
    if os.environ.get("SECRET_KEY"):
        return os.environ["SECRET_KEY"]
    datei = BACKEND / "instance" / "secret_key"
    if not datei.exists():
        datei.parent.mkdir(exist_ok=True)
        datei.write_text(secrets.token_hex(32))
    return datei.read_text().strip()


def create_app(config=None):
    app = Flask(__name__, static_folder=None)
    app.config.update(
        DATABASE=str(BACKEND / "plattform.db"),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
    )
    if config:
        app.config.update(config)
    if not app.config.get("SECRET_KEY"):
        app.config["SECRET_KEY"] = geheimer_schluessel()

    database.initialisieren(app)
    app.extensions["raeume"] = RaumService()
    for modul in (auth, games, raeume, scores):
        app.register_blueprint(modul.bp)

    @app.get("/")
    def startseite():
        return send_from_directory(FRONTEND, "index.html")

    @app.get("/<path:pfad>")
    def frontend(pfad):
        return send_from_directory(FRONTEND, pfad)

    return app


if __name__ == "__main__":
    # 0.0.0.0 = auch für andere Geräte im selben Netzwerk erreichbar (für LAN-Mehrspieler)
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 5000))
    print(f"\n  Auf diesem PC:        http://127.0.0.1:{port}")
    for adresse in raeume.lan_adressen():
        print(f"  Im Netzwerk (LAN):    http://{adresse}:{port}")
    print()
    create_app().run(host=host, port=port, threaded=True, debug=os.environ.get("FLASK_DEBUG") == "1")
