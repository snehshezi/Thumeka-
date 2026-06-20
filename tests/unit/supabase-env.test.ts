import { afterEach, describe, expect, it } from "vitest";

import {
  assertLocalSupabaseUrl,
  getTestAnonKey,
  getTestServiceRoleKey
} from "@/tests/helpers/supabase-env";

describe("Supabase test environment guard", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
  });

  it("allows local Supabase URLs", () => {
    expect(assertLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(
      "http://127.0.0.1:54321/"
    );
    expect(assertLocalSupabaseUrl("http://localhost:54321")).toBe(
      "http://localhost:54321/"
    );
  });

  it("rejects hosted Supabase URLs", () => {
    expect(() =>
      assertLocalSupabaseUrl("https://project.supabase.co")
    ).toThrow(/non-local Supabase host/);
  });

  it("rejects placeholder Supabase keys", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "replace-with-local-anon-key";
    process.env.SUPABASE_TEST_SERVICE_ROLE_KEY =
      "replace-with-local-service-role-key";

    expect(() => getTestAnonKey()).toThrow(/local Supabase anon key/);
    expect(() => getTestServiceRoleKey()).toThrow(/SERVICE_ROLE_KEY/);
  });
});
