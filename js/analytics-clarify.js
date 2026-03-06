// =============== MICROSOFT CLARITY ===============
const CLARITY_PROJECT_ID = 'vrmfcq4hei'; // Votre ID Clarity
let isClarityLoaded = false;
let clarityLoadAttempted = false;

// =============== API SÉCURISÉE POUR CLARITY ===============
async function sendToClarityAPI(eventName, params = {}) {
    // NE RIEN ENVOYER si cookies refusés
    if (areCookiesRejected() || cookiesRejected) {
        console.log('⛔ Cookies refusés - Pas d\'envoi Clarity');
        return false;
    }
    
    // Vérifier le consentement
    if (!shouldLoadGA()) {
        console.log('⛔ Pas de consentement pour Clarity');
        return false;
    }
    
    try {
        const payload = {
            client_id: getClientId(),
            project_id: CLARITY_PROJECT_ID,
            timestamp: Date.now(),
            page_title: getPageTitle(),
            page_path: getPagePath(),
            device_type: deviceType,
            event: eventName,
            params: params
        };
        
        // Envoyer à votre API Vercel (même principe que GA)
        const response = await fetch('/api/clarity-event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            keepalive: true,
            mode: 'cors',
            credentials: 'omit'
        });
        
        if (response.ok) {
            console.log(`📡 [Clarity API] Événement envoyé: ${eventName}`);
            return true;
        }
        return false;
        
    } catch (error) {
        console.warn('⚠️ [Clarity API] Erreur:', error);
        return false;
    }
}

// =============== INITIALISATION MICROSOFT CLARITY (version légère) ===============
function initializeClarity() {
    if (areCookiesRejected()) {
        console.log('⛔ Cookies refusés - Clarity non initialisé');
        return;
    }
    
    if (isClarityLoaded) {
        return;
    }
    
    if (clarityLoadAttempted) {
        return;
    }
    
    if (!shouldLoadGA()) {
        console.log('⛔ Pas de consentement - Clarity désactivé');
        return;
    }
    
    console.log('🚀 Initialisation Microsoft Clarity (mode API uniquement)...');
    clarityLoadAttempted = true;
    
    // Au lieu d'essayer de charger le script (souvent bloqué),
    // on va simplement marquer comme chargé et utiliser notre API
    isClarityLoaded = true;
    
    // Envoyer un événement de page_view via l'API
    sendToClarityAPI('page_view', {
        engagement_time_msec: '100',
        session_id: 'session_' + Date.now()
    });
    
    // Simuler les fonctionnalités Clarity via notre API
    setupClarityTracking();
}

// =============== TRACKING CLARITY VIA API ===============
function setupClarityTracking() {
    console.log('🎯 Activation tracking Clarity (via API)...');
    
    // Tracking des clics
    document.addEventListener('click', function(e) {
        if (areCookiesRejected() || !isClarityLoaded) return;
        
        setTimeout(() => {
            trackClarityClick(e.target);
        }, 50);
    }, { passive: true });
    
    // Tracking des formulaires
    document.addEventListener('submit', function(e) {
        if (areCookiesRejected() || !isClarityLoaded) return;
        trackClarityForm(e.target);
    });
    
    // Tracking scroll
    setupClarityScrollTracking();
}

function trackClarityClick(element) {
    const interactiveEl = element.closest('a, button, .btn, [role="button"]');
    if (!interactiveEl) return;
    
    const text = interactiveEl.textContent?.trim()?.substring(0, 100) || 
                 interactiveEl.getAttribute('aria-label') || 
                 interactiveEl.getAttribute('title') ||
                 'unknown';
    
    sendToClarityAPI('click', {
        element_text: text,
        element_type: interactiveEl.tagName.toLowerCase(),
        element_id: interactiveEl.id || null,
        element_class: interactiveEl.className || null,
        element_href: interactiveEl.href || null,
        page_title: getPageTitle()
    });
}

