import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const data = req.body || {};

    const hp = (data.website || "").trim();
    if (hp) {
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

    const name = data.Name || "Unknown";
    const company = data.Company || "Not specified";
    const email = (data.email || data.Email || "").trim();
    const bundle = data.Selected_Asset_Bundle || "General";
    const message = data.Message || "(no message)";

    if (!email) {
      return res.status(400).json({ success: false, error: "Missing visitor email" });
    }

    const emailKey = Buffer.from(email.toLowerCase())
      .toString("base64")
      .replaceAll("=", "");
    const cookieName = `sent_${emailKey}`;
    const cookieHeader = req.headers.cookie || "";

    if (cookieHeader.includes(`${cookieName}=1`)) {
      return res.status(429).json({
        success: false,
        error: "You have already sent a message. Please wait 24 hours.",
      });
    }

    const adminInfo = await transporter.sendMail({
      from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: `New Inquiry: ${bundle} – from gnosisbase.com`,
      text: `Name: ${name}
Company: ${company}
Email: ${email}
Asset Bundle: ${bundle}

Message:
${message}`,
    });

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
    <div style="padding:0;">
      <a href="https://gnosisbase.com" target="_blank">
        <img src="https://gnosisbase.com/gnosis-assets-header.png" alt="Gnosis Assets" width="640" style="display:block;width:100%;border:0;" />
      </a>
    </div>
    <div style="padding:20px;">
      <table width="100%" role="presentation">
        <tr>
          <td style="font-size:22px;font-weight:700;color:#fff;">Inquiry received</td>
          <td align="right">
            <img src="https://gnosisbase.com/logo.png" alt="Gnosis Assets" width="110" style="border:0;" />
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:22px 20px;color:#e5e7eb;">
      <p>Hi${name ? ` ${escapeHtml(name)}` : ""},</p>
      <p>Thank you for contacting <b>Gnosis Assets</b>. We have received your inquiry.</p>
      <div style="margin:16px 0;padding:14px;background:#0f172a;border:1px solid #1f2937;border-radius:12px;">
        <div><b>Asset bundle:</b> ${escapeHtml(bundle)}</div>
        <div><b>Company:</b> ${escapeHtml(company)}</div>
        <div><b>Email:</b> ${escapeHtml(email)}</div>
      </div>
      <p>We aim to respond within <b>24 business hours</b>.</p>
      <a href="https://gnosisbase.com" style="display:inline-block;padding:12px 16px;border-radius:12px;background:#111827;color:#fff;border:1px solid #1f2937;">Visit gnosisbase.com</a>
      <hr style="border:none;border-top:1px solid #1f2937;margin:20px 0;">
      <div style="font-size:12px;color:#94a3b8;">
        Best regards,<br><b>The Gnosis Assets Team</b>
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
        replyTo: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
        subject,
        text,
        html,
        headers: {
          "Auto-Submitted": "auto-replied",
          "X-Auto-Response-Suppress": "All",
        },
      });
    } catch (err) {
      autoError = err?.message || String(err);
    }

    res.setHeader(
      "Set-Cookie",
      `${cookieName}=1; Max-Age=86400; Path=/; SameSite=Strict; Secure`
    );

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

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
