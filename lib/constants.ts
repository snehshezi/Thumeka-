export const APP_NAME = "Thumeka";
export const ADMIN_EMAIL = "admin@thumeka.co.za";

export const ROLES = ["buyer", "provider", "driver", "admin"] as const;
export type AppRole = (typeof ROLES)[number];

export const PUBLIC_ROLES = ["buyer", "provider", "driver"] as const;
export type PublicRole = (typeof PUBLIC_ROLES)[number];

export const LISTING_TYPES = ["product", "service", "errand"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const ORDER_STATUSES = [
  "order_requested",
  "awaiting_provider_acceptance",
  "provider_rejected",
  "provider_location_warning",
  "accepted_by_provider",
  "delivery_fee_calculated",
  "awaiting_buyer_eft",
  "eft_submitted",
  "payment_confirmed",
  "preparing_or_scheduled",
  "awaiting_driver_assignment",
  "driver_assigned",
  "picked_up",
  "out_for_delivery",
  "service_in_progress",
  "completed",
  "cancelled",
  "issue_reported",
  "expired"
] as const;

export const DURBAN_SUBURBS = [
  "Amanzimtoti",
  "Berea",
  "Bluff",
  "Durban CBD",
  "Durban North",
  "Glenwood",
  "Hillcrest",
  "Kloof",
  "Morningside",
  "Musgrave",
  "Pinetown",
  "Queensburgh",
  "Umhlanga",
  "Umlazi",
  "Westville"
];

export const SEEDED_CATEGORIES = [
  "Food",
  "Groceries",
  "Clothing",
  "Pre-loved",
  "Beauty",
  "Medication",
  "Home services",
  "Cleaning",
  "Repairs",
  "Errands",
  "Transport",
  "Digital services",
  "Other"
];
