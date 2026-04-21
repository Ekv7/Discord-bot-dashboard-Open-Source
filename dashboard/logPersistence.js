import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    dataDir,
    guildsRootDir,
    ensureGuildDataDirs,
    serverLogsFile,
    isValidSnowflake
} from './guildPaths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverLogsPath = path.join(dataDir, 'server-logs.json');
const legacyArchivePath = path.join(dataDir, 'server-logs.legacy.json');
const maintenanceNoticePath = path.join(dataDir, 'maintenance-notice.json');

function ensureDir() {
    fs.mkdirSync(dataDir, { recursive: true });
}

function readJsonArray(filePath) {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function normalizeRow(row, fallbackGuildId = '') {
    if (!row || typeof row !== 'object') return null;
    const guildId = (row.guildId || fallbackGuildId || '').trim();
    if (!guildId) return null;
    return { ...row, guildId };
}

function archiveLegacyFileIfPresent() {
    if (!fs.existsSync(serverLogsPath)) return;
    try {
        if (!fs.existsSync(legacyArchivePath)) {
            fs.renameSync(serverLogsPath, legacyArchivePath);
            console.warn(`Legacy-Logs archiviert: ${legacyArchivePath}`);
            return;
        }
        fs.unlinkSync(serverLogsPath);
        console.warn('Legacy-Logs entfernt: data/server-logs.json');
    } catch (e) {
        console.error('Legacy-Log-Datei konnte nicht archiviert werden:', e.message);
    }
}

/** Alle server-logs/logs.json unter data/guilds/<id>/ einlesen */
export function loadServerLogs(maxEntries) {
    ensureDir();
    archiveLegacyFileIfPresent();
    const rows = [];

    try {
        if (fs.existsSync(guildsRootDir)) {
            for (const ent of fs.readdirSync(guildsRootDir, { withFileTypes: true })) {
                if (!ent.isDirectory() || !isValidSnowflake(ent.name)) continue;
                const guildId = ent.name;
                const f = serverLogsFile(guildId);
                if (!fs.existsSync(f)) continue;
                const arr = readJsonArray(f);
                for (const row of arr) {
                    const normalized = normalizeRow(row, guildId);
                    if (!normalized || normalized.guildId !== guildId) continue;
                    rows.push(normalized);
                }
            }
        }
    } catch {
        // ignorieren
    }

    rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return rows.slice(0, maxEntries);
}

export function saveServerLogs(rows, maxEntries) {
    try {
        const trimmed = rows.slice(0, maxEntries);
        const byGuild = new Map();
        for (const row of trimmed) {
            const guildId = (row.guildId || '').trim();
            if (!guildId) continue;
            if (!byGuild.has(guildId)) byGuild.set(guildId, []);
            byGuild.get(guildId).push({ ...row, guildId });
        }

        for (const [guildId, guildRows] of byGuild.entries()) {
            if (!isValidSnowflake(guildId)) continue;
            ensureGuildDataDirs(guildId);
            fs.writeFileSync(
                serverLogsFile(guildId),
                JSON.stringify(guildRows.slice(0, maxEntries)),
                'utf8'
            );
        }
    } catch (e) {
        console.error('server-logs speichern fehlgeschlagen:', e.message);
    }
}

export function loadMaintenanceNotice() {
    ensureDir();
    try {
        const parsed = JSON.parse(fs.readFileSync(maintenanceNoticePath, 'utf8'));
        return {
            enabled: Boolean(parsed?.enabled),
            text: typeof parsed?.text === 'string' ? parsed.text.slice(0, 240) : '',
            updatedAt:
                typeof parsed?.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
                    ? parsed.updatedAt
                    : 0,
            updatedBy: typeof parsed?.updatedBy === 'string' ? parsed.updatedBy : null
        };
    } catch {
        return {
            enabled: false,
            text: '',
            updatedAt: 0,
            updatedBy: null
        };
    }
}

export function saveMaintenanceNotice(notice) {
    try {
        ensureDir();
        const safe = {
            enabled: Boolean(notice?.enabled),
            text: typeof notice?.text === 'string' ? notice.text.slice(0, 240) : '',
            updatedAt:
                typeof notice?.updatedAt === 'number' && Number.isFinite(notice.updatedAt)
                    ? notice.updatedAt
                    : Date.now(),
            updatedBy: typeof notice?.updatedBy === 'string' ? notice.updatedBy : null
        };
        fs.writeFileSync(maintenanceNoticePath, JSON.stringify(safe), 'utf8');
    } catch (e) {
        console.error('maintenance-notice speichern fehlgeschlagen:', e.message);
    }
}
