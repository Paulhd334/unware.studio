// =============== GOOGLE ANALYTICS 4 — UNWARE STUDIO — v7 ===============
// Objectif v7 : une même personne = UN SEUL utilisateur GA4 (plus de "2 personnes en même temps"),
// et les clics importants sont envoyés comme événements clés.
//
// Changements par rapport à v6 :
//  1. ID visiteur : plus jamais deux cookies du même nom (un limité à l'hôte + un partagé sur le domaine).
//     Avant, un vieux cookie "host-only" de la v5 pouvait écraser le cookie partagé et donner un ID
//     différent sur unware.studio et www.unware.studio → 2 utilisateurs. Le cookie limité à l'hôte
//     est maintenant supprimé avant d'écrire le cookie partagé.
//  2. Repli API (/api/ga-event) : il reprend le session_id réel de gtag (via gtag('get')) au lieu d'un
//     session_id inventé. Plus de session "fantôme" à côté de celle de gtag.
//  3. Protection contre un double chargement de gtag.js / un double gtag('config') pour le même ID
//     (cause fréquente de doubles page_view et de doubles utilisateurs).
//  4. ÉVÉNEMENTS CLÉS : clic_video_pack_france et clic_callout_lspdfr (voir KEY_EVENTS plus bas),
//     envoyés immédiatement au clic (et au clic molette). À marquer comme "événement clé" dans GA4.
//  5. debugGA.scan() : diagnostic des doublons (scripts gtag, cookies _ga, ID envoyé).
//  (tout le reste : identique à la v6)

const GA_MEASUREMENT_ID = 'G-NJLCB6G0G8';
const SESSION_DURATION  = 30 * 60 * 1000;
const VISITOR_KEY       = 'ga_client_id';   // même nom qu'avant : les visiteurs actuels gardent leur ID
const SESSION_KEY       = 'ga_session';
const VISITOR_DAYS      = 365;
const NAV_HISTORY_KEY   = 'ga_nav_history';
const NAV_ENTER_KEY     = 'ga_page_enter_time';
const NEXT_PAGE_KEY     = 'ga_next_intended_page';
const NAV_MAX_HISTORY   = 20;

// =============== ÉVÉNEMENTS CLÉS ===============
// Clé = valeur de data-track-name du lien. "hrefContains" sert de filet de sécurité si l'attribut manque.
// Pour ajouter un autre événement clé : copie un bloc et change les valeurs.
const KEY_EVENTS = [
    {
        track_name:   'video_preview_youtube',
        hrefContains: 'youtube.com/watch?v=oXKjN61I0F4',
        event:        'clic_video_pack_france',
        params:       { video_name: 'Pack France 2026' }
    },
    {
        track_name:   'callout_superpoursuitecallout',
        hrefContains: '55465-superpoursuitecallout',
        event:        'clic_callout_lspdfr',
        params:       { callout_name: 'SuperPoursuiteCallout' }
    }
    // Exemple (désactivé) : téléchargement du pack depuis Google Drive
    // ,{ track_name: 'cta_access_digital_files', hrefContains: 'drive.google.com', event: 'clic_telechargement_pack', params: {} }
];

let isGALoaded = false;
let gaInitStarted = false;
let gaScriptInjected = false;
let gtagLoaded = false;
let eventTrackingStarted = false;
let deviceType = 'desktop';
let clientId = null;
let cookiesRejected = false;
let pageCountIncremented = false;
let sessionJustCreated = false;
let gtagSessionId = null;       // session_id réel de gtag (pour le repli API)
const lastKeyEventAt = {};      // anti-doublon des événements clés

// =============== STOCKAGE SÉCURISÉ ===============
const memStore = { local: {}, session: {} };
function sGet(kind, key) {
    try {
        const v = window[kind + 'Storage'].getItem(key);
        if (v !== null) return v;
    } catch (e) {}
    return Object.prototype.hasOwnProperty.call(memStore[kind], key) ? memStore[kind][key] : null;
}
function sSet(kind, key, val) {
    memStore[kind][key] = String(val);
    try { window[kind + 'Storage'].setItem(key, String(val)); } catch (e) {}
}
function sDel(kind, key) {
    delete memStore[kind][key];
    try { window[kind + 'Storage'].removeItem(key); } catch (e) {}
}

// =============== DÉTECTION DU DEVICE ===============
function detectDeviceType() {
    const ua = navigator.userAgent.toLowerCase();
    const isIpadOS = /macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;
    if (/ipad|tablet/.test(ua) || isIpadOS || (/android/.test(ua) && !/mobile/.test(ua))) return 'tablet';
    if (/mobi|iphone|ipod|android/.test(ua)) return 'mobile';
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
        '/nexa/the_void_protocol.html': 'The Void Protocol',
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
        '/tiktok/tiktok.html': 'Pack France 2026 & Callouts LSPDFR'
    };
    return pageMap[path] || document.title || 'UNWARE STUDIO';
}

function getPagePath() {
    return window.location.pathname + window.location.search;
}

// =============== COOKIES ===============
function getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        const c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}

// Domaine racine (ex. unware.studio) pour partager le cookie entre www et sans www.
// Retourne '' pour localhost / adresses IP.
function getRootDomain() {
    const host = window.location.hostname;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.indexOf('.') === -1) return '';
    return host.split('.').slice(-2).join('.');
}

