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

## Live Demo

**https://madisonville-pickpoint-stock-tracker.vercel.app** (coming soon after Vercel deploy)

## Deploy to Vercel (Recommended - Free)

This app is already set up for easy one-click deployment:

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Import the GitHub repository: `alexanderrichhunt-creator/madisonville-pickpoint-stock-tracker`
3. Vercel will auto-detect it's a Next.js project.
4. Click **Deploy**.

Your site will be live at something like `https://madisonville-pickpoint-stock-tracker.vercel.app` in under 2 minutes, with automatic deployments on every push to GitHub.

**Alternative (Render):** You can also deploy it on Render's free tier by connecting the same GitHub repo and selecting the `next` build command.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
