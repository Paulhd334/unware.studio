// =============== GOOGLE ANALYTICS 4 - Version MAX DATA v3 ===============
// ✅ FIX SESSIONS (voir commentaires marqués "FIX SESSION")
const GA_MEASUREMENT_ID = 'G-NJLCB6G0G8';
let isGALoaded = false;
let isClarityLoaded = false;
let deviceType = 'desktop';
let clientId = null;
let cookiesRejected = false;
let pageCountIncremented = false; // ✅ FIX: évite double-incrément

// =============== DÉTECTION DU DEVICE ===============
function detectDeviceType() {
    const width = window.innerWidth;
    const ua = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|ipod/i.test(ua) || width <= 768) {
        return width <= 480 ? 'mobile' : 'tablet';
    }
    return 'desktop';
}

// =============== MAPPING DES PAGES ===============
function getPageTitle() {
    const path = window.location.pathname;
    const pageMap = {
        '/': 'UNWARE STUDIO',
        '/index.html': 'UNWARE STUDIO',
        '/nexa/fonctionnalites.html': 'Fonctionnalités NEXA',
        '/nexa/galerie.html': 'Galerie NEXA',
        '/nexa/nexa.html': 'NEXA',
        '/Support/FAQ.html': 'FAQ Support',
        '/Support/centre-aide.html': 'Centre aide',
        '/Support/contact.html': 'Contact',
        '/Support/statut.html': 'Statut services',
        '/legals/mentions-legales.html': 'Mentions légales',
        '/legals/conditions-utilisation.html': 'Conditions utilisation',
        '/legals/politique-confidentialite.html': 'Politique confidentialité',
        '/Support/Articles/article.configuration.html': 'Article de configuration',
        '/Support/Articles/feuille.route.nexa.html': 'Feuille de Routes',
        '/legals/politique-cookies.html': 'Politique cookies',
        '/pack-france.html': 'Pack France LSPDFR 2026',
        '/tiktok/tiktok.html': 'Pack France 2026 & Callouts LSPDFR'
    };
    return pageMap[path] || document.title || 'UNWARE STUDIO';
}

function getPagePath() {
    return window.location.pathname + window.location.search;
}

// =============== CLIENT ID PERSISTANT ===============
function getClientId() {
    if (!clientId) {
        clientId = localStorage.getItem('ga_client_id');
        if (!clientId) {
            clientId = 'cid_' + Math.random().toString(36).substr(2, 12) + '_' + Math.floor(Date.now() / 1000);
            localStorage.setItem('ga_client_id', clientId);
        }
    }
    return clientId;
}

// =============== SESSION ID PERSISTANT (résiste au F5) ===============
// ✅ FIX SESSION 1/4 : GA4 Measurement Protocol attend un session_id NUMÉRIQUE
// (convention : timestamp Unix en secondes du début de session). Une chaîne du type
// "session_ab3x9d2" n'est pas reconnue comme un identifiant de session valide par GA4,
// ce qui empêche le calcul de durée moyenne / taux d'engagement / taux de rebond.
// On garde aussi un flag `is_new` pour savoir si on doit envoyer un event `session_start`.
let sessionJustCreated = false;

function getSessionId() {
    const SESSION_DURATION = 30 * 60 * 1000;
    const now = Date.now();
    let sessionData = null;
    try {
        const raw = sessionStorage.getItem('ga_session');
        if (raw) sessionData = JSON.parse(raw);
    } catch(e) {}

    if (sessionData && (now - sessionData.last_activity) < SESSION_DURATION) {
        sessionData.last_activity = now;
        sessionStorage.setItem('ga_session', JSON.stringify(sessionData));
        sessionJustCreated = false;
        return sessionData.id;
    }

    const newSession = {
        id: String(Math.floor(now / 1000)), // ✅ FIX SESSION : timestamp en secondes, format attendu par GA4
        started_at: now,
        last_activity: now,
        page_count: 0
    };
    sessionStorage.setItem('ga_session', JSON.stringify(newSession));
    sessionJustCreated = true;
    console.log('🆕 Nouvelle session:', newSession.id);
    return newSession.id;
}

// ✅ FIX: incrément appelé une seule fois par page via pageCountIncremented
function incrementSessionPageCount() {
    if (pageCountIncremented) {
        try {
            const raw = sessionStorage.getItem('ga_session');
            if (raw) return JSON.parse(raw).page_count || 1;
        } catch(e) {}
        return 1;
    }
    pageCountIncremented = true;
    try {
        const raw = sessionStorage.getItem('ga_session');
        if (raw) {
            const s = JSON.parse(raw);
            s.page_count = (s.page_count || 0) + 1;
            sessionStorage.setItem('ga_session', JSON.stringify(s));
            return s.page_count;
        }
    } catch(e) {}
    return 1;
}

// =============== GESTION DES COOKIES ===============
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}

