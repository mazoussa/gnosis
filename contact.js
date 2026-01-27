import nodemailer from "nodemailer";

const BLOCKED_IPS = ["92.255.85.72", "92.255.85.74"];

const ipStore = new Map();
const WINDOW_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const data = req.body || {};

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    if (BLOCKED_IPS.includes(ip)) {
      return res.status(200).json({ success: true });
    }

    const hp = (data.website || "").trim();
    if (hp) return res.status(200).json({ success: true });

    const startTs = Number(data.formStartTs || 0);
    if (startTs && Date.now() - startTs < 2500) {
      return res.status(200).json({ success: true });
    }

    const now = Date.now();
    const last = ipStore.get(ip);

    if (last && now - last < WINDOW_MS) {
      return res.status(429).json({
        success: false,
        error: "Too many requests from this IP. Please wait 24 hours.",
      });
    }

    ipStore.set(ip, now);

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
      return res.status(400).json({ success: false, error: "Missing email" });
    }

    await transporter.sendMail({
      from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: `New Inquiry: ${bundle} – gnosisbase.com`,
      text: `Name: ${name}
Company: ${company}
Email: ${email}
Bundle: ${bundle}
Sender IP: ${ip}

Message:
${message}`,
    });

    await transporter.sendMail({
      from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Inquiry received – Gnosis Assets",
      text: `Thank you for contacting Gnosis Assets.

We have received your inquiry and will respond within 24 business hours.

— Gnosis Assets`,
      headers: {
        "Auto-Submitted": "auto-replied",
        "X-Auto-Response-Suppress": "All",
      },
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
