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

    /* ============================
       Anti-spam: Honeypot + Timing
       ============================ */
    const honeypot = (data.website || "").trim();
    if (honeypot) {
      // Fake success to avoid helping bots
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    const startTs = Number(data.formStartTs || 0);
    if (startTs && Date.now() - startTs < 2500) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }
    /* ============================ */

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
    const company = data.Company || "Not specified";
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
    const adminInfo = await transporter.sendMail({
      from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: `New Inquiry: ${bundle} – from gnosisbase.com`,
      text: `Name: ${name}
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

    const html = `
<div style="font-family: Arial, Helvetica, sans-serif; line-height:1.5; background:#0b0f17; padding:24px;">
  <div style="max-width:640px; margin:0 auto; border:1px solid #121826; border-radius:14px; overflow:hidden; background:#0b0f17;">

    <!-- Header -->
    <div style="padding:20px; background:#0b0f17;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="left" valign="middle">
            <div style="font-size:22px; font-weight:700; color:#ffffff;">
              Inquiry received
            </div>
          </td>
          <td align="right" valign="middle">
            <a href="https://gnosisbase.com" target="_blank" style="text-decoration:none;">
              <img
                src="https://gnosisbase.com/logo.png"
                alt="Gnosis Assets"
                width="110"
                style="display:block; border:0;"
              />
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Body -->
    <div style="padding:22px 20px; background:#0b0f17; color:#e5e7eb;">
      <p style="margin:0 0 12px;">
        Hi${name ? ` ${escapeHtml(name)}` : ""},
      </p>

      <p style="margin:0 0 14px;">
        Thank you for contacting <b style="color:#ffffff;">Gnosis Assets</b>. We have successfully received your inquiry regarding the portfolio.
      </p>

      <!-- Summary -->
      <div style="margin:16px 0; padding:14px; background:#0f172a; border:1px solid #1f2937; border-radius:12px;">
        <div style="font-size:13px; color:#93c5fd; margin-bottom:8px; font-weight:700;">
          Inquiry summary
        </div>
        <div style="font-size:14px; margin:2px 0;">
          <b style="color:#ffffff;">Asset bundle:</b> ${escapeHtml(bundle)}
        </div>
        <div style="font-size:14px; margin:2px 0;">
          <b style="color:#ffffff;">Email:</b> ${escapeHtml(email)}
        </div>
      </div>

      <p style="margin:0 0 12px; color:#cbd5e1;">
        Our team is currently reviewing incoming requests. Please note that we prioritize inquiries from strategic buyers and institutional operators.
      </p>

      <p style="margin:0 0 18px; color:#cbd5e1;">
        We aim to respond to all relevant acquisition requests within <b style="color:#ffffff;">24 business hours</b>.
      </p>

      <a href="https://gnosisbase.com"
         style="display:inline-block; text-decoration:none; padding:12px 16px; border-radius:12px;
                background:#111827; color:#ffffff; font-weight:700; border:1px solid #1f2937;">
        Visit gnosisbase.com
      </a>

      <hr style="border:none; border-top:1px solid #1f2937; margin:20px 0;">

      <div style="font-size:12px; color:#94a3b8;">
        Best regards,<br>
        <b style="color:#e5e7eb;">The Gnosis Assets Team</b><br>
        Identity Infrastructure for the AI Era.
      </div>
    </div>
  </div>
</div>
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

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
