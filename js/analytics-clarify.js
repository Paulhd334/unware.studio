// =============== MICROSOFT CLARITY ===============
const CLARITY_PROJECT_ID = 'vrmfcq4hei'; // Votre ID Clarity
let isClarityLoaded = false;
let clarityLoadAttempted = false;

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
    
    if (!shouldLoadGA()) {
        console.log('⛔ Pas de consentement - Clarity désactivé');
        return;
    }
    
    console.log('🚀 Initialisation Microsoft Clarity (ID: ' + CLARITY_PROJECT_ID + ')...');
    clarityLoadAttempted = true;
    
    try {
        // Script Clarity avec timeout et meilleure gestion d'erreur
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
                    console.log('📊 Clarity prêt à tracker');
                    
                    try {
                        // Configuration supplémentaire
                        window.clarity("set", "userId", getClientId());
                        window.clarity("set", "deviceType", deviceType);
                        window.clarity("set", "pageTitle", getPageTitle());
                        
                        // Envoyer un événement de test
                        window.clarity("event", "clarity_loaded", {
                            version: '1.0',
                            timestamp: Date.now()
                        });
                        
                        console.log('📡 Clarity configuré avec succès');
                    } catch (configError) {
                        console.warn('⚠️ Erreur config Clarity:', configError);
                    }
                } else {
                    console.warn('⚠️ Clarity chargé mais objet non disponible');
                }
            };
            
            // Callback d'erreur
            t.onerror = function(error) {
                console.error('❌❌❌ ÉCHEC chargement Clarity:', error);
                console.log('🔍 Causes possibles:');
                console.log('   - Bloqueur de pub/adblock');
                console.log('   - Problème réseau');
                console.log('   - Domaine clarity.ms bloqué');
                isClarityLoaded = false;
            };
            
            // Ajouter un timeout de sécurité
            t.timeout = 5000; // 5 secondes max
            
            // Ajouter au DOM
            y.parentNode.insertBefore(t, y);
            console.log('📦 Script Clarity ajouté au DOM');
            
        })(window, document, "clarity", "script", CLARITY_PROJECT_ID);
        
    } catch (error) {
        console.error('❌ Erreur critique Clarity:', error);
        clarityLoadAttempted = false;
    }
}

// =============== VÉRIFICATION MANUELLE CLARITY ===============
function checkClarityStatus() {
    return new Promise((resolve) => {
        console.log('🔍 Vérification statut Clarity...');
        
        // Vérifier si l'objet clarity existe
        const clarityExists = typeof window.clarity !== 'undefined';
        console.log('   - Objet clarity:', clarityExists ? '✅' : '❌');
        
        // Vérifier si le script est dans le DOM
        const scripts = document.getElementsByTagName('script');
        let clarityScriptFound = false;
        for (let script of scripts) {
            if (script.src && script.src.includes('clarity.ms')) {
                clarityScriptFound = true;
                console.log('   - Script dans DOM:', '✅', script.src);
                break;
            }
        }
        if (!clarityScriptFound) {
            console.log('   - Script dans DOM:', '❌');
        }
        
        // Vérifier les bloqueurs
        fetch('https://www.clarity.ms/tag/' + CLARITY_PROJECT_ID, { 
            method: 'HEAD',
            mode: 'no-cors'
        }).then(() => {
            console.log('   - Accès au domaine:', '✅');
        }).catch(() => {
            console.log('   - Accès au domaine:', '❌ (bloqué)');
        });
        
        resolve({
            loaded: isClarityLoaded,
            exists: clarityExists,
            scriptInDOM: clarityScriptFound,
            projectId: CLARITY_PROJECT_ID
        });
    });
}

