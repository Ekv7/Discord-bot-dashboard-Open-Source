import dotenv from 'dotenv';
dotenv.config({ override: true });
import './dashboard/guildDataMigration.js';
import { Client, GatewayIntentBits, MessageFlags, Partials, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import * as store from './dashboard/store.js';
import * as memberStats from './dashboard/memberStats.js';
import { installConsoleCapture } from './dashboard/consoleCapture.js';
import { startDashboardServer } from './dashboard/http.js';
import { handleGuildAuditLogEntry } from './dashboard/auditLogHandler.js';
import { installMemberCountPresence, isMemberCountPresenceEnabled, syncMemberCountPresence } from './dashboard/memberCountPresence.js';
import { installGuildEventLogs } from './dashboard/guildEventLogs.js';
import { installMemberRemoveHandler } from './dashboard/memberRemoveHandler.js';
import { installAutomodMessages } from './dashboard/automodMessages.js';
import * as customCommands from './dashboard/customCommandsRuntime.js';
import { syncGuildSettingsFromDiscord, markGuildBotLeft } from './dashboard/guildSettingsStore.js';
import { sendMynexGuildWelcome } from './dashboard/guildWelcomeOnJoin.js';

installConsoleCapture(store.pushConsoleLine);

/** Leerzeichen / Anführungszeichen entfernen; gültige Snowflake (17–20 Ziffern). */
function normalizeGuildId(raw) {
    if (raw == null) return '';
    const s = String(raw)
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\s+/g, '');
    if (!/^\d{17,20}$/.test(s)) {
        const hint = String(raw).trim();
        if (hint) console.warn(`⚠️ Guild-ID ignoriert (ungültiges Format): ${hint.slice(0, 48)}`);
        return '';
    }
    return s;
}

function parseGuildIdsFromAccessRoleMap(raw) {
    const mapRaw = String(raw || '').trim();
    if (!mapRaw) return [];
    const out = [];
    for (const pair of mapRaw.split(',')) {
        const guildPart = String(pair || '').split(':')[0] || '';
        const guildId = normalizeGuildId(guildPart);
        if (guildId) out.push(guildId);
    }
    return out;
}

