import fs from 'fs';
import { ensureGuildDataDirs, warnsFile, isValidSnowflake } from './guildPaths.js';

const MAX_ENTRIES = 2000;

function normalizeGuildId(guildId) {
    const id = String(guildId || '').trim();
    return isValidSnowflake(id) ? id : '';
}

function readJsonArray(filePath) {
    try {
        const arr = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function loadRawForGuild(guildId) {
    const gid = normalizeGuildId(guildId);
    if (!gid) return [];
    ensureGuildDataDirs(gid);
    return readJsonArray(warnsFile(gid));
}

function writeRawForGuild(guildId, rows) {
    const gid = normalizeGuildId(guildId);
    if (!gid) return;
    try {
        ensureGuildDataDirs(gid);
        fs.writeFileSync(warnsFile(gid), JSON.stringify(rows.slice(0, MAX_ENTRIES)), 'utf8');
    } catch (e) {
        console.error('warns speichern fehlgeschlagen:', e.message);
    }
}

export function addWarn(entry) {
    const gid = normalizeGuildId(entry.guildId);
    if (!gid) return;
    const arr = loadRawForGuild(gid);
    arr.unshift({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        guildId: gid,
        guildName: entry.guildName ?? null,
        targetId: entry.targetId,
        targetTag: entry.targetTag,
        moderatorId: entry.moderatorId,
        moderatorTag: entry.moderatorTag,
        reason: entry.reason ?? null
    });
    if (arr.length > MAX_ENTRIES) arr.length = MAX_ENTRIES;
    writeRawForGuild(gid, arr);
}

export function listWarns(limit = 500, guildId = '') {
    const gid = normalizeGuildId(guildId);
    if (!gid) return [];
    return loadRawForGuild(gid).slice(0, Math.min(limit, MAX_ENTRIES));
}

export function listWarnsForUser(guildId, targetId, limit = 25) {
    const gid = normalizeGuildId(guildId);
    if (!gid) return [];
    return loadRawForGuild(gid)
        .filter((w) => w.targetId === targetId)
        .slice(0, Math.min(limit, MAX_ENTRIES));
}

export function removeWarnByUserIndex(guildId, targetId, indexOneBased = 1) {
    const gid = normalizeGuildId(guildId);
    if (!gid) return null;
    const arr = loadRawForGuild(gid);
    const matches = [];
    for (let i = 0; i < arr.length; i += 1) {
        if (arr[i].targetId === targetId) {
            matches.push(i);
        }
    }
    const pos = matches[indexOneBased - 1];
    if (typeof pos !== 'number') {
        return null;
    }
    const [removed] = arr.splice(pos, 1);
    writeRawForGuild(gid, arr);
    return removed ?? null;
}

export function clearWarnsForUser(guildId, targetId) {
    const gid = normalizeGuildId(guildId);
    if (!gid) return 0;
    const arr = loadRawForGuild(gid);
    const before = arr.length;
    const filtered = arr.filter((w) => w.targetId !== targetId);
    const removed = before - filtered.length;
    if (removed > 0) {
        writeRawForGuild(gid, filtered);
    }
    return removed;
}
