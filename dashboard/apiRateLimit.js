/** Einfaches festes Fenster pro Schlüssel (IP oder User-ID) */

const buckets = new Map();
const TRUST_PROXY = ['1', 'true', 'yes', 'on'].includes(String(process.env.TRUST_PROXY || '').toLowerCase());
const CLEANUP_INTERVAL_MS = 30_000;
const HARD_BUCKET_LIMIT = 20_000;
let nextCleanupAt = 0;

export function clientIp(req) {
    if (TRUST_PROXY) {
        const xf = req.headers['x-forwarded-for'];
        if (typeof xf === 'string' && xf.trim()) {
            return xf.split(',')[0].trim();
        }
    }
    return req.socket?.remoteAddress || 'local';
}

/**
 * @param {string} key
 * @param {{ limit?: number; windowMs?: number }} opts
 * @returns {{ ok: true } | { ok: false; retryAfterSec: number }}
 */
export function checkSensitiveRateLimit(key, { limit = 20, windowMs = 60_000 } = {}) {
    const now = Date.now();
    if (now >= nextCleanupAt || buckets.size > HARD_BUCKET_LIMIT) {
        for (const [bucketKey, bucket] of buckets.entries()) {
            if (!bucket || now >= bucket.resetAt) buckets.delete(bucketKey);
        }
        nextCleanupAt = now + CLEANUP_INTERVAL_MS;
    }
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
        if (bucket && now >= bucket.resetAt) buckets.delete(key);
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > limit) {
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
    }
    return { ok: true };
}

export function sensitiveRateKey(req, getSessionFn) {
    try {
        const sess = getSessionFn?.(req);
        if (sess?.userId) return `u:${sess.userId}`;
    } catch {
        /* ignore */
    }
    return `ip:${clientIp(req)}`;
}
