// =============== /api/ga-report.js — v2 (analytics.js v8) ===============
// Lit les données GA4 côté serveur (clé privée jamais exposée au navigateur)
// et renvoie un JSON unique consommé par dashboard.html
//
// Variables d'environnement à définir dans Vercel :
//   GA4_PROPERTY_ID   → l'ID NUMÉRIQUE de la propriété GA4 (ex: 510798159 — pas le "G-XXXX")
//   GA_CLIENT_EMAIL   → email du compte de service
//   GA_PRIVATE_KEY    → clé privée du compte de service (garder les \n)
//   DASHBOARD_TOKEN   → mot de passe qui protège l'accès au dashboard
//
// Dépendance : npm i @google-analytics/data
//
// Nouveautés v2 :
//  - événements : 100 lignes au lieu de 40, et les « hover_* » sont exclus (ils noyaient les petits événements clés)
//  - returning  : nouveaux / de retour (dimension GA4 native, rien à configurer)
//  - outbound   : liens sortants par destination   → nécessite la dimension personnalisée « destination »
//  - navigation : parcours page → page             → nécessite les dimensions « from_title » et « to_title »
//  - vitals     : moyennes LCP / FCP / TTFB / INP / CLS → nécessite les métriques personnalisées « value_ms » et « value »
//  Si une dimension/métrique personnalisée n'est pas encore déclarée dans GA4, le champ est simplement omis
//  (le dashboard masque la section) : le reste continue de fonctionner.

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

const eventIs = (name) => ({
  filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: name } },
});

