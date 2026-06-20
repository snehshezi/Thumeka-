import { Camera } from "lucide-react";

import { getListingImagePublicUrl } from "@/lib/listing-images";

type ListingImageProps = {
  storagePath: string | null | undefined;
  alt: string;
  // Layout: square corners on detail hero, rounded on cards. Caller controls
  // the outer className for sizing; the component owns the inner img/placeholder.
  className?: string;
  testIdPrefix?: string;
};

/**
 * Renders a listing's cover image when set, else a soft mint placeholder with
 * a camera icon. The component is server-safe and accepts a storage path
 * (column value of `listings.image_url`) — it never touches Supabase.
 */
export function ListingImage({
  storagePath,
  alt,
  className,
  testIdPrefix = "listing-image"
}: ListingImageProps) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publicUrl = getListingImagePublicUrl(storagePath, supabaseUrl);

  if (publicUrl) {
    return (
      <div className={className} data-testid={`${testIdPrefix}-photo`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={alt}
          src={publicUrl}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${className ?? ""} flex items-center justify-center bg-mint text-leaf`}
      data-testid={`${testIdPrefix}-placeholder`}
    >
      <Camera className="h-8 w-8 opacity-60" />
    </div>
  );
}
