import crypto from 'crypto';

const SESSION_COOKIE = 'mynex_dash_sess';
const STATE_COOKIE = 'mynex_oauth_state';

/** Öffentlicher API-Pfad (/api oder /api/v1) — muss zu DASHBOARD_OAUTH_REDIRECT_URI und Frontend passen. */
function dashboardApiPrefix() {
    const ex = (process.env.DASHBOARD_API_PREFIX || '').trim().replace(/\/+$/, '');
    if (ex) return ex;
    if ((process.env.DASHBOARD_FRONTEND_URL || '').trim()) return '/api/v1';
    return '/api';
}

function authPath(segment) {
    const p = dashboardApiPrefix();
    return `${p}/auth${segment}`;
}

function dashboardFrontendBase() {
    return (process.env.DASHBOARD_FRONTEND_URL || '').trim().replace(/\/+$/, '');
}

function dashboardHomeHref() {
    const f = dashboardFrontendBase();
    return f ? `${f}/` : '/';
}

function dashboardLoginHref() {
    const f = dashboardFrontendBase();
    return f ? `${f}/login` : '/login';
}

/** Session-Cookies für fetch(..., { credentials }) vom Titan-Dashboard (andere Origin). */
function useCrossSiteSessionCookies() {
    const flag = String(process.env.DASHBOARD_CROSS_SITE_SESSION || '').toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(flag)) return true;
    if (['false', '0', 'no', 'off'].includes(flag)) return false;
    return Boolean((process.env.DASHBOARD_CORS_ORIGINS || '').trim());
}

/** Voll-URL für Login (SPA auf anderer Origin braucht absoluten Link). */
function absoluteDiscordLoginUrl() {
    const path = authPath('/discord');
    const pub = (process.env.DASHBOARD_PUBLIC_URL || '').trim().replace(/\/+$/, '');
    if (pub) return `${pub}${path}`;
    return path;
}

