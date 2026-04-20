// unsubscribe.js - Endpoint API pour gérer les désinscriptions
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', 'https://unware.studio');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    
    // Support GET (depuis lien email) et POST (depuis formulaire)
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    // Récupérer l'email (POST body ou GET query param)
    let email = req.method === 'POST' ? req.body?.email : req.query?.email;
    
    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Email invalide' });
    }

    // Décoder l'email si encodé en URL
    email = decodeURIComponent(email);

    try {
        // Vérifier si le contact existe
        let existing = null;
        try {
            const response = await resend.contacts.get({
                audienceId: process.env.RESEND_AUDIENCE_ID,
                email: email
            });
            existing = response.data || null;
        } catch (getError) {
            if (getError.statusCode !== 404) {
                console.error('Erreur GET contact:', getError);
                return res.status(500).json({ error: 'Erreur serveur lors de la vérification' });
            }
        }

        if (!existing) {
            // Contact non trouvé, mais on peut quand même répondre que c'est fait
            return res.status(200).json({ 
                success: true, 
                message: 'Cet email n\'était pas dans notre liste ou a déjà été désinscrit.' 
            });
        }

        // Mettre à jour le contact comme désabonné
        await resend.contacts.update({
            audienceId: process.env.RESEND_AUDIENCE_ID,
            email: email,
            unsubscribed: true
        });

        // Envoyer confirmation de désinscription
        const confirmationHtml = `
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
        <tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
        <tr><td style="padding:40px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
        <h1 style="margin:0;font-size:42px;color:#ffffff;letter-spacing:6px;font-weight:700;">NEXA</h1>
        <p style="margin:8px 0 0;font-size:11px;color:#888888;letter-spacing:3px;text-transform:uppercase;">UNWARE STUDIO</p>
        </td></tr>
        <tr><td style="padding:40px;text-align:center;">
        <span style="display:inline-block;background:rgba(255,255,255,0.05);color:#ffffff;padding:8px 16px;border-radius:4px;font-size:11px;letter-spacing:2px;border:1px solid rgba(255,255,255,0.1);">DÉSINSCRIPTION CONFIRMÉE</span>
        <h2 style="margin:30px 0 16px;font-size:22px;color:#ffffff;font-weight:600;">Vous êtes désinscrit.</h2>
        <p style="margin:0 0 16px;font-size:15px;color:#888888;line-height:1.6;">Vous ne recevrez plus d'emails de notre part.</p>
        <p style="margin:30px 0 0;font-size:13px;color:#666666;">Si c'était une erreur, vous pouvez <a href="https://unware.studio" style="color:#ffffff;">vous réinscrire</a> à tout moment.</p>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
        <p style="margin:0;font-size:12px;color:#888888;">© 2026 UNWARE STUDIO</p>
        </td></tr>
        </table></td></tr>
        </table></body></html>
        `;

        await resend.emails.send({
            from: 'NEXA <noreply@unware.studio>',
            to: [email],
            subject: 'Confirmation de désinscription - NEXA',
            html: confirmationHtml
        });

        // Notifier l'admin (optionnel)
        await resend.emails.send({
            from: 'NEXA <noreply@unware.studio>',
            to: [process.env.CONTACT_EMAIL],
            subject: `Désinscription - ${email}`,
            html: `<body><p>L'utilisateur ${email} s'est désinscrit le ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p></body>`
        });

        return res.status(200).json({ 
            success: true, 
            message: 'Vous avez été désinscrit avec succès.' 
        });

    } catch (error) {
        console.error('Erreur lors du désabonnement:', error);
        return res.status(500).json({ error: 'Erreur serveur lors du désabonnement' });
    }
};
