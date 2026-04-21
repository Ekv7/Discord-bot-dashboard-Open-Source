import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as store from './store.js';
import * as memberStats from './memberStats.js';
import { runBotProcessAction } from './botProcessControl.js';
import { createDiscordDashboardAuth } from './discordDashboardAuth.js';
import * as botProfile from './botProfile.js';
import * as warnsStore from './warnsStore.js';
import * as accessRoleStore from './accessRoleStore.js';
import { checkSensitiveRateLimit, sensitiveRateKey, clientIp } from './apiRateLimit.js';
import { createDashboardPresenceHub } from './dashboardPresenceWs.js';
import { dashboardModerationSearch, dashboardModerationAction } from './moderationDashActions.js';
import { fetchGuildMembersPage } from './guildMembersBrowse.js';
import * as customCommandsStore from './customCommandsStore.js';
import * as customCommandsRuntime from './customCommandsRuntime.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const legacyHtml = path.join(publicDir, 'dashboard.html');
const distDir = path.join(rootDir, 'dashboard-ui', 'dist');
const distIndex = path.join(distDir, 'index.html');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.woff2': 'font/woff2'
};

/** Gemeinsame Schutz-Header (kein Geheimnis ersetzen — nur härten). CORP siehe responseSecurityHeaders(). */
const SECURITY_HEADERS_BASE = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin'
};

/** Bei CORS (externes Dashboard) muss CORP cross-origin sein, sonst blockieren Browser die Antwort. */
function responseSecurityHeaders() {
    const h = { ...SECURITY_HEADERS_BASE };
    h['Cross-Origin-Resource-Policy'] =
        dashboardCorsOriginList().length > 0 ? 'cross-origin' : 'same-site';
    return h;
}

/** Öffentliche URLs /api/v1/... → interne Routen /api/... (Bot bleibt intern bei /api). */
function normalizePublicApiPath(pathname) {
    const v1 = '/api/v1';
    if (pathname === v1) return '/api';
    if (pathname.startsWith(`${v1}/`)) return `/api${pathname.slice(v1.length)}`;
    return pathname;
}

const HTML_CSP = [
    "default-src 'self'",
    "script-src 'self'",
    // React (z. B. dynamische Höhen in StatsPage-Balken) setzt style={{…}} am DOM — ohne 'unsafe-inline' meldet die Konsole CSP-Verstöße.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://cdn.discordapp.com https://media.discordapp.net",
    "font-src 'self'",
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
].join('; ');

/** Legacy dashboard.html: Inline-Skripte + Google Fonts */
const HTML_CSP_LEGACY = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://cdn.discordapp.com https://media.discordapp.net",
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
].join('; ');

/** Kommagetrennte Origins (z. B. Vite-Dev). Nur wenn Frontend und API unterschiedliche Origins haben. */
function parseDashboardCorsOrigins() {
    const raw = (process.env.DASHBOARD_CORS_ORIGINS || '').trim();
    if (!raw) return [];
    return raw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

let cachedDashboardCorsList = null;
function dashboardCorsOriginList() {
    if (cachedDashboardCorsList) return cachedDashboardCorsList;
    cachedDashboardCorsList = parseDashboardCorsOrigins();
    return cachedDashboardCorsList;
}

/** @param {import('http').IncomingMessage} req */
function corsHeadersForRequest(req) {
    const origin = req.headers.origin;
    if (!origin || typeof origin !== 'string') return null;
    const allowed = dashboardCorsOriginList();
    if (!allowed.includes(origin)) return null;
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Origin'
    };
}

function sendJson(res, status, obj) {
    const body = JSON.stringify(obj);
    const cors = res.dashCorsHeaders && typeof res.dashCorsHeaders === 'object' ? res.dashCorsHeaders : {};
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        ...responseSecurityHeaders(),
        ...cors
    });
    res.end(body);
}

function sendServerError(res) {
    sendJson(res, 500, { error: 'Interner Serverfehler' });
}