function trackClarityForm(form) {
    sendToClarityAPI('form_submit', {
        form_id: form.id || 'unknown',
        form_name: form.name || null,
        form_action: form.action || null,
        form_method: form.method || null,
        page_title: getPageTitle()
    });
}

function setupClarityScrollTracking() {
    let scrollTracked = {
        25: false,
        50: false,
        75: false,
        90: false
    };
    
    window.addEventListener('scroll', () => {
        if (areCookiesRejected() || !isClarityLoaded) return;
        
        requestAnimationFrame(() => {
            const scrollPercent = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
            
            if (scrollPercent >= 25 && !scrollTracked[25]) {
                scrollTracked[25] = true;
                sendToClarityAPI('scroll_depth', { depth: 25, page_title: getPageTitle() });
            } else if (scrollPercent >= 50 && !scrollTracked[50]) {
                scrollTracked[50] = true;
                sendToClarityAPI('scroll_depth', { depth: 50, page_title: getPageTitle() });
            } else if (scrollPercent >= 75 && !scrollTracked[75]) {
                scrollTracked[75] = true;
                sendToClarityAPI('scroll_depth', { depth: 75, page_title: getPageTitle() });
            } else if (scrollPercent >= 90 && !scrollTracked[90]) {
                scrollTracked[90] = true;
                sendToClarityAPI('scroll_depth', { depth: 90, page_title: getPageTitle() });
            }
        });
    }, { passive: true });
}

// =============== MODIFICATION DE initAnalytics ===============
function initAnalytics() {
    console.log('🌐 Initialisation analytics...');
    
    // Détecter device
    deviceType = detectDeviceType();
    console.log('📱 Device:', deviceType);
    
    // Vérifier immédiatement si cookies refusés
    if (areCookiesRejected()) {
        console.log('⛔ Cookies refusés - Analytics désactivé');
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
            initializeGoogleAnalytics(); // Version API
            initializeClarity(); // Version API (contourne bloqueurs)
        }, 300);
    } else {
        console.log('🔄 En attente consentement...');
        if (!areCookiesRejected()) {
            setTimeout(showCookieBanner, 1500);
        }
    }
}

// =============== DEBUG MIS À JOUR ===============
window.debugGA = {
    check: function() {
        console.log('🔍 État Analytics:');
        console.log('- Cookies refusés:', areCookiesRejected());
        console.log('- GA Loaded (API):', isGALoaded);
        console.log('- Clarity Loaded (API):', isClarityLoaded);
        console.log('- Page:', getPageTitle());
        console.log('- Device:', deviceType);
        console.log('- Client ID:', getClientId());
        console.log('- Consent:', getCookie('cookieConsent'));
        console.log('- Analytics cookies:', getCookie('analyticsCookies'));
        console.log('- Clarity Project:', CLARITY_PROJECT_ID);
        
        // Vérifier si le script est bloqué
        const scripts = document.getElementsByTagName('script');
        let clarityBlocked = true;
        for (let script of scripts) {
            if (script.src && script.src.includes('clarity.ms')) {
                clarityBlocked = false;
                break;
            }
        }
        console.log('- Script Clarity visible:', clarityBlocked ? '❌ (bloqué)' : '✅');
        console.log('- Mode:', '🛡️ Contournement bloqueur ACTIF');
    },
    
    test: function() {
        console.log('🧪 TEST ENVOI ÉVÉNEMENTS');
        
        if (areCookiesRejected()) {
            console.log('⛔ Cookies refusés');
            return;
        }
        
        // Test GA API
        sendToSecureAPI('debug_test', { test: 'ga_api', time: Date.now() });
        
        // Test Clarity API
        sendToClarityAPI('debug_test', { test: 'clarity_api', time: Date.now() });
        
        console.log('✅ Tests envoyés (contournement bloqueur actif)');
    },
    
    force: function() {
        console.log('🔄 Force reload (mode API)');
        isClarityLoaded = false;
        clarityLoadAttempted = false;
        isGALoaded = false;
        setTimeout(() => {
            initializeGoogleAnalytics();
            initializeClarity();
        }, 100);
    }
};
