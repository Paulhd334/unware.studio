// =============== MICROSOFT CLARITY - Version MAX DATA (v3, alignée sur analytics.js v7) ===============
// Changements par rapport à la v2 :
//  1. API de consentement v2 (consentv2) : obligatoire depuis le 31 oct. 2025 pour les visites venant de
//     l'EEE / Royaume-Uni / Suisse. Sans ce signal, Clarity fonctionne en mode "sans consentement"
//     (pas de cookies, nouvel ID à chaque page vue → un même visiteur apparaît comme plusieurs personnes).
//  2. Même visiteur que GA4 : l'ID ga_client_id (cookie partagé, sinon localStorage) est transmis à Clarity
//     avec clarity("identify"), donc une personne = un seul utilisateur dans Clarity aussi.
//  3. Session corrigée : analytics.js (v6+) stocke la session dans localStorage, plus dans sessionStorage.
//     La v2 lisait au mauvais endroit et renvoyait toujours "unknown".
//  4. Événements clés identiques à GA4 : clic_video_pack_france et clic_callout_lspdfr
//     (filtrables dans Clarity avec "Smart events" / "Custom events").
//  5. Page /tiktok/ reconnue (section "TikTok"), type d'appareil et titre de page repris d'analytics.js
//     quand il est chargé, avec repli si ce n'est pas le cas.
//  6. Fiabilité : écouteurs attachés une seule fois, init même si le script est chargé après DOMContentLoaded,
//     données de sortie envoyées sur pagehide (plus fiable que beforeunload sur mobile).
//  (tout le reste : identique à la v2)

const CLARITY_PROJECT_ID = 'vrmfcq4hei';
let clarityLoadAttempted = false;
let clarityEventsAttached = false;
let clarityExitFlushed = false;

// =============== ÉVÉNEMENTS CLÉS (mêmes noms que dans GA4) ===============
const CLARITY_KEY_EVENTS = [
    {
        track_name:   'video_preview_youtube',
        hrefContains: 'youtube.com/watch?v=oXKjN61I0F4',
        event:        'clic_video_pack_france',
        tags:         { video: 'Pack France 2026' }
    },
    {
        track_name:   'callout_superpoursuitecallout',
        hrefContains: '55465-superpoursuitecallout',
        event:        'clic_callout_lspdfr',
        tags:         { callout: 'SuperPoursuiteCallout' }
    }
];
const clarityLastKeyAt = {};

// =============== COOKIES ===============
function _getClarityCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        const c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}
function _getClarityConsent()   { return _getClarityCookie('cookieConsent'); }
function _getClarityAnalytics() { return _getClarityCookie('analyticsCookies'); }

function areClarityRejected() {
    return _getClarityConsent() === 'rejected';
}

function shouldLoadClarity() {
    const consent = _getClarityConsent();
    if (consent === 'rejected') return false;
    const analytics = _getClarityAnalytics();
    return !!(consent && (consent === 'all' || (consent === 'custom' && analytics === 'true')));
}

// Transmet le choix de l'utilisateur à Clarity (API de consentement v2).
// Pas de publicité sur ce site : ad_Storage reste toujours "denied".
function sendClarityConsent(granted) {
    if (typeof window.clarity !== 'function') return;
    try {
        window.clarity('consentv2', {
            ad_Storage:        'denied',
            analytics_Storage: granted ? 'granted' : 'denied'
        });
    } catch (e) {}
}

// =============== RESET COMPLET DE L'ÉTAT CLARITY ===============
function resetClarityState() {
    sendClarityConsent(false);
    if (typeof window !== 'undefined') window._isClarityLoaded = false;
    clarityLoadAttempted = false;
    console.log('🔴 Clarity désactivé — consentement refusé');
}

function getClarityLoaded() { return !!window._isClarityLoaded; }
function setClarityLoaded(v) { window._isClarityLoaded = v; }

// =============== HELPERS ===============
function getDeviceType() {
    // Même logique qu'analytics.js quand il est chargé : le type d'appareil est identique dans GA4 et Clarity
    if (typeof detectDeviceType === 'function') {
        try { return detectDeviceType(); } catch (e) {}
    }
    const w = window.innerWidth;
    const ua = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|ipod/i.test(ua) || w <= 768) return w <= 480 ? 'mobile' : 'tablet';
    return 'desktop';
}

function getConnectionType() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
    return conn.effectiveType || 'unknown';
}

function getReferrerSource() {
    if (!document.referrer) return 'direct';
    try { return new URL(document.referrer).hostname; } catch (e) { return 'unknown'; }
}

