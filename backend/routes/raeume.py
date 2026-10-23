import socket

from flask import Blueprint, current_app, jsonify, request

from database import verbindung
from services import RaumFehler

from . import fehler

bp = Blueprint("raeume", __name__, url_prefix="/api")


def _dienst():
    return current_app.extensions["raeume"]


def _name(daten):
    name = daten.get("name")
    return (name.strip() if isinstance(name, str) else "") or "Gast"


@bp.errorhandler(RaumFehler)
def raum_fehler(e):
    return fehler(str(e), e.status)


@bp.post("/raeume")
def erstellen():
    daten = request.get_json(silent=True) or {}
    spiel = verbindung().execute("SELECT id FROM spiel WHERE id = ?", (daten.get("spiel_id"),)).fetchone()
    if spiel is None:
        return fehler("Unbekanntes Spiel.", 404)
    return jsonify(_dienst().erstellen(spiel["id"], _name(daten), daten.get("max_spieler", 2))), 201


@bp.post("/raeume/<code>/beitreten")
def beitreten(code):
    daten = request.get_json(silent=True) or {}
    return jsonify(_dienst().beitreten(code, _name(daten)))


@bp.post("/raeume/<code>/wieder")
def wieder_eintreten(code):
    daten = request.get_json(silent=True) or {}
    return jsonify(_dienst().wieder_eintreten(code, daten.get("token")))


@bp.get("/raeume/<code>")
def abfragen(code):
    return jsonify(_dienst().abfragen(code, request.args.get("seit", 0, type=int), request.args.get("token")))


@bp.post("/raeume/<code>/zug")
def zug(code):
    daten = request.get_json(silent=True) or {}
    if not isinstance(daten.get("nr"), int):
        return fehler("nr fehlt.")
    return jsonify(_dienst().zug(code, daten.get("token"), daten["nr"], daten.get("daten")))


def lan_adressen():
    """IPv4-Adressen dieses Rechners im lokalen Netz (ohne 127.x)."""
    adressen = set()
    try:  # Trick: UDP-"Verbindung" verrät die Adresse der Standard-Netzwerkkarte, ohne etwas zu senden
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            adressen.add(s.getsockname()[0])
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            adressen.add(info[4][0])
    except OSError:
        pass
    return sorted(a for a in adressen if not a.startswith("127."))


@bp.get("/server")
def server_info():
    port = request.host.rsplit(":", 1)[1] if ":" in request.host else "80"
    return jsonify({"lan_adressen": [f"http://{a}:{port}" for a in lan_adressen()]})