function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + "=" + value + ";expires=" + date.toUTCString() + ";path=/;SameSite=Lax;Secure";
}

function shouldLoadGA() {
    const consent = getCookie('cookieConsent');
    if (consent === 'rejected') { cookiesRejected = true; return false; }
    const analytics = getCookie('analyticsCookies');
    return consent && (consent === 'all' || (consent === 'custom' && analytics === 'true'));
}

function areCookiesRejected() {
    const consent = getCookie('cookieConsent');
    cookiesRejected = consent === 'rejected';
    return cookiesRejected;
}

// =============== RESET COMPLET DE L'ÉTAT ANALYTICS ===============
function resetAnalyticsState() {
    isGALoaded = false;
    isClarityLoaded = false;
    cookiesRejected = true;
    console.log('🔴 Analytics désactivé — consentement refusé');
}

// =============== DEBUG CONSOLE : ÉTAT DU CONSENTEMENT ===============
function logConsentStatus() {
    const consent = getCookie('cookieConsent');
    const analytics = getCookie('analyticsCookies');
    const performance = getCookie('performanceCookies');

    console.groupCollapsed('🍪 Analytics — État du consentement');
    if (!consent) {
        console.log('%c⏳ En attente de consentement cookies', 'color: orange; font-weight: bold;');
        console.log('   → GA non chargé, aucun tracker actif');
        console.log('   → La bannière cookies va s\'afficher');
    } else if (consent === 'rejected') {
        console.log('%c🔴 Cookies refusés', 'color: red; font-weight: bold;');
        console.log('   → GA bloqué, isGALoaded =', isGALoaded, '(doit être false)');
    } else if (consent === 'all') {
        console.log('%c✅ Tous les cookies acceptés', 'color: green; font-weight: bold;');
        console.log('   → GA actif, isGALoaded =', isGALoaded);
    } else if (consent === 'custom') {
        console.log('%c🟡 Consentement personnalisé', 'color: gold; font-weight: bold;');
        console.log('   → Analytics:', analytics === 'true' ? '✅ activé' : '❌ désactivé');
        console.log('   → Performance:', performance === 'true' ? '✅ activé' : '❌ désactivé');
    }
    console.log('   Page:', getPageTitle(), '|', getPagePath());
    console.groupEnd();
}

// =============== DONNÉES ENRICHIES ===============
function getEnrichedUserData() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
    const perf = performance.getEntriesByType('navigation')[0] || {};
    const params = new URLSearchParams(window.location.search);

    return {
        screen_width:        window.screen.width,
        screen_height:       window.screen.height,
        viewport_width:      window.innerWidth,
        viewport_height:     window.innerHeight,
        pixel_ratio:         window.devicePixelRatio || 1,
        color_depth:         window.screen.colorDepth,
        orientation:         screen.orientation?.type || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'),
        connection_type:     conn.effectiveType || 'unknown',
        connection_downlink: conn.downlink || null,
        connection_rtt:      conn.rtt || null,
        save_data:           conn.saveData || false,
        language:            navigator.language || 'unknown',
        languages:           (navigator.languages || []).join(','),
        platform:            navigator.platform || 'unknown',
        do_not_track:        navigator.doNotTrack === '1',
        online:              navigator.onLine,
        load_time_dns:       Math.round(perf.domainLookupEnd - perf.domainLookupStart) || 0,
        load_time_connect:   Math.round(perf.connectEnd - perf.connectStart) || 0,
        load_time_ttfb:      Math.round(perf.responseStart - perf.requestStart) || 0,
        load_time_dom:       Math.round(perf.domContentLoadedEventEnd - perf.startTime) || 0,
        load_time_total:     Math.round(perf.loadEventEnd - perf.startTime) || 0,
        session_page_count:  incrementSessionPageCount(),
        is_returning:        !!localStorage.getItem('ga_has_visited'),
        // ✅ FIX SESSION 2/4 : GA4 attend le nom exact "page_referrer" pour calculer
        // la provenance (sessionSourceMedium). "referrer"/"referrer_full" ne sont pas
        // reconnus et laissaient la section Provenance vide.
        page_referrer:       document.referrer || '',
        referrer:            document.referrer ? new URL(document.referrer).hostname : 'direct',
        referrer_full:       document.referrer || 'direct',
        utm_source:          params.get('utm_source') || null,
        utm_medium:          params.get('utm_medium') || null,
        utm_campaign:        params.get('utm_campaign') || null,
        utm_content:         params.get('utm_content') || null,
        utm_term:            params.get('utm_term') || null,
    };
}

function markVisit() {
    localStorage.setItem('ga_has_visited', '1');
}

