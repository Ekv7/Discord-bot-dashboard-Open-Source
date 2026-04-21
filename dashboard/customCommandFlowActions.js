import {
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    ChannelType,
    AttachmentBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} from 'discord.js';
import * as store from './store.js';
import { substituteFlowText } from './flowTextSubstitute.js';

/** Slash-Option „ziel“ nötig, wenn einer dieser Blöcke vorkommt. */
export const FLOW_NODE_TYPES_REQUIRING_ZIEL = new Set([
    'action_kick',
    'action_ban',
    'action_timeout',
    'action_role_add',
    'action_role_remove',
    'bg_server_nickname',
    'bg_server_purge',
    'bg_voice_move',
    'bg_voice_disconnect',
    'bg_voice_kick',
    'bg_voice_mute',
    'bg_voice_deafen',
    'bg_role_add_all',
    'bg_role_remove_all',
    'cond_user'
]);

/**
 * @param {unknown} hex
 */
function parseEmbedColor(hex) {
    const s = String(hex || '')
        .replace('#', '')
        .trim();
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return 0x5865f2;
    return parseInt(s, 16);
}

/**
 * @param {object} api
 * @param {string} text
 */
function sub(api, text) {
    return substituteFlowText(text, {
        interaction: api.interaction,
        targetUser: api.targetUser,
        targetMember: api.targetMember,
        flowVars: api.flowVars
    });
}

/**
 * @param {FlowNode} node
 * @param {object} api
 * @returns {Promise<{ skipDefaultEdges?: boolean }|void>}
 */
