
const crypto = require('crypto');

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SALT = process.env.LIVE_SALT || process.env.DASHBOARD_TOKEN || 'unware';

const TTL = 90;
const MAX_EVENTS = 8;
const ALLOWED_HOSTS = ['unware.studio', 'www.unware.studio'];

// ───────────── REDIS ─────────────

async function redis(commands) {
  const r = await fetch(REDIS_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + REDIS_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(8000)
  });

  if (!r.ok) throw new Error('redis http ' + r.status);

  const out = await r.json();

  return out.map(x => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

const clean = (v, n) =>
  String(v == null ? '' : v)
    .replace(/[\u0000-\u001f<>]/g, ' ')
    .trim()
    .slice(0, n);

const hashId = vid =>
  crypto.createHmac('sha256', SALT)
    .update(vid)
    .digest('hex')
    .slice(0, 16);

// ───────────── API LIVE ─────────────

module.exports = async (req, res) => {

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-dashboard-token, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Authentification obligatoire du dashboard

  if (req.method === 'GET') {
    const expected = process.env.DASHBOARD_TOKEN;
    const given = req.headers['x-dashboard-token'];

    if (!expected) {
      return res.status(503).json({
        error: 'auth_config'
      });
    }

    if (typeof given !== 'string' || given !== expected) {
      return res.status(401).json({
        error: 'unauthorized'
      });
    }
  }

  // Vérification de la configuration Redis

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(503).json({
      error: 'config',
      ...(req.method === 'GET' ? {
        health: {
          redis: {
            ok: false,
            checkedAt: Date.now(),
            reason: 'config'
          }
        }
      } : {})
    });
  }

  let redisHealth;

  try {

    // ───────────── LECTURE DASHBOARD ─────────────

    if (req.method === 'GET') {

      // Contrôle de santé Redis

      const start = Date.now();
      const [pong] = await redis([['PING']]);

      redisHealth = {
        ok: pong === 'PONG',
        latencyMs: Date.now() - start,
        checkedAt: Date.now()
      };

      if (!redisHealth.ok) {
        throw new Error('Unexpected Redis PING response');
      }

      const now = Date.now();

      const [ids] = await redis([
        ['ZRANGEBYSCORE', 'live:index', now - 120000, '+inf']
      ]);

      const visitors = [];

      if (ids && ids.length) {

        const [docs] = await redis([
          ['MGET', ...ids.map(i => 'live:' + i)]
        ]);

        ids.forEach((id, i) => {
          if (!docs[i]) return;

          try {
            visitors.push({
              id: id.slice(0, 4),
              ...JSON.parse(docs[i])
            });
          } catch (e) {}
        });
      }

      visitors.sort((a, b) => b.seen - a.seen);

      return res.status(200).json({
        now,
        visitors,
        health: {
          redis: redisHealth
        }
      });
    }

    // ───────────── ÉCRITURE LIVE TRACKER ─────────────

    if (req.method !== 'POST') {
      return res.status(405).end();
    }

    let originHost = '';

    try {
      originHost = new URL(
        req.headers.origin || req.headers.referer || ''
      ).hostname;
    } catch (e) {}

    if (!ALLOWED_HOSTS.includes(originHost)) {
      return res.status(403).end();
    }

    let b = req.body;

    if (typeof b === 'string') {
      try {
        b = JSON.parse(b);
      } catch (e) {
        b = null;
      }
    }

    if (
      !b ||
      typeof b.vid !== 'string' ||
      !/^[\w.\-]{3,100}$/.test(b.vid)
    ) {
      return res.status(400).end();
    }

    const id = hashId(b.vid);
    const key = 'live:' + id;

    // Retrait du consentement

    if (b.wipe) {
      await redis([
        ['DEL', key],
        ['ZREM', 'live:index', id]
      ]);

      return res.status(204).end();
    }

    // Fermeture de la page

    if (b.leave) {
      await redis([
        ['EXPIRE', key, 15]
      ]);

      return res.status(204).end();
    }

    const now = Date.now();

    const [cur] = await redis([
      ['GET', key]
    ]);

    let prev = null;

    try {
      prev = cur ? JSON.parse(cur) : null;
    } catch (e) {}

    const events =
      prev && Array.isArray(prev.events)
        ? prev.events
        : [];

    // Enregistrement des interactions

    if (
      b.event &&
      (b.event.t === 'link' || b.event.t === 'button')
    ) {
      events.push({
        t: b.event.t,
        label: clean(b.event.label, 60),
        to: clean(b.event.to, 120),
        at: now
      });

      while (events.length > MAX_EVENTS) {
        events.shift();
      }
    }

    // Informations du visiteur

    const doc = {
      path: clean(b.path, 120),
      title: clean(b.title, 80),

      device: ['desktop', 'mobile', 'tablet'].includes(b.device)
        ? b.device
        : 'desktop',

      scroll: Math.max(
        0,
        Math.min(100, parseInt(b.scroll, 10) || 0)
      ),

      age: Math.max(
        0,
        Math.min(86400000, Number(b.age) || 0)
      ),

      hidden: !!b.hidden,
      seen: now,
      events
    };

    // Enregistrement temporaire dans Redis

    await redis([
      ['SET', key, JSON.stringify(doc), 'EX', TTL],
      ['ZADD', 'live:index', now, id],
      ['ZREMRANGEBYSCORE', 'live:index', '-inf', now - 180000]
    ]);

    return res.status(204).end();

  } catch (err) {

    console.error('[live]', err.message);

    return res.status(500).json({
      error: 'live',
      message: 'Erreur du suivi en direct.',

      ...(req.method === 'GET' ? {
        health: {
          redis: {
            ok: false,
            checkedAt: Date.now(),
            reason: 'request_failed'
          }
        }
      } : {})
    });
  }
};
