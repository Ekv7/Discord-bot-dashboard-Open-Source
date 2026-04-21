/**
 * Mitgliederliste fürs Dashboard — Sortierung wie in Discord (höchste Rolle → Name).
 */

/** Ab dieser Mitgliederzahl kein vollständiger Fetch (Performance); dann API-Seiten ohne globale Sortierung. */
const MAX_FULL_MEMBER_SORT = 2500;

/**
 * Wie in der Sidebar: höhere Rollen-Position zuerst, dann Anzeigename (de).
 * @param {import('discord.js').GuildMember[]} members
 */
function sortMembersDiscordStyle(members) {
    return [...members].sort((a, b) => {
        const pa = a.roles?.highest?.position ?? 0;
        const pb = b.roles?.highest?.position ?? 0;
        if (pb !== pa) return pb - pa;
        const na = (a.displayName || a.user?.username || '')
            .toLowerCase()
            .normalize('NFKD');
        const nb = (b.displayName || b.user?.username || '')
            .toLowerCase()
            .normalize('NFKD');
        const cmp = na.localeCompare(nb, 'de', { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        return String(a.id).localeCompare(String(b.id));
    });
}

/**
 * Alle Mitglieder per REST (funktioniert oft, wenn Gateway-Fetch hängt oder fehlschlägt).
 * @param {import('discord.js').Guild} guild
 */
async function fetchAllMembersViaRestList(guild) {
    const all = [];
    let after;
    while (true) {
        const coll = await guild.members.list({ limit: 100, after });
        const batch = [...coll.values()];
        if (batch.length === 0) break;
        all.push(...batch);
        if (batch.length < 100) break;
        after = batch[batch.length - 1].id;
    }
    return all;
}

/** @param {unknown} e */
function memberLoadErrorMessage(e) {
    const err = /** @type {{ code?: number; message?: string }} */ (e);
    const code = err?.code;
    const msg = String(err?.message || '');
    if (code === 50001 || /missing access/i.test(msg)) {
        return 'Kein Zugriff auf Mitglieder — Bot-Rolle braucht passende Server-Rechte (z. B. Mitglieder sehen).';
    }
    if (/intent|disallowed intent|privileged/i.test(msg) || code === 4014) {
        return 'Im Discord Developer Portal unter „Bot“ den Schalter „SERVER MEMBERS INTENT“ aktivieren und den Bot neu starten.';
    }
    if (/timeout|arrive in time/i.test(msg)) {
        return 'Mitglieder-Anfrage abgelaufen — Seite neu laden. Wenn das bleibt: Members Intent im Portal prüfen.';
    }
    return 'Mitglieder konnten nicht geladen werden (Berechtigungen / Intents).';
}

function serializeMember(m) {
    const guild = m.guild;
    const roles = [...m.roles.cache.values()]
        .filter(r => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .slice(0, 15)
        .map(r => ({
            id: r.id,
            name: r.name,
            color: r.hexColor && r.hexColor !== '#000000' ? r.hexColor : null
        }));
    return {
        id: m.id,
        tag: m.user?.tag ?? m.id,
        displayName: m.displayName ?? m.user?.username ?? '—',
        avatarUrl: m.user?.displayAvatarURL({ size: 64 }) ?? null,
        joinedAt: m.joinedTimestamp ?? null,
        roles
    };
}

/**
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {{ query?: string, after?: string, limit?: number, page?: number }} opts
 */
export async function fetchGuildMembersPage(client, guildId, opts = {}) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
        return { ok: false, status: 400, error: 'Server ungültig.' };
    }

    const limit = Math.min(100, Math.max(1, Math.floor(Number(opts.limit) || 40)));
    const query = typeof opts.query === 'string' ? opts.query.trim().slice(0, 100) : '';
    const page = Math.max(0, Math.floor(Number(opts.page) || 0));
    const afterRaw = typeof opts.after === 'string' ? opts.after.trim() : '';

    try {
        if (query.length >= 2) {
            const coll = await guild.members.search({ query, limit: Math.min(25, limit) });
            const arr = sortMembersDiscordStyle([...coll.values()]);
            return {
                ok: true,
                members: arr.map(serializeMember),
                page: 0,
                totalMembers: arr.length,
                hasMore: false,
                searchMode: true,
                listMode: 'sorted'
            };
        }

        const mc = guild.memberCount ?? 0;

        if (mc <= MAX_FULL_MEMBER_SORT) {
            // REST-first: verhindert Gateway opcode 8 Rate-Limits aus guild.members.fetch().
            let raw = await fetchAllMembersViaRestList(guild);
            // Falls REST unerwartet unvollständig ist, einmal den Cache ergänzend nutzen.
            if (raw.length > 0 && mc > raw.length && guild.members.cache.size > raw.length) {
                raw = [...guild.members.cache.values()];
            }
            const all = sortMembersDiscordStyle(raw);
            const start = page * limit;
            const slice = all.slice(start, start + limit);
            return {
                ok: true,
                members: slice.map(serializeMember),
                page,
                totalMembers: all.length,
                hasMore: start + limit < all.length,
                searchMode: false,
                listMode: 'sorted'
            };
        }

        const after = /^\d{17,22}$/.test(afterRaw) ? afterRaw : undefined;
        const coll = await guild.members.list({ limit, after });
        const arr = [...coll.values()];
        const hasMore = arr.length === limit;
        const nextAfter = hasMore && arr.length ? arr[arr.length - 1].id : null;
        return {
            ok: true,
            members: arr.map(serializeMember),
            page,
            totalMembers: null,
            nextAfter,
            hasMore,
            searchMode: false,
            listMode: 'api',
            listModeHint:
                `Server hat über ${MAX_FULL_MEMBER_SORT} Mitglieder — hier die API-Reihenfolge (User-ID), nicht die Sidebar-Sortierung.`
        };
    } catch (e) {
        console.error('fetchGuildMembersPage:', e);
        return {
            ok: false,
            status: 500,
            error: memberLoadErrorMessage(e)
        };
    }
}
