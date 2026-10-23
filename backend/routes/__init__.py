from functools import wraps

from flask import jsonify, session


def fehler(nachricht, status=400):
    return jsonify({"fehler": nachricht}), status


def login_noetig(funktion):
    @wraps(funktion)
    def wrapper(*args, **kwargs):
        if "benutzer_id" not in session:
            return fehler("Bitte zuerst einloggen.", 401)
        return funktion(*args, **kwargs)
    return wrapper
