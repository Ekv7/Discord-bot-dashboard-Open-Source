import * as store from './store.js';
import { escapeHtml } from './logHtml.js';
import { executorPrefixLine, resolveMemberUpdateExecutor } from './auditExecutorLookup.js';

/**
 * @param {import('discord.js').Client} client
 */
export function installMemberInviteLogEvents(client) {
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        try {
            const tag = newMember.user.tag;
            const uid = newMember.user.id;
            const guild = newMember.guild;

            const nickChanged = oldMember.nickname !== newMember.nickname;
            const tOld = oldMember.communicationDisabledUntil?.getTime() ?? null;
            const tNew = newMember.communicationDisabledUntil?.getTime() ?? null;
            const timeoutChanged = tOld !== tNew;
            const bOld = oldMember.premiumSince?.getTime() ?? null;
            const bNew = newMember.premiumSince?.getTime() ?? null;
            const boostChanged = bOld !== bNew;

            if (!nickChanged && !timeoutChanged && !boostChanged) return;

            let execPromise = null;
            const prefixHtml = async () => {
                if (!execPromise) execPromise = resolveMemberUpdateExecutor(guild, uid);
                return executorPrefixLine(await execPromise);
            };

            if (nickChanged) {
                const o = oldMember.nickname ?? '(Standard)';
                const n = newMember.nickname ?? '(Standard)';
                const p = await prefixHtml();
                store.pushServerLog({
                    type: 'nickname',
                    user: tag,
                    userId: uid,
                    guildId: guild.id,
                    msg: `${p}<b>Nickname geändert:</b> „${escapeHtml(o)}“ → „${escapeHtml(n)}“`,
                    channel: null
                });
            }

            if (timeoutChanged) {
                let detail;
                if (tNew && tNew > Date.now()) {
                    detail = `Timeout bis ${new Date(tNew).toLocaleString('de-DE')}`;
                } else {
                    detail = 'Timeout aufgehoben';
                }
                const p = await prefixHtml();
                store.pushServerLog({
                    type: 'member_upd',
                    user: tag,
                    userId: uid,
                    guildId: guild.id,
                    msg: `${p}<b>Mitglied (Moderation):</b> ${detail}`,
                    channel: null
                });
            }

            if (boostChanged) {
                const detail =
                    bNew && !bOld
                        ? 'Server Boost gestartet'
                        : !bNew && bOld
                          ? 'Server Boost beendet'
                          : 'Server Boost geändert';
                const p = await prefixHtml();
                store.pushServerLog({
                    type: 'member_upd',
                    user: tag,
                    userId: uid,
                    guildId: guild.id,
                    msg: `${p}<b>Mitglied:</b> ${detail}`,
                    channel: null
                });
            }
        } catch (e) {
            console.error('guildMemberUpdate log:', e);
        }
    });

    client.on('inviteCreate', invite => {
        try {
            const guild = invite.guild;
            if (!guild) return;
            const inviter = invite.inviter?.tag ?? 'Unbekannt';
            const inviterId = invite.inviter?.id ?? null;
            const ch = invite.channel && 'name' in invite.channel ? invite.channel.name : '?';
            const code = invite.code ? `${invite.code.slice(0, 4)}…` : '?';
            const maxUses = invite.maxUses == null ? '∞' : String(invite.maxUses);
            store.pushServerLog({
                type: 'invite',
                user: inviter,
                userId: inviterId,
                guildId: guild.id,
                msg: `<b>Einladung erstellt</b> · Code <code>${escapeHtml(code)}</code> · Kanal <b>#${escapeHtml(ch)}</b> · max. ${maxUses} Nutzungen`,
                channel: ch
            });
        } catch (e) {
            console.error('inviteCreate log:', e);
        }
    });

    client.on('inviteDelete', invite => {
        try {
            const guild = invite.guild;
            if (!guild) return;
            const inviter = invite.inviter?.tag ?? '—';
            const inviterId = invite.inviter?.id ?? null;
            const ch = invite.channel && 'name' in invite.channel ? invite.channel.name : '?';
            const code = invite.code ? `${invite.code.slice(0, 4)}…` : '?';
            store.pushServerLog({
                type: 'invite',
                user: inviter,
                userId: inviterId,
                guildId: guild.id,
                msg: `<b>Einladung gelöscht</b> · Code <code>${escapeHtml(code)}</code> · Kanal <b>#${escapeHtml(ch)}</b>`,
                channel: ch
            });
        } catch (e) {
            console.error('inviteDelete log:', e);
        }
    });
}
