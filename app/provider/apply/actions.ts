"use server";

import { redirect } from "next/navigation";

import { ApplicationSubmittedEmail } from "@/emails/application-submitted";
import { requireRole } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/env";
import { geocodeAddress } from "@/lib/maps";
import {
  isValidDocumentStoragePath,
  PROVIDER_DOCUMENT_SLOTS
} from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  validateZaBankAccountNumber,
  validateZaBranchCode
} from "@/lib/validators";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readFiniteNumber(formData: FormData, key: string) {
  const raw = readString(formData, key);
  if (!raw) {
    return null;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function submitProviderApplicationAction(formData: FormData) {
  // userId = auth.users.id (what storage RLS sees as auth.uid())
  // profile.id = profiles.id (FK target for documents.owner_user_id)
  const { userId, profile } = await requireRole(["provider"]);
  const supabase = await createSupabaseServerClient();

  const suburb = readString(formData, "suburb");
  const address = readString(formData, "address");

  // Prefer client-supplied coords from Places Autocomplete; fall back to
  // server-side geocoding when the user typed without picking a suggestion.
  const clientLat = readFiniteNumber(formData, "address_lat");
  const clientLng = readFiniteNumber(formData, "address_lng");
  const coords =
    clientLat !== null && clientLng !== null
      ? { lat: clientLat, lng: clientLng }
      : address
        ? await geocodeAddress(`${address}, ${suburb}, Durban, South Africa`)
        : null;

  // Validate banking fields up front — if they're junk we want a friendly
  // error before any DB write or storage validation downstream.
  const bankAccountNumberResult = validateZaBankAccountNumber(
    readString(formData, "bank_account_number")
  );
  if (!bankAccountNumberResult.ok) {
    redirect(
      `/provider/apply?error=${encodeURIComponent(bankAccountNumberResult.error)}`
    );
  }
  const branchCodeResult = validateZaBranchCode(
    readString(formData, "bank_branch_code")
  );
  if (!branchCodeResult.ok) {
    redirect(
      `/provider/apply?error=${encodeURIComponent(branchCodeResult.error)}`
    );
  }

  const payload = {
    user_id: profile.id,
    business_name: readString(formData, "business_name"),
    provider_type: readString(formData, "provider_type") || "individual",
    description: readString(formData, "description"),
    suburb,
    address,
    provider_lat: coords?.lat ?? null,
    provider_lng: coords?.lng ?? null,
    bank_account_name: readString(formData, "bank_account_name"),
    bank_name: readString(formData, "bank_name"),
    bank_account_number: bankAccountNumberResult.value,
    bank_branch_code: branchCodeResult.value,
    status: "pending",
    rejection_reason: null,
    approved_at: null
  };

  // Read + validate document paths from the form BEFORE we touch the database
  // — that way a missing/forged path fails the whole submit cleanly. The slot
  // component writes one `document_path__<type>` hidden field per slot.
  const documentInserts: Array<{
    document_type: string;
    storage_path: string;
  }> = [];
  for (const slot of PROVIDER_DOCUMENT_SLOTS) {
    const path = readString(formData, `document_path__${slot.documentType}`);
    if (!path) {
      if (slot.required) {
        redirect(
          `/provider/apply?error=${encodeURIComponent(
            `Please upload the ${slot.label} before submitting.`
          )}`
        );
      }
      continue;
    }
    if (
      !isValidDocumentStoragePath({
        path,
        ownerType: "provider",
        userId,
        documentType: slot.documentType
      })
    ) {
      redirect(
        `/provider/apply?error=${encodeURIComponent(
          `Couldn't recognise the uploaded ${slot.label}. Try uploading again.`
        )}`
      );
    }
    documentInserts.push({
      document_type: slot.documentType,
      storage_path: path
    });
  }

  const { error } = await supabase
    .from("provider_profiles")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    redirect("/provider/apply?error=Unable%20to%20submit%20provider%20application");
  }

  // Idempotency for re-applications: wipe prior documents for this owner then
  // insert the new set. Storage objects are upserted by the browser slot, so
  // they stay reachable; we just rebuild the index rows.
  await supabase
    .from("documents")
    .delete()
    .eq("owner_user_id", profile.id)
    .eq("owner_type", "provider");

  if (documentInserts.length > 0) {
    await supabase.from("documents").insert(
      documentInserts.map((d) => ({
        owner_user_id: profile.id,
        owner_type: "provider" as const,
        document_type: d.document_type,
        file_url: d.storage_path,
        submitted_via: "upload" as const,
        status: "submitted" as const
      }))
    );
  }

  sendEmail({
    to: profile.email,
    subject: "Provider application received — Thumeka",
    react: ApplicationSubmittedEmail({
      fullName: profile.full_name ?? profile.email,
      applicantType: "provider",
      appUrl: getAppUrl(),
      statusUrl: `${getAppUrl()}/provider/status`,
    }),
  }).catch((err: Error) => console.warn("[email] Provider application email failed:", err.message));

  redirect("/provider/status?submitted=1");
}
