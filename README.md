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

## Deploy to Render (Recommended - Mimics the Working Madisonville Branch Talk Tracker)

This project now uses the same reliable pattern as your working **Madisonville Branch Talk Tracker**:

- Next.js frontend (exact same UI you have now)
- Google Sheets as the database (via service account - same as the Talk Tracker)

This eliminates all the Prisma/Neon engine problems.

### Deployment (Google Sheets Backend - Same as Your Working Talk Tracker)

This now uses the exact same reliable pattern as your **Madisonville Branch Talk Tracker**:

- Google Sheets as the database (via Service Account)
- Simple load/save per tab (same pattern as the Talk Tracker)

#### Steps

1. Create a new Google Sheet (e.g. "PickPoint Inventory").
2. Create these tabs with the following headers (first row):
   - **Medications**: id, ndc, name, strength, size, class, categories, qty, lowQty, highQty, machine, drawer, row, cost
   - **Activity**: id, timestamp, medicationId, drugName, ndc, qtyDispensed, remainingQty
   - **Suggestions**: id, name, strength, ndc, suggestedCount, notes, requestedBy, requestedAt
   - **Settings**: key, value

3. Create a Google Service Account (same as your Talk Tracker):
   - Go to Google Cloud Console → IAM & Admin → Service Accounts
   - Create a new service account
   - Create a JSON key and download it (credentials.json)

4. Share the Google Sheet with the service account email (give it Editor access).

5. On Render:
   - Set these Environment Variables:
     - `GOOGLE_SERVICE_ACCOUNT_JSON` = the full JSON content of your credentials.json (or base64 encoded)
     - `GOOGLE_SHEETS_SPREADSHEET_ID` = the ID from your sheet URL
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm run start -- -p $PORT`

6. Deploy.

After deploy, visit `/api/bootstrap-admin` once to create the initial admin user.

Then log in with admin / mpp2026.

Changes will now persist like in your working Talk Tracker.

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
