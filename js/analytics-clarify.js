// =============== MICROSOFT CLARITY - Version MAX DATA ===============
const CLARITY_PROJECT_ID = 'vrmfcq4hei';
// NOTE: isClarityLoaded est déclaré dans analytics.js (partagé entre les deux fichiers)
// On utilise window.isClarityLoaded pour éviter les conflits de scope
let clarityLoadAttempted = false;

// =============== COOKIES ===============
// Ces fonctions existent déjà dans analytics.js — on les réutilise directement
// si analytics.js est chargé avant, sinon on les redéfinit en fallback
function _getClarityConsent() {
    const nameEQ = 'cookieConsent=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}

function _getClarityAnalytics() {
    const nameEQ = 'analyticsCookies=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}

function areClarityRejected() {
    return _getClarityConsent() === 'rejected';
}

function shouldLoadClarity() {
    const consent = _getClarityConsent();
    if (consent === 'rejected') return false;
    const analytics = _getClarityAnalytics();
    return !!(consent && (consent === 'all' || (consent === 'custom' && analytics === 'true')));
}

// =============== RESET COMPLET DE L'ÉTAT CLARITY ===============
// FIX: appelé à chaque refus pour permettre une future ré-initialisation
function resetClarityState() {
    // On réinitialise les flags — isClarityLoaded est partagé avec analytics.js
    if (typeof window !== 'undefined') {
        window._isClarityLoaded = false;
    }
    clarityLoadAttempted = false;
    console.log('🔴 Clarity désactivé — consentement refusé');
}

// Getter/setter centralisé pour isClarityLoaded
function getClarityLoaded() { return !!window._isClarityLoaded; }
function setClarityLoaded(v) { window._isClarityLoaded = v; }

// =============== HELPERS ===============
function getDeviceType() {
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
    try { return new URL(document.referrer).hostname; } catch(e) { return 'unknown'; }
}

function getUTM(param) {
    return new URLSearchParams(window.location.search).get(param) || null;
}

function getClaritySessionId() {
    // Réutilise la session GA si dispo
    try {
        const raw = sessionStorage.getItem('ga_session');
        if (raw) return JSON.parse(raw).id;
    } catch(e) {}
    return 'unknown';
}

function isReturningUser() {
    return !!localStorage.getItem('ga_has_visited');
}

function getPageSection() {
    const path = window.location.pathname;
    if (path.includes('/nexa/'))    return 'NEXA';
    if (path.includes('/Support/')) return 'Support';
    if (path.includes('/legals/'))  return 'Légal';
    if (path === '/' || path.includes('index')) return 'Accueil';
    return 'Autre';
}

// =============== TAGS CLARITY ENRICHIS ===============
function setClarityTags() {
    if (typeof window.clarity === 'undefined') return;

    const conn = navigator.connection || {};
    const perf = performance.getEntriesByType('navigation')[0] || {};

    try {
        // ── Identité & session ──
        window.clarity("set", "clientId",    localStorage.getItem('ga_client_id') || 'unknown');
        window.clarity("set", "sessionId",   getClaritySessionId());
        window.clarity("set", "isReturning", isReturningUser() ? 'returning' : 'new');

        // ── Page ──
        window.clarity("set", "pageTitle",   document.title);
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
    } catch(e) {
        console.warn('⚠️ Erreur tags Clarity:', e);
    }
}

// =============== INITIALISATION CLARITY ===============
function initializeClarity() {
    // FIX: on relit toujours l'état réel des cookies AVANT de vérifier clarityLoadAttempted
    if (areClarityRejected() || !shouldLoadClarity()) return;
    if (getClarityLoaded() || clarityLoadAttempted) return;

    console.log('🚀 Initialisation Clarity MAX DATA...');
    clarityLoadAttempted = true;

    try {
        (function(c, l, a, r, i, t, y) {
            c[a] = c[a] || function() { (c[a].q = c[a].q || []).push(arguments); };
            t = l.createElement(r); t.async = 1;
            t.src = "https://www.clarity.ms/tag/" + i + "?ref=bwt";

            t.onload = function() {
                console.log('✅ Clarity chargé !');
                setClarityLoaded(true);

                if (typeof window.clarity !== 'undefined') {
                    setClarityTags();
                    window.clarity("event", "page_view");
                    attachClarityEvents();
                    trackClarityWebVitals();
                    // FIX: log déplacé ici — n'apparaît que si Clarity est réellement actif
                    console.log('📊 Clarity MAX DATA prêt — ID:', CLARITY_PROJECT_ID);
                }
            };

            t.onerror = function() {
                console.warn('⚠️ Clarity bloqué (adblock probable)');
                setClarityLoaded(false);
                // FIX: reset de clarityLoadAttempted pour permettre une prochaine tentative
                clarityLoadAttempted = false;
            };

            y = l.getElementsByTagName(r)[0];
            y.parentNode.insertBefore(t, y);
        })(window, document, "clarity", "script", CLARITY_PROJECT_ID);

    } catch(e) {
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
    } catch(e) {}
}

// =============== ÉVÉNEMENTS COMPORTEMENTAUX ===============
function attachClarityEvents() {
    if (areClarityRejected()) return;
    console.log('🎯 Clarity events attachés...');

    // ── Clics ──
    document.addEventListener('click', (e) => {
        if (areClarityRejected() || !getClarityLoaded()) return;
        setTimeout(() => {
            const el = e.target.closest('a, button, .btn, [role="button"], .gallery-card');
            if (!el) return;
            const text = el.textContent?.trim()?.substring(0, 60) || el.getAttribute('aria-label') || 'unknown';
            clarityEvent('click', { element: el.tagName.toLowerCase(), text, path: window.location.pathname });
        }, 50);
    }, { passive: true });

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

    window.addEventListener('beforeunload', () => {
        if (!getClarityLoaded() || areClarityRejected()) return;
        const total = Math.round((Date.now() - startTime) / 1000);
        window.clarity("set", "finalTimeOnPage", `${total}s`);
        window.clarity("set", "exitPage", window.location.pathname);
    });
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
            try { window.clarity("set", "outboundDomain", new URL(href).hostname); } catch(e) {}
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
    const selectors = ['.gallery-card', '.btn', '.nav-links a', '.footer-links a'];
    const hovered = new Set();
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
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
    function onFirst(e) {
        if (done || areClarityRejected() || !getClarityLoaded()) return;
        done = true;
        const t = Math.round((Date.now() - performance.timeOrigin) / 1000);
        window.clarity("event", "first_engagement");
        window.clarity("set", "timeToFirstEngagement", `${t}s`);
        window.clarity("set", "firstEngagementType", e.type);
        console.log(`👆 Clarity premier engagement: ${t}s`);
        ['click','scroll','keydown','touchstart'].forEach(ev => window.removeEventListener(ev, onFirst));
    }
    ['click','scroll','keydown','touchstart'].forEach(ev => {
        window.addEventListener(ev, onFirst, { passive: true });
    });
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
    ['mousemove','keydown','scroll','click','touchstart'].forEach(ev => {
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
    } catch(e) {}

    // CLS
    try {
        let clsValue = 0;
        new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => { if (!entry.hadRecentInput) clsValue += entry.value; });
        }).observe({ type: 'layout-shift', buffered: true });
        window.addEventListener('beforeunload', () => {
            if (!getClarityLoaded()) return;
            const cls = Math.round(clsValue * 1000) / 1000;
            window.clarity("set", "CLS", String(cls));
            window.clarity("set", "CLS_rating", cls < 0.1 ? 'good' : cls < 0.25 ? 'needs_improvement' : 'poor');
        });
    } catch(e) {}

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
    } catch(e) {}

    // TTFB
    try {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav) {
            const ttfb = Math.round(nav.responseStart - nav.requestStart);
            window.clarity("set", "TTFB", `${ttfb}ms`);
            window.clarity("set", "TTFB_rating", ttfb < 800 ? 'good' : ttfb < 1800 ? 'needs_improvement' : 'poor');
        }
    } catch(e) {}
}

