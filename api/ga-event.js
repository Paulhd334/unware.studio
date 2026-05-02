// /api/ga-event.js — Secure GA4 proxy (temps réel + sécurisé)

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
        rateLimitMap.set(ip, {
            count: 1,
            start: now
        });

        return false;
    }

    entry.count++;

    return entry.count > RATE_LIMIT_MAX;
}

// ─────────────────────────────
// Validation payload
// ─────────────────────────────
function isValidPayload(body) {
    if (!body || typeof body !== 'object') return false;

    if (
        !body.client_id ||
        typeof body.client_id !== 'string' ||
        body.client_id.length > 128
    ) {
        return false;
    }

    if (!Array.isArray(body.events)) return false;

    if (body.events.length === 0 || body.events.length > 25) {
        return false;
    }

    for (const event of body.events) {
        if (!event || typeof event !== 'object') {
            return false;
        }

        if (
            !event.name ||
            typeof event.name !== 'string'
        ) {
            return false;
        }

        // Format officiel GA4
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(event.name)) {
            return false;
        }

        // params optionnels
        if (
            event.params &&
            typeof event.params !== 'object'
        ) {
            return false;
        }
    }

    return true;
}

// ─────────────────────────────
// CORS sécurisé
// ─────────────────────────────
function setCorsHeaders(req, res) {
    const allowedOrigin =
        process.env.ALLOWED_ORIGIN ||
        'https://unware.studio';

    const origin = req.headers.origin;

    if (origin === allowedOrigin) {
        res.setHeader(
            'Access-Control-Allow-Origin',
            allowedOrigin
        );
    }

    res.setHeader(
        'Access-Control-Allow-Methods',
        'POST, OPTIONS'
    );

    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type'
    );

    res.setHeader(
        'Vary',
        'Origin'
    );
}

// ─────────────────────────────
// Handler
// ─────────────────────────────
export default async function handler(req, res) {

    setCorsHeaders(req, res);

    // OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // Refuse tout sauf POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method Not Allowed'
        });
    }

    // IP
    const ip =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        'unknown';

    // Rate limit
    if (isRateLimited(ip)) {
        return res.status(429).json({
            error: 'Too Many Requests'
        });
    }

    // Validation body
    const body = req.body;

    if (!isValidPayload(body)) {
        return res.status(400).json({
            error: 'Invalid payload'
        });
    }

    // ENV
    const MEASUREMENT_ID =
        process.env.GA_MEASUREMENT_ID;

    const API_SECRET =
        process.env.API_SECRET;

    if (!MEASUREMENT_ID || !API_SECRET) {
        console.error(
            '[ga-event] Missing environment variables'
        );

        return res.status(500).json({
            error: 'Server configuration error'
        });
    }

    try {

        // Endpoint GA4
        const gaUrl =
            `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;

        // Envoi GA4 temps réel
        const response = await fetch(gaUrl, {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(body)
        });

        // Erreur Google
        if (!response.ok) {

            const text = await response.text();

            console.error(
                '[ga-event] GA4 Error:',
                response.status,
                text
            );

            return res.status(502).json({
                error: 'GA4 request failed'
            });
        }

        // Succès
        return res.status(200).json({
            status: 'ok'
        });

    } catch (error) {

        console.error(
            '[ga-event] Internal Error:',
            error
        );

        return res.status(500).json({
            error: 'Internal Server Error'
        });
    }
}
