import { createClient } from "@supabase/supabase-js";

import {
  assertLocalSupabaseUrl,
  getTestAnonKey,
  getTestServiceRoleKey
} from "@/tests/helpers/supabase-env";
import type { TestUser } from "@/tests/fixtures/users";

export function createTestSupabaseAdminClient() {
  return createClient(assertLocalSupabaseUrl(), getTestServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function createTestSupabaseAnonClient() {
  return createClient(assertLocalSupabaseUrl(), getTestAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

export async function createAuthenticatedTestClient(user: TestUser) {
  const supabase = createTestSupabaseAnonClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password
  });

  if (error) {
    throw error;
  }

  return supabase;
}
