# Mynex Discord-Bot — Start

**Überblick**

| Umgebung | Abschnitt |
|----------|-----------|
| **Nur dein PC** (Entwicklung) | [Lokal auf dem PC](#lokal-auf-dem-pc-entwicklung) |
| **Windows-Server / dedizierter PC** | [Root-Server unter Windows](#root-server-unter-windows-windows-server--dediziert) |

---

## Voraussetzungen

- **Node.js 20+**
- Datei **`.env`** im Projektroot — Vorlage: **`.env.example`** kopieren und ausfüllen

---

## Lokal auf dem PC (Entwicklung)

Im Ordner **`Discord-Bot`** (PowerShell):

```powershell
cd "C:\Users\Mynex Studios\Desktop\Discord-Bot"
npm install
npm install --prefix dashboard-ui
npm run build:dashboard
npm start
```

- **`npm start`** startet Bot inkl. Dashboard-HTTP (Port laut `.env`, oft **3847**).
- Browser: **`http://127.0.0.1:3847`** (wenn `DASHBOARD_HOST` passt).

Optional: **`npm run start:public`** — Quick-Tunnel (wechselnde URL). Feste Domain: **`npm run domain:setup`** (legt `config/cloudflared.yml` + passende `.env`-Werte an), danach **`npm run build:dashboard`** und **`npm run start:domain`**.

Hinter Cloudflare Tunnel: in `.env` **`TRUST_PROXY=true`** setzen und **`VITE_DASHBOARD_API_BASE_URL`** auf die **öffentliche https-URL** (nicht `http://127.0.0.1…`), sonst blockiert der Browser die API (**Mixed Content**) — Symptom: „Auth-Prüfung fehlgeschlagen“.

---

## Root-Server unter Windows (Windows Server / dediziert)

### 1. Voraussetzungen

- **Windows Server** oder **Windows 10/11** (64 Bit)
- **Node.js 20 LTS**: [nodejs.org](https://nodejs.org) → danach `node -v` (soll `v20.x` zeigen)

### 2. Projekt legen

Ordner auf den Rechner kopieren. **`.env`** aus **`.env.example`** ableiten (Token, URLs, OAuth, …).

### 3. Dependencies & Build

```powershell
cd C:\Pfad\Zu\Discord-Bot
npm install
npm install --prefix dashboard-ui
npm run build:dashboard
```

### 4. Dashboard von außen erreichbar

**Variante A — direkt (oft nur HTTP):** in `.env` z. B. `DASHBOARD_HOST=0.0.0.0`, `DASHBOARD_PORT=3847`, `TRUST_PROXY=true`. **Windows-Firewall:** eingehend TCP am gewählten Port erlauben.

**Variante B — HTTPS / Domain:** z. B. **IIS** als Reverse Proxy, [win-acme](https://www.win-acme.com/) für TLS, oder **Cloudflare Tunnel** zu `http://127.0.0.1:3847` — ohne offenen Bot-Port nach außen.

Für **Discord OAuth** brauchst du langfristig eine **HTTPS-URL**; reine `http://IP:Port` reicht oft nicht für produktive Logins.

### 5. Bot dauerhaft starten (Windows)

```powershell
npm start
```

**PM2:**

```powershell
npm install -g pm2
cd C:\Pfad\Zu\Discord-Bot
pm2 start ecosystem.config.cjs
pm2 save
```

Autostart: siehe [PM2 Windows](https://pm2.keymetrics.io/docs/usage/startup/) oder **Aufgabenplanung**.

---

## Dashboard statisch hosten (z. B. Titan)

1. In der **Root-`.env`** für den Vite-Build:

   ```env
   VITE_DASHBOARD_API_BASE_URL=https://deine-api-domain.de
   ```

2. **`npm run build:dashboard`**
3. Inhalt von **`dashboard-ui\dist\`** auf den Webspace hochladen.
4. Die **API** muss unter der konfigurierten URL laufen; in der **Server-`.env`** u. a. **`DASHBOARD_CORS_ORIGINS`** mit der Dashboard-URL (kommagetrennt, ohne Slash am Ende) — siehe **`.env.example`**.

---

## Nützliche Befehle

| Zweck | Befehl |
|--------|--------|
| Bot starten (lokal) | `npm start` |
| Dashboard neu bauen | `npm run build:dashboard` |
| PM2 Status | `pm2 status` |
| PM2 Logs | `pm2 logs mynex` |