// shared = true : cookie valable sur tout le domaine (uniquement pour l'ID visiteur).
// Les cookies de consentement restent limités à l'hôte, comme avant.
function setCookie(name, value, days, shared) {
    const exp = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    const attrs = ';expires=' + exp + ';path=/;SameSite=Lax;Secure';
    const root = shared ? getRootDomain() : '';
    if (root) {
        // v7 : on supprime d'abord un éventuel cookie limité à l'hôte (ancienne version).
        // Sinon deux cookies du même nom coexistent et chaque page peut lire un ID différent.
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
        document.cookie = name + '=' + value + attrs + ';domain=' + root;
        if (getCookie(name) === String(value)) return;
    }
    document.cookie = name + '=' + value + attrs; // repli : cookie limité à l'hôte
}

function deleteCookieEverywhere(name) {
    const past = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
    document.cookie = past;
    const root = getRootDomain();
    if (root) {
        document.cookie = past + '; domain=' + root;
        document.cookie = past + '; domain=.' + root;
    }
}

// true uniquement si l'utilisateur a donné son accord pour l'analytique
function shouldLoadGA() {
    const consent = getCookie('cookieConsent');
    if (consent === 'rejected') { cookiesRejected = true; return false; }
    if (!consent) return false;
    if (consent === 'all') return true;
    return consent === 'custom' && getCookie('analyticsCookies') === 'true';
}

// true tant qu'il n'y a pas d'accord (refus OU consentement pas encore donné)
function areCookiesRejected() {
    cookiesRejected = !shouldLoadGA();
    return cookiesRejected;
}

function setGADisabled(flag) {
    window['ga-disable-' + GA_MEASUREMENT_ID] = !!flag;
}

// =============== ID VISITEUR (1 seul par personne / navigateur) ===============
function generateVisitorId() {
    // Format proche de celui de GA : nombre.timestamp
    let rnd;
    try {
        const a = new Uint32Array(1);
        window.crypto.getRandomValues(a);
        rnd = a[0];
    } catch (e) {
        rnd = Math.floor(Math.random() * 4294967295);
    }
    return rnd + '.' + Math.floor(Date.now() / 1000);
}

function getVisitorId() {
    if (clientId) return clientId;

    // 1) on relit l'ID existant : cookie d'abord, sinon localStorage
    let id = getCookie(VISITOR_KEY) || sGet('local', VISITOR_KEY);
    // 2) sinon on en crée un nouveau
    if (!id) id = generateVisitorId();
    clientId = id;

    // 3) on l'écrit (cookie partagé + localStorage) UNIQUEMENT si l'utilisateur a accepté l'analytique.
    //    Chaque page relit puis réécrit : si l'un des deux stockages avait été vidé, il est restauré,
    //    et les doublons de cookies (host-only / domaine) sont nettoyés.
    if (shouldLoadGA()) {
        setCookie(VISITOR_KEY, id, VISITOR_DAYS, true);
        sSet('local', VISITOR_KEY, id);
    }
    return id;
}
const getClientId = getVisitorId; // compatibilité

// Efface tout ce qui identifie le visiteur (refus du consentement)
function clearVisitorId() {
    clientId = null;
    gtagSessionId = null;
    deleteCookieEverywhere(VISITOR_KEY);
    sDel('local', VISITOR_KEY);
    sDel('local', SESSION_KEY);
    sDel('local', 'ga_has_visited');
    sDel('local', NAV_HISTORY_KEY);
}

function resetAnalyticsState() {
    isGALoaded = false;
    gaInitStarted = false;
    cookiesRejected = true;
    setGADisabled(true);
    clearVisitorId();
    console.log('🔴 Analytics désactivé — consentement refusé');
}

