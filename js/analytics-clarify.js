// =============== MICROSOFT CLARITY - Version MAX DATA ===============
const CLARITY_PROJECT_ID = 'vrmfcq4hei';
let isClarityLoaded = false;
let clarityLoadAttempted = false;

// =============== COOKIES ===============
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}

function areCookiesRejected() {
    return getCookie('cookieConsent') === 'rejected';
}

function shouldLoadClarity() {
    const consent = getCookie('cookieConsent');
    if (consent === 'rejected') return false;
    const analytics = getCookie('analyticsCookies');
    return consent && (consent === 'all' || (consent === 'custom' && analytics === 'true'));
}

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

function getSessionId() {
    // Réutilise la session GA si dispo, sinon lit sessionStorage
    try {
        const raw = sessionStorage.getItem('ga_session');
        if (raw) return JSON.parse(raw).id;
    } catch(e) {}
    return 'unknown';
}

function isReturningUser() {
    return !!localStorage.getItem('ga_has_visited');
}

// =============== TAGS CLARITY ENRICHIS ===============
// Clarity "set" = custom tags visibles dans le dashboard + filtres de session
function setClarityTags() {
    if (typeof window.clarity === 'undefined') return;

    const conn = navigator.connection || {};
    const perf = performance.getEntriesByType('navigation')[0] || {};
    const params = new URLSearchParams(window.location.search);

    try {
        // ── Identité & session ──
        window.clarity("set", "clientId",      localStorage.getItem('ga_client_id') || 'unknown');
        window.clarity("set", "sessionId",     getSessionId());
        window.clarity("set", "isReturning",   isReturningUser() ? 'returning' : 'new');

        // ── Page ──
        window.clarity("set", "pageTitle",     document.title);
        window.clarity("set", "pagePath",      window.location.pathname);
        window.clarity("set", "pageSection",   getPageSection());

        // ── Device ──
        window.clarity("set", "deviceType",    getDeviceType());
        window.clarity("set", "screenRes",     `${window.screen.width}x${window.screen.height}`);
        window.clarity("set", "viewport",      `${window.innerWidth}x${window.innerHeight}`);
        window.clarity("set", "pixelRatio",    String(window.devicePixelRatio || 1));
        window.clarity("set", "orientation",   screen.orientation?.type || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'));
        window.clarity("set", "colorDepth",    String(window.screen.colorDepth));

        // ── Réseau ──
        window.clarity("set", "connectionType",   conn.effectiveType || 'unknown');
        window.clarity("set", "connectionRTT",    String(conn.rtt || 0) + 'ms');
        window.clarity("set", "connectionSpeed",  String(conn.downlink || 0) + 'Mbps');
        window.clarity("set", "saveData",         String(conn.saveData || false));

        // ── Navigateur ──
        window.clarity("set", "language",      navigator.language || 'unknown');
        window.clarity("set", "platform",      navigator.platform || 'unknown');
        window.clarity("set", "online",        String(navigator.onLine));
        window.clarity("set", "doNotTrack",    String(navigator.doNotTrack === '1'));

        // ── Traffic source ──
        window.clarity("set", "referrer",      getReferrerSource());
        window.clarity("set", "utmSource",     getUTM('utm_source') || 'none');
        window.clarity("set", "utmMedium",     getUTM('utm_medium') || 'none');
        window.clarity("set", "utmCampaign",   getUTM('utm_campaign') || 'none');

        // ── Performance chargement ──
        if (perf.loadEventEnd) {
            window.clarity("set", "loadTimeDNS",     String(Math.round(perf.domainLookupEnd - perf.domainLookupStart)) + 'ms');
            window.clarity("set", "loadTimeTTFB",    String(Math.round(perf.responseStart - perf.requestStart)) + 'ms');
            window.clarity("set", "loadTimeTotal",   String(Math.round(perf.loadEventEnd - perf.startTime)) + 'ms');
            window.clarity("set", "loadTimeDOM",     String(Math.round(perf.domContentLoadedEventEnd - perf.startTime)) + 'ms');
        }

        console.log('🏷️ Clarity: tags enrichis définis');
    } catch(e) {
        console.warn('⚠️ Erreur tags Clarity:', e);
    }
}

// Section de la page basée sur l'URL
function getPageSection() {
    const path = window.location.pathname;
    if (path.includes('/nexa/')) return 'NEXA';
    if (path.includes('/Support/')) return 'Support';
    if (path.includes('/legals/')) return 'Légal';
    if (path === '/' || path.includes('index')) return 'Accueil';
    return 'Autre';
}

// =============== INITIALISATION CLARITY ===============
function initializeClarity() {
    if (areCookiesRejected() || isClarityLoaded || clarityLoadAttempted || !shouldLoadClarity()) return;

    console.log('🚀 Initialisation Clarity MAX DATA...');
    clarityLoadAttempted = true;

    try {
        (function(c, l, a, r, i, t, y) {
            c[a] = c[a] || function() { (c[a].q = c[a].q || []).push(arguments); };
            t = l.createElement(r); t.async = 1;
            t.src = "https://www.clarity.ms/tag/" + i + "?ref=bwt";

            t.onload = function() {
                console.log('✅ Clarity chargé !');
                isClarityLoaded = true;

                if (typeof window.clarity !== 'undefined') {
                    // Définir tous les tags enrichis
                    setClarityTags();

                    // Event page_view
                    window.clarity("event", "page_view");

                    // Activer le tracking comportemental
                    attachClarityEvents();

                    // Web Vitals dans Clarity
                    trackClarityWebVitals();

                    console.log('📊 Clarity MAX DATA actif');
                }
            };

            t.onerror = function() {
                console.warn('⚠️ Clarity bloqué (adblock probable)');
                isClarityLoaded = false;
            };

            y = l.getElementsByTagName(r)[0];
            y.parentNode.insertBefore(t, y);
        })(window, document, "clarity", "script", CLARITY_PROJECT_ID);

    } catch(e) {
        console.error('❌ Erreur Clarity:', e);
        clarityLoadAttempted = false;
    }
}

// =============== TRACKING CLARITY ===============
function clarityEvent(name, data = {}) {
    if (areCookiesRejected() || !isClarityLoaded || typeof window.clarity === 'undefined') return;
    try {
        // Clarity "event" = marqueur visible dans les replays de session
        window.clarity("event", name);
        // On passe les données en tags pour les filtres
        Object.entries(data).forEach(([k, v]) => {
            window.clarity("set", `evt_${name}_${k}`, String(v).substring(0, 100));
        });
    } catch(e) {}
}

// =============== ÉVÉNEMENTS COMPORTEMENTAUX ===============
function attachClarityEvents() {
    if (areCookiesRejected()) return;
    console.log('🎯 Clarity events attachés...');

    // ── Clics ──
    document.addEventListener('click', (e) => {
        if (areCookiesRejected() || !isClarityLoaded) return;
        setTimeout(() => {
            const el = e.target.closest('a, button, .btn, [role="button"], .gallery-card');
            if (!el) return;
            const text = el.textContent?.trim()?.substring(0, 60) || el.getAttribute('aria-label') || 'unknown';
            clarityEvent('click', { element: el.tagName.toLowerCase(), text, path: window.location.pathname });
        }, 50);
    }, { passive: true });

    // ── Scroll depth ──
    trackClarityScrollDepth();

    // ── Temps sur la page ──
    trackClarityTimeOnPage();

    // ── Rage clicks → Clarity le détecte nativement, on le marque aussi ──
    trackClarityRageClicks();

    // ── Visibilité onglet ──
    trackClarityVisibility();

    // ── Liens sortants ──
    trackClarityExternalLinks();

    // ── Erreurs JS → marquées dans les replays ──
    trackClarityErrors();

    // ── Hover éléments clés ──
    trackClarityHover();

    // ── Premier engagement ──
    trackClarityFirstEngagement();

    // ── Copie de texte ──
    document.addEventListener('copy', () => {
        if (areCookiesRejected() || !isClarityLoaded) return;
        clarityEvent('text_copy', { path: window.location.pathname });
    });

    // ── Inactivité ──
    trackClarityInactivity();
}

// ── SCROLL DEPTH ──
function trackClarityScrollDepth() {
    const milestones = [25, 50, 75, 90, 100];
    const reached = new Set();
    window.addEventListener('scroll', () => {
        if (areCookiesRejected() || !isClarityLoaded) return;
        const total = document.documentElement.scrollHeight - window.innerHeight;
        if (total <= 0) return;
        const pct = Math.round((window.scrollY / total) * 100);
        milestones.forEach(m => {
            if (pct >= m && !reached.has(m)) {
                reached.add(m);
                // Clarity marque ce point dans le replay
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
        if (areCookiesRejected() || !isClarityLoaded) { clearInterval(timer); return; }
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
        if (!isClarityLoaded || areCookiesRejected()) return;
        const total = Math.round((Date.now() - startTime) / 1000);
        window.clarity("set", "finalTimeOnPage", `${total}s`);
        window.clarity("set", "exitPage", window.location.pathname);
    });
}

// ── RAGE CLICKS ──
function trackClarityRageClicks() {
    // Clarity détecte les rage clicks nativement, mais on les marque aussi
    // pour avoir des filtres personnalisés dans le dashboard
    let clicks = [];
    document.addEventListener('click', (e) => {
        if (areCookiesRejected() || !isClarityLoaded) return;
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
        if (areCookiesRejected() || !isClarityLoaded) return;
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
        if (areCookiesRejected() || !isClarityLoaded) return;
        const link = e.target.closest('a[href]');
        if (!link) return;
        const href = link.href || '';
        if (href && !href.includes(window.location.hostname) && href.startsWith('http')) {
            window.clarity("event", "outbound_link");
            window.clarity("set", "outboundDomain", new URL(href).hostname);
            console.log('🔗 Clarity lien sortant:', href);
        }
    }, { passive: true });
}

// ── ERREURS JS (visibles dans les replays Clarity) ──
function trackClarityErrors() {
    window.addEventListener('error', (e) => {
        if (areCookiesRejected() || !isClarityLoaded) return;
        window.clarity("event", "js_error");
        window.clarity("set", "lastError", (e.message || 'unknown').substring(0, 100));
    });
    window.addEventListener('unhandledrejection', (e) => {
        if (areCookiesRejected() || !isClarityLoaded) return;
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
                if (areCookiesRejected() || !isClarityLoaded) return;
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
        if (done || areCookiesRejected() || !isClarityLoaded) return;
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
            if (isClarityLoaded) window.clarity("event", "user_returned");
        }
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (areCookiesRejected() || !isClarityLoaded) return;
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

// ── WEB VITALS DANS CLARITY ──
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
            if (!isClarityLoaded) return;
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
function initClarity() {
    if (areCookiesRejected()) return;
    if (shouldLoadClarity()) {
        setTimeout(() => initializeClarity(), 400); // légèrement après GA
    }
}

// =============== SURCHARGE BANNIÈRE COOKIES ===============
const _origAccept = window.acceptCookies;
window.acceptCookies = function() {
    if (_origAccept) _origAccept();
    setTimeout(() => initClarity(), 200);
};

const _origSave = window.saveCookiePreferences;
window.saveCookiePreferences = function() {
    if (_origSave) _origSave();
    setTimeout(() => { if (shouldLoadClarity()) initClarity(); }, 200);
};

document.addEventListener('DOMContentLoaded', initClarity);

// =============== DEBUG ===============
window.debugClarity = {
    check: function() {
        console.log('🔍 Clarity MAX DATA:');
        console.log('- Cookies refusés  :', areCookiesRejected());
        console.log('- Loaded           :', isClarityLoaded);
        console.log('- Attempted        :', clarityLoadAttempted);
        console.log('- window.clarity   :', typeof window.clarity !== 'undefined');
        console.log('- Consentement     :', shouldLoadClarity() ? '✅' : '❌');
        console.log('- Session ID       :', getSessionId());
        console.log('- Is Returning     :', isReturningUser());
        console.log('- Device           :', getDeviceType());
        console.log('- Connection       :', getConnectionType());
        console.log('- Page section     :', getPageSection());
        const scripts = [...document.getElementsByTagName('script')];
        const found = scripts.find(s => s.src?.includes('clarity.ms'));
        console.log('- Script DOM       :', found ? '✅ ' + found.src : '❌');
    },
    test: function() {
        if (areCookiesRejected()) { console.log('⛔ Cookies refusés'); return; }
        if (typeof window.clarity !== 'undefined') {
            window.clarity("event", "debug_test");
            window.clarity("set", "debugTest", String(Date.now()));
            console.log('✅ Test Clarity envoyé');
        } else {
            console.log('❌ Clarity non dispo');
        }
    },
    force: function() {
        if (areCookiesRejected()) { console.log('⛔ Cookies refusés'); return; }
        isClarityLoaded = false;
        clarityLoadAttempted = false;
        initClarity();
    },
    tags: function() {
        if (typeof window.clarity === 'undefined') { console.log('❌ Clarity non chargé'); return; }
        setClarityTags();
        console.log('✅ Tags redéfinis');
    }
};

if (!areCookiesRejected()) {
    console.log('🔍 Clarity MAX DATA prêt — ID:', CLARITY_PROJECT_ID);
}