// =============== API SÉCURISÉE VERCEL ===============
// ✅ FIX SESSION 3/4 : on force engagement_time_msec sur CHAQUE event (pas seulement
// page_view). Sans ça, GA4 ne compte pas le hit comme "engagé" et le taux
// d'engagement/rebond/durée moyenne restent à 0 même si des sessions existent.
async function sendToSecureAPI(eventName, params = {}) {
    if (areCookiesRejected() || cookiesRejected) return false;
    if (!shouldLoadGA()) return false;

    try {
        const payload = {
            client_id: getClientId(),
            user_id: getCookie('user_id') || null,
            timestamp_micros: Math.floor(Date.now() * 1000),
            events: [{
                name: eventName,
                params: {
                    page_title:            getPageTitle(),
                    page_location:         window.location.href,
                    page_path:             getPagePath(),
                    page_referrer:         document.referrer || '',
                    device_type:           deviceType,
                    session_id:            getSessionId(),
                    engagement_time_msec:  '1', // valeur par défaut, écrasée ci-dessous si fournie
                    ...params
                }
            }]
        };

        const response = await fetch('/api/ga-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
            mode: 'cors',
            credentials: 'omit'
        });

        if (response.ok) { console.log(`📡 [API] ${eventName}`); return true; }
        return false;
    } catch (error) {
        console.warn('⚠️ [API]', error);
        return false;
    }
}

