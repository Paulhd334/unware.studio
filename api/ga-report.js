// =============== /api/ga-report.js ===============
// Lit les données GA4 côté serveur (clé privée jamais exposée au navigateur)
// et renvoie un JSON unique consommé par dashboard.html
//
// Variables d'environnement à définir dans Vercel :
//   GA4_PROPERTY_ID   → l'ID numérique de la propriété GA4 (ex: 401234567)
//   GA_CLIENT_EMAIL   → email du compte de service
//   GA_PRIVATE_KEY    → clé privée du compte de service (garder les \n)
//   DASHBOARD_TOKEN   → mot de passe qui protège l'accès au dashboard
//
// Dépendance : npm i @google-analytics/data

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const PROPERTY = `properties/${process.env.GA4_PROPERTY_ID}`;

let client = null;
function getClient() {
  if (!client) {
    client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: process.env.GA_CLIENT_EMAIL,
        private_key: (process.env.GA_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
    });
  }
  return client;
}

// ── Helpers ──────────────────────────────────────────────
const num = (v) => (v === undefined || v === null || v === '' ? 0 : Number(v));

function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

function rowsToObjects(res, dimNames, metNames) {
  return (res.rows || []).map((r) => {
    const o = {};
    dimNames.forEach((name, i) => { o[name] = r.dimensionValues[i].value; });
    metNames.forEach((name, i) => { o[name] = num(r.metricValues[i].value); });
    return o;
  });
}

// ── Handler ──────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  // Protection par token
  const expected = process.env.DASHBOARD_TOKEN;
  const given = req.headers['x-dashboard-token'] || (req.query && req.query.token);
  if (expected && given !== expected) {
    return res.status(401).json({ error: 'unauthorized', message: 'Token invalide.' });
  }

  if (!process.env.GA4_PROPERTY_ID || !process.env.GA_CLIENT_EMAIL) {
    return res.status(500).json({ error: 'config', message: 'Variables GA4 manquantes côté serveur.' });
  }

  const days = Math.min(Math.max(parseInt((req.query && req.query.days) || '28', 10) || 28, 1), 365);
  const start = `${days}daysAgo`;
  const prevStart = `${days * 2}daysAgo`;
  const prevEnd = `${days + 1}daysAgo`;

  const analytics = getClient();

  try {
    const [
      totalsRes,
      seriesRes,
      pagesRes,
      eventsRes,
      devicesRes,
      sourcesRes,
      countriesRes,
      realtimeRes,
    ] = await Promise.all([
      // 1. Totaux période courante + période précédente
      analytics.runReport({
        property: PROPERTY,
        dateRanges: [
          { startDate: start, endDate: 'today', name: 'current' },
          { startDate: prevStart, endDate: prevEnd, name: 'previous' },
        ],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'engagementRate' },
          { name: 'newUsers' },
        ],
      }),

      // 2. Courbe jour par jour
      analytics.runReport({
        property: PROPERTY,
        dateRanges: [{ startDate: start, endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 400,
      }),

      // 3. Pages les plus vues
      analytics.runReport({
        property: PROPERTY,
        dateRanges: [{ startDate: start, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'userEngagementDuration' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 15,
      }),

      // 4. Événements (scroll_50, rage_click, cta_click, vital_lcp…)
      analytics.runReport({
        property: PROPERTY,
        dateRanges: [{ startDate: start, endDate: 'today' }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 40,
      }),

      // 5. Appareils
      analytics.runReport({
        property: PROPERTY,
        dateRanges: [{ startDate: start, endDate: 'today' }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      }),

      // 6. Sources de trafic
      analytics.runReport({
        property: PROPERTY,
        dateRanges: [{ startDate: start, endDate: 'today' }],
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),

      // 7. Pays
      analytics.runReport({
        property: PROPERTY,
        dateRanges: [{ startDate: start, endDate: 'today' }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      }),

      // 8. Temps réel
      analytics.runRealtimeReport({
        property: PROPERTY,
        metrics: [{ name: 'activeUsers' }],
        dimensions: [{ name: 'unifiedScreenName' }],
        limit: 10,
      }).catch(() => [{ rows: [] }]),
    ]);

    // ── Totaux ──
    const tRows = totalsRes[0].rows || [];
    const readTotals = (row) => row ? {
      users: num(row.metricValues[0].value),
      sessions: num(row.metricValues[1].value),
      views: num(row.metricValues[2].value),
      avgDuration: num(row.metricValues[3].value),
      bounceRate: num(row.metricValues[4].value),
      engagementRate: num(row.metricValues[5].value),
      newUsers: num(row.metricValues[6].value),
    } : null;

    const current = readTotals(tRows[0]) || { users: 0, sessions: 0, views: 0, avgDuration: 0, bounceRate: 0, engagementRate: 0, newUsers: 0 };
    const previous = readTotals(tRows[1]);

    // ── Courbe ──
    const timeseries = rowsToObjects(seriesRes[0], ['date'], ['users', 'sessions', 'views'])
      .map((r) => ({
        date: `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`,
        users: r.users, sessions: r.sessions, views: r.views,
      }));

    // ── Pages ──
    const pages = rowsToObjects(pagesRes[0], ['path', 'title'], ['views', 'users', 'engagement'])
      .map((p) => ({
        path: p.path,
        title: p.title,
        views: p.views,
        users: p.users,
        avgTime: p.users ? Math.round(p.engagement / p.users) : 0,
      }));

    // ── Événements ──
    const events = rowsToObjects(eventsRes[0], ['name'], ['count', 'users']);

    const realtimeRows = (realtimeRes[0] && realtimeRes[0].rows) || [];
    const realtime = realtimeRows.reduce((sum, r) => sum + num(r.metricValues[0].value), 0);

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      range: { days, start: daysAgo(days), end: daysAgo(0) },
      realtime,
      realtime_pages: realtimeRows.map((r) => ({
        name: r.dimensionValues[0].value,
        users: num(r.metricValues[0].value),
      })),
      totals: current,
      previous,
      timeseries,
      pages,
      events,
      devices: rowsToObjects(devicesRes[0], ['name'], ['users']),
      sources: rowsToObjects(sourcesRes[0], ['name'], ['sessions']),
      countries: rowsToObjects(countriesRes[0], ['name'], ['users']),
    });
  } catch (err) {
    console.error('[ga-report]', err);
    return res.status(500).json({
      error: 'ga_api',
      message: err.message || 'La requête GA4 a échoué.',
    });
  }
};
