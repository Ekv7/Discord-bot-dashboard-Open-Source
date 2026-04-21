import * as logPersistence from './logPersistence.js';
import { loadGuildSettings } from './guildSettingsStore.js';

const MAX_SERVER_LOGS = 2000;
const MAX_CONSOLE = 800;
const MAX_SSE_CLIENTS = 80;

const serverLogs = logPersistence.loadServerLogs(MAX_SERVER_LOGS);
const consoleBuffer = [];
const sseClients = new Set();
const maintenanceSseClients = new Set();

let commandMeta = [];
let buttonMeta = [];
let maintenanceNotice = logPersistence.loadMaintenanceNotice();

const usage = {
    send_server: 0,
    button_github: 0
};

const stats = {
    errorsTotal: 0,
    errorsSession: 0,
    startedAt: Date.now()
};

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

let commandsDayKey = todayKey();
let commandsToday = 0;
let rolesGivenToday = 0;
let rolesRemovedToday = 0;

function rollDaily() {
    const k = todayKey();
    if (k !== commandsDayKey) {
        commandsDayKey = k;
        commandsToday = 0;
        rolesGivenToday = 0;
        rolesRemovedToday = 0;
    }
}

export function setCommandMetadata(commandsJson, buttons) {
    commandMeta = commandsJson;
    buttonMeta = buttons;
}

export function recordSlash(name) {
    rollDaily();
    usage[name] = (usage[name] || 0) + 1;
    commandsToday += 1;
}

/** Flow-Command-Nutzung pro Server (Key: flow:<guildId>:<name>). */
export function recordFlowSlash(guildId, commandName) {
    rollDaily();
    const g = String(guildId || '').trim();
    const n = String(commandName || '').toLowerCase().trim();
    if (!g || !n) return;
    const key = `flow:${g}:${n}`;
    usage[key] = (usage[key] || 0) + 1;
    commandsToday += 1;
}

export function recordButton(key) {
    rollDaily();
    if (key === 'server_github') usage.button_github += 1;
}

export function recordRole(given) {
    rollDaily();
    if (given) rolesGivenToday += 1;
    else rolesRemovedToday += 1;
}

export function recordError() {
    stats.errorsTotal += 1;
    stats.errorsSession += 1;
}

export function pushServerLog(entry) {
    rollDaily();
    const guildId = typeof entry.guildId === 'string' ? entry.guildId.trim() : '';
    if (!guildId) {
        // Ohne Guild-ID niemals persistieren, sonst entstehen Mischdaten.
        return;
    }
    const row = {
        ts: Date.now(),
        type: entry.type,
        user: entry.user,
        userId: entry.userId ?? null,
        guildId,
        msg: entry.msg,
        channel: entry.channel ?? null,
        simulated: Boolean(entry.simulated),
        ...(entry.executorTag != null && entry.executorTag !== ''
            ? { executorTag: entry.executorTag }
            : {}),
        ...(entry.executorId != null && entry.executorId !== ''
            ? { executorId: entry.executorId }
            : {}),
        ...(Array.isArray(entry.executorRoles) && entry.executorRoles.length
            ? { executorRoles: entry.executorRoles }
            : {})
    };
    serverLogs.unshift(row);
    if (serverLogs.length > MAX_SERVER_LOGS) serverLogs.length = MAX_SERVER_LOGS;
    logPersistence.saveServerLogs(serverLogs, MAX_SERVER_LOGS);
    broadcast('serverLog', row);
}

export function pushConsoleLine(level, text) {
    const line = { ts: Date.now(), level, text };
    consoleBuffer.push(line);
    if (consoleBuffer.length > MAX_CONSOLE) consoleBuffer.shift();
    broadcast('console', line);
}

function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
        try {
            res.write(payload);
        } catch {
            sseClients.delete(res);
        }
    }
}