function readBody(req, maxBytes = 1_000_000) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let totalBytes = 0;
        req.on('data', c => chunks.push(c));
        req.on('data', c => {
            totalBytes += c.length;
            if (totalBytes > maxBytes) {
                reject(new Error('BODY_TOO_LARGE'));
                req.destroy();
            }
        });
        req.on('end', () => {
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                resolve(raw ? JSON.parse(raw) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

function useViteDist() {
    return fs.existsSync(distIndex);
}

function serveStaticFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const data = fs.readFileSync(filePath);
    const cors = res.dashCorsHeaders && typeof res.dashCorsHeaders === 'object' ? res.dashCorsHeaders : {};
    const headers = {
        'Content-Type': type,
        'Content-Length': data.length,
        ...responseSecurityHeaders(),
        ...cors
    };
    if (ext === '.html') {
        headers['Content-Security-Policy'] = HTML_CSP;
    }
    res.writeHead(200, headers);
    res.end(data);
}

function resolveDashboardGuildId(getClient) {
    const fromEnv = (process.env.DASHBOARD_GUILD_ID || '').trim();
    if (fromEnv) return fromEnv;
    try {
        const c = getClient?.();
        const n = c?.guilds?.cache?.size ?? 0;
        if (n === 1) return c.guilds.cache.first().id;
        if (n > 1) {
            console.warn(
                'Dashboard OAuth: DASHBOARD_GUILD_ID in .env setzen (Bot ist auf mehreren Servern).'
            );
        }
    } catch (e) {
        console.warn('Dashboard OAuth: Guild-ID konnte nicht ermittelt werden:', e.message);
    }
    return '';
}

/** Guild, auf der Discord-Login + Live-Rollenprüfung laufen (Server 1). Nicht mit Dropdown-Priorität verwechseln. */
function resolveDashboardAuthGuildId(getClient) {
    const authGuild = (process.env.DASHBOARD_AUTH_GUILD_ID || '').trim();
    if (authGuild) return authGuild;
    return resolveDashboardGuildId(getClient);
}

/** @type {Map<string, { ok: boolean, expires: number }>} */
const dashboardRoleVerifyCache = new Map();
/** @type {Map<string, { ok: boolean, expires: number }>} */
const dashboardAdminVerifyCache = new Map();
const ACCESS_CACHE_TTL_MS = 1_500;

function clearAccessCachesForUser(userId) {
    const uid = String(userId || '').trim();
    if (!uid) return;
    for (const key of dashboardRoleVerifyCache.keys()) {
        if (key.startsWith(`${uid}:`)) dashboardRoleVerifyCache.delete(key);
    }
    for (const key of dashboardAdminVerifyCache.keys()) {
        if (key === `system:${uid}` || key.startsWith(`${uid}:`)) dashboardAdminVerifyCache.delete(key);
    }
}

function usedValidDashboardBearer(req, secret) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    return Boolean(secret && token === secret);
}

/**
 * Rollenprüfung pro Guild:
 * - Server-Owner: immer Zugriff (Konfiguration möglich)
 * - sonst: konfigurierte Zugriffsrolle erforderlich (kein Discord-Administrator-Bypass)
 * - ohne Zugriffsrolle (Store/Env/Map): nur Owner
 * @returns {Promise<{ ok: true } | { ok: false, code: 'no_guild' | 'no_role' | 'config' | 'no_session' }>}
 */
async function checkDashboardGuildAccess(req, dashAuth, secret, getClient, guildId) {
    if (usedValidDashboardBearer(req, secret)) return { ok: true };
    if (!dashAuth.isConfigured()) return { ok: true };
    const session = dashAuth.getSession(req);
    if (!session) return { ok: false, code: 'no_session' };
    if (!guildId) return { ok: false, code: 'config' };

    const now = Date.now();
    const roleId = requiredRoleIdForGuild(guildId);
    const roleKey = roleId || 'admin-fallback';
    const cacheKey = `${session.userId}:${guildId}:${roleKey}`;
    const cached = dashboardRoleVerifyCache.get(cacheKey);
    if (cached && cached.expires > now) return cached.ok ? { ok: true } : { ok: false, code: 'no_role' };

    const client = getClient?.();
    const guild = client?.guilds?.cache?.get(guildId);
    if (!guild) return { ok: false, code: 'no_guild' };

    // Projekt-Inhaber (OWNER_ID / Freigabeliste): voller Zugriff auf alle Bot-Guilds ohne eigene Discord-Rolle.
    if (hasSystemAccessUserId(session.userId)) {
        dashboardRoleVerifyCache.set(cacheKey, { ok: true, expires: now + ACCESS_CACHE_TTL_MS });
        return { ok: true };
    }

    let hasAccess = false;
    try {
        let member = guild.members.cache.get(session.userId);
        if (!member) {
            member = await guild.members.fetch({ user: session.userId, force: true }).catch(() => null);
        }
        if (!member) {
            hasAccess = false;
        } else if (member.id === guild.ownerId) {
            hasAccess = true;
        } else if (roleId) {
            hasAccess = Boolean(member.roles?.cache?.has(roleId));
        } else {
            // Kein Rollen-Mapping konfiguriert: nur Server-Owner dürfen rein.
            hasAccess = false;
        }
    } catch (e) {
        console.warn('Dashboard-Rollenprüfung:', e?.message || e);
        hasAccess = false;
    }

    dashboardRoleVerifyCache.set(cacheKey, { ok: hasAccess, expires: now + ACCESS_CACHE_TTL_MS });
    return hasAccess ? { ok: true } : { ok: false, code: 'no_role' };
}

/**
 * Für nicht-guild-spezifische API-Routen: User muss mindestens auf einer Bot-Guild die Access-Rolle haben.
 * @returns {Promise<{ ok: true } | { ok: false, code: 'no_role' | 'config' | 'no_session' }>}
 */
async function checkAnyDashboardGuildAccess(req, dashAuth, secret, getClient) {
    if (usedValidDashboardBearer(req, secret)) return { ok: true };
    if (!dashAuth.isConfigured()) return { ok: true };
    const session = dashAuth.getSession(req);
    if (!session) return { ok: false, code: 'no_session' };
    if (hasSystemAccessUserId(session.userId)) return { ok: true };
    const client = getClient?.();
    const guilds = client?.guilds?.cache ? [...client.guilds.cache.keys()] : [];
    for (const gid of guilds) {
        const check = await checkDashboardGuildAccess(req, dashAuth, secret, getClient, gid);
        if (check.ok) return { ok: true };
    }
    return { ok: false, code: 'no_role' };
}

/**
 * Sensible Dashboard-Aktionen nur für Owner/Freigabeliste.
 * Steuerung über DASHBOARD_OWNER_USER_ID + DASHBOARD_SYSTEM_ALLOW_USER_IDS.
 */
async function checkDashboardAdminAccess(req, dashAuth, secret, getClient) {
    if (usedValidDashboardBearer(req, secret)) return { ok: true };
    if (!dashAuth.isConfigured()) return { ok: true };
    const session = dashAuth.getSession(req);
    if (!session) return { ok: false, code: 'no_session' };
    const cacheKey = `system:${session.userId}`;
    const now = Date.now();
    const cached = dashboardAdminVerifyCache.get(cacheKey);
    if (cached && cached.expires > now) return cached.ok ? { ok: true } : { ok: false, code: 'forbidden' };
    const ok = hasSystemAccessUserId(session.userId);
    dashboardAdminVerifyCache.set(cacheKey, { ok, expires: now + ACCESS_CACHE_TTL_MS });
    return ok ? { ok: true } : { ok: false, code: 'forbidden' };
}

function createAuth(getClient) {
    const clientId = (process.env.DISCORD_CLIENT_ID || '').trim();
    const clientSecret = (process.env.DISCORD_CLIENT_SECRET || '').trim();
    const redirectUri = (process.env.DASHBOARD_OAUTH_REDIRECT_URI || '').trim();
    const sessionSecret = (process.env.DASHBOARD_SESSION_SECRET || '').trim();
    const authGuildId = resolveDashboardAuthGuildId(getClient);
    const accessRoleId = requiredRoleIdForGuild(authGuildId);
    return createDiscordDashboardAuth({
        clientId,
        clientSecret,
        redirectUri,
        guildId: authGuildId,
        accessRoleId,
        sessionSecret
    });
}

function requireBearerOrSession(req, dashAuth, secret) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const secretTrim = secret != null ? String(secret).trim() : '';
    const bearerOk = Boolean(secretTrim && token === secretTrim);
    if (dashAuth.isConfigured()) {
        return Boolean(dashAuth.getSession(req)) || bearerOk;
    }
    if (secretTrim) return bearerOk;
    return false;
}

