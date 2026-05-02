// /api/ga-event.js — Secure GA4 proxy (fixed version)

const rateLimitMap = new Map();

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW = 60_000;

// ─────────────────────────────
// Rate limit
// ─────────────────────────────
function isRateLimited(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
        rateLimitMap.set(ip, { count: 1, start: now });
        return false;
    }

    entry.count++;
    return entry.count > RATE_LIMIT_MAX;
}

// ─────────────────────────────
// Nettoyage des valeurs null/undefined
// ─────────────────────────────
function cleanObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    return Object.fromEntries(
        Object.entries(obj)
            .filter(([_, v]) => v !== null && v !== undefined)
            .map(([k, v]) => [k, typeof v === 'object' ? cleanObject(v) : v])
    );
}

// ─────────────────────────────
// Validation payload (allégée)
// ─────────────────────────────
function isValidPayload(body) {
    if (!body || typeof body !== 'object') return false;

    if (
        !body.client_id ||
        typeof body.client_id !== 'string' ||
        body.client_id.length > 128
    ) return false;

    if (
        !Array.isArray(body.events) ||
        body.events.length === 0 ||
        body.events.length > 25
    ) return false;

    for (const event of body.events) {
        if (!event || typeof event !== 'object') return false;
        if (!event.name || typeof event.name !== 'string') return false;
        // ✅ Regex supprimé — on accepte tous les noms d'events valides
    }

    return true;
}

// ─────────────────────────────
// CORS sécurisé
// ─────────────────────────────
function setCorsHeaders(req, res) {
    const allowedOrigin =
        process.env.ALLOWED_ORIGIN || 'https://unware.studio';
    const origin = req.headers.origin;

    if (origin === allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
}

// ─────────────────────────────
// Handler
// ─────────────────────────────
export default async function handler(req, res) {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // IP client
    const ip =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        'unknown';

    if (isRateLimited(ip)) return res.status(429).json({ error: 'Too Many Requests' });

    const body = req.body;

    if (!isValidPayload(body)) return res.status(400).json({ error: 'Invalid payload' });

    const MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID;
    const API_SECRET = process.env.API_SECRET;

    if (!MEASUREMENT_ID || !API_SECRET) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // ✅ Nettoyage des null/undefined avant envoi à GA4
        const cleanedBody = {
            ...body,
            user_id: body.user_id || undefined,
            events: body.events.map(event => ({
                ...event,
                params: cleanObject(event.params || {})
            }))
        };

        // Supprime user_id si undefined
        if (!cleanedBody.user_id) delete cleanedBody.user_id;

        const gaUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;

        const response = await fetch(gaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanedBody)
        });

        if (!response.ok) return res.status(502).json({ error: 'GA4 request failed' });

        return res.status(200).json({ status: 'ok' });

    } catch {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
