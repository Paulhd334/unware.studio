// /api/analytics-data.js — Lecture des données depuis Neon
// Protégé par DASHBOARD_SECRET (variable d'env Vercel)

import { neon } from '@neondatabase/serverless';

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://unware.studio');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET')     return res.status(405).end();

    // ── Auth simple par secret ──
    const secret = req.headers['authorization']?.replace('Bearer ', '');
    if (!secret || secret !== process.env.DASHBOARD_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!process.env.POSTGRES_URL) {
        return res.status(500).json({ error: 'No POSTGRES_URL' });
    }

    const sql = neon(process.env.POSTGRES_URL);
    const { range = '7' } = req.query; // jours
    const days = Math.min(parseInt(range) || 7, 90);

    try {
        const [
            overview,
            topPages,
            eventBreakdown,
            scrollStats,
            timeStats,
            deviceBreakdown,
            vitalStats,
            recentEvents,
            dailyVisits,
            rageclicks,
            countryBreakdown,
            connectionBreakdown,
            liveVisitors
        ] = await Promise.all([

            // 1. Vue d'ensemble
            sql`
                SELECT
                    COUNT(*)                                            AS total_events,
                    COUNT(DISTINCT client_id)                          AS unique_visitors,
                    COUNT(DISTINCT session_id)                         AS total_sessions,
                    COUNT(*) FILTER (WHERE event_name = 'page_view')   AS pageviews,
                    COUNT(*) FILTER (WHERE event_name = 'page_exit')   AS exits,
                    COUNT(*) FILTER (WHERE event_name = 'rage_click')  AS rage_clicks,
                    COUNT(*) FILTER (WHERE event_name = 'js_error')    AS js_errors
                FROM events
                WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
            `,

            // 2. Pages les plus visitées
            sql`
                SELECT page_path, page_title, COUNT(*) AS views
                FROM events
                WHERE event_name = 'page_view'
                  AND created_at >= NOW() - INTERVAL '1 day' * ${days}
                GROUP BY page_path, page_title
                ORDER BY views DESC
                LIMIT 10
            `,

            // 3. Répartition des events
            sql`
                SELECT event_name, COUNT(*) AS count
                FROM events
                WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
                GROUP BY event_name
                ORDER BY count DESC
                LIMIT 20
            `,

            // 4. Scroll depth
            sql`
                SELECT event_name, COUNT(*) AS count
                FROM events
                WHERE event_name IN ('scroll_25','scroll_50','scroll_75','scroll_90','scroll_100')
                  AND created_at >= NOW() - INTERVAL '1 day' * ${days}
                GROUP BY event_name
                ORDER BY event_name
            `,

            // 5. Temps sur la page
            sql`
                SELECT event_name, COUNT(*) AS count
                FROM events
                WHERE event_name IN ('time_15s','time_30s','time_60s','time_120s','time_300s')
                  AND created_at >= NOW() - INTERVAL '1 day' * ${days}
                GROUP BY event_name
                ORDER BY event_name
            `,

            // 6. Répartition devices
            sql`
                SELECT device_type, COUNT(DISTINCT client_id) AS visitors
                FROM events
                WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
                  AND device_type IS NOT NULL
                GROUP BY device_type
                ORDER BY visitors DESC
            `,

            // 7. Web Vitals moyens
            sql`
                SELECT
                    event_name,
                    AVG((params->>'value_ms')::float)   AS avg_ms,
                    MIN((params->>'value_ms')::float)   AS min_ms,
                    MAX((params->>'value_ms')::float)   AS max_ms,
                    COUNT(*)                            AS samples
                FROM events
                WHERE event_name IN ('vital_lcp','vital_fcp','vital_ttfb','vital_inp')
                  AND created_at >= NOW() - INTERVAL '1 day' * ${days}
                  AND params->>'value_ms' IS NOT NULL
                GROUP BY event_name
            `,

            // 8. 20 derniers events — avec ip, country, city, os, browser, connection_type
            sql`
                SELECT
                    created_at,
                    event_name,
                    page_path,
                    device_type,
                    client_id,
                    ip_address,
                    COALESCE(params->>'country', geo_country)       AS country,
                    COALESCE(params->>'city',    geo_city)          AS city,
                    COALESCE(params->>'os',      os_name)           AS os,
                    COALESCE(params->>'browser', browser_name)      AS browser,
                    COALESCE(params->>'connection_type', conn_type) AS connection_type
                FROM events
                WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
                ORDER BY created_at DESC
                LIMIT 30
            `,

            // 9. Visites par jour
            sql`
                SELECT
                    DATE(created_at) AS day,
                    COUNT(*) FILTER (WHERE event_name = 'page_view') AS pageviews,
                    COUNT(DISTINCT client_id)                         AS visitors
                FROM events
                WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
                GROUP BY day
                ORDER BY day ASC
            `,

            // 10. Pages avec rage clicks
            sql`
                SELECT page_path, params->>'element' AS element, COUNT(*) AS count
                FROM events
                WHERE event_name = 'rage_click'
                  AND created_at >= NOW() - INTERVAL '1 day' * ${days}
                GROUP BY page_path, element
                ORDER BY count DESC
                LIMIT 10
            `,

            // 11. Répartition pays (geo)
            sql`
                SELECT
                    COALESCE(params->>'country', geo_country, 'Inconnu') AS country,
                    COALESCE(params->>'country_code', geo_country_code)  AS country_code,
                    COUNT(DISTINCT client_id) AS visitors
                FROM events
                WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
                GROUP BY country, country_code
                ORDER BY visitors DESC
                LIMIT 15
            `,

            // 12. Répartition type de connexion (wifi / cellular / ethernet)
            sql`
                SELECT
                    COALESCE(params->>'connection_type', conn_type, 'unknown') AS connection_type,
                    COUNT(DISTINCT client_id) AS visitors
                FROM events
                WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
                GROUP BY connection_type
                ORDER BY visitors DESC
            `,

            // 13. Visiteurs actifs — dernières 5 minutes
            sql`
                SELECT
                    client_id,
                    ip_address,
                    COALESCE(params->>'country', geo_country)       AS country,
                    COALESCE(params->>'country_code', geo_country_code) AS country_code,
                    COALESCE(params->>'city',    geo_city)          AS city,
                    COALESCE(params->>'os',      os_name)           AS os,
                    COALESCE(params->>'browser', browser_name)      AS browser,
                    COALESCE(params->>'connection_type', conn_type) AS connection_type,
                    device_type,
                    page_path,
                    MAX(created_at) AS last_seen
                FROM events
                WHERE created_at >= NOW() - INTERVAL '5 minutes'
                GROUP BY
                    client_id, ip_address,
                    country, country_code, city,
                    os, browser, connection_type,
                    device_type, page_path
                ORDER BY last_seen DESC
                LIMIT 20
            `
        ]);

        return res.status(200).json({
            range_days:         days,
            overview:           overview[0],
            top_pages:          topPages,
            events:             eventBreakdown,
            scroll:             scrollStats,
            time_on_page:       timeStats,
            devices:            deviceBreakdown,
            vitals:             vitalStats,
            recent:             recentEvents,
            daily:              dailyVisits,
            rage_clicks:        rageclicks,
            countries:          countryBreakdown,
            connections:        connectionBreakdown,
            live_visitors:      liveVisitors
        });

    } catch (err) {
        console.error('[analytics-data] DB error:', err.message);
        return res.status(500).json({ error: 'DB error', message: err.message });
    }
}
