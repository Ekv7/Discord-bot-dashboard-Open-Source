import fs from 'fs';
import { ensureGuildDataDirs, dashboardAccessRolesFile, isValidSnowflake } from './guildPaths.js';

function normalizeSnowflake(value) {
    const s = String(value || '').trim();
    return isValidSnowflake(s) ? s : '';
}

/** @type {Map<string, string>} */
const cache = new Map();

function readFromDisk(guildId) {
    const p = dashboardAccessRolesFile(guildId);
    try {
        if (!fs.existsSync(p)) return '';
        const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
        return normalizeSnowflake(parsed?.roleId);
    } catch {
        return '';
    }
}

export function getRoleIdForGuild(guildId) {
    const gid = normalizeSnowflake(guildId);
    if (!gid) return '';
    if (cache.has(gid)) return cache.get(gid) || '';
    const roleId = readFromDisk(gid);
    cache.set(gid, roleId);
    return roleId;
}

export function setRoleIdForGuild(guildIdRaw, roleIdRaw) {
    const guildId = normalizeSnowflake(guildIdRaw);
    if (!guildId) throw new Error('UNGUELTIGE_GUILD_ID');

    const roleId = normalizeSnowflake(roleIdRaw);
    if (!roleId) throw new Error('UNGUELTIGE_ROLLEN_ID');
    cache.set(guildId, roleId);
    ensureGuildDataDirs(guildId);
    fs.writeFileSync(dashboardAccessRolesFile(guildId), JSON.stringify({ roleId }, null, 2), 'utf8');
    return roleId;
}

export function clearRoleIdForGuild(guildIdRaw) {
    const guildId = normalizeSnowflake(guildIdRaw);
    if (!guildId) throw new Error('UNGUELTIGE_GUILD_ID');
    cache.set(guildId, '');
    const p = dashboardAccessRolesFile(guildId);
    try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
        /* ignore */
    }
}
