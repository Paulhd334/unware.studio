// =============== GOOGLE ANALYTICS 4 - Version MAX DATA ===============
const GA_MEASUREMENT_ID = 'G-NJLCB6G0G8';
let isGALoaded = false;
let deviceType = 'desktop';
let clientId = null;
let cookiesRejected = false;

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
        '/legals/politique-cookies.html': 'Politique cookies'
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
        return sessionData.id;
    }

    const newSession = {
        id: 'session_' + Math.random().toString(36).substr(2, 9),
        started_at: now,
        last_activity: now,
        page_count: 0
    };
    sessionStorage.setItem('ga_session', JSON.stringify(newSession));
    console.log('🆕 Nouvelle session:', newSession.id);
    return newSession.id;
}

function incrementSessionPageCount() {
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

// =============== DONNÉES ENRICHIES ===============
function getEnrichedUserData() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
    const perf = performance.getEntriesByType('navigation')[0] || {};
    const params = new URLSearchParams(window.location.search);

    return {
        // Écran & viewport
        screen_width:       window.screen.width,
        screen_height:      window.screen.height,
        viewport_width:     window.innerWidth,
        viewport_height:    window.innerHeight,
        pixel_ratio:        window.devicePixelRatio || 1,
        color_depth:        window.screen.colorDepth,
        orientation:        screen.orientation?.type || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'),

        // Réseau
        connection_type:     conn.effectiveType || 'unknown',
        connection_downlink: conn.downlink || null,
        connection_rtt:      conn.rtt || null,
        save_data:           conn.saveData || false,

        // Navigateur
        language:       navigator.language || 'unknown',
        languages:      (navigator.languages || []).join(','),
        platform:       navigator.platform || 'unknown',
        do_not_track:   navigator.doNotTrack === '1',
        online:         navigator.onLine,

        // Perf chargement (ms)
        load_time_dns:     Math.round(perf.domainLookupEnd - perf.domainLookupStart) || 0,
        load_time_connect: Math.round(perf.connectEnd - perf.connectStart) || 0,
        load_time_ttfb:    Math.round(perf.responseStart - perf.requestStart) || 0,
        load_time_dom:     Math.round(perf.domContentLoadedEventEnd - perf.startTime) || 0,
        load_time_total:   Math.round(perf.loadEventEnd - perf.startTime) || 0,

        // Session
        session_page_count: incrementSessionPageCount(),
        is_returning:       !!localStorage.getItem('ga_has_visited'),

        // Traffic source
        referrer:      document.referrer ? new URL(document.referrer).hostname : 'direct',
        referrer_full: document.referrer || 'direct',
        utm_source:    params.get('utm_source') || null,
        utm_medium:    params.get('utm_medium') || null,
        utm_campaign:  params.get('utm_campaign') || null,
        utm_content:   params.get('utm_content') || null,
        utm_term:      params.get('utm_term') || null,
    };
}

function markVisit() {
    localStorage.setItem('ga_has_visited', '1');
}

