import nodemailer from "nodemailer";

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const data = req.body || {};

    // HARD BLOCK — FINAL
    const badName = String(data.Name || data.name || "").toLowerCase().trim();
    const badCompany = String(data.Company || data.company || "").toLowerCase().trim();

    if (badName.includes("roberttum") || badCompany.includes("google")) {
      console.log("HARD BLOCKED", badName, badCompany);
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // Honeypot
    const hp = String(data.website || "").trim();
    if (hp) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // Time trap
    const startTs = Number(data.formStartTs || 0);
    if (startTs && Date.now() - startTs < 2500) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    const name = String(data.Name || "Unknown").trim().slice(0, 120);
    const company = String(data.Company || "Not specified").trim().slice(0, 120);
    const email = String(data.email || data.Email || "").trim().slice(0, 200);
    const bundle = String(data.Selected_Asset_Bundle || "General").trim().slice(0, 120);
    const message = String(data.Message || "(no message)").trim().slice(0, 4000);

    if (!email) {
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
      <a href="https://gnosisbase.com">
        <img src="https://gnosisbase.com/gnosis-assets-header.png" width="640" style="display:block;width:100%;border:0;" />
      </a>
    </div>
    <div style="padding:22px 20px;color:#e5e7eb;">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Thank you for contacting <b>Gnosis Assets</b>. We have successfully received your inquiry.</p>
      <div style="margin:16px 0;padding:14px;background:#0f172a;border:1px solid #1f2937;border-radius:12px;">
        <b>Asset bundle:</b> ${escapeHtml(bundle)}<br/>
        <b>Company:</b> ${escapeHtml(company)}<br/>
        <b>Email:</b> ${escapeHtml(email)}
      </div>
      <p>We aim to respond within <b>24 business hours</b>.</p>
      <a href="https://gnosisbase.com" style="display:inline-block;padding:12px 16px;border-radius:12px;background:#111827;color:#fff;border:1px solid #1f2937;">
        Visit gnosisbase.com
      </a>
      <hr style="border:none;border-top:1px solid #1f2937;margin:20px 0;">
      <div style="font-size:12px;color:#94a3b8;">
        Best regards,<br>
        <b>The Gnosis Assets Team</b>
      </div>
    </div>
  </div>
</div>
`;

    let autoInfo = null;

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
      console.error("AUTO_REPLY_FAILED:", err);
    }

    return res.status(200).json({
      success: true,
      adminSent: !!adminInfo?.messageId,
      autoReplySent: !!autoInfo?.messageId,
    });
  } catch (e) {
    console.error("CONTACT_API_ERROR:", e);
    return res.status(200).json({ success: true, autoReplySent: false });
  }
}
