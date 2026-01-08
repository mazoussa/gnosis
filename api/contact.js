import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const {
      Name,
      email,
      Selected_Asset_Bundle,
      Message,
      Consent,
      NDA_Requested
    } = req.body;

    if (!Name || !email || !Selected_Asset_Bundle || !Consent) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: `"Gnosis Assets" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: `New Inquiry — ${Selected_Asset_Bundle}`,
      html: `
        <h2>New Confidential Inquiry</h2>
        <p><strong>Name:</strong> ${Name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Asset:</strong> ${Selected_Asset_Bundle}</p>
        <p><strong>NDA Requested:</strong> ${NDA_Requested ? "Yes" : "No"}</p>
        <p><strong>Message:</strong><br/>${Message || "-"}</p>
      `
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("CONTACT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
}
