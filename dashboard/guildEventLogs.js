import { installMessageLogEvents } from './guildLogMessages.js';
import { installChannelLogEvents } from './guildLogChannels.js';
import { installMemberInviteLogEvents } from './guildLogMemberInvite.js';

/**
 * Server-Logs: Nachrichten, Kanäle, Nickname/Mitglied-Updates, Invites.
 * @param {import('discord.js').Client} client
 */
export function installGuildEventLogs(client) {
    installMessageLogEvents(client);
    installChannelLogEvents(client);
    installMemberInviteLogEvents(client);
}
