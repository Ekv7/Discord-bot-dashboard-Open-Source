import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { escapeHtml } from '../dashboard/logHtml.js';
import { canModerateMember, logModCommand, requireInteractionPermission, safeReason } from '../utils/moderationHelpers.js';

export const data = new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Hebt einen aktiven Timeout (Mute) auf.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('mitglied').setDescription('Mitglied').setRequired(true))
    .addStringOption(o =>
        o.setName('grund').setDescription('Optionaler Grund').setMaxLength(400)
    );

export async function execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild || !interaction.member) {
        return interaction.reply({
            content: '❌ Nur auf einem Server nutzbar.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (!(await requireInteractionPermission(interaction, PermissionFlagsBits.ModerateMembers, 'Mitglieder moderieren'))) {
        return;
    }

    const targetUser = interaction.options.getUser('mitglied', true);
    const reasonRaw = interaction.options.getString('grund');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const member = await interaction.guild.members.fetch({ user: targetUser.id, force: true }).catch(() => null);
        if (!member) {
            return interaction.editReply('❌ Mitglied nicht auf dem Server.');
        }

        const check = canModerateMember(interaction.member, member, interaction.guild);
        if (!check.ok) {
            return interaction.editReply(`❌ ${check.reason}`);
        }

        if (!member.communicationDisabledUntil || member.communicationDisabledUntil < new Date()) {
            return interaction.editReply('❌ Für dieses Mitglied ist kein aktiver Timeout gesetzt.');
        }

        const auditReason = reasonRaw?.trim() || `Timeout aufgehoben von ${interaction.user.tag}`;
        await member.timeout(null, auditReason);

        const reasonHtml = safeReason(reasonRaw, 400);
        logModCommand(
            interaction,
            'unmute',
            `· Ziel <b>${escapeHtml(targetUser.tag)}</b> <code>${targetUser.id}</code>${reasonHtml ? ` · Grund: ${reasonHtml}` : ''}`,
            'mod_unmute'
        );

        return interaction.editReply(`✅ Timeout für **${targetUser.tag}** wurde aufgehoben.`);
    } catch (e) {
        console.error('unmute:', e);
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
        return interaction.editReply(`❌ Unmute fehlgeschlagen: ${msg}`);
    }
}
