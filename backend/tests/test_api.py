import sqlite3

import database
from app import create_app


def eintragen(client, name, punkte, spiel_id="snake", dauer_s=30):
    return client.post("/api/scores", json={"name": name, "spiel_id": spiel_id, "punkte": punkte, "dauer_s": dauer_s})


def test_spiele(client):
    ids = [s["id"] for s in client.get("/api/spiele").json]
    assert ids == ["snake", "memory", "viergewinnt", "supertictactoe", "dame", "schach", "schiffe", "hangman", "wort5", "blackjack", "spider"]


def test_memory_varianten_eigene_bestenliste(client):
    assert eintragen(client, "anna", 2000, "memory-10", 300).status_code == 201
    assert eintragen(client, "anna", 3001, "memory-10", 300).status_code == 422  # max. 50 Paare × 60
    assert client.get("/api/bestenliste/memory-10").json[0]["punkte"] == 2000
    assert client.get("/api/bestenliste/memory").json == []
    assert eintragen(client, "anna", 250_000, "memory-100", 7200).status_code == 201


def test_keine_konten_mehr(client):
    for pfad in ("/api/login", "/api/registrieren", "/api/logout"):
        assert client.post(pfad, json={}).status_code in (404, 405)
    assert client.get("/api/profil").status_code == 404


def test_score_und_bestenliste(client):
    r = eintragen(client, "  Anna  ", 50)
    assert r.status_code == 201
    assert r.json == {"name": "Anna", "platz": 1}
    eintragen(client, "anna", 30)  # gleicher Name, schlechter: zählt nicht doppelt
    liste = client.get("/api/bestenliste/snake").json
    assert len(liste) == 1 and liste[0]["punkte"] == 50


def test_bestenliste_platz_mehrere(client):
    for name, punkte in [("anna", 40), ("bert", 80), ("cora", 60)]:
        r = eintragen(client, name, punkte)
    assert r.json["platz"] == 2
    assert [z["name"] for z in client.get("/api/bestenliste/snake").json] == ["bert", "cora", "anna"]


def test_name_pflicht(client):
    assert eintragen(client, "", 10).status_code == 422
    assert eintragen(client, "   ", 10).status_code == 422
    assert eintragen(client, None, 10).status_code == 422
    assert eintragen(client, "x" * 21, 10).status_code == 422


def test_plausibilitaet(client):
    def senden(**d):
        return client.post("/api/scores", json={"name": "anna", "spiel_id": "snake", **d}).status_code
    assert senden(punkte=10_000, dauer_s=5) == 422
    assert senden(punkte=-1, dauer_s=5) == 422
    assert senden(punkte="10", dauer_s=5) == 422
    assert senden(punkte=10, dauer_s=0) == 422
    assert eintragen(client, "anna", 1001, "memory", 60).status_code == 422
    assert eintragen(client, "anna", 1, "gibtsnicht", 5).status_code == 422
    assert eintragen(client, "anna", 1, "schach", 60).status_code == 422  # LAN-Spiele ohne Wertung


