# Spieleplattform (Arbeitstitel)

Browserbasierte Spieleplattform: registrieren, im Launcher ein Spiel wählen, im Browser spielen, Bestenlisten vergleichen und Erfolge sammeln.

Ursprünglich als Schulprojekt (LF12a) geplant, jetzt ein privates Projekt. Konzept und Planung liegen in `docs/`.

## Starten

Voraussetzung: Python 3.10 oder neuer.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate   ·   Linux/macOS: source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
python app.py
```

Dann im Browser http://127.0.0.1:5000 öffnen. Die Datenbank `backend/plattform.db` wird beim ersten Start automatisch angelegt.

### Zusammen im Netzwerk (LAN) spielen

1. Einer startet den Server wie oben. Im Terminal steht dann zusätzlich eine Zeile `Im Netzwerk (LAN): http://192.168.x.y:5000`.
2. Windows fragt beim ersten Start, ob Python im Netzwerk erlaubt sein soll: **„Private Netzwerke“ zulassen**.
3. Alle anderen öffnen im selben WLAN/LAN genau diese Adresse im Browser.
4. Spiel wählen → „Im Netzwerk (LAN) spielen“ → einer erstellt einen Raum, die anderen treten mit dem 4-stelligen Code bei.

Räume liegen nur im Arbeitsspeicher. Wird der Server neu gestartet, sind sie weg. Wer nur lokal spielen will, startet mit `HOST=127.0.0.1 python app.py` (Windows PowerShell: `$env:HOST="127.0.0.1"; python app.py`).

Tests: `cd backend && python -m pytest`

## Funktionen

- Registrierung, Login, Logout (Passwörter gehasht, Session-Cookie)
- Gast-Modus: spielen ohne Konto, Ergebnisse werden dann nicht gespeichert
- Launcher mit Spielkacheln, Steuerung wird vor dem Start angezeigt
- **Snake** (Tastatur oder Wischen) und **Memory** (Maus oder Touch)
- **Vier gewinnt**, **Super Tic-Tac-Toe** und **Dame**: gegen den Computer (3 Stufen), zu zweit an einem Gerät oder im LAN
- **Schere Stein Papier**: gegen einen lernenden Computer oder im LAN
- **Schiffe versenken**: gegen den Computer (3 Stufen) oder im LAN
- Mehrspieler im lokalen Netzwerk über Räume mit Code
- Bestenliste (Top 10 pro Spiel, eigener Eintrag hervorgehoben)
- Erfolge und Profilseite mit Statistik
- Konto löschen inklusive aller Daten
- Serverseitige Plausibilitätsprüfung der Punkte (Anti-Cheat)

## Aufbau

```
backend/
  app.py              Flask-App, liefert auch das Frontend aus
  database.py         SQLite-Schema, Spiele und Erfolge als Startdaten
  models/             Benutzer, Statistik, Erfolg (abstrakt) → PunkteErfolg, AnzahlErfolg, VielfaltErfolg
  services/           AuthService, ScoreService, AchievementService, RaumService (LAN-Räume)
  routes/             REST-API unter /api/...
  tests/              pytest
frontend/
  launcher.html, login.html, profil.html
  css/stil.css
  js/core/            Spiel + Spielobjekt (abstrakt), RundenSpiel (Basis für 2-Personen-Spiele),
                      GameLoop, Eingabe, ApiClient, Raum (LAN)
  js/games/           snake/, memory/, viergewinnt/, supertictactoe/, dame/, ssp/, schiffe/, index.js (Registry)
  js/Launcher.js      Spielauswahl, Overlay, Bestenliste nach dem Spiel
docs/                 Konzept und Planung
```

### REST-API

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/api/registrieren` | Konto anlegen (`name`, `passwort`, optional `email`) |
| POST | `/api/login` · `/api/logout` | Session |
| GET | `/api/ich` | Eingeloggter Benutzer oder `null` |
| GET | `/api/spiele` | Spieleliste |
| POST | `/api/scores` | Ergebnis speichern (`spiel_id`, `punkte`, `dauer_s`), nur eingeloggt |
| GET | `/api/bestenliste/<spiel_id>` | Top 10 |
| GET | `/api/profil` | Statistik und Erfolge |
| DELETE | `/api/konto` | Konto und alle Daten löschen |
| POST | `/api/raeume` | LAN-Raum erstellen (`spiel_id`, optional `max_spieler`, `name`) |
| POST | `/api/raeume/<code>/beitreten` | Raum beitreten |
| GET | `/api/raeume/<code>?seit=n` | Mitspieler und Ereignisse ab Nummer n |
| POST | `/api/raeume/<code>/zug` | Ereignis senden (`token`, `nr`, `daten`) |
| GET | `/api/server` | LAN-Adressen dieses Servers |

## Neues Spiel hinzufügen

1. `frontend/js/games/<name>/<Name>.js` anlegen: Klasse erbt von `Spiel` und implementiert `zuruecksetzen()`, `update(dt)`, `zeichnen()` sowie je nach Steuerung `verarbeiteEingabe(taste)`, `verarbeiteKlick(x, y)` oder `verarbeiteWischen(richtung)`. Punkte mit `addierePunkte()` vergeben, Spielende mit `beenden()`.
2. In `frontend/js/games/index.js` eintragen.
3. In `backend/database.py` unter `SPIELE` eine Zeile ergänzen, mit Grenzwerten für die Plausibilitätsprüfung.
4. Optional eine Kachel-Grafik `.kachel-<id>` in `css/stil.css`.

**Brettspiele für 2 Personen:** Von `RundenSpiel` erben. Dann gibt es Computer (3 Stufen), 2 Spieler an einem Gerät und LAN automatisch. Zu implementieren sind nur `zugErlaubt`, `zugAnwenden`, `ergebnis`, `botZug` und `zeichnen`. Ein Mausklick ruft `this.ziehe(zug)` auf. Vorlage: `games/supertictactoe/`.

**Modi und LAN:** Mit `static modi = [{ id, name }, …]` bekommt das Spiel mehrere Startknöpfe (z. B. Schwierigkeit). Ein Modus mit `lan: true` öffnet die Raum-Auswahl. Im LAN-Spiel ist `this.raum` gesetzt (`raum.ich` = eigene Spielernummer, `raum.seed` für gemeinsamen Zufall). Eigene Züge mit `this.raum.senden({ typ: "zug", … })` schicken und erst in `empfangeEreignis({ von, daten })` anwenden: Dort kommen alle Züge, auch die eigenen, in derselben Reihenfolge an. Mit `get gewertet()` steuert das Spiel, ob das Ergebnis in die Bestenliste kommt.

## Arbeitsweise (git)

- `main` bleibt lauffähig, gearbeitet wird auf Branches, z. B. `feature/SCRUM-14-launcher`
- Jira-Key in die Commit-Nachricht schreiben (`SCRUM-14 Kacheln sortiert`), dann verknüpft Jira die Commits
- Pull Request, kurz von jemand anderem anschauen lassen, dann mergen
