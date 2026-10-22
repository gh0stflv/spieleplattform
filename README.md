# Spieleplattform (Arbeitstitel)

Schuljahresprojekt LF12a „Kundenspezifische Anwendungsentwicklung durchführen“ (BSZN, 12ITAB).
Browserbasierte Spieleplattform: registrieren, im Launcher ein Spiel wählen, im Browser spielen, Bestenlisten vergleichen.

## Team
| Rolle | Person |
|---|---|
| Product Owner | ? |
| Scrum Master | ? |
| Backend | ? |
| Frontend/Spiele | ? |

## Tech-Stack
Frontend: HTML/CSS + ES6-Klassen, Canvas API · Backend: Python + Flask · DB: SQLite · Scrum: Jira

## Ordnerstruktur
```
backend/    app.py, database.py, models/, services/, routes/
frontend/   *.html, css/, js/core/, js/games/(snake, memory)
docs/       Projektkonzept, Doku, UML, Swimlane, eEPK
```

## Lokal starten
```bash
python -m venv .venv
# Windows: .venv\Scripts\activate   ·   Linux/macOS: source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && python app.py
```

## Arbeitsweise (git)
- `main` bleibt lauffähig, gearbeitet wird auf Feature-Branches: `feature/<jira-key>-kurzbeschreibung`, z. B. `feature/SP-12-login`
- Jira-Key in Commit-Nachricht nennen (`SP-12 Login-Formular angelegt`), dann verknüpft Jira die Commits
- Kleine Commits, Pull Request + Review durch Teammitglied vor dem Merge

## Plagiat / Quellen
Code wird vom Team selbst geschrieben. Übernommene Stellen werden im Quelltext mit Quelle markiert:
`// Quelle: <URL oder Buch>, angepasst`