// =============== API SÉCURISÉE VERCEL ===============
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
                    page_title:    getPageTitle(),
                    page_location: window.location.href,
                    page_path:     getPagePath(),
                    device_type:   deviceType,
                    session_id:    getSessionId(),
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
    if (areCookiesRejected() || isGALoaded || !shouldLoadGA()) return;
    console.log('🚀 Init GA4 MAX DATA...');

    const enriched = getEnrichedUserData();
    markVisit();

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
        page_title:        getPageTitle(),
        page_location:     window.location.href,
        page_path:         getPagePath(),
        device_type:       deviceType,
        load_time_total:   enriched.load_time_total,
        connection_type:   enriched.connection_type,
        is_returning:      enriched.is_returning
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
    console.log('🎯 Tracking MAX activé...');

    // Clics & formulaires
    document.addEventListener('click', (e) => {
        if (areCookiesRejected()) return;
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
}

// ── SCROLL DEPTH ──
function trackScrollDepth() {
    const milestones = [25, 50, 75, 90, 100];
    const reached = new Set();
    window.addEventListener('scroll', () => {
        if (areCookiesRejected()) return;
        const total = document.documentElement.scrollHeight - window.innerHeight;
        if (total <= 0) return;
        const pct = Math.round((window.scrollY / total) * 100);
        milestones.forEach(m => {
            if (pct >= m && !reached.has(m)) {
                reached.add(m);
                const d = { scroll_depth: m, page_title: getPageTitle() };
                if (window.gtag) gtag('event', 'scroll_depth', d);
                sendToSecureAPI('scroll_depth', d);
                console.log(`📜 Scroll ${m}%`);
            }
        });
    }, { passive: true });
}

// ── TEMPS SUR LA PAGE ──
function trackTimeOnPage() {
    const milestones = [15, 30, 60, 120, 300];
    const reached = new Set();
    const startTime = Date.now();

    const timer = setInterval(() => {
        if (areCookiesRejected()) { clearInterval(timer); return; }
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        milestones.forEach(m => {
            if (elapsed >= m && !reached.has(m)) {
                reached.add(m);
                const d = { time_on_page_seconds: m, page_title: getPageTitle() };
                if (window.gtag) gtag('event', 'time_on_page', d);
                sendToSecureAPI('time_on_page', d);
                console.log(`⏱️ ${m}s sur la page`);
            }
        });
    }, 5000);

    window.addEventListener('beforeunload', () => {
        if (areCookiesRejected()) return;
        const total = Math.round((Date.now() - startTime) / 1000);
        const d = { time_on_page_seconds: total, exit_page: getPagePath(), page_title: getPageTitle() };
        sendToSecureAPI('page_exit', d);
        if (window.gtag) gtag('event', 'page_exit', d);
    });
}

// ── VISIBILITÉ PAGE (onglet actif/inactif) ──
function trackPageVisibility() {
    let hiddenAt = null;
    document.addEventListener('visibilitychange', () => {
        if (areCookiesRejected()) return;
        if (document.hidden) {
            hiddenAt = Date.now();
            const d = { action: 'tab_hidden', page_title: getPageTitle() };
            if (window.gtag) gtag('event', 'tab_visibility', d);
            sendToSecureAPI('tab_visibility', d);
        } else if (hiddenAt) {
            const away = Math.round((Date.now() - hiddenAt) / 1000);
            hiddenAt = null;
            const d = { action: 'tab_visible', away_seconds: away, page_title: getPageTitle() };
            if (window.gtag) gtag('event', 'tab_visibility', d);
            sendToSecureAPI('tab_visibility', d);
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
        const selected = window.getSelection()?.toString()?.substring(0, 100) || '';
        const d = { copied_text: selected, page_title: getPageTitle() };
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
            const d = { outbound_url: href.substring(0, 200), link_text: link.textContent?.trim()?.substring(0, 50) || '', page_title: getPageTitle() };
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
        const d = { error_message: (e.reason?.message || String(e.reason))?.substring(0, 100), error_type: 'unhandled_promise', page_title: getPageTitle() };
        if (window.gtag) gtag('event', 'js_error', d);
        sendToSecureAPI('js_error', d);
    });
}

// ── WEB VITALS (LCP, CLS, FCP, TTFB) ──
function trackWebVitals() {
    // LCP
    try {
        new PerformanceObserver((list) => {
            const last = list.getEntries().at(-1);
            const d = { metric_name: 'LCP', metric_value: Math.round(last.startTime), page_title: getPageTitle() };
            if (window.gtag) gtag('event', 'web_vital', d);
            sendToSecureAPI('web_vital', d);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch(e) {}

    // CLS
    try {
        let clsValue = 0;
        new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => { if (!entry.hadRecentInput) clsValue += entry.value; });
        }).observe({ type: 'layout-shift', buffered: true });
        window.addEventListener('beforeunload', () => {
            const d = { metric_name: 'CLS', metric_value: Math.round(clsValue * 1000) / 1000, page_title: getPageTitle() };
            if (window.gtag) gtag('event', 'web_vital', d);
            sendToSecureAPI('web_vital', d);
        });
    } catch(e) {}

    // FCP
    try {
        new PerformanceObserver((list) => {
            const entry = list.getEntries().find(e => e.name === 'first-contentful-paint');
            if (entry) {
                const d = { metric_name: 'FCP', metric_value: Math.round(entry.startTime), page_title: getPageTitle() };
                if (window.gtag) gtag('event', 'web_vital', d);
                sendToSecureAPI('web_vital', d);
            }
        }).observe({ type: 'paint', buffered: true });
    } catch(e) {}

    // TTFB
    try {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav) {
            const ttfb = Math.round(nav.responseStart - nav.requestStart);
            setTimeout(() => {
                const d = { metric_name: 'TTFB', metric_value: ttfb, page_title: getPageTitle() };
                if (window.gtag) gtag('event', 'web_vital', d);
                sendToSecureAPI('web_vital', d);
            }, 2000);
        }
    } catch(e) {}
}

// ── INACTIVITÉ (3 min sans interaction) ──
function trackInactivity() {
    let inactiveTimer;
    let inactiveReported = false;
    const THRESHOLD = 3 * 60 * 1000;

    function resetTimer() {
        if (inactiveReported) {
            inactiveReported = false;
            const d = { action: 'returned_active', page_title: getPageTitle() };
            if (window.gtag) gtag('event', 'user_activity', d);
            sendToSecureAPI('user_activity', d);
        }
        clearTimeout(inactiveTimer);
        inactiveTimer = setTimeout(() => {
            if (areCookiesRejected()) return;
            inactiveReported = true;
            const d = { action: 'inactive_3min', page_title: getPageTitle() };
            if (window.gtag) gtag('event', 'user_activity', d);
            sendToSecureAPI('user_activity', d);
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
        const d = { time_to_first_engagement_seconds: t, interaction_type: e.type, page_title: getPageTitle() };
        if (window.gtag) gtag('event', 'first_engagement', d);
        sendToSecureAPI('first_engagement', d);
        console.log(`👆 Premier engagement: ${t}s (${e.type})`);
        ['click','scroll','keydown','touchstart'].forEach(t => window.removeEventListener(t, onFirst));
    }
    ['click','scroll','keydown','touchstart'].forEach(t => {
        window.addEventListener(t, onFirst, { passive: true });
    });
}

// ── HOVER SUR ÉLÉMENTS CLÉS (une seule fois par élément) ──
function trackHover() {
    const selectors = ['a[href]', 'button', '.btn', '.gallery-card', '.nav-links a'];
    const hovered = new Set();
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            el.addEventListener('mouseenter', () => {
                if (areCookiesRejected()) return;
                const key = sel + '_' + (el.textContent?.trim()?.substring(0, 30) || el.id || Math.random());
                if (hovered.has(key)) return;
                hovered.add(key);
                const d = {
                    element_type: sel,
                    element_text: el.textContent?.trim()?.substring(0, 50) || el.getAttribute('aria-label') || '',
                    element_href: el.href || '',
                    page_title: getPageTitle()
                };
                if (window.gtag) gtag('event', 'element_hover', d);
                sendToSecureAPI('element_hover', d);
            }, { passive: true });
        });
    });
}

