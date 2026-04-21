# Mynex Discord-Bot (Open Source)

Discord-Bot mit eigenem Dashboard (React + TypeScript) und JSON-Storage.
Diese Anleitung ist bewusst für Einsteiger geschrieben.

## Discord / Support

Community, Updates und Support: **[discord.gg/nVVRwfPCrw](https://discord.gg/nVVRwfPCrw)**

## Stack

- Backend: Node.js (ESM), `discord.js` v14
- Dashboard UI: React + TypeScript + Vite (`dashboard-ui/`)
- Persistenz: JSON-Dateien in `data/` (keine Datenbank)

## Voraussetzungen

- Node.js **20+**
- npm **10+** (kommt bei aktueller Node-Version mit)
- Ein Discord-Bot aus dem [Discord Developer Portal](https://discord.com/developers/applications)

Prüfen:

```powershell
node -v
npm -v
```

## Schnellstart (lokal)

### 1) Abhängigkeiten installieren

```powershell
npm install
npm install --prefix dashboard-ui
```

### 2) `.env` erstellen

```powershell
Copy-Item .env.example .env
```

### 3) `.env` ausfüllen (mindestens diese 4 Werte)

```env
DISCORD_TOKEN=DEIN_BOT_TOKEN
DISCORD_CLIENT_ID=DEINE_CLIENT_ID
DISCORD_CLIENT_SECRET=DEIN_CLIENT_SECRET
DASHBOARD_SESSION_SECRET=IRGENDEIN_LANGER_ZUFALLSWERT
```

### 4) Dashboard bauen

```powershell
npm run build:dashboard
```

### 5) Starten

```powershell
npm start
```

Dashboard lokal: `http://127.0.0.1:3847`

## Komplette Discord-Portal Einrichtung (Pflicht)

Damit Bot **und** Dashboard-Login korrekt funktionieren, müssen diese Punkte im
[Discord Developer Portal](https://discord.com/developers/applications) gesetzt sein:

### 1) Application erstellen

- `New Application` erstellen
- Unter `General Information` die **Application ID** kopieren
- Diese ID später in `.env` als `DISCORD_CLIENT_ID` eintragen

### 2) Bot erstellen + Token holen

- Menü `Bot` öffnen und Bot anlegen
- `Reset Token` / `Copy` nutzen
- Token in `.env` als `DISCORD_TOKEN` eintragen

### 3) Privileged Gateway Intents setzen

Unter `Bot` aktivieren:

- **Server Members Intent** = ON
- **Message Content Intent** = ON

Empfehlung:

- **Presence Intent** kann OFF bleiben (nur aktivieren, wenn du es wirklich brauchst)

### 4) OAuth2 Redirect für Dashboard-Login

Unter `OAuth2` -> `Redirects`:

- exakt den Wert aus `.env` eintragen: `DASHBOARD_OAUTH_REDIRECT_URI`
- Beispiel lokal: `http://127.0.0.1:3847/api/v1/auth/callback`
- Bei externer Nutzung immer **HTTPS**

Wichtig:

- Redirect muss 1:1 stimmen (Protokoll, Host, Port, Pfad)

### 5) OAuth2 Scopes für Invite

Unter `OAuth2 URL Generator` wählen:

- `bot`
- `applications.commands`

Berechtigungen:

- Für einfachen Start `Administrator` (Permissions = 8)
- Später in Produktion lieber granular einschränken

### 6) Bot auf Server einladen

Invite-URL Schema:

`https://discord.com/oauth2/authorize?client_id=DEINE_CLIENT_ID&permissions=8&scope=bot%20applications.commands`

## Bot zu deinem Server einladen

URL:

`https://discord.com/oauth2/authorize?client_id=DEINE_CLIENT_ID&permissions=8&scope=bot%20applications.commands`

`DEINE_CLIENT_ID` durch den Wert aus deiner `.env` ersetzen.

## `.env` vollständig (was wirklich benötigt wird)

Mindestens für Bot-Start:

```env
DISCORD_TOKEN=DEIN_BOT_TOKEN
DISCORD_CLIENT_ID=DEINE_APPLICATION_ID
```

Zusätzlich für Dashboard-Login (OAuth):

```env
DISCORD_CLIENT_SECRET=DEIN_CLIENT_SECRET
DASHBOARD_SESSION_SECRET=LANGER_ZUFALLSWERT
DASHBOARD_OAUTH_REDIRECT_URI=http://127.0.0.1:3847/api/v1/auth/callback
```

Optional für lokale Erreichbarkeit:

```env
DASHBOARD_HOST=127.0.0.1
DASHBOARD_PORT=3847
TRUST_PROXY=true
```

Hinweise:

- `.env` liegt im **Projektroot** (nicht in `dashboard-ui/`)
- Keine Anführungszeichen nötig
- Keine Leerzeichen um `=`
- Nach Änderungen Bot neu starten

## Häufige Fehler (wichtig für Anfänger)

### Fehler: `Fehlend: DISCORD_TOKEN und/oder DISCORD_CLIENT_ID`

Ursache: `.env` fehlt oder Werte sind leer.

Fix:
- `.env` muss im Projektroot liegen.
- `DISCORD_TOKEN` und `DISCORD_CLIENT_ID` müssen gesetzt sein.
- Danach `npm start` neu ausführen.

### Fehler beim Build im Ordner `dashboard-ui`

Fix-Reihenfolge:
```powershell
npm install --prefix dashboard-ui
npm run build:dashboard
```

### Fehler: `Cannot find module '@/pages/logs/logsFiltering'`

Wenn das bei einem alten Clone noch auftaucht:

```powershell
git pull
npm install --prefix dashboard-ui
npm run build:dashboard
```

Falls du einen uralten Download ohne Git hast: Repo frisch klonen.

### Dashboard lädt, aber Login/API geht nicht

- `DISCORD_CLIENT_SECRET` und `DASHBOARD_SESSION_SECRET` prüfen
- Redirect-URL im Discord Developer Portal muss exakt zu deiner `.env` passen (`DASHBOARD_OAUTH_REDIRECT_URI`)
- Bei externer Domain HTTPS verwenden

## Wichtige Befehle

```powershell
npm start
npm run build:dashboard
npm run start:public
npm run start:domain
```

Mehr Deployment-Details: `START.md`

## Sicherheit

- Niemals `.env` committen
- Niemals `data/`, `logs/` oder `node_modules/` committen
- Bei geleaktem Token sofort im Discord Portal neu generieren
- Secrets niemals in Frontend-Code speichern

## Open-Source Upload auf GitHub

```powershell
git init
git add .
git commit -m "Initial open-source release"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/DEIN-REPO.git
git push -u origin main
```

## Mithelfen (Contributing)

- Kleine, klare PRs statt riesige Sammel-PRs
- Bestehende Struktur beibehalten
- Keine Secrets oder lokale Daten hochladen
- Vor dem PR lokal testen:

```powershell
npm run build:dashboard
npm start
```

