"""Startpunkt: python app.py  →  http://127.0.0.1:5000"""
import os
import secrets
from pathlib import Path

from flask import Flask, send_from_directory

import database
from routes import auth, games, scores

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
    for modul in (auth, games, scores):
        app.register_blueprint(modul.bp)

    @app.get("/")
    def startseite():
        return send_from_directory(FRONTEND, "index.html")

    @app.get("/<path:pfad>")
    def frontend(pfad):
        return send_from_directory(FRONTEND, pfad)

    return app


if __name__ == "__main__":
    create_app().run(debug=os.environ.get("FLASK_DEBUG") == "1")
