# LF12a – Spieleplattform (Web-App)
Projektkonzept & Umsetzungsplan · Stand: 22.10.2026

> Kontext für Claude: Schuljahresprojekt LF12a „Kundenspezifische Anwendungsentwicklung durchführen“ (BSZN, Klasse 12ITAB).
> Vorgaben: objektorientiert, GUI zentral, agil mit Scrum (Jira + git), 2er/3er-Team, keine Betriebsprojekte.
> Bewertung je Halbjahr: Doku 40 % · Scrum-Board 10 % · Präsentation 25 % · Auswertungsgespräch 25 %.
> Milestone 1 (1. HJ) = Phase 1–3 (Idee, Planung, UML) · Milestone 2 (2. HJ) = Phase 4–5 (Implementierung, Auswertung/Schulung).

---

## 1. Vision
Eine browserbasierte Spieleplattform: Nutzer registrieren sich, wählen im Launcher ein Spiel, spielen direkt im Browser und vergleichen sich über Bestenlisten, Statistiken und Erfolge.

**Alleinstellungsmerkmal:** Eine erweiterbare Plattform-Architektur – neue Spiele werden über eine gemeinsame Schnittstelle (`Spiel`-Basisklasse) eingehängt, ohne die Plattform zu ändern. Plattformweite Erfolge und Statistiken über alle Spiele hinweg.

---

## 2. Tech-Stack
| Schicht | Technologie | Begründung |
|---|---|---|
| Frontend | HTML/CSS + **JavaScript-Klassen (ES6)**, Spiele mit **Canvas API** | Läuft in jedem Browser, keine Installation, OOP mit `class`/`extends` |
| Backend | **Python + Flask** (Klassen/Services) | Python ist im Team bekannt, schnell aufgesetzt |
| Datenbank | **SQLite** (über SQLAlchemy oder `sqlite3`) | Dateibasiert, keine Serverinstallation |
| Sicherheit | **bcrypt** (Passwort-Hash), Flask-Session-Cookies | Datenschutz/DSGVO-Argument |
| Tools | **git/GitHub**, **Jira** (Scrum-Board), VS Code, draw.io/PlantUML (UML) | Vorgabe Moodle |

Alternative (falls JS-Kenntnisse stark): Node.js + Express + TypeScript – eine Sprache überall.

---

## 3. Architektur
```
Browser (Frontend)                      Flask-Server (Backend)          SQLite
┌──────────────────────────┐  fetch/JSON  ┌─────────────────────────┐   ┌──────────┐
│ Seiten: Login, Launcher, │ ───────────► │ REST-API (/api/...)     │──►│ Tabellen │
│ Profil, Bestenliste      │ ◄─────────── │ AuthService             │   └──────────┘
│ Spiele: Canvas + Klassen │              │ ScoreService            │
│ ApiClient                │              │ AchievementService      │
└──────────────────────────┘              └─────────────────────────┘
```
Drei-Schichten-Modell: Präsentation (Browser) · Logik (Flask) · Daten (SQLite).

### Ordnerstruktur
```
spieleplattform/
├── backend/
│   ├── app.py                # Flask-Start, Routen registrieren
│   ├── models/               # Benutzer, Spiel, Score, Erfolg (Klassen)
│   ├── services/             # AuthService, ScoreService, AchievementService
│   ├── routes/               # auth.py, scores.py, games.py
│   └── database.py
├── frontend/
│   ├── index.html  login.html  launcher.html  profil.html
│   ├── css/
│   └── js/
│       ├── core/             # Spiel.js (abstrakt), GameLoop.js, Eingabe.js, ApiClient.js
│       └── games/            # snake/, memory/, ...
├── docs/                     # Projektdoku, UML, Swimlane, eEPK
└── README.md
```

---

## 4. Klassenmodell (Grundlage für UML-Klassendiagramm)