// =============== INITIALISATION GA4 ===============
function initializeGoogleAnalytics() {
    if (areCookiesRejected() || !shouldLoadGA()) return;
    if (isGALoaded) return;

    console.log('🚀 Init GA4 MAX DATA v3...');
    console.log('📊 Analytics MAX DATA prêt — 16 trackers actifs');

    const enriched = getEnrichedUserData();
    const startingNewSession = sessionJustCreated; // capturé avant d'appeler getSessionId() à nouveau
    markVisit();

    // ✅ FIX SESSION 4/4 : on envoie un event `session_start` explicite au début
    // d'une nouvelle session, avec les paramètres de provenance (source/medium/campaign)
    // dans le format que GA4 Measurement Protocol attend pour l'acquisition de session.
    if (startingNewSession) {
        sendToSecureAPI('session_start', {
            engagement_time_msec: '1',
            source:   enriched.utm_source   || undefined,
            medium:   enriched.utm_medium   || undefined,
            campaign: enriched.utm_campaign || undefined,
            term:     enriched.utm_term     || undefined,
            content:  enriched.utm_content  || undefined,
            ...enriched
        });
    }

    sendToSecureAPI('page_view', { engagement_time_msec: '100', ...enriched });

    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, {
        page_title:           getPageTitle(),
        page_location:        window.location.href,
        page_path:            getPagePath(),
        device_type:          deviceType,
        anonymize_ip:         true,
        allow_google_signals: false,
        client_id:            getClientId(),
        session_id:           getSessionId(),
        user_properties: {
            device_type:       deviceType,
            screen_resolution: `${window.screen.width}x${window.screen.height}`,
            language:          navigator.language,
            connection_type:   (navigator.connection || {}).effectiveType || 'unknown',
            is_returning:      enriched.is_returning ? 'returning' : 'new'
        }
    });

    gtag('event', 'page_view', {
        page_title:      getPageTitle(),
        page_location:   window.location.href,
        page_path:       getPagePath(),
        device_type:     deviceType,
        load_time_total: enriched.load_time_total,
        connection_type: enriched.connection_type,
        is_returning:    enriched.is_returning
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.onload = () => { isGALoaded = true; initEventTracking(); };
    script.onerror = () => { isGALoaded = true; initEventTracking(); };
    document.head.appendChild(script);
}

// =============== TRACKING ÉVÉNEMENTS ===============
function initEventTracking() {
    if (areCookiesRejected()) return;
    console.log('🎯 Tracking MAX v3 activé...');

    document.addEventListener('click', (e) => {
        if (areCookiesRejected()) return;
        const clickedLink = e.target.closest('a[href]');
        if (clickedLink && clickedLink.href) {
            try { sessionStorage.setItem(NEXT_PAGE_KEY, clickedLink.href); } catch(err) {}
        }
        setTimeout(() => { trackClick(e.target); trackClickSecure(e.target); }, 50);
    }, { passive: true });

    document.addEventListener('submit', (e) => {
        if (areCookiesRejected()) return;
        trackFormSubmit(e.target);
        trackFormSubmitSecure(e.target);
    });

    trackScrollDepth();
    trackTimeOnPage();
    trackPageVisibility();
    trackRageClicks();
    trackCopyPaste();
    trackExternalLinks();
    trackJSErrors();
    trackWebVitals();
    trackInactivity();
    trackFirstEngagement();
    trackHover();
    trackPageNavigation();
}

// ── SCROLL DEPTH ──
function trackScrollDepth() {
    const milestones = [10, 25, 50, 75, 90, 100];
    const reached = new Set();
    window.addEventListener('scroll', () => {
        if (areCookiesRejected()) return;
        const total = document.documentElement.scrollHeight - window.innerHeight;
        if (total <= 0) return;
        const pct = Math.round((window.scrollY / total) * 100);
        milestones.forEach(m => {
            if (pct >= m && !reached.has(m)) {
                reached.add(m);
                const eventName = `scroll_${m}`;
                const d = { scroll_depth_pct: m, page_title: getPageTitle(), engagement_time_msec: '1000' };
                if (window.gtag) gtag('event', eventName, d);
                sendToSecureAPI(eventName, d);
                console.log(`📜 Scroll ${m}%`);
            }
        });
    }, { passive: true });
}

// ── TEMPS SUR LA PAGE ──
function trackTimeOnPage() {
    const milestones = [5, 15, 30, 60, 120, 300];
    const reached = new Set();
    const startTime = Date.now();

    const timer = setInterval(() => {
        if (areCookiesRejected()) { clearInterval(timer); return; }
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        milestones.forEach(m => {
            if (elapsed >= m && !reached.has(m)) {
                reached.add(m);
                const eventName = `time_${m}s`;
                const d = { seconds_on_page: m, page_title: getPageTitle(), engagement_time_msec: String(m * 1000) };
                if (window.gtag) gtag('event', eventName, d);
                sendToSecureAPI(eventName, d);
                console.log(`⏱️ ${m}s sur la page`);
            }
        });
    }, 3000);

    window.addEventListener('beforeunload', () => {
        if (areCookiesRejected()) return;
        const total = Math.round((Date.now() - startTime) / 1000);
        let nextPage = 'unknown';
        try { nextPage = sessionStorage.getItem(NEXT_PAGE_KEY) || 'unknown'; } catch(err) {}
        const d = {
            seconds_on_page: total,
            exit_page:       getPagePath(),
            next_page:       nextPage,
            page_title:      getPageTitle(),
            engagement_time_msec: String(Math.max(total, 1) * 1000)
        };
        sendToSecureAPI('page_exit', d);
        if (window.gtag) gtag('event', 'page_exit', d);
        try { sessionStorage.removeItem(NEXT_PAGE_KEY); } catch(err) {}
    });
}

// ── VISIBILITÉ PAGE ──
function trackPageVisibility() {
    let hiddenAt = null;
    document.addEventListener('visibilitychange', () => {
        if (areCookiesRejected()) return;
        if (document.hidden) {
            hiddenAt = Date.now();
            const d = { page_title: getPageTitle() };
            if (window.gtag) gtag('event', 'tab_hidden', d);
            sendToSecureAPI('tab_hidden', d);
        } else if (hiddenAt) {
            const away = Math.round((Date.now() - hiddenAt) / 1000);
            hiddenAt = null;
            const d = { away_seconds: away, page_title: getPageTitle() };
            if (window.gtag) gtag('event', 'tab_returned', d);
            sendToSecureAPI('tab_returned', d);
        }
    });
}

// ── RAGE CLICKS ──
function trackRageClicks() {
    let clicks = [];
    document.addEventListener('click', (e) => {
        if (areCookiesRejected()) return;
        const now = Date.now();
        clicks.push({ x: e.clientX, y: e.clientY, t: now });
        clicks = clicks.filter(c => now - c.t < 1000);
        if (clicks.length >= 3) {
            const dx = Math.max(...clicks.map(c => c.x)) - Math.min(...clicks.map(c => c.x));
            const dy = Math.max(...clicks.map(c => c.y)) - Math.min(...clicks.map(c => c.y));
            if (dx < 30 && dy < 30) {
                const el = e.target.tagName + (e.target.className ? '.' + [...e.target.classList].join('.') : '');
                const d = { element: el.substring(0, 100), page_title: getPageTitle() };
                if (window.gtag) gtag('event', 'rage_click', d);
                sendToSecureAPI('rage_click', d);
                console.log('😡 Rage click:', el);
                clicks = [];
            }
        }
    }, { passive: true });
}

// ── COPIER DU TEXTE ──
function trackCopyPaste() {
    document.addEventListener('copy', () => {
        if (areCookiesRejected()) return;
        const raw = window.getSelection()?.toString() || '';
        const length = raw.length;
        const d = { copied_length: length, page_title: getPageTitle() };
        if (window.gtag) gtag('event', 'text_copy', d);
        sendToSecureAPI('text_copy', d);
    });
}

// ── LIENS SORTANTS ──
function trackExternalLinks() {
    document.addEventListener('click', (e) => {
        if (areCookiesRejected()) return;
        const link = e.target.closest('a[href]');
        if (!link) return;
        const href = link.href || '';
        if (href && !href.includes(window.location.hostname) && href.startsWith('http')) {
            const trackName = link.getAttribute('data-track-name');
            let destination = 'other';
            if (href.includes('drive.google.com')) destination = 'google_drive';
            else if (href.includes('discord.gg') || href.includes('discord.com')) destination = 'discord';
            else if (href.includes('youtube.com') || href.includes('youtu.be')) destination = 'youtube';
            const d = {
                outbound_url:  href.substring(0, 200),
                destination:   destination,
                link_text:     link.textContent?.trim()?.substring(0, 50) || '',
                link_name:     trackName || '',
                page_title:    getPageTitle()
            };
            if (window.gtag) gtag('event', 'outbound_link', d);
            sendToSecureAPI('outbound_link', d);
            console.log('🔗 Lien sortant:', href);
        }
    }, { passive: true });
}

// ── ERREURS JAVASCRIPT ──
function trackJSErrors() {
    window.addEventListener('error', (e) => {
        if (areCookiesRejected()) return;
        const d = { error_message: e.message?.substring(0, 100) || 'unknown', error_file: e.filename?.substring(0, 100) || 'unknown', error_line: e.lineno || 0, page_title: getPageTitle() };
        if (window.gtag) gtag('event', 'js_error', d);
        sendToSecureAPI('js_error', d);
    });
    window.addEventListener('unhandledrejection', (e) => {
        if (areCookiesRejected()) return;
        const d = { error_message: (e.reason?.message || String(e.reason))?.substring(0, 100), error_type: 'promise_rejected', page_title: getPageTitle() };
        if (window.gtag) gtag('event', 'js_error', d);
        sendToSecureAPI('js_error', d);
    });
}

// ── WEB VITALS ──
function trackWebVitals() {
    try {
        new PerformanceObserver((list) => {
            const last = list.getEntries().at(-1);
            const d = { value_ms: Math.round(last.startTime), page_title: getPageTitle() };
            if (window.gtag) gtag('event', 'vital_lcp', d);
            sendToSecureAPI('vital_lcp', d);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch(e) {}

    try {
        let clsValue = 0;
        new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => { if (!entry.hadRecentInput) clsValue += entry.value; });
        }).observe({ type: 'layout-shift', buffered: true });
        window.addEventListener('beforeunload', () => {
            const d = { value: Math.round(clsValue * 1000) / 1000, page_title: getPageTitle() };
            if (window.gtag) gtag('event', 'vital_cls', d);
            sendToSecureAPI('vital_cls', d);
        });
    } catch(e) {}

    try {
        new PerformanceObserver((list) => {
            const entry = list.getEntries().find(e => e.name === 'first-contentful-paint');
            if (entry) {
                const d = { value_ms: Math.round(entry.startTime), page_title: getPageTitle() };
                if (window.gtag) gtag('event', 'vital_fcp', d);
                sendToSecureAPI('vital_fcp', d);
            }
        }).observe({ type: 'paint', buffered: true });
    } catch(e) {}

    try {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav) {
            const ttfb = Math.round(nav.responseStart - nav.requestStart);
            setTimeout(() => {
                const d = { value_ms: ttfb, page_title: getPageTitle() };
                if (window.gtag) gtag('event', 'vital_ttfb', d);
                sendToSecureAPI('vital_ttfb', d);
            }, 2000);
        }
    } catch(e) {}

    try {
        let worstINP = 0;
        let worstINPName = '';
        new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
                if (entry.duration > worstINP) {
                    worstINP = entry.duration;
                    worstINPName = entry.name;
                }
            });
        }).observe({ type: 'event', durationThreshold: 40, buffered: true });

        window.addEventListener('beforeunload', () => {
            if (worstINP > 0 && !areCookiesRejected()) {
                const d = { value_ms: Math.round(worstINP), interaction: worstINPName, page_title: getPageTitle() };
                if (window.gtag) gtag('event', 'vital_inp', d);
                sendToSecureAPI('vital_inp', d);
            }
        });
    } catch(e) {}
}

