import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { escapeHtml } from '../dashboard/logHtml.js';
import { canModerateMember, logModCommand, requireInteractionPermission, safeReason } from '../utils/moderationHelpers.js';
import { sendModerationDm } from '../utils/moderationDmNotify.js';

const DAY_SEC = 86_400;
const MAX_DELETE_DAYS = 7;

export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannt ein Mitglied vom Server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('mitglied').setDescription('Zu bannendes Mitglied').setRequired(true))
    .addStringOption(o =>
        o.setName('grund').setDescription('Optionaler Grund (Audit-Log)').setMaxLength(400)
    )
    .addIntegerOption(o =>
        o
            .setName('nachrichten_tage')
            .setDescription(`Nachrichten der letzten X Tage löschen (0–${MAX_DELETE_DAYS})`)
            .setMinValue(0)
            .setMaxValue(MAX_DELETE_DAYS)
    );

export async function execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild || !interaction.member) {
        return interaction.reply({
            content: '❌ Nur auf einem Server nutzbar.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (!(await requireInteractionPermission(interaction, PermissionFlagsBits.BanMembers, 'Mitglieder bannen'))) {
        return;
    }

    const targetUser = interaction.options.getUser('mitglied', true);
    const reasonRaw = interaction.options.getString('grund');
    const deleteDays = interaction.options.getInteger('nachrichten_tage') ?? 0;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const member = await interaction.guild.members.fetch({ user: targetUser.id }).catch(() => null);
        if (member) {
            const check = canModerateMember(interaction.member, member, interaction.guild);
            if (!check.ok) {
                return interaction.editReply(`❌ ${check.reason}`);
            }
        }

        const auditReason = reasonRaw?.trim() || `Ban von ${interaction.user.tag}`;
        const deleteMessageSeconds = Math.min(MAX_DELETE_DAYS, Math.max(0, deleteDays)) * DAY_SEC;
        await sendModerationDm({
            user: targetUser,
            guildName: interaction.guild.name,
            moderatorTag: interaction.user.tag,
            actionLabel: 'Ban',
            reason: reasonRaw || ''
        });

        await interaction.guild.members.ban(targetUser, {
            deleteMessageSeconds,
            reason: auditReason
        });

        const reasonHtml = safeReason(reasonRaw, 400);
        logModCommand(
            interaction,
            'ban',
            `· Ziel <b>${escapeHtml(targetUser.tag)}</b> <code>${targetUser.id}</code>${deleteDays > 0 ? ` · Nachrichten: ${deleteDays} T.` : ''}${reasonHtml ? ` · Grund: ${reasonHtml}` : ''}`,
            'mod_ban'
        );

        return interaction.editReply(`✅ **${targetUser.tag}** wurde gebannt.`);
    } catch (e) {
        console.error('ban:', e);
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
        return interaction.editReply(`❌ Ban fehlgeschlagen: ${msg}`);
    }
}
