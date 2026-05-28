# Madisonville PickPoint Stock Tracker

Internal inventory tracker for **Madisonville Family Medicine** PickPoint intelligent pharmacy vending machine. Instantly see what medications are stocked so you can prescribe the exact NDC/strength/form that dispenses without adjustments.

**Madisonville Family Medicine** · 712 S. May St, Madisonville, TX 77864 · 936-348-3418

---

## Features

- Real-time searchable inventory table (69 medications seeded from April 29, 2026 PDF)
- One-click **Copy Rx Text** with exact NDC, strength, and machine location
- **Dispense** workflow with quantity tracking and activity log
- Low stock alerts with suggested reorder quantities
- PIN-protected admin mode (add/edit/delete, JSON import/export, reset to seed data)
- All data persisted in `localStorage` — no backend required

---

## Run Locally

```bash
cd C:\Users\alexa\Projects\madisonville-pickpoint-stock-tracker
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Admin PIN

```
mpp2026
```

Use **Admin Mode** in the header to unlock add/edit/delete, export, import, and reset.

---

## Deploy to Vercel (< 2 minutes)

1. Push this repo to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial PickPoint stock tracker"
   git remote add origin https://github.com/YOUR_USERNAME/madisonville-pickpoint-stock-tracker.git
   git push -u origin main
   ```

2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.

3. Framework preset: **Next.js** (auto-detected). No environment variables needed.

4. Click **Deploy**. Your app will be live in under 2 minutes.

---

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- lucide-react icons
- Sonner toasts
- localStorage persistence

---

## For Internal Use Only

HealthPoint FQHC Madisonville — authorized clinic staff only.