export async function executeFlowNode(node, api) {
    const d = node.data && typeof node.data === 'object' ? node.data : {};
    const ix = api.interaction;
    const guild = ix.guild;
    if (!guild && node.type !== 'trigger_slash' && !String(node.type || '').startsWith('bg_note')) {
        if (!['logic_error_handler', 'trigger_slash'].includes(node.type)) {
            /* noop for guildless handled elsewhere */
        }
    }

    switch (node.type) {
        case 'trigger_slash':
            return;
        case 'action_reply_text': {
            const text = sub(api, typeof d.content === 'string' ? d.content : '');
            const ephemeral = Boolean(d.ephemeral);
            if (text.trim()) await api.sendLine(text, ephemeral);
            return;
        }
        case 'action_reply_embed': {
            const title = sub(api, typeof d.title === 'string' ? d.title : '');
            const description = sub(api, typeof d.description === 'string' ? d.description : '');
            const color = parseEmbedColor(typeof d.color === 'string' ? d.color : '');
            const ephemeral = Boolean(d.ephemeral);
            const embed = new EmbedBuilder().setColor(color);
            if (title) embed.setTitle(title.slice(0, 256));
            if (description) embed.setDescription(description.slice(0, 4000));
            await api.sendRich({ embeds: [embed] }, ephemeral);
            return;
        }
        case 'action_kick': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.KickMembers, 'Mitglieder kicken'))) return;
            const m = api.targetMember;
            if (!m) throw new Error('Zielmitglied nicht gefunden.');
            const reason = sub(api, typeof d.reason === 'string' ? d.reason : '') || 'Flow Kick';
            await m.kick(reason.slice(0, 400));
            return;
        }
        case 'action_ban': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.BanMembers, 'Mitglieder bannen'))) return;
            const u = api.targetUser;
            if (!u) throw new Error('Zielnutzer fehlt.');
            let days = Number(d.deleteMessageDays);
            if (!Number.isFinite(days)) days = 0;
            days = Math.min(7, Math.max(0, Math.floor(days)));
            const reason = sub(api, typeof d.reason === 'string' ? d.reason : '') || 'Flow Ban';
            await guild.members.ban(u, { deleteMessageDays: days, reason: reason.slice(0, 400) });
            return;
        }
        case 'action_timeout': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.ModerateMembers, 'Timeout setzen'))) return;
            const m = api.targetMember;
            if (!m) throw new Error('Zielmitglied nicht gefunden.');
            let minutes = Number(d.minutes);
            if (!Number.isFinite(minutes)) minutes = 10;
            minutes = Math.min(40320, Math.max(1, Math.floor(minutes)));
            const reason = sub(api, typeof d.reason === 'string' ? d.reason : '') || 'Flow Timeout';
            await m.timeout(minutes * 60_000, reason.slice(0, 400));
            return;
        }
        case 'action_role_add': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.ManageRoles, 'Rollen verwalten'))) return;
            const m = api.targetMember;
            if (!m) throw new Error('Zielmitglied nicht gefunden.');
            const roleId = String(d.roleId || '').trim();
            if (!/^\d{17,22}$/.test(roleId)) throw new Error('Ungültige Rollen-ID.');
            const role = guild.roles.cache.get(roleId);
            if (!role) throw new Error('Rolle nicht gefunden.');
            const me = guild.members.me;
            if (!me || role.position >= me.roles.highest.position) throw new Error('Rolle liegt zu hoch für den Bot.');
            await m.roles.add(role, 'Flow');
            store.recordRole(true);
            return;
        }
        case 'action_role_remove': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.ManageRoles, 'Rollen verwalten'))) return;
            const m = api.targetMember;
            if (!m) throw new Error('Zielmitglied nicht gefunden.');
            const roleId = String(d.roleId || '').trim();
            if (!/^\d{17,22}$/.test(roleId)) throw new Error('Ungültige Rollen-ID.');
            const role = guild.roles.cache.get(roleId);
            if (!role) throw new Error('Rolle nicht gefunden.');
            const me = guild.members.me;
            if (!me || role.position >= me.roles.highest.position) throw new Error('Rolle liegt zu hoch für den Bot.');
            await m.roles.remove(role, 'Flow');
            store.recordRole(false);
            return;
        }
        case 'logic_condition':
        case 'cond_role': {
            return;
        }
        case 'logic_error_handler':
            return;
        case 'bg_msg_send_or_edit': {
            const target = String(d.target || 'reply');
            const content = sub(api, typeof d.content === 'string' ? d.content : '');
            const ephemeral = Boolean(d.ephemeral);
            const embedTitle = sub(api, typeof d.embedTitle === 'string' ? d.embedTitle : '');
            const embedDesc = sub(api, typeof d.embedDescription === 'string' ? d.embedDescription : '');
            const payload = { allowedMentions: { parse: [] } };
            if (content) payload.content = content.slice(0, 2000);
            if (embedTitle || embedDesc) {
                const emb = new EmbedBuilder().setColor(parseEmbedColor(d.embedColor));
                if (embedTitle) emb.setTitle(embedTitle.slice(0, 256));
                if (embedDesc) emb.setDescription(embedDesc.slice(0, 4000));
                payload.embeds = [emb];
            }
            if (target === 'reply') {
                const flags = ephemeral ? MessageFlags.Ephemeral : undefined;
                if (!ix.deferred && !ix.replied) {
                    await ix.reply({ ...payload, flags });
                    api.replyState.usedFirstReply = true;
                } else if (!api.replyState.usedFirstReply) {
                    await ix.editReply(payload);
                    api.replyState.usedFirstReply = true;
                } else {
                    await ix.followUp({ ...payload, flags });
                }
            } else if (target === 'channel') {
                const cid = String(d.channelId || '').trim();
                const ch = cid ? await guild.channels.fetch(cid).catch(() => null) : ix.channel;
                if (!ch || !ch.isTextBased()) throw new Error('Kanal nicht gefunden.');
                await ch.send(payload);
            } else if (target === 'dm') {
                const uid = String(d.userId || api.targetUser?.id || ix.user.id).trim();
                const u = await ix.client.users.fetch(uid).catch(() => null);
                if (!u) throw new Error('User für DM nicht gefunden.');
                await u.send(payload);
            }
            return;
        }
        case 'bg_msg_edit_components': {
            await api.sendLine('ℹ️ Komponenten bearbeiten: bitte Nachrichten-ID + Kanal konfigurieren (erweiterte Nutzung).', true);
            return;
        }
        case 'bg_msg_send_form': {
            const title = sub(api, String(d.modalTitle || 'Formular')).slice(0, 45);
            const label1 = sub(api, String(d.field1Label || 'Eingabe')).slice(0, 45);
            const modal = new ModalBuilder().setCustomId(`flow_modal_${Date.now()}`).setTitle(title);
            const ti = new TextInputBuilder()
                .setCustomId('flow_field1')
                .setLabel(label1.slice(0, 45))
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(400);
            modal.addComponents(new ActionRowBuilder().addComponents(ti));
            try {
                await ix.showModal(modal);
                return { skipDefaultEdges: true };
            } catch {
                await api.sendLine('❌ Modal konnte nicht geoeffnet werden (evtl. bereits eine Interaktion offen).', true);
            }
            return;
        }
        case 'bg_msg_delete': {
            const mid = String(d.messageId || '').trim();
            const cid = String(d.channelId || ix.channelId || '').trim();
            if (mid && cid) {
                const ch = await guild.channels.fetch(cid).catch(() => null);
                if (ch?.isTextBased()) {
                    const msg = await ch.messages.fetch(mid).catch(() => null);
                    if (msg) await msg.delete().catch(() => {});
                }
            } else {
                const msg = await ix.fetchReply().catch(() => null);
                if (msg) await msg.delete().catch(() => {});
            }
            return;
        }
        case 'bg_msg_publish': {
            const cid = String(d.channelId || ix.channelId || '').trim();
            const mid = String(d.messageId || '').trim();
            const ch = await guild.channels.fetch(cid).catch(() => null);
            if (!ch?.isTextBased()) throw new Error('Kanal ungültig.');
            const msg = await ch.messages.fetch(mid).catch(() => null);
            if (msg?.crosspostable) await msg.crosspost().catch(() => {});
            return;
        }
        case 'bg_msg_react': {
            const mid = String(d.messageId || '').trim();
            const cid = String(d.channelId || ix.channelId || '').trim();
            const emoji = sub(api, String(d.emoji || '👍')).trim();
            const ch = await guild.channels.fetch(cid).catch(() => null);
            if (!ch?.isTextBased()) throw new Error('Kanal ungültig.');
            const msg = mid ? await ch.messages.fetch(mid).catch(() => null) : null;
            if (msg) await msg.react(emoji).catch(() => {});
            return;
        }
        case 'bg_msg_pin': {
            const mid = String(d.messageId || '').trim();
            const cid = String(d.channelId || ix.channelId || '').trim();
            const ch = await guild.channels.fetch(cid).catch(() => null);
            if (!ch?.isTextBased()) throw new Error('Kanal ungültig.');
            const msg = await ch.messages.fetch(mid).catch(() => null);
            if (msg) await msg.pin().catch(() => {});
            return;
        }
        case 'bg_msg_transcript': {
            const cid = String(d.channelId || ix.channelId || '').trim();
            let limit = Number(d.limit);
            if (!Number.isFinite(limit)) limit = 50;
            limit = Math.min(1000, Math.max(1, Math.floor(limit)));
            const ch = await guild.channels.fetch(cid).catch(() => null);
            if (!ch?.isTextBased()) throw new Error('Kanal ungültig.');
            const msgs = await ch.messages.fetch({ limit }).catch(() => null);
            if (!msgs) return;
            const lines = [...msgs.values()]
                .reverse()
                .map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.cleanContent || ''}`)
                .join('\n');
            const buf = Buffer.from(lines.slice(0, 500_000), 'utf8');
            const att = new AttachmentBuilder(buf, { name: 'transcript.txt' });
            await api.sendRich({ content: `Transcript (${msgs.size} Nachrichten)`, files: [att] }, false);
            return;
        }
        case 'bg_var_set': {
            const k = String(d.key || '').trim();
            const v = sub(api, String(d.value ?? ''));
            if (k) api.flowVars.set(k, v);
            return;
        }
        case 'bg_var_equation': {
            const k = String(d.key || '').trim();
            if (!k) return;
            const cur = parseFloat(api.flowVars.get(k) || '0') || 0;
            const op = String(d.operation || 'add');
            const operand = parseFloat(sub(api, String(d.operand ?? '0'))) || 0;
            let next = cur;
            if (op === 'add') next = cur + operand;
            else if (op === 'subtract') next = cur - operand;
            else if (op === 'multiply') next = cur * operand;
            else if (op === 'divide' && operand !== 0) next = cur / operand;
            else if (op === 'set') next = operand;
            api.flowVars.set(k, String(next));
            return;
        }
        case 'bg_var_delete': {
            const k = String(d.key || '').trim();
            if (k) api.flowVars.delete(k);
            return;
        }
        case 'bg_api_request':
        case 'bg_api_ifttt':
            throw new Error(
                'Dieser Block ist deaktiviert (keine externen HTTP-Aufrufe). Bitte im Flow-Editor entfernen und neu speichern.'
            );
        case 'bg_loop_run': {
            let times = Number(d.times);
            if (!Number.isFinite(times)) times = 1;
            times = Math.min(50, Math.max(1, Math.floor(times)));
            const nextId = api.nextTargets(api.edges, node.id, null)[0];
            if (nextId) {
                for (let i = 0; i < times; i++) {
                    await api.runWalk(nextId);
                }
            }
            return { skipDefaultEdges: true };
        }
        case 'bg_loop_stop':
        case 'bg_note':
        case 'bg_helper_text':
            return;
        case 'bg_voice_join': {
            const vid = String(d.channelId || '').trim();
            const vc = guild.channels.cache.get(vid);
            if (!vc || vc.type !== ChannelType.GuildVoice) throw new Error('Voice-Kanal ungültig.');
            await guild.members.me.voice.setChannel(vc).catch(() => {
                throw new Error('Bot konnte Voice nicht beitreten.');
            });
            return;
        }
        case 'bg_voice_leave': {
            await guild.members.me.voice.disconnect().catch(() => {});
            return;
        }
        case 'bg_voice_move': {
            const vid = String(d.channelId || '').trim();
            const m = api.targetMember;
            if (!m?.voice?.channelId) throw new Error('Ziel ist nicht in Voice.');
            const vc = guild.channels.cache.get(vid);
            if (!vc || vc.type !== ChannelType.GuildVoice) throw new Error('Voice-Kanal ungültig.');
            await m.voice.setChannel(vc).catch(() => {
                throw new Error('Verschieben fehlgeschlagen.');
            });
            return;
        }
        case 'bg_voice_kick':
        case 'bg_voice_disconnect': {
            const m = api.targetMember;
            if (!m?.voice?.channelId) return;
            await m.voice.disconnect().catch(() => {});
            return;
        }
        case 'bg_voice_mute': {
            const m = api.targetMember;
            if (!m) throw new Error('Zielmitglied fehlt.');
            const mute = !['false', '0', 'off'].includes(String(d.mode || 'true').toLowerCase());
            await m.voice.setMute(mute).catch(() => {});
            return;
        }
        case 'bg_voice_deafen': {
            const m = api.targetMember;
            if (!m) throw new Error('Zielmitglied fehlt.');
            const deaf = !['false', '0', 'off'].includes(String(d.mode || 'true').toLowerCase());
            await m.voice.setDeaf(deaf).catch(() => {});
            return;
        }
        case 'bg_role_add_all': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.ManageRoles, 'Rollen verwalten'))) return;
            const roleId = String(d.roleId || '').trim();
            const role = guild.roles.cache.get(roleId);
            if (!role) throw new Error('Rolle nicht gefunden.');
            await guild.members.fetch().catch(() => null);
            let n = 0;
            for (const mem of guild.members.cache.values()) {
                if (mem.user.bot) continue;
                if (n >= 200) break;
                await mem.roles.add(role, 'Flow add all').catch(() => {});
                n++;
            }
            return;
        }
        case 'bg_role_remove_all': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.ManageRoles, 'Rollen verwalten'))) return;
            const roleId = String(d.roleId || '').trim();
            const role = guild.roles.cache.get(roleId);
            if (!role) throw new Error('Rolle nicht gefunden.');
            await guild.members.fetch().catch(() => null);
            let n = 0;
            for (const mem of guild.members.cache.values()) {
                if (!mem.roles.cache.has(roleId)) continue;
                if (n >= 200) break;
                await mem.roles.remove(role, 'Flow remove all').catch(() => {});
                n++;
            }
            return;
        }
        case 'bg_role_create': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.ManageRoles, 'Rollen verwalten'))) return;
            const name = sub(api, String(d.roleName || 'Neue Rolle')).slice(0, 100);
            const color = parseEmbedColor(String(d.color || '99AAB5'));
            await guild.roles.create({ name, color, reason: 'Flow' });
            return;
        }
        case 'bg_role_delete': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.ManageRoles, 'Rollen verwalten'))) return;
            const roleId = String(d.roleId || '').trim();
            const role = guild.roles.cache.get(roleId);
            if (!role) throw new Error('Rolle nicht gefunden.');
            await role.delete('Flow');
            return;
        }
        case 'bg_role_edit': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.ManageRoles, 'Rollen verwalten'))) return;
            const roleId = String(d.roleId || '').trim();
            const role = guild.roles.cache.get(roleId);
            if (!role) throw new Error('Rolle nicht gefunden.');
            const patch = {};
            if (d.newName) patch.name = sub(api, String(d.newName)).slice(0, 100);
            if (d.newColor) patch.color = parseEmbedColor(String(d.newColor));
            if (Object.keys(patch).length) await role.edit(patch);
            return;
        }
        case 'bg_channel_create': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.ManageChannels, 'Kanäle verwalten'))) return;
            const name = sub(api, String(d.channelName || 'kanal')).slice(0, 100);
            const t = String(d.channelType || 'text');
            const type =
                t === 'voice'
                    ? ChannelType.GuildVoice
                    : t === 'category'
                      ? ChannelType.GuildCategory
                      : ChannelType.GuildText;
            await guild.channels.create({ name, type, reason: 'Flow' });
            return;
        }
        case 'bg_channel_edit': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.ManageChannels, 'Kanäle verwalten'))) return;
            const cid = String(d.channelId || '').trim();
            const ch = guild.channels.cache.get(cid);
            if (!ch) throw new Error('Kanal nicht gefunden.');
            const patch = { name: d.newName ? sub(api, String(d.newName)).slice(0, 100) : undefined };
            await ch.edit(patch).catch(() => {});
            return;
        }
        case 'bg_channel_delete': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.ManageChannels, 'Kanäle verwalten'))) return;
            const cid = String(d.channelId || '').trim();
            const ch = guild.channels.cache.get(cid);
            if (!ch) throw new Error('Kanal nicht gefunden.');
            await ch.delete('Flow').catch(() => {});
            return;
        }
        case 'bg_thread_create': {
            const cid = String(d.channelId || ix.channelId || '').trim();
            const ch = await guild.channels.fetch(cid).catch(() => null);
            if (!ch?.isTextBased()) throw new Error('Kanal ungültig.');
            const name = sub(api, String(d.threadName || 'thread')).slice(0, 100);
            const created = await ch.threads
                .create({ name, autoArchiveDuration: 1440, reason: 'Flow' })
                .catch(() => null);
            const outKey = String(d.outputThreadVar || '').trim();
            if (outKey && created?.id) api.flowVars.set(outKey, created.id);
            return;
        }
        case 'bg_thread_edit': {
            const tid = String(d.threadId || '').trim();
            const th = guild.channels.cache.get(tid);
            if (!th?.isThread()) throw new Error('Thread nicht gefunden.');
            if (d.newName) await th.setName(sub(api, String(d.newName)).slice(0, 100)).catch(() => {});
            return;
        }
        case 'bg_thread_delete': {
            const tid = String(d.threadId || '').trim();
            const th = guild.channels.cache.get(tid);
            if (!th?.isThread()) throw new Error('Thread nicht gefunden.');
            await th.delete('Flow').catch(() => {});
            return;
        }
        case 'bg_server_nickname': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.ManageNicknames, 'Nicknamen verwalten'))) return;
            const m = api.targetMember;
            if (!m) throw new Error('Zielmitglied fehlt.');
            const nick = sub(api, String(d.nickname || '')).slice(0, 32);
            await m.setNickname(nick || null, 'Flow').catch(() => {});
            return;
        }
        case 'bg_server_purge': {
            if (!(await api.ensureModPerm(ix, PermissionFlagsBits.ManageMessages, 'Nachrichten verwalten'))) return;
            const cid = String(d.channelId || ix.channelId || '').trim();
            let amount = Number(d.amount);
            if (!Number.isFinite(amount)) amount = 10;
            amount = Math.min(100, Math.max(1, Math.floor(amount)));
            const ch = await guild.channels.fetch(cid).catch(() => null);
            if (!ch?.isTextBased()) throw new Error('Kanal ungültig.');
            const deleted = await ch.bulkDelete(amount, true).catch(() => null);
            if (deleted) await api.sendLine(`🗑️ ${deleted.size} Nachrichten geloescht.`, true);
            return;
        }
        case 'bg_server_leave': {
            if (String(d.confirm || '') !== 'LEAVE') throw new Error('Bestaetigung: confirm auf LEAVE setzen.');
            await guild.leave().catch(() => {});
            return;
        }
        case 'bg_server_invite': {
            const cid = String(d.channelId || ix.channelId || '').trim();
            const ch = await guild.channels.fetch(cid).catch(() => null);
            if (!ch?.isTextBased()) throw new Error('Kanal ungültig.');
            const inv = await ch.createInvite({ maxAge: Number(d.maxAge) || 3600, maxUses: Number(d.maxUses) || 0 }).catch(() => null);
            if (inv) await api.sendLine(`Einladung: ${inv.url}`, false);
            return;
        }
        case 'bg_other_wait': {
            let ms = Number(d.milliseconds);
            if (!Number.isFinite(ms)) ms = 1000;
            ms = Math.min(60_000, Math.max(0, Math.floor(ms)));
            await new Promise(r => setTimeout(r, ms));
            return;
        }
        case 'bg_other_manipulate_text': {
            const src = sub(api, String(d.input || ''));
            const op = String(d.operation || 'upper');
            let out = src;
            if (op === 'upper') out = src.toUpperCase();
            else if (op === 'lower') out = src.toLowerCase();
            else if (op === 'trim') out = src.trim();
            else if (op === 'length') out = String(src.length);
            const vk = String(d.outputKey || '').trim();
            if (vk) api.flowVars.set(vk, out);
            return;
        }
        case 'bg_other_error_log': {
            const msg = sub(api, String(d.message || 'Flow-Fehlerlog'));
            store.pushConsoleLine('warn', `[Flow] ${msg}`);
            return;
        }
        case 'bg_other_unique_var': {
            const k = String(d.key || '').trim();
            const v = sub(api, String(d.value ?? ''));
            if (k) api.flowVars.set(`__uniq_${k}`, v);
            return;
        }
        case 'bg_other_bot_status': {
            store.pushConsoleLine(
                'info',
                'Flow: Block „Bot-Status“ übersprungen (Multi-Server — nicht verfügbar).'
            );
            return;
        }
        case 'cond_comparison': {
            return;
        }
        case 'cond_permission': {
            return;
        }
        case 'cond_chance': {
            return;
        }
        case 'cond_channel': {
            return;
        }
        case 'cond_user': {
            return;
        }
        case 'cond_premium': {
            return;
        }
        default:
            return;
    }
}

/**
 * @param {FlowNode} node
 * @param {object} api
 * @returns {Promise<boolean|void>}
 */
export async function evaluateConditionBranch(node, api) {
    const d = node.data && typeof node.data === 'object' ? node.data : {};
    const ix = api.interaction;
    const guild = ix.guild;

    switch (node.type) {
        case 'logic_condition':
        case 'cond_role': {
            const roleId = String(d.roleId || '').trim();
            const member = api.subjectMember;
            return Boolean(member && roleId && member.roles?.cache?.has(roleId));
        }
        case 'cond_comparison': {
            const left = sub(api, String(d.left ?? ''));
            const right = sub(api, String(d.right ?? ''));
            const op = String(d.operator || 'eq');
            if (op === 'eq') return left === right;
            if (op === 'neq') return left !== right;
            if (op === 'contains') return left.includes(right);
            if (op === 'starts') return left.startsWith(right);
            if (op === 'ends') return left.endsWith(right);
            if (op === 'lt') return Number(left) < Number(right);
            if (op === 'gt') return Number(left) > Number(right);
            return false;
        }
        case 'cond_permission': {
            const member = ix.member;
            const perm = String(d.permission || 'Administrator');
            const bit = PermissionFlagsBits[perm] ?? PermissionFlagsBits.Administrator;
            return Boolean(member?.permissions?.has(bit));
        }
        case 'cond_chance': {
            let p = Number(d.percent);
            if (!Number.isFinite(p)) p = 50;
            p = Math.min(100, Math.max(0, p));
            return Math.random() * 100 < p;
        }
        case 'cond_channel': {
            const cid = String(d.channelId || '').trim();
            return Boolean(cid && ix.channelId === cid);
        }
        case 'cond_user': {
            const uid = String(d.userId || '').trim();
            const check = uid || api.targetUser?.id || '';
            return Boolean(check && ix.user.id === check);
        }
        case 'cond_premium': {
            const want = String(d.expectPremium || 'true').toLowerCase() === 'true';
            const has = ['true', '1', 'yes'].includes(String(process.env.BOT_PREMIUM_MODE || '').toLowerCase());
            return want === has;
        }
        default:
            return false;
    }
}
