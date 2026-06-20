# Thumeka — Manual Test Cases

This is the **production-readiness runbook**: walk every flow against the
seeded dev environment and confirm each row.

> 🤖 **Most of this runbook is now automated** — see `tests/e2e/runbook/`.
> Run `npm run test:e2e:runbook` for the lot (CI mode), or
> `npm run test:e2e:runbook:headed` to watch the browser tick through each
> scenario.

## Coverage at a glance

| Section | Coverage | Spec file |
|---|---|---|
| 1. Public surfaces | 🤖 Automated | `tests/e2e/runbook/public.spec.ts` |
| 2. Registration & sign-in | 🤖 Automated (incl. apply-page document slots R-11/R-12) | `tests/e2e/runbook/auth.spec.ts` |
| 3. Buyer flows | 🤖 Automated | `tests/e2e/runbook/buyer.spec.ts` |
| 4. Provider flows | 🤖 Automated | `tests/e2e/runbook/provider.spec.ts` |
| 5. Driver flows | 🤖 Automated | `tests/e2e/runbook/driver.spec.ts` |
| 6. Admin flows | 🤖 Automated (driver payouts AD-14/15, document viewing AD-19/20) | `tests/e2e/runbook/admin.spec.ts` |
| 7. End-to-end fresh order | 🤖 Automated | `tests/e2e/runbook/end-to-end-fresh-order.spec.ts` |
| 8. Cross-cutting checks | 🤖 Automated (partial) | `tests/e2e/runbook/cross-cutting.spec.ts` |
| 9. Email verification | ✋ Manual only (Resend) | — |
| 10. RLS / authorisation | 🤖 Automated | `tests/e2e/runbook/rls.spec.ts` |

---

## Quick start

```bash
# 1. Make sure local Supabase is up
npx supabase status            # everything healthy?

# 2. Seed the database (wipes + reseeds — idempotent)
npm run seed:dev

# 3. Start the app
npm run dev                    # → http://localhost:3000
```

### `.env.local` checklist

The seed only needs **`NEXT_PUBLIC_SUPABASE_URL`** and **`SUPABASE_TEST_SERVICE_ROLE_KEY`**.
For the app to work end-to-end without external API keys, also add:

```
DELIVERY_FALLBACK_KM=4         # so checkout produces a quote without a Google Maps key
```

Optional, for real emails and addresses:

```
RESEND_API_KEY=re_...                       # transactional email
GOOGLE_MAPS_API_KEY=...                     # server geocoding + distance
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...         # address autocomplete (browser)
```

Without `RESEND_API_KEY`, email calls log a warning and are silently skipped.
Without the Google keys, addresses are stored as plain text and `DELIVERY_FALLBACK_KM` is used for distance.

---

## Seeded credentials

All accounts share the password **`Thumeka-test-123`**.

| User key | Email | Role | State |
|---|---|---|---|
| `buyer` | `buyer.test@thumeka.local` | buyer | active |
| `otherBuyer` | `other-buyer.test@thumeka.local` | buyer | active |
| `provider` | `provider.test@thumeka.local` | provider | **approved** (Thumeka Test Kitchen, Berea) |
| `pendingProvider` | `pending-provider.test@thumeka.local` | provider | **pending** approval |
| `driver` | `driver.test@thumeka.local` | driver | **approved + available** |
| `admin` | `admin@thumeka.co.za` | admin | admin |

---

## Seeded data reference

### Categories
Food, Errands, Groceries, Cleaning, Transport.

### Listings (owned by the approved `provider`)
| Title | Price | Type | State |
|---|---|---|---|
| Durban lunch plate | R85 | product | active |
| Sunday roast tray | R320 | product | active |
| Grocery run — Pick n Pay | R95 | errand | active |
| Office lunch platter (x10) | R480 | product | active |
| Same-day document delivery | R75 | errand | active |
| Disabled test plate | R95 | product | `admin_disabled` (hidden from buyers) |
| Pending provider errand | R120 | errand | owner not approved (hidden from buyers) |

### Frozen orders
Each is the same Durban lunch plate (R85), advanced to a different state so you can act on every flow without having to drive an order from scratch first.

