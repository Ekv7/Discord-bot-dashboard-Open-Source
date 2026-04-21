import { AuditLogEvent } from 'discord.js';
import * as store from './store.js';
import { escapeHtml, channelKind } from './logHtml.js';
import { executorPrefixLine, resolveChannelExecutor } from './auditExecutorLookup.js';

/**
 * @param {import('discord.js').Client} client
 */
export function installChannelLogEvents(client) {
    client.on('channelCreate', ch => {
        void (async () => {
            try {
                if (!ch.guild) return;
                const kind = channelKind(ch.type);
                const exec = await resolveChannelExecutor(ch.guild, ch.id, AuditLogEvent.ChannelCreate);
                const p = executorPrefixLine(exec);
                store.pushServerLog({
                    type: 'channel',
                    user: 'Server',
                    userId: ch.guild.id,
                    guildId: ch.guild.id,
                    msg: `${p}<b>Kanal erstellt:</b> <b>#${escapeHtml(ch.name)}</b> (${kind}) · ${escapeHtml(ch.guild.name)}`,
                    channel: ch.name
                });
            } catch (e) {
                console.error('channelCreate log:', e);
            }
        })();
    });

    client.on('channelDelete', ch => {
        void (async () => {
            try {
                if (!ch.guild) return;
                const exec = await resolveChannelExecutor(ch.guild, ch.id, AuditLogEvent.ChannelDelete);
                const p = executorPrefixLine(exec);
                store.pushServerLog({
                    type: 'channel',
                    user: 'Server',
                    userId: ch.guild.id,
                    guildId: ch.guild.id,
                    msg: `${p}<b>Kanal gelöscht:</b> <b>#${escapeHtml(ch.name)}</b> · ${escapeHtml(ch.guild.name)}`,
                    channel: ch.name
                });
            } catch (e) {
                console.error('channelDelete log:', e);
            }
        })();
    });

    client.on('channelUpdate', (oldCh, newCh) => {
        void (async () => {
            try {
                if (!newCh.guild) return;
                const parts = [];
                if (oldCh.name !== newCh.name) {
                    parts.push(`Name: „${escapeHtml(oldCh.name)}“ → „${escapeHtml(newCh.name)}“`);
                }
                if ('topic' in oldCh && 'topic' in newCh && oldCh.topic !== newCh.topic) {
                    parts.push('Thema geändert');
                }
                if ('nsfw' in oldCh && 'nsfw' in newCh && oldCh.nsfw !== newCh.nsfw) {
                    parts.push(newCh.nsfw ? 'NSFW aktiviert' : 'NSFW deaktiviert');
                }
                if ('bitrate' in oldCh && 'bitrate' in newCh && oldCh.bitrate !== newCh.bitrate) {
                    parts.push('Bitrate geändert');
                }
                if (parts.length === 0) return;
                const exec = await resolveChannelExecutor(newCh.guild, newCh.id, AuditLogEvent.ChannelUpdate);
                const p = executorPrefixLine(exec);
                store.pushServerLog({
                    type: 'channel',
                    user: 'Server',
                    userId: newCh.guild.id,
                    guildId: newCh.guild.id,
                    msg: `${p}<b>Kanal aktualisiert:</b> <b>#${escapeHtml(newCh.name)}</b> · ${parts.join(' · ')} · ${escapeHtml(newCh.guild.name)}`,
                    channel: newCh.name
                });
            } catch (e) {
                console.error('channelUpdate log:', e);
            }
        })();
    });
}
