import nodemailer from "nodemailer";

// 1. قائمة حظر العناوين (IPs) - (قد لا تكون كافية وحدها)
const BLOCKED_IPS = ["92.255.85.72", "92.255.85.74"];

// 2. قائمة حظر المحتوى (الأسماء والإيميلات المزعجة) - هذا هو الحل الجذري لـ Roberttum
const BLOCKED_CONTENT = {
  names: ["Roberttum", "Cryto", "Investment", "Google leads"],
  emails: ["michael_kennedy@brown.edu", "eric.jones.z.mail@gmail.com"]
};

// ملاحظة: المتغيرات العامة مثل ipStore قد لا تعمل بدقة 100% على Vercel لأن السيرفر يغلق ويعمل عند الطلب
// لكن سنبقيها كخط دفاع إضافي بسيط
const ipStore = new Map();
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 ساعة

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const data = req.body || {};
    
    // استخراج البيانات وتنظيفها
    const name = (data.Name || "Unknown").trim();
    const email = (data.email || data.Email || "").trim();
    const company = data.Company || "Not specified";
    const bundle = data.Selected_Asset_Bundle || "General";
    const message = data.Message || "(no message)";

    // الحصول على IP
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    // ---------------------------------------------------------
    // خط الدفاع الأول: حظر الـ IP المعروف
    // ---------------------------------------------------------
    if (BLOCKED_IPS.includes(ip)) {
      console.log(`Blocked IP: ${ip}`);
      return res.status(200).json({ success: true }); // نجاح وهمي
    }

    // ---------------------------------------------------------
    // خط الدفاع الثاني: المصيدة (Honeypot)
    // ---------------------------------------------------------
    // هذا الحقل website موجود في كود HTML الخاص بك وهو مخفي
    const hp = (data.website || "").trim();
    if (hp) {
      console.log("Honeypot filled - Spam blocked");
      return res.status(200).json({ success: true }); // نجاح وهمي
    }

    // ---------------------------------------------------------
    // خط الدفاع الثالث: توقيت الإرسال (Bot Speed)
    // ---------------------------------------------------------
    const startTs = Number(data.formStartTs || 0);
    // إذا تم الإرسال في أقل من 2.5 ثانية، فهو روبوت
    if (startTs && Date.now() - startTs < 2500) {
        console.log("Form submitted too fast - Bot detected");
        return res.status(200).json({ success: true });
    }

    // ---------------------------------------------------------
    // خط الدفاع الرابع (الأهم): فلترة المحتوى (Roberttum Killer)
    // ---------------------------------------------------------
    const lowerName = name.toLowerCase();
    const lowerEmail = email.toLowerCase();

    // هل الاسم يحتوي على كلمة محظورة؟
    const isBlockedName = BLOCKED_CONTENT.names.some(blockedName => 
        lowerName.includes(blockedName.toLowerCase())
    );
    
    // هل الإيميل محظور؟
    const isBlockedEmail = BLOCKED_CONTENT.emails.includes(lowerEmail);

    if (isBlockedName || isBlockedEmail) {
        console.log(`Content Blocked: Name=${name}, Email=${email}`);
        // نعطيه نجاح وهمي حتى يعتقد أنه نجح ولا يحاول تغيير أسلوبه
        return res.status(200).json({ success: true });
    }

    // ---------------------------------------------------------
    // خط الدفاع الخامس: Rate Limiting (بسيط)
    // ---------------------------------------------------------
    const now = Date.now();
    const last = ipStore.get(ip);

    if (last && now - last < WINDOW_MS) {
      return res.status(429).json({
        success: false,
        error: "Too many requests from this IP. Please wait 24 hours.",
      });
    }
    ipStore.set(ip, now);

    // ---------------------------------------------------------
    // الإرسال الفعلي (إذا نجح في تجاوز كل ما سبق)
    // ---------------------------------------------------------
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    if (!email) {
      return res.status(400).json({ success: false, error: "Missing email" });
    }

    // إرسال الإشعار لك
    await transporter.sendMail({
      from: `"GNOSIS Assets" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email, // لكي تستطيع الرد عليه مباشرة بضغطة زر
      subject: `New Inquiry: ${bundle} – gnosisbase.com`,
      text: `Name: ${name}
Company: ${company}
Email: ${email}
Bundle: ${bundle}
Sender IP: ${ip}

Message:
${message}`,
    });

    // إرسال تأكيد للمستخدم (Auto-reply)
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
    console.error("Server Error:", e);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
