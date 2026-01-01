import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({ orderBy: { id: 'asc' } });
  const outbox = await prisma.outbox.findMany({ orderBy: { id: 'asc' } });
  console.log('Bookings:', JSON.stringify(bookings, null, 2));
  console.log('Outbox:', JSON.stringify(outbox, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
