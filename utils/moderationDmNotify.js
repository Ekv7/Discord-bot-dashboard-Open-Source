/**
 * Sendet eine DM bei Moderationsaktionen. Fehler werden still ignoriert,
 * damit Moderation nie wegen geschlossener DMs fehlschlägt.
 */
export async function sendModerationDm({
    user,
    guildName,
    moderatorTag,
    actionLabel,
    reason,
    durationText = ''
}) {
    try {
        if (!user) return false;
        const safeGuild = String(guildName || 'Unbekannter Server');
        const safeMod = String(moderatorTag || 'Unbekannt');
        const safeAction = String(actionLabel || 'Moderation');
        const reasonText =
            typeof reason === 'string' && reason.trim()
                ? reason.trim().slice(0, 400)
                : 'Kein Grund angegeben';
        const durationLine =
            typeof durationText === 'string' && durationText.trim()
                ? `\nDauer: ${durationText.trim().slice(0, 120)}`
                : '';

        await user.send(
            `Hinweis zu deinem Account auf **${safeGuild}**\n` +
            `Aktion: **${safeAction}**\n` +
            `Von: **${safeMod}**\n` +
            `Grund: ${reasonText}${durationLine}`
        );
        return true;
    } catch {
        return false;
    }
}

