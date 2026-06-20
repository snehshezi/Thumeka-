import { describe, expect, it } from "vitest";

import {
  buildListingImageStoragePath,
  getListingImagePublicUrl,
  isValidListingImageStoragePath,
  PUBLIC_LISTING_IMAGES_BUCKET
} from "@/lib/listing-images";

const USER = "11111111-2222-3333-4444-555555555555";

describe("buildListingImageStoragePath", () => {
  it("uses the user id as the first path segment", () => {
    const p = buildListingImageStoragePath({
      userId: USER,
      mimeType: "image/png",
      randomSuffix: "abc-123"
    });
    expect(p).toBe(`${USER}/abc-123.png`);
  });

  it("maps each allowed MIME to a sensible extension", () => {
    const suffix = "deadbeef";
    expect(
      buildListingImageStoragePath({ userId: USER, mimeType: "image/jpeg", randomSuffix: suffix })
    ).toBe(`${USER}/${suffix}.jpg`);
    expect(
      buildListingImageStoragePath({ userId: USER, mimeType: "image/webp", randomSuffix: suffix })
    ).toBe(`${USER}/${suffix}.webp`);
  });
});

describe("isValidListingImageStoragePath", () => {
  it("accepts a path whose first segment matches the user id", () => {
    expect(
      isValidListingImageStoragePath({
        path: `${USER}/abc-123.png`,
        userId: USER
      })
    ).toBe(true);
  });

  it("rejects a path that points at someone else's folder", () => {
    const other = "99999999-2222-3333-4444-555555555555";
    expect(
      isValidListingImageStoragePath({
        path: `${other}/abc-123.png`,
        userId: USER
      })
    ).toBe(false);
  });

  it("rejects a path without a recognised extension", () => {
    expect(
      isValidListingImageStoragePath({
        path: `${USER}/abc-123.gif`,
        userId: USER
      })
    ).toBe(false);
  });

  it("rejects an external URL", () => {
    expect(
      isValidListingImageStoragePath({
        path: "https://evil.example/cover.png",
        userId: USER
      })
    ).toBe(false);
  });
});

describe("getListingImagePublicUrl", () => {
  const base = "http://127.0.0.1:54321";

  it("returns null when the storage path is empty or null", () => {
    expect(getListingImagePublicUrl(null, base)).toBeNull();
    expect(getListingImagePublicUrl("", base)).toBeNull();
  });

  it("builds the canonical public URL for a storage path", () => {
    expect(
      getListingImagePublicUrl(`${USER}/cover.jpg`, base)
    ).toBe(
      `${base}/storage/v1/object/public/${PUBLIC_LISTING_IMAGES_BUCKET}/${USER}/cover.jpg`
    );
  });

  it("strips a trailing slash on the Supabase URL before joining", () => {
    expect(
      getListingImagePublicUrl("a/b.png", "http://example.com/")
    ).toBe(
      `http://example.com/storage/v1/object/public/${PUBLIC_LISTING_IMAGES_BUCKET}/a/b.png`
    );
  });
});