// =============== INIT PRINCIPALE ===============
// FIX: plus de surcharge window.acceptCookies / window.saveCookiePreferences
// Ces fonctions appellent directement initializeClarity() via analytics.js
// On utilise un listener sur un custom event dispatché par analytics.js
function initClarity() {
    const consent = _getClarityConsent();

    if (!consent) {
        // En attente de consentement — Clarity ne se charge pas
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
// FIX: au lieu de surcharger les fonctions globales (fragile),
// on écoute l'événement 'cookieConsentChanged' dispatché par analytics.js
document.addEventListener('cookieConsentChanged', function(e) {
    const { consent, analytics } = e.detail || {};

    if (consent === 'rejected') {
        resetClarityState();
        return;
    }

    if (consent === 'all' || (consent === 'custom' && analytics === 'true')) {
        // FIX: reset de clarityLoadAttempted pour permettre la ré-initialisation
        clarityLoadAttempted = false;
        setTimeout(() => initializeClarity(), 200);
    } else {
        // Analytics décoché dans les préférences custom
        resetClarityState();
    }
});

document.addEventListener('DOMContentLoaded', initClarity);

// =============== DEBUG ===============
window.debugClarity = {
    check: function() {
        console.log('🔍 Clarity MAX DATA:');
        console.log('- Cookies refusés  :', areClarityRejected());
        console.log('- Loaded           :', getClarityLoaded());
        console.log('- Attempted        :', clarityLoadAttempted);
        console.log('- window.clarity   :', typeof window.clarity !== 'undefined');
        console.log('- Consentement     :', shouldLoadClarity() ? '✅' : '❌');
        console.log('- cookieConsent    :', _getClarityConsent());
        console.log('- Session ID       :', getClaritySessionId());
        console.log('- Is Returning     :', isReturningUser());
        console.log('- Device           :', getDeviceType());
        console.log('- Connection       :', getConnectionType());
        console.log('- Page section     :', getPageSection());
        const scripts = [...document.getElementsByTagName('script')];
        const found = scripts.find(s => s.src?.includes('clarity.ms'));
        console.log('- Script DOM       :', found ? '✅ ' + found.src : '❌');
    },
    test: function() {
        if (areClarityRejected()) { console.log('⛔ Cookies refusés'); return; }
        if (typeof window.clarity !== 'undefined') {
            window.clarity("event", "debug_test");
            window.clarity("set", "debugTest", String(Date.now()));
            console.log('✅ Test Clarity envoyé');
        } else {
            console.log('❌ Clarity non dispo');
        }
    },
    force: function() {
        if (areClarityRejected()) { console.log('⛔ Cookies refusés'); return; }
        setClarityLoaded(false);
        clarityLoadAttempted = false;
        initClarity();
    },
    tags: function() {
        if (typeof window.clarity === 'undefined') { console.log('❌ Clarity non chargé'); return; }
        setClarityTags();
        console.log('✅ Tags redéfinis');
    }
};

// FIX: log supprimé d'ici — déplacé dans le onload du script Clarity
// pour n'apparaître que si Clarity est réellement chargé avec consentement valide
