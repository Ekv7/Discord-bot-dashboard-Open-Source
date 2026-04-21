import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { escapeHtml } from '../dashboard/logHtml.js';
import { logModCommand, requireInteractionPermission, safeReason } from '../utils/moderationHelpers.js';

const MAX_DELETE = 100;

export const data = new SlashCommandBuilder()
    .setName('clearchat')
    .setDescription('Löscht die letzten Nachrichten im Kanal (max. 100, älter als 14 Tage wird übersprungen).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o =>
        o.setName('anzahl')
            .setDescription('Wie viele Nachrichten? (1–100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_DELETE)
    )
    .addUserOption(o =>
        o.setName('mitglied')
            .setDescription('Optional: nur Nachrichten von diesem Mitglied')
            .setRequired(false)
    )
    .addStringOption(o =>
        o.setName('grund')
            .setDescription('Optionaler Grund')
            .setRequired(false)
            .setMaxLength(400)
    );

export async function execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild || !interaction.channel) {
        return interaction.reply({
            content: '❌ Nur auf einem Server und in einem Kanal nutzbar.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (!(await requireInteractionPermission(interaction, PermissionFlagsBits.ManageMessages, 'Nachrichten verwalten'))) {
        return;
    }

    const amount = interaction.options.getInteger('anzahl', true);
    const targetUser = interaction.options.getUser('mitglied');
    const reasonRaw = interaction.options.getString('grund');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const channel = interaction.channel;
        if (!channel.isTextBased() || !('messages' in channel)) {
            return interaction.editReply('❌ In diesem Kanaltyp kann ich keine Nachrichten löschen.');
        }

        const fetched = await channel.messages.fetch({ limit: MAX_DELETE });
        let candidates = [...fetched.values()];
        if (targetUser) {
            candidates = candidates.filter((m) => m.author?.id === targetUser.id);
        }

        const toDelete = candidates.slice(0, amount);
        if (toDelete.length === 0) {
            return interaction.editReply(
                targetUser
                    ? `ℹ️ Keine passenden Nachrichten von **${targetUser.tag}** gefunden.`
                    : 'ℹ️ Keine Nachrichten zum Löschen gefunden.'
            );
        }

        const deleted = await channel.bulkDelete(toDelete, true);
        const skipped = toDelete.length - deleted.size;

        const reasonHtml = safeReason(reasonRaw, 400);
        const targetHtml = targetUser
            ? ` · Nur von <b>${escapeHtml(targetUser.tag)}</b> <code>${targetUser.id}</code>`
            : '';
        const skippedHtml = skipped > 0 ? ` · Übersprungen (zu alt): <b>${skipped}</b>` : '';
        logModCommand(
            interaction,
            'clearchat',
            `· Kanal <b>#${escapeHtml(channel.name || '?')}</b> · Gelöscht: <b>${deleted.size}</b>${targetHtml}${skippedHtml}${reasonHtml ? ` · Grund: ${reasonHtml}` : ''}`,
            'mod_clearchat'
        );

        const skippedText = skipped > 0 ? ` · ${skipped} zu alt (Discord-Limit 14 Tage)` : '';
        return interaction.editReply(`✅ **${deleted.size}** Nachricht(en) gelöscht${skippedText}.`);
    } catch (e) {
        console.error('clearchat:', e);
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
        return interaction.editReply(`❌ Löschen fehlgeschlagen: ${msg}`);
    }
}
