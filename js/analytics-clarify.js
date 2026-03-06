// =============== MICROSOFT CLARITY ===============
const CLARITY_PROJECT_ID = 'vrmfcq4hei'; // Votre ID Clarity
let isClarityLoaded = false;

// =============== INITIALISATION MICROSOFT CLARITY ===============
function initializeClarity() {
    // NE RIEN FAIRE si cookies refusés
    if (areCookiesRejected()) {
        console.log('⛔ Cookies refusés - Clarity non initialisé');
        return;
    }
    
    if (isClarityLoaded) {
        console.log('✅ Clarity déjà chargé');
        return;
    }
    
    if (!shouldLoadGA()) { // On utilise la même vérification de consentement
        console.log('⛔ Pas de consentement - Clarity désactivé');
        return;
    }
    
    console.log('🚀 Initialisation Microsoft Clarity...');
    
    // Script Clarity
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        
        // Callback de chargement
        t.onload = function() {
            console.log('✅ Microsoft Clarity chargé');
            isClarityLoaded = true;
            
            // Configuration supplémentaire si nécessaire
            if (window.clarity) {
                // Identifier l'utilisateur de manière cohérente avec GA
                clarity("set", "userId", getClientId());
                
                // Ajouter des métadonnées
                clarity("set", "deviceType", deviceType);
                clarity("set", "pageTitle", getPageTitle());
            }
        };
        
        t.onerror = function() {
            console.error('❌ Erreur chargement Clarity');
        };
        
    })(window, document, "clarity", "script", CLARITY_PROJECT_ID);
}

// =============== TRACKING CLARITY ===============
function trackClarityEvent(eventName, properties = {}) {
    if (areCookiesRejected() || !window.clarity) return;
    
    try {
        clarity("event", eventName, properties);
        console.log(`📡 [Clarity] Événement: ${eventName}`);
    } catch (error) {
        console.warn('⚠️ [Clarity] Erreur tracking:', error);
    }
}

// =============== MODIFICATION DE LA FONCTION initAnalytics ===============
function initAnalytics() {
    console.log('🌐 Initialisation analytics...');
    
    // Détecter device
    deviceType = detectDeviceType();
    console.log('📱 Device:', deviceType);
    
    // Vérifier immédiatement si cookies refusés
    if (areCookiesRejected()) {
        console.log('⛔ Cookies refusés - Analytics désactivé');
        // Désactiver toutes les fonctions de tracking
        isGALoaded = false;
        isClarityLoaded = false;
        return;
    }
    
    // Attacher événements cookies
    attachCookieEvents();
    
    // Vérifier consentement
    if (shouldLoadGA()) {
        console.log('✅ Consentement OK, chargement trackers...');
        setTimeout(() => {
            initializeGoogleAnalytics();
            initializeClarity(); // ✅ AJOUT : Initialiser Clarity
        }, 300);
    } else {
        console.log('🔄 En attente consentement...');
        // Afficher bannière seulement si pas déjà refusé
        if (!areCookiesRejected()) {
            setTimeout(showCookieBanner, 1500);
        }
    }
}

// =============== MODIFICATION DES FONCTIONS COOKIES ===============
function acceptCookies() {
    setCookie('cookieConsent', 'all', 365);
    setCookie('analyticsCookies', 'true', 365);
    setCookie('performanceCookies', 'true', 365);
    hideCookieBanner();
    setTimeout(() => {
        initializeGoogleAnalytics();
        initializeClarity(); // ✅ AJOUT
    }, 100);
}

function saveCookiePreferences() {
    const analyticsChecked = document.getElementById('analyticsCookies')?.checked;
    const performanceChecked = document.getElementById('performanceCookies')?.checked;
    
    setCookie('cookieConsent', 'custom', 365);
    setCookie('analyticsCookies', analyticsChecked ? 'true' : 'false', 365);
    setCookie('performanceCookies', performanceChecked ? 'true' : 'false', 365);
    
    if (analyticsChecked) {
        setTimeout(() => {
            initializeGoogleAnalytics();
            initializeClarity(); // ✅ AJOUT
        }, 100);
    }
    
    hideCookieSettings();
    hideCookieBanner();
}

