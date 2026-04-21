import { AuditLogEvent } from 'discord-api-types/v10';

function esc(s) {
    if (s == null || s === '') return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function targetName(target) {
    if (!target) return '?';
    if (typeof target.name === 'string') return target.name;
    if (typeof target.username === 'string') return target.username;
    if (typeof target.tag === 'string') return target.tag;
    if (target.id) return target.id;
    return '?';
}

function rolesFromChanges(changes, key) {
    const c = changes.find(x => x.key === key);
    if (!c?.new) return [];
    const arr = Array.isArray(c.new) ? c.new : [c.new];
    return arr.map(r => (r && typeof r === 'object' && r.name ? r.name : String(r?.id ?? r)));
}

/**
 * @param {import('discord.js').GuildAuditLogsEntry} entry
 * @param {import('discord.js').Guild} guild
 * @returns {{ msg: string, channel: string | null }}
 */
export function describeAuditEntry(entry, guild) {
    const t = entry.target;
    const chName = t && 'name' in t && typeof t.name === 'string' ? t.name : null;

    let msg = '';
    let channel = chName ? `#${chName}` : null;

    switch (entry.action) {
        case AuditLogEvent.ChannelCreate:
            msg = `Channel <b>erstellt</b>: <b>${esc(targetName(t))}</b>`;
            break;
        case AuditLogEvent.ChannelUpdate:
            msg = `Channel <b>bearbeitet</b>: <b>${esc(targetName(t))}</b>${formatChanges(entry.changes)}`;
            break;
        case AuditLogEvent.ChannelDelete:
            msg = `Channel <b>gelöscht</b>: <b>${esc(targetName(t))}</b>`;
            break;
        case AuditLogEvent.ChannelOverwriteCreate:
        case AuditLogEvent.ChannelOverwriteUpdate:
        case AuditLogEvent.ChannelOverwriteDelete: {
            const ch = t && 'name' in t ? targetName(t) : '?';
            const act =
                entry.action === AuditLogEvent.ChannelOverwriteCreate
                    ? 'Berechtigung hinzugefügt'
                    : entry.action === AuditLogEvent.ChannelOverwriteDelete
                      ? 'Berechtigung entfernt'
                      : 'Berechtigung geändert';
            msg = `Channel <b>${esc(ch)}</b>: ${act}`;
            break;
        }
        case AuditLogEvent.MemberKick:
            msg = `Mitglied <b>gekickt</b>: <b>${esc(targetName(t))}</b>`;
            break;
        case AuditLogEvent.MemberBanAdd:
            msg = `Mitglied <b>gebannt</b>: <b>${esc(targetName(t))}</b>`;
            break;
        case AuditLogEvent.MemberBanRemove:
            msg = `Ban <b>aufgehoben</b> für: <b>${esc(targetName(t))}</b>`;
            break;
        case AuditLogEvent.MemberUpdate: {
            const nick = entry.changes.find(c => c.key === 'nick');
            if (nick) {
                msg = `Profil <b>${esc(targetName(t))}</b>: Nickname ${esc(String(nick.old ?? '—'))} → ${esc(String(nick.new ?? '—'))}`;
            } else {
                msg = `Mitglied <b>aktualisiert</b>: <b>${esc(targetName(t))}</b>${formatChanges(entry.changes)}`;
            }
            break;
        }
        case AuditLogEvent.MemberRoleUpdate: {
            const add = rolesFromChanges(entry.changes, '$add');
            const rem = rolesFromChanges(entry.changes, '$remove');
            const parts = [];
            if (add.length) parts.push(`<b>+Rollen:</b> ${add.map(esc).join(', ')}`);
            if (rem.length) parts.push(`<b>−Rollen:</b> ${rem.map(esc).join(', ')}`);
            msg = `Rollen bei <b>${esc(targetName(t))}</b>: ${parts.join(' · ') || '(ohne Detail)'}`;
            break;
        }
        case AuditLogEvent.RoleCreate:
            msg = `Rolle <b>erstellt</b>: <b>${esc(targetName(t))}</b>`;
            break;
        case AuditLogEvent.RoleUpdate:
            msg = `Rolle <b>bearbeitet</b>: <b>${esc(targetName(t))}</b>${formatChanges(entry.changes)}`;
            break;
        case AuditLogEvent.RoleDelete:
            msg = `Rolle <b>gelöscht</b>: <b>${esc(targetName(t))}</b>`;
            break;
        case AuditLogEvent.MessageDelete: {
            const ex = entry.extra;
            const cname =
                ex && typeof ex.channel === 'object' && ex.channel && 'name' in ex.channel
                    ? ex.channel.name
                    : null;
            msg = `Nachricht <b>gelöscht</b> (Ziel-User: <b>${esc(targetName(t))}</b>)`;
            if (cname) {
                channel = `#${cname}`;
                msg += ` in <b>#${esc(cname)}</b>`;
            }
            break;
        }
        case AuditLogEvent.MessageBulkDelete: {
            const ex = entry.extra;
            const cnt = ex?.count ?? '?';
            const cname =
                ex && typeof ex.channel === 'object' && ex.channel && 'name' in ex.channel
                    ? ex.channel.name
                    : null;
            msg = `<b>${esc(String(cnt))}</b> Nachrichten massenhaft gelöscht`;
            if (cname) {
                channel = `#${cname}`;
                msg += ` in <b>#${esc(cname)}</b>`;
            }
            break;
        }
        case AuditLogEvent.InviteCreate:
            msg = `Einladung <b>erstellt</b>${t && 'code' in t ? `: Code <b>${esc(t.code)}</b>` : ''}`;
            break;
        case AuditLogEvent.InviteDelete:
            msg = `Einladung <b>gelöscht</b>`;
            break;
        case AuditLogEvent.WebhookCreate:
        case AuditLogEvent.WebhookUpdate:
        case AuditLogEvent.WebhookDelete:
            msg = `Webhook <b>${entry.actionType.toLowerCase()}</b>: <b>${esc(targetName(t))}</b>`;
            break;
        case AuditLogEvent.ThreadCreate:
        case AuditLogEvent.ThreadUpdate:
        case AuditLogEvent.ThreadDelete:
            msg = `Thread <b>${entry.actionType.toLowerCase()}</b>: <b>${esc(targetName(t))}</b>`;
            break;
        case AuditLogEvent.GuildUpdate:
            msg = `Servereinstellungen <b>geändert</b>${formatChanges(entry.changes)}`;
            channel = guild.name ?? null;
            break;
        default:
            msg = `Audit <b>${esc(String(entry.action))}</b> (${esc(entry.actionType)}) · Ziel: <b>${esc(targetName(t))}</b>`;
    }

    if (entry.reason) {
        msg += ` · <span style="color:#8b90a0">Grund: ${esc(entry.reason)}</span>`;
    }

    return { msg, channel };
}

function formatChanges(changes) {
    if (!changes?.length) return '';
    const bits = changes
        .filter(c => !['$add', '$remove'].includes(c.key))
        .slice(0, 4)
        .map(c => `${esc(c.key)}: ${esc(String(c.old ?? '—'))}→${esc(String(c.new ?? '—'))}`);
    if (!bits.length) return '';
    return ` <span style="color:#8b90a0">(${bits.join('; ')})</span>`;
}