### Frontend (JavaScript)
```
«abstract» Spiel
  - name: string
  - canvas, ctx
  - punkte: int
  - zustand: Zustand (BEREIT | LAEUFT | PAUSE | VORBEI)
  + starten()            + pausieren()        + beenden()
  + update(dt) «abstract»
  + zeichnen() «abstract»
  + verarbeiteEingabe(taste) «abstract»
  # meldeErgebnis()  → ApiClient.sendeScore()

Snake  extends Spiel     (Schlange, Futter)
Memory extends Spiel     (Karte[], aufgedeckt, versuche)
[weitere: Pong, Tetris, IT-Quiz ...]

«abstract» Spielobjekt { x, y, breite, hoehe; update(); zeichnen(ctx) }
  ├─ Schlange   ├─ Futter   ├─ Karte   ├─ Ball ...

GameLoop   { start(spiel), stopp(); requestAnimationFrame }
Eingabe    { tastenStatus; registriere(spiel) }
ApiClient  { login(), registrieren(), sendeScore(), holeBestenliste(), holeProfil() }
Launcher   { spiele: Spiel[]; zeigeAuswahl(); starteSpiel(id) }
```

### Backend (Python)
```
Benutzer      { id, name, email, passwort_hash, erstellt_am; pruefePasswort() }
SpielInfo     { id, name, beschreibung, steuerung }
Score         { id, benutzer_id, spiel_id, punkte, dauer_s, zeitpunkt }
Erfolg        { id, name, beschreibung, bedingung; istErfuellt(statistik) }
  ├─ PunkteErfolg   ("1000 Punkte in Snake")
  ├─ AnzahlErfolg   ("10 Spiele gespielt")
  └─ VielfaltErfolg ("Alle Spiele mind. 1× gespielt")
Statistik     { benutzer_id; gesamtSpiele(), spielzeit(), bestwerte() }
AuthService   { registrieren(), login(), logout() }
ScoreService  { speichern(), bestenliste(spiel, limit), plausibilitaetPruefen() }
AchievementService { pruefeNachSpiel(benutzer, score) }
```
→ Zwei Vererbungshierarchien + Polymorphie (`update/zeichnen` bzw. `istErfuellt`) = starkes Klassendiagramm.

---

## 5. Datenbank (ERM-Entwurf)
| Tabelle | Spalten |
|---|---|
| benutzer | id PK, name UNIQUE, email UNIQUE, passwort_hash, erstellt_am |
| spiel | id PK, name, beschreibung, steuerung |
| score | id PK, benutzer_id FK, spiel_id FK, punkte, dauer_s, zeitpunkt |
| erfolg | id PK, name, beschreibung, typ, schwellwert, spiel_id FK NULL |
| benutzer_erfolg | benutzer_id FK, erfolg_id FK, erreicht_am (PK aus beiden) |

## 6. REST-API
| Methode | Pfad | Zweck |
|---|---|---|
| POST | /api/registrieren | Konto anlegen |
| POST | /api/login · /api/logout | Session |
| GET | /api/spiele | Spieleliste für Launcher |
| POST | /api/scores | Ergebnis speichern (nur eingeloggt) |
| GET | /api/bestenliste/{spiel_id} | Top 10 |
| GET | /api/profil | Eigene Statistik + Erfolge |
| DELETE | /api/konto | Konto + Daten löschen (DSGVO) |

---

## 7. Anforderungen

### Muss
- Registrierung, Login, Logout (Passwort gehasht)
- Launcher-Seite mit Spielauswahl
- **2 vollständig spielbare Spiele** (Vorschlag: **Snake** + **Memory**)
- Score nach Spielende speichern, Bestenliste pro Spiel
- REST-API + SQLite

### Kann
- Weitere Spiele (Pong, Tetris, IT-Quiz)
- Erfolge/Achievements, Profilseite mit Statistik
- Gast-Modus (spielen ohne Konto, ohne Bestenliste)
- Dark Mode, Einstellungen (Lautstärke, Tastenbelegung)
- Touch-Steuerung fürs Handy
- Plausibilitätsprüfung der Scores (Anti-Cheat)

