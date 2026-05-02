// /api/ga-event.js — Neon DB + GA4

import { neon } from '@neondatabase/serverless';

// ── Rate limiting simple en mémoire ──
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW = 60000;

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

// ── Validation payload ──
function isValidPayload(body) {
    if (!body || typeof body !== 'object') return false;
    if (!body.client_id || typeof body.client_id !== 'string') return false;
    if (!Array.isArray(body.events) || body.events.length === 0) return false;
    if (body.events.length > 25) return false;
    for (const event of body.events) {
        if (!event.name || typeof event.name !== 'string') return false;
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(event.name)) return false;
    }
    return true;
}

// ── CORS ──
function setCorsHeaders(res) {
    const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://unware.studio';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
}

// ── Sauvegarde dans Neon ──
async function saveToNeon(body) {
    if (!process.env.POSTGRES_URL) return;
    const sql = neon(process.env.POSTGRES_URL);

    const promises = body.events.map(event => {
        const p = event.params || {};
        return sql`
            INSERT INTO events (event_name, page_title, page_path, device_type, client_id, session_id, params)
            VALUES (
                ${event.name},
                ${p.page_title   || null},
                ${p.page_path    || null},
                ${p.device_type  || null},
                ${body.client_id || null},
                ${p.session_id   || null},
                ${JSON.stringify(p)}
            )
        `;
    });

    await Promise.all(promises);
}

export default async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method === 'GET')     return res.status(200).json({ status: 'ok' });
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method Not Allowed' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
             || req.headers['x-real-ip']
             || req.socket?.remoteAddress
             || 'unknown';

    if (isRateLimited(ip)) return res.status(429).json({ error: 'Too Many Requests' });

    const body = req.body;
    if (!isValidPayload(body)) return res.status(400).json({ error: 'Invalid payload' });

    // ── Sauvegarde Neon + envoi GA4 en parallèle ──
    const results = await Promise.allSettled([
        // 1. Neon DB
        saveToNeon(body),

        // 2. GA4 Measurement Protocol
        (async () => {
            const MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID;
            const API_SECRET     = process.env.API_SECRET;
            if (!MEASUREMENT_ID || !API_SECRET) return;

            const gaUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;
            await fetch(gaUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        })()
    ]);

    const neonOk = results[0].status === 'fulfilled';
    const ga4Ok  = results[1].status === 'fulfilled';

    if (!neonOk) console.error('[ga-event] Neon error:', results[0].reason);
    if (!ga4Ok)  console.error('[ga-event] GA4 error:', results[1].reason);

    return res.status(200).json({
        status: 'ok',
        db:  neonOk ? 'saved' : 'error',
        ga4: ga4Ok  ? 'sent'  : 'error'
    });
}
