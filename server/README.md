Booking backend (server)

Quick start

1. Install dependencies

```bash
cd server
npm install
```

2. Generate Prisma client and run migrations

```bash
npx prisma generate
npx prisma migrate dev --name init
```

3. Run dev server and worker

```bash
npm run dev   # runs Express server
# in another terminal
node ./dist/emailWorker.js
```

Notes
- The server provides `POST /api/bookings` and `GET /api/availability?date=YYYY-MM-DD`.
- The outbox table ensures email sending is reliable and decoupled from DB transactions.