// =============== SESSION (partagée entre les onglets) ===============
function readSession() {
    try {
        const raw = sGet('local', SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}
function writeSession(s) { sSet('local', SESSION_KEY, JSON.stringify(s)); }

function getSessionId() {
    const now = Date.now();
    const s = readSession();
    if (s && s.id && (now - s.last_activity) < SESSION_DURATION) {
        s.last_activity = now;
        writeSession(s);
        sessionJustCreated = false;
        return s.id;
    }
    const fresh = { id: String(Math.floor(now / 1000)), started_at: now, last_activity: now, page_count: 0 };
    writeSession(fresh);
    sessionJustCreated = true;
    console.log('🆕 Nouvelle session:', fresh.id);
    return fresh.id;
}

function getSessionPageCount() {
    const s = readSession();
    return (s && s.page_count) || 1;
}

function incrementSessionPageCount() {
    if (pageCountIncremented) return getSessionPageCount();
    pageCountIncremented = true;
    const s = readSession();
    if (s) {
        s.page_count = (s.page_count || 0) + 1;
        writeSession(s);
        return s.page_count;
    }
    return 1;
}

function markVisit() { sSet('local', 'ga_has_visited', '1'); }

// session_id réel de gtag (lecture asynchrone). Sert au repli API pour rester dans la MÊME session.
function fetchGtagSessionId() {
    try {
        if (typeof window.gtag !== 'function') return;
        window.gtag('get', GA_MEASUREMENT_ID, 'session_id', function (sid) {
            if (sid) gtagSessionId = String(sid);
        });
    } catch (e) {}
}

// =============== UTILITAIRES ===============
function safeReferrerHostname() {
    if (!document.referrer) return 'direct';
    try { return new URL(document.referrer).hostname; }
    catch (e) { return 'unknown'; }
}

// Respecte les limites GA4 : 25 paramètres, 100 caractères, engagement_time_msec numérique
function sanitizeParams(params) {
    const out = {};
    let n = 0;
    for (const key of Object.keys(params || {})) {
        let v = params[key];
        if (v === undefined || v === null || v === '') continue;
        if (n >= 25) break;
        if (key === 'engagement_time_msec') v = Math.max(1, Math.round(Number(v)) || 1);
        else if (typeof v === 'boolean') v = v ? 'true' : 'false';
        else if (typeof v === 'string') v = v.slice(0, 100);
        else if (typeof v !== 'number') v = String(v).slice(0, 100);
        out[key.slice(0, 40)] = v;
        n++;
    }
    return out;
}

function pick(obj, keys) {
    const o = {};
    keys.forEach(k => { if (obj[k] !== undefined) o[k] = obj[k]; });
    return o;
}

const DEVICE_KEYS = ['screen_width', 'screen_height', 'viewport_width', 'viewport_height', 'pixel_ratio',
    'color_depth', 'orientation', 'connection_type', 'connection_downlink', 'connection_rtt', 'save_data',
    'language', 'languages', 'platform', 'do_not_track', 'online'];
const PAGE_KEYS = ['load_time_dns', 'load_time_connect', 'load_time_ttfb', 'load_time_dom', 'load_time_total',
    'session_page_count', 'is_returning', 'referrer', 'referrer_full',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

function getEnrichedUserData() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
    const perf = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
    const params = new URLSearchParams(window.location.search);
    const ms = (a, b) => Math.round(a - b) || 0;

    return {
        screen_width:        window.screen.width,
        screen_height:       window.screen.height,
        viewport_width:      window.innerWidth,
        viewport_height:     window.innerHeight,
        pixel_ratio:         window.devicePixelRatio || 1,
        color_depth:         window.screen.colorDepth,
        orientation:         (screen.orientation && screen.orientation.type) || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'),
        connection_type:     conn.effectiveType || 'unknown',
        connection_downlink: conn.downlink || null,
        connection_rtt:      conn.rtt || null,
        save_data:           conn.saveData || false,
        language:            navigator.language || 'unknown',
        languages:           (navigator.languages || []).join(','),
        platform:            navigator.platform || 'unknown',
        do_not_track:        navigator.doNotTrack === '1',
        online:              navigator.onLine,
        load_time_dns:       ms(perf.domainLookupEnd, perf.domainLookupStart),
        load_time_connect:   ms(perf.connectEnd, perf.connectStart),
        load_time_ttfb:      ms(perf.responseStart, perf.requestStart),
        load_time_dom:       ms(perf.domContentLoadedEventEnd, perf.startTime),
        load_time_total:     ms(perf.loadEventEnd, perf.startTime),
        session_page_count:  incrementSessionPageCount(),
        is_returning:        !!sGet('local', 'ga_has_visited'),
        referrer:            safeReferrerHostname(),
        referrer_full:       document.referrer || 'direct',
        utm_source:          params.get('utm_source'),
        utm_medium:          params.get('utm_medium'),
        utm_campaign:        params.get('utm_campaign'),
        utm_content:         params.get('utm_content'),
        utm_term:            params.get('utm_term')
    };
}

function whenLoaded(cb) {
    if (document.readyState === 'complete') setTimeout(cb, 0);
    else window.addEventListener('load', () => setTimeout(cb, 0), { once: true });
}

// =============== ENVOI : gtag OU API (jamais les deux) ===============
async function sendToSecureAPI(eventName, params = {}) {
    if (!shouldLoadGA()) return false;
    try {
        const visitorId = getVisitorId();
        const payload = {
            client_id: visitorId,
            user_id:   visitorId, // même ID que gtag → GA4 fusionne les deux flux
            timestamp_micros: Math.floor(Date.now() * 1000),
            events: [{
                name: eventName,
                params: sanitizeParams({
                    page_title:           getPageTitle(),
                    page_location:        window.location.href,
                    page_path:            getPagePath(),
                    page_referrer:        document.referrer || '',
                    device_type:          deviceType,
                    // v7 : on réutilise la session de gtag quand elle est connue
                    session_id:           gtagSessionId || getSessionId(),
                    engagement_time_msec: 1,
                    ...params
                })
            }]
        };

        const response = await fetch('/api/ga-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
            credentials: 'omit'
        });
        if (response.ok) { console.log('📡 [API] ' + eventName); return true; }
        console.warn('⚠️ [API] ' + eventName + ' — statut HTTP ' + response.status);
        return false;
    } catch (error) {
        console.warn('⚠️ [API]', error);
        return false;
    }
}

function track(eventName, params = {}) {
    if (!shouldLoadGA()) return;
    const p = sanitizeParams(params);
    if (gtagLoaded && typeof window.gtag === 'function') {
        window.gtag('event', eventName, p);
    } else {
        sendToSecureAPI(eventName, p);
    }
}

// =============== DEBUG CONSOLE : ÉTAT DU CONSENTEMENT ===============
function logConsentStatus() {
    const consent = getCookie('cookieConsent');
    const analytics = getCookie('analyticsCookies');
    console.groupCollapsed('🍪 Analytics — État du consentement');
    if (!consent) console.log('%c⏳ En attente de consentement cookies', 'color: orange; font-weight: bold;');
    else if (consent === 'rejected') console.log('%c🔴 Cookies refusés', 'color: red; font-weight: bold;');
    else if (consent === 'all') console.log('%c✅ Tous les cookies acceptés', 'color: green; font-weight: bold;');
    else console.log('%c🟡 Personnalisé — analytics : ' + (analytics === 'true' ? 'activé' : 'désactivé'), 'color: gold; font-weight: bold;');
    console.log('   Page:', getPageTitle(), '|', getPagePath());
    console.groupEnd();
}

// =============== INITIALISATION GA4 ===============
function initializeGoogleAnalytics() {
    if (!shouldLoadGA()) return;
    if (isGALoaded || gaInitStarted) return;
    gaInitStarted = true;
    cookiesRejected = false;
    setGADisabled(false);

    console.log('🚀 Init GA4 v7...');

    const visitorId = getVisitorId();
    getSessionId();
    const isNewSession = sessionJustCreated;
    const isReturning = !!sGet('local', 'ga_has_visited');
    markVisit();

    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
        window.gtag = function () { window.dataLayer.push(arguments); };
    }

    // v7 : un seul gtag('config') pour cet ID, même si le script est relancé ou chargé en double
    if (!window.__unwareGAConfigured) {
        window.__unwareGAConfigured = true;

        gtag('js', new Date());
        gtag('set', 'user_properties', {
            device_type:       deviceType,
            screen_resolution: window.screen.width + 'x' + window.screen.height,
            language:          navigator.language || 'unknown',
            connection_type:   (navigator.connection || {}).effectiveType || 'unknown',
            is_returning:      isReturning ? 'returning' : 'new'
        });

        const config = {
            page_title:           getPageTitle(),
            page_location:        window.location.href,
            page_path:            getPagePath(),
            device_type:          deviceType,
            anonymize_ip:         true,
            allow_google_signals: false,
            client_id:            visitorId, // ID visiteur stable
            user_id:              visitorId, // même ID → utilisateur unique dans GA4
            transport_type:       'beacon'
            // session_id volontairement absent : gtag gère lui-même la session
        };
        if (document.referrer) config.page_referrer = document.referrer;
        gtag('config', GA_MEASUREMENT_ID, config); // envoie automatiquement 1 page_view
    } else {
        console.warn('⚠️ gtag("config") déjà fait pour ' + GA_MEASUREMENT_ID + ' — pas de second envoi');
    }

    function ready(ok) {
        isGALoaded = true;
        gtagLoaded = ok;
        if (ok) {
            fetchGtagSessionId();
            setTimeout(fetchGtagSessionId, 1500); // la session peut être créée un peu après le chargement
        } else {
            // gtag.js bloqué : on passe par l'API pour ne rien perdre
            console.warn('⚠️ gtag.js bloqué — repli sur /api/ga-event');
            if (isNewSession) track('session_start', { engagement_time_msec: 1 });
            track('page_view', { engagement_time_msec: 100 });
        }
        whenLoaded(() => {
            if (!shouldLoadGA()) return;
            let enriched = {};
            try { enriched = getEnrichedUserData(); } catch (e) { console.warn('⚠️ getEnrichedUserData a échoué:', e); }
            track('device_context', pick(enriched, DEVICE_KEYS));
            track('page_context', pick(enriched, PAGE_KEYS));
        });
        initEventTracking();
    }

    if (gaScriptInjected) { ready(gtagLoaded); return; }
    gaScriptInjected = true;

    // v7 : si gtag.js est déjà présent dans la page (autre script), on ne le recharge pas
    const already = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
    if (already) {
        console.warn('⚠️ gtag.js déjà présent dans la page — pas de second chargement');
        ready(true);
        return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    script.onload  = () => ready(true);
    script.onerror = () => ready(false);
    document.head.appendChild(script);
}

// =============== SORTIE DE PAGE (une seule fois) ===============
const exitCallbacks = [];
let exitFlushed = false;
function onPageExit(cb) { exitCallbacks.push(cb); }
function flushExit() {
    if (exitFlushed) return;
    exitFlushed = true;
    if (!shouldLoadGA()) return;
    exitCallbacks.forEach(cb => { try { cb(); } catch (e) {} });
}
window.addEventListener('pagehide', flushExit);
window.addEventListener('beforeunload', flushExit);
window.addEventListener('pageshow', e => { if (e.persisted) exitFlushed = false; });

// =============== ÉVÉNEMENTS CLÉS ===============
// Envoyé immédiatement au clic (pas de délai) pour ne rien perdre, même si la page change.
function trackKeyEvent(link, clickType) {
    if (!shouldLoadGA() || !link || !link.href) return;
    const name = link.getAttribute('data-track-name') || '';
    const href = link.href || '';

    const def = KEY_EVENTS.find(k =>
        (k.track_name && k.track_name === name) ||
        (k.hrefContains && href.indexOf(k.hrefContains) > -1)
    );
    if (!def) return;

    // Anti-doublon : un même événement clé n'est envoyé qu'une fois par seconde
    const now = Date.now();
    if (lastKeyEventAt[def.event] && (now - lastKeyEventAt[def.event]) < 1000) return;
    lastKeyEventAt[def.event] = now;

    const img = link.querySelector('img');
    track(def.event, Object.assign({
        track_name:   name,
        link_url:     href,
        link_text:    ((link.innerText || (img && img.alt) || '')).trim().slice(0, 80),
        click_type:   clickType || 'normal',
        page_title:   getPageTitle(),
        engagement_time_msec: 100
    }, def.params || {}));
    console.log('⭐ Événement clé : ' + def.event);
}

// =============== TRACKING ÉVÉNEMENTS ===============
function initEventTracking() {
    if (eventTrackingStarted) return;
    eventTrackingStarted = true;
    console.log('🎯 Tracking v7 activé...');

    document.addEventListener('click', (e) => {
        if (!shouldLoadGA()) return;
        const link = e.target.closest && e.target.closest('a[href]');
        if (link && link.href) {
            sSet('session', NEXT_PAGE_KEY, link.href);
            trackKeyEvent(link, 'normal');
        }
        const target = e.target;
        setTimeout(() => trackClick(target), 50);
    }, { capture: true, passive: true });

    // Clic molette (ouverture dans un nouvel onglet)
    document.addEventListener('auxclick', (e) => {
        if (e.button !== 1 || !shouldLoadGA()) return;
        const link = e.target.closest && e.target.closest('a[href]');
        if (link) trackKeyEvent(link, 'milieu');
    }, { capture: true, passive: true });

    document.addEventListener('submit', (e) => {
        if (!shouldLoadGA()) return;
        trackFormSubmit(e.target);
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

function trackScrollDepth() {
    const milestones = [10, 25, 50, 75, 90, 100];
    const reached = new Set();
    window.addEventListener('scroll', () => {
        if (!shouldLoadGA()) return;
        const total = document.documentElement.scrollHeight - window.innerHeight;
        if (total <= 0) return;
        const pct = Math.round((window.scrollY / total) * 100);
        milestones.forEach(m => {
            if (pct >= m && !reached.has(m)) {
                reached.add(m);
                track('scroll_' + m, { scroll_depth_pct: m, page_title: getPageTitle(), engagement_time_msec: 1000 });
            }
        });
    }, { passive: true });
}

function trackTimeOnPage() {
    const milestones = [5, 15, 30, 60, 120, 300];
    const reached = new Set();
    const startTime = Date.now();

    const timer = setInterval(() => {
        if (!shouldLoadGA()) return;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        milestones.forEach(m => {
            if (elapsed >= m && !reached.has(m)) {
                reached.add(m);
                track('time_' + m + 's', { seconds_on_page: m, page_title: getPageTitle(), engagement_time_msec: m * 1000 });
            }
        });
        if (reached.size === milestones.length) clearInterval(timer);
    }, 3000);

    onPageExit(() => {
        const total = Math.round((Date.now() - startTime) / 1000);
        track('page_exit', {
            seconds_on_page: total,
            exit_page:       getPagePath(),
            next_page:       sGet('session', NEXT_PAGE_KEY) || 'unknown',
            page_title:      getPageTitle(),
            engagement_time_msec: Math.max(total, 1) * 1000
        });
        sDel('session', NEXT_PAGE_KEY);
    });
}

function trackPageVisibility() {
    let hiddenAt = null;
    document.addEventListener('visibilitychange', () => {
        if (!shouldLoadGA()) return;
        if (document.hidden) {
            hiddenAt = Date.now();
            track('tab_hidden', { page_title: getPageTitle() });
        } else if (hiddenAt) {
            const away = Math.round((Date.now() - hiddenAt) / 1000);
            hiddenAt = null;
            track('tab_returned', { away_seconds: away, page_title: getPageTitle() });
        }
    });
}

function trackRageClicks() {
    let clicks = [];
    document.addEventListener('click', (e) => {
        if (!shouldLoadGA()) return;
        const now = Date.now();
        clicks.push({ x: e.clientX, y: e.clientY, t: now });
        clicks = clicks.filter(c => now - c.t < 1000);
        if (clicks.length >= 3) {
            const xs = clicks.map(c => c.x), ys = clicks.map(c => c.y);
            if (Math.max(...xs) - Math.min(...xs) < 30 && Math.max(...ys) - Math.min(...ys) < 30) {
                const cls = e.target.classList ? [...e.target.classList].join('.') : '';
                const el = e.target.tagName + (cls ? '.' + cls : '');
                track('rage_click', { element: el, page_title: getPageTitle() });
                clicks = [];
            }
        }
    }, { passive: true });
}

function trackCopyPaste() {
    document.addEventListener('copy', () => {
        if (!shouldLoadGA()) return;
        const sel = window.getSelection ? window.getSelection() : null;
        track('text_copy', { copied_length: sel ? sel.toString().length : 0, page_title: getPageTitle() });
    });
}

function trackExternalLinks() {
    document.addEventListener('click', (e) => {
        if (!shouldLoadGA()) return;
        const link = e.target.closest && e.target.closest('a[href]');
        if (!link || !link.href) return;
        let host;
        try { host = new URL(link.href, window.location.href).hostname; } catch (err) { return; }
        if (!/^https?:/.test(link.href) || host === window.location.hostname) return;

        const map = [
            ['drive.google.com', 'google_drive'], ['discord.gg', 'discord'], ['discord.com', 'discord'],
            ['youtube.com', 'youtube'], ['youtu.be', 'youtube'], ['twitch.tv', 'twitch'],
            ['tiktok.com', 'tiktok'], ['instagram.com', 'instagram'], ['lcpdfr.com', 'lcpdfr'],
            ['itch.io', 'itch_io'], ['linktr.ee', 'linktree']
        ];
        const hit = map.find(([d]) => host === d || host.endsWith('.' + d));
        track('outbound_link', {
            outbound_url: link.href,
            destination:  hit ? hit[1] : 'other',
            link_text:    (link.textContent || '').trim(),
            link_name:    link.getAttribute('data-track-name') || '',
            page_title:   getPageTitle()
        });
    }, { passive: true });
}

function trackJSErrors() {
    window.addEventListener('error', (e) => {
        if (!shouldLoadGA()) return;
        track('js_error', {
            error_message: (e.message || 'unknown'),
            error_file:    (e.filename || 'unknown'),
            error_line:    e.lineno || 0,
            page_title:    getPageTitle()
        });
    });
    window.addEventListener('unhandledrejection', (e) => {
        if (!shouldLoadGA()) return;
        const r = e.reason;
        track('js_error', {
            error_message: (r && r.message) || String(r),
            error_type:    'promise_rejected',
            page_title:    getPageTitle()
        });
    });
}

function trackWebVitals() {
    let lcp = 0, cls = 0, worstINP = 0, worstINPName = '';

    try {
        new PerformanceObserver((list) => {
            const last = list.getEntries().slice(-1)[0];
            if (last) lcp = Math.round(last.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {}

    try {
        new PerformanceObserver((list) => {
            list.getEntries().forEach(en => { if (!en.hadRecentInput) cls += en.value; });
        }).observe({ type: 'layout-shift', buffered: true });
    } catch (e) {}

    try {
        let fcpSent = false;
        new PerformanceObserver((list) => {
            const en = list.getEntries().find(x => x.name === 'first-contentful-paint');
            if (en && !fcpSent) {
                fcpSent = true;
                track('vital_fcp', { value_ms: Math.round(en.startTime), page_title: getPageTitle() });
            }
        }).observe({ type: 'paint', buffered: true });
    } catch (e) {}

    try {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav) {
            const ttfb = Math.round(nav.responseStart - nav.requestStart);
            setTimeout(() => track('vital_ttfb', { value_ms: ttfb, page_title: getPageTitle() }), 2000);
        }
    } catch (e) {}

    try {
        new PerformanceObserver((list) => {
            list.getEntries().forEach(en => {
                if (en.duration > worstINP) { worstINP = en.duration; worstINPName = en.name; }
            });
        }).observe({ type: 'event', durationThreshold: 40, buffered: true });
    } catch (e) {}

    onPageExit(() => {
        if (lcp > 0) track('vital_lcp', { value_ms: lcp, page_title: getPageTitle() });
        track('vital_cls', { value: Math.round(cls * 1000) / 1000, page_title: getPageTitle() });
        if (worstINP > 0) track('vital_inp', { value_ms: Math.round(worstINP), interaction: worstINPName, page_title: getPageTitle() });
    });
}

function trackInactivity() {
    let timer;
    let reported = false;
    const THRESHOLD = 3 * 60 * 1000;

    function reset() {
        if (reported) {
            reported = false;
            track('user_returned', { page_title: getPageTitle() });
        }
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (!shouldLoadGA()) return;
            reported = true;
            track('user_inactive', { page_title: getPageTitle() });
        }, THRESHOLD);
    }

    ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach(evt => {
        window.addEventListener(evt, reset, { passive: true });
    });
    reset();
}

function trackFirstEngagement() {
    let done = false;
    const types = ['click', 'scroll', 'keydown', 'touchstart'];
    function onFirst(e) {
        if (done || !shouldLoadGA()) return;
        done = true;
        const secs = Math.round(performance.now() / 1000);
        track('first_engagement', {
            seconds_to_engage: secs,
            interaction_type:  e.type,
            page_title:        getPageTitle(),
            engagement_time_msec: Math.max(secs, 1) * 1000
        });
        types.forEach(tp => window.removeEventListener(tp, onFirst));
    }
    types.forEach(tp => window.addEventListener(tp, onFirst, { passive: true }));
}

function trackHover() {
    const selectorMap = {
        'a[href]':       'hover_link',
        'button':        'hover_button',
        '.btn':          'hover_btn',
        '.gallery-card': 'hover_gallery_card',
        '.video-card':   'hover_video_card',
        '.nav-links a':  'hover_nav'
    };
    const hovered = new Set();

    function attach(el, eventName) {
        if (el._hoverTracked) return;
        el._hoverTracked = true;
        el.addEventListener('mouseenter', () => {
            if (!shouldLoadGA()) return;
            const label = (el.textContent || '').trim().slice(0, 30) || el.id || el.getAttribute('aria-label') || el.href || 'element';
            const key = eventName + '_' + label;
            if (hovered.has(key)) return;
            hovered.add(key);
            track(eventName, {
                element_text: (el.textContent || '').trim() || el.getAttribute('aria-label') || '',
                element_href: el.href || '',
                page_title:   getPageTitle()
            });
        }, { passive: true });
    }

    function scan() {
        Object.keys(selectorMap).forEach(sel => {
            document.querySelectorAll(sel).forEach(el => attach(el, selectorMap[sel]));
        });
    }

    scan();
    let scheduled = false;
    new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; scan(); });
    }).observe(document.body, { childList: true, subtree: true });
}

function trackClick(element) {
    if (!shouldLoadGA() || !element || !element.closest) return;
    const el = element.closest('a, button, .btn');
    if (!el) return;
    const text = (el.textContent || '').trim() || el.getAttribute('aria-label') || 'unknown';
    const trackName = el.getAttribute('data-track-name');
    track(trackName ? 'cta_click' : 'click', {
        event_category: 'engagement',
        event_label:    trackName || text,
        element_type:   el.tagName.toLowerCase(),
        element_href:   el.href || '',
        page_title:     getPageTitle(),
        engagement_time_msec: 50
    });
}

function trackFormSubmit(form) {
    if (!shouldLoadGA() || !form) return;
    track('form_submit', {
        event_category: 'form',
        event_label:    form.id || 'form_submit',
        form_id:        form.id || 'unknown',
        page_title:     getPageTitle(),
        engagement_time_msec: 100
    });
}

// =============== NAVIGATION INTER-PAGES ===============
function getNavigationHistory() {
    try { return JSON.parse(sGet('local', NAV_HISTORY_KEY) || '[]'); }
    catch (e) { return []; }
}
function saveNavigationHistory(history) {
    sSet('local', NAV_HISTORY_KEY, JSON.stringify(history.slice(-NAV_MAX_HISTORY)));
}
function recordPageEnter() { sSet('session', NAV_ENTER_KEY, String(Date.now())); }
function getTimeSpentOnCurrentPage() {
    const entered = parseInt(sGet('session', NAV_ENTER_KEY) || '0', 10);
    return entered ? Math.round((Date.now() - entered) / 1000) : 0;
}
// Ignore les entrées de plus de 30 min (visite précédente, pas la session en cours)
function getPreviousPage() {
    const h = getNavigationHistory();
    const last = h[h.length - 1];
    if (!last || (Date.now() - last.visited_at) > SESSION_DURATION) return null;
    return last;
}
function pushPageToHistory(path, title) {
    const h = getNavigationHistory();
    h.push({ path: path, title: title, visited_at: Date.now() });
    saveNavigationHistory(h);
}

let historyPatched = false;
function trackPageNavigation() {
    const currentPath  = getPagePath();
    const currentTitle = getPageTitle();
    const previous     = getPreviousPage();
    const navEntry     = performance.getEntriesByType('navigation')[0];
    const navType      = (navEntry && navEntry.type) || 'navigate';

    if (previous && previous.path !== currentPath) {
        track('page_navigation', {
            from_page:     previous.path,
            from_title:    previous.title,
            to_page:       currentPath,
            to_title:      currentTitle,
            nav_type:      navType,
            time_on_prev:  getTimeSpentOnCurrentPage(),
            session_depth: getSessionPageCount()
        });
    } else if (!previous) {
        track('page_navigation', {
            from_page:     safeReferrerHostname(),
            from_title:    document.referrer ? 'external' : 'direct',
            to_page:       currentPath,
            to_title:      currentTitle,
            nav_type:      navType,
            time_on_prev:  0,
            session_depth: 1
        });
    }

    pushPageToHistory(currentPath, currentTitle);
    recordPageEnter();

    if (historyPatched) return;
    historyPatched = true;
    ['pushState', 'replaceState'].forEach(method => {
        const original = history[method];
        history[method] = function () {
            const result = original.apply(this, arguments);
            window.dispatchEvent(new Event('locationchange'));
            return result;
        };
    });
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
    window.addEventListener('locationchange', onSPANavigation);
}

function onSPANavigation() {
    if (!shouldLoadGA()) return;
    const newPath  = getPagePath();
    const newTitle = getPageTitle();
    const previous = getPreviousPage();
    if (previous && previous.path === newPath) return;

    track('page_navigation', {
        from_page:     (previous && previous.path)  || 'unknown',
        from_title:    (previous && previous.title) || 'unknown',
        to_page:       newPath,
        to_title:      newTitle,
        nav_type:      'spa',
        time_on_prev:  getTimeSpentOnCurrentPage(),
        session_depth: getSessionPageCount()
    });
    // Un seul page_view (on n'appelle pas gtag('config') ici, qui en enverrait un second)
    track('page_view', { page_title: newTitle, page_location: window.location.href, page_path: newPath, engagement_time_msec: 100 });

    pushPageToHistory(newPath, newTitle);
    recordPageEnter();
}

// =============== COOKIES UI (ancienne bannière écrite dans la page) ===============
function showCookieBanner() {
    const banner = document.getElementById('custom-cookie-banner');
    if (getCookie('cookieConsent')) return;
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
        const aEl = document.getElementById('analyticsCookies');
        const pEl = document.getElementById('performanceCookies');
        if (aEl) aEl.checked = getCookie('analyticsCookies') === 'true';
        if (pEl) pEl.checked = getCookie('performanceCookies') === 'true';
        hideCookieBanner();
    }
}

