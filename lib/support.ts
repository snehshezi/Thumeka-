import { getSupportWhatsAppNumber } from "@/lib/env";

export function createWhatsAppUrl(message: string) {
  const supportNumber = getSupportWhatsAppNumber();

  if (!supportNumber) {
    return null;
  }

  const normalized = supportNumber.replace(/[^\d]/g, "");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
