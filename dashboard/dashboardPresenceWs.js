import crypto from 'crypto';

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function toWebSocketAccept(key) {
    return crypto.createHash('sha1').update(`${key}${WS_MAGIC}`).digest('base64');
}

function encodeTextFrame(text) {
    const payload = Buffer.from(text, 'utf8');
    const length = payload.length;
    if (length < 126) {
        return Buffer.concat([Buffer.from([0x81, length]), payload]);
    }
    if (length < 65536) {
        const header = Buffer.from([0x81, 126, (length >> 8) & 255, length & 255]);
        return Buffer.concat([header, payload]);
    }
    return null;
}

function parseClientFrames(buffer, onText) {
    let offset = 0;
    while (offset + 2 <= buffer.length) {
        const first = buffer[offset];
        const second = buffer[offset + 1];
        const opcode = first & 0x0f;
        const masked = (second & 0x80) !== 0;
        let length = second & 0x7f;
        let headSize = 2;
        if (length === 126) {
            if (offset + 4 > buffer.length) break;
            length = (buffer[offset + 2] << 8) | buffer[offset + 3];
            headSize = 4;
        } else if (length === 127) {
            break;
        }
        if (!masked || offset + headSize + 4 + length > buffer.length) break;
        const maskStart = offset + headSize;
        const dataStart = maskStart + 4;
        const out = Buffer.alloc(length);
        for (let i = 0; i < length; i += 1) {
            out[i] = buffer[dataStart + i] ^ buffer[maskStart + (i % 4)];
        }
        if (opcode === 0x8) return { remaining: Buffer.alloc(0), shouldClose: true };
        if (opcode === 0x1) {
            try {
                onText(out.toString('utf8'));
            } catch {
                // Ignorieren: Ungültige Client-Nachricht.
            }
        }
        offset = dataStart + length;
    }
    return { remaining: buffer.subarray(offset), shouldClose: false };
}

