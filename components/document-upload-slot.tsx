"use client";

import { useId, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  buildDocumentStoragePath,
  MAX_DOCUMENT_BYTES,
  PRIVATE_DOCUMENTS_BUCKET,
  type DocumentOwnerType,
  type DocumentSlot
} from "@/lib/storage";

type DocumentUploadSlotProps = {
  ownerType: DocumentOwnerType;
  userId: string;
  slot: DocumentSlot;
};

type Status =
  | { kind: "empty" }
  | { kind: "uploading"; fileName: string }
  | { kind: "uploaded"; fileName: string; sizeBytes: number; storagePath: string }
  | { kind: "error"; message: string; debug?: string };

// Server-side stalls anywhere up to ~30 s feel possible; 60 s gives us a wide
// safety net while still bailing if something genuinely hangs.
const UPLOAD_TIMEOUT_MS = 60_000;

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function randomSuffix(): string {
  // Browser-native; crypto.randomUUID is available in every supported browser.
  return crypto.randomUUID().slice(0, 12);
}

/**
 * Turn a raw Supabase error message into a friendlier sentence while keeping
 * the technical text accessible via the `debug` field for support triage.
 */
function friendlyError(raw: string): { message: string; debug: string } {
  const lower = raw.toLowerCase();
  if (lower.includes("row-level security") || lower.includes("rls")) {
    return {
      message:
        "Server refused the upload. Try signing in again, then re-upload.",
      debug: raw
    };
  }
  if (lower.includes("jwt") || lower.includes("unauthorized") || lower.includes("401")) {
    return {
      message: "Sign in expired. Refresh the page and try again.",
      debug: raw
    };
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch")) {
    return {
      message: "Network issue — check your connection and retry.",
      debug: raw
    };
  }
  if (lower.includes("not found") || lower.includes("bucket")) {
    return {
      message: "Document storage isn't set up. Contact support.",
      debug: raw
    };
  }
  return {
    message: "Upload failed. Try again, or contact support if it persists.",
    debug: raw
  };
}

/** Reject after `ms` so a hung underlying fetch can't strand the UI forever. */
function timeoutPromise<T>(ms: number, label: string): Promise<T> {
  return new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(`${label}_TIMEOUT_${ms}MS`)), ms);
  });
}

