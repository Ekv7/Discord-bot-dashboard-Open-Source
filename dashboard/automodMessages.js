import * as store from './store.js';

function parseEnvList(name) {
    const s = (process.env[name] || '').trim();
    if (!s) return [];
    return s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}

/**
 * Optional: Invite-Links und/oder Wortliste — nur wenn in .env aktiviert.
 * @param {import('discord.js').Client} client
 */
export function installAutomodMessages(client) {
    const blockInvites = (process.env.AUTOMOD_BLOCK_INVITES || '').toLowerCase() === 'true';
    const badWords = parseEnvList('AUTOMOD_BAD_WORDS');
    if (!blockInvites && badWords.length === 0) return;

    const guildFilter = (process.env.AUTOMOD_GUILD_ID || process.env.DASHBOARD_GUILD_ID || '').trim();

    client.on('messageCreate', async (message) => {
        try {
            if (!message.guild || message.author.bot) return;
            if (guildFilter && message.guild.id !== guildFilter) return;

            const me = message.guild.members.me;
            if (!me) return;
            const perms = message.channel?.permissionsFor?.(me);
            if (!perms?.has(['ManageMessages', 'ViewChannel'])) return;

            const contentLower = (message.content || '').toLowerCase();
            let hit = null;

            if (blockInvites && /discord\.gg\/[\w-]+/i.test(message.content || '')) {
                hit = 'Invite-Link';
            }
            if (!hit && badWords.length > 0) {
                for (const w of badWords) {
                    if (w && contentLower.includes(w)) {
                        hit = `Wort-Filter (${w.slice(0, 24)})`;
                        break;
                    }
                }
            }
            if (!hit) return;

            await message.delete().catch(() => null);
            const chName =
                message.channel?.isTextBased?.() && 'name' in message.channel ? message.channel.name : null;
            store.pushServerLog({
                type: 'automod',
                user: message.author.tag,
                userId: message.author.id,
                guildId: message.guild.id,
                msg: `<b>Auto-Mod:</b> Nachricht entfernt — ${hit}`,
                channel: chName
            });
        } catch (e) {
            console.error('automod messageCreate:', e);
        }
    });
}
