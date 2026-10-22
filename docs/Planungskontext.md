# LF12a Spieleplattform – Kontext für Claude Code

> Diese Datei fasst einen Planungs-Chat zusammen (19.–22.10.2026), damit Claude Code nahtlos weiterarbeiten kann.
> Empfehlung: im Projektordner als `CLAUDE.md` ablegen oder zu Beginn einlesen lassen.

---

## 0. Arbeitsweise mit Claude (wichtig)
- Das ist eine **bewertete Schulprojektarbeit**. Laut Lernfeld gilt fremder (auch leicht abgeänderter) Code als **Plagiat → Note 6**; 50 % der Note sind Präsentation + Auswertungsgespräch, in dem das Team seinen Code erklären muss.
- Deshalb: Claude **erklärt, plant, reviewt, debuggt und liefert Gerüste/Boilerplate** – die eigentliche Projektlogik (Spiele, Klassen, API-Logik) und die Doku-Texte schreibt das Team selbst.
- Übernommener Code (auch aus dem Beispielprojekt) wird im Quelltext mit Quelle gekennzeichnet.
- Antworten bitte auf **Deutsch**, kompakt und visuell strukturiert (Tabellen, Listen, Checklisten).

---

## 1. Rahmen: Lernfeld 12a
**Kurs:** 2026/27 12ITAB LF12a – Kundenspezifische Anwendungsentwicklung durchführen (BSZN-Moodle)

