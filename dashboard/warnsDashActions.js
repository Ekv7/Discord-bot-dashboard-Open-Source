import { PermissionFlagsBits } from 'discord.js';
import { escapeHtml } from './logHtml.js';
import * as warnsStore from './warnsStore.js';
import { canModerateMember, logDashboardMod, safeReason } from '../utils/moderationHelpers.js';
import { resolveModeratorMember } from './moderationShared.js';
import { sendModerationDm } from '../utils/moderationDmNotify.js';

async function ensureBotMod(guild) {
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return { ok: false, status: 403, error: 'Bot braucht „Mitglieder moderieren“.' };
    }
    return { ok: true };
}

/** @param {import('discord.js').Client} client @param {null | { userId: string }} session */
export async function dashboardAddWarn(client, body, session) {
    const guildId = typeof body?.guildId === 'string' ? body.guildId.trim() : '';
    if (!guildId || !client.guilds.cache.has(guildId)) {
        return { ok: false, status: 400, error: 'guildId ungültig.' };
    }
    const guild = client.guilds.cache.get(guildId);
    const targetRaw = typeof body?.targetUserId === 'string' ? body.targetUserId.trim() : '';
    if (!/^\d{17,22}$/.test(targetRaw)) {
        return { ok: false, status: 400, error: 'Ungültige Nutzer-ID.' };
    }

    const botOk = await ensureBotMod(guild);
    if (!botOk.ok) return botOk;

    const modRes = await resolveModeratorMember(guild, session);
    if (modRes.error) return { ok: false, ...modRes.error };
    const modMember = modRes.member;

    const targetMember = await guild.members.fetch({ user: targetRaw, force: true }).catch(() => null);
    if (!targetMember) {
        return { ok: false, status: 404, error: 'Mitglied nicht auf dem Server.' };
    }
    const check = canModerateMember(modMember, targetMember, guild);
    if (!check.ok) return { ok: false, status: 403, error: check.reason };

    let reasonTrim = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 400) : '';
    reasonTrim = reasonTrim || null;
    await sendModerationDm({
        user: targetMember.user,
        guildName: guild.name,
        moderatorTag: modMember.user.tag,
        actionLabel: 'Verwarnung',
        reason: reasonTrim || ''
    });

    warnsStore.addWarn({
        guildId,
        guildName: guild.name,
        targetId: targetMember.id,
        targetTag: targetMember.user.tag,
        moderatorId: modMember.id,
        moderatorTag: modMember.user.tag,
        reason: reasonTrim
    });

    const reasonHtml = safeReason(body?.reason, 400);
    logDashboardMod(
        modMember.user,
        guildId,
        'warn',
        `· Ziel <b>${escapeHtml(targetMember.user.tag)}</b> <code>${targetMember.id}</code>${reasonHtml ? ` · Grund: ${reasonHtml}` : ''}`,
        'mod_warn'
    );
    return { ok: true, message: `${targetMember.user.tag} wurde verwarnt.` };
}

/** @param {import('discord.js').Client} client */
export async function dashboardRemoveWarn(client, body, session) {
    const guildId = typeof body?.guildId === 'string' ? body.guildId.trim() : '';
    if (!guildId || !client.guilds.cache.has(guildId)) {
        return { ok: false, status: 400, error: 'guildId ungültig.' };
    }
    const guild = client.guilds.cache.get(guildId);

    const botOk = await ensureBotMod(guild);
    if (!botOk.ok) return botOk;

    const modRes = await resolveModeratorMember(guild, session);
    if (modRes.error) return { ok: false, ...modRes.error };
    const modMember = modRes.member;

    const warnId = typeof body?.warnId === 'string' ? body.warnId.trim() : '';
    const ts = body?.ts != null ? Number(body.ts) : null;
    const targetId = typeof body?.targetId === 'string' ? body.targetId.trim() : '';

    const out = warnsStore.removeWarnEntry(guildId, {
        warnId: warnId || undefined,
        ts: Number.isFinite(ts) ? ts : null,
        targetId: targetId || undefined
    });
    if (!out.ok) {
        return { ok: false, status: 404, error: out.error };
    }
    const removed = out.removed;
    const reasonHtml = removed.reason ? ` · Grund: ${escapeHtml(removed.reason)}` : '';
    logDashboardMod(
        modMember.user,
        guildId,
        'unwarn',
        `· Ziel <b>${escapeHtml(removed.targetTag)}</b> <code>${removed.targetId}</code> · Eintrag entfernt${reasonHtml}`,
        'mod_unwarn'
    );
    return { ok: true, message: 'Verwarnung entfernt.' };
}
