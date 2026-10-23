from flask import Blueprint, jsonify, request

from database import verbindung
from services import ScoreFehler, ScoreService

from . import fehler

bp = Blueprint("scores", __name__, url_prefix="/api")


@bp.post("/scores")
def score_speichern():
    daten = request.get_json(silent=True) or {}
    scores = ScoreService(verbindung())
    try:
        name = scores.speichern(daten.get("name"), daten.get("spiel_id"), daten.get("punkte"), daten.get("dauer_s"))
    except ScoreFehler as e:
        return fehler(str(e), 422)
    return jsonify({"name": name, "platz": scores.platz(daten["spiel_id"], name)}), 201


@bp.get("/bestenliste/<spiel_id>")
def bestenliste(spiel_id):
    scores = ScoreService(verbindung())
    if scores.spiel(spiel_id) is None:
        return fehler("Unbekanntes Spiel.", 404)
    return jsonify(scores.bestenliste(spiel_id))
