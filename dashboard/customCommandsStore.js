import fs from 'fs';
import path from 'path';
import { ensureGuildDataDirs, customCommandsDir, guildsRootDir, isValidSnowflake } from './guildPaths.js';

function flowsDirForGuild(guildId) {
    const g = safeGuildId(guildId);
    if (!g) throw new Error('Ungültige Guild-ID');
    ensureGuildDataDirs(g);
    return customCommandsDir(g);
}

/**
 * @param {string} id
 * @returns {string|null}
 */
export function safeGuildId(id) {
    const s = String(id || '').trim();
    if (!isValidSnowflake(s)) return null;
    return s;
}

/**
 * @param {string} name
 * @returns {string|null}
 */
export function safeCommandName(name) {
    const n = String(name || '')
        .toLowerCase()
        .trim();
    if (!/^[a-z0-9_-]{1,32}$/.test(n)) return null;
    return n;
}

/**
 * @param {unknown} raw
 * @returns {{ name: string, description: string, nodes: unknown[], edges: unknown[] }}
 */
function normalizeFlowDoc(raw) {
    const name = safeCommandName(typeof raw?.name === 'string' ? raw.name : '');
    const description =
        typeof raw?.description === 'string' ? raw.description.trim().slice(0, 100) : '';
    return {
        name: name || '',
        description,
        nodes: Array.isArray(raw?.nodes) ? raw.nodes : [],
        edges: Array.isArray(raw?.edges) ? raw.edges : []
    };
}

/**
 * @param {string} guildId
 * @returns {object[]}
 */
export function listFlowDocumentsForGuild(guildId) {
    const g = safeGuildId(guildId);
    if (!g) return [];
    const dir = customCommandsDir(g);
    const out = [];
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        for (const f of fs.readdirSync(dir)) {
            if (!f.endsWith('.json')) continue;
            try {
                const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
                const doc = normalizeFlowDoc(raw);
                if (doc.name) out.push(doc);
            } catch {
                // defekte Datei überspringen
            }
        }
    }
    return out;
}

/**
 * @param {string} guildId
 * @param {{ name: string, description?: string, nodes: unknown[], edges: unknown[] }} doc
 */
export function saveFlowForGuild(guildId, doc) {
    const g = safeGuildId(guildId);
    if (!g) throw new Error('Ungültige Guild-ID');
    const n = safeCommandName(doc.name);
    if (!n) throw new Error('Ungültiger Command-Name');
    const normalized = normalizeFlowDoc({ ...doc, name: n });
    const dir = flowsDirForGuild(g);
    fs.writeFileSync(path.join(dir, `${n}.json`), JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
}

/**
 * @param {string} guildId
 * @param {string} name
 * @returns {boolean}
 */
export function deleteFlowForGuild(guildId, name) {
    const g = safeGuildId(guildId);
    const n = safeCommandName(name);
    if (!g || !n) return false;
    const p = path.join(customCommandsDir(g), `${n}.json`);
    if (!fs.existsSync(p)) return false;
    fs.unlinkSync(p);
    return true;
}

/**
 * @returns {string[]}
 */
export function listGuildIdsWithStoredFlows() {
    const ids = new Set();
    if (!fs.existsSync(guildsRootDir)) return [];
    try {
        for (const ent of fs.readdirSync(guildsRootDir, { withFileTypes: true })) {
            if (!ent.isDirectory()) continue;
            const gid = safeGuildId(ent.name);
            if (!gid) continue;
            const sub = customCommandsDir(gid);
            if (fs.existsSync(sub)) {
                const has = fs.readdirSync(sub).some(f => f.endsWith('.json'));
                if (has) ids.add(gid);
            }
        }
    } catch {
        return [];
    }
    return [...ids];
}
