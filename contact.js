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
  // ✅ CORS headers for ALL responses
  setCors(req, res);

  // ✅ Handle Preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const data = req.body || {};
    const clientIp = getClientIp(req);

    // 1 توكن سري (أول فلتر سريع)
    const token = String(req.headers["x-form-token"] || "");
    if (!process.env.FORM_TOKEN || token !== process.env.FORM_TOKEN) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 2 فحص Origin و Referer
    const origin = String(req.headers.origin || "");
    const referer = String(req.headers.referer || "");
    const allowed = ["https://gnosisbase.com", "https://www.gnosisbase.com"];

    const okOrigin = allowed.includes(origin);
    const okReferer = allowed.some((d) => referer.startsWith(d));

    if (!okOrigin && !okReferer) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 3 حظر رينج IP المزعج
    if (clientIp && clientIp.startsWith("92.255.85.")) {
      console.log("Blocked IP range:", clientIp);
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 4 Honeypot
    const hp = String(data.website || "").trim();
    if (hp) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 5 Time trap
    const startTs = Number(data.formStartTs || 0);
    if (startTs && Date.now() - startTs < 2500) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 6 حظر الاسم المستهدف فقط
    const checkName = String(data.Name || data.name || "").toLowerCase().trim();
    if (checkName.includes("roberttum")) {
      console.log("Blocked targeted spam:", checkName, "IP=", clientIp);
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 7 تطبيع وقطع الأطوال
    const name = String(data.Name || data.name || "Unknown").trim().slice(0, 120);
    const company = String(data.Company || data.company || "Not specified").trim().slice(0, 120);
    const email = String(data.email || data.Email || "").trim().slice(0, 200);
    const bundle = String(data.Selected_Asset_Bundle || "General").trim().slice(0, 120);
    const message = String(data.Message || "(no message)").trim().slice(0, 4000);

    if (!email) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // 8 SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // 9 بريد الأدمن
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

    // 10 رد تلقائي مع تصميمك
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
  <div style="max-width:640px; margin:0 auto; border:1px solid #121826; border-radius:14 Compose a warm but concise French email response to a client inquiry about the full portfolio, using the user's preference that explanation is Arabic but text models in French. The user asked to "إرسال نسخة جاهزة 100% من الملفين معًا" earlier but now wants code. Actually current request is to modify code. So no email. Need to provide code only. Wait user asked explicitly: "ارجو منك التعديل على الكود باضافة CORS + OPTIONS" - done. Must ensure code compiles; but I see accidental corruption in HTML string: "... border-radius:14 Compose a warm..." It got inserted due to instruction? I must fix that; provide complete html exactly as before. Let's craft clean html string identical to user's original. Provide final code block. Also add Access-Control-Allow-Credentials? not needed. Also ensure CORS header includes Accept. Ok.
