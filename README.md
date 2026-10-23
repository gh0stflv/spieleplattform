# Spieleplattform (Arbeitstitel)

Browserbasierte Spieleplattform: im Launcher ein Spiel wählen, im Browser spielen und sich mit seinem Namen in die Bestenliste eintragen. Es gibt keine Konten und kein Login, alle spielen einfach los.

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

Dann im Browser http://127.0.0.1:5000 öffnen. Die Datenbank `backend/plattform.db` wird beim ersten Start automatisch angelegt. Eine ältere Datenbank mit Benutzerkonten wird dabei umgestellt (alte Konten und Ergebnisse werden gelöscht).

### Zusammen im Netzwerk (LAN) spielen

1. Einer startet den Server wie oben. Im Terminal steht dann zusätzlich eine Zeile `Im Netzwerk (LAN): http://192.168.x.y:5000`.
2. Windows fragt beim ersten Start, ob Python im Netzwerk erlaubt sein soll: **„Private Netzwerke“ zulassen**.
3. Alle anderen öffnen im selben WLAN/LAN genau diese Adresse im Browser.
4. Spiel wählen → „Im Netzwerk (LAN) spielen“ → einer erstellt einen Raum, die anderen treten mit dem 4-stelligen Code bei.

Räume liegen nur im Arbeitsspeicher. Wird der Server neu gestartet, sind sie weg. Wer im Spiel die Seite neu lädt oder kurz die Verbindung verliert, steigt automatisch wieder an derselben Stelle ein (der Platz wird im Tab gemerkt, alle Züge werden erneut abgespielt). Die anderen sehen so lange einen Hinweis unter dem Spielfeld. Wer nur lokal spielen will, startet mit `HOST=127.0.0.1 python app.py` (Windows PowerShell: `$env:HOST="127.0.0.1"; python app.py`).

Tests: `cd backend && python -m pytest`

## Funktionen

- Launcher mit Spielkacheln, Steuerung wird vor dem Start angezeigt
- **Snake** (Tastatur oder Wischen)
- **Memory** (Maus oder Touch) in 4 × 4, 10 × 10, 15 × 14, 20 × 20, 25 × 24 und 100 × 100, jedes Paar mit eigenem Symbol. Ab 15 × 14 mit Zoom (Mausrad, + / −, Knöpfe) und Verschieben (ziehen, Pfeiltasten). Jede Größe hat ihre eigene Bestenliste (in der Datenbank als Varianten `memory-10` usw.)
- **Vier gewinnt**, **Super Tic-Tac-Toe** und **Dame**: gegen den Computer (3 Stufen), zu zweit an einem Gerät oder im LAN
- **Schach**: nur im LAN, volle Regeln (Rochade, en passant, Umwandlung, Remisregeln), Schachuhr, Remis anbieten, Aufgeben, Zugliste
- **Hangman**: allein mit Wortlisten in Deutsch oder Englisch (7 Kategorien) mit Bestenliste, oder zu zweit im LAN: einer tippt ein Wort (plus optionalen Tipp), der andere rät, nach jeder Runde wird gewechselt
- **5 Buchstaben**: Wort mit 5 Buchstaben in 6 Versuchen erraten, Deutsch oder Englisch. Tageswort (für alle gleich, einmal pro Tag, mit Statistik und Serie im Browser) oder Endlos mit Bestenliste je Sprache
- **Blackjack**: allein gegen die Bank (Start 1000 Chips, „Auszahlen“ trägt das Guthaben in die Bestenliste ein) oder am LAN-Tisch mit 2–6 Leuten. Verdoppeln, Teilen (bis 4 Hände), Versicherung; Blackjack zahlt 3:2, Bank steht ab 17
- **Spider-Solitaire**: 1, 2 oder 4 Farben mit je eigener Bestenliste (`spider`, `spider-2`, `spider-4`). Klassische Punkte (Start 500, −1 pro Zug, +100 pro fertiger Reihe), Rückgängig, Hinweis; Karte anklicken zieht automatisch, Ziehen und Ablegen geht auch. Nur gewonnene Spiele kommen in die Bestenliste
- **Schiffe versenken**: nur im LAN, Regeln „Klassisch“ und „Deutsche Variante“ oder eigene Regeln über das Zahnrad (Feldgröße, Anzahl je Schiffstyp, nochmal nach Treffer, Berührung erlaubt). Schiffe selbst setzen oder zufällig verteilen
- Mehrspieler im lokalen Netzwerk über Räume mit Code
- Bestenliste (Top 10 pro Spiel): nach dem Spiel Namen eingeben und eintragen, der eigene Eintrag wird hervorgehoben
- Serverseitige Plausibilitätsprüfung der Punkte (Anti-Cheat)

## Aufbau