// ── INACTIVITÉ ──
function trackInactivity() {
    let inactiveTimer;
    let inactiveReported = false;
    const THRESHOLD = 3 * 60 * 1000;

    function resetTimer() {
        if (inactiveReported) {
            inactiveReported = false;
            const d = { page_title: getPageTitle() };
            if (window.gtag) gtag('event', 'user_returned', d);
            sendToSecureAPI('user_returned', d);
        }
        clearTimeout(inactiveTimer);
        inactiveTimer = setTimeout(() => {
            if (areCookiesRejected()) return;
            inactiveReported = true;
            const d = { page_title: getPageTitle() };
            if (window.gtag) gtag('event', 'user_inactive', d);
            sendToSecureAPI('user_inactive', d);
            console.log('💤 Inactif');
        }, THRESHOLD);
    }

    ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach(evt => {
        window.addEventListener(evt, resetTimer, { passive: true });
    });
    resetTimer();
}

// ── PREMIER ENGAGEMENT ──
function trackFirstEngagement() {
    let done = false;
    function onFirst(e) {
        if (done || areCookiesRejected()) return;
        done = true;
        const t = Math.round((Date.now() - performance.timeOrigin) / 1000);
        const d = { seconds_to_engage: t, interaction_type: e.type, page_title: getPageTitle(), engagement_time_msec: String(Math.max(t,1) * 1000) };
        if (window.gtag) gtag('event', 'first_engagement', d);
        sendToSecureAPI('first_engagement', d);
        console.log(`👆 Premier engagement: ${t}s (${e.type})`);
        ['click','scroll','keydown','touchstart'].forEach(t => window.removeEventListener(t, onFirst));
    }
    ['click','scroll','keydown','touchstart'].forEach(t => {
        window.addEventListener(t, onFirst, { passive: true });
    });
}

