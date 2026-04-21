import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureGuildDataDirs, memberStatsFile, isValidSnowflake } from './guildPaths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyPath = path.join(__dirname, '..', 'data', 'member-stats.json');

function normalizeGuildId(guildId) {
    const id = (guildId || '').trim();
    return isValidSnowflake(id) ? id : null;
}

function loadGuildData(guildId) {
    const gid = normalizeGuildId(guildId);
    if (!gid) {
        return { days: {} };
    }
    ensureGuildDataDirs(gid);
    const filePath = memberStatsFile(gid);
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        if (data.days && typeof data.days === 'object') return data;
    } catch {
        // ggf. Legacy versuchen
    }

    if (fs.existsSync(legacyPath)) {
        try {
            const raw = fs.readFileSync(legacyPath, 'utf8');
            const legacy = JSON.parse(raw);
            const fromGuilds = legacy?.guilds?.[gid]?.days;
            if (fromGuilds && typeof fromGuilds === 'object') return { days: fromGuilds };
        } catch {
            // ignore legacy parse errors
        }
    }
    return { days: {} };
}

function saveGuildData(guildId, data) {
    const gid = normalizeGuildId(guildId);
    if (!gid) return;
    ensureGuildDataDirs(gid);
    fs.writeFileSync(memberStatsFile(gid), JSON.stringify(data, null, 2), 'utf8');
}

function dayKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function recordJoin(guildId) {
    if (!normalizeGuildId(guildId)) return;
    const data = loadGuildData(guildId);
    const days = data.days;
    const k = dayKey();
    if (!days[k]) days[k] = { joins: 0, leaves: 0 };
    days[k].joins += 1;
    saveGuildData(guildId, data);
}

export function recordLeave(guildId) {
    if (!normalizeGuildId(guildId)) return;
    const data = loadGuildData(guildId);
    const days = data.days;
    const k = dayKey();
    if (!days[k]) days[k] = { joins: 0, leaves: 0 };
    days[k].leaves += 1;
    saveGuildData(guildId, data);
}

function sumLastDays(days, n) {
    let joins = 0;
    let leaves = 0;
    for (let i = 0; i < n; i++) {
        const dt = new Date();
        dt.setDate(dt.getDate() - i);
        const k = dayKey(dt);
        const e = days[k];
        if (e) {
            joins += e.joins || 0;
            leaves += e.leaves || 0;
        }
    }
    return { joins, leaves, net: joins - leaves };
}

/** Gesamtsumme aller gespeicherten Tage (für Dashboard-Tab „Gesamt“). */
function sumAllDays(days) {
    let joins = 0;
    let leaves = 0;
    for (const k of Object.keys(days)) {
        const e = days[k];
        if (e && typeof e === 'object') {
            joins += e.joins || 0;
            leaves += e.leaves || 0;
        }
    }
    return { joins, leaves, net: joins - leaves };
}

/**
 * Form wie StatsPage.tsx (d3/d7/d14/d30/all) — nicht { last7, last30 },
 * sonst bricht das Frontend beim Zugriff auf summary.d7 ab (schwarzer Screen).
 */
export function getMemberStatsSummary(guildId) {
    const data = loadGuildData(guildId);
    const days = data.days;
    return {
        d3: sumLastDays(days, 3),
        d7: sumLastDays(days, 7),
        d14: sumLastDays(days, 14),
        d30: sumLastDays(days, 30),
        all: sumAllDays(days)
    };
}

export function getDailySeries(daysCount, guildId) {
    const data = loadGuildData(guildId);
    const days = data.days;
    const out = [];
    for (let i = daysCount - 1; i >= 0; i--) {
        const dt = new Date();
        dt.setDate(dt.getDate() - i);
        const k = dayKey(dt);
        const e = days[k] || { joins: 0, leaves: 0 };
        out.push({
            date: k,
            joins: e.joins || 0,
            leaves: e.leaves || 0
        });
    }
    return out;
}
