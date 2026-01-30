import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // --- التحقق من التوكن (Header Token) ---
  const formToken = req.headers["x-form-token"];
  const SECRET_TOKEN = process.env.FORM_TOKEN_SECRET;

  if (!SECRET_TOKEN || formToken !== SECRET_TOKEN) {
    return res.status(403).json({ success: false, error: "Unauthorized request" });
  }

  try {
    const data = req.body || {};

    // ----------------------------
    // Anti-spam: Honeypot (Defensive)
    // ----------------------------
    const hp = typeof data.website === "string" ? data.website.trim() : "";
    if (hp) {
      console.log("Honeypot Triggered");
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    const startTs = Number(data.formStartTs || 0);
    if (startTs && Date.now() - startTs < 2500) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // ----------------------------
    // Targeted content blocker
    // ----------------------------
    const checkName = String(data.Name || data.name || "").toLowerCase();
    const checkCompany = String(data.Company || data.company || "").toLowerCase();

    if (checkName.includes("roberttum") || checkCompany.includes("google")) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // ----------------------------
    // SMTP transport
    // ----------------------------
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Support both "email" and "Email"
    const rawEmail = data.email ?? data.Email;
    const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

    const name = String(data.Name || "Unknown");
    const company = String(data.Company || "Not specified");
    const bundle = String(data.Selected_Asset_Bundle || "General");
    const message = String(data.Message || "(no message)");

    if (!email) {
      return res.status(400).json({ success: false, error: "Missing visitor email" });
    }

    // Admin email
    const adminInfo = await transporter.sendMail({
      from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: `New Inquiry: ${bundle} – from gnosisbase.com`,
      text: `Name: ${name}
Company: ${company}
Email: ${email}
Bundle: ${bundle}

Message:
${message}`,
    });

    // Auto-reply (safe try/catch)
    let autoInfo = null;
    try {
      autoInfo = await transporter.sendMail({
        from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Confirmation: Inquiry Received – Gnosis Assets",
        text: `Thank you ${name}, we have received your inquiry for ${bundle}.`,
        // ضع HTML هنا إن رغبت (كما في كودك الأصلي)
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
    return res.status(500).json({ success: false, error: e?.message || "Server error" });
  }
}
