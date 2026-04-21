import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { escapeHtml } from '../dashboard/logHtml.js';
import { logModCommand, requireInteractionPermission, safeReason } from '../utils/moderationHelpers.js';

export const data = new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Entbannt einen Nutzer per User-ID.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o =>
        o
            .setName('user_id')
            .setDescription('Discord-ID des gebannten Nutzers')
            .setRequired(true)
            .setMinLength(17)
            .setMaxLength(22)
    )
    .addStringOption(o =>
        o.setName('grund').setDescription('Optionaler Grund').setMaxLength(400)
    );

export async function execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
        return interaction.reply({
            content: '❌ Nur auf einem Server nutzbar.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (!(await requireInteractionPermission(interaction, PermissionFlagsBits.BanMembers, 'Mitglieder bannen'))) {
        return;
    }

    const idRaw = interaction.options.getString('user_id', true).trim();
    const reasonRaw = interaction.options.getString('grund');

    if (!/^\d{17,22}$/.test(idRaw)) {
        return interaction.reply({
            content: '❌ Ungültige User-ID.',
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        let ban;
        try {
            ban = await interaction.guild.bans.fetch(idRaw);
        } catch {
            return interaction.editReply('❌ Dieser Nutzer ist nicht gebannt oder die ID ist ungültig.');
        }

        const user = ban.user;
        const auditReason = reasonRaw?.trim() || `Unban von ${interaction.user.tag}`;
        await interaction.guild.bans.remove(user, auditReason);

        const reasonHtml = safeReason(reasonRaw, 400);
        logModCommand(
            interaction,
            'unban',
            `· Ziel <b>${escapeHtml(user.tag)}</b> <code>${user.id}</code>${reasonHtml ? ` · Grund: ${reasonHtml}` : ''}`,
            'mod_unban'
        );

        return interaction.editReply(`✅ **${user.tag}** wurde entbannt.`);
    } catch (e) {
        console.error('unban:', e);
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
        return interaction.editReply(`❌ Unban fehlgeschlagen: ${msg}`);
    }
}
