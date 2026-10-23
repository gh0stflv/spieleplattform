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

Tests: `cd backend && python -m pytest`

## Funktionen

- Registrierung, Login, Logout (Passwörter gehasht, Session-Cookie)
- Gast-Modus: spielen ohne Konto, Ergebnisse werden dann nicht gespeichert
- Launcher mit Spielkacheln, Steuerung wird vor dem Start angezeigt
- **Snake** (Tastatur oder Wischen) und **Memory** (Maus oder Touch)
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
  services/           AuthService, ScoreService, AchievementService
  routes/             REST-API unter /api/...
  tests/              pytest
frontend/
  launcher.html, login.html, profil.html
  css/stil.css
  js/core/            Spiel + Spielobjekt (abstrakt), GameLoop, Eingabe, ApiClient
  js/games/           snake/, memory/, index.js (Registry)
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

## Neues Spiel hinzufügen

1. `frontend/js/games/<name>/<Name>.js` anlegen: Klasse erbt von `Spiel` und implementiert `zuruecksetzen()`, `update(dt)`, `zeichnen()` sowie je nach Steuerung `verarbeiteEingabe(taste)`, `verarbeiteKlick(x, y)` oder `verarbeiteWischen(richtung)`. Punkte mit `addierePunkte()` vergeben, Spielende mit `beenden()`.
2. In `frontend/js/games/index.js` eintragen.
3. In `backend/database.py` unter `SPIELE` eine Zeile ergänzen, mit Grenzwerten für die Plausibilitätsprüfung.
4. Optional eine Kachel-Grafik `.kachel-<id>` in `css/stil.css`.

## Arbeitsweise (git)

- `main` bleibt lauffähig, gearbeitet wird auf Branches, z. B. `feature/SCRUM-14-launcher`
- Jira-Key in die Commit-Nachricht schreiben (`SCRUM-14 Kacheln sortiert`), dann verknüpft Jira die Commits
- Pull Request, kurz von jemand anderem anschauen lassen, dann mergen
