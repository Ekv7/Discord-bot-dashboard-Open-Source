import fs from 'fs';
import {
    ensureGuildDataDirs,
    guildSettingsFile,
    flowErrorsLogFile,
    isValidSnowflake,
    guildsRootDir
} from './guildPaths.js';

/**
 * @param {string} guildId
 * @returns {{ botPresent: boolean, guildName: string, ownerId: string, updatedAt: number }}
 */
export function loadGuildSettings(guildId) {
    const id = String(guildId || '').trim();
    if (!isValidSnowflake(id)) {
        return { botPresent: true, guildName: '', ownerId: '', updatedAt: 0 };
    }
    const p = guildSettingsFile(id);
    try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        return {
            botPresent: raw?.botPresent !== false,
            guildName: typeof raw?.guildName === 'string' ? raw.guildName : '',
            ownerId: typeof raw?.ownerId === 'string' ? raw.ownerId : '',
            updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : 0
        };
    } catch {
        return { botPresent: true, guildName: '', ownerId: '', updatedAt: 0 };
    }
}

/**
 * @param {string} guildId
 * @param {Partial<{ botPresent: boolean, guildName: string, ownerId: string }>} patch
 */
export function saveGuildSettings(guildId, patch) {
    const id = String(guildId || '').trim();
    if (!isValidSnowflake(id)) return;
    ensureGuildDataDirs(id);
    const cur = loadGuildSettings(id);
    const next = {
        botPresent: patch.botPresent !== undefined ? Boolean(patch.botPresent) : cur.botPresent,
        guildName: patch.guildName !== undefined ? String(patch.guildName).slice(0, 100) : cur.guildName,
        ownerId: patch.ownerId !== undefined ? String(patch.ownerId).trim() : cur.ownerId,
        updatedAt: Date.now()
    };
    fs.writeFileSync(guildSettingsFile(id), JSON.stringify(next, null, 2), 'utf8');
}

/**
 * Bot ist auf dem Server — Metadaten aktualisieren.
 * @param {import('discord.js').Guild} guild
 */
export function syncGuildSettingsFromDiscord(guild) {
    if (!guild?.id) return;
    ensureGuildDataDirs(guild.id);
    const cur = loadGuildSettings(guild.id);
    saveGuildSettings(guild.id, {
        botPresent: true,
        guildName: guild.name || cur.guildName,
        ownerId: guild.ownerId || cur.ownerId
    });
}

/**
 * Bot hat Server verlassen — Daten behalten, nur Kennzeichnung.
 * @param {import('discord.js').Guild} guild
 */
export function markGuildBotLeft(guild) {
    if (!guild?.id) return;
    ensureGuildDataDirs(guild.id);
    const cur = loadGuildSettings(guild.id);
    saveGuildSettings(guild.id, {
        botPresent: false,
        guildName: guild.name || cur.guildName,
        ownerId: guild.ownerId || cur.ownerId
    });
}

/**
 * @param {string} guildId
 * @param {string} line
 */
export function appendFlowErrorLog(guildId, line) {
    const id = String(guildId || '').trim();
    if (!isValidSnowflake(id)) return;
    try {
        ensureGuildDataDirs(id);
        const msg = String(line || '').replace(/\r?\n/g, ' ').slice(0, 2000);
        fs.appendFileSync(flowErrorsLogFile(id), `[${new Date().toISOString()}] ${msg}\n`, 'utf8');
    } catch (e) {
        console.warn('flow-errors.log:', e?.message || e);
    }
}

/**
 * Alle Guild-IDs mit Datenordner (für Dashboard-Liste inkl. „Bot weg“).
 * @returns {string[]}
 */
export function listStoredGuildIds() {
    if (!fs.existsSync(guildsRootDir)) return [];
    const out = [];
    try {
        for (const ent of fs.readdirSync(guildsRootDir, { withFileTypes: true })) {
            if (!ent.isDirectory()) continue;
            if (isValidSnowflake(ent.name)) out.push(ent.name);
        }
    } catch {
        return [];
    }
    return out;
}
