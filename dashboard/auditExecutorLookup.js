import { AuditLogEvent } from 'discord.js';
import { escapeHtml } from './logHtml.js';

/**
 * HTML-Zeile „Ausgeführt von“ für Server-Logs
 * @param {{ tag: string; id: string } | null} exec
 */
export function executorPrefixLine(exec) {
    if (!exec?.id) {
        return '<b>Ausgeführt von:</b> <i>Unbekannt</i> (kein Audit-Eintrag, automatischer Ablauf oder fehlende Rechte „Audit-Log anzeigen“).<br>';
    }
    return `<b>Ausgeführt von:</b> ${escapeHtml(exec.tag)} <code>${exec.id}</code><br>`;
}

/**
 * @param {import('discord.js').GuildAuditLogsEntry} entry
 */
function executorFromEntry(entry) {
    const execId = entry.executorId;
    if (!execId) return null;
    const ex = entry.executor;
    const tag =
        ex?.tag ?? ex?.username ?? `User·${String(execId).slice(-8)}`;
    return { tag, id: execId };
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Snowflake} targetUserId
 */
async function memberUpdateOnce(guild, targetUserId, maxAgeMs) {
    try {
        const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 15 });
        const now = Date.now();
        for (const entry of logs.entries.values()) {
            if (now - entry.createdTimestamp > maxAgeMs) continue;
            if (entry.targetId !== targetUserId) continue;
            return executorFromEntry(entry);
        }
    } catch {
        return null;
    }
    return null;
}

/**
 * Wer hat Nickname/Timeout/Boost per Audit ausgelöst (mit kurzer Verzögerung für Discord).
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Snowflake} targetUserId
 */
export async function resolveMemberUpdateExecutor(guild, targetUserId) {
    let exec = await memberUpdateOnce(guild, targetUserId, 12_000);
    if (exec) return exec;
    await new Promise(r => setTimeout(r, 650));
    return memberUpdateOnce(guild, targetUserId, 22_000);
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Snowflake} channelId
 * @param {import('discord.js').AuditLogEvent} auditType
 */
async function channelAuditOnce(guild, channelId, auditType, maxAgeMs) {
    try {
        const logs = await guild.fetchAuditLogs({ type: auditType, limit: 10 });
        const now = Date.now();
        for (const entry of logs.entries.values()) {
            if (now - entry.createdTimestamp > maxAgeMs) continue;
            if (entry.targetId !== channelId) continue;
            return executorFromEntry(entry);
        }
    } catch {
        return null;
    }
    return null;
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Snowflake} channelId
 * @param {import('discord.js').AuditLogEvent} auditType
 */
export async function resolveChannelExecutor(guild, channelId, auditType) {
    let exec = await channelAuditOnce(guild, channelId, auditType, 12_000);
    if (exec) return exec;
    await new Promise(r => setTimeout(r, 650));
    return channelAuditOnce(guild, channelId, auditType, 22_000);
}

/**
 * Wer hat eine einzelne Nachricht gelöscht (Audit MessageDelete).
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Snowflake} channelId
 * @param {import('discord.js').Snowflake | null} authorUserId — wenn null: neuester Treffer nur nach Kanal (ungenauer)
 */
async function messageDeleteOnce(guild, channelId, authorUserId, maxAgeMs) {
    try {
        const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 25 });
        const now = Date.now();
        for (const entry of logs.entries.values()) {
            if (now - entry.createdTimestamp > maxAgeMs) continue;
            const chId = entry.extra?.channel?.id;
            if (!chId || chId !== channelId) continue;
            if (authorUserId) {
                if (entry.targetId !== authorUserId) continue;
            }
            return executorFromEntry(entry);
        }
    } catch {
        return null;
    }
    return null;
}

export async function resolveMessageDeleteExecutor(guild, channelId, authorUserId) {
    let exec = await messageDeleteOnce(guild, channelId, authorUserId, 12_000);
    if (exec) return exec;
    await new Promise(r => setTimeout(r, 650));
    return messageDeleteOnce(guild, channelId, authorUserId, 22_000);
}

/**
 * Massen-Löschung: discord.js liefert bei MessageBulkDelete im extra nur `count` (ohne Kanal).
 * @param {import('discord.js').Guild} guild
 * @param {number} deletedCount
 */
async function messageBulkDeleteOnce(guild, deletedCount, maxAgeMs) {
    try {
        const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MessageBulkDelete, limit: 15 });
        const now = Date.now();
        for (const entry of logs.entries.values()) {
            if (now - entry.createdTimestamp > maxAgeMs) continue;
            const cnt = Number(entry.extra?.count);
            if (cnt !== deletedCount) continue;
            return executorFromEntry(entry);
        }
    } catch {
        return null;
    }
    return null;
}

export async function resolveMessageBulkDeleteExecutor(guild, deletedCount) {
    let exec = await messageBulkDeleteOnce(guild, deletedCount, 12_000);
    if (exec) return exec;
    await new Promise(r => setTimeout(r, 650));
    return messageBulkDeleteOnce(guild, deletedCount, 22_000);
}
