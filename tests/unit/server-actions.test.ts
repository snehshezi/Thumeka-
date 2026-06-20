import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  ensureProfile: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  requireRole: vi.fn(),
  sendEmail: vi.fn(async () => undefined),
  getDeliveryQuote: vi.fn(),
  cookies: vi.fn(async () => ({
    getAll: () => [],
    delete: vi.fn()
  }))
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/profile", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient
}));
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/delivery", () => ({ getDeliveryQuote: mocks.getDeliveryQuote }));

function deliveryQuoteFixture(overrides: Record<string, number | null> = {}) {
  return {
    distanceKm: 4,
    deliveryFee: 70,
    buyerTotal: 320,
    listingPrice: 250,
    baseFee: 36,
    pricePerKm: 8.5,
    commissionPercentage: 12,
    commissionAmount: 30,
    providerEarning: 220,
    driverEarning: 70,
    deliveryLat: null,
    deliveryLng: null,
    ...overrides
  };
}

import { registerAction, signInAction } from "@/app/auth/actions";
import { GET, POST } from "@/app/auth/sign-out/route";
import { createOrderRequestAction } from "@/app/checkout/[listingId]/actions";
import { submitDriverApplicationAction } from "@/app/driver/apply/actions";
import { submitProviderApplicationAction } from "@/app/provider/apply/actions";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

function form(values: Record<string, string | undefined>) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) {
      formData.set(key, value);
    }
  });
  return formData;
}

function mockAuthClient() {
  const client = {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(async () => ({ error: null })),
      signUp: vi.fn()
    }
  };
  mocks.createSupabaseServerClient.mockResolvedValue(client);
  return client;
}

/** Mock the apply flow's full Supabase shape: profile upsert + documents
 *  delete + documents insert. The profile error lets failure tests still
 *  exercise the "upsert failed → redirect" branch without dropping the
 *  document validation that runs first. */
function mockApplyClient(profileTable: string, options: { profileError?: Error | null } = {}) {
  const profileUpsert = vi.fn(async () => ({ error: options.profileError ?? null }));
  const documentsDelete = vi.fn(async () => ({ error: null }));
  // Two `.eq()` chained then awaited — mirrors `.delete().eq(..).eq(..)`.
  const deleteBuilder = () => {
    const builder = {
      eq: vi.fn(() => builder),
      then: (resolve: (v: { error: null }) => void) => resolve({ error: null })
    };
    return builder;
  };
  const documentsInsert = vi.fn(async () => ({ error: null }));

  const from = vi.fn((name: string) => {
    if (name === profileTable) return { upsert: profileUpsert };
    if (name === "documents") {
      return {
        delete: () => {
          documentsDelete();
          return deleteBuilder();
        },
        insert: documentsInsert
      };
    }
    throw new Error(`Unexpected table ${name}`);
  });
  mocks.createSupabaseServerClient.mockResolvedValue({ from });
  return { profileUpsert, documentsDelete, documentsInsert, from };
}

function mockCheckoutClient(options: {
  listing?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  order?: Record<string, unknown> | null;
  orderError?: Error | null;
  providerProfile?: Record<string, unknown> | null;
  providerUserProfile?: Record<string, unknown> | null;
}) {
  type QueryChain = {
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    then: ReturnType<typeof vi.fn>;
  };

  function makeQueryChain(data: unknown) {
    const q = {} as QueryChain;
    q.eq = vi.fn(() => q);
    // For `listings.select('...').in('id', ids)` — the helper expects the
    // promise to resolve to `{ data: rows[], error: null }`. The cart helper
    // awaits the chain directly (no maybeSingle), so the chain itself acts
    // as a thenable.
    q.in = vi.fn(() => q);
    q.limit = vi.fn(() => q);
    q.select = vi.fn(() => q);
    q.maybeSingle = vi.fn(async () => ({ data: data ?? null, error: null }));
    // Make the chain awaitable for the `.in(...)` path. Wraps the supplied
    // data as an array if it's a single object (the helper fetches multiple
    // listings).
    q.then = vi.fn((onFulfilled: (value: unknown) => unknown) => {
      const value = Array.isArray(data) ? data : data ? [data] : [];
      return Promise.resolve(onFulfilled({ data: value, error: null }));
    });
    return q;
  }

  const listingQuery = makeQueryChain(options.listing ?? null);
  const settingsQuery = makeQueryChain(options.settings ?? null);
  const providerProfileQuery = makeQueryChain(
    options.providerProfile !== undefined
      ? options.providerProfile
      : { user_id: "provider-user-1", business_name: "Test Provider" }
  );
  const profileQuery = makeQueryChain(
    options.providerUserProfile !== undefined
      ? options.providerUserProfile
      : { email: "provider@example.com", full_name: "Test Provider" }
  );

  const orderInsert = vi.fn(() => ({
    select: () => ({
      single: async () => ({
        data: options.order ?? null,
        error: options.orderError ?? null
      })
    })
  }));
  const orderItemsInsert = vi.fn(async () => ({ error: null }));
  // Rollback path — order delete when order_items insert fails. Tests don't
  // exercise this; just need an awaitable result.
  const orderDelete = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null }))
  }));
  const eventInsert = vi.fn(async () => ({ error: null }));
  const from = vi.fn((table: string) => {
    if (table === "listings") return listingQuery;
    if (table === "admin_settings") return settingsQuery;
    if (table === "orders") {
      return { insert: orderInsert, delete: orderDelete };
    }
    if (table === "order_items") return { insert: orderItemsInsert };
    if (table === "order_status_events") return { insert: eventInsert };
    if (table === "provider_profiles") return providerProfileQuery;
    if (table === "profiles") return profileQuery;
    throw new Error(`Unexpected table ${table}`);
  });

  mocks.createSupabaseServerClient.mockResolvedValue({ from });
  return {
    eventInsert,
    from,
    listingQuery,
    orderInsert,
    orderItemsInsert,
    settingsQuery
  };
}

