// /api/ga-event.js — VERSION SÉCURISÉE CORRIGÉE

// ── Rate limiting simple en mémoire (reset à chaque cold start Vercel) ──
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 30;       // max requêtes par fenêtre
const RATE_LIMIT_WINDOW = 60000; // fenêtre de 60 secondes

function isRateLimited(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
        rateLimitMap.set(ip, { count: 1, start: now });
        return false;
    }

    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) return true;
    return false;
}

// ── Validation minimale du payload GA ──
function isValidPayload(body) {
    if (!body || typeof body !== 'object') return false;
    if (!body.client_id || typeof body.client_id !== 'string') return false;
    if (!Array.isArray(body.events) || body.events.length === 0) return false;
    if (body.events.length > 25) return false; // limite GA4
    for (const event of body.events) {
        if (!event.name || typeof event.name !== 'string') return false;
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(event.name)) return false; // format GA4
    }
    return true;
}

// ── CORS headers (appliqués sur toutes les réponses) ──
function setCorsHeaders(res) {
    // Restreindre à ton domaine en prod — remplace par le tien
    const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://unware.studio';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
    setCorsHeaders(res);

    // ── OPTIONS (preflight) ──
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // ── GET : message neutre sans infos sensibles ──
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'ok' });
    }

    // ── Seul POST est traité ──
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // ── Rate limiting par IP ──
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
             || req.headers['x-real-ip']
             || req.socket?.remoteAddress
             || 'unknown';

    if (isRateLimited(ip)) {
        return res.status(429).json({ error: 'Too Many Requests' });
    }

    // ── Clés depuis variables d'environnement UNIQUEMENT ──
    const MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID;
    const API_SECRET      = process.env.API_SECRET;

    if (!MEASUREMENT_ID || !API_SECRET) {
        // On logue côté serveur (visible dans les logs Vercel), jamais côté client
        console.error('[ga-event] Variables d\'environnement GA manquantes');
        // On retourne 200 pour ne pas bloquer le client silencieusement,
        // mais on trace l'erreur en interne
        return res.status(200).json({ status: 'config_error' });
    }

    // ── Validation du payload ──
    const body = req.body;
    if (!isValidPayload(body)) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    // ── Envoi à Google Analytics Measurement Protocol ──
    const gaUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;

    try {
        const gaResponse = await fetch(gaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!gaResponse.ok) {
            // Loggé en interne uniquement
            console.error(`[ga-event] GA a répondu ${gaResponse.status}`);
            return res.status(200).json({ status: 'ga_error' });
        }

        return res.status(200).json({ status: 'sent' });

    } catch (error) {
        console.error('[ga-event] Erreur fetch GA:', error.message);
        return res.status(200).json({ status: 'error' });
    }
}