### Abgrenzung (Darf nicht / wird nicht umgesetzt)
- Kein Echtzeit-Online-Multiplayer
- Keine Zahlungsfunktionen, keine Werbung
- Kein öffentliches Hosting (Betrieb lokal / im Schulnetz)
- Keine Fremdspiele / kein Store

### Nicht-funktionale Anforderungen
- Läuft in aktuellen Browsern (Chrome, Firefox, Edge)
- Spiele flüssig (~60 FPS)
- Bedienung selbsterklärend, Steuerung im Spiel sichtbar
- Passwörter nie im Klartext

---

## 8. User Stories (Startset für Jira)
1. **Als** neuer Spieler **möchte ich** ein Konto anlegen, **damit** meine Highscores gespeichert werden.
   AK: Name + Passwort Pflicht · Name eindeutig · Passwort ≥ 8 Zeichen · Fehlermeldung bei Dopplung.
2. **Als** Spieler **möchte ich** im Launcher alle Spiele mit kurzer Beschreibung sehen, **damit** ich schnell eins auswählen kann.
   AK: Kachel pro Spiel · Klick startet Spiel · Steuerung wird angezeigt.
3. **Als** Spieler **möchte ich** nach dem Spiel meinen Platz in der Bestenliste sehen, **damit** ich mich mit anderen vergleichen kann.
   AK: Top 10 · eigener Eintrag hervorgehoben · aktualisiert sofort.
4. **Als** Spieler **möchte ich** mein Konto löschen können, **damit** meine Daten nicht gespeichert bleiben.
   AK: Sicherheitsabfrage · alle Scores/Erfolge werden gelöscht.
5. **Als** Gelegenheitsspieler **möchte ich** ohne Konto spielen können, **damit** ich die Plattform erst testen kann. *(Kann)*

## 9. Jira-Epics
| Epic | Inhalt |
|---|---|
| E1 Plattform-Grundgerüst | Repo, Flask-Setup, Ordnerstruktur, DB-Schema |
| E2 Benutzerverwaltung | Registrierung, Login, Session, Konto löschen |
| E3 Spiel-Framework | Spiel-Basisklasse, GameLoop, Eingabe, ApiClient |
| E4 Spiel: Snake | |
| E5 Spiel: Memory | |
| E6 Scores & Bestenliste | API, Anzeige, Plausibilitätsprüfung |
| E7 Erfolge & Profil | (Kann) |
| E8 Doku & Schulung | Doku, UML, Schulungsmaterial, Präsentationen |

---

## 10. Zeitplan / Sprints (2-Wochen-Sprints, Daten nach Moodle-Deadlines anpassen)

### Milestone 1 – Planung (bis Ende 1. Halbjahr)
| Sprint | Ziel | Checklisten-Bezug |
|---|---|---|
| S1 | Team fix, Ideenfindung (0,5 S.), Probleme/Schlüsselstellen, Zuständigkeiten, Doku-Gerüst | Doku-Punkte 1–4 |
| S2 | Ist-Analyse, Lastenheft/Product Backlog, User Stories, Swimlane + eEPK, Jira-Setup | Product Backlog, User Story |
| S3 | UML-Klassendiagramm (Front- + Backend), DB-Entwurf, Sprints + Timeline mit Abhängigkeiten in Jira | Modellierung, Timeline |
| S4 | Optional: technischer Prototyp (Login + leeres Canvas), Präsentation „fiktives Meeting“ | Präsentation |

### Milestone 2 – Umsetzung (2. Halbjahr)
| Sprint | Ziel |
|---|---|
| S5 | Grundgerüst: Flask, DB, Registrierung/Login |
| S6 | Spiel-Framework + Launcher |
| S7 | Snake + Score speichern |
| S8 | Memory + Bestenliste |
| S9 | Kann-Features (Erfolge, Profil), Bugfixing, Tests mit Mitschülern |
| S10 | Schulungsbedarf + Schulungsmaterial, Soll/Ist-Vergleich, Doku fertig, Präsentation |

