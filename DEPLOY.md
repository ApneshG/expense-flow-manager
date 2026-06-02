# Deploying Expense Flow Manager to Render

End-to-end migration from Replit → Render. ~30 min total.

## Prerequisites
- A GitHub account
- A Render account (sign up free at https://render.com — use GitHub login)
- Your Replit project still accessible (for the data export)

---

## Step 1 — Push code to GitHub (5 min)

From this folder on your Mac (`expense-flow-manager`):

```bash
cd "/Users/apnesh/Apnesh Claude Code/expense-flow-manager"
git init
git add .
git commit -m "Initial commit: migrated from Replit"
```

Then on GitHub.com:
1. Click **+ → New repository**, name it `expense-flow-manager`, keep it **Private**, don't add README/gitignore (we have them).
2. Copy the two commands GitHub shows under "push an existing repository". They'll look like:
   ```bash
   git remote add origin https://github.com/<your-username>/expense-flow-manager.git
   git branch -M main
   git push -u origin main
   ```
3. Paste and run them.

## Step 2 — Create Render services (5 min)

1. Go to https://dashboard.render.com → **New → Blueprint**.
2. Connect your GitHub account if prompted, pick the `expense-flow-manager` repo.
3. Render detects `render.yaml` and shows two services: a Web Service + a Postgres database. Click **Apply**.
4. Wait ~5–10 min for the first build. The build runs `npm install && npm run build && npm run db:push`, so your schema is created automatically.

## Step 3 — Set the env var secrets (2 min)

In Render dashboard → **expense-flow-manager** service → **Environment** tab. Fill in the values marked "sync: false":

| Key | Value |
|---|---|
| `SENDGRID_API_KEY` | Your SendGrid API key (or leave blank — email just logs to console) |
| `ADMIN_EMAIL` | `akshatgera@gmail.com` |
| `APP_URL` | Leave blank initially. After deploy succeeds, copy the URL Render shows (e.g. `https://expense-flow-manager.onrender.com`) and paste here, then redeploy. |

## Step 4 — Migrate your live data from Replit (10 min)

### 4a. Get the Replit DATABASE_URL
In Replit workspace → Secrets / Tools → Database → copy the `DATABASE_URL` (starts with `postgresql://`).

### 4b. Dump from Replit (run on your Mac)

Install postgres tools if needed:
```bash
brew install postgresql@16
```

Then dump:
```bash
pg_dump "PASTE_REPLIT_DATABASE_URL_HERE" \
  --no-owner --no-acl --clean --if-exists \
  -f replit-dump.sql
```

This creates `replit-dump.sql` in your current directory.

### 4c. Get the Render DATABASE_URL
In Render dashboard → **expense-flow-db** → **Info** tab → copy the **External Database URL**.

### 4d. Restore into Render

```bash
psql "PASTE_RENDER_EXTERNAL_DATABASE_URL_HERE" -f replit-dump.sql
```

Expect some "table does not exist" notices on the DROP statements — that's normal on first import.

### 4e. Redeploy
In Render → **Manual Deploy → Clear build cache & deploy**. Your live data is now in production.

## Step 5 — Test it (3 min)

Open `https://expense-flow-manager.onrender.com` (or whatever Render assigned). Log in with your existing credentials. Confirm:
- Login works
- Dashboard shows your existing expenses/users
- Submitting a new expense works

---

## Troubleshooting

**Build fails with "Cannot find module @replit/..."** → make sure you pushed the cleaned `package.json` (no `@replit/*` entries).

**App boots but DB errors** → check the `DATABASE_URL` env var is set and the Postgres DB is in the same region.

**Free tier service "sleeps" after 15 min idle** → first request after sleep takes ~30s to wake. To prevent: upgrade Web Service to Starter ($7/mo).

**Free Postgres expires in 90 days** → upgrade to Starter Postgres ($7/mo) any time before then, or migrate to Neon free tier later.

## Future updates

After the first deploy, every `git push` to `main` auto-deploys to Render. Local dev workflow:

```bash
# Set DATABASE_URL in a local .env file pointing to Render DB (or a local Postgres)
npm run dev
# Open http://localhost:5000
```
