import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { escapeHtml } from '../dashboard/logHtml.js';
import { canModerateMember, logModCommand, requireInteractionPermission, safeReason } from '../utils/moderationHelpers.js';
import { sendModerationDm } from '../utils/moderationDmNotify.js';

export const data = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Wirft ein Mitglied vom Server (kein Ban).')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o =>
        o.setName('mitglied').setDescription('Zu kickendes Mitglied').setRequired(true)
    )
    .addStringOption(o =>
        o.setName('grund').setDescription('Optionaler Grund (sichtbar im Audit-Log)').setMaxLength(400)
    );

export async function execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild || !interaction.member) {
        return interaction.reply({
            content: '❌ Nur auf einem Server nutzbar.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (!(await requireInteractionPermission(interaction, PermissionFlagsBits.KickMembers, 'Mitglieder kicken'))) {
        return;
    }

    const targetUser = interaction.options.getUser('mitglied', true);
    const reasonRaw = interaction.options.getString('grund');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const member = await interaction.guild.members.fetch({ user: targetUser.id, force: true }).catch(() => null);
        if (!member) {
            return interaction.editReply('❌ Mitglied nicht gefunden (nicht auf dem Server?).');
        }

        const moderator = interaction.member;
        const check = canModerateMember(moderator, member, interaction.guild);
        if (!check.ok) {
            return interaction.editReply(`❌ ${check.reason}`);
        }

        const auditReason = reasonRaw?.trim() || `Kick von ${interaction.user.tag}`;
        await sendModerationDm({
            user: member.user,
            guildName: interaction.guild.name,
            moderatorTag: interaction.user.tag,
            actionLabel: 'Kick',
            reason: reasonRaw || ''
        });
        await member.kick(auditReason);

        const reasonHtml = safeReason(reasonRaw, 400);
        logModCommand(
            interaction,
            'kick',
            `· Ziel <b>${escapeHtml(targetUser.tag)}</b> <code>${targetUser.id}</code>${reasonHtml ? ` · Grund: ${reasonHtml}` : ''}`,
            'mod_kick'
        );

        return interaction.editReply(`✅ **${targetUser.tag}** wurde gekickt.`);
    } catch (e) {
        console.error('kick:', e);
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
        return interaction.editReply(`❌ Kick fehlgeschlagen: ${msg}`);
    }
}
