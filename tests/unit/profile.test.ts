import { describe, expect, it, vi } from "vitest";

import { ADMIN_EMAIL } from "@/lib/constants";
import { ensureProfile } from "@/lib/profile";

type EnsureProfileClient = Parameters<typeof ensureProfile>[0];
type EnsureProfileUser = Parameters<typeof ensureProfile>[1];

type ProfileClientOptions = {
  existing?: Record<string, unknown> | null;
  readError?: Error | null;
  created?: Record<string, unknown> | null;
  insertError?: Error | null;
};

function createProfilesClient(options: ProfileClientOptions = {}) {
  const maybeSingle = vi.fn(async () => ({
    data: options.existing ?? null,
    error: options.readError ?? null
  }));
  const single = vi.fn(async () => ({
    data: options.created ?? null,
    error: options.insertError ?? null
  }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const selectExisting = vi.fn(() => ({ eq }));
  const selectCreated = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select: selectCreated }));
  const from = vi.fn(() => ({ select: selectExisting, insert }));

  return {
    client: { from } as unknown as EnsureProfileClient,
    eq,
    from,
    insert,
    maybeSingle,
    single
  };
}

function user(
  metadata: Record<string, unknown> = {},
  email = "buyer@example.com"
): EnsureProfileUser {
  return { id: "auth-user-1", email, user_metadata: metadata } as unknown as EnsureProfileUser;
}

describe("profile flow", () => {
  it("returns an existing profile without inserting", async () => {
    const existing = { id: "profile-1", role: "buyer" };
    const { client, insert } = createProfilesClient({ existing });

    await expect(ensureProfile(client, user())).resolves.toBe(existing);
    expect(insert).not.toHaveBeenCalled();
  });

  it("throws Supabase read errors before creating a profile", async () => {
    const readError = new Error("profiles unavailable");
    const { client, insert } = createProfilesClient({ readError });

    await expect(ensureProfile(client, user())).rejects.toThrow(readError);
    expect(insert).not.toHaveBeenCalled();
  });

  it("creates a profile from safe metadata and preserves public roles", async () => {
    const created = { id: "profile-2", role: "provider" };
    const { client, insert } = createProfilesClient({ created });

    await expect(
      ensureProfile(
        client,
        user({ role: "provider", full_name: "Provider Test", phone: "0712345678" })
      )
    ).resolves.toBe(created);

    expect(insert).toHaveBeenCalledWith({
      auth_user_id: "auth-user-1",
      email: "buyer@example.com",
      role: "provider",
      full_name: "Provider Test",
      phone: "0712345678",
      terms_accepted_at: null
    });
  });

  it("defaults unsafe metadata to a buyer profile", async () => {
    const { client, insert } = createProfilesClient({ created: { id: "profile-3" } });

    await ensureProfile(
      client,
      user({ role: "admin", full_name: 123, phone: { raw: "071" } })
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "buyer", full_name: null, phone: null })
    );
  });

  it("creates admin profiles only for the configured admin email", async () => {
    const { client, insert } = createProfilesClient({ created: { id: "admin-profile" } });

    await ensureProfile(client, user({ role: "buyer" }, ADMIN_EMAIL));

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }));
  });

  it("throws Supabase insert errors", async () => {
    const insertError = new Error("insert blocked");
    const { client } = createProfilesClient({ insertError });

    await expect(ensureProfile(client, user())).rejects.toThrow(insertError);
  });
});