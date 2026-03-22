export default async function handler(req, res) {
    // Sécurité CORS
    res.setHeader('Access-Control-Allow-Origin', 'https://unware.studio');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    const { email } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Email invalide' });
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'NEXA <noreply@unware.studio>',
                to: [process.env.CONTACT_EMAIL],
                subject: 'Nouvelle inscription NEXA',
                html: `<p>Nouvelle inscription : <strong>${email}</strong></p>`
            })
        });

        if (response.ok) {
            return res.status(200).json({ success: true });
        } else {
            throw new Error('Erreur Resend');
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
}
