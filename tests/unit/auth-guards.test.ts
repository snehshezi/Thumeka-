import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  ensureProfile: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/profile", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient
}));

import { getCurrentProfile, requireProfile, requireRole } from "@/lib/auth";

const providerProfile = {
  id: "profile-provider",
  role: "provider",
  email: "provider@example.com"
};

function mockSupabaseUser(user: unknown, error: Error | null = null) {
  const getUser = vi.fn(async () => ({ data: { user }, error }));
  mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser } });
  return { getUser };
}

describe("auth guard flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for anonymous current-profile lookups", async () => {
    mockSupabaseUser(null);

    await expect(getCurrentProfile()).resolves.toBeNull();
    expect(mocks.ensureProfile).not.toHaveBeenCalled();
  });

  it("resolves the current user's profile when authenticated", async () => {
    const user = { id: "auth-user-1" };
    mockSupabaseUser(user);
    mocks.ensureProfile.mockResolvedValue(providerProfile);

    await expect(getCurrentProfile()).resolves.toBe(providerProfile);
    expect(mocks.ensureProfile).toHaveBeenCalledWith(expect.anything(), user);
  });

  it("redirects anonymous protected sessions to sign in", async () => {
    mockSupabaseUser(null);

    await expect(requireProfile()).rejects.toThrow("NEXT_REDIRECT:/auth/sign-in");
  });

  it("returns a session profile for authenticated users", async () => {
    const user = { id: "auth-user-2" };
    mockSupabaseUser(user);
    mocks.ensureProfile.mockResolvedValue(providerProfile);

    await expect(requireProfile()).resolves.toEqual({
      userId: "auth-user-2",
      profile: providerProfile
    });
  });

  it("allows matching roles through requireRole", async () => {
    mockSupabaseUser({ id: "auth-user-3" });
    mocks.ensureProfile.mockResolvedValue(providerProfile);

    await expect(requireRole(["provider", "admin"])).resolves.toEqual({
      userId: "auth-user-3",
      profile: providerProfile
    });
  });

  it("redirects role mismatches to the signed-in user's home", async () => {
    mockSupabaseUser({ id: "auth-user-4" });
    mocks.ensureProfile.mockResolvedValue(providerProfile);

    await expect(requireRole(["buyer"])).rejects.toThrow(
      "NEXT_REDIRECT:/provider/dashboard"
    );
  });
});