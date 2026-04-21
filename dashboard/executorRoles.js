/**
 * Rollen des Ausführers (höchste zuerst), ohne @everyone
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Snowflake|null|undefined} userId
 * @returns {Promise<{ id: string; name: string }[]>}
 */
export async function fetchExecutorRoles(guild, userId) {
    if (!userId) return [];
    try {
        const member = await guild.members.fetch({ user: userId, force: false });
        return [...member.roles.cache.values()]
            .filter(r => r.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => ({ id: r.id, name: r.name }));
    } catch {
        return [];
    }
}
