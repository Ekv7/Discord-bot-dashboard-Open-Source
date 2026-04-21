import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { escapeHtml } from '../dashboard/logHtml.js';
import * as warnsStore from '../dashboard/warnsStore.js';
import { canModerateMember, logModCommand, requireInteractionPermission } from '../utils/moderationHelpers.js';

export const data = new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Entfernt eine Verwarnung eines Mitglieds (Standard: letzte).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o =>
        o.setName('mitglied').setDescription('Mitglied').setRequired(true)
    )
    .addIntegerOption(o =>
        o.setName('index')
            .setDescription('Welche Verwarnung? 1 = neueste')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)
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
    const index = interaction.options.getInteger('index') ?? 1;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const member = await interaction.guild.members.fetch({ user: targetUser.id, force: true }).catch(() => null);
        if (member) {
            const check = canModerateMember(interaction.member, member, interaction.guild);
            if (!check.ok) return interaction.editReply(`❌ ${check.reason}`);
        }

        const removed = warnsStore.removeWarnByUserIndex(interaction.guild.id, targetUser.id, index);
        if (!removed) {
            return interaction.editReply(
                `ℹ️ Keine Verwarnung #${index} für **${targetUser.tag}** gefunden.`
            );
        }

        const reasonHtml = removed.reason ? ` · Grund: ${escapeHtml(removed.reason)}` : '';
        logModCommand(
            interaction,
            'unwarn',
            `· Ziel <b>${escapeHtml(targetUser.tag)}</b> <code>${targetUser.id}</code> · Eintrag #${index}${reasonHtml}`,
            'mod_unwarn'
        );

        return interaction.editReply(`✅ Verwarnung #${index} von **${targetUser.tag}** wurde entfernt.`);
    } catch (e) {
        console.error('unwarn:', e);
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
        return interaction.editReply(`❌ Entfernen fehlgeschlagen: ${msg}`);
    }
}
