import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const id = Number(process.argv[2] || '20');
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    console.error('Booking not found:', id);
    process.exit(1);
  }

  const secret = process.env.ADMIN_ACTION_SECRET;
  if (!secret) {
    console.error('ADMIN_ACTION_SECRET not set in environment');
    process.exit(1);
  }

  const data = `${booking.id}:${booking.createdAt.toISOString()}`;
  const token = crypto.createHmac('sha256', secret).update(data).digest('base64url');

  const backend = (process.env.BACKEND_ORIGIN || 'http://localhost:4000').replace(/\/+$/, '');

  const approveQuery = `${backend}/api/bookings/${booking.id}/admin-action?action=approve&token=${token}`;
  const cancelQuery = `${backend}/api/bookings/${booking.id}/admin-action?action=cancel&token=${token}`;
  const approvePath = `${backend}/api/bookings/${booking.id}/admin-action/${encodeURIComponent(token)}/approve`;
  const cancelPath = `${backend}/api/bookings/${booking.id}/admin-action/${encodeURIComponent(token)}/cancel`;

  console.log('Booking:', booking);
  console.log('Token:', token);
  console.log('--- URLs ---');
  console.log('Approve (query):', approveQuery);
  console.log('Cancel (query):', cancelQuery);
  console.log('Approve (path):', approvePath);
  console.log('Cancel (path):', cancelPath);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