| Short id | Buyer | State | Purpose |
|---|---|---|---|
| `…000201` | buyer | `order_requested` | Provider hasn't accepted yet → provider/orders/Needs-action |
| `…000202` | buyer | `awaiting_buyer_eft` | Buyer can see EFT instructions; admin can confirm |
| `…000203` | otherBuyer | `payment_confirmed` | Ready for admin driver assignment |
| `…000204` | otherBuyer | `driver_assigned` | Driver can mark picked up |
| `…000205` | buyer | `picked_up` | Driver can mark out for delivery |
| `…000206` | otherBuyer | `out_for_delivery` | Driver can complete |
| `…000207` | buyer | `completed` | Admin can create a payout |

> Need to reset? `npm run reset:dev` wipes both the base seed and the frozen orders so you can rerun `npm run seed:dev` from a clean slate.

---

## How to use this doc

For each section below:
- Sign in as the **User** column.
- Walk the rows in order.
- Use the seeded **order** / **listing** named in **Setup** wherever possible — that's why those rows exist.
- A green tick next to every row in every section means you've exercised every code path the app currently has.

Things to mentally check on every screen:
- Does the **header** show the right brand + nav?
- Does the **footer** appear?
- On mobile (~390px), does the **bottom nav** appear (signed-in users only), and is the active tab highlighted?
- Are headings rendered in **Plus Jakarta Sans** with deliberate hierarchy?
- Does every **StatusPill** show a colour **and** an icon (not just yellow)?

---

## 1. Public surfaces (unauthenticated)

User: not signed in.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| PU-01 | Homepage hero | Open `/` | Hero reads **"Durban, delivered."** with dual CTAs (Browse / Become a seller). 3-up "Why Thumeka" strip below, then 6 category tiles, then 3-up "How it works", final CTA band, footer. |
| PU-02 | Homepage → browse | Click **Browse marketplace** | Lands on `/listings` |
| PU-03 | Browse listings | Open `/listings` | 5 active listings appear. No hidden / `admin_disabled` / pending-provider listings. Search + category chips render. Result count shows "5 approved listings". |
| PU-04 | Open a listing | Click "Durban lunch plate" | Listing detail renders with title, price (green), description, suburb, "Request order" CTA. |
| PU-05 | Click Request order without sign in | Press **Request order** on the listing detail | Redirected to `/auth/sign-in` (with `?next=...` so post-login goes back to checkout). |
| PU-06 | Support page | Open `/support` | WhatsApp link visible (or "Set NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER" hint if unset). |

---

## 2. Registration & sign-in

User: not signed in.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| R-01 | Buyer registration | `/auth/register` → name + new email + ≥8-char password → **Buyer** → submit | Redirected to `/auth/sign-in?registered=1`. (Email confirmation may be pending.) |
| R-02 | Provider registration | Same as R-01 but choose **Provider** | Redirected to `/provider/status?registered=1`. With Resend configured: welcome email lands in dashboard. |
| R-03 | Driver registration | Choose **Driver** | Redirected to `/driver/status?registered=1`. |
| R-04 | Missing fields | Submit with email only | Error: *"Full name, email and password are required"*. |
| R-05 | Short password | Password `abc123` (7 chars) | Error: *"Password must be at least 8 characters"*. |
| R-06 | Admin email blocked | Email `admin@thumeka.co.za` | Error: *"Use the admin invite flow for this email"*. |
| R-07 | Safe `next` redirect | Visit `/auth/sign-in?next=/checkout/<listingId>`, sign in as buyer | Lands at the checkout page. |
| R-08 | Malicious `next` rejected | Visit `/auth/sign-in?next=//evil.example`, sign in | Lands at role home, **not** the external URL. |
| R-09 | Sign in as seeded buyer | Email `buyer.test@thumeka.local`, password `Thumeka-test-123` | Lands at `/buyer/orders`. |
| R-10 | Sign-out (mobile) | Resize to ~390px, sign in, tap **Account** in bottom nav, tap **Sign out** | Lands at `/auth/sign-in`. |
| R-11 | Provider apply renders documents section | Sign in as provider → `/provider/apply` | New **Documents** section shows 4 slots: ID document (required), Proof of address (required), Bank confirmation letter (required), Business registration (optional). Each slot has a file picker, status line, and helper text. |
| R-12 | Provider apply blocks on missing required doc | Fill the apply form but skip uploads → submit | Bounces back to `/provider/apply?error=Please%20upload%20the%20ID%20document...`. Inline error renders. **No `provider_profiles` write happens** (status stays whatever it was). |
| R-13 | Oversize / wrong-type upload rejected client-side | Pick a >10 MB file or a `.docx` | Inline status reads "*That file is XX MB. The cap is 10 MB.*" or "*Use a PDF or an image (PNG / JPEG / WebP).*" The hidden form field stays empty. |
| R-14 | Driver apply renders all 4 required slots | Sign in as driver → `/driver/apply` | Documents section shows ID document, Driver's licence, Vehicle licence disc, Bank confirmation letter — all required. |
| R-15 | Successful upload writes to Storage + `documents` | Pick a small PDF → wait for "Uploaded — filename.pdf" → submit | Inspect Supabase Studio: object exists under `private-documents/{owner_type}/{your_uid}/{document_type}-{rand}.pdf`. A `documents` row exists with `file_url = <that path>`, `submitted_via='upload'`, `status='submitted'`. |
| R-16 | Re-submitting the apply form replaces old doc rows | After R-15, change the bank confirmation file and re-submit | The `documents` rows for that applicant are rebuilt (old rows gone, new rows in) — no duplicates. Storage objects upsert in place. |

