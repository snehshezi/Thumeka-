# Deployment Guide: mercury.hkdns.host

## 1. Deployment Assumption

Thumeka will be deployed to:

```txt
mercury.hkdns.host
```

The application should be built as a standard Next.js Node.js application.

Do not use Vercel-only features.

---

## 2. Required Stack

Production hosting should support:

- Node.js
- npm
- environment variables
- HTTPS
- custom domain / DNS
- persistent process or Node.js app hosting
- optional SSH access

Supabase remains hosted separately and provides:

- Auth
- Postgres
- Storage
- Row Level Security

---

## 3. Required Environment Variables

Set these on the hosting environment:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER=
EMAIL_FROM=
EMAIL_SERVER_HOST=
EMAIL_SERVER_PORT=
EMAIL_SERVER_USER=
EMAIL_SERVER_PASSWORD=
GOOGLE_MAPS_API_KEY=
```

Notes:

- `NEXT_PUBLIC_*` variables are exposed to the browser.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed in client-side code.
- `GOOGLE_MAPS_API_KEY` is optional for MVP if distance is entered manually or map links are used only.

---

## 4. package.json Scripts

Use standard Next.js scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

---

## 5. Basic Deployment Commands

From the server or hosting deployment shell:

```bash
npm install
npm run build
npm run start
```

If the host has a Node.js app panel, configure:

```txt
Build command: npm run build
Start command: npm run start
Node environment: production
```

---

## 6. PM2 Deployment Option

If SSH is available and PM2 is allowed:

```bash
npm install
npm run build
npm install -g pm2
pm2 start npm --name thumeka -- start
pm2 save
```

Useful PM2 commands:

```bash
pm2 status
pm2 logs thumeka
pm2 restart thumeka
pm2 stop thumeka
```

---

## 7. DNS and URL Setup

Set:

```txt
NEXT_PUBLIC_APP_URL=https://your-domain-or-mercury-url
```

If a final domain is used later, update:

- DNS records,
- HTTPS certificate,
- Supabase Auth redirect URLs,
- email templates,
- app environment variable.

Supabase Auth URL settings should include:

```txt
https://your-domain/auth/callback
https://your-domain
```

Adapt routes to the actual app implementation.

---

## 8. Supabase Setup

Create a Supabase project.

Configure:

- database schema,
- storage buckets,
- RLS policies,
- Auth email/password,
- redirect URLs,
- service role key on server only.

Storage buckets:

```txt
public-listing-images
private-documents
```

`public-listing-images`:

- public read,
- authenticated upload by approved providers.

`private-documents`:

- private,
- signed URL access for admin,
- document owner can upload/read own documents if allowed.

---

## 9. Email Setup

Configure SMTP or email provider.

Required variables:

```txt
EMAIL_FROM=
EMAIL_SERVER_HOST=
EMAIL_SERVER_PORT=
EMAIL_SERVER_USER=
EMAIL_SERVER_PASSWORD=
```

MVP email events:

- registration confirmation,
- provider application submitted,
- provider approved/rejected,
- driver application submitted,
- driver approved/rejected,
- order requested,
- order accepted/rejected,
- EFT instructions available,
- payment confirmed,
- driver assigned,
- order completed,
- payout marked paid.

---

## 10. Google Maps Setup

For MVP, prefer simple Google Maps links.

Example:

```txt
https://www.google.com/maps/dir/?api=1&origin={pickup}&destination={delivery}
```

If API distance calculation is implemented, set:

```txt
GOOGLE_MAPS_API_KEY=
```

Distance formula for delivery fee:

```txt
delivery_fee = base_delivery_fee + (distance_km * price_per_km)
```

Default base fee:

```txt
R36
```

If API is not configured, admin can enter distance or final delivery fee manually.

---

## 11. Security Checklist

Before public launch:

- Confirm `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- Enable RLS on Supabase tables.
- Confirm private documents are not public.
- Use HTTPS.
- Use secure cookies/session handling.
- Do not log sensitive bank/document data unnecessarily.
- Ensure admin routes require admin role.
- Ensure provider routes require provider role.
- Ensure driver routes require driver role.
- Ensure buyers only see own orders.
- Confirm audit logs are created for sensitive actions.

---

## 12. Production Build Checklist

Run locally first:

```bash
npm run lint
npm run build
```

Check:

- public listings load,
- auth works,
- buyer checkout works,
- provider application works,
- admin approval works,
- listing creation works,
- provider order acceptance works,
- EFT instructions show only after acceptance,
- admin payment confirmation works,
- driver assignment works,
- delivery statuses update,
- payouts can be marked paid,
- WhatsApp support link works.

---

## 13. Codex Deployment Instruction

Add this to `AGENTS.md`:

```md
## Deployment Target

The app will be hosted on mercury.hkdns.host, not Vercel.

Use standard Next.js Node.js deployment:

- npm install
- npm run build
- npm run start

Do not use Vercel-only APIs, Vercel cron, Vercel blob, or Vercel-specific environment assumptions.

All deployment-specific values must come from environment variables.
```

---

## 14. Troubleshooting

### Build works locally but fails on host

Check:

- Node.js version,
- missing environment variables,
- package-lock mismatch,
- memory limits,
- unsupported native dependencies.

### App starts but auth redirects fail

Check Supabase Auth URLs and `NEXT_PUBLIC_APP_URL`.

### Images do not load

Check Supabase Storage bucket permissions.

### Documents are public

Stop launch and fix storage bucket/RLS configuration.

### Admin cannot access dashboard

Check the `profiles` row for:

```txt
role = admin
email = admin@thumeka.co.za
```
