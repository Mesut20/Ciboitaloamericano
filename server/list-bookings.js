import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: './.env' });

async function main(){
  const prisma = new PrismaClient();
  try {
    const all = await prisma.booking.findMany({ orderBy: { createdAt: 'asc' } });
    console.log('Bookings:', all);
    const out = await prisma.outbox.findMany({ orderBy: { createdAt: 'asc' } });
    console.log('Outbox:', out);
  } catch (e) {
    console.error('Failed to list DB:', e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
