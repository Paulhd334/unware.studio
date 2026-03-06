// server/server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const trackingClarity = require('./tracking-clarity');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// ✅ Injecter Microsoft Clarity sur toutes les pages HTML
app.use(trackingClarity.injectClarityMiddleware);

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../public')));

// Routes API
app.use('/api/tracking', require('./api/tracking'));

// ✅ API Clarity pour vérification
const clarityRouter = express.Router();
trackingClarity.setupClarityAPI(clarityRouter);
app.use('/api/clarity', clarityRouter);

// Route pour la page d'administration
app.get('/admin/stats', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin/stats.html'));
});

// Route par défaut
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
    console.log('\n🚀 Serveur démarré!');
    console.log(`📡 Port: ${PORT}`);
    console.log(`\n🔍 MICROSOFT CLARITY CONFIGURÉ:`);
    console.log(`   📊 Project ID: ${trackingClarity.CLARITY_PROJECT_ID}`);
    console.log(`   🌐 Site: https://unware.studio/`);
    console.log(`   ✅ Statut: Actif`);
    console.log(`   📈 Tableau de bord: https://clarity.microsoft.com/project/${trackingClarity.CLARITY_PROJECT_ID}/overview`);
    console.log(`\n🔗 Vérifier l'API: http://localhost:${PORT}/api/clarity/status`);
    console.log(`👨‍💻 Admin: http://localhost:${PORT}/admin/stats\n`);
});