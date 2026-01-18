import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const data = req.body || {};

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const name = data.Name || "Unknown";
    const email = (data.email || "").trim();
    const bundle = data.Selected_Asset_Bundle || "General";
    const message = data.Message || "(no message)";

    if (!email) {
      return res.status(400).json({ success: false, error: "Missing visitor email" });
    }

    // 1) Email to you
    const adminInfo = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: `New Inquiry: ${bundle} - from gnosisbase.com`,
      text: `Name: ${name}\nEmail: ${email}\nAsset Bundle: ${bundle}\n\nMessage:\n${message}`,
    });

    // 2) Auto-reply to visitor
    let autoInfo = null;
    let autoError = null;

    try {
      autoInfo = await transporter.sendMail({
        from: process.env.SMTP_USER, // أبسط وأفضل للتسليم
        to: email,
        replyTo: process.env.SMTP_USER,
        subject: "Confirmation : demande reçue - Gnosis Assets",
        text: `Merci d’avoir contacté Gnosis Assets.

Nous avons bien reçu votre demande concernant le portefeuille.

Nous vous répondrons dès que possible.

Cordialement,
L’équipe Gnosis Assets
https://gnosisbase.com`,
      });
    } catch (err) {
      autoError = err?.message || String(err);
    }

    return res.status(200).json({
      success: true,
      adminSent: !!adminInfo?.messageId,
      autoReplySent: !!autoInfo?.messageId,
      autoError,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || "Server error" });
  }
}