function getUTM(param) {
    return new URLSearchParams(window.location.search).get(param) || null;
}

// ID visiteur : le même que celui envoyé à GA4 (cookie partagé d'abord, sinon localStorage)
function getClarityVisitorId() {
    const fromCookie = _getClarityCookie('ga_client_id');
    if (fromCookie) return fromCookie;
    try { return localStorage.getItem('ga_client_id') || null; } catch (e) { return null; }
}

// Session : analytics.js v6+ l'écrit dans localStorage (partagée entre onglets)
function getClaritySessionId() {
    try {
        const raw = localStorage.getItem('ga_session') || sessionStorage.getItem('ga_session');
        if (raw) return JSON.parse(raw).id || 'unknown';
    } catch (e) {}
    return 'unknown';
}

function isReturningUser() {
    try { return !!localStorage.getItem('ga_has_visited'); } catch (e) { return false; }
}

function getClarityPageTitle() {
    if (typeof getPageTitle === 'function') {
        try { return getPageTitle(); } catch (e) {}
    }
    return document.title;
}

function getPageSection() {
    const path = window.location.pathname;
    if (path.includes('/nexa/'))    return 'NEXA';
    if (path.includes('/tiktok/'))  return 'TikTok';
    if (path.includes('/Support/')) return 'Support';
    if (path.includes('/legals/'))  return 'Légal';
    if (path === '/' || path.includes('index')) return 'Accueil';
    return 'Autre';
}

// =============== IDENTIFICATION DU VISITEUR ===============
// Un même visiteur = un seul utilisateur Clarity (et le même ID que dans GA4)
function identifyClarityVisitor() {
    if (typeof window.clarity !== 'function') return;
    const id = getClarityVisitorId();
    if (!id) return;
    try {
        window.clarity('identify', String(id), getClaritySessionId(), window.location.pathname);
    } catch (e) {}
}

// =============== TAGS CLARITY ENRICHIS ===============
function setClarityTags() {
    if (typeof window.clarity === 'undefined') return;

    const conn = navigator.connection || {};
    const perf = performance.getEntriesByType('navigation')[0] || {};

    try {
        // ── Identité & session ──
        window.clarity("set", "clientId",    getClarityVisitorId() || 'unknown');
        window.clarity("set", "sessionId",   getClaritySessionId());
        window.clarity("set", "isReturning", isReturningUser() ? 'returning' : 'new');

        // ── Page ──
        window.clarity("set", "pageTitle",   getClarityPageTitle());
        window.clarity("set", "pagePath",    window.location.pathname);
        window.clarity("set", "pageSection", getPageSection());

        // ── Device ──
        window.clarity("set", "deviceType",    getDeviceType());
        window.clarity("set", "screenRes",     `${window.screen.width}x${window.screen.height}`);
        window.clarity("set", "viewport",      `${window.innerWidth}x${window.innerHeight}`);
        window.clarity("set", "pixelRatio",    String(window.devicePixelRatio || 1));
        window.clarity("set", "orientation",   screen.orientation?.type || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'));
        window.clarity("set", "colorDepth",    String(window.screen.colorDepth));

        // ── Réseau ──
        window.clarity("set", "connectionType",  conn.effectiveType || 'unknown');
        window.clarity("set", "connectionRTT",   String(conn.rtt || 0) + 'ms');
        window.clarity("set", "connectionSpeed", String(conn.downlink || 0) + 'Mbps');
        window.clarity("set", "saveData",        String(conn.saveData || false));

        // ── Navigateur ──
        window.clarity("set", "language",   navigator.language || 'unknown');
        window.clarity("set", "platform",   navigator.platform || 'unknown');
        window.clarity("set", "online",     String(navigator.onLine));
        window.clarity("set", "doNotTrack", String(navigator.doNotTrack === '1'));

        // ── Traffic source ──
        window.clarity("set", "referrer",     getReferrerSource());
        window.clarity("set", "utmSource",    getUTM('utm_source') || 'none');
        window.clarity("set", "utmMedium",    getUTM('utm_medium') || 'none');
        window.clarity("set", "utmCampaign",  getUTM('utm_campaign') || 'none');

        // ── Performance chargement ──
        if (perf.loadEventEnd) {
            window.clarity("set", "loadTimeDNS",   String(Math.round(perf.domainLookupEnd - perf.domainLookupStart)) + 'ms');
            window.clarity("set", "loadTimeTTFB",  String(Math.round(perf.responseStart - perf.requestStart)) + 'ms');
            window.clarity("set", "loadTimeTotal", String(Math.round(perf.loadEventEnd - perf.startTime)) + 'ms');
            window.clarity("set", "loadTimeDOM",   String(Math.round(perf.domContentLoadedEventEnd - perf.startTime)) + 'ms');
        }

        console.log('🏷️ Clarity: tags enrichis définis');
    } catch (e) {
        console.warn('⚠️ Erreur tags Clarity:', e);
    }
}

// =============== INITIALISATION CLARITY ===============
function initializeClarity() {
    if (areClarityRejected() || !shouldLoadClarity()) return;
    if (getClarityLoaded() || clarityLoadAttempted) return;

    console.log('🚀 Initialisation Clarity MAX DATA v3...');
    clarityLoadAttempted = true;

    try {
        (function (c, l, a, r, i, t, y) {
            c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };

            // v3 : le consentement est transmis AVANT le chargement du script (la file d'attente le rejoue),
            // pour que Clarity démarre directement avec les cookies autorisés.
            sendClarityConsent(true);
            identifyClarityVisitor();

            t = l.createElement(r); t.async = 1;
            t.src = "https://www.clarity.ms/tag/" + i + "?ref=bwt";

            t.onload = function () {
                console.log('✅ Clarity chargé !');
                setClarityLoaded(true);

                if (typeof window.clarity !== 'undefined') {
                    setClarityTags();
                    window.clarity("event", "page_view");
                    attachClarityEvents();
                    trackClarityWebVitals();
                    console.log('📊 Clarity MAX DATA prêt — ID:', CLARITY_PROJECT_ID);
                }
            };

            t.onerror = function () {
                console.warn('⚠️ Clarity bloqué (adblock probable)');
                setClarityLoaded(false);
                clarityLoadAttempted = false;
            };

            y = l.getElementsByTagName(r)[0];
            y.parentNode.insertBefore(t, y);
        })(window, document, "clarity", "script", CLARITY_PROJECT_ID);

    } catch (e) {
        console.error('❌ Erreur Clarity:', e);
        clarityLoadAttempted = false;
    }
}