---

## 3. Buyer flows

User: `buyer` (`buyer.test@thumeka.local`).

| # | Scenario | Steps | Expected |
|---|---|---|---|
| BU-01 | Greeting hero | Open `/buyer/orders` | Greeting reads "*Good {morning|afternoon|evening}, Sipho* · N active orders". |
| BU-02 | All filter shows seeded orders | Default filter is **All** | Several seeded order cards visible. Status pills show distinct colours + icons. |
| BU-03 | Active filter | Tap **Active** | Only orders in non-terminal states. Count in the segmented control matches the visible cards. |
| BU-04 | Closed filter | Tap **Closed** | Only completed / cancelled orders. The `…000207` completed order appears here. |
| BU-05 | EFT instructions visible | On the **Active** tab, find `…000202` (Awaiting Buyer Eft) | The EFT panel ("EFT payment instructions") is visible inside the card, with a reference. |
| BU-06 | EFT instructions hidden before acceptance | On the **All** tab, find `…000201` (Order Requested) | EFT panel is **not** rendered. |
| BU-07 | Successful checkout | Open `/listings/<the lunch plate id>` → **Request order** → fill address → **Calculate delivery fee** → confirm fee + total → **Submit** | Redirected to `/buyer/orders?created=<orderId>` and the new order card appears in Active. Provider gets "New order request" email. |
| BU-08 | Checkout blocks without a quote | Edit the address after calculating; submit immediately | Submit button is disabled until you re-quote. |
| BU-09 | Missing buyer name | Clear the name field, try to submit | Error: *"Name, phone and email are required"*. |
| BU-10 | Inactive listing | Visit `/checkout/<disabled listing id>` | Redirected to `/listings?error=Listing is not available`. |
| BU-11 | Browse from bottom nav | Mobile viewport, tap **Browse** | Lands on `/listings`. |
| BU-12 | Account sheet | Mobile viewport, tap **Account** | Bottom-sheet shows email + "Buyer account" + sign-out button. |

---

## 4. Provider flows

