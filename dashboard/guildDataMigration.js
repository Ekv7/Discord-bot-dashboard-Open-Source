/**
 * Einmalige/ idempotente Migration alter data/* Pfade nach data/guilds/<guildId>/...
 * Wird vor anderen Stores geladen (siehe index.js erster Import nach dotenv).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    dataDir,
    guildsRootDir,
    ensureGuildDataDirs,
    warnsFile,
    serverLogsFile,
    memberStatsFile,
    customCommandsDir,
    dashboardAccessRolesFile,
    isValidSnowflake
} from './guildPaths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function legacyRefGuildId() {
    return (
        process.env.DASHBOARD_GUILD_ID ||
        process.env.BOT_SINGLE_GUILD_ID ||
        process.env.SLASH_COMMAND_GUILD_ID ||
        ''
    ).trim();
}

function moveIfTargetMissing(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) {
        try {
            fs.unlinkSync(src);
        } catch {
            /* alte Datei behalten wenn Loeschen fehlschlaegt */
        }
        return;
    }
    try {
        fs.renameSync(src, dest);
    } catch {
        try {
            fs.copyFileSync(src, dest);
            fs.unlinkSync(src);
        } catch {
            // ignorieren
        }
    }
}

function migrateWarnsDir() {
    const oldDir = path.join(dataDir, 'warns');
    if (!fs.existsSync(oldDir)) return;
    let entries = [];
    try {
        entries = fs.readdirSync(oldDir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const ent of entries) {
        if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
        const base = ent.name.replace(/\.json$/i, '');
        if (base === 'warns') continue;
        if (!isValidSnowflake(base)) continue;
        const src = path.join(oldDir, ent.name);
        ensureGuildDataDirs(base);
        moveIfTargetMissing(src, warnsFile(base));
    }
    const g = legacyRefGuildId();
    for (const legacyFlat of [path.join(oldDir, 'warns.json'), path.join(dataDir, 'warns.json')]) {
        if (g && isValidSnowflake(g) && fs.existsSync(legacyFlat)) {
            ensureGuildDataDirs(g);
            const dest = warnsFile(g);
            if (!fs.existsSync(dest)) {
                moveIfTargetMissing(legacyFlat, dest);
            }
        }
    }
}

function migrateServerLogsDir() {
    const oldDir = path.join(dataDir, 'server-logs');
    if (!fs.existsSync(oldDir)) return;
    let entries = [];
    try {
        entries = fs.readdirSync(oldDir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const ent of entries) {
        if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
        const base = ent.name.replace(/\.json$/i, '');
        if (!isValidSnowflake(base)) continue;
        const src = path.join(oldDir, ent.name);
        ensureGuildDataDirs(base);
        moveIfTargetMissing(src, serverLogsFile(base));
    }
}

function migrateMemberStatsDir() {
    const oldDir = path.join(dataDir, 'member-stats');
    if (!fs.existsSync(oldDir)) return;
    let entries = [];
    try {
        entries = fs.readdirSync(oldDir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const ent of entries) {
        if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
        const base = ent.name.replace(/\.json$/i, '');
        if (!isValidSnowflake(base)) continue;
        const src = path.join(oldDir, ent.name);
        ensureGuildDataDirs(base);
        moveIfTargetMissing(src, memberStatsFile(base));
    }
    const legacy = path.join(dataDir, 'member-stats.json');
    const g = legacyRefGuildId();
    if (g && isValidSnowflake(g) && fs.existsSync(legacy)) {
        ensureGuildDataDirs(g);
        const dest = memberStatsFile(g);
        if (!fs.existsSync(dest)) {
            try {
                const raw = fs.readFileSync(legacy, 'utf8');
                const parsed = JSON.parse(raw);
                const days = parsed?.guilds?.[g]?.days || parsed?.days;
                if (days && typeof days === 'object') {
                    fs.writeFileSync(dest, JSON.stringify({ days }, null, 2), 'utf8');
                }
            } catch {
                moveIfTargetMissing(legacy, dest);
            }
        }
    }
}

function migrateCustomCommands() {
    const oldRoot = path.join(dataDir, 'custom-commands');
    if (!fs.existsSync(oldRoot)) return;
    let entries = [];
    try {
        entries = fs.readdirSync(oldRoot, { withFileTypes: true });
    } catch {
        return;
    }
    for (const ent of entries) {
        if (ent.isDirectory()) {
            const gid = ent.name;
            if (!isValidSnowflake(gid)) continue;
            ensureGuildDataDirs(gid);
            const srcDir = path.join(oldRoot, gid);
            const destDir = customCommandsDir(gid);
            fs.mkdirSync(destDir, { recursive: true });
            let files = [];
            try {
                files = fs.readdirSync(srcDir);
            } catch {
                continue;
            }
            for (const f of files) {
                if (!f.endsWith('.json')) continue;
                moveIfTargetMissing(path.join(srcDir, f), path.join(destDir, f));
            }
            try {
                if (fs.readdirSync(srcDir).length === 0) fs.rmdirSync(srcDir);
            } catch {
                /* ignore */
            }
            continue;
        }
        if (ent.isFile() && ent.name.endsWith('.json')) {
            const g = legacyRefGuildId();
            if (!g || !isValidSnowflake(g)) continue;
            ensureGuildDataDirs(g);
            const destDir = customCommandsDir(g);
            fs.mkdirSync(destDir, { recursive: true });
            moveIfTargetMissing(path.join(oldRoot, ent.name), path.join(destDir, ent.name));
        }
    }
}

function migrateDashboardAccessRoles() {
    const oldPath = path.join(dataDir, 'dashboard-access-roles.json');
    if (!fs.existsSync(oldPath)) return;
    let parsed = {};
    try {
        parsed = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
    } catch {
        return;
    }
    if (!parsed || typeof parsed !== 'object') return;
    for (const [guildIdRaw, roleIdRaw] of Object.entries(parsed)) {
        const guildId = String(guildIdRaw || '').trim();
        const roleId = String(roleIdRaw || '').trim();
        if (!isValidSnowflake(guildId) || !isValidSnowflake(roleId)) continue;
        ensureGuildDataDirs(guildId);
        const dest = dashboardAccessRolesFile(guildId);
        if (!fs.existsSync(dest)) {
            fs.writeFileSync(dest, JSON.stringify({ roleId }, null, 2), 'utf8');
        }
    }
    try {
        fs.renameSync(oldPath, `${oldPath}.migrated`);
    } catch {
        /* ignore */
    }
}

export function runGuildDataMigration() {
    try {
        fs.mkdirSync(guildsRootDir, { recursive: true });
        migrateWarnsDir();
        migrateServerLogsDir();
        migrateMemberStatsDir();
        migrateCustomCommands();
        migrateDashboardAccessRoles();
    } catch (e) {
        console.error('Guild-Daten-Migration:', e?.message || e);
    }
}

runGuildDataMigration();