| Vorgabe | Inhalt |
|---|---|
| Projekt | Schuljahresbegleitend, frei wählbar, **nicht aus dem Betrieb** |
| Team | 2er- oder 3er-Gruppe (Einzelarbeit nur Ausnahme), verbindliche Gruppenwahl in Moodle |
| Paradigma | **Objektorientiert** (Java, JS, Python, C++, C# …), IDE/Libraries frei |
| GUI | **Pflicht**, wichtiger Bestandteil |
| Vorgehen | **Agil mit Scrum** – Jira (Atlassian-Account) + git |
| Perspektive | Immer wieder Nutzerperspektive einnehmen, Freunde testen lassen |

### Phasen
| Phase | Inhalt | Ziele |
|---|---|---|
| 1 Produktidee | Idee mit GUI; Anforderungen, Nutzen, Architektur (Front-/Back-End, DB), Datenschutz, Schulungsbedarf | Idee, Probleme/Schlüsselstellen, Team-Kompetenzen, Prozess dokumentieren |
| 2 Planung | Ist-Analyse → Soll (Lastenheft/Product Backlog), Swimlane, eEPK, User Stories mit Akzeptanzkriterien, Jira | Backlog, Rollen, Sprints, Zeitplan, ≥1 User Story |
| 3 Modellierung | UML, mind. ein ausführliches Klassendiagramm (Attribute, Methoden, Schnittstellen) | → **Ende Milestone 1** (Note 1. HJ) |
| 4 Implementierung | Lauffähige Version, Perspektivwechsel Entwickler/User | Software, Schulungsbedarf, ggf. neue User Stories |
| 5 Auswertung | Soll/Ist-Vergleich, Handlungsbedarf, exemplarisches Schulungsmaterial | → **Ende Milestone 2** (Note 2. HJ) |

### Bewertung (je Halbjahr)
| Teil | Anteil |
|---|---|
| Projektdokumentation (2. HJ: + Software) | 40 % |
| Scrum-Board (Jira) | 10 % |
| Präsentation | 25 % |
| Auswertungsgespräch | 25 % |
- Arbeitsverhalten kann Note um eine Stufe verändern.
- Quellen angeben, Rechtschreibung, angemessene Sprache.
- ⚠️ PDF „Leistungsnachweis“ nennt abweichend 50 % Präsentation+Fachgespräch / 50 % Doku → **bei Lehrkraft klären**.
- Deadline-Tabelle in Moodle war noch leer (Stand 19.10.).

### Checkliste Milestone 1
- [ ] Doku begonnen (Inhaltsverzeichnis, Kapitel)
- [ ] Ideenfindung (~0,5 Seiten)
- [ ] Erwartete Probleme/Schlüsselstellen
- [ ] Zuständigkeiten im Team
- [ ] Product Backlog mit allen Basis-Features in Jira
- [ ] Erster Sprint geplant
- [ ] Zeitlicher Ablauf als Timeline mit Abhängigkeiten in Jira
- [ ] ≥1 User Story in Jira
- [ ] UML-Klassendiagramm (inkl. Aggregationen, Assoziationen, Attribute, Methoden) in der Doku
- [ ] PowerPoint zum Arbeitsstand für ein fiktives Meeting

### Checkliste Milestone 2
- [ ] Doku fertig
- [ ] Entwicklungsprozess in Grundzügen (konkrete Schritte, **kein Code**, max. 1 Seite)
- [ ] Probleme + Lösungen
- [ ] Ist/Soll-Vergleich (Min./Max.-Ziele erreicht? Warum?)
- [ ] Geänderte Zuständigkeiten
- [ ] Schulungsbedarf („Was muss besonders erklärt werden?“, max. 0,5 S.)
- [ ] Schulungsmaterial (Kundendoku) eingefügt
- [ ] Jira: Backlog, Timeline, Zuständigkeiten aktualisiert; ≥1 User Story
- [ ] Lauffähige Version hochgeladen (große Projekte: Abgabeform absprechen)
- [ ] PowerPoint fürs fiktive Meeting (Züge 1+2: kein Upload nötig)

### Input „User Stories“ (Moodle-Folien)
- Schema: **Als** ‹Rolle› **möchte ich** ‹Aktion›, **damit** ‹Nutzen›.
- Aus Nutzersicht, spezifisch, kurz; Wer/Was/Wieso.
- Akzeptanzkriterien: funktional (was?) und nicht-funktional (wie? Performance, Zuverlässigkeit, Usability).
- Funktionale Anforderungen: **Muss** / **Kann** / **Abgrenzung** (Darf nicht).

### Scrum-Material im Kurs
Scrum Guide 2016 (deutsch), „Scrum auf dem Bierdeckel“. Rollen: Product Owner, Scrum Master, Entwicklungsteam. Artefakte: Product Backlog, Sprint Backlog, Inkrement. Events: Sprint, Planning, Daily, Review, Retro.

---

## 2. Entscheidungsweg (Ideenfindung – für Doku-Kapitel nutzbar)
1. Erste Richtung: Python, Themen Alltag/Organisation + Schule/Ausbildung.
2. Verworfen: Berichtsheft-Manager, Planer aller Art → „gibt es schon online, nicht besonders genug“.
3. Interessant: Resteküche mit Barcode-Scan → weiterentwickelt zu **Monats-Kochplaner** (Rezepte wählen → Zutaten zusammenführen → Einkaufsliste mit Packungsgrößen/Rest-Tipps). Preisschätzung bewusst gestrichen (keine verlässliche kostenlose Preis-API).
4. **Finale Entscheidung: Spieleplattform als Web-App.**
5. Team: Stand 22.10. **noch nicht festgelegt**.

---

## 3. Projektkonzept: Spieleplattform (Web-App)

### Vision
Browserbasierte Plattform: registrieren, im Launcher Spiel wählen, im Browser spielen, über Bestenlisten/Statistiken/Erfolge vergleichen. **Erweiterbare Architektur:** neue Spiele über gemeinsame Basisklasse `Spiel`, ohne die Plattform zu ändern.

### Tech-Stack
| Schicht | Technologie |
|---|---|
| Frontend | HTML/CSS + **ES6-Klassen**, Spiele mit **Canvas API** |
| Backend | **Python + Flask** (Services als Klassen) |
| DB | **SQLite** |
| Sicherheit | Passwort-Hash (werkzeug/bcrypt), Session-Cookies |
| Tools | git/GitHub, Jira, VS Code, draw.io/PlantUML |
Alternative: Node.js + Express + TypeScript.

### Architektur
```
Browser (Login, Launcher, Spiele/Canvas, ApiClient) ⇄ JSON ⇄ Flask (REST-API, Auth-/Score-/AchievementService) → SQLite
```

### Ordnerstruktur
```
spieleplattform/
├── backend/  app.py · database.py · models/ · services/ · routes/
├── frontend/ *.html · css/ · js/core/(Spiel, GameLoop, Eingabe, ApiClient) · js/games/(snake, memory, …)
├── docs/     Doku, UML, Swimlane, eEPK
└── README.md
```

### Klassenmodell
**Frontend:** `Spiel` (abstrakt: starten, beenden, update(dt), zeichnen(), verarbeiteEingabe) → `Snake`, `Memory`, …; `Spielobjekt` (abstrakt) → `Schlange`, `Futter`, `Karte`, …; `GameLoop`, `Eingabe`, `ApiClient`, `Launcher`.
**Backend:** `Benutzer`, `SpielInfo`, `Score`, `Erfolg` (abstrakt: istErfuellt) → `PunkteErfolg`, `AnzahlErfolg`, `VielfaltErfolg`; `Statistik`; `AuthService`, `ScoreService`, `AchievementService`.

### Datenbank
| Tabelle | Spalten |
|---|---|
| benutzer | id PK, name UNIQUE, email UNIQUE, passwort_hash, erstellt_am |
| spiel | id PK, name, beschreibung, steuerung |
| score | id PK, benutzer_id FK, spiel_id FK, punkte, dauer_s, zeitpunkt |
| erfolg | id PK, name, beschreibung, typ, schwellwert, spiel_id FK NULL |
| benutzer_erfolg | benutzer_id FK, erfolg_id FK, erreicht_am |

### REST-API
| Methode | Pfad | Zweck |
|---|---|---|
| POST | /api/registrieren | Konto anlegen |
| POST | /api/login, /api/logout | Session |
| GET | /api/spiele | Spieleliste |
| POST | /api/scores | Ergebnis speichern (eingeloggt) |
| GET | /api/bestenliste/{spiel} | Top 10 |
| GET | /api/profil | Statistik + Erfolge |
| DELETE | /api/konto | Konto + Daten löschen (DSGVO) |

### Anforderungen
- **Muss:** Registrierung/Login/Logout (Hash), Launcher, **2 Spiele (Vorschlag Snake + Memory)**, Score speichern, Bestenliste, REST-API, SQLite
- **Kann:** weitere Spiele (Pong, Tetris, IT-Quiz), Erfolge, Profil/Statistik, Gast-Modus, Dark Mode, Einstellungen, Touch, Anti-Cheat-Plausibilitätsprüfung
- **Abgrenzung:** kein Echtzeit-Online-Multiplayer, keine Zahlungen/Werbung, kein öffentliches Hosting, kein Store für Fremdspiele
- **Nicht-funktional:** aktuelle Browser, ~60 FPS, selbsterklärend, Passwörter nie im Klartext

### User Stories (Start)
1. Als neuer Spieler möchte ich ein Konto anlegen, damit meine Highscores gespeichert werden. — AK: Name+Passwort Pflicht, Name eindeutig, Passwort ≥ 8, Fehlermeldung bei Dopplung.
2. Als Spieler möchte ich im Launcher alle Spiele mit Beschreibung sehen, damit ich schnell eins wähle. — AK: Kachel je Spiel, Klick startet, Steuerung sichtbar.
3. Als Spieler möchte ich nach dem Spiel meinen Platz in der Bestenliste sehen, damit ich mich vergleichen kann. — AK: Top 10, eigener Eintrag hervorgehoben, sofort aktualisiert.
4. Als Spieler möchte ich mein Konto löschen, damit meine Daten nicht gespeichert bleiben. — AK: Sicherheitsabfrage, alle Scores/Erfolge gelöscht.
5. (Kann) Als Gelegenheitsspieler möchte ich ohne Konto spielen, damit ich die Plattform testen kann.

### Jira-Epics
E1 Grundgerüst · E2 Benutzerverwaltung · E3 Spiel-Framework · E4 Snake · E5 Memory · E6 Scores & Bestenliste · E7 Erfolge & Profil · E8 Doku & Schulung

### Sprintplan (2-Wochen-Sprints, Daten an Moodle-Deadlines anpassen)
| Sprint | MS | Ziel |
|---|---|---|
| S1 | 1 | Team, Ideenfindung, Probleme, Zuständigkeiten, Doku-Gerüst |
| S2 | 1 | Ist-Analyse, Backlog, User Stories, Swimlane/eEPK, Jira |
| S3 | 1 | UML (Front+Back), DB-Entwurf, Timeline mit Abhängigkeiten |
| S4 | 1 | (opt.) Prototyp, Präsentation |
| S5 | 2 | Flask, DB, Login |
| S6 | 2 | Spiel-Framework + Launcher |
| S7 | 2 | Snake + Scores |
| S8 | 2 | Memory + Bestenliste |
| S9 | 2 | Kann-Features, Bugfixing, Tests mit Mitschülern |
| S10 | 2 | Schulungsmaterial, Soll/Ist, Doku, Präsentation |

### Rollen
Product Owner · Scrum Master · Backend · Frontend/Spiele · (Doku/Test). Faustregel: jede Person verantwortet ein Spiel + einen Plattformteil.

### Erwartete Probleme
| Problem | Lösung |
|---|---|
| Scope-Creep | Muss = 2 einfache Spiele |
| Score-Manipulation | Nur eingeloggt speichern, serverseitige Plausibilität (Punkte/Sekunde) |
| Einheitliche Spiel-Schnittstelle | Basisklasse `Spiel` früh festlegen |
| Zwei Sprachen | JSON-Formate der API dokumentieren |
| Merge-Konflikte | Feature-Branches, kleine Commits, PRs |
| Plagiat | Selbst schreiben, Quellen angeben |

### Datenschutz
Datensparsamkeit (Name, opt. E-Mail, Hash, Scores) · Hashing · Bestenliste nur Pseudonym · Konto-Löschung (Art. 17 DSGVO) · technisch notwendiges Session-Cookie · lokaler Betrieb, keine Weitergabe.

### Schulungsbedarf
Konto anlegen, Spiel starten, Steuerung, Bestenliste/Profil, Konto löschen → Hilfe-Seite, 1-seitige Kurzanleitung mit Screenshots, Steuerungs-Overlay.

### Doku-Gliederung
1 Einleitung & Ideenfindung · 2 Team & Rollen · 3 Ist/Soll · 4 Anforderungen · 5 User Stories · 6 Swimlane/eEPK · 7 Architektur & Stack · 8 UML & DB-Modell · 9 Planung (Sprints, Jira) · 10 Probleme & Datenschutz — MS2: 11 Entwicklungsprozess · 12 Probleme & Lösungen · 13 Soll/Ist · 14 Schulung · 15 Fazit & Quellen

---

## 4. Beispielprojekt (Lernvorlage, existiert als `beispielprojekt.zip`)
Mini-Plattform zum Nachschlagen – **nicht** die Abgabe. Getestet: Registrieren, Score speichern, Anti-Cheat-Ablehnung, Konto löschen mit Cascade.

| Datei | Zeigt |
|---|---|
| `frontend/js/core/Spiel.js` | Abstrakte Klasse `Spiel` + `Spielobjekt`, Zustände |
| `frontend/js/core/GameLoop.js` | requestAnimationFrame, Delta-Zeit |
| `frontend/js/core/ApiClient.js` | fetch/JSON, private Methode |
| `frontend/js/games/Zielscheibe.js` | Beispielspiel (Kreise anklicken, 20 s) |
| `frontend/js/main.js` | Klasse `Plattform`: Launcher, Events, Bestenliste, Erfolge |
| `backend/app.py` | Flask-Routen, Session, `login_noetig`-Decorator |
| `backend/services.py` | `AuthService` (Hash), `ScoreService` (Plausibilität, Bestenliste, Erfolge) |
| `backend/models.py` | `Erfolg` (ABC) → `PunkteErfolg`, `AnzahlErfolg` |
| `backend/database.py` | SQLite-Schema, FK, ON DELETE CASCADE |
Start: `pip install -r requirements.txt` → `cd backend` → `python app.py` → http://127.0.0.1:5000
Vor öffentlicher Freigabe: `debug=True` entfernen, `SECRET_KEY` setzen, `.gitignore` (plattform.db, __pycache__/, .venv/).

---

## 5. Offene Punkte / nächste Schritte
- [ ] Team finden und in Moodle eintragen
- [ ] Spieleauswahl bestätigen (Snake + Memory?)
- [ ] Projektname
- [ ] Moodle-Deadlines in Sprintplan übertragen
- [ ] Gewichtung bei Lehrkraft klären
- [ ] GitHub-Repo (privat) + Jira-Projekt anlegen
- [ ] **Nächster Schritt:** Ideenfindung (0,5 S.) selbst schreiben → Claude gibt Feedback
