import { PermissionFlagsBits } from 'discord.js';
import { escapeHtml } from './logHtml.js';
import { canModerateMember, logDashboardMod, safeReason } from '../utils/moderationHelpers.js';
import { resolveModeratorMember } from './moderationShared.js';
import { sendModerationDm } from '../utils/moderationDmNotify.js';

const MS_MIN = 60_000;
const MAX_MUTE_MIN = 28 * 24 * 60;

function rowMember(m) {
    return {
        kind: 'member',
        id: m.id,
        tag: m.user.tag,
        displayName: m.displayName,
        avatarUrl: m.user.displayAvatarURL({ size: 64 })
    };
}

function rowBanned(u) {
    return {
        kind: 'banned',
        id: u.id,
        tag: u.tag,
        avatarUrl: u.displayAvatarURL({ size: 64 })
    };
}

function botPerm(guild, bits, label) {
    const me = guild.members.me;
    if (!me?.permissions.has(bits)) {
        return { ok: false, status: 403, error: `Bot braucht „${label}“.` };
    }
    return { ok: true };
}

function modPerm(modMember, bits, label) {
    if (!modMember?.permissions?.has(bits)) {
        return { ok: false, status: 403, error: `Du brauchst „${label}“.` };
    }
    return { ok: true };
}

async function ensureBotMember(guild) {
    if (guild.members.me) return guild.members.me;
    try {
        return await guild.members.fetchMe();
    } catch {
        return null;
    }
}

/**
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} qRaw
 * @param {null | { userId: string }} session
 */
export async function dashboardModerationSearch(client, guildId, qRaw, session) {
    const q = (qRaw || '').trim();
    if (q.length < 2 && !/^\d{17,22}$/.test(q)) {
        return { ok: false, status: 400, error: 'Mindestens 2 Zeichen oder eine gültige User-ID eingeben.' };
    }
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return { ok: false, status: 400, error: 'Server ungültig.' };

    const modRes = await resolveModeratorMember(guild, session);
    if (modRes.error) return { ok: false, ...modRes.error };

    /** @type {ReturnType<typeof rowMember>[] } */
    const results = [];
    const seen = new Set();

    if (/^\d{17,22}$/.test(q)) {
        const mem = await guild.members.fetch({ user: q, force: true }).catch(() => null);
        if (mem) {
            results.push(rowMember(mem));
            seen.add(mem.id);
        }
        try {
            const ban = await guild.bans.fetch(q);
            if (ban?.user && !seen.has(ban.user.id)) {
                results.push(rowBanned(ban.user));
                seen.add(ban.user.id);
            }
        } catch {
            /* nicht gebannt */
        }
        return { ok: true, results };
    }

    const coll = await guild.members.search({ query: q, limit: 15 }).catch(() => null);
    if (!coll) return { ok: true, results: [] };
    for (const m of coll.values()) {
        if (!seen.has(m.id)) {
            seen.add(m.id);
            results.push(rowMember(m));
        }
    }
    return { ok: true, results };
}

/**
 * @param {import('discord.js').Client} client
 * @param {Record<string, unknown>} body
 * @param {null | { userId: string }} session
 */