// ── TRACKING CLICS ──
function trackClick(element) {
    if (areCookiesRejected() || !window.gtag || !element) return;
    const el = element.closest('a, button, .btn');
    if (!el) return;
    const text = el.textContent?.trim()?.substring(0, 100) || el.getAttribute('aria-label') || 'unknown';
    gtag('event', 'click', { event_category: 'engagement', event_label: text, element_type: el.tagName.toLowerCase(), page_title: getPageTitle() });
}

function trackClickSecure(element) {
    if (areCookiesRejected()) return;
    const el = element.closest('a, button, .btn');
    if (!el) return;
    const text = el.textContent?.trim()?.substring(0, 100) || el.getAttribute('aria-label') || 'unknown';
    sendToSecureAPI('click', { event_category: 'engagement', event_label: text, element_type: el.tagName.toLowerCase(), engagement_time_msec: '50' });
}

function trackFormSubmit(form) {
    if (areCookiesRejected() || !window.gtag) return;
    gtag('event', 'form_submit', { event_category: 'form', event_label: form.id || 'form_submit', form_id: form.id || 'unknown', page_title: getPageTitle() });
}

function trackFormSubmitSecure(form) {
    if (areCookiesRejected()) return;
    sendToSecureAPI('form_submit', { event_category: 'form', event_label: form.id || 'form_submit', form_id: form.id || 'unknown', engagement_time_msec: '100' });
}

