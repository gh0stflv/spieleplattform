def test_registrieren_und_login(client):
    assert client.post("/api/registrieren", json={"name": "anna", "passwort": "geheim123"}).status_code == 201
    assert client.get("/api/ich").json["name"] == "anna"
    client.post("/api/logout")
    assert client.get("/api/ich").json is None
    assert client.post("/api/login", json={"name": "anna", "passwort": "falsch!!!"}).status_code == 401
    assert client.post("/api/login", json={"name": "ANNA", "passwort": "geheim123"}).status_code == 200


def test_registrieren_validierung(client):
    assert client.post("/api/registrieren", json={"name": "anna", "passwort": "kurz"}).status_code == 400
    assert client.post("/api/registrieren", json={"name": "a", "passwort": "geheim123"}).status_code == 400
    client.post("/api/registrieren", json={"name": "anna", "passwort": "geheim123"})
    r = client.post("/api/registrieren", json={"name": "Anna", "passwort": "geheim123"})
    assert r.status_code == 400 and "vergeben" in r.json["fehler"]


def test_passwort_gehasht(app, client):
    client.post("/api/registrieren", json={"name": "anna", "passwort": "geheim123"})
    import sqlite3
    h = sqlite3.connect(app.config["DATABASE"]).execute("SELECT passwort_hash FROM benutzer").fetchone()[0]
    assert "geheim123" not in h


def test_spiele(client):
    ids = [s["id"] for s in client.get("/api/spiele").json]
    assert ids == ["snake", "memory", "viergewinnt", "supertictactoe", "ssp", "dame", "schach"]


def test_score_nur_eingeloggt(client):
    assert client.post("/api/scores", json={"spiel_id": "snake", "punkte": 10, "dauer_s": 5}).status_code == 401


def test_score_und_bestenliste(eingeloggt):
    r = eingeloggt.post("/api/scores", json={"spiel_id": "snake", "punkte": 50, "dauer_s": 20})
    assert r.status_code == 201
    assert r.json["platz"] == 1
    assert {e["id"] for e in r.json["neue_erfolge"]} == {"erste-runde"}
    eingeloggt.post("/api/scores", json={"spiel_id": "snake", "punkte": 30, "dauer_s": 20})
    liste = eingeloggt.get("/api/bestenliste/snake").json
    assert len(liste) == 1 and liste[0]["punkte"] == 50


def test_bestenliste_platz_mehrere(client):
    for name, punkte in [("anna", 40), ("bert", 80), ("cora", 60)]:
        client.post("/api/registrieren", json={"name": name, "passwort": "geheim123"})
        r = client.post("/api/scores", json={"spiel_id": "snake", "punkte": punkte, "dauer_s": 30})
    assert r.json["platz"] == 2
    assert [z["name"] for z in client.get("/api/bestenliste/snake").json] == ["bert", "cora", "anna"]


def test_plausibilitaet(eingeloggt):
    def senden(**d):
        return eingeloggt.post("/api/scores", json={"spiel_id": "snake", **d}).status_code
    assert senden(punkte=10_000, dauer_s=5) == 422
    assert senden(punkte=-1, dauer_s=5) == 422
    assert senden(punkte="10", dauer_s=5) == 422
    assert senden(punkte=10, dauer_s=0) == 422
    assert eingeloggt.post("/api/scores", json={"spiel_id": "memory", "punkte": 1001, "dauer_s": 60}).status_code == 422
    assert eingeloggt.post("/api/scores", json={"spiel_id": "gibtsnicht", "punkte": 1, "dauer_s": 5}).status_code == 422


def test_erfolge_allrounder(eingeloggt):
    eingeloggt.post("/api/scores", json={"spiel_id": "snake", "punkte": 10, "dauer_s": 10})
    r = eingeloggt.post("/api/scores", json={"spiel_id": "memory", "punkte": 900, "dauer_s": 30})
    assert {e["id"] for e in r.json["neue_erfolge"]} == {"gedaechtniskuenstler"}
    for spiel in ("viergewinnt", "supertictactoe", "ssp", "dame"):
        r = eingeloggt.post("/api/scores", json={"spiel_id": spiel, "punkte": 0, "dauer_s": 30})
    assert {e["id"] for e in r.json["neue_erfolge"]} == {"allrounder"}
    profil = eingeloggt.get("/api/profil").json
    assert profil["statistik"]["spiele_gesamt"] == 6
    assert sum(e["erreicht"] for e in profil["erfolge"]) == 3


def test_konto_loeschen(app, eingeloggt):
    eingeloggt.post("/api/scores", json={"spiel_id": "snake", "punkte": 10, "dauer_s": 10})
    assert eingeloggt.delete("/api/konto").status_code == 200
    assert eingeloggt.get("/api/ich").json is None
    import sqlite3
    db = sqlite3.connect(app.config["DATABASE"])
    for tabelle in ("benutzer", "score", "benutzer_erfolg"):
        assert db.execute(f"SELECT COUNT(*) FROM {tabelle}").fetchone()[0] == 0


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


def test_raum_unbekannt(client):
    assert client.get("/api/raeume/ZZZZ").status_code == 404
    assert client.post("/api/raeume", json={"spiel_id": "gibtsnicht"}).status_code == 404
