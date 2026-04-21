const originals = {
    log: console.log,
    error: console.error,
    warn: console.warn
};

function redactSecrets(text) {
    if (!text) return text;
    const envSecrets = [
        process.env.DISCORD_TOKEN,
        process.env.DISCORD_CLIENT_SECRET,
        process.env.DASHBOARD_SECRET,
        process.env.DASHBOARD_SESSION_SECRET
    ]
        .map(v => String(v || '').trim())
        .filter(v => v.length >= 8);

    let out = String(text);
    for (const secret of envSecrets) {
        out = out.split(secret).join('[REDACTED]');
    }
    // Discord token-like patterns + generic Bearer values
    out = out.replace(/\b[\w-]{20,}\.[\w-]{6,}\.[\w-]{20,}\b/g, '[REDACTED_TOKEN]');
    out = out.replace(/(authorization\s*:\s*bearer\s+)[^\s"']+/gi, '$1[REDACTED]');
    return out;
}

function stringify(args) {
    return redactSecrets(
        args
        .map(a => {
            if (typeof a === 'string') return a;
            if (a instanceof Error) return a.stack || a.message;
            try {
                return JSON.stringify(a);
            } catch {
                return String(a);
            }
        })
        .join(' ')
    );
}

export function installConsoleCapture(pushConsoleLine) {
    console.log = (...args) => {
        originals.log.apply(console, args);
        pushConsoleLine('log', stringify(args));
    };
    console.error = (...args) => {
        originals.error.apply(console, args);
        pushConsoleLine('error', stringify(args));
    };
    console.warn = (...args) => {
        originals.warn.apply(console, args);
        pushConsoleLine('warn', stringify(args));
    };
}
