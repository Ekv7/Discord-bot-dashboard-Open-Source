import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

/**
 * Begrüßungs-Embed nach Guild-Join. Fehler werden still ignoriert (kein Crash).
 * @param {import('discord.js').Guild} guild
 */
export async function sendMynexGuildWelcome(guild) {
    try {
        const me = guild.members.me;
        if (!me) return;

        const needed =
            PermissionFlagsBits.ViewChannel |
            PermissionFlagsBits.SendMessages |
            PermissionFlagsBits.EmbedLinks;

        const channels = guild.channels.cache
            .filter((ch) => ch.isTextBased() && !ch.isDMBased())
            .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0));

        const dashboardUrl = (process.env.DASHBOARD_PUBLIC_URL || '').trim().replace(/\/+$/, '');

        const ersteSchritte = [
            '• Admin-Rechte (oder passende Einzelrechte) empfehlen wir für volle Funktion (Moderation, Logs, Rollen).',
            '• Dashboard-Zugriff: Nur der Server-Owner legt im Web-Dashboard die Zugriffsrolle fest (Navigation Dashboard-Zugriff). Mitglieder mit dieser Rolle (oder der Owner) können das Dashboard nutzen.',
        ].join('\n');

        const beschreibung =
            'Ich bin der Mynex Bot, dein Discord-Bot für Moderation, Server-Protokolle und eigene Befehle per visuellem Flow-Editor. ' +
            'Im Dashboard kannst du Logs einsehen, Verwarnungen verwalten und Custom Commands bauen, alles passend zu deinem Server.';

        const embed = new EmbedBuilder()
            .setTitle('Hallo! Ich bin der Mynex Bot.')
            .setColor(0x5865f2)
            .setDescription(beschreibung)
            .setFooter({ text: 'Viel Spaß mit dem Mynex Bot 🚀' });

        if (dashboardUrl) {
            embed.addFields({ name: 'Dashboard', value: dashboardUrl });
        }
        embed.addFields({ name: 'Erste Schritte', value: ersteSchritte });

        for (const ch of channels.values()) {
            try {
                const perms = ch.permissionsFor(me);
                if (!perms?.has(needed)) continue;
                await ch.send({ embeds: [embed] });
                return;
            } catch {
                // nächster Kanal
            }
        }
    } catch {
        // still: kein Logging nötig
    }
}
