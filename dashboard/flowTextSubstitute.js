/**
 * Platzhalter wie {user}, {channel}, {option:name} in Flow-Texten ersetzen.
 * Zusätzlich {var:schlüssel} für Flow-Variablen (Map).
 */

const MAX_REPLACE_SEGMENT = 4000;

/**
 * Steuerzeichen entfernen, Länge begrenzen (kein HTML im Discord-Kontext, trotzdem härten).
 * @param {unknown} v
 * @returns {string}
 */
function sanitizeSegment(v) {
    return String(v)
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
        .slice(0, MAX_REPLACE_SEGMENT);
}

/**
 * @param {string} text
 * @param {object} opts
 * @param {import('discord.js').ChatInputCommandInteraction} opts.interaction
 * @param {import('discord.js').User} [opts.targetUser]
 * @param {import('discord.js').GuildMember | null} [opts.targetMember]
 * @param {Map<string, string>} [opts.flowVars]
 */
export function substituteFlowText(text, opts) {
    if (text == null) return '';
    const s = String(text);
    const ix = opts.interaction;
    const guild = ix.guild;
    const channel = ix.channel;
    const user = ix.user;
    const member = ix.member;
    const vars = opts.flowVars || new Map();

    return s.replace(/\{([^}]+)\}/g, (full, keyRaw) => {
        const key = String(keyRaw).trim();
        const lower = key.toLowerCase();

        if (lower.startsWith('var:')) {
            const k = key.slice(4).trim();
            return vars.has(k) ? sanitizeSegment(vars.get(k)) : '';
        }
        if (lower.startsWith('option:')) {
            const name = key.slice(7).trim();
            if (!name) return '';
            try {
                const str = ix.options?.getString(name, false);
                if (str != null) return sanitizeSegment(str);
                const num = ix.options?.getInteger(name, false);
                if (num != null) return sanitizeSegment(String(num));
                const numF = ix.options?.getNumber(name, false);
                if (numF != null) return sanitizeSegment(String(numF));
                const bool = ix.options?.getBoolean(name, false);
                if (bool != null) return bool ? 'true' : 'false';
                const u = ix.options?.getUser(name, false);
                if (u) return u.toString();
                const ch = ix.options?.getChannel(name, false);
                if (ch && 'toString' in ch) return ch.toString();
                const role = ix.options?.getRole(name, false);
                if (role) return role.toString();
            } catch {
                return '';
            }
            return '';
        }

        switch (lower) {
            case 'user':
                return user?.toString() || '';
            case 'user.id':
                return user?.id || '';
            case 'user.name':
            case 'user.username':
                return sanitizeSegment(user?.username || '');
            case 'user.tag':
                return sanitizeSegment(user?.tag || user?.username || '');
            case 'user.mention':
                return user ? `<@${user.id}>` : '';
            case 'member':
            case 'member.mention':
                return member && 'toString' in member ? member.toString() : user ? `<@${user.id}>` : '';
            case 'channel':
                return channel && 'toString' in channel ? channel.toString() : '';
            case 'channel.id':
                return channel?.id || '';
            case 'channel.name':
                return channel && 'name' in channel ? sanitizeSegment(String(channel.name)) : '';
            case 'guild':
                return sanitizeSegment(guild?.name || '');
            case 'guild.id':
                return guild?.id || '';
            case 'guild.name':
                return sanitizeSegment(guild?.name || '');
            case 'server':
                return sanitizeSegment(guild?.name || '');
            case 'server.id':
                return guild?.id || '';
            case 'server.name':
                return sanitizeSegment(guild?.name || '');
            case 'target':
                return opts.targetUser?.toString() || user?.toString() || '';
            case 'target.id':
                return opts.targetUser?.id || '';
            case 'target.name':
                return sanitizeSegment(opts.targetUser?.username || '');
            case 'target.mention':
                return opts.targetUser ? `<@${opts.targetUser.id}>` : '';
            default:
                return full;
        }
    });
}
