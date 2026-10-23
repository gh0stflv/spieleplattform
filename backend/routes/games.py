from flask import Blueprint, jsonify

from database import verbindung

bp = Blueprint("games", __name__, url_prefix="/api")


@bp.get("/spiele")
def spiele():
    zeilen = verbindung().execute(
        "SELECT id, name, beschreibung, steuerung FROM spiel WHERE variante_von IS NULL ORDER BY rowid").fetchall()
    return jsonify([dict(z) for z in zeilen])
