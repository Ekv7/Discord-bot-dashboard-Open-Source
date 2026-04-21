import * as store from './store.js';
import { escapeHtml, trunc } from './logHtml.js';
import { resolveMessageBulkDeleteExecutor, resolveMessageDeleteExecutor } from './auditExecutorLookup.js';
import { fetchExecutorRoles } from './executorRoles.js';

const MAX_DELETE_TEXT = 900;

/**
 * @param {import('discord.js').Message | import('discord.js').PartialMessage} message
 */
function describeDeletedMessageBody(message) {
    const parts = [];
    const raw = typeof message.content === 'string' ? message.content.trim() : '';
    if (raw) {
        parts.push(`<b>Text:</b> ${escapeHtml(trunc(raw, MAX_DELETE_TEXT))}`);
    }

    const atts = message.attachments ? [...message.attachments.values()] : [];
    if (atts.length > 0) {
        const names = atts
            .slice(0, 8)
            .map(a => a.name || a.url || 'Datei')
            .map(n => escapeHtml(trunc(n, 120)));
        const more = atts.length > 8 ? ` … (+${atts.length - 8})` : '';
        parts.push(`<b>Anhänge (${atts.length}):</b> ${names.join(', ')}${more}`);
    }

    const embedN = message.embeds?.length ?? 0;
    if (embedN > 0) {
        parts.push(`<b>Embeds:</b> ${embedN}`);
    }

    const stickers = message.stickers?.size ?? 0;
    if (stickers > 0) {
        parts.push(`<b>Sticker:</b> ${stickers}`);
    }

    if (parts.length === 0) {
        return '<i>Kein Text/Anhang im Bot-Cache — im Discord-Portal „Message Content Intent“ aktivieren und Bot neu starten. Ältere/ungecachte Nachrichten lassen sich oft nicht rekonstruieren.</i>';
    }
    return parts.join('<br>');
}

/**
 * @param {import('discord.js').Client} client
 */
export function installMessageLogEvents(client) {
    client.on('messageDelete', message => {
        void (async () => {
            try {
                if (!message.guildId) return;
                const guild = message.guild ?? client.guilds.cache.get(message.guildId);
                if (!guild) return;
                const ch =
                    'name' in message.channel && message.channel.name
                        ? message.channel.name
                        : message.channelId;
                const authorTag =
                    message.author?.tag ??
                    (message.author?.id ? `User·${message.author.id.slice(-8)}` : 'Unbekannt');
                const authorId = message.author?.id ?? null;
                const body = describeDeletedMessageBody(message);
                const exec = await resolveMessageDeleteExecutor(guild, message.channelId, authorId);
                const executorRoles = exec ? await fetchExecutorRoles(guild, exec.id) : [];
                let msgHtml = `<b>Nachricht gelöscht</b> in <b>#${escapeHtml(ch)}</b><br>${body}`;
                if (!exec) {
                    msgHtml =
                        '<b>Gelöscht von:</b> <i>Unbekannt</i> (kein passender Audit-Eintrag oder keine Rechte „Audit-Log anzeigen“).<br>' +
                        msgHtml;
                }
                store.pushServerLog({
                    type: 'message',
                    user: authorTag,
                    userId: authorId,
                    guildId: guild.id,
                    msg: msgHtml,
                    channel: typeof ch === 'string' ? ch : null,
                    ...(exec
                        ? { executorTag: exec.tag, executorId: exec.id, executorRoles }
                        : {})
                });
            } catch (e) {
                console.error('messageDelete log:', e);
            }
        })();
    });

    client.on('messageDeleteBulk', messages => {
        void (async () => {
            try {
                const first = messages.first();
                const channel = first?.channel;
                if (!channel || !('guildId' in channel) || !channel.guildId) return;
                const guild = channel.guild;
                const chName = 'name' in channel && channel.name ? channel.name : channel.id;
                const maxLines = 12;
                const lines = [];
                let n = 0;
                for (const msg of messages.values()) {
                    if (n >= maxLines) break;
                    const auth =
                        msg.author?.tag ??
                        (msg.author?.id ? `User·${msg.author.id.slice(-8)}` : 'Unbekannt');
                    const raw = typeof msg.content === 'string' ? msg.content.trim() : '';
                    const att = msg.attachments?.size ?? 0;
                    if (raw) {
                        lines.push(`<b>${escapeHtml(auth)}:</b> ${escapeHtml(trunc(raw, 200))}`);
                    } else if (att > 0) {
                        lines.push(`<b>${escapeHtml(auth)}:</b> <i>${att} Anhang/Anhänge</i>`);
                    } else {
                        lines.push(`<b>${escapeHtml(auth)}:</b> <i>(kein Text im Cache)</i>`);
                    }
                    n += 1;
                }
                const rest = messages.size - n;
                const tail =
                    rest > 0
                        ? `<br><i>… und ${rest} weitere (nicht einzeln aufgelistet).</i>`
                        : '';
                const block = lines.length > 0 ? `${lines.join('<br>')}${tail}` : '<i>Keine Inhalte im Cache.</i>';
                const exec = await resolveMessageBulkDeleteExecutor(guild, messages.size);
                const executorRoles = exec ? await fetchExecutorRoles(guild, exec.id) : [];
                let msgHtml = `<b>Massen-Löschung</b>: ${messages.size} Nachrichten in <b>#${escapeHtml(chName)}</b><br>${block}`;
                if (!exec) {
                    msgHtml =
                        '<b>Gelöscht von:</b> <i>Unbekannt</i> (Audit nur mit Anzahl, ggf. mehrere Löschungen gleicher Größe).<br>' +
                        msgHtml;
                }
                store.pushServerLog({
                    type: 'message',
                    user: '—',
                    userId: null,
                    guildId: guild.id,
                    msg: msgHtml,
                    channel: chName,
                    ...(exec
                        ? { executorTag: exec.tag, executorId: exec.id, executorRoles }
                        : {})
                });
            } catch (e) {
                console.error('messageDeleteBulk log:', e);
            }
        })();
    });

    client.on('messageUpdate', (oldMessage, newMessage) => {
        try {
            if (!newMessage.guildId) return;
            const oldC = typeof oldMessage.content === 'string' ? oldMessage.content : '';
            const newC = typeof newMessage.content === 'string' ? newMessage.content : '';
            if (oldC === newC && oldMessage.embeds.length === newMessage.embeds.length) return;
            const ch =
                'name' in newMessage.channel && newMessage.channel.name
                    ? newMessage.channel.name
                    : newMessage.channelId;
            const authorTag = newMessage.author?.tag ?? 'Unbekannt';
            const authorId = newMessage.author?.id ?? null;
            store.pushServerLog({
                type: 'message',
                user: authorTag,
                userId: authorId,
                guildId: newMessage.guildId,
                msg: `<b>Nachricht bearbeitet</b> in <b>#${escapeHtml(ch)}</b><br><b>Vorher:</b> ${escapeHtml(trunc(oldC, 200)) || '—'}<br><b>Nachher:</b> ${escapeHtml(trunc(newC, 200)) || '—'}`,
                channel: typeof ch === 'string' ? ch : null
            });
        } catch (e) {
            console.error('messageUpdate log:', e);
        }
    });
}
