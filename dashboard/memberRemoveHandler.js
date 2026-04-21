import { AuditLogEvent } from 'discord.js';
import * as store from './store.js';
import * as memberStats from './memberStats.js';

const RECENT_MS = 30_000;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isUnknownGuildError(error) {
    const code = Number(error?.code || 0);
    const msg = String(error?.message || '');
    return code === 10004 || /unknown guild/i.test(msg);
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Snowflake} userId
 * @returns {Promise<'ban' | 'kick' | null>}
 */
async function recentBanOrKick(guild, userId) {
    const now = Date.now();
    let bans;
    try {
        bans = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 8 });
    } catch (e) {
        if (isUnknownGuildError(e)) return null;
        throw e;
    }
    for (const e of bans.entries.values()) {
        if (now - e.createdTimestamp > RECENT_MS) continue;
        if (e.targetId === userId) return 'ban';
    }
    let kicks;
    try {
        kicks = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 8 });
    } catch (e) {
        if (isUnknownGuildError(e)) return null;
        throw e;
    }
    for (const e of kicks.entries.values()) {
        if (now - e.createdTimestamp > RECENT_MS) continue;
        if (e.targetId === userId) return 'kick';
    }
    return null;
}

/**
 * Leave nur, wenn kein Ban/Kick — Kick selbst kommt aus guildAuditLogEntryCreate (auditLogKick).
 * Mehrfach versuchen, weil das Audit oft kurz nach dem Remove erscheint.
 * @param {import('discord.js').Client} client
 */
export function installMemberRemoveHandler(client) {
    client.on('guildMemberRemove', async member => {
        try {
            memberStats.recordLeave(member.guild?.id);
        } catch (e) {
            console.error('memberStats.recordLeave:', e);
        }

        const userId = member.user?.id;
        const tag = member.user?.tag ?? 'Unbekannt';
        const guild = member.guild;

        if (!userId || !guild) {
            store.pushServerLog({
                type: 'leave',
                user: tag,
                userId: userId ?? null,
                guildId: guild?.id ?? null,
                msg: 'Hat den Server verlassen',
                channel: null
            });
            return;
        }

        try {
            let verdict = await recentBanOrKick(guild, userId);
            if (verdict === 'ban' || verdict === 'kick') return;

            await delay(700);
            verdict = await recentBanOrKick(guild, userId);
            if (verdict === 'ban' || verdict === 'kick') return;

            await delay(2200);
            verdict = await recentBanOrKick(guild, userId);
            if (verdict === 'ban' || verdict === 'kick') return;
        } catch (e) {
            if (!isUnknownGuildError(e)) {
                console.error('guildMemberRemove audit check:', e);
            }
        }

        store.pushServerLog({
            type: 'leave',
            user: tag,
            userId,
            guildId: guild.id,
            msg: 'Hat den Server verlassen',
            channel: null
        });
    });
}