// ── HOVER SUR ÉLÉMENTS CLÉS ──
function trackHover() {
    const selectorMap = {
        'a[href]':        'hover_link',
        'button':         'hover_button',
        '.btn':           'hover_btn',
        '.gallery-card':  'hover_gallery_card',
        '.video-card':    'hover_video_card',
        '.nav-links a':   'hover_nav'
    };
    const hovered = new Set();

    function attachHoverTo(el, eventName) {
        if (el._hoverTracked) return;
        el._hoverTracked = true;
        el.addEventListener('mouseenter', () => {
            if (areCookiesRejected()) return;
            const key = eventName + '_' + (el.textContent?.trim()?.substring(0, 30) || el.id || Math.random());
            if (hovered.has(key)) return;
            hovered.add(key);
            const d = {
                element_text: el.textContent?.trim()?.substring(0, 50) || el.getAttribute('aria-label') || '',
                element_href: el.href || '',
                page_title:   getPageTitle()
            };
            if (window.gtag) gtag('event', eventName, d);
            sendToSecureAPI(eventName, d);
        }, { passive: true });
    }

    function scanAndAttach() {
        Object.entries(selectorMap).forEach(([sel, eventName]) => {
            document.querySelectorAll(sel).forEach(el => attachHoverTo(el, eventName));
        });
    }

    scanAndAttach();

    const observer = new MutationObserver(() => scanAndAttach());
    observer.observe(document.body, { childList: true, subtree: true });
}

// ── TRACKING CLICS ──
function trackClick(element) {
    if (areCookiesRejected() || !window.gtag || !element) return;
    const el = element.closest('a, button, .btn');
    if (!el) return;
    const text = el.textContent?.trim()?.substring(0, 100) || el.getAttribute('aria-label') || 'unknown';
    const trackName = el.getAttribute('data-track-name');
    gtag('event', trackName ? 'cta_click' : 'click', {
        event_category:  'engagement',
        event_label:     trackName || text,
        element_type:    el.tagName.toLowerCase(),
        element_href:    el.href || '',
        page_title:      getPageTitle()
    });
}

function trackClickSecure(element) {
    if (areCookiesRejected()) return;
    const el = element.closest('a, button, .btn');
    if (!el) return;
    const text = el.textContent?.trim()?.substring(0, 100) || el.getAttribute('aria-label') || 'unknown';
    const trackName = el.getAttribute('data-track-name');
    sendToSecureAPI(trackName ? 'cta_click' : 'click', {
        event_category:       'engagement',
        event_label:          trackName || text,
        element_type:         el.tagName.toLowerCase(),
        element_href:         el.href || '',
        engagement_time_msec: '50'
    });
}

function trackFormSubmit(form) {
    if (areCookiesRejected() || !window.gtag) return;
    gtag('event', 'form_submit', { event_category: 'form', event_label: form.id || 'form_submit', form_id: form.id || 'unknown', page_title: getPageTitle() });
}

function trackFormSubmitSecure(form) {
    if (areCookiesRejected()) return;
    sendToSecureAPI('form_submit', { event_category: 'form', event_label: form.id || 'form_submit', form_id: form.id || 'unknown', engagement_time_msec: '100' });
}

// =============== NAVIGATION INTER-PAGES ===============
const NAV_HISTORY_KEY  = 'ga_nav_history';
const NAV_ENTER_KEY    = 'ga_page_enter_time';
const NEXT_PAGE_KEY    = 'ga_next_intended_page';
const NAV_MAX_HISTORY  = 20;

function getNavigationHistory() {
    try {
        return JSON.parse(localStorage.getItem(NAV_HISTORY_KEY) || '[]');
    } catch(e) {
        return [];
    }
}

function saveNavigationHistory(history) {
    try {
        localStorage.setItem(NAV_HISTORY_KEY, JSON.stringify(history.slice(-NAV_MAX_HISTORY)));
    } catch(e) {}
}

function recordPageEnter() {
    sessionStorage.setItem(NAV_ENTER_KEY, String(Date.now()));
}

