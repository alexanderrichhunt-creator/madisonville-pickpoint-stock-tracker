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

### Option A: Using render.yaml (Recommended)

The project includes a `render.yaml` file. This gives you:
- Consistent build + start commands
- Better caching behavior between deploys
- Easier configuration

1. Push your code to GitHub.
2. On Render, go to **New +** → **Blueprint** (or "Deploy from Blueprint").
3. Connect the GitHub repo.
4. Render will detect the `render.yaml` and create the service for you.
5. After creation, go to the service → **Environment** tab and manually add:
   - `DATABASE_URL` (your Neon connection string)
   - `NEXTAUTH_URL` (your `https://your-app.onrender.com`)
   - `NEXTAUTH_SECRET` (a long random string)
6. Deploy.

### Option B: Manual Setup

If you prefer to set it up manually:

1. Push this repo to GitHub.
2. On Render: New → Web Service → connect the GitHub repo.
3. Use these settings:
   - **Build Command**: `npm cache clean --force && rm -rf node_modules && npm ci && rm -rf node_modules/.prisma && PRISMA_CLIENT_ENGINE_TYPE=library npx prisma generate && npx prisma db push && npm run build`
   - **Start Command**: `npm run start -- -p $PORT`
4. Add the required environment variables (see below).
5. Deploy.

On first visit after deploy the database will self-seed.

**Note about the "No build cache found" warning**:
This message comes from Next.js during `next build`. On Render (especially the free tier), full build caching is limited compared to services like Vercel. The `render.yaml` + Render's automatic `node_modules` caching helps reduce this over time. You can mostly ignore the warning — it does not mean the deploy is broken. Build times will improve slightly on subsequent deploys as Render caches what it can.

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
