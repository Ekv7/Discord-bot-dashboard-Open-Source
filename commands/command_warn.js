import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { escapeHtml } from '../dashboard/logHtml.js';
import * as warnsStore from '../dashboard/warnsStore.js';
import { canModerateMember, logModCommand, requireInteractionPermission, safeReason } from '../utils/moderationHelpers.js';
import { sendModerationDm } from '../utils/moderationDmNotify.js';

export const data = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Verwarnt ein Mitglied (Liste im Dashboard unter „Verwarnungen“).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('mitglied').setDescription('Mitglied').setRequired(true))
    .addStringOption((o) => o.setName('grund').setDescription('Optionaler Grund').setMaxLength(400));

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
            return interaction.editReply('❌ Mitglied nicht gefunden (nicht auf dem Server?).');
        }

        const moderator = interaction.member;
        const check = canModerateMember(moderator, member, interaction.guild);
        if (!check.ok) {
            return interaction.editReply(`❌ ${check.reason}`);
        }

        const reasonTrim = reasonRaw?.trim().slice(0, 400) || null;
        await sendModerationDm({
            user: targetUser,
            guildName: interaction.guild.name,
            moderatorTag: interaction.user.tag,
            actionLabel: 'Verwarnung',
            reason: reasonRaw || ''
        });
        warnsStore.addWarn({
            guildId: interaction.guild.id,
            guildName: interaction.guild.name,
            targetId: targetUser.id,
            targetTag: targetUser.tag,
            moderatorId: interaction.user.id,
            moderatorTag: interaction.user.tag,
            reason: reasonTrim
        });

        const reasonHtml = safeReason(reasonRaw, 400);
        logModCommand(
            interaction,
            'warn',
            `· Ziel <b>${escapeHtml(targetUser.tag)}</b> <code>${targetUser.id}</code>${reasonHtml ? ` · Grund: ${reasonHtml}` : ''}`,
            'mod_warn'
        );

        return interaction.editReply(`✅ **${targetUser.tag}** wurde verwarnt.`);
    } catch (e) {
        console.error('warn:', e);
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
        return interaction.editReply(`❌ Fehler: ${msg}`);
    }
}