function broadcastMaintenance(data) {
    const payload = `event: maintenance\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of maintenanceSseClients) {
        try {
            res.write(payload);
        } catch {
            maintenanceSseClients.delete(res);
        }
    }
}

export function addSseClient(res) {
    if (sseClients.size >= MAX_SSE_CLIENTS) return false;
    sseClients.add(res);
    return true;
}

export function removeSseClient(res) {
    sseClients.delete(res);
}

export function getSseClientCount() {
    return sseClients.size;
}

export function getMaintenanceSseClientCount() {
    return maintenanceSseClients.size;
}

export function getMaintenanceNotice() {
    return maintenanceNotice;
}

export function setMaintenanceNotice(next) {
    maintenanceNotice = {
        enabled: Boolean(next?.enabled),
        text: typeof next?.text === 'string' ? next.text.slice(0, 240) : '',
        updatedAt: Date.now(),
        updatedBy: typeof next?.updatedBy === 'string' ? next.updatedBy : null
    };
    logPersistence.saveMaintenanceNotice(maintenanceNotice);
    broadcast('maintenance', maintenanceNotice);
    broadcastMaintenance(maintenanceNotice);
    return maintenanceNotice;
}

export function addMaintenanceSseClient(res) {
    if (maintenanceSseClients.size >= MAX_SSE_CLIENTS) return false;
    maintenanceSseClients.add(res);
    return true;
}

export function removeMaintenanceSseClient(res) {
    maintenanceSseClients.delete(res);
}

export function getSnapshot(client, selectedGuildId = '') {
    rollDaily();
    const cache = client.guilds.cache;
    const multiGuild = cache.size > 1;
    const envGuildId = (process.env.DASHBOARD_GUILD_ID || '').trim();
    const selected = (selectedGuildId || '').trim();
    let resolvedGuildId = selected || envGuildId;
    if (!resolvedGuildId && !multiGuild && cache.size === 1) {
        resolvedGuildId = cache.first().id;
    }

    const sendServerGuildId = (process.env.SEND_SERVER_GUILD_ID || process.env.SLASH_COMMAND_GUILD_ID || '').trim();
    const hideSendServerStuff =
        Boolean(sendServerGuildId) && Boolean(resolvedGuildId) && resolvedGuildId !== sendServerGuildId;

    const guild = resolvedGuildId ? cache.get(resolvedGuildId) : null;
    const memberCount = guild?.memberCount ?? null;
    let guildName = guild?.name ?? null;
    if (!guild && resolvedGuildId) {
        const st = loadGuildSettings(resolvedGuildId);
        if (st.guildName) guildName = st.guildName;
    }

    const pres = client.presence;
    const act = pres?.activities?.[0];
    let pingMs = null;
    try {
        if (client.ws && typeof client.ws.ping === 'number' && Number.isFinite(client.ws.ping)) {
            pingMs = client.ws.ping;
        }
    } catch {
        pingMs = null;
    }

    return {
        health: {
            uptimeMs: Math.max(0, Date.now() - stats.startedAt),
            pingMs
        },
        bot: {
            tag: client.user?.tag ?? null,
            id: client.user?.id ?? null,
            ready: Boolean(client.user),
            status: pres?.status ?? 'offline',
            activity: act
                ? {
                      name: act.name ?? '',
                      type: typeof act.type === 'number' ? act.type : 0,
                      state: act.state ?? null
                  }
                : null
        },
        guild: guildName ? { name: guildName, members: memberCount } : { name: null, members: memberCount },
        stats: {
            members: memberCount,
            commandsToday,
            rolesToday: rolesGivenToday + rolesRemovedToday,
            rolesGivenToday,
            rolesRemovedToday,
            errorsSession: stats.errorsSession,
            errorsTotal: stats.errorsTotal
        },
        commands: (() => {
            let cmds = hideSendServerStuff ? commandMeta.filter(c => c.name !== 'send_server') : commandMeta;
            if (resolvedGuildId) {
                cmds = cmds.filter(c => !c.custom || String(c.guildId || '') === resolvedGuildId);
            } else {
                cmds = cmds.filter(c => !c.custom);
            }
            return cmds;
        })(),
        buttons: hideSendServerStuff
            ? buttonMeta.filter(b => b.usageKey !== 'button_github')
            : buttonMeta,
        usage: hideSendServerStuff
            ? Object.fromEntries(
                  Object.entries(usage).filter(([k]) => k !== 'send_server' && k !== 'button_github')
              )
            : usage,
        serverLogs: resolvedGuildId
            ? serverLogs.filter(row => row.guildId === resolvedGuildId).slice(0, 2000)
            : [],
        consoleLines: consoleBuffer.slice(-200)
    };
}

export function addSimulatedLog(body) {
    pushServerLog({
        type: body.type || 'cmd',
        user: body.user || 'Test',
        userId: null,
        guildId: body.guildId ?? null,
        msg: body.msg || '(Simuliert)',
        channel: body.channel ?? '#test',
        simulated: true
    });
}
