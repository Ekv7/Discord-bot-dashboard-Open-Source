import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { escapeHtml } from '../dashboard/logHtml.js';
import { canModerateMember, logModCommand, requireInteractionPermission, safeReason } from '../utils/moderationHelpers.js';
import { sendModerationDm } from '../utils/moderationDmNotify.js';

const MS_MIN = 60_000;
/** Discord-Maximum: 28 Tage */
const MAX_MIN = 28 * 24 * 60;

export const data = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout (stumm): Mitglied kann keine Texte schreiben / kein Voice bis Ablauf.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('mitglied').setDescription('Mitglied').setRequired(true))
    .addIntegerOption(o =>
        o
            .setName('minuten')
            .setDescription(`Dauer in Minuten (1–${MAX_MIN}, max. 28 Tage)`)
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_MIN)
    )
    .addStringOption(o =>
        o.setName('grund').setDescription('Optionaler Grund (Audit-Log)').setMaxLength(400)
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
    const minuten = interaction.options.getInteger('minuten', true);
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

        const ms = minuten * MS_MIN;
        const auditReason = reasonRaw?.trim() || `Timeout von ${interaction.user.tag}`;
        await sendModerationDm({
            user: targetUser,
            guildName: interaction.guild.name,
            moderatorTag: interaction.user.tag,
            actionLabel: 'Timeout (Mute)',
            reason: reasonRaw || '',
            durationText: `${minuten} Minuten`
        });
        await member.timeout(ms, auditReason);

        const reasonHtml = safeReason(reasonRaw, 400);
        logModCommand(
            interaction,
            'mute',
            `· Ziel <b>${escapeHtml(targetUser.tag)}</b> <code>${targetUser.id}</code> · <b>${minuten}</b> Min.${reasonHtml ? ` · Grund: ${reasonHtml}` : ''}`,
            'mod_mute'
        );

        return interaction.editReply(
            `✅ **${targetUser.tag}** ist für **${minuten}** Min. im Timeout (Mute).`
        );
    } catch (e) {
        console.error('mute:', e);
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
        return interaction.editReply(`❌ Timeout fehlgeschlagen: ${msg}`);
    }
}
