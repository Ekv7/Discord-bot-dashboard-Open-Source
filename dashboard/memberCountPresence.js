import { ActivityType } from 'discord-api-types/v10';

/**
 * @param {import('discord.js').Client} client
 * @returns {import('discord.js').Guild | null}
 */
export function getTargetGuildForPresence(client) {
    if (!client?.guilds?.cache) return null;
    const id = (process.env.DASHBOARD_GUILD_ID || '').trim();
    if (id) return client.guilds.cache.get(id) ?? null;
    if (client.guilds.cache.size === 1) return client.guilds.cache.first();
    return null;
}

function getPresenceMemberCount(client) {
    const guild = getTargetGuildForPresence(client);
    if (guild) return guild.memberCount ?? 0;
    let total = 0;
    for (const currentGuild of client.guilds.cache.values()) {
        total += currentGuild.memberCount ?? 0;
    }
    return total;
}

export function isMemberCountPresenceEnabled() {
    const v = (process.env.BOT_PRESENCE_MEMBER_COUNT ?? 'true').toLowerCase().trim();
    return v !== '0' && v !== 'false' && v !== 'off' && v !== 'no';
}

function memberLabel(count) {
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) return '0 members';
    return n === 1 ? '1 member' : `${n} members`;
}

/**
 * Setzt „Watching … members“ aus der aktuellen Mitgliederzahl des Zielservers.
 * @param {import('discord.js').Client} client
 */
export function syncMemberCountPresence(client) {
    if (!isMemberCountPresenceEnabled() || !client?.user) return;
    try {
        const count = getPresenceMemberCount(client);
        const status = client.presence?.status && client.presence.status !== 'offline'
            ? client.presence.status
            : 'online';
        client.user.setPresence({
            status,
            activities: [
                {
                    name: memberLabel(count),
                    type: ActivityType.Watching
                }
            ]
        });
    } catch (e) {
        console.error('memberCountPresence sync:', e.message);
    }
}

/**
 * @param {import('discord.js').Client} client
 */
export function installMemberCountPresence(client) {
    if (!isMemberCountPresenceEnabled()) return;

    const onMemberDelta = member => {
        try {
            const g = getTargetGuildForPresence(client);
            if (g && member.guild.id !== g.id) return;
            syncMemberCountPresence(client);
        } catch (e) {
            console.error('memberCountPresence event:', e.message);
        }
    };

    client.on('guildMemberAdd', onMemberDelta);
    client.on('guildMemberRemove', onMemberDelta);
}