/** OAuth-Login + öffentliche Hilfs-APIs ohne Session/Bearer */
function isPublicApiPath(pathname) {
    if (pathname.startsWith('/api/auth/')) return true;
    if (pathname === '/api/invite-link') return true;
    return false;
}

function parsePriorityGuildIds() {
    const raw = (process.env.DASHBOARD_GUILD_PRIORITY_IDS || '').trim();
    if (!raw) return [];
    return raw
        .split(',')
        .map(s => s.trim())
        .filter(id => /^\d{17,22}$/.test(id));
}

function parseAccessRoleMap() {
    const raw = String(process.env.DASHBOARD_ACCESS_ROLE_IDS_BY_GUILD || '').trim();
    const map = new Map();
    if (!raw) return map;
    for (const pair of raw.split(',')) {
        const [guildId, roleId] = pair.split(':').map(s => String(s || '').trim());
        if (/^\d{17,22}$/.test(guildId) && /^\d{17,22}$/.test(roleId)) {
            map.set(guildId, roleId);
        }
    }
    return map;
}

function requiredRoleIdForGuild(guildId) {
    const fromStore = accessRoleStore.getRoleIdForGuild(guildId);
    if (fromStore) return fromStore;
    const map = parseAccessRoleMap();
    const mapped = map.get(String(guildId || ''));
    if (mapped) return mapped;
    return (process.env.DASHBOARD_ACCESS_ROLE_ID || '').trim();
}

async function canManageGuildAccessConfig(req, dashAuth, guild) {
    const session = dashAuth.getSession(req);
    if (!session?.userId) return false;
    let member = guild.members.cache.get(session.userId);
    if (!member) member = await guild.members.fetch({ user: session.userId, force: true }).catch(() => null);
    if (!member) return false;
    return member.id === guild.ownerId;
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

function hasSystemAccessUserId(userId) {
    if (!/^\d{17,22}$/.test(String(userId || ''))) return false;
    return parseSystemAllowedUserIds().has(String(userId));
}

function requestedGuildId(url, client) {
    const raw = (url.searchParams.get('guildId') || '').trim();
    if (!/^\d{17,22}$/.test(raw)) return '';
    void client;
    return raw;
}

function botIsOnGuild(client, guildId) {
    return Boolean(client?.guilds?.cache?.has(String(guildId || '')));
}

async function enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, guildId) {
    const client = getClient?.();
    if (client && botIsOnGuild(client, guildId)) {
        const access = await checkDashboardGuildAccess(req, dashAuth, secret, getClient, guildId);
        if (access.ok) return true;
        const msgByCode = {
            no_role: 'Kein Zugriff auf diesen Server - Zugriffsrolle fehlt (oder ohne Rollen-Mapping nur Owner).',
            no_guild: 'Server ist nicht verfügbar.',
            config: 'Dashboard-Zugriff ist unvollständig konfiguriert.',
            no_session: 'Nicht angemeldet.'
        };
        sendJson(res, 403, { error: msgByCode[access.code] || 'Zugriff verweigert.', code: access.code });
        return false;
    }
    if (usedValidDashboardBearer(req, secret)) return true;
    const session = dashAuth.getSession(req);
    if (!session?.userId) {
        sendJson(res, 403, { error: 'Nicht angemeldet.', code: 'no_session' });
        return false;
    }
    if (!hasSystemAccessUserId(session.userId)) {
        sendJson(res, 403, {
            error: 'Bot ist nicht mehr auf diesem Server — Nur der Bot-Owner (OWNER_ID) kann die gespeicherten Daten einsehen.',
            code: 'bot_left'
        });
        return false;
    }
    return true;
}

const SIMULATE_TYPES = new Set([
    'cmd',
    'join',
    'leave',
    'message',
    'dashboard',
    'mod_kick',
    'mod_ban',
    'mod_warn'
]);

function isSystemOnlyRoute(method, pathname) {
    if (method === 'POST' && pathname === '/api/bot/control') return true;
    if (method === 'GET' && pathname === '/api/bot/profile') return true;
    if (method === 'PATCH' && pathname === '/api/bot/profile') return true;
    if (method === 'POST' && pathname === '/api/simulate') return true;
    if (method === 'POST' && pathname === '/api/system/maintenance') return true;
    if (method === 'GET' && pathname === '/api/stream') return true;
    return false;
}

function validateSimulateBody(body, client) {
    if (!client) return { ok: false, error: 'Bot nicht bereit.' };
    const guildId = typeof body?.guildId === 'string' ? body.guildId.trim() : '';
    if (!/^\d{17,22}$/.test(guildId) || !client.guilds.cache.has(guildId)) {
        return { ok: false, error: 'guildId ungültig.' };
    }
    const t = typeof body?.type === 'string' ? body.type.trim() : 'cmd';
    const type = SIMULATE_TYPES.has(t) ? t : 'cmd';
    const user = typeof body?.user === 'string' ? body.user.trim().slice(0, 80) : 'Test';
    const msg = typeof body?.msg === 'string' ? body.msg.trim().slice(0, 4000) : '(Simuliert)';
    const channel = typeof body?.channel === 'string' ? body.channel.trim().slice(0, 100) : '#test';
    return {
        ok: true,
        payload: { type, user, guildId, msg, channel }
    };
}

