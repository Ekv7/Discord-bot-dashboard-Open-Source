import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import * as warnsStore from '../dashboard/warnsStore.js';
import { requireInteractionPermission } from '../utils/moderationHelpers.js';

export const data = new SlashCommandBuilder()
    .setName('warns')
    .setDescription('Zeigt die Verwarnungen eines Mitglieds.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o =>
        o.setName('mitglied').setDescription('Mitglied').setRequired(true)
    );

export async function execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
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
        const rows = warnsStore.listWarnsForUser(interaction.guild.id, targetUser.id, 10);
        if (rows.length === 0) {
            return interaction.editReply(`ℹ️ **${targetUser.tag}** hat keine Verwarnungen.`);
        }

        const lines = rows.map((w, idx) => {
            const reason = w.reason ? ` · Grund: ${w.reason}` : '';
            const when = new Date(w.ts).toLocaleString('de-DE');
            return `**#${idx + 1}** · ${when} · von **${w.moderatorTag}**${reason}`;
        });

        return interaction.editReply(
            `📋 Verwarnungen für **${targetUser.tag}** (${rows.length}):\n${lines.join('\n')}`
        );
    } catch (e) {
        console.error('warns:', e);
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
        return interaction.editReply(`❌ Konnte Verwarnungen nicht laden: ${msg}`);
    }
}
