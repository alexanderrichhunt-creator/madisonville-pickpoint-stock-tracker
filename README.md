# Madisonville PickPoint Stock Tracker

## Start in 2 clicks (easiest)

1. **Install Node.js once** from [nodejs.org](https://nodejs.org) (LTS version)
2. **Double-click `START-APP.bat`** in this folder

Your browser opens to **http://localhost:3000** with all 69 medications loaded.

| Action | How |
|--------|-----|
| Search / filter inventory | Use the main table |
| Dispense | Click **Dispense** on any row (no login needed) |
| Admin (add/edit/delete) | Click **Admin Login** → `admin` / `mpp2026` |

Data saves in your browser on this computer. See `GET-STARTED.txt` for more detail.

---

Internal inventory tracker for **Madisonville Family Medicine** PickPoint intelligent pharmacy vending machine.

**Madisonville Family Medicine** · 712 S. May St, Madisonville, TX 77864 · 936-348-3418

---

## Features

- 69 medications seeded from the April 29, 2026 PDF
- Search + multi-category filters
- One-click **Copy Rx** text with exact NDC + location
- Dispense tracking with full activity log
- Low-stock alerts
- Machine capacity display (90 slots default, editable by admins)
- Provider **Suggestions** tab
- **Local mode** (default): works immediately, no Google setup
- **Shared mode** (optional): Google Sheets for whole-clinic sync

---

## Local Mode vs Shared Mode

**Local mode** (default — already configured in `.env.local`):

```
NEXT_PUBLIC_LOCAL_MODE=true
```

No Google Sheets needed. Perfect for one computer in the clinic.

**Shared mode** (when ready for the whole team): set `NEXT_PUBLIC_LOCAL_MODE=false` and add Google Sheets credentials. See deployment section below.

---

## Admin Login

- Username: `admin`
- Password: `mpp2026`

---

## Run Locally (manual)

```bash
cd C:\Users\alexa\Projects\madisonville-pickpoint-stock-tracker
npm install
npm run dev
```

Open http://localhost:3000

---

## Deploy Online (whole clinic)

Local mode is for one computer. For **shared online access**, use **Render + Google Sheets** (not Neon).

**Full step-by-step guide:** [`DEPLOY-ONLINE.md`](DEPLOY-ONLINE.md)

Summary:
1. Create Google Sheet + service account (reuse Talk Tracker credentials if you have them)
2. Push repo to GitHub
3. Deploy on Render with env vars from `.env.local.example`
4. Visit `/api/bootstrap-admin` once after deploy

---

## For Internal Use Only

HealthPoint FQHC Madisonville — authorized clinic staff only.
