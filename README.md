# Madisonville PickPoint Stock Tracker

Internal inventory tracker for **Madisonville Family Medicine** PickPoint intelligent pharmacy vending machine.

**Madisonville Family Medicine** · 712 S. May St, Madisonville, TX 77864 · 936-348-3418

Real-time shared inventory for the entire clinic. Changes made by any admin are instantly visible to everyone.

---

## Features

- 69 medications seeded from the April 29, 2026 PDF (auto-seeds on first run against empty Neon DB)
- Search + multi-category filters (Respiratory, Acute Infection, Diabetes, Psych, Cardiovascular, Pain, etc.)
- One-click **Copy Rx** text with exact NDC + location
- Dispense tracking with full activity log
- Low-stock alerts (global rule: ≤ 2 units)
- Machine capacity display (90 slots default, editable by admins)
- Provider **Suggestions** tab — anyone can request new meds; admins convert them directly to inventory
- **Real shared database** (Neon Postgres + Prisma) — no more per-browser localStorage
- **Proper admin authentication** (Auth.js v5 Credentials) — replaces the old shared PIN

---

## First Run After Deploy (Important)

On a brand new Neon database the app will automatically seed all 69 medications and create a default admin account the first time anyone visits the site.

**Default admin login:**
- Username: `admin`
- Password: `mpp2026`

**Immediately after first login, consider changing the password** by updating the hash in the database or setting the `ADMIN_INITIAL_PASSWORD` environment variable and forcing a re-seed.

---

## Run Locally (with Neon)

1. Copy `.env.local.example` → `.env.local` (or create it)
2. Put your real Neon `DATABASE_URL` (and optional `ADMIN_INITIAL_PASSWORD`)
3. `npm install`
4. `npx prisma db push` (or let the app auto-migrate on first dev run)
5. `npm run dev`

The app will auto-seed medications + the admin user on first load if the tables are empty.

---

## Environment Variables

Required:

```
DATABASE_URL="postgresql://...neon.tech/..."
NEXTAUTH_URL="https://your-deployed-site.com"   # or http://localhost:3000 locally
NEXTAUTH_SECRET="a-long-random-string-at-least-32-chars"
```

Optional (for bootstrap password):

```
ADMIN_INITIAL_PASSWORD="mpp2026"
```

---

## Deploy to Render (Free Tier — Recommended)

This project was designed for the same Render + Neon stack used in prior internal tools.

1. Push this repo to GitHub.
2. On Render: New → Web Service → connect the GitHub repo.
3. Build Command: `npm install && npx prisma generate && npm run build`
4. Start Command: `npm start`
5. Add the environment variables above (especially the real Neon DATABASE_URL and a strong NEXTAUTH_SECRET).
6. Deploy.

On first visit after deploy the database will self-seed.

Render free web services sleep after inactivity; the first request after wake will auto-seed if needed (fast).

---

## Tech Stack (Current)

- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- Prisma ORM + Neon Postgres (serverless)
- Auth.js v5 (Credentials provider + Prisma adapter + JWT sessions)
- Server Actions for all mutations (protected by admin role)
- Optimistic UI + revalidation

All localStorage code has been removed. The single source of truth is the Neon database.

---

## Admin Actions (after login)

- Add / Edit / Delete medications
- Update machine slot capacity
- Export / Import full JSON inventory
- Reset to original April 2026 PDF data
- Remove provider suggestions or convert them into real stock

---

## For Internal Use Only

Authorized Madisonville Family Medicine / HealthPoint FQHC staff only.