function getTimeSpentOnCurrentPage() {
    const entered = parseInt(sessionStorage.getItem(NAV_ENTER_KEY) || '0', 10);
    return entered ? Math.round((Date.now() - entered) / 1000) : 0;
}

function getPreviousPage() {
    const history = getNavigationHistory();
    return history.length > 0 ? history[history.length - 1] : null;
}

function pushPageToHistory(path, title) {
    const history = getNavigationHistory();
    history.push({ path, title, visited_at: Date.now() });
    saveNavigationHistory(history);
}

function trackPageNavigation() {
    const currentPath  = getPagePath();
    const currentTitle = getPageTitle();
    const previous     = getPreviousPage();

    const navEntry = performance.getEntriesByType('navigation')[0];
    const navType  = navEntry?.type || 'navigate';

    if (previous && previous.path !== currentPath) {
        const timeSpent = getTimeSpentOnCurrentPage();
        const d = {
            from_page:      previous.path,
            from_title:     previous.title,
            to_page:        currentPath,
            to_title:       currentTitle,
            nav_type:       navType,
            time_on_prev:   timeSpent,
            session_depth:  getNavigationHistory().length + 1,
        };
        if (window.gtag) gtag('event', 'page_navigation', d);
        sendToSecureAPI('page_navigation', d);
        console.log(`🗺️ Navigation: ${previous.path} → ${currentPath} (${timeSpent}s)`);
    } else if (!previous) {
        const d = {
            from_page:     document.referrer ? new URL(document.referrer).hostname : 'direct',
            from_title:    document.referrer ? 'external' : 'direct',
            to_page:       currentPath,
            to_title:      currentTitle,
            nav_type:      navType,
            time_on_prev:  0,
            session_depth: 1,
        };
        if (window.gtag) gtag('event', 'page_navigation', d);
        sendToSecureAPI('page_navigation', d);
        console.log(`🚪 Entrée: ${d.from_page} → ${currentPath}`);
    }

    pushPageToHistory(currentPath, currentTitle);
    recordPageEnter();

    ['pushState', 'replaceState'].forEach(method => {
        const original = history[method];
        history[method] = function(...args) {
            const result = original.apply(this, args);
            window.dispatchEvent(new Event('locationchange'));
            return result;
        };
    });
    window.addEventListener('popstate',      () => window.dispatchEvent(new Event('locationchange')));
    window.addEventListener('locationchange', onSPANavigation);
}

function onSPANavigation() {
    if (areCookiesRejected()) return;

    const newPath  = getPagePath();
    const newTitle = getPageTitle();
    const previous = getPreviousPage();

    if (previous && previous.path === newPath) return;

    const timeSpent = getTimeSpentOnCurrentPage();

    const d = {
        from_page:     previous?.path  || 'unknown',
        from_title:    previous?.title || 'unknown',
        to_page:       newPath,
        to_title:      newTitle,
        nav_type:      'spa',
        time_on_prev:  timeSpent,
        session_depth: getNavigationHistory().length + 1,
    };

    if (window.gtag) {
        gtag('config', GA_MEASUREMENT_ID, { page_title: newTitle, page_location: window.location.href, page_path: newPath });
        gtag('event', 'page_navigation', d);
        gtag('event', 'page_view', { page_title: newTitle, page_location: window.location.href, page_path: newPath });
    }
    sendToSecureAPI('page_navigation', d);
    sendToSecureAPI('page_view', { page_title: newTitle, page_path: newPath, engagement_time_msec: '100' });

    pushPageToHistory(newPath, newTitle);
    recordPageEnter();

    console.log(`🔄 SPA Navigation: ${previous?.path} → ${newPath} (${timeSpent}s)`);
}

// =============== COOKIES UI ===============
function showCookieBanner() {
    const banner = document.getElementById('custom-cookie-banner');
    const consent = getCookie('cookieConsent');
    if (consent) return;
    if (banner) {
        banner.classList.remove('hiding');
        banner.style.display = 'block';
        setTimeout(() => banner.classList.add('show'), 10);
    }
}

function hideCookieBanner() {
    const banner = document.getElementById('custom-cookie-banner');
    if (banner) {
        banner.classList.add('hiding');
        setTimeout(() => {
            banner.classList.remove('show');
            banner.classList.remove('hiding');
            banner.style.display = 'none';
        }, 400);
    }
}

function showCookieSettings() {
    const modal = document.getElementById('cookieModal');
    if (modal) {
        modal.classList.add('show');
        const analytics = getCookie('analyticsCookies');
        const perf = getCookie('performanceCookies');
        const aEl = document.getElementById('analyticsCookies');
        const pEl = document.getElementById('performanceCookies');
        if (aEl) aEl.checked = analytics === 'true';
        if (pEl) pEl.checked = perf === 'true';
        hideCookieBanner();
    }
}