export function createDashboardPresenceHub({ staleAfterMs = 12_000, getClientIp } = {}) {
    /** @type {Map<import('net').Socket, {userId:string,username:string,avatarUrl:string|null,initials:string,guildId:string,connectedAt:number,lastActiveAt:number,buffer:Buffer}>} */
    const clients = new Map();
    const ipBySocket = new Map();
    const ipOpenCount = new Map();
    const ipBurst = new Map();
    let staleTimer = null;
    const MAX_TOTAL_CONNECTIONS = 120;
    const MAX_CONNECTIONS_PER_IP = 5;
    const MAX_UPGRADES_PER_IP_WINDOW = 30;
    const UPGRADE_WINDOW_MS = 60_000;
    const MAX_CLIENT_BUFFER = 64 * 1024;

    function readIp(req) {
        if (typeof getClientIp === 'function') {
            try {
                return getClientIp(req);
            } catch {
                // fallback below
            }
        }
        const xf = req.headers['x-forwarded-for'];
        if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
        return req.socket?.remoteAddress || 'local';
    }

    function allowUpgrade(ip) {
        const now = Date.now();
        const burst = ipBurst.get(ip);
        if (!burst || now >= burst.resetAt) {
            ipBurst.set(ip, { count: 1, resetAt: now + UPGRADE_WINDOW_MS });
        } else {
            burst.count += 1;
            if (burst.count > MAX_UPGRADES_PER_IP_WINDOW) return false;
        }
        if (clients.size >= MAX_TOTAL_CONNECTIONS) return false;
        const open = ipOpenCount.get(ip) || 0;
        if (open >= MAX_CONNECTIONS_PER_IP) return false;
        return true;
    }

    function rememberSocketIp(socket, ip) {
        ipBySocket.set(socket, ip);
        ipOpenCount.set(ip, (ipOpenCount.get(ip) || 0) + 1);
    }

    function releaseSocketIp(socket) {
        const ip = ipBySocket.get(socket);
        if (!ip) return;
        ipBySocket.delete(socket);
        const current = ipOpenCount.get(ip) || 0;
        if (current <= 1) ipOpenCount.delete(ip);
        else ipOpenCount.set(ip, current - 1);
    }

    function listActiveUsers() {
        const now = Date.now();
        const byUser = new Map();
        for (const entry of clients.values()) {
            const existing = byUser.get(entry.userId);
            if (!existing) {
                byUser.set(entry.userId, {
                    userId: entry.userId,
                    username: entry.username,
                    avatarUrl: entry.avatarUrl,
                    initials: entry.initials,
                    guildId: entry.guildId,
                    connectedAt: entry.connectedAt,
                    lastActiveAt: entry.lastActiveAt
                });
                continue;
            }
            existing.connectedAt = Math.min(existing.connectedAt, entry.connectedAt);
            existing.lastActiveAt = Math.max(existing.lastActiveAt, entry.lastActiveAt);
            if (!existing.avatarUrl && entry.avatarUrl) existing.avatarUrl = entry.avatarUrl;
        }
        return [...byUser.values()]
            .map(user => ({ ...user, activeForSec: Math.max(0, Math.floor((now - user.connectedAt) / 1000)) }))
            .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    }

    function broadcastPresence() {
        const payload = JSON.stringify({ type: 'presence', users: listActiveUsers(), now: Date.now() });
        const frame = encodeTextFrame(payload);
        if (!frame) return;
        for (const socket of clients.keys()) {
            if (socket.destroyed) continue;
            socket.write(frame);
        }
    }

    function dropClient(socket) {
        if (!clients.has(socket)) return;
        clients.delete(socket);
        releaseSocketIp(socket);
        socket.destroy();
        broadcastPresence();
    }

    function touch(socket) {
        const data = clients.get(socket);
        if (!data) return;
        data.lastActiveAt = Date.now();
    }

    /**
     * @param {import('http').Server} server
     * @param {{
     *   dashAuth: { getSession: (req: import('http').IncomingMessage) => unknown },
     *   verifySessionRole?: (req: import('http').IncomingMessage) => Promise<boolean>
     * }} opts
     */
    function attachUpgrade(server, opts) {
        const dashAuth = opts?.dashAuth;
        const verifySessionRole = typeof opts?.verifySessionRole === 'function' ? opts.verifySessionRole : null;

        server.on('upgrade', (req, socket) => {
            const pathname = (() => {
                try {
                    return new URL(req.url || '/', `http://${req.headers.host}`).pathname;
                } catch {
                    return '';
                }
            })();
            const guildId = (() => {
                try {
                    const url = new URL(req.url || '/', `http://${req.headers.host}`);
                    const gid = (url.searchParams.get('guildId') || '').trim();
                    return /^\d{17,22}$/.test(gid) ? gid : '';
                } catch {
                    return '';
                }
            })();
            if (pathname !== '/ws/presence') return;
            const ip = readIp(req);
            if (!allowUpgrade(ip)) {
                socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
                socket.destroy();
                return;
            }

            const wsKey = req.headers['sec-websocket-key'];
            const wsVersion = req.headers['sec-websocket-version'];
            if (!dashAuth || !wsKey || wsVersion !== '13') {
                socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
                socket.destroy();
                return;
            }

            void (async () => {
                try {
                    const session = dashAuth.getSession(req);
                    if (!session) {
                        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
                        socket.destroy();
                        return;
                    }
                    if (verifySessionRole) {
                        const allowed = await verifySessionRole(req);
                        if (!allowed) {
                            socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
                            socket.destroy();
                            return;
                        }
                    }

                    const accept = toWebSocketAccept(String(wsKey));
                    socket.write(
                        'HTTP/1.1 101 Switching Protocols\r\n' +
                            'Upgrade: websocket\r\n' +
                            'Connection: Upgrade\r\n' +
                            `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
                    );

                    clients.set(socket, {
                        userId: session.userId,
                        username: session.username,
                        avatarUrl: session.avatarUrl,
                        initials: session.initials,
                        guildId,
                        connectedAt: Date.now(),
                        lastActiveAt: Date.now(),
                        buffer: Buffer.alloc(0)
                    });
                    rememberSocketIp(socket, ip);
                    broadcastPresence();

                    socket.on('data', chunk => {
                        const data = clients.get(socket);
                        if (!data) return;
                        data.buffer = Buffer.concat([data.buffer, chunk]);
                        if (data.buffer.length > MAX_CLIENT_BUFFER) {
                            dropClient(socket);
                            return;
                        }
                        const parsed = parseClientFrames(data.buffer, text => {
                            if (!text) return;
                            try {
                                const message = JSON.parse(text);
                                if (message?.type === 'heartbeat' || message?.type === 'focus') {
                                    touch(socket);
                                }
                            } catch {
                                /* ignorieren */
                            }
                        });
                        data.buffer = parsed.remaining;
                        if (parsed.shouldClose) {
                            dropClient(socket);
                        }
                    });

                    socket.on('close', () => dropClient(socket));
                    socket.on('end', () => dropClient(socket));
                    socket.on('error', () => dropClient(socket));
                } catch (e) {
                    console.error('WS presence upgrade:', e);
                    if (!socket.destroyed) {
                        socket.write('HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n');
                        socket.destroy();
                    }
                }
            })();
        });

        staleTimer = setInterval(() => {
            const now = Date.now();
            let changed = false;
            for (const [socket, data] of clients.entries()) {
                if (now - data.lastActiveAt > staleAfterMs || socket.destroyed) {
                    clients.delete(socket);
                    releaseSocketIp(socket);
                    socket.destroy();
                    changed = true;
                }
            }
            if (changed) broadcastPresence();
            else if (clients.size > 0) broadcastPresence();
        }, 5000);
        staleTimer.unref?.();
    }

    function close() {
        if (staleTimer) clearInterval(staleTimer);
        for (const socket of clients.keys()) {
            releaseSocketIp(socket);
            socket.destroy();
        }
        clients.clear();
    }

    return { attachUpgrade, close };
}