function normalizeEnvValue(raw) {
    return String(raw || '')
        .trim()
        .replace(/^['"]|['"]$/g, '');
}

function resolveDiscordClientId() {
    const preferredKeys = ['DISCORD_CLIENT_ID', 'DISCORD_APPLICATION_ID', 'CLIENT_ID'];
    for (const key of preferredKeys) {
        const value = normalizeEnvValue(process.env[key]);
        if (value) return value;
    }

    // Fallback: toleriert vertippte Key-Namen wie DISCORD_CLIENTID usw.
    const fuzzyMatch = Object.entries(process.env).find(([key, value]) => {
        const normalizedKey = String(key || '').toUpperCase().replace(/[\s-]/g, '_');
        const normalizedValue = normalizeEnvValue(value);
        return (
            normalizedValue &&
            normalizedKey.startsWith('DISCORD_') &&
            normalizedKey.includes('CLIENT') &&
            normalizedKey.includes('ID')
        );
    });
    return normalizeEnvValue(fuzzyMatch?.[1]);
}

const TOKEN = normalizeEnvValue(process.env.DISCORD_TOKEN);
const CLIENT_ID = resolveDiscordClientId();
const FORCED_BOT_BIO = String(process.env.BOT_FIXED_BIO || 'https://mynexstudios.com')
    .replace(/\\n/g, '\n')
    .trim();
/** Optional: feste „Haupt“-Guild in der Whitelist (kein Hardcode im Repo). */
const BOT_PRIMARY_GUILD_ID = normalizeGuildId(process.env.BOT_PRIMARY_GUILD_ID);
const SINGLE_GUILD_ID = normalizeGuildId(
    process.env.BOT_SINGLE_GUILD_ID ||
        process.env.DASHBOARD_GUILD_ID ||
        process.env.SLASH_COMMAND_GUILD_ID ||
        ''
);
const SECOND_ALLOWED_GUILD_ID = normalizeGuildId(process.env.BOT_SECOND_GUILD_ID);
const EXTRA_ALLOWED_GUILD_IDS = (process.env.BOT_EXTRA_GUILD_IDS || '')
    .split(',')
    .map(id => normalizeGuildId(id))
    .filter(Boolean);
/** Nur diese Guild bekommt /send_server (leer = auf allen erlaubten Guilds wie bisher). */
const SEND_SERVER_GUILD_ID = normalizeGuildId(process.env.SEND_SERVER_GUILD_ID);
const legacyAllowedGuildIds = [SINGLE_GUILD_ID, SECOND_ALLOWED_GUILD_ID].filter(Boolean);
const configuredExtraGuildIds = EXTRA_ALLOWED_GUILD_IDS.length > 0 ? EXTRA_ALLOWED_GUILD_IDS : legacyAllowedGuildIds;
/** Immer erlaubt: Auth-/Dashboard-Server (damit der Bot dort nie wegen falscher BOT_EXTRA-Zeile sofort wieder geht). */
const STICKY_ALLOWED_GUILD_IDS = [
    normalizeGuildId(process.env.DASHBOARD_AUTH_GUILD_ID),
    normalizeGuildId(process.env.DASHBOARD_GUILD_ID),
    ...parseGuildIdsFromAccessRoleMap(process.env.DASHBOARD_ACCESS_ROLE_IDS_BY_GUILD)
].filter(Boolean);
const ALLOW_ALL_GUILDS = ['true', '1', 'yes', 'on'].includes(
    String(process.env.BOT_ALLOW_ALL_GUILDS || '').toLowerCase()
);
const ALLOWED_GUILD_IDS = (() => {
    if (ALLOW_ALL_GUILDS) return [];
    const merged = [...STICKY_ALLOWED_GUILD_IDS, BOT_PRIMARY_GUILD_ID, ...configuredExtraGuildIds].filter(Boolean);
    const out = [];
    const seen = new Set();
    for (const id of merged) {
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= 15) break;
    }
    return out;
})();

/** false = Bot verlässt Server, die nicht auf der Whitelist stehen, nicht (nur Debug). Standard: true */
const AUTO_LEAVE_UNLISTED_GUILDS = !['false', '0', 'no', 'off'].includes(
    String(process.env.BOT_LEAVE_UNLISTED_GUILDS ?? 'true').toLowerCase()
);
const AUTO_JOIN_ROLE_GUILD_ID = normalizeGuildId(process.env.AUTO_JOIN_ROLE_GUILD_ID);
const AUTO_JOIN_ROLE_ID = normalizeGuildId(process.env.AUTO_JOIN_ROLE_ID);

if (!TOKEN || !CLIENT_ID) {
    const knownDiscordKeys = Object.keys(process.env)
        .filter(key => String(key).toUpperCase().includes('DISCORD'))
        .sort();
    console.error('Fehlend: DISCORD_TOKEN und/oder DISCORD_CLIENT_ID in .env.');
    console.error('Pflicht-Beispiel: DISCORD_TOKEN=... und DISCORD_CLIENT_ID=...');
    if (knownDiscordKeys.length) {
        console.error(`Gefundene DISCORD_* Keys: ${knownDiscordKeys.join(', ')}`);
    }
    process.exit(1);
}

async function main() {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildModeration,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildInvites,
            GatewayIntentBits.MessageContent
        ],
        partials: [Partials.Message, Partials.Channel]
    });

    const commands = [];
    const commandFiles = fs.readdirSync(path.join('./commands')).filter(file => file.endsWith('.js'));
    const commandCollection = new Map();

    for (const file of commandFiles) {
        try {
            const command = await import(`./commands/${file}`);
            if (!command?.data?.toJSON || !command?.data?.name) {
                throw new Error('Ungültiges Command-Modul (data/toJSON fehlt)');
            }
            commands.push(command.data.toJSON());
            commandCollection.set(command.data.name, command);
        } catch (error) {
            console.error(`Command konnte nicht geladen werden (${file}):`, error?.message || error);
            store.recordError();
        }
    }

    const DASHBOARD_BUTTON_META = [
        { label: 'Button: GitHub Access', description: 'Toggle Rolle (server_github)', usageKey: 'button_github' }
    ];

    function slashCommandsForGuild(guildId) {
        if (!SEND_SERVER_GUILD_ID) return commands;
        return commands.filter(c => c.name !== 'send_server' || guildId === SEND_SERVER_GUILD_ID);
    }

    /** File-Commands + Custom-Flows nur für diese Guild (Guild-Slash-Registrierung). */
    function slashBodiesForGuild(guildId) {
        return [
            ...slashCommandsForGuild(guildId),
            ...customCommands.getSlashCommandBodiesForGuild(guildId)
        ];
    }

    function refreshDashboardCommandMetadata() {
        store.setCommandMetadata(
            [
                ...commands.map(c => ({ name: c.name, description: c.description || '' })),
                ...customCommands.getAllStoreMetaEntries()
            ],
            DASHBOARD_BUTTON_META
        );
    }

    customCommands.setReservedSlashNames([...commandCollection.keys()]);
    customCommands.reloadFromDisk();
    refreshDashboardCommandMetadata();

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    installMemberCountPresence(client);
    installGuildEventLogs(client);
    installMemberRemoveHandler(client);
    installAutomodMessages(client);

    const allowedGuildSet = new Set(ALLOWED_GUILD_IDS);

    function isAllowedGuild(guildId) {
        if (ALLOW_ALL_GUILDS || !ALLOWED_GUILD_IDS.length) return true;
        return allowedGuildSet.has(String(guildId));
    }

    /**
     * Slash sync — nur Warnungen/Fehler einzeln loggen; Erfolg in der Start-Zusammenfassung.
     * @returns {{ mode: 'global'|'guild', synced: number, total: number, skipped: string[] }}
     */
    async function registerSlashCommands() {
        const skipped = [];
        try {
            if (ALLOW_ALL_GUILDS) {
                let synced = 0;
                for (const guildId of client.guilds.cache.keys()) {
                    try {
                        const body = slashBodiesForGuild(guildId);
                        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body });
                        synced += 1;
                    } catch (err) {
                        console.error(`Slash-Sync fehlgeschlagen (${guildId}):`, err?.message || err);
                        store.recordError();
                    }
                }
                return { mode: 'guild', synced, total: client.guilds.cache.size, skipped: [] };
            }
            if (!ALLOWED_GUILD_IDS.length) {
                await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
                if (customCommands.hasGuildScopedFlows()) {
                    console.warn(
                        'Custom Flow-Commands: Globaler Slash-Modus aktiv — Flow-Befehle werden nur mit Guild-Slash-Sync registriert. Setze z. B. BOT_ALLOW_ALL_GUILDS=true oder Whitelist-Guilds, damit /api pro Server funktioniert.'
                    );
                }
                return { mode: 'global', synced: 1, total: 0, skipped: [] };
            }
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
            let synced = 0;
            for (const guildId of ALLOWED_GUILD_IDS) {
                if (!client.guilds.cache.has(guildId)) {
                    console.warn(`Slash-Sync übersprungen — Bot nicht auf Guild ${guildId} (einladen & neu starten).`);
                    skipped.push(guildId);
                    continue;
                }
                try {
                    const body = slashBodiesForGuild(guildId);
                    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body });
                    synced += 1;
                } catch (err) {
                    console.error(`Slash-Sync fehlgeschlagen (${guildId}):`, err?.message || err);
                    store.recordError();
                }
            }
            if (synced === 0) {
                console.warn('Kein Slash-Sync — Bot auf mindestens einen freigegebenen Server einladen.');
            }
            return { mode: 'guild', synced, total: ALLOWED_GUILD_IDS.length, skipped };
        } catch (err) {
            console.error('Slash-Command-Registrierung:', err);
            store.recordError();
            return { mode: 'guild', synced: 0, total: ALLOWED_GUILD_IDS.length, skipped };
        }
    }

    /**
     * Einmal beim Start; keine Intervalle.
     * Für Bot-Profile setzen wir zusätzlich die Application-Description,
     * weil viele Clients diese im Profil anzeigen.
     */
    async function ensureFixedBotBio() {
        if (!FORCED_BOT_BIO || !client?.user) return;
        try {
            const current = await client.rest.get(Routes.user());
            const currentBio = typeof current?.bio === 'string' ? current.bio.trim() : '';
            if (currentBio !== FORCED_BOT_BIO) {
                await client.rest.patch(Routes.user(), { body: { bio: FORCED_BOT_BIO } });
            }
        } catch (error) {
            console.error('Bot-Bio konnte nicht gesetzt werden (ggf. Discord-API Limit/Policy):', error);
            store.recordError();
        }

        try {
            if (!client.application) return;
            await client.application.fetch();
            const appDescription = String(client.application.description || '').trim();
            const nextDescription = FORCED_BOT_BIO.slice(0, 400);
            if (appDescription === nextDescription) return;
            await client.application.edit({ description: nextDescription });
        } catch (error) {
            console.error('Application-Description konnte nicht gesetzt werden:', error);
            store.recordError();
        }
    }

    async function leaveIfNotAllowed(guild) {
        try {
            if (!guild || ALLOW_ALL_GUILDS || isAllowedGuild(guild.id)) return;
            const gid = String(guild.id);
            if (!AUTO_LEAVE_UNLISTED_GUILDS) {
                console.warn(
                    `ℹ️ Guild nicht auf Whitelist (${guild.name} / ${gid}) — BOT_LEAVE_UNLISTED_GUILDS=false, Bot bleibt.`
                );
                return;
            }
            console.warn(
                `⚠️ Unerlaubte Guild (${guild.name} / ${gid}). Erlaubt: ${ALLOWED_GUILD_IDS.join(', ')} → Bot verlässt Server.`
            );
            await guild.leave();
        } catch (error) {
            console.error('Konnte unerlaubte Guild nicht verlassen:', error);
            store.recordError();
        }
    }

    client.once('clientReady', async () => {
        if (!isMemberCountPresenceEnabled() && client.user) {
            try {
                client.user.setPresence({ activities: [] });
            } catch (e) {
                console.error('Bot-Status zurücksetzen fehlgeschlagen:', e?.message || e);
            }
        }
        const slash = await registerSlashCommands();
        void ensureFixedBotBio();
        if (ALLOWED_GUILD_IDS.length) {
            for (const guild of client.guilds.cache.values()) {
                void leaveIfNotAllowed(guild);
            }
        }
        const port = Number(process.env.DASHBOARD_PORT || 3847);
        const host = (process.env.DASHBOARD_HOST || '127.0.0.1').trim() || '127.0.0.1';
        startDashboardServer({
            getClient: () => client,
            port,
            host,
            secret: process.env.DASHBOARD_SECRET || '',
            reservedSlashNames: [...commandCollection.keys()],
            onCustomCommandsChanged: async () => {
                customCommands.setReservedSlashNames([...commandCollection.keys()]);
                customCommands.reloadFromDisk();
                refreshDashboardCommandMetadata();
                await registerSlashCommands();
            }
        });
        syncMemberCountPresence(client);

        for (const g of client.guilds.cache.values()) {
            try {
                syncGuildSettingsFromDiscord(g);
            } catch (e) {
                console.warn('guild settings sync:', e?.message || e);
            }
        }

        const gCount = client.guilds.cache.size;
        let slashBrief =
            slash.mode === 'global' ? 'Slash global registriert' : `Slash ${slash.synced}/${slash.total} Server`;
        if (slash.skipped.length) slashBrief += ` (${slash.skipped.length} ohne Bot)`;
        const wl = ALLOW_ALL_GUILDS
            ? 'Whitelist aus (alle Guilds erlaubt)'
            : ALLOWED_GUILD_IDS.length
              ? `${ALLOWED_GUILD_IDS.length} Whitelist`
              : 'keine Whitelist';
        console.log(
            `✅ Bereit: ${client.user.tag} · ${gCount} Guild(s) · ${slashBrief} · ${wl} · Dashboard http://${host}:${port}`
        );
    });

    client.on('guildCreate', guild => {
        try {
            syncGuildSettingsFromDiscord(guild);
        } catch (e) {
            console.warn('guild settings (create):', e?.message || e);
        }
        void leaveIfNotAllowed(guild);
        if (!isAllowedGuild(guild.id)) return;
        void sendMynexGuildWelcome(guild);
        void (async () => {
            try {
                const body = slashBodiesForGuild(guild.id);
                await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guild.id), { body });
            } catch (error) {
                console.error(`Slash-Sync bei Guild-Join fehlgeschlagen (${guild.id}):`, error);
                store.recordError();
            }
        })();
    });

    client.on('guildDelete', guild => {
        try {
            markGuildBotLeft(guild);
        } catch (e) {
            console.warn('guild settings (delete):', e?.message || e);
        }
    });

    client.on('guildMemberAdd', member => {
        void (async () => {
            try {
                if (member.guild?.id === AUTO_JOIN_ROLE_GUILD_ID) {
                    const role = member.guild.roles.cache.get(AUTO_JOIN_ROLE_ID);
                    const botMember = member.guild.members.me;
                    if (role && botMember?.permissions?.has('ManageRoles') && role.position < botMember.roles.highest.position) {
                        await member.roles.add(role, 'Auto-Join-Rolle für diesen Server');
                    }
                }
            } catch (e) {
                console.error('Auto-Join-Rolle fehlgeschlagen:', e?.message || e);
                store.recordError();
            }
        })();

        try {
            memberStats.recordJoin(member.guild?.id);
        } catch (e) {
            console.error('memberStats.recordJoin:', e);
        }
        store.pushServerLog({
            type: 'join',
            user: member.user.tag,
            userId: member.user.id,
            guildId: member.guild?.id ?? null,
            msg: 'Ist dem Server beigetreten',
            channel: null
        });
    });

    client.on('guildBanAdd', ban => {
        store.pushServerLog({
            type: 'ban',
            user: ban.user.tag,
            userId: ban.user.id,
            guildId: ban.guild?.id ?? null,
            msg: 'Wurde gebannt',
            channel: null
        });
    });

    client.on('guildAuditLogEntryCreate', (entry, guild) => {
        handleGuildAuditLogEntry(entry, guild).catch(err => {
            console.error('guildAuditLogEntryCreate:', err);
        });
    });

    client.on('voiceStateUpdate', (oldState, newState) => {
        const member = newState.member;
        if (!member?.user) return;
        if (!oldState.channelId && newState.channelId) {
            const ch = newState.channel?.name || '?';
            store.pushServerLog({
                type: 'voice',
                user: member.user.tag,
                userId: member.user.id,
                guildId: newState.guild?.id ?? null,
                msg: `Voice beigetreten: ${ch}`,
                channel: ch
            });
        } else if (oldState.channelId && !newState.channelId) {
            const ch = oldState.channel?.name || '?';
            store.pushServerLog({
                type: 'voice',
                user: member.user.tag,
                userId: member.user.id,
                guildId: oldState.guild?.id ?? null,
                msg: `Voice verlassen: ${ch}`,
                channel: null
            });
        }
    });

    client.on('interactionCreate', async interaction => {
        if (interaction.guildId && !isAllowedGuild(interaction.guildId)) {
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Dieser Bot ist nur für freigegebene Server freigeschaltet.',
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch (error) {
                console.error('Antwort für falsche Guild fehlgeschlagen:', error);
                store.recordError();
            }
            return;
        }
        if (interaction.isChatInputCommand()) {
            try {
                if (await customCommands.tryExecuteCustomCommand(interaction)) {
                    if (interaction.guildId) {
                        store.recordFlowSlash(interaction.guildId, interaction.commandName);
                    }
                    return;
                }
            } catch (error) {
                console.error('Custom-Flow:', error);
                store.recordError();
                try {
                    const payload = {
                        content: '❌ Beim Ausführen des benutzerdefinierten Befehls ist ein Fehler aufgetreten.',
                        flags: MessageFlags.Ephemeral
                    };
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(payload);
                    } else {
                        await interaction.reply(payload);
                    }
                } catch (replyErr) {
                    console.error('Konnte Fehlerantwort nicht senden:', replyErr);
                }
                return;
            }
            const command = commandCollection.get(interaction.commandName);
            if (command) {
                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error(error);
                    store.recordError();
                    try {
                        const payload = {
                            content: '❌ Beim Ausführen des Commands ist ein Fehler aufgetreten.',
                            flags: MessageFlags.Ephemeral
                        };
                        if (interaction.replied || interaction.deferred) {
                            await interaction.followUp(payload);
                        } else {
                            await interaction.reply(payload);
                        }
                    } catch (replyErr) {
                        console.error('Konnte Fehlerantwort nicht senden:', replyErr);
                    }
                }
            }
        }

        if (interaction.isButton()) {
            for (const command of commandCollection.values()) {
                if (command.buttonHandler) {
                    try {
                        await command.buttonHandler(interaction);
                    } catch (error) {
                        console.error('Button-Handler Fehler:', error);
                        store.recordError();
                        try {
                            if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply({
                                    content: '❌ Aktion fehlgeschlagen.',
                                    flags: MessageFlags.Ephemeral
                                });
                            }
                        } catch (replyErr) {
                            console.error(replyErr);
                        }
                    }
                }
            }
        }
    });

    try {
        await client.login(TOKEN);
    } catch (err) {
        console.error('Login fehlgeschlagen:', err);
        store.recordError();
        process.exit(1);
    }
}

await main();

