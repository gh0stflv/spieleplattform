from flask import jsonify


def fehler(nachricht, status=400):
    return jsonify({"fehler": nachricht}), status