function hideCookieSettings() {
    const modal = document.getElementById('cookieModal');
    if (modal) modal.classList.remove('show');
    if (!getCookie('cookieConsent')) setTimeout(showCookieBanner, 500);
}

function dispatchConsentEvent(consent, analytics) {
    document.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: { consent: consent, analytics: analytics } }));
}

function acceptCookies() {
    setCookie('cookieConsent', 'all', 365);
    setCookie('analyticsCookies', 'true', 365);
    setCookie('performanceCookies', 'true', 365);
    cookiesRejected = false;
    hideCookieBanner();
    dispatchConsentEvent('all', 'true'); // l'écouteur ci-dessous lance GA4 (sans doublon)
}

function rejectCookies() {
    setCookie('cookieConsent', 'rejected', 365);
    setCookie('analyticsCookies', 'false', 365);
    setCookie('performanceCookies', 'false', 365);
    resetAnalyticsState();
    hideCookieBanner();
    dispatchConsentEvent('rejected', 'false');
}

function saveCookiePreferences() {
    const a = document.getElementById('analyticsCookies');
    const p = document.getElementById('performanceCookies');
    const analyticsChecked = !!(a && a.checked);
    const performanceChecked = !!(p && p.checked);
    setCookie('cookieConsent', 'custom', 365);
    setCookie('analyticsCookies', analyticsChecked ? 'true' : 'false', 365);
    setCookie('performanceCookies', performanceChecked ? 'true' : 'false', 365);
    hideCookieSettings();
    hideCookieBanner();
    dispatchConsentEvent('custom', analyticsChecked ? 'true' : 'false');
}

