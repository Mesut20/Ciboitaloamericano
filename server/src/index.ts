import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import { z } from "zod";

const prisma = new PrismaClient();
const app = express();
// Normalize frontend origin (strip trailing slash if present)
const rawOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const frontendOrigin = String(rawOrigin).replace(/\/+$/, "");
app.use(cors({ origin: frontendOrigin }));
app.use(bodyParser.json());

const bookingSchema = z.object({
  date: z.string(),
  time: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  partySize: z.number().int().min(1).max(8),
});

// Contact form endpoint: enqueue a new-contact outbox item
app.post('/api/messages', async (req, res) => {
  const { name, email, message } = req.body as { name?: string; email?: string; message?: string };
  if (!name || !email || !message) return res.status(400).json({ error: 'name, email and message required' });

  try {
    // use bookingId 0 as a placeholder in Outbox since Outbox.bookingId is required
    const payload = JSON.stringify({ type: 'new-contact', name, email, message });
    const out = await prisma.outbox.create({ data: { bookingId: 0, payload } });
    return res.status(201).json({ success: true, id: out.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Admin action endpoints for contact messages
app.get('/api/messages/:id/admin-action', async (req, res) => {
  const { id } = req.params;
  const { action, token } = req.query as { action?: string; token?: string };
  if (!action || !token) return res.status(400).send('action and token required');
  if (!['approve', 'cancel'].includes(action)) return res.status(400).send('invalid action');

  try {
    const outbox = await prisma.outbox.findUnique({ where: { id: Number(id) } });
    if (!outbox) return res.status(404).send('Message not found');

    const secret = process.env.ADMIN_ACTION_SECRET;
    if (!secret) return res.status(500).send('Admin token not configured');
    const crypto = await import('crypto');
    const data = `${outbox.id}:${outbox.createdAt.toISOString()}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (token !== expected) return res.status(403).send('Invalid token');

    // enqueue contact-action outbox message so the worker forwards it when approved
    const payload = JSON.stringify({ type: 'contact-action', action, outboxId: outbox.id, ...JSON.parse(outbox.payload) });
    await prisma.outbox.create({ data: { bookingId: 0, payload } });

    const verb = action === 'approve' ? 'godkänd' : 'avbruten';
    const html = `<!doctype html>
      <html>
        <head><meta charset="utf-8" /><title>Meddelande ${verb}</title></head>
        <body>
          <p>Meddelandet har nu status: <strong>${verb}</strong>.</p>
          <p>Du kan stänga detta fönster.</p>
        </body>
      </html>`;

    return res.type('html').status(200).send(html);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal error');
  }
});

app.get('/api/messages/:id/admin-action/:token/:action', async (req, res) => {
  const { id, token, action } = req.params as { id: string; token: string; action: string };
  if (!action || !token) return res.status(400).send('action and token required');
  if (!['approve', 'cancel'].includes(action)) return res.status(400).send('invalid action');

  try {
    const outbox = await prisma.outbox.findUnique({ where: { id: Number(id) } });
    if (!outbox) return res.status(404).send('Message not found');

    const secret = process.env.ADMIN_ACTION_SECRET;
    if (!secret) return res.status(500).send('Admin token not configured');
    const crypto = await import('crypto');
    const data = `${outbox.id}:${outbox.createdAt.toISOString()}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (token !== expected) return res.status(403).send('Invalid token');

    const payload = JSON.stringify({ type: 'contact-action', action, outboxId: outbox.id, ...JSON.parse(outbox.payload) });
    await prisma.outbox.create({ data: { bookingId: 0, payload } });

    const verb = action === 'approve' ? 'godkänd' : 'avbruten';
    const html = `<!doctype html>
      <html>
        <head><meta charset="utf-8" /><title>Meddelande ${verb}</title></head>
        <body>
          <p>Meddelandet har nu status: <strong>${verb}</strong>.</p>
          <p>Du kan stänga detta fönster.</p>
        </body>
      </html>`;

    return res.type('html').status(200).send(html);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal error');
  }
});

app.post("/api/bookings", async (req, res) => {
  const parse = bookingSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.errors });
  const { date, time, email, name, partySize } = parse.data;

  try {
    // Transaction: create booking and an outbox record in same transaction
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({ data: { date, time, email } });
      const payload = JSON.stringify({ type: 'new-booking', bookingId: booking.id, date, time, email, name, partySize });
      await tx.outbox.create({ data: { bookingId: booking.id, payload } });
      return booking;
    });

    return res.status(201).json({ success: true, booking: result });
  } catch (err: any) {
    if (err?.code === "P2002") {
      // Unique constraint failed: date+time
      return res.status(409).json({ error: "Time slot already booked" });
    }
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
});

app.get("/api/availability", async (req, res) => {
  // Supports two modes:
  // - ?date=YYYY-MM-DD  (existing single-day mode)
  // - ?from=YYYY-MM-DD&to=YYYY-MM-DD  (range mode)
  const { date, from, to } = req.query as { date?: string; from?: string; to?: string };
  try {
    if (from && to) {
      const booked = await prisma.booking.findMany({ where: { date: { gte: from, lte: to } } });
      return res.json({ booked });
    }
    if (date) {
      const booked = await prisma.booking.findMany({ where: { date } });
      return res.json({ booked });
    }
    return res.status(400).json({ error: "date or from+to required" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Admin action endpoint (approve/cancel) via GET link from email
// Supports both query-string token and path-token to improve compatibility with some mail clients/browsers.
app.get('/api/bookings/:id/admin-action', async (req, res) => {
  const { id } = req.params;
  const { action, token } = req.query as { action?: string; token?: string };
  if (!action || !token) return res.status(400).send('action and token required');
  if (!['approve', 'cancel'].includes(action)) return res.status(400).send('invalid action');

  try {
    const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
    if (!booking) return res.status(404).send('Booking not found');

    // validate token (HMAC of booking.id + createdAt using ADMIN_ACTION_SECRET)
    const secret = process.env.ADMIN_ACTION_SECRET;
    if (!secret) return res.status(500).send('Admin token not configured');
    const crypto = await import('crypto');
    const data = `${booking.id}:${booking.createdAt.toISOString()}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (token !== expected) return res.status(403).send('Invalid token');

    // perform action
    const newStatus = action === 'approve' ? 'approved' : 'canceled';
    await prisma.booking.update({ where: { id: booking.id }, data: { status: newStatus } });

    // enqueue outbox message to notify user
    const payload = JSON.stringify({ type: 'admin-action', action, bookingId: booking.id, date: booking.date, time: booking.time, email: booking.email });
    await prisma.outbox.create({ data: { bookingId: booking.id, payload } });

    // return a small friendly confirmation page that attempts to auto-close
    const verb = action === 'approve' ? 'godkänd' : 'avbruten';
    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Bokning ${verb}</title>
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;margin:24px;color:#111} .box{max-width:560px;margin:48px auto;padding:18px;border-radius:12px;border:1px solid #e6e6e6;background:#fff} .ok{color:#16a34a;font-weight:700}</style>
        </head>
        <body>
          <div class="box">
            <h2>Bokning <span class="ok">${verb}</span></h2>
            <p>Booking ${booking.id} har nu status: <strong>${newStatus}</strong>.</p>
            <p>Du kan stänga detta fönster.</p>
          </div>
          <script>
            // Try to close the window (will only work in some browsers/clients).
            try { window.close(); } catch(e){}
            // After a short delay, attempt to redirect to a tiny success page so the user sees something.
            setTimeout(()=>{
              try { document.body.style.opacity = '1'; } catch(e){}
            },750);
          </script>
        </body>
      </html>`;

    return res.type('html').status(200).send(html);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal error');
  }
});

// Alternate path-style endpoint: /api/bookings/:id/admin-action/:token/:action
// Some email clients strip query strings; embedding the token in the path is more robust.
app.get('/api/bookings/:id/admin-action/:token/:action', async (req, res) => {
  const { id, token, action } = req.params as { id: string; token: string; action: string };
  if (!action || !token) return res.status(400).send('action and token required');
  if (!['approve', 'cancel'].includes(action)) return res.status(400).send('invalid action');

  try {
    const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
    if (!booking) return res.status(404).send('Booking not found');

    const secret = process.env.ADMIN_ACTION_SECRET;
    if (!secret) return res.status(500).send('Admin token not configured');
    const crypto = await import('crypto');
    const data = `${booking.id}:${booking.createdAt.toISOString()}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (token !== expected) return res.status(403).send('Invalid token');

    const newStatus = action === 'approve' ? 'approved' : 'canceled';
    await prisma.booking.update({ where: { id: booking.id }, data: { status: newStatus } });

    const payload = JSON.stringify({ type: 'admin-action', action, bookingId: booking.id, date: booking.date, time: booking.time, email: booking.email });
    await prisma.outbox.create({ data: { bookingId: booking.id, payload } });

    const verb = action === 'approve' ? 'godkänd' : 'avbruten';
    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Bokning ${verb}</title>
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;margin:24px;color:#111} .box{max-width:560px;margin:48px auto;padding:18px;border-radius:12px;border:1px solid #e6e6e6;background:#fff} .ok{color:#16a34a;font-weight:700}</style>
        </head>
        <body>
          <div class="box">
            <h2>Bokning <span class="ok">${verb}</span></h2>
            <p>Booking ${booking.id} har nu status: <strong>${newStatus}</strong>.</p>
            <p>Du kan stänga detta fönster.</p>
          </div>
          <script>
            try { window.close(); } catch(e){}
            setTimeout(()=>{ try { document.body.style.opacity = '1'; } catch(e){} },750);
          </script>
        </body>
      </html>`;

    return res.type('html').status(200).send(html);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal error');
  }
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Booking server listening on ${port}`);
});
