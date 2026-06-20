"use client";

import { ImagePlus, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import {
  ALLOWED_LISTING_IMAGE_MIME_TYPES,
  buildListingImageStoragePath,
  getListingImagePublicUrl,
  MAX_LISTING_IMAGE_BYTES,
  PUBLIC_LISTING_IMAGES_BUCKET
} from "@/lib/listing-images";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Status =
  | { kind: "empty" }
  | { kind: "uploading"; fileName: string }
  | { kind: "uploaded"; previewUrl: string; storagePath: string; sizeBytes: number }
  | { kind: "error"; message: string };

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function randomSuffix(): string {
  return crypto.randomUUID();
}

type ListingImageUploadProps = {
  userId: string;
  supabaseUrl: string;
  /**
   * Pre-existing image storage path (set on edit). When provided the
   * component renders the existing image as the "current" value; the hidden
   * input keeps the same path until the seller replaces it with a new
   * upload.
   */
  defaultStoragePath?: string | null;
};

export function ListingImageUpload({
  userId,
  supabaseUrl,
  defaultStoragePath
}: ListingImageUploadProps) {
  const fileInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const initialStatus: Status = defaultStoragePath
    ? {
        kind: "uploaded",
        previewUrl: getListingImagePublicUrl(defaultStoragePath, supabaseUrl) ?? "",
        storagePath: defaultStoragePath,
        sizeBytes: 0
      }
    : { kind: "empty" };
  const [status, setStatus] = useState<Status>(initialStatus);

  const accept = ALLOWED_LISTING_IMAGE_MIME_TYPES.join(",");

  async function handleFile(file: File) {
    if (
      !(ALLOWED_LISTING_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)
    ) {
      setStatus({
        kind: "error",
        message: "Use a PNG, JPEG, or WebP image."
      });
      return;
    }
    if (file.size > MAX_LISTING_IMAGE_BYTES) {
      setStatus({
        kind: "error",
        message: `That image is ${humanBytes(file.size)}. The cap is 5 MB.`
      });
      return;
    }

    const storagePath = buildListingImageStoragePath({
      userId,
      mimeType: file.type,
      randomSuffix: randomSuffix()
    });

    setStatus({ kind: "uploading", fileName: file.name });

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.storage
      .from(PUBLIC_LISTING_IMAGES_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true
      });

    if (error) {
      setStatus({ kind: "error", message: error.message || "Upload failed. Try again." });
      return;
    }

    const previewUrl = getListingImagePublicUrl(storagePath, supabaseUrl) ?? "";
    setStatus({
      kind: "uploaded",
      previewUrl,
      storagePath,
      sizeBytes: file.size
    });
  }

  function handleClear() {
    setStatus({ kind: "empty" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const storagePath = status.kind === "uploaded" ? status.storagePath : "";

  return (
    <div className="space-y-2" data-testid="listing-image-upload">
      <label htmlFor={fileInputId} className="label">
        Cover image{" "}
        <span className="ml-1 text-xs font-normal text-black/50">(optional)</span>
      </label>

      {status.kind === "uploaded" ? (
        <div
          className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-black/10 bg-mist"
          data-testid="listing-image-upload-preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Listing cover preview"
            src={status.previewUrl}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <button
            type="button"
            aria-label="Remove image"
            className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-ink shadow-soft hover:bg-white"
            data-testid="listing-image-upload-clear-button"
            onClick={handleClear}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={fileInputId}
          className="flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-black/15 bg-mist text-black/55 transition hover:border-leaf hover:text-leaf"
          data-testid="listing-image-upload-dropzone"
        >
          <ImagePlus className="h-6 w-6" aria-hidden="true" />
          <span className="mt-2 text-sm font-semibold">
            {status.kind === "uploading"
              ? `Uploading ${status.fileName}…`
              : "Add cover image"}
          </span>
          <span className="mt-1 text-xs">PNG / JPEG / WebP, up to 5 MB</span>
        </label>
      )}

      <input
        ref={inputRef}
        id={fileInputId}
        className="sr-only"
        data-testid="listing-image-upload-file-input"
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      <p
        className="text-xs"
        data-testid="listing-image-upload-status"
        data-status={status.kind}
      >
        {status.kind === "error" ? (
          <span className="text-red-600">{status.message}</span>
        ) : status.kind === "uploaded" ? (
          <span className="text-leaf">
            Uploaded ({humanBytes(status.sizeBytes)})
          </span>
        ) : null}
      </p>

      <input type="hidden" name="image_storage_path" value={storagePath} />
    </div>
  );
}