User: `provider` (`provider.test@thumeka.local`) — approved.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| PR-01 | Greeting + count | Open `/provider/dashboard` | Greeting reads "*… , Thumeka Test Kitchen · N orders need you*". |
| PR-02 | Orders tab is default | Default segmented control = **Orders** | Three groups: **Needs your action** (contains `…000201`), **In progress** (200s through 206), **Completed** (`…000207`). |
| PR-03 | Open an order in the drawer | Mobile viewport, tap the `…000201` card | Drawer **slides up from the bottom** with a grab handle. Full order detail shows: buyer phone (tappable), email (tappable), delivery address, listing price R85. |
| PR-04 | Accept locked-price order | In the drawer for `…000201`, tap **Accept order** | No distance input ever shows — orders always arrive priced from checkout. The accept form displays a confirmation copy block and a single button. After accepting: redirect with `?accepted=...`. Order moves to In progress. Buyer email: "Your order has been accepted — EFT payment required". |
| PR-05 | Reject already-accepted | Try to accept `…000202` (already `awaiting_buyer_eft`) | The accept form is **not** rendered (drawer only shows accept for needs-action). |
| PR-06 | Switch to Listings tab | Tap **Listings** in the segmented control | URL becomes `?tab=listings`. The Create-listing toggle and Recent listings panel render. Orders are hidden. |
| PR-07 | Create new listing | Tap **New listing** → fill title + description + category + price + suburb (the address pre-fills from the provider's saved address) → submit | Redirected to `?listing_created=...`. New listing visible in Recent listings. |
| PR-08 | Approval gate | Sign in as `pendingProvider` → `/provider/dashboard` | Shown "Approval required" panel with link to `/provider/status`. |
| PR-09 | Apply / re-apply | As `pendingProvider`, open `/provider/apply`, change something, submit | `/provider/status?submitted=1`. Resend dashboard: "Provider application received". |
| PR-10 | Browse from bottom nav | Mobile, tap **Browse** | Listings page. The provider can browse their own marketplace. |

---

## 5. Driver flows

User: `driver` (`driver.test@thumeka.local`) — approved + available.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| DR-01 | Greeting + earnings | Open `/driver/dashboard` | Greeting reads "*… , {first name}* · R0,00 earned today" (zero until you complete a delivery in step DR-06 today). |
| DR-02 | Availability is prominent | Page shows a single Availability panel as the lead card. | Current status = "available". Buttons let you go offline / available. Toggling redirects with `?availability=...`. |
| DR-03 | Deliveries list | Below availability, the deliveries section shows your assigned orders | The seeded `…000204` (driver_assigned), `…000205` (picked_up), `…000206` (out_for_delivery) cards appear. Each shows StatusPill with the right colour + icon. |
| DR-04 | Mark picked up | On `…000204`, tap **Mark Picked Up** | Status advances to `picked_up`. Banner "Delivery status updated". |
| DR-05 | Mark out for delivery | On `…000205` (or the order you just picked up), tap **Mark Out for Delivery** | Status advances to `out_for_delivery`. |
| DR-06 | Complete delivery | On `…000206` (or the latest), tap **Complete Delivery** | Status advances to `completed`. Driver `availability_status` → `available`. Buyer email: "Your order has been delivered". |
| DR-07 | Today's earnings updates | After DR-06, refresh `/driver/dashboard` | The "R… earned today" number reflects the completed order's `driver_earning`. |
| DR-08 | Approval gate | As `pendingProvider` after they apply as a driver, visit `/driver/dashboard` | "Approval required" panel. |
| DR-09 | Wrong-driver order | Manually visit `/driver/dashboard` after admin assigns an order to someone else | The other driver's order is not in your list. |
| DR-10 | Earnings panel | `/driver/dashboard` | New **Earnings** section shows two cards: pending payouts total (sum of unpaid `driver` payouts), and last paid (amount + date + reference). Empty state shows R0,00 with a helper hint. |
| DR-11 | Pending payout after admin creates one | After admin runs AD-15 | The pending card's amount jumps by the new payout's net. |
| DR-12 | Last paid updates after AD-16 | After admin marks the payout paid | Last paid card shows the new ref + date. Inbox: `PayoutPaid` email with breakdown (gross / 8% commission / net) + payment reference. |

---

## 6. Admin flows

User: `admin` (`admin@thumeka.co.za`).

| # | Scenario | Steps | Expected |
|---|---|---|---|
| AD-01 | Greeting + at-a-glance | Open `/admin/dashboard` | Greeting reads "*Good …, admin · N pending approvals · M open orders*". |
| AD-02 | Stat strip on mobile | Mobile viewport | The 5 stat cards become a horizontally scrolling strip with snap. Each card readable in turn. |
| AD-03 | Tabs default to Approvals | Default tab | Approvals tab shows Provider Approvals + Driver Approvals panels. `pendingProvider` is in the provider list. The seeded pending driver is in the driver list. |
| AD-04 | Approve provider | Click **Approve** on `pendingProvider`'s row | Banner "Provider approved". Provider gets "Your provider application has been approved". |
| AD-05 | Reject provider | (Re-seed, then) enter reason "Missing documents" → **Reject** | Banner. Provider gets the rejection email with the reason. |
| AD-06 | Approve driver | Click **Approve** on the seeded pending driver | Banner. Driver gets approval email. |
| AD-07 | Switch to Operations | Click **Operations** tab | URL becomes `?tab=operations`. Operational orders panel + Payouts panel appear. Approvals are hidden. |
| AD-08 | Confirm EFT | On `…000202` (Awaiting Buyer Eft), enter a payment reference → **Confirm EFT** | Banner. Buyer email: "Your payment has been confirmed". Order moves to `payment_confirmed`. |
| AD-09 | Auto-generated EFT reference | Leave reference blank → **Confirm EFT** | Reference defaults to `EFT-<first8>`. Email still sent. |
| AD-10 | Assign driver | On `…000203` (or any payment_confirmed without driver), select the available driver → **Assign** | Banner. Buyer + driver each get an assignment email. Driver `availability_status` → `busy`. |
| AD-11 | Create payout | On `…000207` in the Payouts panel, click **Create payout** | Banner "Provider payout created". Provider gets "Your payout has been created" email with net/gross/commission. |
| AD-12 | Duplicate payout blocked | Click **Create payout** again on the same order | Error: *"Order has already been added to a payout"*. |
| AD-13 | Switch to Settings | Click **Settings** tab | URL `?tab=settings`. Financial defaults panel + Next admin actions panel render. Approvals + Operations hidden. |
| AD-14 | Open Payouts tab | Click **Payouts** tab | URL `?tab=payouts`. "Owed to drivers" panel lists one card per driver (per-driver aggregate, not per-order). Each card shows net amount, order count, period, plus the gross-fee-minus-8% breakdown. |
| AD-15 | Create driver payout | On a driver's card click **Create payout** | Banner *"Driver payout created"*. The card moves out of "Owed to drivers" and into "Awaiting EFT" with a pending-status ref. |
| AD-16 | Mark payout paid | In **Awaiting EFT**, leave the auto-filled `EFT-…` reference (or enter your own) → **Mark as paid** | Banner *"Payout marked as paid. The driver has been emailed."* Card moves to **Recent paid driver payouts** with reference + date. Driver receives the `PayoutPaid` email. |
| AD-17 | Re-trying mark-paid is blocked | After AD-16, hit the same payout's mark-paid endpoint again | Error: *"Payout is already paid"* (state machine guard). |
| AD-18 | Drivers-owed stat card | Glance at the stat strip | New "Owed to drivers" card sums net owed across all drivers' pending eligible orders. |
| AD-19 | View applicant documents | On a pending applicant's card, click **View** next to any document | Opens a new tab to `/admin/documents/<id>/view` which 302-redirects to a 60-second signed Supabase URL. PDF/image renders inline. An audit log row `document_viewed` is written. |
| AD-20 | Missing-doc hint | Look at the seeded pending provider's card (or any applicant who didn't upload everything) | A red **"Missing: …"** line lists each required document type still outstanding. |
| AD-21 | Configure payout reference prefix | Settings tab → Payout reference prefix → change to `FNB-2026-` → Save | Banner "Payout reference prefix updated". The next mark-paid form auto-fills `FNB-2026-{ID}` as the reference. |