export function startDashboardServer({
    getClient,
    port,
    host = '127.0.0.1',
    secret,
    reservedSlashNames = [],
    onCustomCommandsChanged
}) {
    const dashAuth = createAuth(getClient);
    const secretTrim = secret != null ? String(secret).trim() : '';
    if (!dashAuth.isConfigured() && !secretTrim) {
        console.error(
            'Dashboard ist nicht abgesichert — bitte DASHBOARD_SECRET oder vollständiges OAuth in .env setzen (siehe Kommentarblock in .env).'
        );
        process.exit(1);
    }
    const presenceHub = createDashboardPresenceHub({ getClientIp: clientIp });
    const reservedSlashSet = new Set(
        (Array.isArray(reservedSlashNames) ? reservedSlashNames : []).map(n => String(n).toLowerCase())
    );

    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        url.pathname = normalizePublicApiPath(url.pathname);
        res.dashCorsHeaders = corsHeadersForRequest(req);

        try {
            const ip = clientIp(req);
            const isApi = url.pathname.startsWith('/api/');
            if (isApi) {
                const rlApi = checkSensitiveRateLimit(`api:${ip}`, { limit: 240, windowMs: 60_000 });
                if (!rlApi.ok) {
                    sendJson(res, 429, {
                        error: 'Zu viele Anfragen. Bitte kurz warten.',
                        retryAfter: rlApi.retryAfterSec
                    });
                    return;
                }
            }
            if (url.pathname.startsWith('/api/auth/')) {
                const rlAuth = checkSensitiveRateLimit(`auth:${ip}`, { limit: 35, windowMs: 60_000 });
                if (!rlAuth.ok) {
                    sendJson(res, 429, {
                        error: 'Zu viele Login-Anfragen. Bitte kurz warten.',
                        retryAfter: rlAuth.retryAfterSec
                    });
                    return;
                }
            }

            if (req.method === 'OPTIONS' && (url.pathname.startsWith('/api/') || url.pathname === '/api')) {
                const optCors = corsHeadersForRequest(req);
                if (optCors) {
                    const reqHdr = req.headers['access-control-request-headers'];
                    res.writeHead(204, {
                        ...optCors,
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers':
                            typeof reqHdr === 'string' && reqHdr.trim()
                                ? reqHdr
                                : 'Content-Type, Authorization',
                        'Access-Control-Max-Age': '86400',
                        ...responseSecurityHeaders()
                    });
                } else {
                    res.writeHead(204, { ...responseSecurityHeaders() });
                }
                res.end();
                return;
            }

            if (await dashAuth.handleAuthRoutes(req, res, url)) return;

            if (req.method === 'GET' && url.pathname === '/api/auth/config') {
                sendJson(res, 200, { oauthConfigured: dashAuth.isConfigured() });
                return;
            }
            if (req.method === 'GET' && url.pathname === '/api/invite-link') {
                const clientId = (process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID || '')
                    .trim()
                    .replace(/^['"]|['"]$/g, '');
                if (!/^\d{17,22}$/.test(clientId)) {
                    sendJson(res, 503, { error: 'CLIENT_ID / DISCORD_CLIENT_ID fehlt oder ungültig.' });
                    return;
                }
                const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(
                    clientId
                )}&permissions=8&scope=bot%20applications.commands`;
                sendJson(res, 200, { url: inviteUrl });
                return;
            }
            if (isApi && !isPublicApiPath(url.pathname)) {
                if (!requireBearerOrSession(req, dashAuth, secret)) {
                    sendJson(res, 401, {
                        error: 'Nicht autorisiert.',
                        login: dashAuth.isConfigured() ? dashAuth.absoluteLoginUrl() : undefined
                    });
                    return;
                }
                const access = await checkAnyDashboardGuildAccess(req, dashAuth, secret, getClient);
                if (!access.ok) {
                    const hints = {
                        no_role:
                            'Kein Zugriff - dir fehlt die Dashboard-Zugriffsrolle (Discord-Admin zählt nicht). Ohne gesetzte Rolle nur der Server-Owner.',
                        config: 'Dashboard-Zugriff ist unvollständig konfiguriert.',
                        no_session: 'Nicht angemeldet.'
                    };
                    sendJson(res, 403, {
                        error: hints[access.code] || 'Zugriff verweigert.',
                        code: access.code,
                        login: dashAuth.absoluteLoginUrl()
                    });
                    return;
                }
            }
            if (req.method === 'POST' && url.pathname === '/api/access/refresh') {
                const session = dashAuth.getSession(req);
                if (!session?.userId) {
                    sendJson(res, 401, { error: 'Nicht angemeldet.' });
                    return;
                }
                clearAccessCachesForUser(session.userId);
                sendJson(res, 200, { ok: true });
                return;
            }

            if (req.method === 'GET' && url.pathname === '/api/custom-commands') {
                try {
                    const client = getClient();
                    if (!client) {
                        sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                        return;
                    }
                    const guildId = requestedGuildId(url, client);
                    if (!guildId) {
                        sendJson(res, 400, { error: 'guildId fehlt oder ungültig.' });
                        return;
                    }
                    if (!(await enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, guildId))) return;
                    sendJson(res, 200, { flows: customCommandsStore.listFlowDocumentsForGuild(guildId) });
                } catch (e) {
                    console.error('api/custom-commands GET:', e);
                    sendServerError(res);
                }
                return;
            }

            if (req.method === 'POST' && url.pathname === '/api/custom-commands/save') {
                let body;
                try {
                    body = await readBody(req, 520_000);
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        sendJson(res, 400, { error: 'Ungültiges JSON.' });
                        return;
                    }
                    throw e;
                }
                const v = customCommandsRuntime.validateFlowForSave(body, reservedSlashSet);
                if (!v.ok) {
                    sendJson(res, 400, { error: v.error });
                    return;
                }
                const client = getClient();
                if (!client) {
                    sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                    return;
                }
                if (!client.guilds.cache.has(v.guildId)) {
                    sendJson(res, 400, { error: 'Server nicht gefunden (Bot nicht auf dieser Guild).' });
                    return;
                }
                if (!(await enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, v.guildId))) return;
                try {
                    const saved = customCommandsStore.saveFlowForGuild(v.guildId, body);
                    const prevRaw = typeof body?.previousName === 'string' ? body.previousName : '';
                    const prev = customCommandsStore.safeCommandName(prevRaw);
                    if (prev && prev !== saved.name) {
                        customCommandsStore.deleteFlowForGuild(v.guildId, prev);
                    }
                    // Slash-Sync bei Discord kann pro Guild dauern — nicht auf die Antwort warten (UI hing sonst auf „Speichern…“).
                    void Promise.resolve(onCustomCommandsChanged?.()).catch(err => {
                        console.error('Custom-Commands nach Speichern (Hintergrund):', err?.message || err);
                    });
                    sendJson(res, 200, { ok: true, flow: saved });
                } catch (err) {
                    sendJson(res, 400, { error: String(err?.message || err) });
                }
                return;
            }

            if (req.method === 'DELETE') {
                const mGuild = url.pathname.match(/^\/api\/custom-commands\/(\d{17,22})\/([^/]+)\/?$/);
                if (mGuild) {
                    const guildId = mGuild[1];
                    const cmdRaw = decodeURIComponent(mGuild[2]);
                    const client = getClient();
                    if (!client) {
                        sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                        return;
                    }
                    if (!client.guilds.cache.has(guildId)) {
                        sendJson(res, 400, { error: 'Server nicht gefunden.' });
                        return;
                    }
                    if (!(await enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, guildId))) return;
                    const deleted = customCommandsStore.deleteFlowForGuild(guildId, cmdRaw);
                    if (!deleted) {
                        sendJson(res, 404, { error: 'Nicht gefunden.' });
                        return;
                    }
                    void Promise.resolve(onCustomCommandsChanged?.()).catch(err => {
                        console.error('Custom-Commands nach Loeschen (Hintergrund):', err?.message || err);
                    });
                    sendJson(res, 200, { ok: true });
                    return;
                }
            }

            if (isSystemOnlyRoute(req.method || 'GET', url.pathname)) {
                const admin = await checkDashboardAdminAccess(req, dashAuth, secret, getClient);
                if (!admin.ok) {
                    sendJson(res, 403, {
                        error: 'System-Zugriff erforderlich (Owner/Freigabeliste).',
                        code: admin.code
                    });
                    return;
                }
            }

            if (req.method === 'GET' && url.pathname === '/api/warnings') {
                try {
                    const client = getClient();
                    if (!client) {
                        sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                        return;
                    }
                    const guildId = requestedGuildId(url, client);
                    if (!guildId) {
                        sendJson(res, 400, { error: 'guildId fehlt oder ungültig.' });
                        return;
                    }
                    if (!(await enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, guildId))) return;
                    sendJson(res, 200, { warnings: warnsStore.listWarns(400, guildId) });
                } catch (e) {
                    console.error('api/warnings:', e);
                    sendServerError(res);
                }
                return;
            }

            if (req.method === 'GET' && url.pathname === '/api/member-stats') {
                try {
                    const client = getClient();
                    if (!client) {
                        sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                        return;
                    }
                    const guildId = requestedGuildId(url, client);
                    if (!guildId) {
                        sendJson(res, 400, { error: 'guildId fehlt oder ungültig.' });
                        return;
                    }
                    if (!(await enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, guildId))) return;
                    const summary = memberStats.getMemberStatsSummary(guildId);
                    const series30 = memberStats.getDailySeries(30, guildId);
                    sendJson(res, 200, { summary, series30 });
                } catch (e) {
                    console.error('api/member-stats:', e);
                    sendServerError(res);
                }
                return;
            }

            if (req.method === 'GET' && url.pathname === '/api/system/maintenance') {
                sendJson(res, 200, store.getMaintenanceNotice());
                return;
            }

            if (req.method === 'GET' && url.pathname === '/api/guilds') {
                const client = getClient();
                if (!client) {
                    sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                    return;
                }
                const sessionUserId = String(dashAuth.getSession(req)?.userId || '').trim();
                const priorityGuildIds = [
                    ...parsePriorityGuildIds(),
                    (process.env.DASHBOARD_GUILD_ID || '').trim()
                ].filter(Boolean);
                let guilds = [...client.guilds.cache.values()]
                    .map(g => ({
                        id: g.id,
                        name: g.name,
                        members: g.memberCount ?? null,
                        isOwner: Boolean(sessionUserId && g.ownerId === sessionUserId)
                    }))
                    .sort((a, b) => {
                        const ai = priorityGuildIds.indexOf(a.id);
                        const bi = priorityGuildIds.indexOf(b.id);
                        if (ai !== -1 || bi !== -1) {
                            if (ai === -1) return 1;
                            if (bi === -1) return -1;
                            if (ai !== bi) return ai - bi;
                        }
                        return a.name.localeCompare(b.name, 'de');
                    });
                if (dashAuth.isConfigured() && !usedValidDashboardBearer(req, secret)) {
                    const filtered = [];
                    for (const g of guilds) {
                        const access = await checkDashboardGuildAccess(req, dashAuth, secret, getClient, g.id);
                        if (access.ok) filtered.push({ ...g, botPresent: true });
                    }
                    guilds = filtered;
                } else {
                    guilds = guilds.map(g => ({ ...g, botPresent: true }));
                }
                // Keine „verwaisten“ Guilds aus data/ in die Auswahl: Projekt/System-Owner soll nicht
                // Dutzende alte IDs + „Bot nicht auf Server“ neben echten Bot-Servern sehen.
                sendJson(res, 200, { guilds });
                return;
            }

            if (req.method === 'GET' && url.pathname === '/api/guild-roles') {
                const client = getClient();
                if (!client) {
                    sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                    return;
                }
                const guildId = requestedGuildId(url, client);
                if (!guildId) {
                    sendJson(res, 400, { error: 'guildId fehlt oder ungültig.' });
                    return;
                }
                if (!(await enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, guildId))) return;
                const guild = client.guilds.cache.get(guildId);
                if (!guild) {
                    sendJson(res, 200, { roles: [], botPresent: false });
                    return;
                }
                const roles = [...guild.roles.cache.values()]
                    .filter(r => r.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(r => ({
                        id: r.id,
                        name: r.name,
                        color: r.hexColor && r.hexColor !== '#000000' ? r.hexColor : null
                    }));
                sendJson(res, 200, { roles });
                return;
            }

            if (req.method === 'GET' && url.pathname === '/api/access-role') {
                const client = getClient();
                if (!client) {
                    sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                    return;
                }
                const guildId = requestedGuildId(url, client);
                if (!guildId) {
                    sendJson(res, 400, { error: 'guildId fehlt oder ungültig.' });
                    return;
                }
                const guild = client.guilds.cache.get(guildId);
                if (!guild) {
                    sendJson(res, 404, { error: 'Server nicht gefunden.' });
                    return;
                }
                if (!(await enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, guildId))) return;
                const canManage = await canManageGuildAccessConfig(req, dashAuth, guild);
                if (!canManage) {
                    sendJson(res, 403, { error: 'Nur der Server-Owner kann die Dashboard-Rolle ändern.' });
                    return;
                }
                sendJson(res, 200, { roleId: requiredRoleIdForGuild(guildId) || null });
                return;
            }

            if (req.method === 'GET' && url.pathname === '/api/access-role/members') {
                const client = getClient();
                if (!client) {
                    sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                    return;
                }
                const guildId = requestedGuildId(url, client);
                if (!guildId) {
                    sendJson(res, 400, { error: 'guildId fehlt oder ungültig.' });
                    return;
                }
                const guild = client.guilds.cache.get(guildId);
                if (!guild) {
                    sendJson(res, 404, { error: 'Server nicht gefunden.' });
                    return;
                }
                if (!(await enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, guildId))) return;
                const canManage = await canManageGuildAccessConfig(req, dashAuth, guild);
                if (!canManage) {
                    sendJson(res, 403, { error: 'Nur der Server-Owner kann die Dashboard-Rolle ändern.' });
                    return;
                }
                const roleId = requiredRoleIdForGuild(guildId);
                if (!roleId) {
                    sendJson(res, 200, { roleId: null, members: [], mode: 'owner_only' });
                    return;
                }
                const role = guild.roles.cache.get(roleId);
                if (!role) {
                    sendJson(res, 200, { roleId, members: [], mode: 'role' });
                    return;
                }
                try {
                    await guild.members.fetch().catch(() => null);
                } catch {
                    // ignore, we still return cached members
                }
                const members = [...role.members.values()]
                    .map(m => ({
                        id: m.id,
                        username: m.user?.tag || m.displayName || m.id,
                        displayName: m.displayName || m.user?.username || m.id
                    }))
                    .sort((a, b) => a.username.localeCompare(b.username, 'de'))
                    .slice(0, 300);
                sendJson(res, 200, { roleId, members, mode: 'role' });
                return;
            }

            if (req.method === 'POST' && url.pathname === '/api/access-role') {
                const client = getClient();
                if (!client) {
                    sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                    return;
                }
                let body;
                try {
                    body = await readBody(req, 8000);
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        sendJson(res, 400, { error: 'Ungültiges JSON.' });
                        return;
                    }
                    throw e;
                }
                const guildId = typeof body?.guildId === 'string' ? body.guildId.trim() : '';
                if (!/^\d{17,22}$/.test(guildId) || !client.guilds.cache.has(guildId)) {
                    sendJson(res, 400, { error: 'guildId fehlt oder ungültig.' });
                    return;
                }
                const guild = client.guilds.cache.get(guildId);
                if (!(await enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, guildId))) return;
                const canManage = await canManageGuildAccessConfig(req, dashAuth, guild);
                if (!canManage) {
                    sendJson(res, 403, { error: 'Nur der Server-Owner kann die Dashboard-Rolle ändern.' });
                    return;
                }
                const roleIdRaw = typeof body?.roleId === 'string' ? body.roleId.trim() : '';
                if (!roleIdRaw || !/^\d{17,22}$/.test(roleIdRaw)) {
                    sendJson(res, 400, {
                        error: 'Bitte eine gültige Zugriffsrolle auswählen. (Leer speichern ist nicht erlaubt.)'
                    });
                    return;
                }
                if (!guild.roles.cache.has(roleIdRaw)) {
                    sendJson(res, 400, { error: 'Rolle existiert auf diesem Server nicht.' });
                    return;
                }
                accessRoleStore.setRoleIdForGuild(guildId, roleIdRaw);
                sendJson(res, 200, { ok: true, roleId: roleIdRaw, mode: 'role' });
                return;
            }

            if (req.method === 'GET' && url.pathname === '/api/guild-members') {
                try {
                    const client = getClient();
                    if (!client) {
                        sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                        return;
                    }
                    const guildId = requestedGuildId(url, client);
                    if (!guildId) {
                        sendJson(res, 400, { error: 'guildId fehlt oder ungültig.' });
                        return;
                    }
                    if (!(await enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, guildId))) return;
                    const rkMem = sensitiveRateKey(req, r => dashAuth.getSession(r));
                    const rlMem = checkSensitiveRateLimit(`memlist:${rkMem}`, { limit: 40, windowMs: 60_000 });
                    if (!rlMem.ok) {
                        sendJson(res, 429, {
                            error: 'Zu viele Mitglieder-Anfragen.',
                            retryAfter: rlMem.retryAfterSec
                        });
                        return;
                    }
                    const q = (url.searchParams.get('q') || '').trim();
                    const after = (url.searchParams.get('after') || '').trim();
                    const pageRaw = url.searchParams.get('page');
                    const page = pageRaw != null && pageRaw !== '' ? Number(pageRaw) : 0;
                    const limitRaw = url.searchParams.get('limit');
                    const limit = limitRaw ? Number(limitRaw) : 40;
                    const out = await fetchGuildMembersPage(client, guildId, {
                        query: q,
                        after,
                        limit,
                        page: Number.isFinite(page) ? page : 0
                    });
                    if (!out.ok) {
                        sendJson(res, out.status, { error: out.error });
                        return;
                    }
                    sendJson(res, 200, {
                        members: out.members,
                        nextAfter: out.nextAfter ?? null,
                        hasMore: out.hasMore,
                        searchMode: out.searchMode,
                        page: out.page,
                        totalMembers: out.totalMembers,
                        listMode: out.listMode,
                        listModeHint: out.listModeHint ?? null
                    });
                } catch (e) {
                    console.error('api/guild-members:', e);
                    sendServerError(res);
                }
                return;
            }

            if (req.method === 'GET' && url.pathname === '/api/moderation/member') {
                try {
                    const client = getClient();
                    if (!client) {
                        sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                        return;
                    }
                    const guildId = requestedGuildId(url, client);
                    if (!guildId) {
                        sendJson(res, 400, { error: 'guildId fehlt oder ungültig.' });
                        return;
                    }
                    if (!(await enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, guildId))) return;
                    const qRaw = url.searchParams.get('q') || '';
                    const q = qRaw.length > 120 ? qRaw.slice(0, 120) : qRaw;
                    const session = dashAuth.getSession(req);
                    const out = await dashboardModerationSearch(client, guildId, q, session);
                    if (!out.ok) {
                        sendJson(res, out.status, { error: out.error });
                        return;
                    }
                    sendJson(res, 200, { results: out.results });
                } catch (e) {
                    console.error('api/moderation/member:', e);
                    sendServerError(res);
                }
                return;
            }

            if (req.method === 'POST' && url.pathname === '/api/moderation') {
                const rkMod = sensitiveRateKey(req, r => dashAuth.getSession(r));
                const rlMod = checkSensitiveRateLimit(`moddash:${rkMod}`, { limit: 24, windowMs: 60_000 });
                if (!rlMod.ok) {
                    sendJson(res, 429, {
                        error: 'Zu viele Moderations-Anfragen.',
                        retryAfter: rlMod.retryAfterSec
                    });
                    return;
                }
                try {
                    const client = getClient();
                    if (!client) {
                        sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                        return;
                    }
                    let body;
                    try {
                        body = await readBody(req, 12_000);
                    } catch (e) {
                        if (e instanceof SyntaxError) {
                            sendJson(res, 400, { error: 'Ungültiges JSON.' });
                            return;
                        }
                        throw e;
                    }
                    const session = dashAuth.getSession(req);
                    const guildId = typeof body?.guildId === 'string' ? body.guildId.trim() : '';
                    if (!/^\d{17,22}$/.test(guildId) || !client.guilds.cache.has(guildId)) {
                        sendJson(res, 400, { error: 'guildId fehlt oder ungültig.' });
                        return;
                    }
                    if (!(await enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, guildId))) return;
                    const out = await dashboardModerationAction(client, body, session);
                    if (!out.ok) {
                        sendJson(res, out.status, { error: out.error });
                        return;
                    }
                    sendJson(res, 200, { ok: true, message: out.message });
                } catch (e) {
                    console.error('api/moderation:', e);
                    sendServerError(res);
                }
                return;
            }

            if (req.method === 'GET' && url.pathname === '/api/snapshot') {
                const client = getClient();
                if (!client) {
                    sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                    return;
                }
                const guildId = requestedGuildId(url, client);
                if (!guildId) {
                    sendJson(res, 400, { error: 'guildId fehlt oder ungültig.' });
                    return;
                }
                if (!(await enforceGuildAccessOrDeny(req, res, dashAuth, secret, getClient, guildId))) return;
                sendJson(res, 200, store.getSnapshot(client, guildId));
                return;
            }

            if (req.method === 'GET' && url.pathname === '/api/stream') {
                const rkSse = sensitiveRateKey(req, r => dashAuth.getSession(r));
                const rlSse = checkSensitiveRateLimit(`sse:${rkSse}`, { limit: 30, windowMs: 60_000 });
                if (!rlSse.ok) {
                    sendJson(res, 429, {
                        error: 'Zu viele Stream-Verbindungen.',
                        retryAfter: rlSse.retryAfterSec
                    });
                    return;
                }
                if (!store.addSseClient(res)) {
                    sendJson(res, 429, {
                        error: 'Zu viele gleichzeitige Stream-Verbindungen.',
                        openConnections: store.getSseClientCount()
                    });
                    return;
                }
                const sseCors = res.dashCorsHeaders && typeof res.dashCorsHeaders === 'object' ? res.dashCorsHeaders : {};
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                    ...responseSecurityHeaders(),
                    ...sseCors
                });
                res.write('\n');
                req.on('close', () => store.removeSseClient(res));
                return;
            }

            if (req.method === 'GET' && url.pathname === '/api/maintenance-stream') {
                const rkMaint = sensitiveRateKey(req, r => dashAuth.getSession(r));
                const rlMaint = checkSensitiveRateLimit(`maint-sse:${rkMaint}`, { limit: 30, windowMs: 60_000 });
                if (!rlMaint.ok) {
                    sendJson(res, 429, {
                        error: 'Zu viele Wartungs-Stream-Verbindungen.',
                        retryAfter: rlMaint.retryAfterSec
                    });
                    return;
                }
                if (!store.addMaintenanceSseClient(res)) {
                    sendJson(res, 429, {
                        error: 'Zu viele gleichzeitige Wartungs-Streams.',
                        openConnections: store.getMaintenanceSseClientCount()
                    });
                    return;
                }
                const msCors = res.dashCorsHeaders && typeof res.dashCorsHeaders === 'object' ? res.dashCorsHeaders : {};
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                    ...responseSecurityHeaders(),
                    ...msCors
                });
                res.write('\n');
                res.write(`event: maintenance\ndata: ${JSON.stringify(store.getMaintenanceNotice())}\n\n`);
                req.on('close', () => store.removeMaintenanceSseClient(res));
                return;
            }

            if (req.method === 'POST' && url.pathname === '/api/bot/control') {
                const rkCtl = sensitiveRateKey(req, r => dashAuth.getSession(r));
                const rlCtl = checkSensitiveRateLimit(`botctl:${rkCtl}`, { limit: 8, windowMs: 300_000 });
                if (!rlCtl.ok) {
                    sendJson(res, 429, {
                        error: 'Zu viele Steuerungs-Anfragen.',
                        retryAfter: rlCtl.retryAfterSec
                    });
                    return;
                }
                let body;
                try {
                    body = await readBody(req, 20_000);
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        sendJson(res, 400, { error: 'Ungültiges JSON.' });
                        return;
                    }
                    throw e;
                }
                const action = body.action;
                if (action !== 'stop' && action !== 'restart') {
                    sendJson(res, 400, { error: 'action muss "stop" oder "restart" sein' });
                    return;
                }
                sendJson(res, 200, { ok: true, action });
                setImmediate(() => {
                    runBotProcessAction(getClient(), action).catch(err => {
                        console.error('bot/control:', err);
                        process.exit(1);
                    });
                });
                return;
            }

            if (req.method === 'GET' && url.pathname === '/api/bot/profile') {
                const client = getClient();
                if (!client?.user) {
                    sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                    return;
                }
                try {
                    const profile = await botProfile.fetchBotProfile(client);
                    sendJson(res, 200, profile);
                } catch (e) {
                    console.error('api/bot/profile GET:', e);
                    sendServerError(res);
                }
                return;
            }

            if (req.method === 'PATCH' && url.pathname === '/api/bot/profile') {
                const rkProf = sensitiveRateKey(req, r => dashAuth.getSession(r));
                const rlProf = checkSensitiveRateLimit(`prof:${rkProf}`, { limit: 24, windowMs: 60_000 });
                if (!rlProf.ok) {
                    sendJson(res, 429, {
                        error: 'Zu viele Profil-Updates. Kurz warten.',
                        retryAfter: rlProf.retryAfterSec
                    });
                    return;
                }
                const cl = req.headers['content-length'];
                if (cl && Number(cl) > botProfile.MAX_BODY_BYTES) {
                    sendJson(res, 413, { error: 'Upload zu gross (max. ca. 3,5 MB)' });
                    return;
                }
                const client = getClient();
                if (!client?.user) {
                    sendJson(res, 503, { error: 'Bot noch nicht bereit' });
                    return;
                }
                let body;
                try {
                    body = await readBody(req, botProfile.MAX_BODY_BYTES);
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        sendJson(res, 400, { error: 'Ungültiges JSON.' });
                        return;
                    }
                    throw e;
                }
                try {
                    const updated = await botProfile.patchBotProfile(client, body);
                    sendJson(res, 200, updated);
                } catch (e) {
                    const msg = String(e?.message || '');
                    const rate =
                        msg.includes('rate') || msg.includes('429') || msg.includes('limit');
                    if (rate) {
                        sendJson(res, 429, { error: 'Zu viele Profil-Updates. Kurz warten.' });
                    } else {
                        console.error('api/bot/profile PATCH:', e);
                        sendJson(res, 400, { error: 'Profil konnte nicht aktualisiert werden.' });
                    }
                }
                return;
            }

            if (req.method === 'POST' && url.pathname === '/api/simulate') {
                const rkSim = sensitiveRateKey(req, r => dashAuth.getSession(r));
                const rlSim = checkSensitiveRateLimit(`sim:${rkSim}`, { limit: 45, windowMs: 60_000 });
                if (!rlSim.ok) {
                    sendJson(res, 429, {
                        error: 'Zu viele Simulations-Anfragen.',
                        retryAfter: rlSim.retryAfterSec
                    });
                    return;
                }
                let body;
                try {
                    body = await readBody(req, 50_000);
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        sendJson(res, 400, { error: 'Ungültiges JSON.' });
                        return;
                    }
                    throw e;
                }
                const client = getClient();
                const sim = validateSimulateBody(body, client);
                if (!sim.ok) {
                    sendJson(res, 400, { error: sim.error });
                    return;
                }
                store.addSimulatedLog(sim.payload);
                sendJson(res, 200, { ok: true });
                return;
            }

            if (req.method === 'POST' && url.pathname === '/api/system/maintenance') {
                let body;
                try {
                    body = await readBody(req, 8_000);
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        sendJson(res, 400, { error: 'Ungültiges JSON.' });
                        return;
                    }
                    throw e;
                }
                const enabled = Boolean(body?.enabled);
                const text =
                    typeof body?.text === 'string' ? body.text.trim().slice(0, 240) : '';
                const session = dashAuth.getSession(req);
                const updated = store.setMaintenanceNotice({
                    enabled,
                    text,
                    updatedBy: session?.userId ?? null
                });
                sendJson(res, 200, { ok: true, maintenance: updated });
                return;
            }

            if (req.method === 'GET') {
                if (useViteDist()) {
                    let safeRel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
                    safeRel = path.normalize(safeRel).replace(/^(\.\.[\\/])+/, '');
                    if (safeRel.startsWith('..') || path.isAbsolute(safeRel)) {
                        const c = res.dashCorsHeaders && typeof res.dashCorsHeaders === 'object' ? res.dashCorsHeaders : {};
                        res.writeHead(403, { ...responseSecurityHeaders(), ...c });
                        res.end();
                        return;
                    }
                    if (safeRel.endsWith('.map')) {
                        const c = res.dashCorsHeaders && typeof res.dashCorsHeaders === 'object' ? res.dashCorsHeaders : {};
                        res.writeHead(403, { ...responseSecurityHeaders(), ...c });
                        res.end();
                        return;
                    }
                    const filePath = path.join(distDir, safeRel);
                    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                        serveStaticFile(res, filePath);
                        return;
                    }
                    if (!path.extname(safeRel)) {
                        serveStaticFile(res, distIndex);
                        return;
                    }
                } else {
                    const html = fs.readFileSync(legacyHtml, 'utf8');
                    const legCors = res.dashCorsHeaders && typeof res.dashCorsHeaders === 'object' ? res.dashCorsHeaders : {};
                    res.writeHead(200, {
                        'Content-Type': 'text/html; charset=utf-8',
                        ...responseSecurityHeaders(),
                        'Content-Security-Policy': HTML_CSP_LEGACY,
                        ...legCors
                    });
                    res.end(html);
                    return;
                }
            }

            const n404 = res.dashCorsHeaders && typeof res.dashCorsHeaders === 'object' ? res.dashCorsHeaders : {};
            res.writeHead(404, { ...responseSecurityHeaders(), ...n404 });
            res.end();
        } catch (e) {
            if (e instanceof Error && e.message === 'BODY_TOO_LARGE') {
                sendJson(res, 413, { error: 'Anfrage zu gross' });
                return;
            }
            console.error('Dashboard HTTP error:', e);
            sendServerError(res);
        }
    });

    server.listen(port, host, () => {
        if (String(process.env.BOT_VERBOSE_STARTUP || '').toLowerCase() === 'true') {
            const mode = useViteDist() ? 'React/shadcn (dist)' : 'Legacy public/dashboard.html';
            let oauth = '';
            if (dashAuth.isConfigured()) {
                const ag = resolveDashboardAuthGuildId(getClient);
                oauth = ` Â· OAuth Â· Auth-Guild ${ag || '?'}`;
            }
            console.log(`Dashboard: http://${host}:${port} (${mode})${oauth}`);
        }
    });
    presenceHub.attachUpgrade(server, {
        dashAuth,
        verifySessionRole: async req => {
            let wsGuildId = '';
            try {
                const u = new URL(req.url || '/', `http://${req.headers.host}`);
                const g = (u.searchParams.get('guildId') || '').trim();
                if (/^\d{17,22}$/.test(g)) wsGuildId = g;
            } catch {
                wsGuildId = '';
            }
            const a = wsGuildId
                ? await checkDashboardGuildAccess(req, dashAuth, secret, getClient, wsGuildId)
                : await checkAnyDashboardGuildAccess(req, dashAuth, secret, getClient);
            return a.ok;
        }
    });
    server.on('close', () => presenceHub.close());

    return server;
}

