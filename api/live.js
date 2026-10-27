// =============== /api/live.js — suivi EN DIRECT (visiteurs ayant accepté les cookies) ===============
// POST /api/live  → reçoit les signaux de live-tracker.js (page, scroll, clics…) et les garde 90 secondes
// GET  /api/live  → renvoie les visiteurs en ligne au dashboard (protégé par le token)
//
// Stockage : Upstash Redis (API REST, aucune dépendance npm). Variables d'environnement Vercel :
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   (ou KV_REST_API_URL / KV_REST_API_TOKEN)
//   DASHBOARD_TOKEN   → déjà défini pour ga-report
//   LIVE_SALT         → (facultatif) texte secret quelconque pour anonymiser les identifiants
//
// Vie privée :
//  - l'identifiant visiteur est transformé en code illisible (HMAC) : l'ID du cookie n'est jamais stocké
//  - aucune adresse IP, aucun pays, aucune query-string, aucun e-mail n'est enregistré
//  - tout est supprimé automatiquement : 90 s après le dernier signal (15 s après la fermeture de la page)

const crypto = require('crypto');

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SALT = process.env.LIVE_SALT || process.env.DASHBOARD_TOKEN || 'unware';
const TTL = 90;            // secondes de vie d'une fiche visiteur
const MAX_EVENTS = 8;      // dernières actions gardées par visiteur
const ALLOWED_HOSTS = ['unware.studio', 'www.unware.studio'];

async function redis(commands) {
  const r = await fetch(REDIS_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error('redis http ' + r.status);
  const out = await r.json();
  return out.map((x) => { if (x.error) throw new Error(x.error); return x.result; });
}

const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
const hashId = (vid) => crypto.createHmac('sha256', SALT).update(vid).digest('hex').slice(0, 16);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-dashboard-token, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'config', message: 'Base Redis non configurée.' });
  }

  try {
    // ───────────── LECTURE (dashboard) ─────────────
    if (req.method === 'GET') {
      const expected = process.env.DASHBOARD_TOKEN;
      const given = req.headers['x-dashboard-token'] || (req.query && req.query.token);
      if (expected && given !== expected) return res.status(401).json({ error: 'unauthorized' });

      const now = Date.now();
      const [ids] = await redis([['ZRANGEBYSCORE', 'live:index', now - 120000, '+inf']]);
      if (!ids || !ids.length) return res.status(200).json({ now, visitors: [] });
      const [docs] = await redis([['MGET', ...ids.map((i) => 'live:' + i)]]);
      const visitors = [];
      ids.forEach((id, i) => {
        if (!docs[i]) return; // fiche déjà expirée
        try {
          const d = JSON.parse(docs[i]);
          visitors.push({ id: id.slice(0, 4), ...d });
        } catch (e) {}
      });
      visitors.sort((a, b) => b.seen - a.seen);
      return res.status(200).json({ now, visitors });
    }

    // ───────────── ÉCRITURE (live-tracker.js) ─────────────
    if (req.method !== 'POST') return res.status(405).end();

    // Seul le site lui-même peut envoyer des signaux
    let originHost = '';
    try { originHost = new URL(req.headers.origin || req.headers.referer || '').hostname; } catch (e) {}
    if (!ALLOWED_HOSTS.includes(originHost)) return res.status(403).end();

    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
    if (!b || typeof b.vid !== 'string' || !/^[\w.\-]{3,100}$/.test(b.vid)) return res.status(400).end();

    const id = hashId(b.vid);
    const key = 'live:' + id;

    // Retrait du consentement : on efface tout de suite
    if (b.wipe) {
      await redis([['DEL', key], ['ZREM', 'live:index', id]]);
      return res.status(204).end();
    }
    // Fermeture de la page : la fiche disparaît dans 15 s (sauf si une autre page du site la renouvelle)
    if (b.leave) {
      await redis([['EXPIRE', key, 15]]);
      return res.status(204).end();
    }

    const now = Date.now();
    const [cur] = await redis([['GET', key]]);
    let prev = null;
    try { prev = cur ? JSON.parse(cur) : null; } catch (e) {}
    const events = (prev && Array.isArray(prev.events)) ? prev.events : [];

    if (b.event && (b.event.t === 'link' || b.event.t === 'button')) {
      events.push({ t: b.event.t, label: clean(b.event.label, 60), to: clean(b.event.to, 120), at: now });
      while (events.length > MAX_EVENTS) events.shift();
    }

    const doc = {
      path: clean(b.path, 120),
      title: clean(b.title, 80),
      device: ['desktop', 'mobile', 'tablet'].includes(b.device) ? b.device : 'desktop',
      scroll: Math.max(0, Math.min(100, parseInt(b.scroll, 10) || 0)),
      age: Math.max(0, Math.min(86400000, Number(b.age) || 0)), // temps déjà passé sur la page (ms)
      hidden: !!b.hidden,
      seen: now,
      events,
    };

    await redis([
      ['SET', key, JSON.stringify(doc), 'EX', TTL],
      ['ZADD', 'live:index', now, id],
      ['ZREMRANGEBYSCORE', 'live:index', '-inf', now - 180000],
    ]);
    return res.status(204).end();
  } catch (err) {
    console.error('[live]', err.message);
    return res.status(500).json({ error: 'live', message: 'Erreur du suivi en direct.' });
  }
};
