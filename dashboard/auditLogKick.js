import { AuditLogEvent } from 'discord.js';
import * as store from './store.js';
import { fetchExecutorRoles } from './executorRoles.js';
import { escapeHtml } from './logHtml.js';

/**
 * Kick als eigener Log-Typ (Dashboard-Filter „Kick“), inkl. Kicker + Rollen.
 * Wird von guildAuditLogEntryCreate ausgelöst — zuverlässiger als sofortiges fetch beim MemberRemove.
 *
 * @param {import('discord.js').GuildAuditLogsEntry} entry
 * @param {import('discord.js').Guild} guild
 */
export async function pushKickFromAuditEntry(entry, guild) {
    if (entry.action !== AuditLogEvent.MemberKick) return;

    const victimId = entry.targetId ?? (entry.target && 'id' in entry.target ? entry.target.id : null);
    const t = entry.target;
    const victimTag =
        t && 'tag' in t && t.tag
            ? t.tag
            : t && 'username' in t && typeof t.username === 'string'
              ? t.username
              : victimId
                ? `User·${String(victimId).slice(-8)}`
                : 'Unbekannt';

    const execId = entry.executorId ?? null;
    const execTag =
        entry.executor?.tag ??
        entry.executor?.username ??
        (execId ? `User·${execId.slice(-8)}` : 'Unbekannt');

    const executorRoles = await fetchExecutorRoles(guild, execId);
    const reason = entry.reason?.trim();
    const reasonPart =
        reason && reason.length > 0 ? ` <b>Grund:</b> ${escapeHtml(reason.slice(0, 300))}` : '';

    store.pushServerLog({
        type: 'kick',
        user: victimTag,
        userId: victimId,
        guildId: guild.id,
        executorTag: execTag,
        executorId: execId,
        executorRoles,
        msg: reason ? `<b>Kick</b>${reasonPart}` : '<b>Kick</b> · kein Grund angegeben',
        channel: null
    });
}
