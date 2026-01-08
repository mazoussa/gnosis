const nodemailer = require("nodemailer");

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  // Allow only POST
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    // Vercel sometimes gives req.body, sometimes not → handle both
    const body =
      (req.body && typeof req.body === "object" ? req.body : await readJsonBody(req));

    const {
      Name,
      email,
      Selected_Asset_Bundle,
      Message,
      Consent,
      NDA_Requested,
    } = body;

    // Basic validation
    if (!Name || !email || !Selected_Asset_Bundle || !Consent) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Env validation (very important)
    const SMTP_HOST = process.env.SMTP_HOST;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return res.status(500).json({
        success: false,
        message: "Server misconfigured: missing SMTP env vars",
      });
    }

    const MAIL_TO = process.env.MAIL_TO || SMTP_USER;
    const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
    const SMTP_SECURE = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE, // true for 465, false for 587
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    // Optional: verify connection (helps catch config errors)
    // await transporter.verify();

    const ndaYes = NDA_Requested ? "Yes" : "No";

    await transporter.sendMail({
      from: `Gnosis Assets <${SMTP_USER}>`,
      to: MAIL_TO,
      replyTo: email,
      subject: `New Inquiry — ${Selected_Asset_Bundle}`,
      html: `
        <h2>New Confidential Inquiry</h2>
        <p><strong>Name:</strong> ${String(Name)}</p>
        <p><strong>Email:</strong> ${String(email)}</p>
        <p><strong>Asset:</strong> ${String(Selected_Asset_Bundle)}</p>
        <p><strong>NDA Requested:</strong> ${ndaYes}</p>
        <p><strong>Message:</strong><br/>${Message ? String(Message) : "-"}</p>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("CONTACT ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