function hideCookieSettings() {
    const modal = document.getElementById('cookieModal');
    if (modal) modal.classList.remove('show');
    const consent = getCookie('cookieConsent');
    if (!consent) setTimeout(showCookieBanner, 500);
}

// =============== DISPATCH CONSENTEMENT ===============
function dispatchConsentEvent(consent, analytics) {
    document.dispatchEvent(new CustomEvent('cookieConsentChanged', {
        detail: { consent, analytics }
    }));
}

// =============== FONCTIONS GLOBALES COOKIES ===============
function acceptCookies() {
    setCookie('cookieConsent', 'all', 365);
    setCookie('analyticsCookies', 'true', 365);
    setCookie('performanceCookies', 'true', 365);
    cookiesRejected = false;
    hideCookieBanner();
    dispatchConsentEvent('all', 'true');
    setTimeout(() => initializeGoogleAnalytics(), 100);
}

function rejectCookies() {
    setCookie('cookieConsent', 'rejected', 365);
    setCookie('analyticsCookies', 'false', 365);
    setCookie('performanceCookies', 'false', 365);
    resetAnalyticsState();
    dispatchConsentEvent('rejected', 'false');
    hideCookieBanner();
}

function saveCookiePreferences() {
    const analyticsChecked = document.getElementById('analyticsCookies')?.checked;
    const performanceChecked = document.getElementById('performanceCookies')?.checked;
    setCookie('cookieConsent', 'custom', 365);
    setCookie('analyticsCookies', analyticsChecked ? 'true' : 'false', 365);
    setCookie('performanceCookies', performanceChecked ? 'true' : 'false', 365);
    if (!analyticsChecked) {
        resetAnalyticsState();
    } else {
        cookiesRejected = false;
        setTimeout(() => initializeGoogleAnalytics(), 100);
    }
    dispatchConsentEvent('custom', analyticsChecked ? 'true' : 'false');
    hideCookieSettings();
    hideCookieBanner();
}

// =============== INIT PRINCIPALE ===============
function initAnalytics() {
    deviceType = detectDeviceType();
    logConsentStatus();

    const consent = getCookie('cookieConsent');

    if (!consent) {
        console.log('⏳ Analytics en attente de consentement...');
        setTimeout(showCookieBanner, 1500);
        return;
    }

    if (areCookiesRejected()) {
        isGALoaded = false;
        return;
    }

    if (shouldLoadGA()) {
        setTimeout(() => initializeGoogleAnalytics(), 300);
    }
}

document.addEventListener('DOMContentLoaded', initAnalytics);

// =============== DEBUG CONSOLE ===============
window.debugGA = {
    check: function() {
        console.log('🔍 GA MAX DATA v3:');
        console.log('- Cookies refusés :', areCookiesRejected());
        console.log('- GA Loaded       :', isGALoaded);
        console.log('- cookieConsent   :', getCookie('cookieConsent'));
        console.log('- analyticsCookies:', getCookie('analyticsCookies'));
        console.log('- Client ID       :', getClientId());
        console.log('- Session ID      :', getSessionId());
        console.log('- Device          :', deviceType);
        console.log('- Page            :', getPageTitle());
        console.log('- Enriched data   :', getEnrichedUserData());
    },
    test: function() {
        if (areCookiesRejected()) { console.log('⛔ Cookies refusés'); return; }
        if (window.gtag) { gtag('event', 'debug_test', { test: 'ok' }); console.log('✅ gtag OK'); }
        sendToSecureAPI('debug_test', { test: 'api' }).then(s => console.log(s ? '✅ API OK' : '❌ API KO'));
    },
    force:   () => { if (!areCookiesRejected()) initializeGoogleAnalytics(); },
    apiTest: () => areCookiesRejected() ? Promise.resolve(false) : sendToSecureAPI('api_test', { test: 'direct' }),
    status:  () => logConsentStatus(),

    navHistory: function() {
        const h = getNavigationHistory();
        console.groupCollapsed(`🗺️ Historique navigation (${h.length} pages)`);
        h.forEach((p, i) => {
            const ago = Math.round((Date.now() - p.visited_at) / 1000);
            console.log(`  ${i + 1}. ${p.title} — ${p.path} (il y a ${ago}s)`);
        });
        console.groupEnd();
        return h;
    },
    clearNavHistory: function() {
        localStorage.removeItem(NAV_HISTORY_KEY);
        sessionStorage.removeItem(NAV_ENTER_KEY);
        console.log('🗑️ Historique navigation effacé');
    },

    reset: function() {
        document.cookie.split(";").forEach(c => {
            const name = c.split("=")[0].trim();
            if (['cookieConsent','analyticsCookies','performanceCookies'].some(n => name.includes(n))) {
                document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            }
        });
        cookiesRejected = false;
        isGALoaded = false;
        location.reload();
    }
};
