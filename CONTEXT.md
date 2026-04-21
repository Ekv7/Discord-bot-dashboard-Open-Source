# Projektkontext: Mynex

Mynex ist ein selbst gebauter Discord-Bot mit eigenem Web-Dashboard und öffentlicher Webseite.

## Ziel

- Open-Source-freundlich
- Einsteiger sollen lokal in wenigen Schritten starten können
- Keine Datenbank, nur JSON-Storage unter `data/`

## Tech-Stack (fest)

- Backend: Node.js (ESM), `discord.js` v14, Einstieg `index.js`
- Dashboard Frontend: React + TypeScript + Vite (`dashboard-ui/`)
- Persistenz: JSON-Dateien in `data/`

## Wichtige Regeln

- ESM verwenden, kein CommonJS
- Secrets nur in `.env`, niemals im Code
- Keine neuen Frameworks/DBs ohne explizite Freigabe
- Änderungen möglichst klein und zielgerichtet halten
