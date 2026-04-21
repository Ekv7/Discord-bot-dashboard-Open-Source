import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
export const dataDir = path.join(rootDir, 'data');
export const guildsRootDir = path.join(dataDir, 'guilds');

/**
 * @param {string} guildId
 */
export function guildDir(guildId) {
    return path.join(guildsRootDir, String(guildId || '').trim());
}

/**
 * Legt die Standard-Unterordner für einen Server an (Multi-Server-Datenhaltung).
 * @param {string} guildId
 */
export function ensureGuildDataDirs(guildId) {
    const base = guildDir(guildId);
    fs.mkdirSync(path.join(base, 'warns'), { recursive: true });
    fs.mkdirSync(path.join(base, 'server-logs'), { recursive: true });
    fs.mkdirSync(path.join(base, 'member-stats'), { recursive: true });
    fs.mkdirSync(path.join(base, 'custom-commands'), { recursive: true });
    return base;
}

/** @param {string} guildId */
export function warnsFile(guildId) {
    return path.join(guildDir(guildId), 'warns', 'warnings.json');
}

/** @param {string} guildId */
export function serverLogsFile(guildId) {
    return path.join(guildDir(guildId), 'server-logs', 'logs.json');
}

/** @param {string} guildId */
export function memberStatsFile(guildId) {
    return path.join(guildDir(guildId), 'member-stats', 'stats.json');
}

/** @param {string} guildId */
export function customCommandsDir(guildId) {
    return path.join(guildDir(guildId), 'custom-commands');
}

/** @param {string} guildId */
export function dashboardAccessRolesFile(guildId) {
    return path.join(guildDir(guildId), 'dashboard-access-roles.json');
}

/** @param {string} guildId */
export function guildSettingsFile(guildId) {
    return path.join(guildDir(guildId), 'settings.json');
}

/** @param {string} guildId */
export function flowErrorsLogFile(guildId) {
    return path.join(guildDir(guildId), 'flow-errors.log');
}

/** @param {string} id */
export function isValidSnowflake(id) {
    return /^\d{17,22}$/.test(String(id || '').trim());
}
