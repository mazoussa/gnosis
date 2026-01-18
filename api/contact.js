import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  try {
    const data = req.body;

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
    const email = data.email;
    const bundle = data.Selected_Asset_Bundle || "General";
    const message = data.Message || "(no message)";

    if (!email) {
      return res.status(400).json({ success: false });
    }

    // 1️⃣ Email to you
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: `New Inquiry: ${bundle} - from gnosisbase.com`,
      text: `Name: ${name}
Email: ${email}
Asset Bundle: ${bundle}

Message:
${message}`,
    });

        // 2️⃣ Auto-reply to client
    let autoInfo;
    try {
      autoInfo = await transporter.sendMail({
        from: `"Gnosis Assets Team" <${process.env.SMTP_USER}>`,
        to: email,
        replyTo: process.env.SMTP_USER,
        subject: "Confirmation : demande reçue - Gnosis Assets",
        text: `Merci d’avoir contacté Gnosis Assets.

Nous avons bien reçu votre demande concernant le portefeuille.

Notre équipe examine actuellement les demandes entrantes. Nous priorisons les acheteurs stratégiques et les opérateurs institutionnels.

Nous visons à répondre aux demandes pertinentes sous 24 heures ouvrées.

Cordialement,

L’équipe Gnosis Assets
Identity Infrastructure for the AI Era.
https://gnosisbase.com`,
      });
    } catch (err) {
      console.error("AUTO_REPLY_FAILED:", err);
    }

    return res.status(200).json({ success: true, autoReplySent: !!autoInfo?.messageId });