---

## 7. End-to-end fresh order

Walk the whole flow against a freshly-created order (so you exercise checkout pricing and the full status timeline once, not just the seeded snapshots).

| # | Step | User | Notes |
|---|---|---|---|
| E2E-01 | Browse + open listing | unauth → buyer | `/` → Browse → click the office lunch platter (R480). |
| E2E-02 | Sign in to continue | buyer | After clicking Request order, you're bounced to sign-in; sign in, you land back on checkout. |
| E2E-03 | Quote + submit | buyer | Fill address; click Calculate; verify fee + total appear; submit. New order appears in /buyer/orders Active. |
| E2E-04 | Provider accepts | provider | Drawer shows the new order in Needs-action. Distance input is shown (because the buyer geocoding fell back to the seed default). Enter 4 → Accept. |
| E2E-05 | Buyer pays "EFT" | buyer | Refresh /buyer/orders. The EFT instructions panel now renders. |
| E2E-06 | Admin confirms EFT | admin | Operations tab → enter reference → Confirm. Buyer gets confirmation email. |
| E2E-07 | Admin assigns driver | admin | Operations tab → assign the seeded driver. |
| E2E-08 | Driver picks up | driver | Mark Picked Up → Mark Out for Delivery. |
| E2E-09 | Driver completes | driver | Complete Delivery. Buyer gets delivered email. |
| E2E-10 | Admin creates payout | admin | Operations tab → Create payout on the now-completed order. Provider gets payout email. |

---

## 8. Cross-cutting checks