// =============== HELPER ÉVÉNEMENTS ===============
function clarityEvent(name, data = {}) {
    if (areClarityRejected() || !getClarityLoaded() || typeof window.clarity === 'undefined') return;
    try {
        window.clarity("event", name);
        Object.entries(data).forEach(([k, v]) => {
            window.clarity("set", `evt_${name}_${k}`, String(v).substring(0, 100));
        });
    } catch (e) {}
}

// =============== ÉVÉNEMENTS CLÉS ===============
// Envoyés immédiatement au clic (pas de délai), comme dans analytics.js
function clarityKeyEvent(link, clickType) {
    if (areClarityRejected() || !getClarityLoaded() || !link || !link.href) return;
    const name = link.getAttribute('data-track-name') || '';
    const href = link.href || '';

    const def = CLARITY_KEY_EVENTS.find(k =>
        (k.track_name && k.track_name === name) ||
        (k.hrefContains && href.indexOf(k.hrefContains) > -1)
    );
    if (!def) return;

    const now = Date.now();
    if (clarityLastKeyAt[def.event] && (now - clarityLastKeyAt[def.event]) < 1000) return;
    clarityLastKeyAt[def.event] = now;

    try {
        window.clarity("event", def.event);
        window.clarity("set", "lastKeyEvent", def.event);
        window.clarity("set", `evt_${def.event}_click_type`, clickType || 'normal');
        Object.entries(def.tags || {}).forEach(([k, v]) => {
            window.clarity("set", `evt_${def.event}_${k}`, String(v).substring(0, 100));
        });
        console.log('⭐ Clarity événement clé : ' + def.event);
    } catch (e) {}
}