export async function dashboardModerationAction(client, body, session) {
    const guildId = typeof body?.guildId === 'string' ? body.guildId.trim() : '';
    const action = typeof body?.action === 'string' ? body.action.trim() : '';
    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId.trim() : '';
    const reasonRaw = typeof body?.reason === 'string' ? body.reason : '';
    const muteMinutes = body?.muteMinutes != null ? Number(body.muteMinutes) : 10;

    if (!guildId || !client.guilds.cache.has(guildId)) {
        return { ok: false, status: 400, error: 'guildId ungültig.' };
    }
    if (!/^\d{17,22}$/.test(targetUserId)) {
        return { ok: false, status: 400, error: 'Ungültige Nutzer-ID.' };
    }

    const allowed = new Set(['kick', 'ban', 'unban', 'mute', 'unmute']);
    if (!allowed.has(action)) {
        return { ok: false, status: 400, error: 'Aktion ungültig.' };
    }

    const guild = client.guilds.cache.get(guildId);
    await ensureBotMember(guild);
    const modRes = await resolveModeratorMember(guild, session);
    if (modRes.error) return { ok: false, ...modRes.error };
    const modMember = modRes.member;

    const reasonTrim = reasonRaw.trim().slice(0, 400);
    const auditTail = reasonTrim || null;

    try {
        if (action === 'unban') {
            const mp = modPerm(modMember, PermissionFlagsBits.BanMembers, 'Mitglieder bannen');
            if (!mp.ok) return mp;
            const p = botPerm(guild, PermissionFlagsBits.BanMembers, 'Mitglieder bannen');
            if (!p.ok) return p;
            let ban;
            try {
                ban = await guild.bans.fetch(targetUserId);
            } catch {
                return { ok: false, status: 404, error: 'Nutzer ist nicht gebannt.' };
            }
            const user = ban.user;
            const ar = auditTail || `Unban von ${modMember.user.tag}`;
            await guild.bans.remove(user, ar);
            const reasonHtml = safeReason(reasonRaw, 400);
            logDashboardMod(
                modMember.user,
                guildId,
                'unban',
                `· Ziel <b>${escapeHtml(user.tag)}</b> <code>${user.id}</code>${reasonHtml ? ` · Grund: ${reasonHtml}` : ''}`,
                'mod_unban'
            );
            return { ok: true, message: `${user.tag} wurde entbannt.` };
        }

        if (action === 'ban') {
            if (!reasonTrim) {
                return { ok: false, status: 400, error: 'Bei Ban ist ein Grund Pflicht.' };
            }
            const mp = modPerm(modMember, PermissionFlagsBits.BanMembers, 'Mitglieder bannen');
            if (!mp.ok) return mp;
            const p = botPerm(guild, PermissionFlagsBits.BanMembers, 'Mitglieder bannen');
            if (!p.ok) return p;
            const targetMember = await guild.members.fetch({ user: targetUserId, force: true }).catch(() => null);
            if (targetMember) {
                const check = canModerateMember(modMember, targetMember, guild);
                if (!check.ok) return { ok: false, status: 403, error: check.reason };
            }
            const user =
                targetMember?.user ?? (await client.users.fetch(targetUserId).catch(() => null));
            if (!user) return { ok: false, status: 404, error: 'Nutzer nicht gefunden.' };
            const ar = auditTail || `Ban von ${modMember.user.tag}`;
            await sendModerationDm({
                user,
                guildName: guild.name,
                moderatorTag: modMember.user.tag,
                actionLabel: 'Ban',
                reason: reasonRaw || ''
            });
            await guild.members.ban(user, { reason: ar });
            const reasonHtml = safeReason(reasonRaw, 400);
            logDashboardMod(
                modMember.user,
                guildId,
                'ban',
                `· Ziel <b>${escapeHtml(user.tag)}</b> <code>${user.id}</code>${reasonHtml ? ` · Grund: ${reasonHtml}` : ''}`,
                'mod_ban'
            );
            return { ok: true, message: `${user.tag} wurde gebannt.` };
        }

        const targetMember = await guild.members.fetch({ user: targetUserId, force: true }).catch(() => null);
        if (!targetMember) {
            return { ok: false, status: 404, error: 'Mitglied nicht auf dem Server.' };
        }

        const check = canModerateMember(modMember, targetMember, guild);
        if (!check.ok) return { ok: false, status: 403, error: check.reason };

        if (action === 'kick') {
            const mp = modPerm(modMember, PermissionFlagsBits.KickMembers, 'Mitglieder kicken');
            if (!mp.ok) return mp;
            const p = botPerm(guild, PermissionFlagsBits.KickMembers, 'Mitglieder kicken');
            if (!p.ok) return p;
            const ar = auditTail || `Kick von ${modMember.user.tag}`;
            await sendModerationDm({
                user: targetMember.user,
                guildName: guild.name,
                moderatorTag: modMember.user.tag,
                actionLabel: 'Kick',
                reason: reasonRaw || ''
            });
            await targetMember.kick(ar);
            const reasonHtml = safeReason(reasonRaw, 400);
            logDashboardMod(
                modMember.user,
                guildId,
                'kick',
                `· Ziel <b>${escapeHtml(targetMember.user.tag)}</b> <code>${targetMember.id}</code>${reasonHtml ? ` · Grund: ${reasonHtml}` : ''}`,
                'mod_kick'
            );
            return { ok: true, message: `${targetMember.user.tag} wurde gekickt.` };
        }

        if (action === 'mute') {
            const mp = modPerm(modMember, PermissionFlagsBits.ModerateMembers, 'Mitglieder moderieren');
            if (!mp.ok) return mp;
            const p = botPerm(guild, PermissionFlagsBits.ModerateMembers, 'Mitglieder moderieren');
            if (!p.ok) return p;
            const min = Number.isFinite(muteMinutes) ? Math.floor(muteMinutes) : 10;
            if (min < 1 || min > MAX_MUTE_MIN) {
                return { ok: false, status: 400, error: `Mute: 1–${MAX_MUTE_MIN} Minuten.` };
            }
            const ar = auditTail || `Timeout von ${modMember.user.tag}`;
            await sendModerationDm({
                user: targetMember.user,
                guildName: guild.name,
                moderatorTag: modMember.user.tag,
                actionLabel: 'Timeout (Mute)',
                reason: reasonRaw || '',
                durationText: `${min} Minuten`
            });
            await targetMember.timeout(min * MS_MIN, ar);
            const reasonHtml = safeReason(reasonRaw, 400);
            logDashboardMod(
                modMember.user,
                guildId,
                'mute',
                `· Ziel <b>${escapeHtml(targetMember.user.tag)}</b> <code>${targetMember.id}</code> · <b>${min}</b> Min.${reasonHtml ? ` · Grund: ${reasonHtml}` : ''}`,
                'mod_mute'
            );
            return { ok: true, message: `${targetMember.user.tag}: Timeout ${min} Min.` };
        }

        if (action === 'unmute') {
            const mp = modPerm(modMember, PermissionFlagsBits.ModerateMembers, 'Mitglieder moderieren');
            if (!mp.ok) return mp;
            const p = botPerm(guild, PermissionFlagsBits.ModerateMembers, 'Mitglieder moderieren');
            if (!p.ok) return p;
            if (!targetMember.communicationDisabledUntil || targetMember.communicationDisabledUntil < new Date()) {
                return { ok: false, status: 400, error: 'Kein aktiver Timeout.' };
            }
            const ar = auditTail || `Timeout aufgehoben von ${modMember.user.tag}`;
            await targetMember.timeout(null, ar);
            const reasonHtml = safeReason(reasonRaw, 400);
            logDashboardMod(
                modMember.user,
                guildId,
                'unmute',
                `· Ziel <b>${escapeHtml(targetMember.user.tag)}</b> <code>${targetMember.id}</code>${reasonHtml ? ` · Grund: ${reasonHtml}` : ''}`,
                'mod_unmute'
            );
            return { ok: true, message: `Timeout für ${targetMember.user.tag} aufgehoben.` };
        }
    } catch (e) {
        const rawCode = e?.code ?? e?.rawError?.code ?? e?.data?.code;
        const numericCode = Number(rawCode);
        const msg = String(e?.message || e?.rawError?.message || '').toLowerCase();
        const isMissingPerms =
            numericCode === 50013 ||
            msg.includes('missing permissions') ||
            (Number(e?.status) === 403 && msg.includes('permission'));
        if (isMissingPerms) {
            return {
                ok: false,
                status: 403,
                error: 'Fehlende Rechte: Bot-Rolle höher setzen und Berechtigung prüfen.'
            };
        }
        console.error('dashboardModerationAction:', e);
        return { ok: false, status: 500, error: 'Aktion fehlgeschlagen.' };
    }

    return { ok: false, status: 400, error: 'Unbekannte Aktion.' };
}
