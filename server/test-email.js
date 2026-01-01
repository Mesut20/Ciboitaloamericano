import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config({ path: './.env' });

async function main() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    FROM_EMAIL,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT) {
    console.error('SMTP_HOST or SMTP_PORT not set in server/.env');
    process.exit(1);
  }

  const port = Number(SMTP_PORT || 587);
  const secure = port === 465;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 20000,
  });

  const booking = {
    name: 'Test Person',
    email: 'mesut.karadag02@gmail.com',
    date: new Date().toISOString().slice(0,10),
    time: '19:00',
    partySize: 2,
  };

  const mailOptions = {
    from: FROM_EMAIL || SMTP_USER || 'no-reply@example.com',
    to: booking.email,
    subject: `Bekräftelse — Testbokning ${booking.date} ${booking.time}`,
    text: `Hej ${booking.name}\n\nDetta är ett test av bokningsbekräftelse.\nDatum: ${booking.date}\nTid: ${booking.time}\nAntal: ${booking.partySize}\n\nHälsningar,\nCibo Italo-Americano`,
    html: `<p>Hej ${booking.name},</p><p>Detta är ett test av bokningsbekräftelse.</p><ul><li><strong>Datum:</strong> ${booking.date}</li><li><strong>Tid:</strong> ${booking.time}</li><li><strong>Antal:</strong> ${booking.partySize}</li></ul><p>Hälsningar,<br/>Cibo Italo‑Americano</p>`,
  };

  try {
    console.log('Attempting SMTP connection and send...');
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent:', info.messageId);
    if (info.response) console.log('Response:', info.response);
    console.log('Preview URL (if available):', nodemailer.getTestMessageUrl(info) || 'N/A');
    process.exit(0);
  } catch (err) {
    console.error('Failed to send email', err);
    process.exit(2);
  }
}

main();