```
backend/
  app.py              Flask-App, liefert auch das Frontend aus
  database.py         SQLite-Schema, Spiele als Startdaten
  services/           ScoreService (Bestenliste), RaumService (LAN-Räume)
  routes/             REST-API unter /api/...
  tests/              pytest
frontend/
  launcher.html       die einzige Seite (index.html leitet dorthin weiter)
  css/stil.css
  js/core/            Spiel + Spielobjekt (abstrakt), RundenSpiel (Basis für 2-Personen-Spiele),
                      GameLoop, Eingabe, ApiClient, Raum (LAN)
  js/games/           snake/, memory/, viergewinnt/, supertictactoe/, dame/,
                      schach/ (Regeln.js = Schachregeln ohne Oberfläche),
                      schiffe/ (Flotte.js = Regeln und Aufstellung ohne Oberfläche),
                      hangman/ und wort5/ (je woerter.js = Wortlisten DE/EN), index.js (Registry)
  js/Launcher.js      Spielauswahl, Overlay, Bestenliste nach dem Spiel
docs/                 Konzept und Planung
```

### REST-API

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/spiele` | Spieleliste |
| POST | `/api/scores` | Ergebnis speichern (`name`, `spiel_id`, `punkte`, `dauer_s`) |
| GET | `/api/bestenliste/<spiel_id>` | Top 10 |
| POST | `/api/raeume` | LAN-Raum erstellen (`spiel_id`, optional `max_spieler`, `name`) |
| POST | `/api/raeume/<code>/beitreten` | Raum beitreten |
| POST | `/api/raeume/<code>/wieder` | Nach dem Neuladen denselben Platz wieder einnehmen (`token`) |
| GET | `/api/raeume/<code>?seit=n&token=…` | Mitspieler, wer verbunden ist, Ereignisse ab Nummer n |
| POST | `/api/raeume/<code>/zug` | Ereignis senden (`token`, `nr`, `daten`). Mit `daten.zufall = n` hängt der Server n Zufallszahlen als `wuerfe` an |
| GET | `/api/server` | LAN-Adressen dieses Servers |

## Neues Spiel hinzufügen

1. `frontend/js/games/<name>/<Name>.js` anlegen: Klasse erbt von `Spiel` und implementiert `zuruecksetzen()`, `update(dt)`, `zeichnen()` sowie je nach Steuerung `verarbeiteEingabe(taste)`, `verarbeiteKlick(x, y)` oder `verarbeiteWischen(richtung)`. Für Ziehen und Ablegen gibt es `verarbeiteDruck(x, y)`, `verarbeiteZiehen(dx, dy)` und `verarbeiteLoslassen(x, y)`. Kartenspiele zeichnen Karten mit `zeichneKarte()` aus `games/karten.js`. Punkte mit `addierePunkte()` vergeben, Spielende mit `beenden()`.
2. In `frontend/js/games/index.js` eintragen.
3. In `backend/database.py` unter `SPIELE` eine Zeile ergänzen, mit Grenzwerten für die Plausibilitätsprüfung.
4. Optional eine Kachel-Grafik `.kachel-<id>` in `css/stil.css`.

**Brettspiele für 2 Personen:** Von `RundenSpiel` erben. Dann gibt es Computer (3 Stufen), 2 Spieler an einem Gerät und LAN automatisch. Zu implementieren sind nur `zugErlaubt`, `zugAnwenden`, `ergebnis`, `botZug` und `zeichnen`. Ein Mausklick ruft `this.ziehe(zug)` auf. Vorlage: `games/supertictactoe/`.

**Zufall im LAN:** Karten ziehen oder würfeln nie mit vorher bekanntem Startwert, sondern `this.raum.senden({ typ: "karte", zufall: 3 })` schicken: Das Ereignis kommt bei allen mit denselben `daten.wuerfe` (3 Zufallszahlen vom Server) an. **Spielerzahl:** `static lanSpieler = { min: 2, max: 6 }` lässt den Ersteller die Größe des Raums wählen.

**Modi und LAN:** Mit `static modi = [{ id, name }, …]` bekommt das Spiel mehrere Startknöpfe (z. B. Schwierigkeit). Ein Modus mit `lan: true` öffnet die Raum-Auswahl. Im LAN-Spiel ist `this.raum` gesetzt (`raum.ich` = eigene Spielernummer, `raum.seed` für gemeinsamen Zufall). Eigene Züge mit `this.raum.senden({ typ: "zug", … })` schicken und erst in `empfangeEreignis({ von, daten })` anwenden: Dort kommen alle Züge, auch die eigenen, in derselben Reihenfolge an. Mit `get gewertet()` steuert das Spiel, ob das Ergebnis in die Bestenliste kommt.

## Arbeitsweise (git)

- `main` bleibt lauffähig, gearbeitet wird auf Branches, z. B. `feature/SCRUM-14-launcher`
- Jira-Key in die Commit-Nachricht schreiben (`SCRUM-14 Kacheln sortiert`), dann verknüpft Jira die Commits
- Pull Request, kurz von jemand anderem anschauen lassen, dann mergen
