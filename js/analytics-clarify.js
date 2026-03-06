// =============== MICROSOFT CLARITY ===============
const CLARITY_PROJECT_ID = 'vrmfcq4hei'; // Votre ID Clarity
let isClarityLoaded = false;
let clarityLoadAttempted = false;

// =============== VÉRIFICATION COOKIES (mêmes fonctions que analytics.js) ===============
// On réutilise les mêmes fonctions de gestion des cookies
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}

function areCookiesRejected() {
    const consent = getCookie('cookieConsent');
    return consent === 'rejected';
}

function shouldLoadClarity() {
    const consent = getCookie('cookieConsent');
    if (consent === 'rejected') return false;
    
    const analytics = getCookie('analyticsCookies');
    return consent && (consent === 'all' || (consent === 'custom' && analytics === 'true'));
}

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
    
    if (clarityLoadAttempted) {
        console.log('⏳ Clarity déjà en cours de chargement...');
        return;
    }
    
    if (!shouldLoadClarity()) {
        console.log('⛔ Pas de consentement - Clarity désactivé');
        return;
    }
    
    console.log('🚀 Initialisation Microsoft Clarity (ID: ' + CLARITY_PROJECT_ID + ')...');
    clarityLoadAttempted = true;
    
    try {
        // Script Clarity
        (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";
            y=l.getElementsByTagName(r)[0];
            
            // Callback de chargement réussi
            t.onload = function() {
                console.log('✅✅✅ Microsoft Clarity CHARGÉ AVEC SUCCÈS !');
                isClarityLoaded = true;
                
                // Vérifier que clarity est bien disponible
                if (typeof window.clarity !== 'undefined' && window.clarity) {
                    console.log('📊 Clarity prêt à tracker pour', window.location.pathname);
                    
                    try {
                        // Récupérer le device type depuis la variable globale si disponible
                        const deviceType = window.deviceType || 'desktop';
                        
                        // Configuration initiale
                        window.clarity("set", "pageTitle", document.title);
                        window.clarity("set", "deviceType", deviceType);
                        
                        // Envoyer un événement de page_view
                        window.clarity("event", "page_view", {
                            path: window.location.pathname,
                            title: document.title
                        });
                        
                        console.log('📡 Clarity: page_view envoyé');
                    } catch (configError) {
                        console.warn('⚠️ Erreur config Clarity:', configError);
                    }
                } else {
                    console.warn('⚠️ Clarity chargé mais objet non disponible');
                }
            };
            
            // Callback d'erreur
            t.onerror = function(error) {
                console.error('❌ Erreur chargement Clarity (probablement bloqué par adblock)');
                console.log('   ℹ️ Le tracking via script direct est bloqué, mais continuez à utiliser GA');
                isClarityLoaded = false;
            };
            
            // Ajouter au DOM
            y.parentNode.insertBefore(t, y);
            console.log('📦 Script Clarity ajouté au DOM');
            
        })(window, document, "clarity", "script", CLARITY_PROJECT_ID);
        
    } catch (error) {
        console.error('❌ Erreur critique Clarity:', error);
        clarityLoadAttempted = false;
    }
}

// =============== FONCTIONS DE TRACKING CLARITY ===============
function trackClarityEvent(eventName, properties = {}) {
    if (areCookiesRejected() || !isClarityLoaded || typeof window.clarity === 'undefined') return;
    
    try {
        window.clarity("event", eventName, properties);
        console.log(`📡 [Clarity] Événement: ${eventName}`);
    } catch (error) {
        // Silencieux - pas besoin d'alerter
    }
}

// =============== ATTACHER LES ÉVÉNEMENTS CLARITY ===============
function attachClarityEvents() {
    if (areCookiesRejected() || !isClarityLoaded) return;
    
    console.log('🎯 Activation tracking Clarity...');
    
    // Tracking des clics
    document.addEventListener('click', function(e) {
        if (areCookiesRejected() || !isClarityLoaded) return;
        
        setTimeout(() => {
            const interactiveEl = e.target.closest('a, button, .btn, [role="button"]');
            if (!interactiveEl) return;
            
            const text = interactiveEl.textContent?.trim()?.substring(0, 100) || 
                         interactiveEl.getAttribute('aria-label') || 
                         'unknown';
            
            trackClarityEvent('click', {
                element_text: text,
                element_type: interactiveEl.tagName.toLowerCase(),
                element_id: interactiveEl.id || null,
                page_path: window.location.pathname
            });
        }, 50);
    }, { passive: true });
}

// =============== INITIALISATION ===============
function initClarity() {
    console.log('🌐 Initialisation Clarity...');
    
    // Vérifier immédiatement si cookies refusés
    if (areCookiesRejected()) {
        console.log('⛔ Cookies refusés - Clarity désactivé');
        return;
    }
    
    // Vérifier consentement
    if (shouldLoadClarity()) {
        console.log('✅ Consentement OK, chargement Clarity...');
        setTimeout(() => {
            initializeClarity();
            // Attacher les événements après chargement
            setTimeout(attachClarityEvents, 1000);
        }, 300);
    } else {
        console.log('🔄 En attente consentement pour Clarity...');
    }
}

// =============== EXPOSER LES FONCTIONS POUR LA BANNIÈRE ===============
// Surcharger les fonctions de la bannière pour inclure Clarity
const originalAcceptCookies = window.acceptCookies;
window.acceptCookies = function() {
    if (originalAcceptCookies) originalAcceptCookies();
    setTimeout(() => initClarity(), 200);
};

const originalSavePreferences = window.saveCookiePreferences;
window.saveCookiePreferences = function() {
    if (originalSavePreferences) originalSavePreferences();
    setTimeout(() => {
        if (shouldLoadClarity()) initClarity();
    }, 200);
};

// =============== DÉMARRAGE ===============
document.addEventListener('DOMContentLoaded', initClarity);

// =============== DEBUG ===============
window.debugClarity = {
    check: function() {
        console.log('🔍 État Clarity:');
        console.log('- Cookies refusés:', areCookiesRejected());
        console.log('- Clarity Loaded:', isClarityLoaded);
        console.log('- Tentative:', clarityLoadAttempted);
        console.log('- Clarity disponible:', typeof window.clarity !== 'undefined');
        console.log('- Consentement:', shouldLoadClarity() ? '✅' : '❌');
        console.log('- Project ID:', CLARITY_PROJECT_ID);
        
        // Vérifier si le script est dans le DOM
        const scripts = document.getElementsByTagName('script');
        let clarityFound = false;
        for (let script of scripts) {
            if (script.src && script.src.includes('clarity.ms')) {
                clarityFound = true;
                console.log('- Script dans DOM:', '✅', script.src);
                break;
            }
        }
        if (!clarityFound) console.log('- Script dans DOM:', '❌');
    },
    
    test: function() {
        if (areCookiesRejected()) {
            console.log('⛔ Cookies refusés');
            return;
        }
        
        if (typeof window.clarity !== 'undefined') {
            trackClarityEvent('debug_test', { test: 'manual', time: Date.now() });
            console.log('✅ Test envoyé à Clarity');
        } else {
            console.log('❌ Clarity non disponible');
        }
    },
    
    force: function() {
        if (areCookiesRejected()) {
            console.log('⛔ Cookies refusés');
            return;
        }
        isClarityLoaded = false;
        clarityLoadAttempted = false;
        initClarity();
    }
};

console.log('🔍 Clarity Manager prêt - ID:', CLARITY_PROJECT_ID);
console.log('💡 Commandes: debugClarity.check(), debugClarity.test(), debugClarity.force()');