// =============== ÉCOUTE DU CONSENTEMENT (cookie-banner.js ET ancienne bannière) ===============
document.addEventListener('cookieConsentChanged', function (e) {
    const d = (e && e.detail) || {};
    if (d.consent === 'rejected' || d.analytics !== 'true') {
        resetAnalyticsState();
        return;
    }
    cookiesRejected = false;
    setTimeout(initializeGoogleAnalytics, 100);
});

// =============== INIT PRINCIPALE ===============
function initAnalytics() {
    deviceType = detectDeviceType();
    logConsentStatus();

    const consent = getCookie('cookieConsent');
    if (!consent) {
        setTimeout(showCookieBanner, 1500); // sans effet si cookie-banner.js gère la bannière
        return;
    }
    if (!shouldLoadGA()) {
        setGADisabled(true);
        isGALoaded = false;
        return;
    }
    setTimeout(initializeGoogleAnalytics, 300);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAnalytics);
else initAnalytics();

// =============== DEBUG CONSOLE ===============
window.debugGA = {
    check: function () {
        console.log('🔍 GA v7:');
        console.log('- Consentement analytics :', shouldLoadGA());
        console.log('- GA Loaded / gtag OK    :', isGALoaded, '/', gtagLoaded);
        console.log('- cookieConsent          :', getCookie('cookieConsent'));
        console.log('- analyticsCookies       :', getCookie('analyticsCookies'));
        console.log('- ID visiteur (cookie)   :', getCookie(VISITOR_KEY));
        console.log('- ID visiteur (storage)  :', sGet('local', VISITOR_KEY));
        console.log('- ID envoyé à GA4        :', getVisitorId(), '(client_id = user_id)');
        console.log('- Session ID (repli API) :', gtagSessionId || getSessionId());
        console.log('- Device                 :', deviceType);
        console.log('- Page                   :', getPageTitle());
        console.log('- Enriched data          :', getEnrichedUserData());
    },
    // Diagnostic des doublons d'utilisateurs
    scan: function () {
        const scripts = [...document.querySelectorAll('script[src*="googletagmanager.com"]')].map(s => s.src);
        const ids = document.cookie.split(';').map(c => c.trim()).filter(c => c.indexOf(VISITOR_KEY + '=') === 0);
        console.groupCollapsed('🔎 Scan doublons GA4');
        console.log('Scripts gtag/GTM chargés (' + scripts.length + ') :', scripts);
        if (scripts.length > 1) console.warn('⚠️ Plusieurs scripts Google : un autre fichier charge aussi GA4 (cookie-banner.js ? analytics-clarify.js ?)');
        console.log('Cookies ' + VISITOR_KEY + ' visibles (' + ids.length + ') :', ids);
        if (ids.length > 1) console.warn('⚠️ Deux cookies ' + VISITOR_KEY + ' : relance la page, la v7 nettoie le doublon');
        console.log('Cookie _ga :', getCookie('_ga'));
        console.log('ID envoyé (client_id = user_id) :', getVisitorId());
        console.log('Session gtag :', gtagSessionId);
        console.log('gtag("config") déjà fait :', !!window.__unwareGAConfigured);
        console.log('dataLayer config pour cet ID :', (window.dataLayer || []).filter(x => x && x[0] === 'config' && x[1] === GA_MEASUREMENT_ID).length);
        console.groupEnd();
    },
    test: function () {
        if (!shouldLoadGA()) { console.log('⛔ Pas de consentement analytics'); return; }
        track('debug_test', { test: 'ok' });
        console.log('✅ debug_test envoyé via', gtagLoaded ? 'gtag' : 'API');
    },
    force:   () => { if (shouldLoadGA()) initializeGoogleAnalytics(); },
    apiTest: () => shouldLoadGA() ? sendToSecureAPI('api_test', { test: 'direct' }) : Promise.resolve(false),
    status:  () => logConsentStatus(),
    navHistory: function () {
        const h = getNavigationHistory();
        console.groupCollapsed('🗺️ Historique navigation (' + h.length + ' pages)');
        h.forEach((p, i) => console.log('  ' + (i + 1) + '. ' + p.title + ' — ' + p.path + ' (il y a ' + Math.round((Date.now() - p.visited_at) / 1000) + 's)'));
        console.groupEnd();
        return h;
    },
    clearNavHistory: function () {
        sDel('local', NAV_HISTORY_KEY);
        sDel('session', NAV_ENTER_KEY);
        console.log('🗑️ Historique navigation effacé');
    },
    reset: function () {
        ['cookieConsent', 'analyticsCookies', 'performanceCookies'].forEach(deleteCookieEverywhere);
        clearVisitorId();
        cookiesRejected = false;
        isGALoaded = false;
        location.reload();
    }
};
