import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // --- التحقق من التوكن (Header Token) ---
  const formToken = req.headers["x-form-token"];
  const SECRET_TOKEN = "GNOSIS_SECRET_2026_9f3c";

  if (formToken !== SECRET_TOKEN) {
    return res.status(403).json({ success: false, error: "Unauthorized request" });
  }

  try {
    const data = req.body || {};

    // ----------------------------
    // Anti-spam: Honeypot (تم التصحيح هنا)
    // ----------------------------
    // نتحقق من النوع قبل استخدام trim لمنع الانهيار
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
    // الحماية من محتوى محدد (Roberttum)
    // ----------------------------
    const checkName = String(data.Name || data.name || "").toLowerCase();
    const checkCompany = String(data.Company || data.company || "").toLowerCase();

    if (checkName.includes("roberttum") || checkCompany.includes("google")) {
      return res.status(200).json({ success: true, autoReplySent: false });
    }

    // ----------------------------
    // معالجة البيانات SMTP
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

    // تأمين جلب البريد الإلكتروني
    const email = typeof data.email === "string" ? data.email.trim() : "";
    const name = String(data.Name || "Unknown");
    const company = String(data.Company || "Not specified");
    const bundle = String(data.Selected_Asset_Bundle || "General");
    const message = String(data.Message || "(no message)");

    if (!email) {
      return res.status(400).json({ success: false, error: "Missing visitor email" });
    }

    // إرسال الإيميل للمسؤول
    const adminInfo = await transporter.sendMail({
      from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: `New Inquiry: ${bundle} – from gnosisbase.com`,
      text: `Name: ${name}\nCompany: ${company}\nEmail: ${email}\nBundle: ${bundle}\n\nMessage:\n${message}`,
    });

    // إرسال الرد التلقائي (Auto-reply)
    let autoInfo = null;
    try {
      autoInfo = await transporter.sendMail({
        from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Confirmation: Inquiry Received – Gnosis Assets",
        text: `Thank you ${name}, we have received your inquiry for ${bundle}.`,
        // يمكنك إضافة الـ HTML هنا كما في كودك الأصلي
      });
    } catch (e) {
      console.error("Auto-reply failed:", e);
    }

    return res.status(200).json({
      success: true,
      adminSent: !!adminInfo?.messageId,
      autoReplySent: !!autoInfo?.messageId
    });

  } catch (e) {
    console.error("CONTACT_API_ERROR:", e);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
