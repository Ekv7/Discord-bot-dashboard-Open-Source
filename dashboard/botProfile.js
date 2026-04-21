import { Routes } from 'discord-api-types/v10';
import {
    getTargetGuildForPresence,
    isMemberCountPresenceEnabled
} from './memberCountPresence.js';

const MAX_BIO = 190;
const MAX_BODY_BYTES = 3_500_000;

export { MAX_BODY_BYTES };

/**
 * @param {import('discord.js').Client} client
 */
export async function fetchBotProfile(client) {
    if (!client?.user) return null;
    const raw = await client.rest.get(Routes.user());
    const u = client.user;
    const bio = typeof raw.bio === 'string' ? raw.bio : '';
    const pres = client.presence;
    const act = pres?.activities?.[0];
    const targetGuild = getTargetGuildForPresence(client);
    const activityLocked = Boolean(
        isMemberCountPresenceEnabled() && targetGuild
    );
    return {
        id: u.id,
        username: raw.username ?? u.username,
        tag: u.tag,
        globalName: raw.global_name ?? null,
        bio,
        avatarUrl: u.displayAvatarURL({ size: 256 }),
        bannerUrl: u.bannerURL?.({ size: 512 }) ?? null,
        presenceStatus: pres?.status ?? 'offline',
        activityName: act?.name ?? '',
        activityState:
            act?.state != null && String(act.state).trim() !== '' ? String(act.state) : '',
        activityType: typeof act?.type === 'number' ? act.type : 0,
        presenceActivityLocked: activityLocked,
        memberCount: targetGuild?.memberCount ?? null
    };
}

function validateUsername(name) {
    const t = String(name).trim();
    if (t.length < 2 || t.length > 32) {
        throw new Error('Benutzername: 2–32 Zeichen (Discord-Regel).');
    }
    return t;
}

const VALID_PRESENCE = new Set(['online', 'idle', 'dnd', 'invisible']);

function parseActivityType(raw) {
    if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 5) {
        return raw;
    }
    const t = typeof raw === 'string' ? raw.toLowerCase() : '';
    const map = {
        playing: 0,
        streaming: 1,
        listening: 2,
        watching: 3,
        custom: 4,
        competing: 5
    };
    return map[t] ?? 0;
}

function applyPresenceUpdate(client, body) {
    const pres = {};
    if (typeof body.presenceStatus === 'string' && VALID_PRESENCE.has(body.presenceStatus)) {
        pres.status = body.presenceStatus;
    }
    const lockActivity =
        isMemberCountPresenceEnabled() && getTargetGuildForPresence(client);
    if (!lockActivity && ('activityName' in body || 'activityState' in body)) {
        const n = body.activityName == null ? '' : String(body.activityName).trim();
        const stRaw = body.activityState;
        const st =
            stRaw == null || String(stRaw).trim() === ''
                ? undefined
                : String(stRaw).trim().slice(0, 128);
        if (!n) {
            pres.activities = [];
        } else {
            const act = {
                name: n.slice(0, 128),
                type: parseActivityType(body.activityType)
            };
            if (st) act.state = st;
            pres.activities = [act];
        }
    }
    if (Object.keys(pres).length === 0) return false;
    client.user.setPresence(pres);
    return true;
}


function normalizeImagePayload(value) {
    if (value == null || typeof value !== 'string') return null;
    const s = value.trim();
    if (!s) return null;
    return s;
}

/**
 * @param {import('discord.js').Client} client
 * @param {Record<string, unknown>} body
 */
export async function patchBotProfile(client, body) {
    if (!client?.user) {
        throw new Error('Bot noch nicht bereit');
    }
    if (!body || typeof body !== 'object') {
        throw new Error('Ungültiger Body');
    }

    const editOpts = {};
    let hasEdit = false;

    if (body.clearAvatar === true) {
        editOpts.avatar = null;
        hasEdit = true;
    } else if (body.avatarBase64 != null) {
        const img = normalizeImagePayload(body.avatarBase64);
        if (img) {
            editOpts.avatar = img;
            hasEdit = true;
        }
    }

    if (body.clearBanner === true) {
        editOpts.banner = null;
        hasEdit = true;
    } else if (body.bannerBase64 != null) {
        const img = normalizeImagePayload(body.bannerBase64);
        if (img) {
            editOpts.banner = img;
            hasEdit = true;
        }
    }

    if (typeof body.username === 'string') {
        editOpts.username = validateUsername(body.username);
        hasEdit = true;
    }

    let bioPatched = false;
    if ('bio' in body) {
        bioPatched = true;
    }

    const presenceChanged =
        (typeof body.presenceStatus === 'string' && VALID_PRESENCE.has(body.presenceStatus)) ||
        'activityName' in body ||
        'activityState' in body;

    if (!hasEdit && !bioPatched && !presenceChanged) {
        throw new Error(
            'Nichts zu ändern — Profil, Bio, Avatar, Banner oder Status / Aktivität angeben.'
        );
    }

    if (hasEdit) {
        await client.user.edit(editOpts);
    }

    if (bioPatched) {
        const rawBio = body.bio;
        const bio =
            rawBio === null || rawBio === ''
                ? null
                : String(rawBio).trim().slice(0, MAX_BIO) || null;
        await client.rest.patch(Routes.user(), { body: { bio } });
    }

    if (presenceChanged) {
        applyPresenceUpdate(client, body);
    }

    return fetchBotProfile(client);
}
