import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PRIVATE_DOCUMENTS_BUCKET } from "@/lib/storage";

/**
 * Mint a short-lived signed URL for an object in the private-documents
 * bucket. Used by the admin viewer route. Returns null if the path doesn't
 * exist or Storage refuses (e.g. expired bucket policy).
 */
export async function createSignedDocumentUrl(
  storagePath: string,
  ttlSeconds = 60
): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(PRIVATE_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
