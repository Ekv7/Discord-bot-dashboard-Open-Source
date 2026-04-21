import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as store from '../dashboard/store.js';
import { whoExecutedLine, whoExecutedLineFromUser } from '../utils/moderationHelpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const panelImageDirectory = path.join(__dirname, '..', 'assets', 'panels');
const panelImageFilename = 'Gemini_Generated_Image_54p5mo54p5mo54p5.png';
const panelImageAbsolutePath = path.join(panelImageDirectory, panelImageFilename);

/**
 * Nutzt bevorzugt ein lokales Projektbild, damit die Panel-Grafik stabil bleibt
 * und nicht von einer externen Discord-CDN-Nachricht abhängt.
 */
function resolvePanelImage() {
    // 1) Exakter Dateiname (bevorzugt)
    if (fs.existsSync(panelImageAbsolutePath)) {
        return {
            mediaUrl: `attachment://${panelImageFilename}`,
            attachment: new AttachmentBuilder(panelImageAbsolutePath, { name: panelImageFilename })
        };
    }

    // 2) Fallback: erste passende Gemini_Generated_Image*.png verwenden
    try {
        const fallbackName = fs
            .readdirSync(panelImageDirectory)
            .find((entry) => /^Gemini_Generated_Image.*\.png$/i.test(entry));
        if (fallbackName) {
            const fallbackPath = path.join(panelImageDirectory, fallbackName);
            return {
                mediaUrl: `attachment://${fallbackName}`,
                attachment: new AttachmentBuilder(fallbackPath, { name: fallbackName })
            };
        }
    } catch {
        // Ignorieren: dann einfach ohne Bild senden.
    }

    return null;
}

function sendServerGuildId() {
    const s = String(process.env.SEND_SERVER_GUILD_ID ?? '')
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\s+/g, '');
    return /^\d{17,20}$/.test(s) ? s : '';
}

/** Gleiche Regel wie in index.js — wird beim Start bereits geprüft */
function getSendServerRoleId() {
    const s = String(process.env.SEND_SERVER_ROLE_ID ?? '')
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\s+/g, '');
    return /^\d{17,20}$/.test(s) ? s : '';
}

export const data = new SlashCommandBuilder()
    .setName('send_server')
    .setDescription('Sendet das GitHub-Access-Panel.');

export async function execute(interaction) {
    const onlyGuild = sendServerGuildId();
    if (onlyGuild && interaction.guildId !== onlyGuild) {
        return interaction.reply({
            content: 'Dieser Befehl ist nur auf dem konfigurierten Server verfügbar.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({
            content: "Du hast keine Rechte für diesen Command",
            flags: MessageFlags.Ephemeral
        });
    }

    if (!getSendServerRoleId()) {
        return interaction.reply({
            content:
                'Konfiguration: SEND_SERVER_ROLE_ID fehlt oder ist ungültig — bitte in der .env setzen (siehe Kommentarblock in .env).',
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panelImage = resolvePanelImage();

    const container = new ContainerBuilder();
    if (panelImage?.mediaUrl) {
        const gallery = new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder()
                .setURL(panelImage.mediaUrl)
                .setDescription('Header Image')
        );
        container.addMediaGalleryComponents(gallery);
    }
    container
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## GitHub Access")
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Klicke auf den Button, um die GitHub-Access-Rolle zu erhalten oder zu entfernen.")
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel("GitHub Access")
                    .setCustomId("server_german")
                    .setEmoji("🔗"),
            )
        );

    try {
        await interaction.channel.send({
            components: [container],
            files: panelImage.attachment ? [panelImage.attachment] : [],
            flags: MessageFlags.IsComponentsV2
        });
    } catch (error) {
        console.error('send_server panel send:', error);
        await interaction.editReply({
            content: 'Panel konnte nicht gesendet werden (fehlende Kanalrechte oder ungültige Nachricht).'
        });
        return;
    }

    await interaction.editReply({ content: '✅ GitHub-Access-Panel wurde gesendet.' });

    const ch = interaction.channel?.isTextBased?.() ? `#${interaction.channel.name}` : null;
    store.pushServerLog({
        type: 'cmd',
        user: interaction.user.tag,
        userId: interaction.user.id,
        guildId: interaction.guildId ?? null,
        msg: `${whoExecutedLine(interaction)}Hat <b>/send_server</b> ausgeführt (Panel gesendet).`,
        channel: ch
    });
    store.recordSlash('send_server');
}

export async function buttonHandler(interaction) {
    if (interaction.customId !== 'server_german') {
        return;
    }

    const onlyGuild = sendServerGuildId();
    if (onlyGuild && interaction.guildId !== onlyGuild) {
        try {
            await interaction.reply({
                content: 'Dieses Panel ist nur auf dem konfigurierten Server gültig.',
                flags: MessageFlags.Ephemeral
            });
        } catch {
            /* bereits beantwortet */
        }
        return;
    }

    let replyContainer;

    switch (interaction.customId) {
        case 'server_german': {
            const roleId = getSendServerRoleId();
            if (!roleId) {
                try {
                    await interaction.reply({
                        content:
                            'Konfiguration: SEND_SERVER_ROLE_ID fehlt oder ist ungültig — bitte in der .env setzen und den Bot neu starten.',
                        flags: MessageFlags.Ephemeral
                    });
                } catch {
                    /* bereits beantwortet */
                }
                return;
            }
            const member = interaction.member;
            let actionText;
            try {
                const hadRole = member.roles.cache.has(roleId);
                if (hadRole) {
                    await member.roles.remove(roleId);
                    store.recordRole(false);
                    actionText = `❌ Dir wurde die Rolle <@&${roleId}> entfernt.`;
                    store.pushServerLog({
                        type: 'role',
                        user: member.user.tag,
                        userId: member.user.id,
                        guildId: interaction.guildId ?? null,
                        msg: `${whoExecutedLineFromUser(member.user)}Rolle <b>GitHub Access</b> entfernt.`,
                        channel: interaction.channel?.isTextBased?.() ? `#${interaction.channel.name}` : null
                    });
                } else {
                    await member.roles.add(roleId);
                    store.recordRole(true);
                    actionText = `✅ Dir wurde die Rolle <@&${roleId}> hinzugefügt.`;
                    store.pushServerLog({
                        type: 'role',
                        user: member.user.tag,
                        userId: member.user.id,
                        guildId: interaction.guildId ?? null,
                        msg: `${whoExecutedLineFromUser(member.user)}Rolle <b>GitHub Access</b> erhalten.`,
                        channel: interaction.channel?.isTextBased?.() ? `#${interaction.channel.name}` : null
                    });
                }
            } catch (e) {
                console.error('server_german Rolle:', e);
                try {
                    await interaction.reply({
                        content: 'Rolle konnte nicht geändert werden (Rechte / Hierarchie / Konfiguration).',
                        flags: MessageFlags.Ephemeral
                    });
                } catch {
                    /* bereits beantwortet */
                }
                return;
            }

            store.recordButton('server_german');
            replyContainer = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${actionText}`));
            break;
        }

    }

    if (replyContainer) {
        await interaction.reply({ components: [replyContainer], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    }
}