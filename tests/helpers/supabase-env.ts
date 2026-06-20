import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const LOCAL_SUPABASE_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "0.0.0.0"
]);
const PLACEHOLDER_KEYS = new Set([
  "test-anon-key",
  "replace-with-local-anon-key",
  "replace-with-local-service-role-key"
]);

export function loadTestEnvFile(fileName = ".env.test.local") {
  const envPath = path.resolve(process.cwd(), fileName);

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function getTestSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
}

export function assertLocalSupabaseUrl(value = getTestSupabaseUrl()) {
  const url = new URL(value);

  if (!LOCAL_SUPABASE_HOSTS.has(url.hostname)) {
    throw new Error(
      `Refusing to run test seed helpers against non-local Supabase host: ${url.hostname}`
    );
  }

  return url.toString();
}

export function getTestServiceRoleKey() {
  const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

  if (!key || PLACEHOLDER_KEYS.has(key)) {
    throw new Error(
      "SUPABASE_TEST_SERVICE_ROLE_KEY is required for local seed helpers"
    );
  }

  return key;
}

export function getTestAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key || PLACEHOLDER_KEYS.has(key)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY must be the local Supabase anon key for database tests"
    );
  }

  return key;
}
