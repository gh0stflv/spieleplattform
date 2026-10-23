from flask import Blueprint, jsonify, request, session

from database import verbindung
from models import Statistik
from services import AchievementService, AuthFehler, AuthService

from . import fehler, login_noetig

bp = Blueprint("auth", __name__, url_prefix="/api")


@bp.post("/registrieren")
def registrieren():
    daten = request.get_json(silent=True) or {}
    try:
        benutzer = AuthService(verbindung()).registrieren(
            daten.get("name"), daten.get("passwort"), daten.get("email"))
    except AuthFehler as e:
        return fehler(str(e))
    session.clear()
    session["benutzer_id"] = benutzer.id
    return jsonify(benutzer.als_dict()), 201


@bp.post("/login")
def login():
    daten = request.get_json(silent=True) or {}
    try:
        benutzer = AuthService(verbindung()).login(daten.get("name"), daten.get("passwort"))
    except AuthFehler as e:
        return fehler(str(e), 401)
    session.clear()
    session["benutzer_id"] = benutzer.id
    return jsonify(benutzer.als_dict())


@bp.post("/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@bp.get("/ich")
def ich():
    benutzer = AuthService(verbindung()).finde(session.get("benutzer_id"))
    if benutzer is None:
        session.clear()
        return jsonify(None)
    return jsonify(benutzer.als_dict())


@bp.get("/profil")
@login_noetig
def profil():
    db = verbindung()
    benutzer = AuthService(db).finde(session["benutzer_id"])
    erfolge = AchievementService(db)
    erreicht = erfolge.erreichte_ids(benutzer.id)
    return jsonify({
        "benutzer": benutzer.als_dict(),
        "statistik": Statistik.laden(db, benutzer.id).als_dict(),
        "erfolge": [{**e.als_dict(), "erreicht": e.id in erreicht} for e in erfolge.alle()],
    })


@bp.delete("/konto")
@login_noetig
def konto_loeschen():
    AuthService(verbindung()).loeschen(session["benutzer_id"])
    session.clear()
    return jsonify({"ok": True})
