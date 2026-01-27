import nodemailer from "nodemailer";

// 1. إعدادات الحظر (سهلة التعديل مستقبلاً)
const SPAM_CONFIG = {
  ips: ["92.255.85.72", "92.255.85.74"],
  keywords: ["Roberttum", "Cryto", "Investment", "Google leads"], // كلمات ممنوعة في الاسم أو الشركة
  emails: ["michael_kennedy@brown.edu", "eric.jones.z.mail@gmail.com"]
};

// تخزين مؤقت للحد من التكرار (Simple Rate Limiting)
const ipStore = new Map();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const data = req.body || {};
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
    
    // استخراج البيانات الأساسية
    const name = (data.Name || "").trim();
    const email = (data.email || data.Email || "").trim();
    const company = (data.Company || "").trim();
    const message = data.Message || "(no message)";
    const bundle = data.Selected_Asset_Bundle || "General";
    
    // ============================================================
    // منطقة الحماية (The Firewall)
    // ============================================================
    
    // 1. فحص المصيدة (Honeypot): يجب أن يكون حقل website فارغاً
    const isHoneypotFilled = data.website && data.website.length > 0;

    // 2. فحص سرعة الروبوت (إذا أرسل في أقل من 2.5 ثانية)
    const isBotSpeed = data.formStartTs && (Date.now() - Number(data.formStartTs) < 2500);

    // 3. فحص المحتوى المحظور (الاسم، الشركة، الإيميل)
    const containsSpamContent = SPAM_CONFIG.keywords.some(k => 
      name.toLowerCase().includes(k.toLowerCase()) || 
      company.toLowerCase().includes(k.toLowerCase())
    );
    const isBlockedEmail = SPAM_CONFIG.emails.includes(email.toLowerCase());

    // 4. فحص الـ IP
    const isBlockedIP = SPAM_CONFIG.ips.includes(ip);

    // إذا تحقق أي شرط من شروط السبام، نعطي نجاح وهمي وننهي العملية فوراً
    if (isHoneypotFilled || isBotSpeed || containsSpamContent || isBlockedEmail || isBlockedIP) {
      console.log(`⛔ Spam blocked from IP: ${ip} | Name: ${name}`);
      return res.status(200).json({ success: true, message: "Sent!" }); // خداع البوت
    }

    // ============================================================
    // فحص التكرار (Rate Limiting)
    // ============================================================
    const lastRequest = ipStore.get(ip);
    if (lastRequest && Date.now() - lastRequest < 24 * 60 * 60 * 1000) {
       // يمكنك تفعيل هذا السطر إذا أردت منعهم، أو تركه لعدم إزعاج المستخدمين الحقيقيين
       // return res.status(429).json({ error: "Try again later" });
    }
    ipStore.set(ip, Date.now());

    // ============================================================
    // إرسال الإيميل (فقط للطلبات النظيفة)
    // ============================================================
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 465,
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    // إيميل الإشعار لك
    await transporter.sendMail({
      from: `"GNOSIS System" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: `New Inquiry: ${bundle} [${name}]`,
      text: `From: ${name} (${email})\nCompany: ${company}\nLocation IP: ${ip}\n\nMessage:\n${message}`,
    });

    // إيميل التأكيد للمستخدم
    if (email) {
      await transporter.sendMail({
        from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "We received your inquiry",
        text: "Thank you via Gnosis Assets. We will get back to you shortly.",
      });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Handler Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