These aren't a single flow — verify them at any point.

| Area | Check |
|---|---|
| **Header** | Logo links home; Browse / Support / Dashboard / Sign-in shown when signed-out; Dashboard + Sign out (or bottom-nav Account on mobile) when signed-in. |
| **Footer** | Three columns (Marketplace, Support, Legal), © year, `en-ZA` label. |
| **Bottom nav (mobile)** | Visible only when signed in. 4 tabs: Home, Browse, Dashboard, Account. Active tab highlighted in leaf. |
| **Drawer (mobile)** | Slides up with a grab handle. ESC closes. Tap outside closes. Body scroll locked while open. |
| **Drawer (desktop)** | Slides in from the right with the same content. |
| **StatusPill** | Every pill has an icon. Distinct tones: success (mint/leaf), info (leaf tint), working (clay tint), warning (maize), danger (red), neutral (grey). |
| **Type hierarchy** | Plus Jakarta Sans throughout. Page heroes use `text-display-md`. Section headers feel deliberate, not random. |
| **404 path** | Visit `/listings/nonexistent-uuid` | Falls back gracefully (not a 500). |
| **Wrong-role redirect** | Sign in as buyer, visit `/admin/dashboard` | Redirected to `/buyer/orders`. |
| **Unauthenticated dashboard** | Open `/buyer/orders` with no session | Redirected to `/auth/sign-in`. |

---

## 9. Email verification checklist (with `RESEND_API_KEY` set)

Open the **Resend dashboard → Emails** and confirm each email is delivered with the correct subject.

| Trigger | Recipient | Subject |
|---|---|---|
| Registration (immediate session) | New user | Welcome to Thumeka! |
| Provider application submitted | Provider | Provider application received — Thumeka |
| Driver application submitted | Driver | Driver application received — Thumeka |
| Provider approved | Provider | Your provider application has been approved — Thumeka |
| Provider rejected | Provider | Update on your provider application — Thumeka |
| Driver approved | Driver | Your driver application has been approved — Thumeka |
| Driver rejected | Driver | Update on your driver application — Thumeka |
| Order placed by buyer | Provider | New order request — Thumeka |
| Provider accepts order (with bank details) | Buyer | Your order has been accepted — EFT payment required — Thumeka |
| EFT confirmed by admin | Buyer | Your payment has been confirmed — Thumeka |
| Driver assigned (admin) | Buyer | A driver has been assigned to your order — Thumeka |
| Driver assigned (admin) | Driver | New delivery assigned to you — Thumeka |
| Delivery completed | Buyer | Your order has been delivered — Thumeka |
| Provider payout created | Provider | Your payout has been created — Thumeka |
| Driver payout marked paid (AD-16) | Driver | Your payout has been paid — Thumeka |

> Without `RESEND_API_KEY`, all of these are logged-and-skipped. The flow still completes; just no email.

---

## 10. RLS / authorisation spot checks

These are about confirming that other people's data is invisible — important before production.

| # | Check | Steps | Expected |
|---|---|---|---|
| RLS-01 | Buyer can't see another buyer's order | Sign in as `buyer`, visit `/buyer/orders` | Only your own orders. None of `otherBuyer`'s. |
| RLS-02 | Provider can't see another provider's order | Sign in as `provider`. Look at orders board. | Only orders for your listings. |
| RLS-03 | Driver can't see unassigned orders | Sign in as `driver` | Only orders where `driver_id = me`. |
| RLS-04 | Admin sees everything | Sign in as `admin` | Operations tab shows all open orders regardless of buyer/provider/driver. |
| RLS-05 | Pending provider's listings hidden | While signed-out, search `/listings?q=Pending` | "Pending provider errand" does **not** appear. |
| RLS-06 | `admin_disabled` listing hidden | While signed-out, search `/listings?q=Disabled` | "Disabled test plate" does **not** appear. Authoritative provider can still see it on their own dashboard. |

---

## Done?

If every row in every section passes, the app is ready for an internal-stakeholder demo and a small-scale beta. Known gaps before broader launch:

- **No real product images yet** — listings render coloured boxes.
- **No password reset** on `/auth/sign-in`.
- **No terms / privacy acceptance** on `/auth/register`.
- **No toast notifications** — feedback uses URL params + inline banners.
- **No loading skeletons** — first paint shows everything or nothing.

Each is captured as a follow-up Tier-2 item.
