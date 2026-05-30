# Deploy Online — Render + Neon (Branch Secretary Tool pattern)

Production setup matches your **Branch Secretary Tool**: GitHub → Render → **Neon Postgres**.

No Google Sheets. No Neon confusion with old Streamlit desktop app.

---

## Architecture

| Layer | Service | Purpose |
|-------|---------|---------|
| Code | GitHub | Source + Render deploy |
| App | Render | Next.js at `*.onrender.com` |
| Database | Neon | Shared inventory for all users |
| Local dev | Your PC | `NEXT_PUBLIC_LOCAL_MODE=true` + browser storage |

---

## Render environment variables

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `DATABASE_URL` | **Yes** | Neon connection string from neon.tech |
| `NEXT_PUBLIC_LOCAL_MODE` | **Yes** | `false` |
| `NEXTAUTH_URL` | **Yes** | `https://your-service.onrender.com` |
| `NEXTAUTH_SECRET` | **Yes** | Long random string (40+ chars) |
| `ADMIN_INITIAL_PASSWORD` | Recommended | `mpp2026` |

**Build command:** `npm ci && npx prisma generate && npx prisma db push && npm run build`  
**Start command:** `npm run start -- -p $PORT`

(See `render.yaml` in repo.)

---

## One-time setup

### 1. Neon Postgres
- Same as Branch Secretary Tool — create project at [neon.tech](https://neon.tech)
- Copy connection string → `DATABASE_URL` on Render
- Must include `?sslmode=require`

### 2. GitHub
```powershell
cd C:\Users\alexa\Projects\madisonville-pickpoint-stock-tracker
git add .
git commit -m "Switch to Neon Postgres shared backend"
git push
```

### 3. Render
- New Web Service → connect repo
- Set env vars above
- Deploy

### 4. Bootstrap (once after first deploy)
Open: `https://YOUR-SERVICE.onrender.com/api/bootstrap-admin`

Should return `"success": true` and seed 69 medications if empty.

### 5. Verify sync
- Green banner: **Shared clinic inventory — changes sync for everyone**
- Dispense on phone → qty updates on desktop within 30 seconds

---

## Admin login

- Username: `admin`
- Password: value of `ADMIN_INITIAL_PASSWORD` (default `mpp2026`)

---

## Common issues (same as Branch Secretary Tool)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Data disappears on redeploy | No `DATABASE_URL` | Set Neon URL on Render |
| Red banner / not connected | Wrong or missing `DATABASE_URL` | Fix Neon string, redeploy |
| Login fails | Bootstrap not run | Visit `/api/bootstrap-admin` |
| Changes not visible | Old build still on Google Sheets path | Pull latest code, redeploy |
| Local works, online doesn't | `NEXT_PUBLIC_LOCAL_MODE=true` on Render | Set to `false`, redeploy |

---

## Local vs online

| | Local (`START-APP.bat`) | Online (Render) |
|--|-------------------------|-----------------|
| Storage | Browser localStorage | Neon Postgres |
| Banner | Blue “Local mode” | Green “Shared clinic inventory” |
| Others see changes | No | Yes |

---

For internal use only — HealthPoint FQHC Madisonville
