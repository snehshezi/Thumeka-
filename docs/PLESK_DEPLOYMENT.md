# Plesk Deployment Walkthrough — Thumeka

This is the click-by-click for deploying Thumeka to a Plesk Obsidian 18.x
server (mercury.hkdns.host) without SSH access. End result: pushing to
GitHub `main` automatically updates production.

## Prerequisites (one-time)

- [ ] Plesk login at https://mercury.hkdns.host/
- [ ] **Node.js extension installed**. Check: top-right Plesk search → "Node.js".
      If "Install" button appears → click it (free, ~30 seconds).
- [ ] **Git extension installed**. Same check; you already confirmed this.
- [ ] `thumeka.co.za` DNS pointed at the Plesk server's IP. To find the IP:
      Plesk → Tools & Settings → IP Addresses. Set an A record at your DNS
      provider: `thumeka.co.za` → that IP, plus `www.thumeka.co.za` → same.
- [ ] Production Supabase project created (done — `cvuurtscwatpowatncmf`).

---

## Phase 1 — Add the domain

1. Plesk home → **Domains** → **Add Domain**.
2. Domain name: `thumeka.co.za`
3. Skip the WordPress/auto-install prompts; choose **"Empty website"**.
4. After creation, click on the domain to enter its panel.

## Phase 2 — Set up Node.js

1. Inside the domain's panel, click **Node.js** in the sidebar (or "Show More" → Node.js).
2. Click **Enable Node.js**.
3. Configure:
   - **Node.js version**: 20.x (latest available)
   - **Document Root**: `/httpdocs` *(default; leave it)*
   - **Application Root**: `/httpdocs` *(this is where the code lives after Git pull)*
   - **Application URL**: `https://thumeka.co.za`
   - **Application Startup File**: `server.js`
   - **NPM install — Custom path**: leave blank
4. **Don't click Run NPM install yet.** We'll let Git deployment handle it.

## Phase 3 — Hook up Git deployment

1. In the same domain panel, click **Git**.
2. Click **Add Repository**.
3. Choose **Remote Git hosting** → enter:
   - **Repository URL**: `https://github.com/<your-username>/thumeka.git`
     (replace with your real repo URL)
   - **Branch**: `main`
4. **Path**: `/httpdocs` *(so the code lands in the Node.js Application Root)*
5. **Deployment mode**: **Automatic** *(pulls on every push if you set up the webhook)*
   OR **Manual** *(you click "Pull" in Plesk to deploy)*. Manual is safer for the first few weeks.
6. Click **OK** → Plesk will do an initial pull.

## Phase 4 — Add deployment actions

Plesk runs commands after every Git pull. These are the magic step that
builds Next.js and emits the standalone server.

1. Open the Git repo in Plesk → **Repository Settings** → **Deploy actions**.
2. Paste this exactly:

```bash
# Install dependencies for the production build.
npm ci

# Build Next.js (compiles app router + middleware + edge bundles).
npm run build

# Touch the restart file so Passenger picks up the new code.
mkdir -p tmp
touch tmp/restart.txt
```

3. Save.

That's the whole script. Three commands. The `npm ci` is the slowest step
(~1–2 minutes). `next build` takes ~1 minute. Restart is instant.

> If `npm ci` complains about an outdated lockfile, change it to
> `npm install`. The standard pattern uses `ci` because it's faster and
> deterministic.

## Phase 5 — Set environment variables

1. Back on the Node.js panel for the domain, scroll down to **Application Variables**.
2. For each row below, click **+** and paste the key + value:

```
NEXT_PUBLIC_SUPABASE_URL          = <from Supabase → Settings → API → Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY     = <from Supabase → Settings → API → "publishable" key>
SUPABASE_SERVICE_ROLE_KEY         = <from Supabase → Settings → API → "secret" key (Reveal)>
NEXT_PUBLIC_APP_URL               = https://thumeka.co.za
NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER = 27600000000   (use your real WhatsApp number)
NODE_ENV                          = production
PORT                              = 3000
```

> **Never commit the actual values.** Keep them only in your local
> `.env.production.local` (which is in `.gitignore`) and paste them into the
> Plesk panel from there. GitHub's push protection will reject any commit
> containing a Supabase secret key, which is the correct behaviour.

3. Leave Resend, Google Maps, Sentry keys empty for now — we add those after
   you've created those accounts. The app boots without them.
4. Click **Apply**.

## Phase 6 — First deploy

1. In the Git panel, click **Pull Updates** (manual mode) or push to `main` (auto mode).
2. Watch the deploy actions output. First run takes ~3–5 minutes:
   - Pull repo: ~10 seconds
   - `npm ci`: 1–2 minutes
   - `npm run build`: 1–2 minutes
   - Restart: ~10 seconds
3. After it finishes, go to https://thumeka.co.za in a browser.
4. You should see the Thumeka homepage with the gradient hero.

If you see a Phusion Passenger error page, click "Show full error" — it
usually says which env var is missing or what file Passenger can't find.
Paste the error to me and I'll debug.

## Phase 7 — SSL (free, ~30 seconds)

1. Plesk domain panel → **SSL/TLS Certificates** → **Install** under "Let's Encrypt".
2. Tick `thumeka.co.za` AND `www.thumeka.co.za`.
3. Tick "Include a 'www' subdomain". Email field: your email.
4. Click **Get it free**.
5. After installation, back in the domain panel → **Hosting Settings** → tick **Permanent SEO-safe 301 redirect from HTTP to HTTPS**.

## Phase 8 — Health check

1. Plesk home → **Tools & Settings** → **Server-wide notifications** is the
   built-in one; for proper monitoring use UptimeRobot (free, 5-min cadence).
2. UptimeRobot → New monitor → HTTP(s) → URL: `https://thumeka.co.za/api/health`
   → expected response: contains `"status":"ok"`.
3. Add an email or SMS notification.

---

## Troubleshooting

**App returns 502 / "Application failed to start"**
- Plesk → Domain → Logs → Error log → scroll to the bottom.
- Most common cause: a missing env var (look for `NEXT_PUBLIC_SUPABASE_URL is required`).

**Build runs out of memory**
- Plesk shared plans sometimes cap RAM at 512 MB. `next build` wants ~1 GB.
- If you hit this, switch to a build-locally-then-upload pattern: run
  `npm run build` on your laptop, zip `.next/standalone`, upload via File
  Manager. I'll write that flow if needed.

**Git deploy hangs on `npm ci`**
- Plesk's `npm` sometimes uses a slow/stale registry. Add to deploy actions:
  `npm config set registry https://registry.npmjs.org/`

**Static assets 404**
- The `cp -r .next/static .next/standalone/.next/static` step in deploy
  actions probably failed. Check the deploy action log.

---

## Rollback

Plesk's Git panel keeps every deployed commit. To roll back:
1. Plesk → Domain → Git → **Deployment history**.
2. Click any prior deployment → **Redeploy this version**.
3. Plesk re-runs deploy actions against that commit.

This is why we use Git deployment instead of file upload — you get a free
audit log + one-click rollback.

---

## Update flow once everything's wired

1. Make code change locally.
2. `npm run lint && npm run test:unit` to sanity-check.
3. `git commit && git push origin main`.
4. **Manual mode:** click "Pull Updates" in Plesk Git panel.
   **Auto mode:** Plesk pulls within ~30 seconds.
5. Deploy actions run, app restarts.
6. Refresh the browser, verify the change.

Total cycle: ~3–5 minutes from push to live.