// =============== ÉVÉNEMENTS COMPORTEMENTAUX ===============
function attachClarityEvents() {
    if (areClarityRejected()) return;
    if (clarityEventsAttached) return; // v3 : jamais de doublon d'écouteurs
    clarityEventsAttached = true;
    console.log('🎯 Clarity events attachés...');

    // ── Clics ──
    document.addEventListener('click', (e) => {
        if (areClarityRejected() || !getClarityLoaded()) return;

        const link = e.target.closest && e.target.closest('a[href]');
        if (link) clarityKeyEvent(link, 'normal');

        setTimeout(() => {
            const el = e.target.closest('a, button, .btn, [role="button"], .gallery-card');
            if (!el) return;
            const text = el.textContent?.trim()?.substring(0, 60) || el.getAttribute('aria-label') || 'unknown';
            clarityEvent('click', {
                element: el.tagName.toLowerCase(),
                text,
                track_name: el.getAttribute('data-track-name') || '',
                path: window.location.pathname
            });
        }, 50);
    }, { capture: true, passive: true });

    // ── Clic molette (ouverture dans un nouvel onglet) ──
    document.addEventListener('auxclick', (e) => {
        if (e.button !== 1 || areClarityRejected() || !getClarityLoaded()) return;
        const link = e.target.closest && e.target.closest('a[href]');
        if (link) clarityKeyEvent(link, 'milieu');
    }, { capture: true, passive: true });

    // ── Copie de texte ──
    document.addEventListener('copy', () => {
        if (areClarityRejected() || !getClarityLoaded()) return;
        clarityEvent('text_copy', { path: window.location.pathname });
    });

    trackClarityScrollDepth();
    trackClarityTimeOnPage();
    trackClarityRageClicks();
    trackClarityVisibility();
    trackClarityExternalLinks();
    trackClarityErrors();
    trackClarityHover();
    trackClarityFirstEngagement();
    trackClarityInactivity();
}

// ── SCROLL DEPTH ──
function trackClarityScrollDepth() {
    const milestones = [25, 50, 75, 90, 100];
    const reached = new Set();
    window.addEventListener('scroll', () => {
        if (areClarityRejected() || !getClarityLoaded()) return;
        const total = document.documentElement.scrollHeight - window.innerHeight;
        if (total <= 0) return;
        const pct = Math.round((window.scrollY / total) * 100);
        milestones.forEach(m => {
            if (pct >= m && !reached.has(m)) {
                reached.add(m);
                window.clarity("event", `scroll_${m}`);
                window.clarity("set", "maxScrollDepth", `${m}%`);
                console.log(`📜 Clarity scroll ${m}%`);
            }
        });
    }, { passive: true });
}

// ── TEMPS SUR LA PAGE ──
function trackClarityTimeOnPage() {
    const milestones = [15, 30, 60, 120, 300];
    const reached = new Set();
    const startTime = Date.now();

    const timer = setInterval(() => {
        if (areClarityRejected() || !getClarityLoaded()) { clearInterval(timer); return; }
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        milestones.forEach(m => {
            if (elapsed >= m && !reached.has(m)) {
                reached.add(m);
                window.clarity("event", `time_${m}s`);
                window.clarity("set", "timeOnPage", `${m}s`);
                console.log(`⏱️ Clarity ${m}s`);
            }
        });
    }, 5000);

    // v3 : pagehide (fiable sur mobile) + une seule fois
    function flush() {
        if (clarityExitFlushed) return;
        clarityExitFlushed = true;
        if (!getClarityLoaded() || areClarityRejected()) return;
        const total = Math.round((Date.now() - startTime) / 1000);
        window.clarity("set", "finalTimeOnPage", `${total}s`);
        window.clarity("set", "exitPage", window.location.pathname);
    }
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pageshow', (e) => { if (e.persisted) clarityExitFlushed = false; });
}

// ── RAGE CLICKS ──
function trackClarityRageClicks() {
    let clicks = [];
    document.addEventListener('click', (e) => {
        if (areClarityRejected() || !getClarityLoaded()) return;
        const now = Date.now();
        clicks.push({ x: e.clientX, y: e.clientY, t: now });
        clicks = clicks.filter(c => now - c.t < 1000);
        if (clicks.length >= 3) {
            const dx = Math.max(...clicks.map(c => c.x)) - Math.min(...clicks.map(c => c.x));
            const dy = Math.max(...clicks.map(c => c.y)) - Math.min(...clicks.map(c => c.y));
            if (dx < 30 && dy < 30) {
                const el = e.target.tagName + (e.target.id ? '#' + e.target.id : '');
                window.clarity("event", "rage_click");
                window.clarity("set", "rageClickElement", el.substring(0, 60));
                console.log('😡 Clarity rage click:', el);
                clicks = [];
            }
        }
    }, { passive: true });
}

// ── VISIBILITÉ ONGLET ──
function trackClarityVisibility() {
    let hiddenAt = null;
    document.addEventListener('visibilitychange', () => {
        if (areClarityRejected() || !getClarityLoaded()) return;
        if (document.hidden) {
            hiddenAt = Date.now();
            window.clarity("event", "tab_hidden");
        } else if (hiddenAt) {
            const away = Math.round((Date.now() - hiddenAt) / 1000);
            hiddenAt = null;
            window.clarity("event", "tab_returned");
            window.clarity("set", "lastAwayDuration", `${away}s`);
        }
    });
}

