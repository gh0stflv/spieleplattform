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
    assert ids == ["snake", "memory"]


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
    assert {e["id"] for e in r.json["neue_erfolge"]} == {"allrounder", "gedaechtniskuenstler"}
    profil = eingeloggt.get("/api/profil").json
    assert profil["statistik"]["spiele_gesamt"] == 2
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
