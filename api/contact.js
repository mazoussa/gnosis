import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const data = req.body || {};

    /* Anti-spam checks */
    const honeypot = (data.website || "").trim();
    if (honeypot) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    const startTs = Number(data.formStartTs || 0);
    if (startTs && Date.now() - startTs < 2500) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // 1. Extract Data (Added Company here)
    const name = data.Name || "Unknown";
    const company = data.Company || "Not specified"; // <--- NEW FIELD
    const email = (data.email || "").trim();
    const bundle = data.Selected_Asset_Bundle || "General";
    const message = data.Message || "(no message)";

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Missing visitor email",
      });
    }

    /* ============================
       1) Admin notification email
       ============================ */
    // Added Company to the text body so you can see it
    const adminInfo = await transporter.sendMail({
      from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: `New Inquiry: ${bundle} – from gnosisbase.com`,
      text: `
Name: ${name}
Company: ${company}
Email: ${email}
Asset Bundle: ${bundle}

Message:
${message}`,
    });

    /* ============================
       2) Auto-reply to visitor
       ============================ */
    const subject = "Confirmation: Inquiry Received – Gnosis Assets";

    const text = `Thank you for contacting Gnosis Assets.

We have successfully received your inquiry regarding the portfolio.

Our team is currently reviewing incoming requests. Please note that we prioritize inquiries from strategic buyers and institutional operators.

We aim to respond to all relevant acquisition requests within 24 business hours.

Best regards,

The Gnosis Assets Team
Identity Infrastructure for the AI Era.
https://gnosisbase.com`;

    // (HTML Code remains the same as previous step)
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Gnosis Assets Inquiry</title>
  <style>
    body { margin: 0; padding: 0; background-color: #060712; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #060712; }
    .content { background-color: #10121e; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 40px; margin-top: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo-text { font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 2px; text-decoration: none; text-transform: uppercase; }
    .logo-accent { color: #00f0f0; }
    .divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(0,240,240,0.5), transparent); margin: 20px 0; }
    p { color: #b0b3c0; line-height: 1.6; font-size: 16px; margin-bottom: 15px; }
    strong { color: #ffffff; }
    .btn { display: inline-block; padding: 12px 24px; background-color: rgba(0,240,240,0.1); color: #00f0f0; text-decoration: none; font-weight: bold; border-radius: 6px; border: 1px solid rgba(0,240,240,0.3); margin-top: 10px; font-size: 14px; }
    .footer { text-align: center; padding: 30px; color: #55596b; font-size: 12px; }
    .footer a { color: #777b8f; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <div class="logo">
        <a href="https://gnosisbase.com" class="logo-text">
          GNOSIS <span class="logo-accent">ASSETS</span>
        </a>
      </div>
      <p>Dear Investor,</p>
      <p>We have successfully received your inquiry regarding the <strong>Gnosis Assets Portfolio</strong>.</p>
      <div class="divider"></div>
      <p>Our team is currently reviewing incoming mandates. Due to the volume of requests, we prioritize inquiries from strategic buyers and institutional operators capable of executing a full portfolio buyout.</p>
      <p>We aim to respond to all relevant acquisition requests within <strong>24 business hours</strong>.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://gnosisbase.com" class="btn">Return to Portfolio</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; 2026 Gnosis Assets. Identity Infrastructure for the AI Era.</p>
      <p>
        <a href="https://gnosisbase.com">Website</a> • 
        <a href="mailto:invest@gnosisbase.com">Contact Support</a>
      </p>
      <p style="margin-top: 10px; opacity: 0.5;">Private Sale. Serious Inquiries Only.</p>
    </div>
  </div>
</body>
</html>
`;

    let autoInfo = null;
    let autoError = null;

    try {
      autoInfo = await transporter.sendMail({
        from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
        to: email,
        replyTo: process.env.SMTP_USER,
        subject,
        text,
        html,
      });
    } catch (err) {
      autoError = err?.message || String(err);
      console.error("AUTO_REPLY_FAILED:", err);
    }

    return res.status(200).json({
      success: true,
      adminSent: !!adminInfo?.messageId,
      autoReplySent: !!autoInfo?.messageId,
      autoError,
    });

  } catch (e) {
    console.error("CONTACT_API_ERROR:", e);
    return res.status(500).json({
      success: false,
      error: e?.message || "Server error",
    });
  }
}