// =============== TRACKING CLICKS AMÉLIORÉ AVEC CLARITY ===============
function trackClickSecure(element) {
    // Vérifier si cookies refusés
    if (areCookiesRejected()) return;
    
    const interactiveEl = element.closest('a, button, .btn');
    if (!interactiveEl) return;
    
    const text = interactiveEl.textContent?.trim()?.substring(0, 100) || 
                 interactiveEl.getAttribute('aria-label') || 
                 'unknown';
    
    // Envoyer à GA
    sendToSecureAPI('click', {
        event_category: 'engagement',
        event_label: text,
        element_type: interactiveEl.tagName.toLowerCase(),
        engagement_time_msec: '50'
    });
    
    // ✅ AJOUT : Envoyer à Clarity
    trackClarityEvent('click', {
        element_text: text,
        element_type: interactiveEl.tagName.toLowerCase(),
        element_id: interactiveEl.id || null,
        element_class: interactiveEl.className || null,
        page_title: getPageTitle()
    });
}

function trackFormSubmitSecure(form) {
    if (areCookiesRejected()) return;
    
    // Envoyer à GA
    sendToSecureAPI('form_submit', {
        event_category: 'form',
        event_label: form.id || 'form_submit',
        form_id: form.id || 'unknown',
        engagement_time_msec: '100'
    });
    
    // ✅ AJOUT : Envoyer à Clarity
    trackClarityEvent('form_submit', {
        form_id: form.id || 'unknown',
        form_name: form.name || null,
        form_action: form.action || null,
        page_title: getPageTitle()
    });
}

// =============== TRACKING SCROLL (NOUVEAU) ===============
let scrollTracked = false;
function trackScrollDepth() {
    if (areCookiesRejected() || scrollTracked || !window.clarity) return;
    
    const scrollPercent = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
    
    if (scrollPercent >= 25 && scrollPercent < 50) {
        trackClarityEvent('scroll_25', { page_title: getPageTitle() });
        scrollTracked = true; // Pour éviter les doublons
    } else if (scrollPercent >= 50 && scrollPercent < 75) {
        trackClarityEvent('scroll_50', { page_title: getPageTitle() });
    } else if (scrollPercent >= 75 && scrollPercent < 90) {
        trackClarityEvent('scroll_75', { page_title: getPageTitle() });
    } else if (scrollPercent >= 90) {
        trackClarityEvent('scroll_90', { page_title: getPageTitle() });
    }
}

// Ajouter l'écouteur de scroll
window.addEventListener('scroll', () => {
    if (!areCookiesRejected() && window.clarity) {
        requestAnimationFrame(trackScrollDepth);
    }
}, { passive: true });

// =============== DEBUG MIS À JOUR ===============
window.debugGA = {
    check: function() {
        console.log('🔍 État Analytics:');
        console.log('- Cookies refusés:', areCookiesRejected());
        console.log('- GA Loaded:', isGALoaded);
        console.log('- Clarity Loaded:', isClarityLoaded);
        console.log('- Page:', getPageTitle());
        console.log('- Device:', deviceType);
        console.log('- Client ID:', getClientId());
        console.log('- Consent:', getCookie('cookieConsent'));
        console.log('- Analytics cookies:', getCookie('analyticsCookies'));
        console.log('- Clarity Project:', CLARITY_PROJECT_ID);
    },
    
    test: function() {
        // Vérifier si cookies refusés
        if (areCookiesRejected()) {
            console.log('⛔ Cookies refusés - Test impossible');
            return;
        }
        
        // Test GA
        sendToSecureAPI('debug_test', {
            test: 'api_secure',
            timestamp: Date.now()
        }).then(success => {
            console.log(success ? '✅ Événement test GA envoyé' : '❌ Échec GA');
        });
        
        // Test Clarity
        if (window.clarity) {
            trackClarityEvent('debug_test', { 
                test: 'clarity_ok',
                timestamp: Date.now() 
            });
            console.log('✅ Événement test Clarity envoyé');
        } else {
            console.log('❌ Clarity non disponible');
        }
    },
    
    force: function() {
        if (areCookiesRejected()) {
            console.log('⛔ Impossible de forcer - Cookies refusés');
            return;
        }
        initializeGoogleAnalytics();
        initializeClarity();
    },
    
    reset: function() {
        // Supprimer tous les cookies de consentement
        document.cookie.split(";").forEach(function(c) {
            if (c.includes('cookieConsent') || c.includes('analyticsCookies') || c.includes('performanceCookies')) {
                const name = c.split("=")[0].trim();
                document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            }
        });
        cookiesRejected = false;
        isClarityLoaded = false;
        console.log('🔄 Cookies réinitialisés');
        location.reload();
    }
};

console.log('📊 Analytics Manager prêt (GA + Clarity) - Détection refus cookies activée');
