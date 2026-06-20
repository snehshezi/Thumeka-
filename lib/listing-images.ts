// Shared types + helpers for the public-listing-images bucket. Used by the
// browser-side upload slot, the create-listing server action, and every
// surface that renders a listing card.

export const PUBLIC_LISTING_IMAGES_BUCKET = "public-listing-images";
export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_LISTING_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp"
] as const;

export type ListingImageMimeType =
  (typeof ALLOWED_LISTING_IMAGE_MIME_TYPES)[number];

const EXT_BY_MIME: Record<ListingImageMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp"
};

export function fileExtensionForListingImageMime(mime: string): string {
  if (
    (ALLOWED_LISTING_IMAGE_MIME_TYPES as readonly string[]).includes(mime)
  ) {
    return EXT_BY_MIME[mime as ListingImageMimeType];
  }
  return "bin";
}

export function buildListingImageStoragePath({
  userId,
  mimeType,
  randomSuffix
}: {
  userId: string;
  mimeType: string;
  randomSuffix: string;
}): string {
  const ext = fileExtensionForListingImageMime(mimeType);
  return `${userId}/${randomSuffix}.${ext}`;
}

/**
 * Server-side: validates a storage path looks like one of ours. Defends the
 * action against forged values like an external URL or another user's path.
 */
export function isValidListingImageStoragePath({
  path,
  userId
}: {
  path: string;
  userId: string;
}): boolean {
  // {userId}/{randomSuffix}.{ext}
  const m = path.match(/^([0-9a-fA-F-]{36})\/([0-9a-fA-F-]+)\.(png|jpg|jpeg|webp)$/);
  if (!m) return false;
  return m[1] === userId;
}

/**
 * Resolve a stored storage path to its public URL. The bucket is public so we
 * can build the URL without a Supabase round-trip — `NEXT_PUBLIC_SUPABASE_URL`
 * is already exposed to the browser.
 */
export function getListingImagePublicUrl(
  storagePath: string | null | undefined,
  supabaseUrl: string
): string | null {
  if (!storagePath) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${PUBLIC_LISTING_IMAGES_BUCKET}/${storagePath}`;
}