// =============== DEBUG AMÉLIORÉ ===============
window.debugGA = {
    check: function() {
        console.log('🔍 État Analytics:');
        console.log('===================');
        console.log('- Cookies refusés:', areCookiesRejected());
        console.log('- GA Loaded:', isGALoaded);
        console.log('- Clarity Loaded:', isClarityLoaded);
        console.log('- Tentative Clarity:', clarityLoadAttempted);
        console.log('- Page:', getPageTitle());
        console.log('- Device:', deviceType);
        console.log('- Client ID:', getClientId());
        console.log('- Consent:', getCookie('cookieConsent'));
        console.log('- Analytics cookies:', getCookie('analyticsCookies'));
        console.log('- Clarity Project:', CLARITY_PROJECT_ID);
        console.log('===================');
        
        // Vérification plus approfondie
        if (typeof window.clarity !== 'undefined') {
            console.log('✅ Clarity DISPONIBLE globalement');
        } else {
            console.log('❌ Clarity NON DISPONIBLE globalement');
        }
        
        // Liste des scripts chargés
        console.log('📜 Scripts de tracking:');
        const scripts = document.getElementsByTagName('script');
        for (let script of scripts) {
            if (script.src) {
                if (script.src.includes('clarity')) {
                    console.log('   ✅ Clarity:', script.src);
                } else if (script.src.includes('google-analytics') || script.src.includes('googletagmanager')) {
                    console.log('   ✅ GA:', script.src);
                }
            }
        }
    },
    
    test: function() {
        console.log('🧪 TEST ENVOI ÉVÉNEMENTS');
        console.log('=======================');
        
        // Vérifier si cookies refusés
        if (areCookiesRejected()) {
            console.log('⛔ Cookies refusés - Test impossible');
            return;
        }
        
        // Test GA via API
        sendToSecureAPI('debug_test', {
            test: 'api_secure',
            timestamp: Date.now()
        }).then(success => {
            console.log(success ? '✅ GA: Événement envoyé (API)' : '❌ GA: Échec envoi API');
        });
        
        // Test Clarity
        if (typeof window.clarity !== 'undefined' && window.clarity) {
            try {
                window.clarity("event", "debug_test", { 
                    test: 'clarity_ok',
                    timestamp: Date.now(),
                    source: 'console_test'
                });
                console.log('✅ Clarity: Événement envoyé');
            } catch (e) {
                console.log('❌ Clarity: Erreur envoi:', e);
            }
        } else {
            console.log('❌ Clarity: Non disponible');
            // Tentative de rechargement
            console.log('🔄 Tentative de rechargement Clarity...');
            clarityLoadAttempted = false;
            initializeClarity();
        }
    },
    
    force: function() {
        console.log('🔄 FORCE RELOAD DES TRACKERS');
        console.log('==========================');
        if (areCookiesRejected()) {
            console.log('⛔ Impossible de forcer - Cookies refusés');
            return;
        }
        isClarityLoaded = false;
        clarityLoadAttempted = false;
        isGALoaded = false;
        
        setTimeout(() => {
            initializeGoogleAnalytics();
            initializeClarity();
        }, 100);
    },
    
    reset: function() {
        console.log('🔄 RÉINITIALISATION COMPLÈTE');
        // Supprimer tous les cookies de consentement
        document.cookie.split(";").forEach(function(c) {
            if (c.includes('cookieConsent') || c.includes('analyticsCookies') || c.includes('performanceCookies')) {
                const name = c.split("=")[0].trim();
                document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            }
        });
        cookiesRejected = false;
        isClarityLoaded = false;
        clarityLoadAttempted = false;
        isGALoaded = false;
        console.log('✅ Cookies réinitialisés');
        console.log('🔄 Rechargement de la page...');
        location.reload();
    },
    
    status: async function() {
        console.log('📊 STATUT DÉTAILLÉ');
        const clarityStatus = await checkClarityStatus();
        console.log('Clarity:', clarityStatus);
    },
    
    fix: function() {
        console.log('🔧 TENTATIVE DE CORRECTION');
        console.log('=========================');
        
        // 1. Vérifier les cookies
        console.log('Étape 1: Vérification cookies...');
        const consent = getCookie('cookieConsent');
        console.log('   Consentement:', consent || 'aucun');
        
        if (!consent) {
            console.log('   ⚠️ Pas de consentement, simulation acceptation...');
            setCookie('cookieConsent', 'all', 365);
            setCookie('analyticsCookies', 'true', 365);
        }
        
        // 2. Forcer le chargement
        console.log('Étape 2: Forçage chargement...');
        isClarityLoaded = false;
        clarityLoadAttempted = false;
        isGALoaded = false;
        
        setTimeout(() => {
            initializeGoogleAnalytics();
            initializeClarity();
        }, 500);
        
        // 3. Vérification après 3 secondes
        setTimeout(() => {
            console.log('Étape 3: Vérification après chargement...');
            window.debugGA.check();
        }, 3000);
    }
};

console.log('📊 Analytics Manager prêt (GA + Clarity)');
console.log('💡 Commandes debug disponibles:');
console.log('   debugGA.check()    - Voir état');
console.log('   debugGA.test()     - Tester envoi');
console.log('   debugGA.status()   - Statut détaillé');
console.log('   debugGA.force()    - Forcer rechargement');
console.log('   debugGA.fix()      - Tentative correction');
console.log('   debugGA.reset()    - Réinitialiser');
