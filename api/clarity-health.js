
const CLARITY_TOKEN = process.env.CLARITY_API_TOKEN;
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN;

const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL;

const REDIS_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN;

const CACHE_KEY = 'unware:clarity:health';
const LOCK_KEY = 'unware:clarity:health:lock';
const CACHE_TTL = 4 * 60 * 60;

const CLARITY_URL =
  'https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1&dimension1=OS';

async function redis(...command) {
  const response = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error('Redis request failed');
  }

  const data = await response.json();

  if (data.error) {
    throw new Error('Redis command failed');
  }

  return data.result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'x-dashboard-token, Content-Type'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, OPTIONS'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'method_not_allowed'
    });
  }

  // Protection du dashboard
  if (
    !DASHBOARD_TOKEN ||
    req.headers['x-dashboard-token'] !== DASHBOARD_TOKEN
  ) {
    return res.status(401).json({
      error: 'unauthorized'
    });
  }

  if (!CLARITY_TOKEN) {
    return res.status(503).json({
      service: 'Microsoft Clarity',
      status: 'unavailable',
      message: 'CLARITY_API_TOKEN non configuré.'
    });
  }

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(503).json({
      service: 'Microsoft Clarity',
      status: 'unknown',
      message: 'Cache Redis non configuré.'
    });
  }

  try {
    // Lecture du dernier contrôle
    const cached = await redis('GET', CACHE_KEY);

    if (cached) {
      return res.status(200).json({
        ...JSON.parse(cached),
        cached: true
      });
    }

    // Empêche les contrôles simultanés
    const locked = await redis(
      'SET', LOCK_KEY, '1', 'NX', 'EX', CACHE_TTL
    );

    if (locked !== 'OK') {
      return res.status(200).json({
        service: 'Microsoft Clarity',
        status: 'unknown',
        message: 'Contrôle en cours ou temporairement limité.'
      });
    }

    const start = Date.now();

    let health = {
      service: 'Microsoft Clarity',
      ok: false,
      status: 'unavailable',
      checkedAt: Date.now()
    };

    try {
      const response = await fetch(CLARITY_URL, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${CLARITY_TOKEN}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(12000)
      });

      health.latencyMs = Date.now() - start;
      health.httpStatus = response.status;

      if (response.ok) {
        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error('Invalid response');
        }

        health = {
          ...health,
          ok: true,
          status: 'operational',
          message: 'Connexion Microsoft Clarity réussie.',
          metricsAvailable: data.length
        };

      } else if (
        response.status === 401 ||
        response.status === 403
      ) {
        health.message = 'Token Clarity invalide ou non autorisé.';

      } else if (response.status === 429) {
        health.status = 'warning';
        health.message = 'Quota journalier Clarity atteint.';

      } else {
        health.message =
          `Erreur Microsoft Clarity HTTP ${response.status}.`;
      }

    } catch (error) {
      health.status = 'unavailable';
      health.message = 'Réponse Clarity invalide ou connexion impossible.';
      health.latencyMs = Date.now() - start;
    }

    health.checkedAt = Date.now();

    // Conservation du résultat pendant 4 heures
    await redis(
      'SET',
      CACHE_KEY,
      JSON.stringify(health),
      'EX',
      CACHE_TTL
    );

    return res.status(200).json({
      ...health,
      cached: false
    });

  } catch (error) {
    console.error('[clarity-health]', error.message);

    return res.status(503).json({
      service: 'Microsoft Clarity',
      status: 'unknown',
      message: 'Impossible de vérifier le service via Redis.'
    });
  }
};
