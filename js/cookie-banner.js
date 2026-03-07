// ================================================================
// COOKIE BANNER — UNWARE STUDIO
// Version AUTO-INJECT · RGPD compliant
// ----------------------------------------------------------------
// Ce fichier s'auto-injecte sur TOUTES les pages du site.
// Il gère : HTML de la bannière + CSS + logique cookies
// Il dispatch 'cookieConsentChanged' pour analytics.js et analytics-clarify.js
// Usage : <script src="js/cookie-banner.js"></script> (sur chaque page)
// ================================================================

(function() {
    'use strict';

    // ── Pas de double injection ──
    if (document.getElementById('unware-cookie-banner')) return;

    // ================================================================
    // HELPERS COOKIES
    // ================================================================
    function getCookie(name) {
        var eq = name + "=", ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i].trim();
            if (c.indexOf(eq) === 0) return c.substring(eq.length);
        }
        return null;
    }

    function setCookie(name, value, days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = name + "=" + value + ";expires=" + date.toUTCString() + ";path=/;SameSite=Lax;Secure";
    }

    // ================================================================
    // DISPATCH CONSENTEMENT → analytics.js + analytics-clarify.js
    // ================================================================
    function dispatchConsent(consent, analytics) {
        document.dispatchEvent(new CustomEvent('cookieConsentChanged', {
            detail: { consent: consent, analytics: analytics }
        }));
        console.log('🍪 cookieConsentChanged dispatché:', consent, '| analytics:', analytics);
    }

    // ================================================================
    // CSS — injecté une seule fois dans le <head>
    // ================================================================
    function injectCSS() {
        if (document.getElementById('unware-cookie-css')) return;
        var style = document.createElement('style');
        style.id = 'unware-cookie-css';
        style.textContent = `
            /* ===== BANNIÈRE ===== */
            #unware-cookie-banner {
                position: fixed;
                bottom: 30px;
                right: 30px;
                max-width: 420px;
                background: #000000;
                color: #ffffff;
                padding: 28px;
                border-radius: 16px;
                z-index: 10000;
                display: none;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                border: 1px solid #333333;
                box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                box-sizing: border-box;
            }
            #unware-cookie-banner.ucb-show {
                display: block;
                animation: ucbSlideIn 0.5s ease;
            }
            #unware-cookie-banner.ucb-hiding {
                animation: ucbSlideOut 0.4s ease forwards;
            }
            @keyframes ucbSlideIn {
                from { opacity: 0; transform: translateY(30px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes ucbSlideOut {
                to { opacity: 0; transform: translateY(30px); }
            }

            .ucb-content { display: flex; flex-direction: column; gap: 20px; }
            .ucb-text h3 { margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #ffffff; }
            .ucb-text p  { margin: 0; font-size: 14px; color: #cccccc; line-height: 1.5; }

            .ucb-actions { display: flex; gap: 10px; justify-content: flex-end; }
            .ucb-btn {
                padding: 10px 20px;
                border: 1px solid #444444;
                border-radius: 8px;
                background: transparent;
                color: #ffffff;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 90px;
                font-family: inherit;
            }
            .ucb-btn:hover { transform: translateY(-1px); }
            .ucb-btn.ucb-reject   { background: rgba(255,255,255,0.05); }
            .ucb-btn.ucb-reject:hover { background: rgba(255,255,255,0.1); }
            .ucb-btn.ucb-settings { background: rgba(255,255,255,0.08); }
            .ucb-btn.ucb-settings:hover { background: rgba(255,255,255,0.15); }
            .ucb-btn.ucb-accept   { background: #ffffff; color: #000000; font-weight: 600; }
            .ucb-btn.ucb-accept:hover { background: #e0e0e0; }

            /* ===== MODAL ===== */
            #unware-cookie-modal {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8);
                z-index: 10001;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 20px;
                box-sizing: border-box;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            #unware-cookie-modal.ucb-show { display: flex; }

            .ucb-modal-content {
                background: #000000;
                padding: 30px;
                border-radius: 16px;
                max-width: 500px;
                width: 100%;
                max-height: 80vh;
                overflow-y: auto;
                border: 1px solid #333333;
                box-shadow: 0 25px 50px rgba(0,0,0,0.6);
                color: #ffffff;
                box-sizing: border-box;
            }
            .ucb-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid #333333;
            }
            .ucb-modal-header h3 { margin: 0; font-size: 18px; font-weight: 600; color: #ffffff; }

            .ucb-close-modal {
                background: rgba(255,255,255,0.1);
                border: 1px solid #444444;
                color: #ffffff;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                border-radius: 6px;
                width: 32px; height: 32px;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.3s ease;
                font-family: inherit;
            }
            .ucb-close-modal:hover { background: rgba(255,255,255,0.2); transform: rotate(90deg); }

            .ucb-options { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
            .ucb-option {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px;
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                border: 1px solid #333333;
                transition: all 0.3s ease;
            }
            .ucb-option:hover { background: rgba(255,255,255,0.08); border-color: #444444; }
            .ucb-option-info { flex: 1; margin-right: 20px; }
            .ucb-option-title { display: block; color: #ffffff; font-weight: 600; font-size: 15px; margin-bottom: 6px; }
            .ucb-option-desc  { font-size: 13px; color: #999999; line-height: 1.4; }

            /* Toggle switch */
            .ucb-toggle-wrap { position: relative; display: inline-block; width: 54px; height: 28px; flex-shrink: 0; }
            .ucb-toggle-input { opacity: 0; width: 0; height: 0; position: absolute; }
            .ucb-toggle-label {
                position: relative; display: block; width: 100%; height: 100%;
                background: #333333; border-radius: 20px; cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
                border: 2px solid transparent;
            }
            .ucb-toggle-label:before {
                content: ''; position: absolute; top: 2px; left: 2px;
                width: 20px; height: 20px; background: #666666; border-radius: 50%;
                transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            .ucb-toggle-input:checked + .ucb-toggle-label { background: #ffffff; border-color: #ffffff; }
            .ucb-toggle-input:checked + .ucb-toggle-label:before { transform: translateX(26px); background: #000000; }
            .ucb-toggle-label:hover:before { transform: scale(1.1); }
            .ucb-toggle-input:checked + .ucb-toggle-label:hover:before { transform: translateX(26px) scale(1.1); }
            .ucb-toggle-input:disabled + .ucb-toggle-label { opacity: 0.4; cursor: not-allowed; }
            .ucb-toggle-input:disabled + .ucb-toggle-label:hover:before { transform: none; }

            .ucb-modal-actions {
                display: flex; gap: 12px; justify-content: flex-end;
                margin-top: 25px; padding-top: 20px; border-top: 1px solid #333333;
            }
            .ucb-modal-btn {
                padding: 12px 24px;
                border: 1px solid #444444;
                border-radius: 10px;
                background: transparent;
                color: #ffffff;
                font-size: 14px; font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 100px;
                font-family: inherit;
            }
            .ucb-modal-btn.ucb-save   { background: #ffffff; color: #000000; font-weight: 600; border-color: #ffffff; }
            .ucb-modal-btn.ucb-save:hover   { background: #e0e0e0; transform: translateY(-1px); }
            .ucb-modal-btn.ucb-cancel { background: rgba(255,255,255,0.05); }
            .ucb-modal-btn.ucb-cancel:hover { background: rgba(255,255,255,0.1); transform: translateY(-1px); }

            /* ===== RESPONSIVE ===== */
            @media (max-width: 768px) {
                #unware-cookie-banner {
                    bottom: 0; right: 0; left: 0;
                    max-width: none;
                    border-radius: 16px 16px 0 0;
                    padding: 24px 20px;
                    animation: ucbSlideUp 0.5s ease;
                }
                #unware-cookie-banner.ucb-hiding {
                    animation: ucbSlideDown 0.4s ease forwards;
                }
                @keyframes ucbSlideUp {
                    from { opacity: 0; transform: translateY(100%); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes ucbSlideDown {
                    to { opacity: 0; transform: translateY(100%); }
                }
                .ucb-content { gap: 16px; }
                .ucb-text h3 { font-size: 16px; }
                .ucb-text p  { font-size: 13px; }
                .ucb-actions { flex-direction: column; gap: 8px; }
                .ucb-btn { width: 100%; min-width: auto; padding: 12px 16px; font-size: 14px; }

                #unware-cookie-modal { padding: 10px; align-items: flex-end; }
                .ucb-modal-content { border-radius: 16px 16px 0 0; padding: 24px 20px; max-height: 85vh; max-width: none; }
                .ucb-option { padding: 16px; flex-direction: column; align-items: flex-start; gap: 12px; }
                .ucb-option-info { margin-right: 0; }
                .ucb-toggle-wrap { align-self: flex-end; }
                .ucb-modal-actions { flex-direction: column; gap: 10px; }
                .ucb-modal-btn { width: 100%; min-width: auto; padding: 14px 16px; }
            }

            @media (max-width: 480px) {
                #unware-cookie-banner { padding: 20px 16px; }
                .ucb-modal-content { padding: 20px 16px; }
            }
        `;
        document.head.appendChild(style);
    }

    // ================================================================
    // HTML — bannière + modal injectés dans le <body>
    // ================================================================
    function injectHTML() {
        var wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <!-- Bannière cookies -->
            <div id="unware-cookie-banner">
                <div class="ucb-content">
                    <div class="ucb-text">
                        <h3>Respect de votre vie privée</h3>
                        <p>Nous utilisons des cookies pour améliorer votre expérience. Vous pouvez personnaliser vos préférences.</p>
                    </div>
                    <div class="ucb-actions">
                        <button class="ucb-btn ucb-reject"   id="ucb-reject">Refuser</button>
                        <button class="ucb-btn ucb-settings" id="ucb-settings">Personnaliser</button>
                        <button class="ucb-btn ucb-accept"   id="ucb-accept">Accepter</button>
                    </div>
                </div>
            </div>

            <!-- Modal préférences -->
            <div id="unware-cookie-modal">
                <div class="ucb-modal-content">
                    <div class="ucb-modal-header">
                        <h3>Gestion des cookies</h3>
                        <button class="ucb-close-modal" id="ucb-close-modal">&times;</button>
                    </div>
                    <div class="ucb-options">
                        <!-- Essentiels (toujours actifs) -->
                        <div class="ucb-option">
                            <div class="ucb-option-info">
                                <span class="ucb-option-title">Cookies essentiels</span>
                                <span class="ucb-option-desc">Nécessaires au bon fonctionnement du site. Ils ne peuvent pas être désactivés.</span>
                            </div>
                            <div class="ucb-toggle-wrap">
                                <input type="checkbox" class="ucb-toggle-input" id="ucb-essential" checked disabled>
                                <label class="ucb-toggle-label" for="ucb-essential"></label>
                            </div>
                        </div>
                        <!-- Analytics -->
                        <div class="ucb-option">
                            <div class="ucb-option-info">
                                <span class="ucb-option-title">Cookies analytiques</span>
                                <span class="ucb-option-desc">Nous aident à comprendre comment vous utilisez le site pour l'améliorer (Google Analytics, Microsoft Clarity).</span>
                            </div>
                            <div class="ucb-toggle-wrap">
                                <input type="checkbox" class="ucb-toggle-input" id="ucb-analytics">
                                <label class="ucb-toggle-label" for="ucb-analytics"></label>
                            </div>
                        </div>
                        <!-- Performance -->
                        <div class="ucb-option">
                            <div class="ucb-option-info">
                                <span class="ucb-option-title">Cookies de performance</span>
                                <span class="ucb-option-desc">Améliorent les performances du site en mémorisant vos préférences.</span>
                            </div>
                            <div class="ucb-toggle-wrap">
                                <input type="checkbox" class="ucb-toggle-input" id="ucb-performance">
                                <label class="ucb-toggle-label" for="ucb-performance"></label>
                            </div>
                        </div>
                    </div>
                    <div class="ucb-modal-actions">
                        <button class="ucb-modal-btn ucb-cancel" id="ucb-cancel">Annuler</button>
                        <button class="ucb-modal-btn ucb-save"   id="ucb-save">Enregistrer mes choix</button>
                    </div>
                </div>
            </div>
        `;

        // Insertion au début du body pour z-index correct
        document.body.insertBefore(wrapper.firstElementChild, document.body.firstChild);
        document.body.insertBefore(wrapper.firstElementChild, document.body.firstChild);
    }

    // ================================================================
    // AFFICHAGE / MASQUAGE BANNIÈRE
    // ================================================================
    function showBanner() {
        var banner = document.getElementById('unware-cookie-banner');
        if (!banner) return;
        // Ne pas afficher si un choix a déjà été fait
        if (getCookie('cookieConsent')) return;
        banner.classList.remove('ucb-hiding');
        banner.classList.add('ucb-show');
        console.log('🍪 Bannière cookies affichée');
    }

    function hideBanner() {
        var banner = document.getElementById('unware-cookie-banner');
        if (!banner) return;
        banner.classList.add('ucb-hiding');
        setTimeout(function() {
            banner.classList.remove('ucb-show');
            banner.classList.remove('ucb-hiding');
        }, 400);
    }

    // ================================================================
    // AFFICHAGE / MASQUAGE MODAL
    // ================================================================
    function showModal() {
        var modal = document.getElementById('unware-cookie-modal');
        if (!modal) return;

        // Pré-remplir les toggles avec les valeurs existantes
        var analytics    = getCookie('analyticsCookies');
        var performance  = getCookie('performanceCookies');
        var aEl = document.getElementById('ucb-analytics');
        var pEl = document.getElementById('ucb-performance');
        if (aEl) aEl.checked = analytics === 'true';
        if (pEl) pEl.checked = performance === 'true';

        modal.classList.add('ucb-show');
        hideBanner();
    }

    function hideModal() {
        var modal = document.getElementById('unware-cookie-modal');
        if (!modal) return;
        modal.classList.remove('ucb-show');
        // Réafficher la bannière si aucun choix fait
        if (!getCookie('cookieConsent')) {
            setTimeout(showBanner, 300);
        }
    }

    // ================================================================
    // ACTIONS COOKIES
    // ================================================================
    function acceptAll() {
        setCookie('cookieConsent',      'all',  365);
        setCookie('analyticsCookies',   'true', 365);
        setCookie('performanceCookies', 'true', 365);
        hideBanner();
        dispatchConsent('all', 'true');
        console.log('✅ Cookies acceptés');
    }

    function rejectAll() {
        setCookie('cookieConsent',      'rejected', 365);
        setCookie('analyticsCookies',   'false',    365);
        setCookie('performanceCookies', 'false',    365);
        hideBanner();
        dispatchConsent('rejected', 'false');
        console.log('❌ Cookies refusés');
    }

    function savePreferences() {
        var analyticsChecked    = document.getElementById('ucb-analytics')?.checked    || false;
        var performanceChecked  = document.getElementById('ucb-performance')?.checked  || false;

        setCookie('cookieConsent',      'custom',                      365);
        setCookie('analyticsCookies',   analyticsChecked  ? 'true' : 'false', 365);
        setCookie('performanceCookies', performanceChecked ? 'true' : 'false', 365);

        hideModal();
        hideBanner();
        dispatchConsent('custom', analyticsChecked ? 'true' : 'false');
        console.log('💾 Préférences sauvegardées — analytics:', analyticsChecked);
    }

    // ================================================================
    // LIAISON DES ÉVÉNEMENTS
    // ================================================================
    function bindEvents() {
        document.getElementById('ucb-accept')      ?.addEventListener('click', acceptAll);
        document.getElementById('ucb-reject')      ?.addEventListener('click', rejectAll);
        document.getElementById('ucb-settings')    ?.addEventListener('click', showModal);
        document.getElementById('ucb-close-modal') ?.addEventListener('click', hideModal);
        document.getElementById('ucb-cancel')      ?.addEventListener('click', hideModal);
        document.getElementById('ucb-save')        ?.addEventListener('click', savePreferences);

        // Fermer la modal en cliquant en dehors
        document.getElementById('unware-cookie-modal')?.addEventListener('click', function(e) {
            if (e.target === this) hideModal();
        });

        // Escape ferme la modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') hideModal();
        });
    }

    // ================================================================
    // DEBUG console
    // ================================================================
    function logStatus() {
        var consent  = getCookie('cookieConsent');
        var analytics = getCookie('analyticsCookies');

        console.groupCollapsed('🍪 Cookie Banner — État');
        if (!consent) {
            console.log('%c⏳ En attente de consentement', 'color: orange; font-weight: bold;');
        } else if (consent === 'rejected') {
            console.log('%c🔴 Cookies refusés', 'color: red; font-weight: bold;');
        } else if (consent === 'all') {
            console.log('%c✅ Tous les cookies acceptés', 'color: green; font-weight: bold;');
        } else {
            console.log('%c🟡 Consentement personnalisé — analytics:', 'color: gold; font-weight: bold;', analytics);
        }
        console.log('   Page:', window.location.pathname);
        console.groupEnd();
    }

    // ================================================================
    // INIT
    // ================================================================
    function init() {
        injectCSS();
        injectHTML();
        bindEvents();
        logStatus();

        var consent = getCookie('cookieConsent');
        if (!consent) {
            // Aucun choix → afficher la bannière après 1.5s
            setTimeout(showBanner, 1500);
        }
        // Si consentement déjà donné → rien à faire,
        // analytics.js et analytics-clarify.js s'en chargent au chargement
    }

    // ================================================================
    // API PUBLIQUE — pour debug et pour compatibilité index.html
    // (les fonctions acceptCookies / rejectCookies / saveCookiePreferences
    //  de l'ancien système sont remplacées par les fonctions internes,
    //  mais on expose les alias pour éviter les erreurs si elles sont
    //  encore appelées depuis d'autres scripts)
    // ================================================================
    window.ucbShowBanner   = showBanner;
    window.ucbHideBanner   = hideBanner;
    window.ucbShowModal    = showModal;
    window.ucbHideModal    = hideModal;
    window.ucbAccept       = acceptAll;
    window.ucbReject       = rejectAll;
    window.ucbSave         = savePreferences;

    // Aliases de compatibilité avec l'ancien système
    window.acceptCookies         = acceptAll;
    window.rejectCookies         = rejectAll;
    window.saveCookiePreferences = savePreferences;
    window.showCookieSettings    = showModal;
    window.hideCookieSettings    = hideModal;

    window.debugCookieBanner = {
        show:   showBanner,
        hide:   hideBanner,
        modal:  showModal,
        status: logStatus,
        reset: function() {
            ['cookieConsent','analyticsCookies','performanceCookies'].forEach(function(name) {
                document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            });
            console.log('🔄 Cookies réinitialisés — rechargement...');
            location.reload();
        }
    };

    // Lancement dès que le DOM est prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
