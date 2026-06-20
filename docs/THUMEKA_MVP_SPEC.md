# Thumeka MVP Specification

## 1. Product Summary

**Product name:** Thumeka  
**Launch market:** Durban, South Africa  
**Currency:** South African Rand (ZAR)  
**Hosting target:** mercury.hkdns.host  
**Backend:** Supabase  
**Frontend:** Next.js mobile-first web app  
**Launch target:** Public MVP with real users

Thumeka is a mobile-first marketplace where buyers can order products, services, and errands from approved providers. Approved drivers deliver physical orders and are assigned by admin. Admin approves providers and drivers, manages orders, sets commission and driver rates, confirms EFT payments, and records weekly payouts.

The MVP should be simple, operationally controlled, and deployable quickly.

---

## 2. User Roles

### Buyer

A buyer can:

- Browse public listings without logging in.
- Register/sign in using email and password.
- Place an order request.
- View their orders.
- Track order status.
- Contact admin through WhatsApp support.

### Provider

A provider covers sellers, service providers, and errand runners.

A provider can:

- Register using email and password.
- Submit a provider application.
- Upload or email required documents.
- Wait for admin approval.
- Create live listings once approved.
- Accept or reject orders.
- Update service/product progress.
- View earnings and payouts.

### Driver

A driver can:

- Register using email and password.
- Submit a driver profile.
- Upload required documents.
- Wait for admin approval.
- Become available after approval.
- View assigned deliveries.
- Update delivery status.
- View driver earnings and payouts.

### Admin

An admin can:

- Approve/reject/suspend providers.
- Approve/reject/suspend drivers.
- Disable listings.
- View and manage orders.
- Confirm EFT payments.
- Assign drivers.
- Set commission.
- Set delivery base fee and price per kilometre.
- Set payout days.
- View transactions and audit logs.
- Mark payouts as paid.

Initial admin email:

```txt
admin@thumeka.co.za
```

---

## 3. MVP Scope

### Included

- Mobile-first marketplace.
- Email/password authentication.
- Public listing browsing.
- Buyer checkout after registration/sign-in.
- Provider onboarding and approval.
- Driver onboarding and approval.
- Universal listing form.
- Product, service, and errand orders.
- Provider order acceptance before payment.
- EFT-only payment flow.
- Manual admin payment confirmation.
- Manual driver assignment.
- Delivery fee calculation.
- Google Maps route links.
- Weekly provider and driver payouts.
- Admin transaction and audit visibility.
- Email notifications.
- WhatsApp support links.
- Listing image uploads.
- Private document uploads.

### Excluded

Do not build these in MVP:

- Native mobile app.
- Live GPS tracking.
- In-app chat.
- Automatic card payments.
- Automatic payouts.
- Complex route optimization.
- Multi-vendor cart.
- Inventory quantity system.
- Ratings/reviews.
- Coupons.
- Refund automation.

---

## 4. Core Product Decisions

### Marketplace location

Thumeka launches in Durban only.

Capture suburb/area on:

- listings,
- provider profiles,
- driver profiles,
- buyer checkout,
- orders.

### Listing model

Use one universal listing form with `listing_type`:

- `product`
- `service`
- `errand`

### Categories

Seed these fixed categories:

1. Food
2. Groceries
3. Clothing
4. Beauty
5. Home services
6. Cleaning
7. Repairs
8. Errands
9. Transport
10. Digital services
11. Other

### Provider approval

Providers cannot create listings until approved.

Once approved, providers can create live listings immediately.

Admin can disable any listing.

### Driver approval

Drivers cannot receive delivery assignments until approved.

Approved drivers can mark themselves available.

### Buyer registration

Users can browse without logging in.

Users must register/sign in before checkout.

---

## 5. Provider Onboarding

Required provider profile fields:

- Full name
- Business/display name
- Email
- Phone number
- Provider type: individual/business
- Description
- Durban suburb/area
- Address
- Bank account holder name
- Bank name
- Account number
- Branch code

Required provider documents:

- ID copy
- Selfie/photo
- Proof of bank account
- Proof of address