export function DocumentUploadSlot({
  ownerType,
  userId,
  slot
}: DocumentUploadSlotProps) {
  const fileInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "empty" });

  const accept = ALLOWED_DOCUMENT_MIME_TYPES.join(",");

  async function handleFile(file: File) {
    const slotLabel = `[upload:${slot.documentType}]`;

    if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
      setStatus({
        kind: "error",
        message: "Use a PDF or an image (PNG / JPEG / WebP)."
      });
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setStatus({
        kind: "error",
        message: `That file is ${humanBytes(file.size)}. The cap is 10 MB.`
      });
      return;
    }

    const storagePath = buildDocumentStoragePath({
      ownerType,
      userId,
      documentType: slot.documentType,
      mimeType: file.type,
      randomSuffix: randomSuffix()
    });

    console.log(`${slotLabel} start`, {
      path: storagePath,
      sizeBytes: file.size,
      mime: file.type,
      propUserId: userId
    });

    setStatus({ kind: "uploading", fileName: file.name });

    // Initialise the browser client lazily so any client-construction failure
    // (e.g. missing NEXT_PUBLIC_* env at build time) surfaces in the slot's
    // error state instead of crashing the page with an uncaught rejection.
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch (initErr) {
      const msg = initErr instanceof Error ? initErr.message : String(initErr);
      console.error(`${slotLabel} client init threw`, msg);
      setStatus({
        kind: "error",
        message: "Document storage isn't configured. Contact support.",
        debug: msg
      });
      return;
    }

    // Pre-flight: confirm the browser-side client sees a real signed-in user.
    // If it doesn't, the upload would 403 anyway — bail with a clear message
    // instead of letting the SDK chase its tail.
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      console.log(`${slotLabel} auth user`, {
        id: authData?.user?.id ?? null,
        propUserIdMatches: authData?.user?.id === userId,
        role: authData?.user?.role ?? null,
        authError: authError?.message ?? null
      });

      if (!authData?.user) {
        setStatus({
          kind: "error",
          message: "Sign in expired. Refresh the page and try again.",
          debug: authError?.message ?? "auth.getUser() returned no user"
        });
        return;
      }
    } catch (preflightErr) {
      const msg = preflightErr instanceof Error ? preflightErr.message : String(preflightErr);
      console.error(`${slotLabel} auth pre-flight threw`, msg);
      setStatus({
        kind: "error",
        message: "Couldn't verify your sign-in. Refresh the page.",
        debug: msg
      });
      return;
    }

    // Race the upload against a 60-second timeout. The Supabase SDK doesn't
    // accept an AbortSignal in its options, so we can't cancel the underlying
    // fetch — but we can stop blocking the UI on it.
    try {
      const uploadPromise = supabase.storage
        .from(PRIVATE_DOCUMENTS_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true
        });

      const result = await Promise.race([
        uploadPromise,
        timeoutPromise<Awaited<typeof uploadPromise>>(UPLOAD_TIMEOUT_MS, "UPLOAD")
      ]);

      console.log(`${slotLabel} result`, {
        error: result.error ?? null,
        data: result.data ?? null
      });

      if (result.error) {
        const friendly = friendlyError(result.error.message);
        setStatus({ kind: "error", message: friendly.message, debug: friendly.debug });
        return;
      }

      setStatus({
        kind: "uploaded",
        fileName: file.name,
        sizeBytes: file.size,
        storagePath
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      console.error(`${slotLabel} threw`, raw);

      if (raw.includes("UPLOAD_TIMEOUT")) {
        setStatus({
          kind: "error",
          message: "Upload timed out — check your connection and retry.",
          debug: raw
        });
        return;
      }

      const friendly = friendlyError(raw);
      setStatus({ kind: "error", message: friendly.message, debug: friendly.debug });
    }
  }

  function handleClear() {
    setStatus({ kind: "empty" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const storagePath = status.kind === "uploaded" ? status.storagePath : "";
  const slotTestId = `document-slot-${slot.documentType}`;

  return (
    <div
      className="rounded-lg border border-black/10 bg-white p-4"
      data-testid={slotTestId}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <label htmlFor={fileInputId} className="font-semibold text-ink">
            {slot.label}
            {slot.required ? (
              <span className="ml-1 text-clay">*</span>
            ) : (
              <span className="ml-2 text-xs font-normal text-black/50">
                (optional)
              </span>
            )}
          </label>
          <p className="mt-1 text-body-sm text-black/55">{slot.helpText}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          id={fileInputId}
          className="block w-full text-sm text-black/70 file:mr-3 file:rounded-md file:border-0 file:bg-mint file:px-3 file:py-2 file:text-sm file:font-semibold file:text-leaf hover:file:bg-mint/80"
          data-testid={`${slotTestId}-file-input`}
          type="file"
          accept={accept}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        {status.kind === "uploaded" || status.kind === "error" ? (
          <button
            type="button"
            className="btn-secondary shrink-0"
            data-testid={`${slotTestId}-clear-button`}
            onClick={handleClear}
          >
            {status.kind === "error" ? "Try again" : "Replace"}
          </button>
        ) : null}
      </div>

      <p
        className="mt-2 text-xs"
        data-testid={`${slotTestId}-status`}
        data-status={status.kind}
      >
        {status.kind === "empty" ? (
          <span className="text-black/45">PDF or photo, up to 10 MB.</span>
        ) : null}
        {status.kind === "uploading" ? (
          <span className="text-black/70">Uploading {status.fileName}…</span>
        ) : null}
        {status.kind === "uploaded" ? (
          <span className="text-leaf">
            Uploaded — {status.fileName} ({humanBytes(status.sizeBytes)})
          </span>
        ) : null}
        {status.kind === "error" ? (
          <span className="block">
            <span className="text-red-600">{status.message}</span>
            {status.debug ? (
              <span
                className="mt-1 block text-[10px] text-black/40"
                data-testid={`${slotTestId}-debug`}
              >
                {status.debug}
              </span>
            ) : null}
          </span>
        ) : null}
      </p>

      <input
        type="hidden"
        name={`document_path__${slot.documentType}`}
        value={storagePath}
      />
    </div>
  );
}