// ── LIENS SORTANTS ──
function trackClarityExternalLinks() {
    document.addEventListener('click', (e) => {
        if (areClarityRejected() || !getClarityLoaded()) return;
        const link = e.target.closest('a[href]');
        if (!link) return;
        const href = link.href || '';
        if (href && !href.includes(window.location.hostname) && href.startsWith('http')) {
            window.clarity("event", "outbound_link");
            try { window.clarity("set", "outboundDomain", new URL(href).hostname); } catch (err) {}
            console.log('🔗 Clarity lien sortant:', href);
        }
    }, { passive: true });
}

// ── ERREURS JS ──
function trackClarityErrors() {
    window.addEventListener('error', (e) => {
        if (areClarityRejected() || !getClarityLoaded()) return;
        window.clarity("event", "js_error");
        window.clarity("set", "lastError", (e.message || 'unknown').substring(0, 100));
    });
    window.addEventListener('unhandledrejection', (e) => {
        if (areClarityRejected() || !getClarityLoaded()) return;
        window.clarity("event", "js_error");
        window.clarity("set", "lastError", (e.reason?.message || String(e.reason)).substring(0, 100));
    });
}

// ── HOVER ÉLÉMENTS CLÉS ──
function trackClarityHover() {
    const selectors = ['.gallery-card', '.btn', '.nav-links a', '.footer-links a', '.video-card', '.lspdfr-callout'];
    const hovered = new Set();
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            if (el._clarityHover) return;
            el._clarityHover = true;
            el.addEventListener('mouseenter', () => {
                if (areClarityRejected() || !getClarityLoaded()) return;
                const key = sel + '_' + (el.textContent?.trim()?.substring(0, 20) || el.id);
                if (hovered.has(key)) return;
                hovered.add(key);
                window.clarity("event", "element_hover");
                window.clarity("set", "hoveredElement", sel.substring(0, 60));
            }, { passive: true });
        });
    });
}

// ── PREMIER ENGAGEMENT ──
function trackClarityFirstEngagement() {
    let done = false;
    const types = ['click', 'scroll', 'keydown', 'touchstart'];
    function onFirst(e) {
        if (done || areClarityRejected() || !getClarityLoaded()) return;
        done = true;
        const t = Math.round((Date.now() - performance.timeOrigin) / 1000);
        window.clarity("event", "first_engagement");
        window.clarity("set", "timeToFirstEngagement", `${t}s`);
        window.clarity("set", "firstEngagementType", e.type);
        console.log(`👆 Clarity premier engagement: ${t}s`);
        types.forEach(ev => window.removeEventListener(ev, onFirst));
    }
    types.forEach(ev => window.addEventListener(ev, onFirst, { passive: true }));
}

// ── INACTIVITÉ ──
function trackClarityInactivity() {
    let timer;
    let reported = false;
    function reset() {
        if (reported) {
            reported = false;
            if (getClarityLoaded()) window.clarity("event", "user_returned");
        }
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (areClarityRejected() || !getClarityLoaded()) return;
            reported = true;
            window.clarity("event", "user_inactive");
            window.clarity("set", "inactiveAt", window.location.pathname);
        }, 3 * 60 * 1000);
    }
    ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach(ev => {
        window.addEventListener(ev, reset, { passive: true });
    });
    reset();
}

