import nodemailer from "nodemailer";

const ALLOWED_ORIGINS = new Set([
  "https://gnosisbase.com",
  "https://www.gnosisbase.com",
]);

function setCors(req, res) {
  const origin = String(req.headers.origin || "");
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, x-form-token");
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  const xr = req.headers["x-real-ip"];
  if (typeof xr === "string" && xr.length) return xr.trim();
  return req.socket?.remoteAddress || "";
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default async function handler(req, res) {
  // ✅ مهم: CORS على كل الردود (POST/OPTIONS/Errors)
  setCors(req, res);

  // ✅ مهم: Preflight للطلبات التي فيها x-form-token
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const data = req.body || {};
    const clientIp = getClientIp(req);

    // 1) توكن سري (فلتر سريع جدا)
    const token = String(req.headers["x-form-token"] || "");
    if (!process.env.FORM_TOKEN || token !== process.env.FORM_TOKEN) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 2) فحص Origin و Referer
    const origin = String(req.headers.origin || "");
    const referer = String(req.headers.referer || "");
    const allowed = ["https://gnosisbase.com", "https://www.gnosisbase.com"];

    const okOrigin = allowed.includes(origin);
    const okReferer = allowed.some((d) => referer.startsWith(d));

    if (!okOrigin && !okReferer) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 3) حظر رينج IP المزعج
    if (clientIp && clientIp.startsWith("92.255.85.")) {
      console.log("Blocked IP range:", clientIp);
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 4) Honeypot
    const hp = String(data.website || "").trim();
    if (hp) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 5) Time trap
    const startTs = Number(data.formStartTs || 0);
    if (startTs && Date.now() - startTs < 2500) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 6) حظر الاسم المستهدف فقط
    const checkName = String(data.Name || data.name || "").toLowerCase().trim();
    if (checkName.includes("roberttum")) {
      console.log("Blocked targeted spam:", checkName, "IP=", clientIp);
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 7) تطبيع وقطع الأطوال
    const name = String(data.Name || data.name || "Unknown").trim().slice(0, 120);
    const company = String(data.Company || data.company || "Not specified").trim().slice(0, 120);
    const email = String(data.email || data.Email || "").trim().slice(0, 200);
    const bundle = String(data.Selected_Asset_Bundle || "General").trim().slice(0, 120);
    const message = String(data.Message || "(no message)").trim().slice(0, 4000);

    if (!email) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 8) SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // 9) بريد الأدمن
    const adminInfo = await transporter.sendMail({
      from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: `New Inquiry: ${bundle} – from gnosisbase.com`,
      text: `Name: ${name}
Company: ${company}
Email: ${email}
Asset Bundle: ${bundle}
IP: ${clientIp}
Origin: ${origin}
Referer: ${referer}

Message:
${message}`,
    });

    // 10) رد تلقائي مع تصميمك
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
    <div style="padding:0; background:#0b0f17;">
      <a href="https://gnosisbase.com" target="_blank" style="text-decoration:none;">
        <img src="https://gnosisbase.com/gnosis-assets-header.png" alt="Gnosis Assets" width="640"
             style="display:block; width:100%; max-width:640px; border:0;" />
      </a>
    </div>

    <div style="padding:20px; background:#0b0f17;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="left" valign="middle">
            <div style="font-size:22px; font-weight:700; color:#ffffff;">Inquiry received</div>
          </td>
          <td align="right" valign="middle">
            <a href="https://gnosisbase.com" target="_blank" style="text-decoration:none;">
              <img src="https://gnosisbase.com/logo.png" alt="Gnosis Assets" width="110" style="display:block; border:0;" />
            </a>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:22px 20px; background:#0b0f17; color:#e5e7eb;">
      <p style="margin:0 0 12px; color:#e5e7eb;">Hi${name ? ` ${escapeHtml(name)}` : ""},</p>

      <p style="margin:0 0 14px; color:#e5e7eb;">
        Thank you for contacting <b style="color:#ffffff;">Gnosis Assets</b>. We have successfully received your inquiry regarding the portfolio.
      </p>

      <div style="margin:16px 0; padding:14px; background:#0f172a; border:1px solid #1f2937; border-radius:12px;">
        <div style="font-size:13px; color:#93c5fd; margin-bottom:8px; font-weight:700;">Inquiry summary</div>
        <div style="font-size:14px; color:#e5e7eb; margin:2px 0;"><b style="color:#ffffff;">Asset bundle:</b> ${escapeHtml(bundle)}</div>
        <div style="font-size:14px; color:#e5e7eb; margin:2px 0;"><b style="color:#ffffff;">Company:</b> ${escapeHtml(company)}</div>
        <div style="font-size:14px; color:#e5e7eb; margin:2px 0;"><b style="color:#ffffff;">Email:</b> ${escapeHtml(email)}</div>
      </div>

      <p style="margin:0 0 12px; color:#cbd5e1;">
        Our team is currently reviewing incoming requests. Please note that we prioritize inquiries from strategic buyers and institutional operators.
      </p>

      <p style="margin:0 0 18px; color:#cbd5e1;">
        We aim to respond to all relevant acquisition requests within <b style="color:#ffffff;">24 business hours</b>.
      </p>

      <a href="https://gnosisbase.com"
         style="display:inline-block; text-decoration:none; padding:12px 16px; border-radius:12px; background:#111827; color:#ffffff; font-weight:700; border:1px solid #1f2937;">
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
    // نرجع 200 نجاح وهمي لتقليل فائدة السبام
    return res.status(200).json({ success: true, autoReplySent: false });
  }
}