def test_alte_datenbank_wird_umgestellt(tmp_path):
    pfad = tmp_path / "alt.db"
    alt = sqlite3.connect(pfad)
    alt.executescript("""
        CREATE TABLE benutzer (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE score (id INTEGER PRIMARY KEY, benutzer_id INTEGER, spiel_id TEXT, punkte INTEGER,
                            dauer_s REAL, zeitpunkt TEXT);
        CREATE TABLE spiel (id TEXT PRIMARY KEY, name TEXT NOT NULL, beschreibung TEXT NOT NULL,
                            steuerung TEXT NOT NULL, max_punkte INTEGER, max_punkte_pro_s REAL NOT NULL,
                            min_dauer_s REAL NOT NULL);
        INSERT INTO spiel VALUES ('ssp', 'Schere Stein Papier', '', '', 200, 60, 4);
    """)
    alt.commit()
    alt.close()
    client = create_app({"DATABASE": str(pfad), "TESTING": True}).test_client()
    assert eintragen(client, "anna", 10).status_code == 201
    db = sqlite3.connect(pfad)
    tabellen = {z[0] for z in db.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert "benutzer" not in tabellen
    assert {z[0] for z in db.execute("SELECT id FROM spiel")} == {z[0] for z in database.SPIELE + database.VARIANTEN}
    db.close()


def test_frontend_wird_ausgeliefert(client):
    assert client.get("/").status_code == 200


def test_raum_ablauf(client, app):
    a = client.post("/api/raeume", json={"spiel_id": "viergewinnt", "name": "Ali"})
    assert a.status_code == 201
    code, token_a = a.json["code"], a.json["token"]
    assert a.json["ich"] == 0 and not a.json["voll"]

    zweiter = app.test_client()
    b = zweiter.post(f"/api/raeume/{code.lower()}/beitreten", json={"name": "Bea"})
    assert b.json["ich"] == 1 and b.json["voll"] and b.json["spieler"] == ["Ali", "Bea"]
    assert zweiter.post(f"/api/raeume/{code}/beitreten", json={}).status_code == 409

    assert client.post(f"/api/raeume/{code}/zug", json={"token": token_a, "nr": 0, "daten": {"spalte": 3}}).status_code == 200
    # gleicher Zug-Index nochmal → Konflikt
    assert zweiter.post(f"/api/raeume/{code}/zug", json={"token": b.json["token"], "nr": 0, "daten": {}}).status_code == 409
    assert zweiter.post(f"/api/raeume/{code}/zug", json={"token": "falsch", "nr": 1, "daten": {}}).status_code == 403
    stand = zweiter.get(f"/api/raeume/{code}?seit=0").json
    assert stand["ereignisse"] == [{"nr": 0, "von": 0, "daten": {"spalte": 3}}]
    assert zweiter.get(f"/api/raeume/{code}?seit=1").json["ereignisse"] == []


def test_raum_wieder_eintreten(client, app):
    a = client.post("/api/raeume", json={"spiel_id": "schach", "name": "Ali"}).json
    b = app.test_client().post(f"/api/raeume/{a['code']}/beitreten", json={"name": "Bea"}).json
    client.post(f"/api/raeume/{a['code']}/zug", json={"token": a["token"], "nr": 0, "daten": {"typ": "zug"}})
    # Bea lädt die Seite neu und steigt mit ihrem Token wieder ein: gleicher Platz, alle Ereignisse
    w = app.test_client().post(f"/api/raeume/{a['code']}/wieder", json={"token": b["token"]})
    assert w.status_code == 200 and w.json["ich"] == 1 and w.json["spieler"] == ["Ali", "Bea"]
    assert len(w.json["ereignisse"]) == 1
    assert client.post(f"/api/raeume/{a['code']}/wieder", json={"token": "falsch"}).status_code == 403
    # Verbindungsstatus: wer abfragt, gilt als verbunden
    stand = client.get(f"/api/raeume/{a['code']}?seit=0&token={a['token']}").json
    assert stand["verbunden"] == [True, True]


def test_raum_zufall_vom_server(client):
    a = client.post("/api/raeume", json={"spiel_id": "schach", "name": "Ali", "max_spieler": 3}).json
    assert a["max_spieler"] == 3
    zug = lambda nr, daten: client.post(f"/api/raeume/{a['code']}/zug", json={"token": a["token"], "nr": nr, "daten": daten})
    assert zug(0, {"typ": "karte", "zufall": 5}).status_code == 200
    e = client.get(f"/api/raeume/{a['code']}?seit=0").json["ereignisse"][0]["daten"]
    assert e["typ"] == "karte" and "zufall" not in e and len(e["wuerfe"]) == 5
    assert all(isinstance(w, int) and 0 <= w < 2**31 for w in e["wuerfe"])
    assert zug(1, {"zufall": 31}).status_code == 400
    assert zug(1, {"zufall": "3"}).status_code == 400


def test_raum_unbekannt(client):
    assert client.get("/api/raeume/ZZZZ").status_code == 404
    assert client.post("/api/raeume", json={"spiel_id": "gibtsnicht"}).status_code == 404