function sendHtml(res, status, title, body, extraHeaders = {}) {
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#06080e;color:#e8eaf0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px;}
.box{width:min(520px,100%);padding:28px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:linear-gradient(180deg,#101521,#0b101a);}
h1{margin:0 0 10px;font-size:34px;line-height:1.1;font-weight:800;letter-spacing:-.02em;}
p{margin:8px 0;color:#aab1bd;line-height:1.5}
code{background:#00000066;padding:1px 6px;border-radius:6px}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
.btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.14);padding:10px 14px;border-radius:10px;text-decoration:none;color:#e8eaf0;font-weight:600}
.btn-discord{background:#5865f2;border-color:#5865f2;color:#fff}
.btn-secondary{background:rgba(255,255,255,.04)}
</style></head><body><div class="box">${body}</div></body></html>`;
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...extraHeaders });
    res.end(html);
}

function signPayload(secret, obj) {
    const p = Buffer.from(JSON.stringify(obj)).toString('base64url');
    const s = crypto.createHmac('sha256', secret).update(p).digest('base64url');
    return `${p}.${s}`;
}

function verifySigned(secret, token) {
    if (!token || typeof token !== 'string') return null;
    const dot = token.lastIndexOf('.');
    if (dot < 1) return null;
    const p = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const exp = crypto.createHmac('sha256', secret).update(p).digest('base64url');
    const sb = Buffer.from(sig, 'utf8');
    const eb = Buffer.from(exp, 'utf8');
    if (sb.length !== eb.length || !crypto.timingSafeEqual(sb, eb)) return null;
    try {
        return JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}

/**
 * Nur relative SPA-Pfade erlauben (kein Open-Redirect).
 * @param {unknown} raw
 * @returns {string}
 */
function sanitizeOAuthNextPath(raw) {
    if (typeof raw !== 'string') return '/';
    const trimmed = raw.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/';
    if (trimmed.length > 512) return '/';
    if (/[\0\r\n]/.test(trimmed)) return '/';
    const q = trimmed.indexOf('?');
    const pathOnly = q === -1 ? trimmed : trimmed.slice(0, q);
    const query = q === -1 ? '' : trimmed.slice(q);
    if (pathOnly.includes('..')) return '/';
    if (!/^\/[a-zA-Z0-9/_-]*$/.test(pathOnly)) return '/';
    const pathLower = pathOnly.toLowerCase();
    if (pathLower === '/login' || pathLower.startsWith('/login/')) return '/';
    return pathOnly + query;
}

function parseCookies(req) {
    const raw = req.headers.cookie;
    if (!raw) return {};
    const out = {};
    for (const part of raw.split(';')) {
        const i = part.indexOf('=');
        if (i < 0) continue;
        const k = part.slice(0, i).trim();
        const v = part.slice(i + 1).trim();
        try {
            out[k] = decodeURIComponent(v);
        } catch {
            // Defekte Cookie-Werte ignorieren statt Request mit URIError zu killen.
            out[k] = v;
        }
    }
    return out;
}

/** Cookies mit Secure, wenn öffentliche Dashboard-URL per HTTPS erreichbar ist (auch ohne NODE_ENV=production). */
function useSecureDashboardCookies() {
    const flag = String(process.env.DASHBOARD_SECURE_COOKIES || '').toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(flag)) return true;
    if (['false', '0', 'no', 'off'].includes(flag)) return false;
    const pub = String(process.env.DASHBOARD_PUBLIC_URL || '').trim().toLowerCase();
    if (pub.startsWith('https://')) return true;
    return process.env.NODE_ENV === 'production';
}

function buildCookieHeader(name, value, maxAgeSec, httpOnly = true) {
    const sameSite = useCrossSiteSessionCookies() ? 'None' : 'Lax';
    const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', `SameSite=${sameSite}`];
    if (httpOnly) parts.push('HttpOnly');
    if (maxAgeSec > 0) parts.push(`Max-Age=${maxAgeSec}`);
    else parts.push('Max-Age=0');
    if (useSecureDashboardCookies() || sameSite === 'None') parts.push('Secure');
    return parts.join('; ');
}

function setCookie(res, name, value, maxAgeSec, httpOnly = true) {
    res.setHeader('Set-Cookie', buildCookieHeader(name, value, maxAgeSec, httpOnly));
}

function parseSystemAllowedUserIds() {
    const ownerId = (process.env.OWNER_ID || process.env.DASHBOARD_OWNER_USER_ID || '').trim();
    const extra = String(process.env.DASHBOARD_SYSTEM_ALLOW_USER_IDS || '')
        .split(',')
        .map(s => s.trim())
        .filter(id => /^\d{17,22}$/.test(id));
    const out = new Set();
    if (/^\d{17,22}$/.test(ownerId)) out.add(ownerId);
    for (const id of extra) out.add(id);
    return out;
}

function initialsFromName(input) {
    const cleaned = String(input || '').trim();
    if (!cleaned) return '?';
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function discordDefaultAvatarIndex(userId, discriminator) {
    if (discriminator && discriminator !== '0') {
        const num = Number.parseInt(discriminator, 10);
        if (Number.isFinite(num)) return Math.abs(num) % 5;
    }
    try {
        return Number((BigInt(userId) >> 22n) % 6n);
    } catch {
        return 0;
    }
}

function discordAvatarUrl(userLike, userId) {
    const avatarHash = userLike?.avatar || null;
    if (avatarHash) {
        const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=128`;
    }
    const index = discordDefaultAvatarIndex(userId, userLike?.discriminator);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

/**
 * @param {{
 *   clientId: string,
 *   clientSecret: string,
 *   redirectUri: string,
 *   guildId: string,
 *   accessRoleId: string,
 *   sessionSecret: string,
 *   sessionMaxDays?: number
 * }} opts
 */
export function createDiscordDashboardAuth(opts) {
    const {
        clientId,
        clientSecret,
        redirectUri,
        guildId,
        sessionSecret,
        sessionMaxDays = 7
    } = opts;

    function isConfigured() {
        // Login braucht nur OAuth-Basis + Session-Secret.
        // Guild/Rolle werden serverbezogen in der API geprüft.
        return Boolean(clientId && clientSecret && redirectUri && sessionSecret);
    }

    function getSession(req) {
        const cookies = parseCookies(req);
        const token = cookies[SESSION_COOKIE];
        if (!token) return null;
        const data = verifySigned(sessionSecret, token);
        if (!data || !data.sub || typeof data.exp !== 'number') return null;
        if (data.exp < Date.now()) return null;
        if (typeof data.username !== 'string' || !data.username.trim()) return null;
        if (typeof data.avatarUrl !== 'string' || !data.avatarUrl.trim()) return null;
        return {
            userId: data.sub,
            username: data.username,
            avatarUrl: data.avatarUrl,
            initials: typeof data.initials === 'string' ? data.initials : initialsFromName(data.username)
        };
    }

    async function exchangeCode(code) {
        const body = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri
        });
        const r = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        });
        if (!r.ok) {
            const t = await r.text();
            throw new Error(`token ${r.status}: ${t.slice(0, 200)}`);
        }
        return r.json();
    }

    async function fetchMyUser(accessToken) {
        const r = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!r.ok) return null;
        return r.json();
    }

    /**
     * @returns {Promise<boolean>} true wenn Anfrage vollständig beantwortet
     */
    async function handleAuthRoutes(req, res, url) {
        if (req.method === 'GET' && url.pathname === '/api/auth/discord') {
            if (!isConfigured()) {
                sendHtml(
                    res,
                    503,
                    'Konfiguration',
                    '<h1>OAuth nicht konfiguriert</h1><p>In <code>.env</code>: <code>DISCORD_CLIENT_SECRET</code>, <code>DASHBOARD_AUTH_GUILD_ID</code> oder <code>DASHBOARD_GUILD_ID</code> (Server für Login-Check), <code>DASHBOARD_ACCESS_ROLE_ID</code> (Pflichtrolle auf diesem Server), <code>DASHBOARD_SESSION_SECRET</code>. OAuth2 → Redirects = <code>DASHBOARD_OAUTH_REDIRECT_URI</code>. Details im Kommentarblock in <code>.env</code>.</p>'
                );
                return true;
            }
            const nextPath = sanitizeOAuthNextPath(url.searchParams.get('next'));
            const state = signPayload(sessionSecret, {
                typ: 'oauth',
                t: Date.now(),
                exp: Date.now() + 10 * 60 * 1000,
                next: nextPath
            });
            setCookie(res, STATE_COOKIE, state, 600, true);
            const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: 'identify guilds.members.read',
                state,
                prompt: 'consent'
            });
            res.writeHead(302, {
                Location: `https://discord.com/api/oauth2/authorize?${params.toString()}`
            });
            res.end();
            return true;
        }

        if (req.method === 'GET' && url.pathname === '/api/auth/callback') {
            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');
            const cookies = parseCookies(req);
            const expectedState = cookies[STATE_COOKIE];

            const clearState = { 'Set-Cookie': buildCookieHeader(STATE_COOKIE, '', 0, true) };

            if (!code || !state) {
                sendHtml(
                    res,
                    400,
                    'Fehler',
                    `<h1>Anmeldung abgebrochen</h1><p>Die Discord-Anmeldung wurde beendet oder war ungültig.</p><div class="actions"><a class="btn btn-discord" href="${authPath('/discord')}">Mit Discord anmelden</a><a class="btn btn-secondary" href="${dashboardHomeHref()}">Zurück</a></div>`,
                    clearState
                );
                return true;
            }

            const stateData = verifySigned(sessionSecret, state);
            if (!stateData || stateData.typ !== 'oauth' || stateData.exp < Date.now()) {
                sendHtml(
                    res,
                    400,
                    'Fehler',
                    `<h1>Ungültige Sitzung</h1><p>Die Login-Session ist abgelaufen.</p><div class="actions"><a class="btn btn-discord" href="${authPath('/discord')}">Neu anmelden</a></div>`,
                    clearState
                );
                return true;
            }
            // Robuster Callback für Tunnel/Proxy-Setups:
            // Wenn der State-Cookie vorhanden ist, muss er exakt passen.
            // Fehlt der Cookie (Browser-/Proxy-Eigenheiten), akzeptieren wir weiterhin
            // den signierten, nicht abgelaufenen state-Parameter.
            if (expectedState && state !== expectedState) {
                sendHtml(
                    res,
                    400,
                    'Fehler',
                    `<h1>Anmeldung abgebrochen</h1><p>Die Discord-Anmeldung wurde beendet oder war ungültig.</p><div class="actions"><a class="btn btn-discord" href="${authPath('/discord')}">Mit Discord anmelden</a><a class="btn btn-secondary" href="${dashboardHomeHref()}">Zurück</a></div>`,
                    clearState
                );
                return true;
            }

            try {
                const tok = await exchangeCode(code);
                const user = await fetchMyUser(tok.access_token);
                if (!user?.id) {
                    sendHtml(
                        res,
                        403,
                        'Kein Zugriff',
                        `<h1>Discord-Profil nicht verfügbar</h1><p>Der Account konnte nicht geladen werden. Bitte erneut anmelden.</p><div class="actions"><a class="btn btn-discord" href="${authPath('/discord')}">Erneut anmelden</a></div>`,
                        clearState
                    );
                    return true;
                }

                const exp = Date.now() + sessionMaxDays * 86400000;
                const userId = user.id;
                const username = (user?.global_name || user?.username || '').trim();
                if (!username) {
                    sendHtml(
                        res,
                        500,
                        'Fehler',
                        `<h1>Discord-Profil unvollständig</h1><p>Username konnte nicht geladen werden. Bitte erneut anmelden.</p><div class="actions"><a class="btn btn-discord" href="${authPath('/discord')}">Erneut anmelden</a></div>`,
                        clearState
                    );
                    return true;
                }
                const avatarUrl = discordAvatarUrl(user, userId);
                const sessionTok = signPayload(sessionSecret, {
                    sub: userId,
                    username,
                    avatarUrl,
                    initials: initialsFromName(username),
                    exp
                });
                const redirectTo = sanitizeOAuthNextPath(
                    typeof stateData.next === 'string' ? stateData.next : '/'
                );
                const front = dashboardFrontendBase();
                const location = front ? `${front}${redirectTo}` : redirectTo;
                res.writeHead(302, {
                    Location: location,
                    'Set-Cookie': [
                        buildCookieHeader(STATE_COOKIE, '', 0, true),
                        buildCookieHeader(SESSION_COOKIE, sessionTok, sessionMaxDays * 86400, true)
                    ]
                });
                res.end();
                return true;
            } catch (e) {
                console.error('OAuth callback:', e);
                sendHtml(
                    res,
                    500,
                    'Fehler',
                    `<h1>Anmeldung fehlgeschlagen</h1><p>Die Anmeldung konnte derzeit nicht abgeschlossen werden. Bitte erneut versuchen.</p><div class="actions"><a class="btn btn-discord" href="${authPath('/discord')}">Erneut anmelden</a></div>`,
                    clearState
                );
                return true;
            }
        }

        if (req.method === 'GET' && url.pathname === '/api/auth/logout') {
            setCookie(res, SESSION_COOKIE, '', 0, true);
            res.writeHead(302, { Location: dashboardLoginHref() });
            res.end();
            return true;
        }

        if (req.method === 'GET' && url.pathname === '/api/auth/me') {
            const s = getSession(req);
            const systemAccess = Boolean(s?.userId && parseSystemAllowedUserIds().has(String(s.userId)));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: Boolean(s), userId: s?.userId ?? null, systemAccess }));
            return true;
        }

        return false;
    }

    function denyUnauthenticated(res, isApi, sendJsonFn) {
        if (!isConfigured()) {
            if (isApi) {
                sendJsonFn(res, 503, { error: 'Dashboard-Auth nicht konfiguriert' });
            } else {
                sendHtml(
                    res,
                    503,
                    'Konfiguration',
                    '<h1>OAuth nicht konfiguriert</h1><p>Siehe Kommentarblock in <code>.env</code>.</p>'
                );
            }
            return;
        }
        if (isApi) {
            sendJsonFn(res, 401, { error: 'Nicht angemeldet', login: absoluteDiscordLoginUrl() });
        } else {
            // Nicht direkt zu Discord springen: Login-Route der SPA.
            res.writeHead(302, { Location: dashboardLoginHref() });
            res.end();
        }
    }

    return {
        isConfigured,
        getSession,
        handleAuthRoutes,
        denyUnauthenticated,
        absoluteLoginUrl: absoluteDiscordLoginUrl
    };
}
