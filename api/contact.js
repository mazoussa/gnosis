import nodemailer from "nodemailer";

// ----------------------------
// Constants
// ----------------------------
const SITE_URL = "https://gnosisbase.com";
const STACK_URL = `${SITE_URL}/asset-stack.html`;
const DOMAINS = "GnosisBase.com + .ai";
const FROM_NAME = "Gnosis Base";

// Optional: set SELLER_NAME in your environment (for example "Your Name, Gnosis Base")
// to sign the confirmation with a real name. Falls back to the brand name.
const SIGNER = (process.env.SELLER_NAME || "").trim() || "Gnosis Base";

// One plain address only: no spaces, commas, semicolons, quotes or angle brackets,
// so a single submission can never address several recipients.
const EMAIL_RE = /^[^\s@,;<>()"'\\]+@[^\s@,;<>()"'\\]+\.[^\s@,;<>()"'\\]{2,}$/;

// Best-effort limiter for the AUTO-REPLY only (the admin email is always sent).
// It lives in memory, so on serverless hosting each instance counts separately.
// For a hard limit, back it with a shared store (Vercel KV / Upstash Redis).
const autoReplyHits = new Map();
function allowHit(key, max, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const recent = (autoReplyHits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    autoReplyHits.set(key, recent);
    return false;
  }
  recent.push(now);
  autoReplyHits.set(key, recent);
  if (autoReplyHits.size > 1000) {
    for (const [k, v] of autoReplyHits) {
      if (!v.some((t) => now - t < windowMs)) autoReplyHits.delete(k);
    }
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const data = req.body || {};

    // ----------------------------
    // Anti-spam: Honeypot (all 3 hidden fields) + Time trap
    // ----------------------------
    const hp1 = typeof data.website === "string" ? data.website.trim() : "";
    const hp2 = typeof data.full_name_confirm === "string" ? data.full_name_confirm.trim() : "";
    const hp3 = typeof data.user_backup_email === "string" ? data.user_backup_email.trim() : "";

    if (hp1 || hp2 || hp3) {
      console.log("Spam Intercepted: honeypot field filled", { hp1, hp2, hp3 });
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    const startTs = Number(data.formStartTs || 0);
    if (startTs && Date.now() - startTs < 3500) {
      console.log("Spam Intercepted: submitted too fast", Date.now() - startTs, "ms");
      return res.status(200).json({ success: true, autoReplySent: false });
    }
    if (!startTs) {
      // formStartTs missing entirely — almost certainly a bot posting directly to the endpoint
      console.log("Spam Intercepted: missing formStartTs");
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // ----------------------------
    // Disposable / throwaway email domains (common in spam)
    // ----------------------------
    const rawEmailCheck = (data.email ?? data.Email ?? "").toString().trim().toLowerCase();
    const emailDomain = rawEmailCheck.split("@")[1] || "";
    const disposableDomains = [
      "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
      "yopmail.com", "throwawaymail.com", "trashmail.com", "getnada.com",
      "fakeinbox.com", "sharklasers.com"
    ];
    if (disposableDomains.includes(emailDomain)) {
      console.log("Spam Intercepted: disposable email domain", emailDomain);
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // ----------------------------
    // Validation / hardening
    // ----------------------------
    // Support both "email" and "Email" field names
    const rawEmail = data.email ?? data.Email;
    const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

    if (!email) {
      return res.status(400).json({ success: false, error: "Please enter your email address." });
    }
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: "Please enter a valid email address." });
    }

    const safeName = String(data.Name ?? "").trim().slice(0, 120);
    const safeCompany = String(data.Company ?? "").trim().slice(0, 160);
    const safeBundle = String(data.Selected_Asset_Bundle ?? "").trim().slice(0, 160) || "General";
    const safeMessage = String(data.Message ?? "").trim().slice(0, 4000);
    const ndaRequested = String(data.NDA_Requested ?? "").trim().toLowerCase() === "yes";

    // Single-line version for email headers (prevents header injection via line breaks)
    const bundleOneLine = safeBundle.replace(/\s+/g, " ");

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // 1) Admin email (to you)
    const adminInfo = await transporter.sendMail({
      from: `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: `New Inquiry${ndaRequested ? " [NDA requested]" : ""}: ${bundleOneLine} – Gnosis Base (gnosisbase.com)`,
      text: `Name: ${safeName || "Unknown"}
Company: ${safeCompany || "Not specified"}
Email: ${email}
Asset Bundle: ${safeBundle}
NDA requested: ${ndaRequested ? "Yes" : "No"}

Message:
${safeMessage || "(no message)"}`,
    });

    // 2) Auto-reply (English only) — HTML + text fallback
    const subject = `We received your inquiry – ${DOMAINS}`;

    const messagePreview =
      safeMessage.length > 600 ? `${safeMessage.slice(0, 600).trimEnd()}…` : safeMessage;

    // ---- plain-text version ----
    const textLines = [
      `Hi${safeName ? ` ${safeName}` : ""},`,
      "",
      `Thank you for your interest in ${DOMAINS}. We have received your inquiry and will review it.`,
      "",
      "Your inquiry",
      `- Assets of interest: ${safeBundle}`,
      ...(safeCompany ? [`- Company: ${safeCompany}`] : []),
      `- Email: ${email}`,
      ...(ndaRequested ? ["- NDA: requested. We will send it before discussing terms."] : []),
      ...(messagePreview ? [`- Your message: ${messagePreview}`] : []),
      "",
      "What happens next",
      "1. We review your inquiry.",
      "2. We reply with terms, or send an NDA first if you asked for one.",
      "3. Settlement is supported by Escrow.com.",
      "",
      "We aim to reply within 24 business hours.",
      "",
      `Asset stack: ${STACK_URL}`,
      "",
      "Best regards,",
      SIGNER,
      `${DOMAINS}, available for private acquisition`,
      SITE_URL,
    ];
    const text = textLines.join("\n");

    // ---- HTML version (dark, matches the site; inline styles for email clients) ----
    const summaryRows = [
      ["Assets of interest", escapeHtml(safeBundle)],
      ...(safeCompany ? [["Company", escapeHtml(safeCompany)]] : []),
      ["Email", escapeHtml(email)],
      ...(ndaRequested ? [["NDA", "Requested. We will send it before discussing terms."]] : []),
    ];
    const summaryHtml = summaryRows
      .map(
        ([label, value]) => `
        <div style="font-size:14px; color:#e5e7eb; margin:2px 0;">
          <b style="color:#ffffff;">${label}:</b> ${value}
        </div>`
      )
      .join("");

    const messageHtml = messagePreview
      ? `
        <div style="font-size:14px; color:#e5e7eb; margin:10px 0 0; padding-top:10px; border-top:1px solid #1f2937;">
          <b style="color:#ffffff;">Your message:</b><br>
          ${escapeHtml(messagePreview).replace(/\n/g, "<br>")}
        </div>`
      : "";

    const html = `
<div style="font-family: Arial, Helvetica, sans-serif; line-height:1.5; background:#0b0f17; padding:24px;">
  <div style="max-width:640px; margin:0 auto; border:1px solid #121826; border-radius:14px; overflow:hidden; background:#0b0f17;">

    <div style="padding:20px; background:#0b0f17;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="left" valign="middle">
            <div style="font-size:22px; font-weight:700; color:#ffffff;">
              Inquiry received
            </div>
          </td>
          <td align="right" valign="middle">
            <a href="${SITE_URL}" target="_blank" style="text-decoration:none;">
              <img
                src="${SITE_URL}/logo.png"
                alt="Gnosis Base"
                width="110"
                style="display:block; border:0;"
              />
            </a>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:22px 20px; background:#0b0f17; color:#e5e7eb;">
      <p style="margin:0 0 12px; color:#e5e7eb;">
        Hi${safeName ? ` ${escapeHtml(safeName)}` : ""},
      </p>

      <p style="margin:0 0 14px; color:#e5e7eb;">
        Thank you for your interest in <b style="color:#ffffff;">${DOMAINS}</b>. We have received your inquiry and will review it.
      </p>

      <div style="margin:16px 0; padding:14px; background:#0f172a; border:1px solid #1f2937; border-radius:12px;">
        <div style="font-size:13px; color:#93c5fd; margin-bottom:8px; font-weight:700;">Your inquiry</div>${summaryHtml}${messageHtml}
      </div>

      <div style="font-size:13px; color:#93c5fd; margin:18px 0 8px; font-weight:700;">What happens next</div>
      <ol style="margin:0 0 16px; padding-left:20px; color:#cbd5e1; font-size:14px;">
        <li style="margin:0 0 6px;">We review your inquiry.</li>
        <li style="margin:0 0 6px;">We reply with terms, or send an NDA first if you asked for one.</li>
        <li style="margin:0;">Settlement is supported by Escrow.com.</li>
      </ol>

      <p style="margin:0 0 18px; color:#cbd5e1;">
        We aim to reply within <b style="color:#ffffff;">24 business hours</b>.
      </p>

      <a href="${STACK_URL}"
         style="display:inline-block; text-decoration:none; padding:12px 16px; border-radius:12px;
                background:#111827; color:#ffffff; font-weight:700; border:1px solid #1f2937;">
        View the asset stack
      </a>

      <hr style="border:none; border-top:1px solid #1f2937; margin:20px 0;">

      <div style="font-size:12px; color:#94a3b8;">
        Best regards,<br>
        <b style="color:#e5e7eb;">${escapeHtml(SIGNER)}</b><br>
        ${DOMAINS}, available for private acquisition
      </div>
    </div>
  </div>
</div>
    `;

    // Auto-reply goes to a third-party address, so cap how often one address / one IP can trigger it.
    const ip = String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "")
      .split(",")[0]
      .trim();
    const autoReplyAllowed =
      allowHit(`email:${email.toLowerCase()}`, 2) && allowHit(`ip:${ip || "unknown"}`, 5);

    let autoInfo = null;
    let autoFailed = false;

    if (autoReplyAllowed) {
      try {
        autoInfo = await transporter.sendMail({
          from: `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
          to: email,
          replyTo: `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
          subject,
          text,
          html,
          headers: {
            "Auto-Submitted": "auto-replied",
            "X-Auto-Response-Suppress": "All",
          },
        });
      } catch (err) {
        autoFailed = true;
        console.error("AUTO_REPLY_FAILED:", err);
      }
    } else {
      console.log("Auto-reply skipped: rate limit", { email, ip });
    }

    return res.status(200).json({
      success: true,
      adminSent: !!adminInfo?.messageId,
      autoReplySent: !!autoInfo?.messageId,
      autoError: autoFailed ? "Auto-reply failed" : null,
    });
  } catch (e) {
    console.error("CONTACT_API_ERROR:", e);
    // Generic message: the form shows this text to visitors, so never expose internal details.
    return res.status(500).json({ success: false, error: "Something went wrong. Please try again later." });
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
