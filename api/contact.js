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
    const honeypot = (data.website || "").trim();
    const startTs = Number(data.formStartTs || 0);

    if (honeypot || (startTs && Date.now() - startTs < 2500)) {
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

    const name = data.Name || "Unknown";
    const company = data.Company || "Not specified";
    const email = (data.email || data.Email || "").trim();
    const bundle = data.Selected_Asset_Bundle || "General";
    const message = data.Message || "(no message)";

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Missing visitor email",
      });
    }

    const adminHtml = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#0b0f17;padding:24px;color:#e5e7eb;">
      <div style="max-width:640px;margin:auto;background:#0b0f17;border:1px solid #1f2937;border-radius:14px;overflow:hidden">
        <div style="padding:18px 20px;border-bottom:1px solid #1f2937;">
          <h2 style="margin:0;color:#ffffff;font-size:22px;">New Inquiry Received</h2>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">via gnosisbase.com</p>
        </div>
        <div style="padding:20px;font-size:14px;line-height:1.6">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="color:#9ca3af;padding:4px 0;width:120px;">Name</td><td style="color:#fff;">${escapeHtml(name)}</td></tr>
            <tr><td style="color:#9ca3af;padding:4px 0;">Company</td><td style="color:#fff;">${escapeHtml(company)}</td></tr>
            <tr><td style="color:#9ca3af;padding:4px 0;">Email</td><td style="color:#fff;">${escapeHtml(email)}</td></tr>
            <tr><td style="color:#9ca3af;padding:4px 0;">Asset Bundle</td><td style="color:#fff;font-weight:bold;color:#60a5fa;">${escapeHtml(bundle)}</td></tr>
          </table>
          <div style="margin-top:18px;padding:14px;background:#0f172a;border:1px solid #1f2937;border-radius:10px">
            <div style="color:#93c5fd;font-weight:700;font-size:13px;margin-bottom:6px">Message</div>
            <div style="color:#e5e7eb;">${escapeHtml(message)}</div>
          </div>
        </div>
        <div style="padding:14px 20px;border-top:1px solid #1f2937;color:#94a3b8;font-size:12px">
          Internal System Notification
        </div>
      </div>
    </div>`;

    const visitorHtml = `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height:1.5; background:#0b0f17; padding:24px;">
      <div style="max-width:640px; margin:0 auto; border:1px solid #121826; border-radius:14px; overflow:hidden; background:#0b0f17;">
        <div style="padding:20px; background:#0b0f17;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td align="left" valign="middle">
                <div style="font-size:22px; font-weight:700; color:#ffffff;">Inquiry received</div>
              </td>
              <td align="right" valign="middle">
                 <img src="https://gnosisbase.com/logo.png" alt="Gnosis Assets" width="110" style="display:block; border:0;" />
              </td>
            </tr>
          </table>
        </div>
        <div style="padding:22px 20px; background:#0b0f17; color:#e5e7eb;">
          <p style="margin:0 0 12px;">Hi${name ? ` ${escapeHtml(name)}` : ""},</p>
          <p style="margin:0 0 14px;">
            Thank you for contacting <b style="color:#ffffff;">Gnosis Assets</b>. We have successfully received your inquiry regarding the portfolio.
          </p>
          <div style="margin:16px 0; padding:14px; background:#0f172a; border:1px solid #1f2937; border-radius:12px;">
            <div style="font-size:13px; color:#93c5fd; margin-bottom:8px; font-weight:700;">Inquiry summary</div>
            <div style="font-size:14px; margin:2px 0;"><b style="color:#ffffff;">Asset bundle:</b> ${escapeHtml(bundle)}</div>
            <div style="font-size:14px; margin:2px 0;"><b style="color:#ffffff;">Email:</b> ${escapeHtml(email)}</div>
          </div>
          <p style="margin:0 0 12px; color:#cbd5e1;">
            Our team is currently reviewing incoming requests. Please note that we prioritize inquiries from strategic buyers and institutional operators.
          </p>
          <p style="margin:0 0 18px; color:#cbd5e1;">
            We aim to respond to all relevant acquisition requests within <b style="color:#ffffff;">24 business hours</b>.
          </p>
          <hr style="border:none; border-top:1px solid #1f2937; margin:20px 0;">
          <div style="font-size:12px; color:#94a3b8;">
            Best regards,<br>
            <b style="color:#e5e7eb;">The Gnosis Assets Team</b><br>
            Identity Infrastructure for the AI Era.
          </div>
        </div>
      </div>
    </div>`;

    const adminRecipient = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    
    const adminInfo = await transporter.sendMail({
      from: `"GNOSIS Assets System" <${process.env.SMTP_USER}>`,
      to: adminRecipient,
      replyTo: email,
      subject: `New Inquiry: ${bundle}`,
      text: `New inquiry from ${name} (${email}). Message: ${message}`,
      html: adminHtml,
    });

    let autoInfo = null;
    let autoError = null;

    try {
      autoInfo = await transporter.sendMail({
        from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
        to: email,
        replyTo: process.env.SMTP_USER,
        subject: "Confirmation: Inquiry Received – Gnosis Assets",
        text: "Thank you for contacting Gnosis Assets. We have received your inquiry.",
        html: visitorHtml,
        headers: {
          "Auto-Submitted": "auto-replied",
          "X-Auto-Response-Suppress": "All",
        },
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
