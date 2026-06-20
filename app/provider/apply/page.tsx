import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";

import { submitProviderApplicationAction } from "@/app/provider/apply/actions";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { DocumentUploadSlot } from "@/components/document-upload-slot";
import { requireRole } from "@/lib/auth";
import { PROVIDER_DOCUMENT_SLOTS } from "@/lib/storage";

export const dynamic = "force-dynamic";

type ProviderApplyPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ProviderApplyPage({ searchParams }: ProviderApplyPageProps) {
  const params = await searchParams;
  // The storage path uses the auth user id (auth.uid()) so the RLS prefix
  // check passes — distinct from profile.id (used as documents.owner_user_id).
  const { userId } = await requireRole(["provider"]);

  return (
    <div className="section-band" data-testid="page-provider-apply">
      <div className="page-shell max-w-2xl py-6">
        <Link className="mb-4 inline-flex items-center text-sm font-semibold text-leaf" href="/provider/status">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Status
        </Link>
        <div className="mb-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-mint text-leaf">
            <Store className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-display-md text-ink">Provider application</h1>
          <p className="mt-2 text-sm leading-6 text-black/60">
            Submit your provider details for admin review.
          </p>
        </div>

        {params.error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </div>
        ) : null}

        <form action={submitProviderApplicationAction} className="panel space-y-4" data-testid="provider-apply-form">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Business/display name</span>
              <input className="input" data-testid="provider-business-name-input" name="business_name" required />
            </label>
            <label className="space-y-1">
              <span className="label">Provider type</span>
              <select className="input" data-testid="provider-type-input" name="provider_type">
                <option value="individual">Individual</option>
                <option value="business">Business</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="label">Description</span>
            <textarea className="input min-h-28" data-testid="provider-description-input" name="description" required />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Suburb / area</span>
              <input className="input" data-testid="provider-suburb-input" name="suburb" required />
            </label>
            <label className="space-y-1">
              <span className="label">Address</span>
              <AddressAutocomplete
                coordsLatName="address_lat"
                coordsLngName="address_lng"
                data-testid="provider-address-input"
                name="address"
                required
                suburbInputName="suburb"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Account holder</span>
              <input className="input" data-testid="provider-bank-account-name-input" name="bank_account_name" required />
            </label>
            <label className="space-y-1">
              <span className="label">Bank name</span>
              <input className="input" data-testid="provider-bank-name-input" name="bank_name" required />
            </label>
            <label className="space-y-1">
              <span className="label">Account number</span>
              <input
                className="input"
                data-testid="provider-bank-account-number-input"
                inputMode="numeric"
                maxLength={15}
                name="bank_account_number"
                pattern="[0-9 -]{6,15}"
                placeholder="6–13 digits"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="label">Branch code</span>
              <input
                className="input"
                data-testid="provider-bank-branch-code-input"
                inputMode="numeric"
                maxLength={8}
                name="bank_branch_code"
                pattern="[0-9 -]{6,8}"
                placeholder="6 digits, e.g. 250655"
                required
              />
            </label>
          </div>
          <div className="space-y-3" data-testid="provider-documents-section">
            <div>
              <h2 className="text-base font-semibold text-ink">Documents</h2>
              <p className="mt-1 text-body-sm text-black/55">
                Upload each one as a PDF or photo (max 10 MB). Required for
                admin approval — your application can&apos;t be reviewed until
                they&apos;re attached.
              </p>
            </div>
            <div className="space-y-3">
              {PROVIDER_DOCUMENT_SLOTS.map((slot) => (
                <DocumentUploadSlot
                  key={slot.documentType}
                  ownerType="provider"
                  userId={userId}
                  slot={slot}
                />
              ))}
            </div>
          </div>
          <button className="btn-primary w-full" data-testid="provider-apply-submit-button" type="submit">
            Submit application
          </button>
        </form>
      </div>
    </div>
  );
}