describe("server action flow coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://thumeka.test";
    mocks.requireRole.mockResolvedValue({
      profile: {
        email: "buyer@example.com",
        full_name: "Buyer Test",
        id: "buyer-profile",
        phone: "0712345678",
        role: "buyer"
      }
    });
  });

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
  });

  it("validates registration before calling Supabase", async () => {
    await expect(registerAction(form({ email: "buyer@example.com" }))).rejects.toThrow(
      "NEXT_REDIRECT:/auth/register?error=Full%20name%2C%20email%20and%20password%20are%20required"
    );

    await expect(
      registerAction(
        form({ email: "admin@thumeka.co.za", full_name: "Admin", password: "password1" })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/auth/register?error=Use%20the%20admin%20invite%20flow");

    await expect(
      registerAction(form({ email: "buyer@example.com", full_name: "Buyer", password: "short" }))
    ).rejects.toThrow("NEXT_REDIRECT:/auth/register?error=Password%20must%20be%20at%20least%208%20characters");

    await expect(
      registerAction(
        form({
          email: "buyer@example.com",
          full_name: "Buyer",
          password: "password1",
          confirm_password: "password2"
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/auth/register?error=Passwords%20do%20not%20match");

    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("passes safe registration metadata and handles email-confirmation signups", async () => {
    const client = mockAuthClient();
    client.auth.signUp.mockResolvedValue({
      data: { session: null, user: { id: "auth-user" } },
      error: null
    });

    await expect(
      registerAction(
        form({
          email: " DRIVER@Example.COM ",
          full_name: " Driver Test ",
          password: "password1",
          confirm_password: "password1",
          phone: " 0712345678 ",
          role: "driver",
          terms_accepted: "1"
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/auth/sign-in?registered=1");

    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: "driver@example.com",
      password: "password1",
      options: {
        emailRedirectTo: "https://thumeka.test/auth/callback",
        data: {
          full_name: "Driver Test",
          phone: "0712345678",
          role: "driver",
          terms_accepted_at: expect.any(String) as unknown as string
        }
      }
    });
    expect(mocks.ensureProfile).not.toHaveBeenCalled();
  });

  it("always redirects to sign-in after registration (email confirmation required)", async () => {
    const client = mockAuthClient();
    // With enable_confirmations=true, Supabase always returns session=null.
    // We simulate a session too, to confirm the action no longer uses it.
    client.auth.signUp.mockResolvedValue({
      data: { session: { access_token: "test-token" }, user: { id: "auth-provider" } },
      error: null
    });

    await expect(
      registerAction(
        form({
          email: "provider@example.com",
          full_name: "Provider",
          password: "password1",
          confirm_password: "password1",
          role: "provider",
          terms_accepted: "1"
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/auth/sign-in?registered=1");

    // Profile creation and welcome email happen in /auth/callback after confirmation, not here.
    expect(mocks.ensureProfile).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("handles registration and sign-in Supabase errors", async () => {
    const registerClient = mockAuthClient();
    registerClient.auth.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error("Email already registered")
    });

    await expect(
      registerAction(
        form({
          email: "buyer@example.com",
          full_name: "Buyer",
          password: "password1",
          confirm_password: "password1",
          terms_accepted: "1"
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/auth/register?error=Email%20already%20registered");

    const signInClient = mockAuthClient();
    signInClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error("Invalid login")
    });

    await expect(
      signInAction(form({ email: "buyer@example.com", password: "password1" }))
    ).rejects.toThrow("NEXT_REDIRECT:/auth/sign-in?error=Invalid%20login");
  });

  it("honors safe sign-in next paths and rejects protocol-relative redirects", async () => {
    const client = mockAuthClient();
    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "auth-buyer" } },
      error: null
    });
    mocks.ensureProfile.mockResolvedValue({ id: "profile-buyer", role: "buyer" });

    await expect(
      signInAction(form({ email: "buyer@example.com", next: "/checkout/listing-1", password: "password1" }))
    ).rejects.toThrow("NEXT_REDIRECT:/checkout/listing-1");

    await expect(
      signInAction(form({ email: "buyer@example.com", next: "//evil.example", password: "password1" }))
    ).rejects.toThrow("NEXT_REDIRECT:/buyer/orders");
  });

  it("submits provider and driver applications, sends confirmation email", async () => {
    mocks.requireRole.mockResolvedValueOnce({
      userId: "provider-auth",
      profile: { id: "provider-profile", role: "provider", email: "p@example.com", full_name: "Provider" }
    });
    const providerClient = mockApplyClient("provider_profiles");

    await expect(
      submitProviderApplicationAction(
        form({
          business_name: " Test Kitchen ",
          provider_type: "",
          suburb: " Berea ",
          document_path__id_document: "provider/provider-auth/id_document-aaa111.pdf",
          document_path__proof_of_address: "provider/provider-auth/proof_of_address-bbb222.pdf",
          document_path__bank_confirmation: "provider/provider-auth/bank_confirmation-ccc333.pdf",
          bank_account_number: "1234567890",
          bank_branch_code: "250655"
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/provider/status?submitted=1");

    expect(providerClient.profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: "Test Kitchen",
        provider_type: "individual",
        status: "pending",
        suburb: "Berea",
        user_id: "provider-profile"
      }),
      { onConflict: "user_id" }
    );
    expect(providerClient.documentsInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          // owner_user_id is the profile.id (FK target), not the auth user id.
          owner_user_id: "provider-profile",
          owner_type: "provider",
          document_type: "id_document",
          // The file path however carries the auth user id (auth.uid) so the
          // storage RLS prefix check passes.
          file_url: "provider/provider-auth/id_document-aaa111.pdf",
          submitted_via: "upload",
          status: "submitted"
        }),
        expect.objectContaining({ document_type: "proof_of_address" }),
        expect.objectContaining({ document_type: "bank_confirmation" })
      ])
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "p@example.com",
        subject: "Provider application received — Thumeka"
      })
    );

    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValueOnce({
      userId: "driver-auth",
      profile: { id: "driver-profile", role: "driver", email: "d@example.com", full_name: "Driver" }
    });
    const driverClient = mockApplyClient("driver_profiles");

    await expect(
      submitDriverApplicationAction(
        form({
          vehicle_type: " Motorbike ",
          vehicle_licence_number: " ND 123 456 ",
          document_path__id_document: "driver/driver-auth/id_document-aaa.pdf",
          document_path__drivers_licence: "driver/driver-auth/drivers_licence-bbb.pdf",
          document_path__vehicle_licence_disc: "driver/driver-auth/vehicle_licence_disc-ccc.pdf",
          document_path__bank_confirmation: "driver/driver-auth/bank_confirmation-ddd.pdf",
          bank_account_number: "9876543210",
          bank_branch_code: "051001"
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/driver/status?submitted=1");

    expect(driverClient.profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        approval_status: "pending",
        availability_status: "unavailable",
        user_id: "driver-profile",
        vehicle_licence_number: "ND 123 456",
        vehicle_type: "Motorbike"
      }),
      { onConflict: "user_id" }
    );
    expect(driverClient.documentsInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          owner_type: "driver",
          document_type: "drivers_licence"
        })
      ])
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "d@example.com",
        subject: "Driver application received — Thumeka"
      })
    );
  });

  it("redirects application upsert failures back to the apply pages", async () => {
    mocks.requireRole.mockResolvedValueOnce({
      userId: "provider-auth",
      profile: { id: "provider-profile", role: "provider" }
    });
    mockApplyClient("provider_profiles", { profileError: new Error("upsert failed") });
    await expect(
      submitProviderApplicationAction(
        form({
          document_path__id_document: "provider/provider-auth/id_document-x.pdf",
          document_path__proof_of_address: "provider/provider-auth/proof_of_address-y.pdf",
          document_path__bank_confirmation: "provider/provider-auth/bank_confirmation-z.pdf",
          bank_account_number: "1234567890",
          bank_branch_code: "250655"
        })
      )
    ).rejects.toThrow(
      "NEXT_REDIRECT:/provider/apply?error=Unable%20to%20submit%20provider%20application"
    );

    mocks.requireRole.mockResolvedValueOnce({
      userId: "driver-auth",
      profile: { id: "driver-profile", role: "driver" }
    });
    mockApplyClient("driver_profiles", { profileError: new Error("upsert failed") });
    await expect(
      submitDriverApplicationAction(
        form({
          document_path__id_document: "driver/driver-auth/id_document-a.pdf",
          document_path__drivers_licence: "driver/driver-auth/drivers_licence-b.pdf",
          document_path__vehicle_licence_disc: "driver/driver-auth/vehicle_licence_disc-c.pdf",
          document_path__bank_confirmation: "driver/driver-auth/bank_confirmation-d.pdf",
          bank_account_number: "9876543210",
          bank_branch_code: "051001"
        })
      )
    ).rejects.toThrow(
      "NEXT_REDIRECT:/driver/apply?error=Unable%20to%20submit%20driver%20application"
    );
  });

  it("blocks provider submission when a required document is missing", async () => {
    mocks.requireRole.mockResolvedValueOnce({
      userId: "provider-auth",
      profile: { id: "provider-profile", role: "provider" }
    });
    const client = mockApplyClient("provider_profiles");
    await expect(
      submitProviderApplicationAction(
        form({
          // id_document missing on purpose.
          document_path__proof_of_address: "provider/provider-auth/proof_of_address-y.pdf",
          document_path__bank_confirmation: "provider/provider-auth/bank_confirmation-z.pdf",
          bank_account_number: "1234567890",
          bank_branch_code: "250655"
        })
      )
    ).rejects.toThrow(/NEXT_REDIRECT:\/provider\/apply\?error=Please%20upload%20the%20ID%20document/);
    expect(client.profileUpsert).not.toHaveBeenCalled();
    expect(client.documentsInsert).not.toHaveBeenCalled();
  });

  it("blocks driver submission when a required document is missing", async () => {
    mocks.requireRole.mockResolvedValueOnce({
      userId: "driver-auth",
      profile: { id: "driver-profile", role: "driver" }
    });
    const client = mockApplyClient("driver_profiles");
    await expect(
      submitDriverApplicationAction(
        form({
          document_path__id_document: "driver/driver-auth/id_document-a.pdf",
          // drivers_licence missing
          document_path__vehicle_licence_disc: "driver/driver-auth/vehicle_licence_disc-c.pdf",
          document_path__bank_confirmation: "driver/driver-auth/bank_confirmation-d.pdf",
          bank_account_number: "9876543210",
          bank_branch_code: "051001"
        })
      )
    ).rejects.toThrow(/NEXT_REDIRECT:\/driver\/apply\?error=.*Driver/);
    expect(client.profileUpsert).not.toHaveBeenCalled();
    expect(client.documentsInsert).not.toHaveBeenCalled();
  });

  it("rejects a forged storage path that doesn't match the applicant's auth user id", async () => {
    mocks.requireRole.mockResolvedValueOnce({
      userId: "provider-auth",
      profile: { id: "provider-profile", role: "provider" }
    });
    const client = mockApplyClient("provider_profiles");
    await expect(
      submitProviderApplicationAction(
        form({
          // id_document path points at SOMEONE ELSE'S folder — should be rejected.
          document_path__id_document: "provider/some-other-user/id_document-aaa.pdf",
          document_path__proof_of_address: "provider/provider-auth/proof_of_address-y.pdf",
          document_path__bank_confirmation: "provider/provider-auth/bank_confirmation-z.pdf",
          bank_account_number: "1234567890",
          bank_branch_code: "250655"
        })
      )
    ).rejects.toThrow(/NEXT_REDIRECT:\/provider\/apply\?error=Couldn/);
    expect(client.profileUpsert).not.toHaveBeenCalled();
    expect(client.documentsInsert).not.toHaveBeenCalled();
  });

  it("guards checkout against missing listings and missing contact details", async () => {
    await expect(createOrderRequestAction(form({}))).rejects.toThrow(
      "NEXT_REDIRECT:/listings"
    );

    mocks.requireRole.mockResolvedValueOnce({
      profile: { email: "", full_name: null, id: "buyer", phone: null }
    });
    await expect(
      createOrderRequestAction(form({ listing_id: "listing-1" }))
    ).rejects.toThrow(
      "NEXT_REDIRECT:/checkout/listing-1?error=Name%2C%20phone%20and%20WhatsApp%20are%20required."
    );

    mockCheckoutClient({ listing: null });
    await expect(
      createOrderRequestAction(
        form({
          listing_id: "listing-1",
          buyer_name: "Buyer",
          buyer_phone: "0712345678",
          buyer_whatsapp: "0712345678",
          delivery_address: "1 Test Road",
          suburb: "Berea"
        })
      )
    ).rejects.toThrow(/no%20longer%20available/);
  });

  it("creates checkout orders priced with the delivery quote and status events", async () => {
    mocks.getDeliveryQuote.mockResolvedValue(deliveryQuoteFixture());
    const checkout = mockCheckoutClient({
      listing: {
        id: "listing-1",
        listing_type: "product",
        price: "250",
        provider_id: "provider-1",
        title: "Test Listing",
        is_active: true,
        admin_disabled: false
      },
      order: { id: "order-1" },
      settings: null
    });

    await expect(
      createOrderRequestAction(
        form({
          buyer_whatsapp: "0712345678",
          buyer_name: "Buyer Test",
          buyer_phone: "0712345678",
          buyer_notes: " Leave at reception ",
          delivery_address: "1 Test Road",
          listing_id: "listing-1",
          suburb: "Berea"
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/buyer/orders?created=order-1");

    expect(checkout.orderInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        buyer_id: "buyer-profile",
        buyer_notes: "Leave at reception",
        delivery_fee: 70,
        buyer_total: 320,
        commission_percentage: 12,
        listing_id: "listing-1",
        payment_status: "not_requested",
        status: "order_requested"
      })
    );
    // Line items table populated for the single-listing buy-now case too.
    expect(checkout.orderItemsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        order_id: "order-1",
        listing_id: "listing-1",
        listing_title: "Test Listing",
        quantity: 1,
        position: 0
      })
    ]);
    expect(checkout.eventInsert).toHaveBeenCalledWith({
      changed_by: "buyer-profile",
      new_status: "order_requested",
      note: "Buyer submitted order request",
      order_id: "order-1"
    });
    // Provider should be notified of the new order request
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "provider@example.com",
        subject: "New order request — Thumeka"
      })
    );
  });

  it("redirects checkout insert failures", async () => {
    mocks.getDeliveryQuote.mockResolvedValue(deliveryQuoteFixture());
    mockCheckoutClient({
      listing: {
        id: "listing-1",
        listing_type: "product",
        price: "250",
        provider_id: "provider-1",
        title: "Test Listing",
        is_active: true,
        admin_disabled: false
      },
      orderError: new Error("insert failed"),
      settings: { commission_percentage: 10 }
    });

    await expect(
      createOrderRequestAction(
        form({
          buyer_whatsapp: "0712345678",
          buyer_name: "Buyer",
          buyer_phone: "0712345678",
          delivery_address: "1 Test Road",
          listing_id: "listing-1",
          suburb: "Berea"
        })
      )
    ).rejects.toThrow(/Unable%20to%20create%20order%20request/);
  });

  it("blocks checkout when no delivery quote can be produced", async () => {
    mocks.getDeliveryQuote.mockResolvedValue(null);
    const checkout = mockCheckoutClient({
      listing: {
        id: "listing-1",
        listing_type: "product",
        price: "250",
        provider_id: "provider-1",
        title: "Test Listing",
        is_active: true,
        admin_disabled: false
      },
      order: { id: "order-1" },
      settings: null
    });

    await expect(
      createOrderRequestAction(
        form({
          buyer_whatsapp: "0712345678",
          buyer_name: "Buyer Test",
          buyer_phone: "0712345678",
          delivery_address: "1 Test Road",
          listing_id: "listing-1",
          suburb: "Berea"
        })
      )
    ).rejects.toThrow(/NEXT_REDIRECT:\/checkout\/listing-1\?error=/);

    expect(checkout.orderInsert).not.toHaveBeenCalled();
  });

  it("signs users out through both POST and GET sign-out routes", async () => {
    const postClient = mockAuthClient();
    const postResponse = await POST(new Request("https://thumeka.test/auth/sign-out"));

    expect(postClient.auth.signOut).toHaveBeenCalledTimes(1);
    expect(postResponse.status).toBe(307);
    expect(postResponse.headers.get("location")).toBe("https://thumeka.test/auth/sign-in");

    const getClient = mockAuthClient();
    const getResponse = await GET(new Request("https://thumeka.test/auth/sign-out"));

    expect(getClient.auth.signOut).toHaveBeenCalledTimes(1);
    expect(getResponse.status).toBe(307);
  });
});