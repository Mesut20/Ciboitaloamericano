import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: './.env' });

async function main(){
  const prisma = new PrismaClient();
  try {
    const outbox = await prisma.outbox.deleteMany();
    const bookings = await prisma.booking.deleteMany();
    console.log('Deleted outbox:', outbox);
    console.log('Deleted bookings:', bookings);
  } catch (e) {
    console.error('Failed to clear DB:', e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