// ── WEB VITALS ──
function trackClarityWebVitals() {
    // LCP
    try {
        new PerformanceObserver((list) => {
            const last = list.getEntries().at(-1);
            const lcp = Math.round(last.startTime);
            window.clarity("set", "LCP", `${lcp}ms`);
            window.clarity("set", "LCP_rating", lcp < 2500 ? 'good' : lcp < 4000 ? 'needs_improvement' : 'poor');
        }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {}

    // CLS
    try {
        let clsValue = 0;
        new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => { if (!entry.hadRecentInput) clsValue += entry.value; });
        }).observe({ type: 'layout-shift', buffered: true });
        const sendCls = () => {
            if (!getClarityLoaded()) return;
            const cls = Math.round(clsValue * 1000) / 1000;
            window.clarity("set", "CLS", String(cls));
            window.clarity("set", "CLS_rating", cls < 0.1 ? 'good' : cls < 0.25 ? 'needs_improvement' : 'poor');
        };
        window.addEventListener('pagehide', sendCls);
        window.addEventListener('beforeunload', sendCls);
    } catch (e) {}

    // FCP
    try {
        new PerformanceObserver((list) => {
            const entry = list.getEntries().find(e => e.name === 'first-contentful-paint');
            if (entry) {
                const fcp = Math.round(entry.startTime);
                window.clarity("set", "FCP", `${fcp}ms`);
                window.clarity("set", "FCP_rating", fcp < 1800 ? 'good' : fcp < 3000 ? 'needs_improvement' : 'poor');
            }
        }).observe({ type: 'paint', buffered: true });
    } catch (e) {}

    // TTFB
    try {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav) {
            const ttfb = Math.round(nav.responseStart - nav.requestStart);
            window.clarity("set", "TTFB", `${ttfb}ms`);
            window.clarity("set", "TTFB_rating", ttfb < 800 ? 'good' : ttfb < 1800 ? 'needs_improvement' : 'poor');
        }
    } catch (e) {}
}

// =============== INIT PRINCIPALE ===============
function initClarity() {
    const consent = _getClarityConsent();

    if (!consent) {
        console.log('⏳ Clarity en attente de consentement...');
        return;
    }

    if (areClarityRejected()) {
        resetClarityState();
        return;
    }

    if (shouldLoadClarity()) {
        setTimeout(() => initializeClarity(), 400); // légèrement après GA
    }
}

// =============== ÉCOUTE DES CHANGEMENTS DE CONSENTEMENT ===============
// Écoute l'événement 'cookieConsentChanged' (même événement qu'analytics.js)
document.addEventListener('cookieConsentChanged', function (e) {
    const { consent, analytics } = e.detail || {};

    if (consent === 'rejected') {
        resetClarityState();
        return;
    }

    if (consent === 'all' || (consent === 'custom' && analytics === 'true')) {
        clarityLoadAttempted = false;
        sendClarityConsent(true); // si Clarity tourne déjà, il reçoit aussitôt le nouveau choix
        setTimeout(() => initializeClarity(), 200);
    } else {
        // Analytics décoché dans les préférences personnalisées
        resetClarityState();
    }
});

// v3 : fonctionne aussi si le script est chargé après DOMContentLoaded
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initClarity);
else initClarity();

// =============== DEBUG ===============
window.debugClarity = {
    check: function () {
        console.log('🔍 Clarity MAX DATA v3:');
        console.log('- Cookies refusés  :', areClarityRejected());
        console.log('- Loaded           :', getClarityLoaded());
        console.log('- Attempted        :', clarityLoadAttempted);
        console.log('- window.clarity   :', typeof window.clarity !== 'undefined');
        console.log('- Consentement     :', shouldLoadClarity() ? '✅' : '❌');
        console.log('- cookieConsent    :', _getClarityConsent());
        console.log('- ID visiteur      :', getClarityVisitorId(), '(identique à GA4)');
        console.log('- Session ID       :', getClaritySessionId());
        console.log('- Cookies Clarity  :', { _clck: !!_getClarityCookie('_clck'), _clsk: !!_getClarityCookie('_clsk') });
        console.log('- Is Returning     :', isReturningUser());
        console.log('- Device           :', getDeviceType());
        console.log('- Connection       :', getConnectionType());
        console.log('- Page section     :', getPageSection());
        const scripts = [...document.getElementsByTagName('script')];
        const found = scripts.find(s => s.src?.includes('clarity.ms'));
        console.log('- Script DOM       :', found ? '✅ ' + found.src : '❌');
    },
    test: function () {
        if (areClarityRejected()) { console.log('⛔ Cookies refusés'); return; }
        if (typeof window.clarity !== 'undefined') {
            window.clarity("event", "debug_test");
            window.clarity("set", "debugTest", String(Date.now()));
            console.log('✅ Test Clarity envoyé');
        } else {
            console.log('❌ Clarity non dispo');
        }
    },
    force: function () {
        if (areClarityRejected()) { console.log('⛔ Cookies refusés'); return; }
        setClarityLoaded(false);
        clarityLoadAttempted = false;
        initClarity();
    },
    tags: function () {
        if (typeof window.clarity === 'undefined') { console.log('❌ Clarity non chargé'); return; }
        setClarityTags();
        console.log('✅ Tags redéfinis');
    },
    identify: function () {
        identifyClarityVisitor();
        console.log('✅ identify envoyé avec', getClarityVisitorId());
    }
};
