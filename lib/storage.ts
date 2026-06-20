// Shared types + config for the private-documents bucket. Both the apply
// pages, the apply server actions, the admin viewer, and the upload slot all
// import from here so they can't drift.

export const PRIVATE_DOCUMENTS_BUCKET = "private-documents";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf"
] as const;

export type DocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

export type DocumentOwnerType = "provider" | "driver";

export type DocumentType =
  | "id_document"
  | "proof_of_address"
  | "bank_confirmation"
  | "business_registration"
  | "drivers_licence"
  | "vehicle_licence_disc";

export type DocumentSlot = {
  documentType: DocumentType;
  label: string;
  helpText: string;
  required: boolean;
};

export const PROVIDER_DOCUMENT_SLOTS: DocumentSlot[] = [
  {
    documentType: "id_document",
    label: "ID document",
    helpText:
      "South African ID or passport (PDF or photo). Used to verify the applicant.",
    required: true
  },
  {
    documentType: "proof_of_address",
    label: "Proof of address",
    helpText:
      "Utility bill, lease, or municipal letter dated in the last 3 months.",
    required: true
  },
  {
    documentType: "bank_confirmation",
    label: "Bank confirmation letter",
    helpText:
      "Proves the bank details typed above. Available from your bank's app.",
    required: true
  },
  {
    documentType: "business_registration",
    label: "Business registration (CIPC)",
    helpText:
      "Only required if you're applying as a business. Leave blank if you're applying as an individual.",
    required: false
  }
];

export const DRIVER_DOCUMENT_SLOTS: DocumentSlot[] = [
  {
    documentType: "id_document",
    label: "ID document",
    helpText: "South African ID or passport (PDF or photo).",
    required: true
  },
  {
    documentType: "drivers_licence",
    label: "Driver's licence",
    helpText:
      "Front and back in one file (PDF or photo). Make sure the expiry date is visible.",
    required: true
  },
  {
    documentType: "vehicle_licence_disc",
    label: "Vehicle licence disc",
    helpText: "Photo or PDF of the current disc on the windscreen.",
    required: true
  },
  {
    documentType: "bank_confirmation",
    label: "Bank confirmation letter",
    helpText:
      "Proves the bank details typed above. Available from your bank's app.",
    required: true
  }
];

export const DOCUMENT_LABEL_BY_TYPE: Record<DocumentType, string> = {
  id_document: "ID document",
  proof_of_address: "Proof of address",
  bank_confirmation: "Bank confirmation letter",
  business_registration: "Business registration (CIPC)",
  drivers_licence: "Driver's licence",
  vehicle_licence_disc: "Vehicle licence disc"
};

export function getDocumentSlots(ownerType: DocumentOwnerType): DocumentSlot[] {
  return ownerType === "provider"
    ? PROVIDER_DOCUMENT_SLOTS
    : DRIVER_DOCUMENT_SLOTS;
}

const EXT_BY_MIME: Record<DocumentMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf"
};

export function fileExtensionForMime(mime: string): string {
  if ((ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mime)) {
    return EXT_BY_MIME[mime as DocumentMimeType];
  }
  return "bin";
}

export function buildDocumentStoragePath({
  ownerType,
  userId,
  documentType,
  mimeType,
  randomSuffix
}: {
  ownerType: DocumentOwnerType;
  userId: string;
  documentType: DocumentType;
  mimeType: string;
  // Caller supplies the random portion so the function stays pure (Math.random
  // / Date.now / crypto.randomUUID are caller-side concerns).
  randomSuffix: string;
}): string {
  const ext = fileExtensionForMime(mimeType);
  return `${ownerType}/${userId}/${documentType}-${randomSuffix}.${ext}`;
}

/**
 * Validates that a storage path looks like one of ours: starts with the
 * expected `{ownerType}/{userId}/` prefix and references the named
 * documentType. Stops users from inserting `documents` rows that point at
 * other people's files.
 */
export function isValidDocumentStoragePath({
  path,
  ownerType,
  userId,
  documentType
}: {
  path: string;
  ownerType: DocumentOwnerType;
  userId: string;
  documentType: DocumentType;
}): boolean {
  const prefix = `${ownerType}/${userId}/${documentType}-`;
  return path.startsWith(prefix) && path.length > prefix.length;
}