Documents can be uploaded in-app or sent by email and recorded by admin.

Provider statuses:

- `pending`
- `approved`
- `rejected`
- `suspended`

---

## 6. Driver Onboarding

Required driver fields:

- Full name
- Email address
- Phone number
- Vehicle type
- Vehicle licence number
- Bank account holder name
- Bank name
- Account number
- Branch code

Required driver documents/images:

- Picture of car
- Driver's licence
- PDP licence
- ID copy
- Proof of account
- Driver photo/selfie

Driver approval statuses:

- `pending`
- `approved`
- `rejected`
- `suspended`

Driver availability statuses:

- `unavailable`
- `available`
- `busy`
- `suspended`

---

## 7. Listings

Listing fields:

- Title
- Description
- Category
- Listing type
- Price
- Pricing type
- Main image
- Optional gallery images
- Durban suburb/area
- Fulfillment/pickup/service location
- Availability notes
- Requires date/time
- Requires buyer location
- Requires written instructions
- Requires quote before confirmation
- Active/inactive
- Admin disabled flag

Recommended pricing types:

- `fixed`
- `from`
- `quote_required`
- `hourly`
- `daily`

Public visibility rule:

A listing is visible only when:

- provider is approved,
- listing is active,
- listing is not admin-disabled.

---

## 8. Payment

MVP payment method: **EFT only**.

Important rule:

The buyer must not receive EFT instructions immediately after checkout.

Payment flow:

1. Buyer places order request.
2. Provider accepts or rejects.
3. If accepted, delivery fee is calculated where needed.
4. Buyer receives EFT instructions.
5. Buyer pays externally by EFT.
6. Admin confirms payment manually.
7. Fulfillment starts.

Payment statuses:

- `not_requested`
- `awaiting_buyer_eft`
- `eft_submitted`
- `confirmed`
- `failed`
- `refunded_manual`

---

## 9. Commission

Default commission: **12%**.

Admin can change commission, but:

- confirmation is required,
- change must be audit logged,
- historical orders must keep the commission percentage used at the time of order/payment confirmation.

Provider earning:

```txt
provider_earning = listing_price - commission_amount
```

Commission amount:

```txt
commission_amount = listing_price * commission_percentage / 100
```

---

## 10. Delivery Fee

Delivery fee formula:

```txt
delivery_fee = base_delivery_fee + (distance_km * price_per_km)
```

Default base fee:

```txt
R36
```

Admin can edit:

- base delivery fee,
- price per kilometre,
- delivery fee override per order.

For MVP, if distance calculation is unavailable, admin can manually enter the distance or final delivery fee.

---

## 11. Payouts

Payouts are manual.

Driver payout day:

```txt
Monday
```

Provider/seller payout day:

```txt
Wednesday
```

Admin pays externally and marks payout as paid in Thumeka.

All payout activity must create:

- payout record,
- payout item records,
- transaction records,
- audit log entries.

---

## 12. Support and Disputes

No in-app dispute system for MVP.

Use WhatsApp support link.

Support WhatsApp number is set by admin or environment variable:

```txt
NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER
```

---

## 13. Notifications

Email notifications should be sent for:

- registration,
- provider application submitted,
- provider approved/rejected,
- driver application submitted,
- driver approved/rejected,
- order requested,
- provider accepted/rejected order,
- EFT instructions available,
- payment confirmed,
- driver assigned,
- order completed,
- payout marked paid.

---

## 14. Acceptance Criteria

The MVP is ready when:

1. Buyers can browse listings on mobile.
2. Buyers can register/sign in.
3. Buyers can place order requests.
4. Providers can apply and submit documents.
5. Admin can approve providers.
6. Approved providers can create listings.
7. Providers can accept/reject orders.
8. Drivers can apply and submit documents.
9. Admin can approve drivers.
10. Admin can assign drivers.
11. Drivers can update delivery status.
12. Admin can confirm EFT payment.
13. Admin can set commission and delivery rates.
14. Admin can view transactions and audit logs.
15. Admin can mark provider and driver payouts as paid.
16. WhatsApp support links work.
17. The app is deployed on mercury.hkdns.host.