// =============== COOKIES UI ===============
function attachCookieEvents() {
    document.addEventListener('click', function(e) {
        const t = e.target;
        if (t.closest('.cookie-btn.accept')) setTimeout(() => initializeGoogleAnalytics(), 100);
        if (t.closest('.cookie-btn.reject')) cookiesRejected = true;
        if (t.closest('.modal-btn.save') && document.getElementById('analyticsCookies')?.checked) setTimeout(() => initializeGoogleAnalytics(), 100);
    });
}

function showCookieBanner() {
    const banner = document.getElementById('custom-cookie-banner');
    const consent = getCookie('cookieConsent');
    if (consent === 'rejected' || consent) return;
    if (banner) { banner.style.display = 'block'; setTimeout(() => banner.classList.add('show'), 10); }
}

function hideCookieBanner() {
    const banner = document.getElementById('custom-cookie-banner');
    if (banner) { banner.classList.remove('show'); setTimeout(() => { banner.style.display = 'none'; }, 400); }
}

// =============== INIT PRINCIPALE ===============
function initAnalytics() {
    console.log('🌐 Analytics MAX DATA démarrage...');
    deviceType = detectDeviceType();
    if (areCookiesRejected()) { isGALoaded = false; return; }
    attachCookieEvents();
    if (shouldLoadGA()) {
        setTimeout(() => initializeGoogleAnalytics(), 300);
    } else {
        if (!areCookiesRejected()) setTimeout(showCookieBanner, 1500);
    }
}

document.addEventListener('DOMContentLoaded', initAnalytics);

// =============== FONCTIONS GLOBALES COOKIES ===============
function acceptCookies() {
    setCookie('cookieConsent', 'all', 365);
    setCookie('analyticsCookies', 'true', 365);
    setCookie('performanceCookies', 'true', 365);
    hideCookieBanner();
    setTimeout(() => initializeGoogleAnalytics(), 100);
}

function rejectCookies() {
    setCookie('cookieConsent', 'rejected', 365);
    setCookie('analyticsCookies', 'false', 365);
    setCookie('performanceCookies', 'false', 365);
    cookiesRejected = true;
    hideCookieBanner();
}

function saveCookiePreferences() {
    const analyticsChecked = document.getElementById('analyticsCookies')?.checked;
    const performanceChecked = document.getElementById('performanceCookies')?.checked;
    setCookie('cookieConsent', 'custom', 365);
    setCookie('analyticsCookies', analyticsChecked ? 'true' : 'false', 365);
    setCookie('performanceCookies', performanceChecked ? 'true' : 'false', 365);
    if (analyticsChecked) setTimeout(() => initializeGoogleAnalytics(), 100);
    hideCookieSettings();
    hideCookieBanner();
}

function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + "=" + value + ";expires=" + date.toUTCString() + ";path=/;SameSite=Lax;Secure";
}

// =============== DEBUG ===============
window.debugGA = {
    check: function() {
        console.log('🔍 GA MAX DATA:');
        console.log('- Cookies refusés :', areCookiesRejected());
        console.log('- GA Loaded       :', isGALoaded);
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
    reset: function() {
        document.cookie.split(";").forEach(c => {
            const name = c.split("=")[0].trim();
            if (['cookieConsent','analyticsCookies','performanceCookies'].some(n => name.includes(n))) {
                document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            }
        });
        cookiesRejected = false;
        location.reload();
    }
};

console.log('📊 Analytics MAX DATA prêt — 14 trackers actifs');
