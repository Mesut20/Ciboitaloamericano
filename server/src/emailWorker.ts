import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

async function processOutbox() {
  const items = await prisma.outbox.findMany({ where: { processed: false }, take: 10 });
  for (const item of items) {
    const payload = JSON.parse(item.payload);
    try {
      const fromAddress = process.env.FROM_EMAIL || process.env.ADMIN_EMAIL || "hello@ciboitaloamericano.se";

      if (payload.type === 'new-booking') {
        const { bookingId, date, time, email, name, partySize } = payload as any;

        // send confirmation to user (initial receipt)
        const userInfo = await transport.sendMail({
          from: fromAddress,
          to: email,
          replyTo: process.env.ADMIN_EMAIL || "hello@ciboitaloamericano.se",
          subject: "Bokningsbekräftelse",
          text: `Hej ${name},\n\nDin bokning är mottagen!\nDatum: ${date}\nTid: ${time}\nAntal personer: ${partySize}\n\nVi återkommer när restaurangen bekräftar din bokning.\n\nVänliga hälsningar,\nCibo Italo-Americano`,
        });

        // prepare admin notification with approve/cancel links
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        const adminEmail = process.env.ADMIN_EMAIL || "hello@ciboitaloamericano.se";
        let adminInfo: any = null;
        if (booking) {
          const secret = process.env.ADMIN_ACTION_SECRET || '';
          const crypto = await import('crypto');
          const data = `${booking.id}:${booking.createdAt.toISOString()}`;
          const token = secret ? crypto.createHmac('sha256', secret).update(data).digest('base64url') : '';

          // Use backend API origin for admin-action links so clicks hit the server directly
          const backendOrigin = (process.env.BACKEND_ORIGIN || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, '');
          // Build both query-string and path-style links; some clients preserve one but not the other.
          const approveLink = `${backendOrigin}/api/bookings/${booking.id}/admin-action?action=approve&token=${encodeURIComponent(token)}`;
          const cancelLink = `${backendOrigin}/api/bookings/${booking.id}/admin-action?action=cancel&token=${encodeURIComponent(token)}`;
          const approvePathLink = `${backendOrigin}/api/bookings/${booking.id}/admin-action/${encodeURIComponent(token)}/approve`;
          const cancelPathLink = `${backendOrigin}/api/bookings/${booking.id}/admin-action/${encodeURIComponent(token)}/cancel`;

          // send admin notification with HTML buttons (anchors styled as buttons)
          const html = `
            <p>Ny bokning mottagen:</p>
            <ul>
              <li><strong>Namn:</strong> ${name}</li>
              <li><strong>Epost:</strong> ${email}</li>
              <li><strong>Datum:</strong> ${date}</li>
              <li><strong>Tid:</strong> ${time}</li>
              <li><strong>Antal personer:</strong> ${partySize}</li>
            </ul>
            <p>
              <a href="${approveLink}" style="display:inline-block;padding:10px 18px;margin-right:8px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Godkänn</a>
              <a href="${cancelLink}" style="display:inline-block;padding:10px 18px;background:#ef4444;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Avbryt</a>
            </p>
            <p style="font-size:12px;color:#666;margin-top:12px;">Om din e-postklient tar bort query-parametrar, använd istället dessa länkar:</p>
            <p style="font-size:14px;margin-top:6px;">
              <a href="${approvePathLink}" style="margin-right:12px;color:#0366d6;">Godkänn (alternativ länk)</a>
              <a href="${cancelPathLink}" style="color:#0366d6;">Avbryt (alternativ länk)</a>
            </p>
          `;

          adminInfo = await transport.sendMail({
            from: fromAddress,
            to: adminEmail,
            subject: `Ny bokning: ${name} ${date} ${time}`,
            text: `Ny bokning mottagen:\n\nNamn: ${name}\nEpost: ${email}\nDatum: ${date}\nTid: ${time}\nAntal personer: ${partySize}\n\nGodkänn: ${approveLink}\nAvbryt: ${cancelLink}\n\n---`,
            html,
          });
        } else {
          // fallback admin notification without links
          adminInfo = await transport.sendMail({
            from: fromAddress,
            to: process.env.ADMIN_EMAIL || "hello@ciboitaloamericano.se",
            subject: `Ny bokning: ${name} ${date} ${time}`,
            text: `Ny bokning mottagen:\n\nNamn: ${name}\nEpost: ${email}\nDatum: ${date}\nTid: ${time}\nAntal personer: ${partySize}\n\n---`,
          });
        }

        await prisma.outbox.update({ where: { id: item.id }, data: { processed: true } });
        console.log("New booking emails sent", userInfo?.messageId, adminInfo?.messageId);
      } else if (payload.type === 'admin-action') {
        const { action, bookingId, date, time, email } = payload as any;
        // send notification to user depending on admin action
        if (action === 'approve') {
          await transport.sendMail({
            from: fromAddress,
            to: email,
            subject: 'Bokning bekräftad - Restaurangen har bekräftat din bokning',
            text: `Hej,\n\nBokning bekräftad! Restaurangen har bekräftat din bokning.\nDatum: ${date}\nTid: ${time}\n\nVälkommen!\nCibo Italo-Americano`,
          });
        } else if (action === 'cancel') {
          await transport.sendMail({
            from: fromAddress,
            to: email,
            subject: 'Bokning avbruten - Restaurangen har avbrutit din bokning',
            text: `Hej,\n\nBokning avbruten. Restaurangen har avbrutit din bokning. Vänligen kontakta oss för fler frågor.\nDatum: ${date}\nTid: ${time}\n\nVänliga hälsningar,\nCibo Italo-Americano`,
          });
        }

        // Also send a follow-up email to admin with an "Avbryt" button that can cancel even after approval.
        try {
          const backendOrigin = (process.env.BACKEND_ORIGIN || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, '');
          const booking = await prisma.booking.findUnique({ where: { id: Number(bookingId) } });
          const secret = process.env.ADMIN_ACTION_SECRET || '';
          const crypto = await import('crypto');
          const data = `${bookingId}:${booking?.createdAt.toISOString()}`;
          const token = secret ? crypto.createHmac('sha256', secret).update(data).digest('base64url') : '';
          const cancelPathLink = `${backendOrigin}/api/bookings/${bookingId}/admin-action/${encodeURIComponent(token)}/cancel`;
          const cancelQueryLink = `${backendOrigin}/api/bookings/${bookingId}/admin-action?action=cancel&token=${encodeURIComponent(token)}`;

          const adminHtml = `
            <p>Bokning ${action === 'approve' ? 'godkänd' : 'avbruten'}: <strong>${bookingId}</strong></p>
            <ul>
              <li><strong>Datum:</strong> ${date}</li>
              <li><strong>Tid:</strong> ${time}</li>
              <li><strong>Gäst:</strong> ${email}</li>
            </ul>
            <p>
              <a href="${cancelPathLink}" style="display:inline-block;padding:10px 18px;background:#ef4444;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Avbryt</a>
            </p>
            <p style="font-size:12px;color:#666;margin-top:12px;">Alternativ länk om din klient tar bort query-parametrar: <a href="${cancelQueryLink}">${cancelQueryLink}</a></p>
          `;

          await transport.sendMail({
            from: fromAddress,
            to: process.env.ADMIN_EMAIL || fromAddress,
            subject: `Bokning ${action === 'approve' ? 'godkänd' : 'avbruten'} - #${bookingId}`,
            text: `Bokning ${action === 'approve' ? 'godkänd' : 'avbruten'}: ${bookingId}\nDatum: ${date}\nTid: ${time}\n\nAvbryt: ${cancelQueryLink}`,
            html: adminHtml,
          });
        } catch (e) {
          console.error('Failed to send admin follow-up email', e);
        }

        await prisma.outbox.update({ where: { id: item.id }, data: { processed: true } });
        console.log('Admin action processed for booking', payload.bookingId, payload.action);
      } else {
        // handle contact messages
        if (payload.type === 'new-contact') {
          const { name, email, message } = payload as any;
          // send admin notification with approve/cancel links that reference this outbox item
          try {
            const secret = process.env.ADMIN_ACTION_SECRET || '';
            const crypto = await import('crypto');
            const data = `${item.id}:${item.createdAt.toISOString()}`;
            const token = secret ? crypto.createHmac('sha256', secret).update(data).digest('base64url') : '';
            const backendOrigin = (process.env.BACKEND_ORIGIN || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, '');
            const approveLink = `${backendOrigin}/api/messages/${item.id}/admin-action?action=approve&token=${encodeURIComponent(token)}`;
            const cancelLink = `${backendOrigin}/api/messages/${item.id}/admin-action?action=cancel&token=${encodeURIComponent(token)}`;
            const approvePathLink = `${backendOrigin}/api/messages/${item.id}/admin-action/${encodeURIComponent(token)}/approve`;
            const cancelPathLink = `${backendOrigin}/api/messages/${item.id}/admin-action/${encodeURIComponent(token)}/cancel`;

            const adminHtml = `
              <p>Nytt meddelande mottaget från kontaktformulär:</p>
              <ul>
                <li><strong>Namn:</strong> ${name}</li>
                <li><strong>Epost:</strong> ${email}</li>
                <li><strong>Meddelande:</strong><br/>${message}</li>
              </ul>
              <p>
                <a href="${approveLink}" style="display:inline-block;padding:10px 18px;margin-right:8px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Godkänn</a>
                <a href="${cancelLink}" style="display:inline-block;padding:10px 18px;background:#ef4444;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Avbryt</a>
              </p>
              <p style="font-size:12px;color:#666;margin-top:12px;">Alternativa länkar om klienten tar bort query-parametrar:</p>
              <p style="font-size:14px;margin-top:6px;">
                <a href="${approvePathLink}" style="margin-right:12px;color:#0366d6;">Godkänn (alternativ)</a>
                <a href="${cancelPathLink}" style="color:#0366d6;">Avbryt (alternativ)</a>
              </p>
            `;

            await transport.sendMail({
              from: fromAddress,
              to: process.env.ADMIN_EMAIL || 'hello@ciboitaloamericano.se',
              subject: `Nytt meddelande från kontaktformulär: ${name}`,
              text: `Nytt meddelande från ${name} (${email}):\n\n${message}\n\nGodkänn: ${approveLink}\nAvbryt: ${cancelLink}`,
              html: adminHtml,
            });
          } catch (e) {
            console.error('Failed to send admin contact notification', e);
          }

          await prisma.outbox.update({ where: { id: item.id }, data: { processed: true } });
        } else if (payload.type === 'contact-action') {
          const { action, name, email, message } = payload as any;
          // If approved, forward the message to the public hello@ address
          try {
            const forwardTo = process.env.FORWARD_CONTACT_TO || process.env.FROM_EMAIL || 'hello@ciboitaloamericano.se';
            if (action === 'approve') {
              await transport.sendMail({
                from: fromAddress,
                to: forwardTo,
                subject: `Kontaktformulär — ${name}`,
                text: `Meddelande från ${name} <${email}>:\n\n${message}`,
                html: `<p><strong>Från:</strong> ${name} &lt;${email}&gt;</p><p><strong>Meddelande:</strong></p><p>${message.replace(/\n/g, '<br/>')}</p>`,
              });
            } else {
              // optionally notify admin that message was cancelled; we'll skip for now
            }
          } catch (e) {
            console.error('Failed to forward contact message', e);
            await prisma.outbox.update({ where: { id: item.id }, data: { attempts: { increment: 1 } } });
            continue;
          }

          await prisma.outbox.update({ where: { id: item.id }, data: { processed: true } });
        } else {
          // unknown payload type: mark processed to avoid retry loop
          console.warn('Unknown outbox payload type', payload.type);
          await prisma.outbox.update({ where: { id: item.id }, data: { processed: true } });
        }
      }
    } catch (err) {
      console.error('Failed to process outbox item', item.id, err);
      await prisma.outbox.update({ where: { id: item.id }, data: { attempts: { increment: 1 } } });
    }
  }
}

async function loop() {
  while (true) {
    try {
      await processOutbox();
    } catch (e) {
      console.error(e);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

// Start the worker when this file is executed directly
loop().catch((e) => console.error(e));
