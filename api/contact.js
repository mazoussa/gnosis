import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  try {
    const data = req.body;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false, 
      auth: {
        user: process.env.SMTP_USER, 
        pass: process.env.SMTP_PASS,
      },
    });

    // 1. Send Admin Notification (To You)
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: "invest@gnosisbase.com", 
      replyTo: data.email, 
      subject: `New Inquiry: ${data.Selected_Asset_Bundle || 'General'} - from gnosisbase.com`,
      text: `
Name: ${data.Name}
Email: ${data.email}
Asset Bundle: ${data.Selected_Asset_Bundle}

Message:
${data.Message}
      `,
    });

    // 2. Send Auto-Response (To the Investor)
    await transporter.sendMail({
      from: `"Gnosis Assets Team" <${process.env.SMTP_USER}>`, 
      to: data.email, 
      replyTo: "invest@gnosisbase.com",
      subject: "Confirmation: Inquiry Received - Gnosis Assets",
      text: `Thank you for contacting Gnosis Assets.

We have successfully received your inquiry regarding the portfolio.

Our team is currently reviewing incoming requests. Please note that we prioritize inquiries from strategic buyers and institutional operators.

We aim to respond to all relevant acquisition requests within 24 business hours.

Best regards,

The Gnosis Assets Team
Identity Infrastructure for the AI Era.
https://gnosisbase.com
      `,
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false });
  }
}
