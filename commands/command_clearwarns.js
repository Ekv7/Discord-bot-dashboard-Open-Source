import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { escapeHtml } from '../dashboard/logHtml.js';
import * as warnsStore from '../dashboard/warnsStore.js';
import { canModerateMember, logModCommand, requireInteractionPermission } from '../utils/moderationHelpers.js';

export const data = new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Entfernt alle Verwarnungen eines Mitglieds.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o =>
        o.setName('mitglied').setDescription('Mitglied').setRequired(true)
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const member = await interaction.guild.members.fetch({ user: targetUser.id, force: true }).catch(() => null);
        if (member) {
            const check = canModerateMember(interaction.member, member, interaction.guild);
            if (!check.ok) return interaction.editReply(`❌ ${check.reason}`);
        }

        const removedCount = warnsStore.clearWarnsForUser(interaction.guild.id, targetUser.id);
        if (removedCount === 0) {
            return interaction.editReply(`ℹ️ **${targetUser.tag}** hat keine Verwarnungen.`);
        }

        logModCommand(
            interaction,
            'clearwarns',
            `· Ziel <b>${escapeHtml(targetUser.tag)}</b> <code>${targetUser.id}</code> · Entfernt: <b>${removedCount}</b>`,
            'mod_clearwarns'
        );

        return interaction.editReply(`✅ **${removedCount}** Verwarnung(en) von **${targetUser.tag}** entfernt.`);
    } catch (e) {
        console.error('clearwarns:', e);
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
        return interaction.editReply(`❌ Löschen fehlgeschlagen: ${msg}`);
    }
}