// ── Handler ──────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  // Le dashboard n'est pas hébergé sur unware.studio (fichier local ou artefact),
  // donc on autorise les requêtes cross-origin vers cette route précise.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-dashboard-token, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

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
  const range = [{ startDate: start, endDate: 'today' }];

  const analytics = getClient();

  // Requêtes optionnelles (dimensions / métriques personnalisées) : en cas d'échec → null
  const optional = (promise) => promise.catch((e) => {
    console.warn('[ga-report] requête optionnelle ignorée :', e.message);
    return null;
  });

  try {
    const [
      totalsRes,
      seriesRes,
      pagesRes,
      eventsRes,
      devicesRes,
      sourcesRes,
      countriesRes,
      realtimeTotalRes,
      realtimePagesRes,
      returningRes,
      outboundRes,
      navigationRes,
      vitalsRes,
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
        dateRanges: range,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 400,
      }),

      // 3. Pages les plus vues
      analytics.runReport({
        property: PROPERTY,
        dateRanges: range,
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'userEngagementDuration' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 15,
      }),

      // 4. Événements (scroll_*, time_*, clic_*, rage_click, vital_*…) — sans les hover_*
      analytics.runReport({
        property: PROPERTY,
        dateRanges: range,
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
        dimensionFilter: {
          notExpression: {
            filter: { fieldName: 'eventName', stringFilter: { matchType: 'BEGINS_WITH', value: 'hover_' } },
          },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 100,
      }),

      // 5. Appareils
      analytics.runReport({
        property: PROPERTY,
        dateRanges: range,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      }),

      // 6. Sources de trafic
      analytics.runReport({
        property: PROPERTY,
        dateRanges: range,
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),

      // 7. Pays
      analytics.runReport({
        property: PROPERTY,
        dateRanges: range,
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      }),

      // 8a. Temps réel — total RÉEL de visiteurs uniques (sans dimension : une seule ligne)
      analytics.runRealtimeReport({
        property: PROPERTY,
        metrics: [{ name: 'activeUsers' }],
      }).catch(() => [{ rows: [] }]),

      // 8b. Temps réel — répartition par page (ne JAMAIS sommer ces valeurs)
      analytics.runRealtimeReport({
        property: PROPERTY,
        metrics: [{ name: 'activeUsers' }],
        dimensions: [{ name: 'unifiedScreenName' }],
        limit: 10,
      }).catch(() => [{ rows: [] }]),

      // 9. Nouveaux / de retour (dimension native GA4)
      optional(analytics.runReport({
        property: PROPERTY,
        dateRanges: range,
        dimensions: [{ name: 'newVsReturning' }],
        metrics: [{ name: 'activeUsers' }],
      })),

      // 10. Liens sortants par destination (dimension personnalisée « destination »)
      optional(analytics.runReport({
        property: PROPERTY,
        dateRanges: range,
        dimensions: [{ name: 'customEvent:destination' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: eventIs('outbound_link'),
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 10,
      })),

      // 11. Parcours page → page (dimensions personnalisées « from_title » et « to_title »)
      optional(analytics.runReport({
        property: PROPERTY,
        dateRanges: range,
        dimensions: [{ name: 'customEvent:from_title' }, { name: 'customEvent:to_title' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: eventIs('page_navigation'),
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 10,
      })),

      // 12. Core Web Vitals (métriques personnalisées « value_ms » et « value », somme par événement)
      optional(analytics.runReport({
        property: PROPERTY,
        dateRanges: range,
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }, { name: 'customEvent:value_ms' }, { name: 'customEvent:value' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: { values: ['vital_lcp', 'vital_fcp', 'vital_ttfb', 'vital_inp', 'vital_cls'] },
          },
        },
      })),
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

    // ── Temps réel : total vient de la requête SANS dimension ──
    const realtimeTotalRows = (realtimeTotalRes[0] && realtimeTotalRes[0].rows) || [];
    const realtime = realtimeTotalRows.length
      ? num(realtimeTotalRows[0].metricValues[0].value)
      : 0;
    const realtimeRows = (realtimePagesRes[0] && realtimePagesRes[0].rows) || [];

    // ── Nouveaux / de retour ──
    let returning;
    if (returningRes && returningRes[0]) {
      const r = rowsToObjects(returningRes[0], ['type'], ['users']);
      const fr = { new: 'Nouveaux', returning: 'De retour' };
      returning = r
        .filter((x) => fr[x.type])
        .map((x) => ({ name: fr[x.type], users: x.users }))
        .sort((a, b) => b.users - a.users);
      if (!returning.length) returning = undefined;
    }

    // ── Liens sortants ──
    let outbound;
    if (outboundRes && outboundRes[0]) {
      outbound = rowsToObjects(outboundRes[0], ['name'], ['count'])
        .filter((x) => x.name && x.name !== '(not set)');
      if (!outbound.length) outbound = undefined;
    }

    // ── Parcours ──
    let navigation;
    if (navigationRes && navigationRes[0]) {
      navigation = rowsToObjects(navigationRes[0], ['from', 'to'], ['count'])
        .filter((x) => x.from && x.to && x.from !== '(not set)' && x.to !== '(not set)')
        .map((x) => ({ name: `${x.from} → ${x.to}`, count: x.count }));
      if (!navigation.length) navigation = undefined;
    }

    // ── Core Web Vitals (moyenne = somme du paramètre / nombre d'événements) ──
    let vitals;
    if (vitalsRes && vitalsRes[0]) {
      const v = {};
      rowsToObjects(vitalsRes[0], ['name'], ['count', 'sumMs', 'sumValue']).forEach((x) => {
        if (!x.count) return;
        const key = x.name.replace('vital_', '');
        if (key === 'cls') {
          v.cls = Math.round((x.sumValue / x.count) * 1000) / 1000;
        } else if (x.sumMs) {
          v[key] = Math.round(x.sumMs / x.count);
        }
      });
      if (Object.keys(v).length) vitals = v;
    }

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
      returning,
      outbound,
      navigation,
      vitals,
    });
  } catch (err) {
    console.error('[ga-report]', err);
    return res.status(500).json({
      error: 'ga_api',
      message: err.message || 'La requête GA4 a échoué.',
    });
  }
};
