export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://unware.studio');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email invalide' });

    const date = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                        <tr>
                            <td style="padding:40px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
                                <h1 style="margin:0;font-size:42px;color:#ffffff;letter-spacing:6px;font-weight:700;">NEXA</h1>
                                <p style="margin:8px 0 0;font-size:11px;color:#888888;letter-spacing:3px;text-transform:uppercase;">UNWARE STUDIO</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:30px 40px 0;text-align:center;">
                                <span style="display:inline-block;background:rgba(255,255,255,0.05);color:#ffffff;padding:8px 16px;border-radius:4px;font-size:11px;letter-spacing:2px;border:1px solid rgba(255,255,255,0.1);">NOUVELLE INSCRIPTION</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:30px 40px;">
                                <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;margin-bottom:16px;">
                                    <tr>
                                        <td style="padding:20px 24px;">
                                            <p style="margin:0 0 6px;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:2px;">Email</p>
                                            <p style="margin:0;font-size:16px;color:#ffffff;font-weight:600;">${email}</p>
                                        </td>
                                    </tr>
                                </table>
                                <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;margin-bottom:30px;">
                                    <tr>
                                        <td style="padding:20px 24px;">
                                            <p style="margin:0 0 6px;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:2px;">Date</p>
                                            <p style="margin:0;font-size:16px;color:#ffffff;font-weight:600;">${date}</p>
                                        </td>
                                    </tr>
                                </table>
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center">
                                            <a href="https://unware.studio" style="display:inline-block;background:#ffffff;color:#0a0a0a;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:1px;">VOIR LE SITE</a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
                                <p style="margin:0;font-size:12px;color:#888888;">© 2026 UNWARE STUDIO — Développé sur Unreal Engine 5.6</p>
                                <p style="margin:8px 0 0;font-size:12px;color:#555555;">unware.studio</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>`;

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
                subject: `Nouvelle inscription NEXA — ${email}`,
                html: htmlTemplate
            })
        });

        if (response.ok) {
            return res.status(200).json({ success: true });
        } else {
            const error = await response.json();
            console.error('Resend error:', error);
            throw new Error('Erreur Resend');
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
}
