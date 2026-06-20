import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
  createSupabaseAdminClient: vi.fn()
}));

vi.mock("web-push", () => ({
  default: {
    sendNotification: mocks.sendNotification,
    setVapidDetails: mocks.setVapidDetails
  }
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));

import { sendPush } from "@/lib/push";

type Sub = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
};

function buildSub(overrides: Partial<Sub> = {}): Sub {
  return {
    id: overrides.id ?? "sub-1",
    user_id: overrides.user_id ?? "user-1",
    endpoint:
      overrides.endpoint ?? "https://push.example.com/abc",
    p256dh: overrides.p256dh ?? "p256dh-key",
    auth: overrides.auth ?? "auth-secret",
    user_agent: overrides.user_agent ?? null,
    created_at: overrides.created_at ?? "2026-06-01T00:00:00Z"
  };
}

function mockSupabase(subs: Sub[]) {
  const deleteEq = vi.fn(async () => ({ error: null }));
  const deleteFn = vi.fn(() => ({ eq: deleteEq }));
  const from = vi.fn((table: string) => {
    if (table !== "push_subscriptions") {
      throw new Error(`Unexpected table ${table}`);
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: subs, error: null }))
      })),
      delete: deleteFn
    };
  });
  mocks.createSupabaseAdminClient.mockReturnValue({ from });
  return { from, deleteFn, deleteEq };
}

describe("sendPush", () => {
  const originalEnv = {
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VAPID_SUBJECT = "mailto:test@thumeka.test";
    process.env.VAPID_PUBLIC_KEY = "test-public-key";
    process.env.VAPID_PRIVATE_KEY = "test-private-key";
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  });

  afterEach(() => {
    process.env.VAPID_SUBJECT = originalEnv.VAPID_SUBJECT;
    process.env.VAPID_PUBLIC_KEY = originalEnv.VAPID_PUBLIC_KEY;
    process.env.VAPID_PRIVATE_KEY = originalEnv.VAPID_PRIVATE_KEY;
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY =
      originalEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  });

  it("fans out to every subscription owned by the user", async () => {
    mockSupabase([
      buildSub({ id: "sub-1", endpoint: "https://push.example.com/a" }),
      buildSub({ id: "sub-2", endpoint: "https://push.example.com/b" })
    ]);
    mocks.sendNotification.mockResolvedValue({ statusCode: 201 });

    const delivered = await sendPush({
      userId: "user-1",
      title: "Test",
      body: "Hello",
      url: "/buyer/orders"
    });

    expect(delivered).toBe(2);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(2);
    // Payload is JSON-stringified with the canonical fields the
    // service worker reads.
    const firstCall = mocks.sendNotification.mock.calls[0];
    expect(JSON.parse(firstCall[1] as string)).toEqual({
      title: "Test",
      body: "Hello",
      url: "/buyer/orders"
    });
  });

  it("prunes a subscription on 410 Gone", async () => {
    const { deleteFn, deleteEq } = mockSupabase([
      buildSub({ id: "stale-sub" })
    ]);
    mocks.sendNotification.mockRejectedValue({ statusCode: 410 });

    const delivered = await sendPush({
      userId: "user-1",
      title: "Test",
      body: "Hello",
      url: "/"
    });

    expect(delivered).toBe(0);
    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(deleteEq).toHaveBeenCalledWith("id", "stale-sub");
  });

  it("prunes a subscription on 404 Not Found", async () => {
    const { deleteFn } = mockSupabase([buildSub({ id: "missing-sub" })]);
    mocks.sendNotification.mockRejectedValue({ statusCode: 404 });

    await sendPush({ userId: "user-1", title: "T", body: "B", url: "/" });

    expect(deleteFn).toHaveBeenCalledTimes(1);
  });

  it("leaves the subscription alone on 5xx and other errors", async () => {
    const { deleteFn } = mockSupabase([buildSub({ id: "flaky-sub" })]);
    mocks.sendNotification.mockRejectedValue({
      statusCode: 503,
      message: "service unavailable"
    });

    const delivered = await sendPush({
      userId: "user-1",
      title: "T",
      body: "B",
      url: "/"
    });

    expect(delivered).toBe(0);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("no-ops when VAPID env is incomplete", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    mockSupabase([buildSub()]);

    const delivered = await sendPush({
      userId: "user-1",
      title: "T",
      body: "B",
      url: "/"
    });

    expect(delivered).toBe(0);
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });
});
