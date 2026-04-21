import * as store from '../dashboard/store.js';
import { escapeHtml } from '../dashboard/logHtml.js';
import { MessageFlags } from 'discord.js';

/**
 * Zeile für Server-Logs: wer den Slash / die Aktion ausgelöst hat
 * @param {import('discord.js').User} user
 */
export function whoExecutedLineFromUser(user) {
    return `<b>Ausgeführt von:</b> ${escapeHtml(user.tag)} <code>${user.id}</code><br>`;
}

/**
 * @param {{ user: import('discord.js').User }} interaction
 */
export function whoExecutedLine(interaction) {
    return whoExecutedLineFromUser(interaction.user);
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} cmd Slash-Name (für Text & usage)
 * @param {string} detailHtml safe HTML (already escaped where needed)
 * @param {string} [logType='cmd'] z. B. mod_kick — Dashboard-Filter „Moderation“ / „Mute“
 */
export function logModCommand(interaction, cmd, detailHtml, logType = 'cmd') {
    const ch =
        interaction.channel?.isTextBased?.() && 'name' in interaction.channel
            ? interaction.channel.name
            : null;
    store.pushServerLog({
        type: logType,
        user: interaction.user.tag,
        userId: interaction.user.id,
        guildId: interaction.guildId ?? null,
        msg: `${whoExecutedLine(interaction)}<b>/${cmd}</b> ${detailHtml}`,
        channel: ch
    });
    store.recordSlash(cmd);
}

/**
 * Dashboard-Moderation ins Server-Log (ohne Slash-Interaction)
 * @param {import('discord.js').User} user
 * @param {string | null} guildId
 */
export function logDashboardMod(user, guildId, cmd, detailHtml, logType = 'cmd') {
    store.pushServerLog({
        type: logType,
        user: user.tag,
        userId: user.id,
        guildId,
        msg: `${whoExecutedLineFromUser(user)}<b>Dashboard /${cmd}</b> ${detailHtml}`,
        channel: null
    });
}

/**
 * @param {import('discord.js').GuildMember} moderator
 * @param {import('discord.js').GuildMember} target
 * @param {import('discord.js').Guild} guild
 */
export function canModerateMember(moderator, target, guild) {
    if (target.id === guild.ownerId) {
        return { ok: false, reason: 'Den Server-Eigentümer kannst du nicht moderieren.' };
    }
    if (target.id === moderator.id) {
        return { ok: false, reason: 'Das gilt nicht für dich selbst.' };
    }
    if (target.id === guild.members.me?.id) {
        return { ok: false, reason: 'Den Bot kannst du so nicht moderieren.' };
    }
    const modHigh = moderator.roles.highest.position;
    const tarHigh = target.roles.highest.position;
    if (guild.ownerId !== moderator.id && tarHigh >= modHigh) {
        return { ok: false, reason: 'Das Ziel hat eine gleich hohe oder höhere Rolle als du.' };
    }
    const me = guild.members.me;
    if (me && tarHigh >= me.roles.highest.position) {
        return { ok: false, reason: 'Die höchste Bot-Rolle muss über der höchsten Rolle des Ziels liegen.' };
    }
    return { ok: true };
}

/**
 * @param {string | null | undefined} reason
 * @param {number} maxLen
 */
export function safeReason(reason, maxLen) {
    const t = typeof reason === 'string' ? reason.trim() : '';
    if (!t) return null;
    return escapeHtml(t.slice(0, maxLen));
}

/**
 * Harte Server-Prüfung: selbst wenn Command-Rechte in Discord falsch konfiguriert sind,
 * blockiert der Bot die Aktion für Nutzer ohne benötigte Permission.
 */
export async function requireInteractionPermission(interaction, permissionBit, label) {
    try {
        if (interaction?.memberPermissions?.has(permissionBit)) return true;
        if (!interaction?.replied && !interaction?.deferred) {
            await interaction.reply({
                content: `❌ Du brauchst „${label}“.`,
                flags: MessageFlags.Ephemeral
            });
        } else {
            await interaction.editReply(`❌ Du brauchst „${label}“.`);
        }
    } catch {
        // ignore
    }
    return false;
}
