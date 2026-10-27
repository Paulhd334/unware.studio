// =============== live-tracker.js — signal « en direct » pour le dashboard ===============
// À charger sur chaque page, APRÈS analytics.js :  <script src="/live-tracker.js" defer></script>
// N'envoie RIEN tant que le visiteur n'a pas accepté les cookies d'analyse.
// Envoie : page (sans paramètres), titre, appareil, scroll, temps passé, clics (lien ou bouton).
// Ne lit jamais : adresse e-mail, champs de formulaire, texte saisi.
(function () {
  'use strict';
  var ENDPOINT = '/api/live';
  var BEAT = 10000;                  // un signal toutes les 10 s (onglet visible)
  var enteredAt = Date.now();
  var maxScroll = 0;
  var lastVid = null;

  function cookie(name) {
    var parts = document.cookie.split(';');
    for (var i = 0; i < parts.length; i++) {
      var c = parts[i].trim();
      if (c.indexOf(name + '=') === 0) {
        var raw = c.slice(name.length + 1);
        try { return decodeURIComponent(raw); } catch (e) { return raw; }
      }
    }
    return null;
  }
  function truthy(v) { return /^(true|1|yes|on|granted|accepted)$/i.test(String(v || '')); }

  // Même règle que analytics.js : accord « all » ou « custom » avec analytics activé
  function consented() {
    var c = (cookie('cookieConsent') || '').toLowerCase();
    if (c === 'all' || c === 'accepted' || c === 'granted') return true;
    if (c === 'custom') return truthy(cookie('analyticsCookies'));
    return false;
  }
  function visitorId() {
    var id = cookie('ga_client_id');
    if (!id) { try { id = localStorage.getItem('ga_client_id'); } catch (e) {} }
    return id && /^[\w.\-]{3,100}$/.test(id) ? id : null;
  }
  function deviceType() {
    var ua = navigator.userAgent.toLowerCase();
    if (/ipad|tablet/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) return 'tablet';
    if (/mobi|iphone|ipod|android/.test(ua)) return 'mobile';
    return 'desktop';
  }
  function scrollPct() {
    var total = document.documentElement.scrollHeight - window.innerHeight;
    return total > 0 ? Math.min(100, Math.round(window.scrollY / total * 100)) : 100;
  }

  function post(obj, beacon) {
    var body = JSON.stringify(obj);
    try {
      if (beacon && navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
      else fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: true, credentials: 'omit' });
    } catch (e) {}
  }

  function send(extra, beacon) {
    if (!consented()) return;
    var vid = visitorId();
    if (!vid) return;               // analytics.js n'a pas encore créé l'identifiant
    lastVid = vid;
    var o = {
      vid: vid,
      path: location.pathname,      // jamais de ?paramètres ni de #ancre
      title: (document.title || '').slice(0, 80),
      device: deviceType(),
      scroll: maxScroll,
      age: Date.now() - enteredAt,
      hidden: document.hidden
    };
    for (var k in extra) o[k] = extra[k];
    post(o, beacon);
  }

  // Retrait du consentement : on efface la fiche immédiatement
  function wipe() {
    var vid = lastVid || visitorId();
    if (vid) post({ vid: vid, wipe: true }, true);
  }

  // ── Clics : lien exact (sans paramètres) ou bouton ──
  document.addEventListener('click', function (e) {
    if (!consented() || !e.target || !e.target.closest) return;
    var a = e.target.closest('a[href]');
    var btn = a ? null : e.target.closest('button, .btn');
    var el = a || btn;
    if (!el) return;
    var img = el.querySelector && el.querySelector('img');
    var label = (el.getAttribute('aria-label') || el.textContent || (img && img.alt) || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    var to = '';
    if (a) {
      try {
        var u = new URL(a.href, location.href);
        if (u.protocol === 'http:' || u.protocol === 'https:') to = u.hostname + u.pathname; // mailto:, tel: → on ne garde rien
      } catch (err) {}
    }
    send({ event: { t: a ? 'link' : 'button', label: label, to: to } });
  }, { capture: true, passive: true });

  window.addEventListener('scroll', function () {
    var p = scrollPct();
    if (p > maxScroll) maxScroll = p;
  }, { passive: true });

  setInterval(function () { if (!document.hidden) send({}); }, BEAT);
  document.addEventListener('visibilitychange', function () { send({}); }); // onglet masqué / réaffiché
  window.addEventListener('pagehide', function () { send({ leave: true }, true); });
  document.addEventListener('cookieConsentChanged', function () {
    if (consented()) setTimeout(function () { send({}); }, 600);
    else wipe();
  });

  setTimeout(function () { send({}); }, 1500); // premier signal peu après le chargement
})();
