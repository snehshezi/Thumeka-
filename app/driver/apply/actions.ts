"use server";

import { redirect } from "next/navigation";

import { ApplicationSubmittedEmail } from "@/emails/application-submitted";
import { requireRole } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/env";
import {
  DRIVER_DOCUMENT_SLOTS,
  isValidDocumentStoragePath
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

export async function submitDriverApplicationAction(formData: FormData) {
  // userId = auth.users.id (what storage RLS sees as auth.uid())
  // profile.id = profiles.id (FK target for documents.owner_user_id)
  const { userId, profile } = await requireRole(["driver"]);
  const supabase = await createSupabaseServerClient();

  // Validate banking fields before any DB write.
  const bankAccountNumberResult = validateZaBankAccountNumber(
    readString(formData, "bank_account_number")
  );
  if (!bankAccountNumberResult.ok) {
    redirect(
      `/driver/apply?error=${encodeURIComponent(bankAccountNumberResult.error)}`
    );
  }
  const branchCodeResult = validateZaBranchCode(
    readString(formData, "bank_branch_code")
  );
  if (!branchCodeResult.ok) {
    redirect(
      `/driver/apply?error=${encodeURIComponent(branchCodeResult.error)}`
    );
  }

  const payload = {
    user_id: profile.id,
    vehicle_type: readString(formData, "vehicle_type"),
    vehicle_licence_number: readString(formData, "vehicle_licence_number"),
    bank_account_name: readString(formData, "bank_account_name"),
    bank_name: readString(formData, "bank_name"),
    bank_account_number: bankAccountNumberResult.value,
    bank_branch_code: branchCodeResult.value,
    approval_status: "pending",
    availability_status: "unavailable",
    rejection_reason: null,
    approved_at: null
  };

  // Validate document paths up front; abort with redirect before any writes.
  const documentInserts: Array<{
    document_type: string;
    storage_path: string;
  }> = [];
  for (const slot of DRIVER_DOCUMENT_SLOTS) {
    const path = readString(formData, `document_path__${slot.documentType}`);
    if (!path) {
      if (slot.required) {
        redirect(
          `/driver/apply?error=${encodeURIComponent(
            `Please upload the ${slot.label} before submitting.`
          )}`
        );
      }
      continue;
    }
    if (
      !isValidDocumentStoragePath({
        path,
        ownerType: "driver",
        userId,
        documentType: slot.documentType
      })
    ) {
      redirect(
        `/driver/apply?error=${encodeURIComponent(
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
    .from("driver_profiles")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    redirect("/driver/apply?error=Unable%20to%20submit%20driver%20application");
  }

  await supabase
    .from("documents")
    .delete()
    .eq("owner_user_id", profile.id)
    .eq("owner_type", "driver");

  if (documentInserts.length > 0) {
    await supabase.from("documents").insert(
      documentInserts.map((d) => ({
        owner_user_id: profile.id,
        owner_type: "driver" as const,
        document_type: d.document_type,
        file_url: d.storage_path,
        submitted_via: "upload" as const,
        status: "submitted" as const
      }))
    );
  }

  sendEmail({
    to: profile.email,
    subject: "Driver application received — Thumeka",
    react: ApplicationSubmittedEmail({
      fullName: profile.full_name ?? profile.email,
      applicantType: "driver",
      appUrl: getAppUrl(),
      statusUrl: `${getAppUrl()}/driver/status`,
    }),
  }).catch((err: Error) => console.warn("[email] Driver application email failed:", err.message));

  redirect("/driver/status?submitted=1");
}
