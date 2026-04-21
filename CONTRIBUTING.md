# Contributing

Danke, dass du zu Mynex beitragen willst.

## Setup

```powershell
npm install
npm install --prefix dashboard-ui
npm run build:dashboard
```

`.env` aus `.env.example` erstellen und lokale Werte setzen.

## Regeln für Pull Requests

- Kleine, klare Änderungen statt großer Sammel-PRs
- Bestehende Projektstruktur beibehalten
- Keine Secrets, `.env`, `data/` oder Logs committen
- Neue Features mit kurzer Erklärung in der `README.md` ergänzen, wenn nötig

## Lokale Checks vor PR

```powershell
npm run build:dashboard
npm start
```

Wenn ein Check fehlschlägt, bitte erst fixen und dann PR erstellen.
