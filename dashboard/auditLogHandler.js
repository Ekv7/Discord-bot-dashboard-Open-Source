import { AuditLogEvent } from 'discord.js';
import * as store from './store.js';
import { describeAuditEntry } from './auditLogFormat.js';
import { fetchExecutorRoles } from './executorRoles.js';
import { pushKickFromAuditEntry } from './auditLogKick.js';

/**
 * @param {import('discord.js').GuildAuditLogsEntry} entry
 * @param {import('discord.js').Guild} guild
 */
export async function handleGuildAuditLogEntry(entry, guild) {
    const onlyGuild = process.env.AUDIT_LOG_GUILD_ID;
    if (onlyGuild && guild.id !== onlyGuild) return;

    if (entry.action === AuditLogEvent.MemberKick) {
        await pushKickFromAuditEntry(entry, guild);
        return;
    }

    if (entry.action === AuditLogEvent.MessageDelete || entry.action === AuditLogEvent.MessageBulkDelete) {
        return;
    }

    const legacyFilter = process.env.AUDIT_LOG_EXECUTOR_ROLE_ID;
    let executorRoles = await fetchExecutorRoles(guild, entry.executorId);

    if (legacyFilter) {
        if (!entry.executorId) return;
        if (!executorRoles.some(r => r.id === legacyFilter)) return;
    }

    const { msg, channel } = describeAuditEntry(entry, guild);
    const execTag =
        entry.executor?.tag ??
        entry.executor?.username ??
        (entry.executorId ? `User·${entry.executorId.slice(-8)}` : 'System / Integration');

    store.pushServerLog({
        type: 'audit',
        user: execTag,
        userId: entry.executorId,
        guildId: guild.id,
        msg: `<b>Audit:</b> ${msg}`,
        channel,
        executorRoles
    });
}
