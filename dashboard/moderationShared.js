/**
 * OAuth-Session → GuildMember des Moderators
 * @param {import('discord.js').Guild} guild
 * @param {null | { userId: string }} session
 */
export async function resolveModeratorMember(guild, session) {
    if (!session?.userId) {
        return { error: { status: 401, error: 'Nicht angemeldet.' } };
    }
    const member = await guild.members.fetch({ user: session.userId, force: true }).catch(() => null);
    if (!member) {
        return {
            error: { status: 403, error: 'Du bist auf diesem Server nicht als Mitglied sichtbar.' }
        };
    }
    return { member };
}
