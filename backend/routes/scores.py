from flask import Blueprint, jsonify, request, session

from database import verbindung
from services import AchievementService, ScoreFehler, ScoreService

from . import fehler, login_noetig

bp = Blueprint("scores", __name__, url_prefix="/api")


@bp.post("/scores")
@login_noetig
def score_speichern():
    daten = request.get_json(silent=True) or {}
    db = verbindung()
    scores = ScoreService(db)
    benutzer_id = session["benutzer_id"]
    try:
        scores.speichern(benutzer_id, daten.get("spiel_id"), daten.get("punkte"), daten.get("dauer_s"))
    except ScoreFehler as e:
        return fehler(str(e), 422)
    neue_erfolge = AchievementService(db).pruefe_nach_spiel(benutzer_id)
    return jsonify({
        "platz": scores.platz(daten["spiel_id"], benutzer_id),
        "neue_erfolge": [e.als_dict() for e in neue_erfolge],
    }), 201


@bp.get("/bestenliste/<spiel_id>")
def bestenliste(spiel_id):
    scores = ScoreService(verbindung())
    if scores.spiel(spiel_id) is None:
        return fehler("Unbekanntes Spiel.", 404)
    return jsonify(scores.bestenliste(spiel_id))