---

## 11. Rollen & Arbeitsteilung (Team noch eintragen)
| Rolle | Person | Schwerpunkt |
|---|---|---|
| Product Owner | ? | Backlog, Prioritäten, User Stories |
| Scrum Master | ? | Jira-Pflege, Sprint-Termine, Hindernisse |
| Entwickler Backend | ? | Flask, API, DB, Sicherheit |
| Entwickler Frontend/Spiele | ? | Launcher, Spiel-Framework, Spiele |
| (Doku/Test) | ? | Doku, Tests, Schulungsmaterial |
Faustregel: jedes Teammitglied verantwortet **ein Spiel** + einen Plattformteil.

---

## 12. Erwartete Probleme / Schlüsselstellen (für Doku MS1)
| Problem | Lösungsansatz |
|---|---|
| Scope-Creep (zu viele / zu große Spiele) | Muss = 2 einfache Spiele, Rest strikt Kann |
| Score-Manipulation über Browser-Requests | Nur eingeloggt speichern, serverseitige Plausibilitätsprüfung (Max-Punkte pro Sekunde, Spieldauer) |
| Einheitliche Schnittstelle für verschiedene Spiele | Abstrakte Basisklasse `Spiel` früh festlegen |
| Zwei Sprachen (Python + JS) | Klare API-Verträge (JSON-Formate) in Doku festhalten |
| Merge-Konflikte im Team | Feature-Branches, kleine Commits, Pull Requests |
| Plagiat (Tutorial-Code) | Selbst schreiben, Quellen im Code angeben |

## 13. Datenschutz
- Nur nötige Daten: Name, (optional E-Mail), Passwort-Hash, Scores
- Passwörter mit bcrypt gehasht, nie im Klartext
- Bestenliste zeigt nur Nutzernamen (Pseudonym empfohlen)
- Konto-Löschung inkl. aller Daten (Art. 17 DSGVO)
- Session-Cookie technisch notwendig → Hinweis statt Einwilligung
- Lokaler Betrieb, keine Weitergabe an Dritte

## 14. Schulungsbedarf (Phase 5)
- Konto anlegen & Login · Spiel starten · Steuerung je Spiel · Bestenliste/Profil lesen · Konto löschen
- Material: Hilfe-Seite in der App, 1-seitige Kurzanleitung mit Screenshots, Steuerungs-Overlay im Spiel

## 15. Doku-Gliederung (Vorschlag)
1. Einleitung & Projektidee (Ideenfindung)
2. Team, Rollen & Zuständigkeiten
3. Ist-Analyse & Soll-Konzept (Lastenheft)
4. Anforderungen (Muss/Kann/Abgrenzung, nicht-funktional)
5. User Stories mit Akzeptanzkriterien
6. Prozessmodelle (Swimlane, eEPK)
7. Architektur & Tech-Stack
8. UML-Klassendiagramm & Datenbankmodell
9. Projektplanung (Sprints, Jira-Timeline)
10. Erwartete Probleme & Datenschutz
— MS2 —
11. Entwicklungsprozess (max. 1 Seite, kein Code)
12. Probleme & Lösungen
13. Soll/Ist-Vergleich (Min./Max.-Ziele)
14. Schulungsbedarf (max. 0,5 S.) & Schulungsmaterial
15. Fazit & Ausblick · Quellen

---

## 16. Offene Punkte
- [ ] Team festlegen und in Moodle eintragen
- [ ] Endgültige Spieleauswahl (Snake + Memory?)
- [ ] Projektname
- [ ] Deadlines aus Moodle in den Zeitplan übertragen
- [ ] Bei Lehrkraft klären: Gewichtung (PDF 50/50 vs. Buch 40/10/25/25)
