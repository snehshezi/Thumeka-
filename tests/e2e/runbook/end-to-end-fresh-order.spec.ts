import { expect, test, type Page } from "@playwright/test";

import {
  createProductDeliveryDbFlow,
  productDeliveryE2EListing,
  productDeliveryE2ESettings
} from "@/tests/helpers/product-delivery-db-flow";
import {
  resetLocalSupabaseSeed,
  seedLocalSupabase
} from "@/tests/helpers/seed";
import { loadTestEnvFile } from "@/tests/helpers/supabase-env";
import { testUsers, type TestUser } from "@/tests/fixtures/users";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true
});

async function signInAs(page: Page, user: TestUser, landingTestId: string) {
  await page.goto("/auth/sign-in");
  await page.getByTestId("sign-in-email-input").fill(user.email);
  await page.getByTestId("sign-in-password-input").fill(user.password);
  await page.getByTestId("sign-in-submit-button").click();
  await expect(page.getByTestId(landingTestId)).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByTestId("sign-out-button").click();
  await expect(page.getByTestId("page-sign-in")).toBeVisible();
}

async function forceSignOut(page: Page) {
  await page.goto("/auth/sign-out");
  await expect(page.getByTestId("page-sign-in")).toBeVisible();
}

function buyerOrderCard(page: Page, orderId: string) {
  return page
    .getByTestId("buyer-order-card")
    .filter({ hasText: orderId.slice(0, 8) })
    .first();
}

test.describe("mobile product delivery flow", () => {
  test.describe.configure({ mode: "serial" });

  test("covers application submissions and approval gates", async ({
    page
  }, testInfo) => {
    test.setTimeout(60_000);
    test.skip(
      testInfo.project.name !== "chromium-mobile",
      "Application flow coverage uses the mobile Playwright project"
    );

    loadTestEnvFile();
    const seed = await seedLocalSupabase();
    const flow = createProductDeliveryDbFlow(seed);

    try {
      await flow.preparePendingApprovals();
      await signInAs(page, testUsers.provider, "page-provider-status");
      await expect(page.getByTestId("provider-status-card")).toContainText("Pending");
      await expect(page.getByTestId("provider-open-dashboard-link")).toHaveCount(0);

      await page.goto("/provider/dashboard");
      await expect(
        page.getByTestId("page-provider-dashboard-approval-required")
      ).toBeVisible();

      await page.goto("/provider/apply");
      await page.getByTestId("provider-business-name-input").fill("Updated Test Kitchen");
      await page.getByTestId("provider-type-input").selectOption("business");
      await page
        .getByTestId("provider-description-input")
        .fill("Updated provider application details.");
      await page.getByTestId("provider-suburb-input").fill("Morningside");
      await page.getByTestId("provider-address-input").fill("9 Test Road, Morningside");
      await page.getByTestId("provider-bank-account-name-input").fill("Provider Test");
      await page.getByTestId("provider-bank-name-input").fill("Test Bank");
      await page.getByTestId("provider-bank-account-number-input").fill("1234567890");
      await page.getByTestId("provider-bank-branch-code-input").fill("123456");
      // Required documents are now enforced — upload a tiny PDF into each slot
      // and wait for the storage round trip before submitting.
      const fakePdf = Buffer.from("%PDF-1.4 e2e provider doc\n%%EOF");
      for (const slot of ["id_document", "proof_of_address", "bank_confirmation"]) {
        await page
          .getByTestId(`document-slot-${slot}-file-input`)
          .setInputFiles({ name: `${slot}.pdf`, mimeType: "application/pdf", buffer: fakePdf });
        await expect(
          page.getByTestId(`document-slot-${slot}-status`)
        ).toHaveAttribute("data-status", "uploaded", { timeout: 15000 });
      }
      await page.getByTestId("provider-apply-submit-button").click();
      await expect(page.getByTestId("page-provider-status")).toBeVisible();
      await expect(page.getByTestId("provider-status-card")).toContainText("Pending");

      await forceSignOut(page);
      await signInAs(page, testUsers.driver, "page-driver-status");
      await expect(page.getByTestId("driver-status-card")).toContainText("Pending");
      await expect(page.getByTestId("driver-open-dashboard-link")).toHaveCount(0);

      await page.goto("/driver/dashboard");
      await expect(page.getByTestId("page-driver-dashboard-approval-required")).toBeVisible();

      await page.goto("/driver/apply");
      await page.getByTestId("driver-vehicle-type-input").fill("Motorbike");
      await page.getByTestId("driver-vehicle-licence-number-input").fill("ND 123 456");
      await page.getByTestId("driver-bank-account-name-input").fill("Driver Test");
      await page.getByTestId("driver-bank-name-input").fill("Test Bank");
      await page.getByTestId("driver-bank-account-number-input").fill("9876543210");
      await page.getByTestId("driver-bank-branch-code-input").fill("654321");
      const fakeDriverPdf = Buffer.from("%PDF-1.4 e2e driver doc\n%%EOF");
      for (const slot of [
        "id_document",
        "drivers_licence",
        "vehicle_licence_disc",
        "bank_confirmation"
      ]) {
        await page
          .getByTestId(`document-slot-${slot}-file-input`)
          .setInputFiles({ name: `${slot}.pdf`, mimeType: "application/pdf", buffer: fakeDriverPdf });
        await expect(
          page.getByTestId(`document-slot-${slot}-status`)
        ).toHaveAttribute("data-status", "uploaded", { timeout: 15000 });
      }
      await page.getByTestId("driver-apply-submit-button").click();
      await expect(page.getByTestId("page-driver-status")).toBeVisible();
      await expect(page.getByTestId("driver-status-card")).toContainText("Pending");

      await forceSignOut(page);
      await signInAs(page, testUsers.buyer, "page-buyer-orders");
      await page.goto("/admin/dashboard");
      await expect(page.getByTestId("page-buyer-orders")).toBeVisible();
    } finally {
      await resetLocalSupabaseSeed();
    }
  });

  test("covers admin rejection paths for provider and driver applications", async ({
    page
  }, testInfo) => {
    test.setTimeout(60_000);
    test.skip(
      testInfo.project.name !== "chromium-mobile",
      "Admin rejection coverage uses the mobile Playwright project"
    );

    loadTestEnvFile();
    const seed = await seedLocalSupabase();
    const flow = createProductDeliveryDbFlow(seed);

    try {
      await flow.preparePendingApprovals();
      await signInAs(page, testUsers.admin, "page-admin-dashboard");

      const provider = page
        .getByTestId("admin-provider-approval-card")
        .filter({ hasText: seed.providerProfile.business_name ?? "Thumeka Test Kitchen" })
        .first();
      await provider
        .getByTestId("admin-provider-rejection-reason-input")
        .fill("Missing provider verification");
      await Promise.all([
        page.waitForURL(/\/admin\/dashboard\?provider_rejected=/),
        provider.getByTestId("admin-reject-provider-button").click()
      ]);
      await expect(page.getByTestId("admin-provider-rejected-message")).toBeVisible();
      expect((await flow.getProviderProfile(seed.providerProfile.id)).status).toBe(
        "rejected"
      );

      const driver = page
        .getByTestId("admin-driver-approval-card")
        .filter({ hasText: seed.driverProfile.vehicle_type ?? "Car" })
        .first();
      await driver
        .getByTestId("admin-driver-rejection-reason-input")
        .fill("Missing driver verification");
      await Promise.all([
        page.waitForURL(/\/admin\/dashboard\?driver_rejected=/),
        driver.getByTestId("admin-reject-driver-button").click()
      ]);
      await expect(page.getByTestId("admin-driver-rejected-message")).toBeVisible();
      expect((await flow.getDriverProfile(seed.driverProfile.id)).approval_status).toBe(
        "rejected"
      );
    } finally {
      await resetLocalSupabaseSeed();
    }
  });

  test("completes product delivery from provider approval to payout eligibility", async ({
    page
  }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(
      testInfo.project.name !== "chromium-mobile",
      "Product delivery E2E is intentionally run with the mobile Playwright project"
    );

    loadTestEnvFile();
    const seed = await seedLocalSupabase();
    const flow = createProductDeliveryDbFlow(seed);

    try {
      await flow.preparePendingApprovals();
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });

      await test.step("admin approves provider", async () => {
        await signInAs(page, testUsers.admin, "page-admin-dashboard");

        const provider = page
          .getByTestId("admin-provider-approval-card")
          .filter({ hasText: seed.providerProfile.business_name ?? "Thumeka Test Kitchen" })
          .first();
        await Promise.all([
          page.waitForURL(/\/admin\/dashboard\?provider_approved=/),
          provider.getByTestId("admin-approve-provider-button").click()
        ]);
        await expect(page.getByTestId("admin-provider-approved-message")).toBeVisible();

        const approvedProvider = await flow.getProviderProfile(seed.providerProfile.id);
        expect(approvedProvider.status).toBe("approved");
      });

      let listingId = "";

      await test.step("provider creates product listing", async () => {
        await signOut(page);
        await signInAs(page, testUsers.provider, "page-provider-status");
        await page.getByTestId("provider-open-dashboard-link").click();
        await expect(page.getByTestId("page-provider-dashboard")).toBeVisible();

        // Switch to the Listings tab — create-listing lives there now.
        await page.getByTestId("tab-listings").click();
        await page.getByTestId("provider-create-listing-toggle").click();
        await page
          .getByTestId("provider-listing-title-input")
          .fill(productDeliveryE2EListing.title);
        await page
          .getByTestId("provider-listing-description-input")
          .fill(productDeliveryE2EListing.description);
        await page
          .getByTestId("provider-listing-category-select")
          .selectOption({ label: "Food" });
        await page
          .getByTestId("provider-listing-type-select")
          .selectOption(productDeliveryE2EListing.listing_type);
        await page
          .getByTestId("provider-listing-price-input")
          .fill(String(productDeliveryE2EListing.price));
        await page
          .getByTestId("provider-listing-suburb-input")
          .fill(productDeliveryE2EListing.suburb);
        await page
          .getByTestId("provider-listing-fulfillment-address-input")
          .fill("1 Test Road, Berea");
        await Promise.all([
          page.waitForURL(/\/provider\/dashboard\?listing_created=/),
          page.getByTestId("provider-create-listing-button").click()
        ]);
        await expect(page.getByTestId("provider-listing-created-message")).toBeVisible();
        listingId = new URL(page.url()).searchParams.get("listing_created") ?? "";
        expect(listingId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );

        await page.goto(`/listings/${listingId}`);
        await expect(page.getByTestId("listing-detail-card")).toContainText(
          productDeliveryE2EListing.title
        );
      });

      await test.step("admin approves driver", async () => {
        await page.goto("/provider/status");
        await signOut(page);
        await signInAs(page, testUsers.admin, "page-admin-dashboard");

        const driver = page
          .getByTestId("admin-driver-approval-card")
          .filter({ hasText: seed.driverProfile.vehicle_type ?? "Car" })
          .first();
        await Promise.all([
          page.waitForURL(/\/admin\/dashboard\?driver_approved=/),
          driver.getByTestId("admin-approve-driver-button").click()
        ]);
        await expect(page.getByTestId("admin-driver-approved-message")).toBeVisible();

        const approvedDriver = await flow.getDriverProfile(seed.driverProfile.id);
        expect(approvedDriver.approval_status).toBe("approved");
      });

      await test.step("driver becomes available", async () => {
        await signOut(page);
        await signInAs(page, testUsers.driver, "page-driver-status");
        await page.getByTestId("driver-open-dashboard-link").click();
        await expect(page.getByTestId("page-driver-dashboard")).toBeVisible();

        await Promise.all([
          page.waitForURL(/\/driver\/dashboard\?availability=available/),
          page.getByTestId("driver-set-available-button").click()
        ]);
        await expect(page.getByTestId("driver-availability-updated-message")).toBeVisible();

        const driver = await flow.getDriverProfile(seed.driverProfile.id);
        expect(driver.availability_status).toBe("available");
      });

      let orderId = "";

      await test.step("buyer places order request", async () => {
        await signOut(page);
        await signInAs(page, testUsers.buyer, "page-buyer-orders");
        await page.goto(`/listings/${listingId}`);
        await page.getByTestId("listing-request-order-link").click();

        await expect(page.getByTestId("page-checkout")).toBeVisible();
        await page
          .getByTestId("checkout-suburb-input")
          .fill("Berea");
        await page
          .getByTestId("checkout-delivery-address-input")
          .fill("1 Test Road, Berea");
        await page
          .getByTestId("checkout-buyer-notes-input")
          .fill("Please deliver to reception.");

        // Delivery fee is quoted and shown before the buyer can submit.
        await page.getByTestId("checkout-calculate-delivery-button").click();
        await expect(page.getByTestId("checkout-delivery-fee")).toContainText("70");
        await expect(page.getByTestId("checkout-order-total")).toContainText("320");

        await page.getByTestId("checkout-submit-button").click();

        await expect(page.getByTestId("page-buyer-orders")).toBeVisible();
        await expect(page.getByText("Order request created")).toBeVisible();
        orderId = new URL(page.url()).searchParams.get("created") ?? "";

        expect(orderId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );

        const card = buyerOrderCard(page, orderId);
        await expect(card).toContainText("Order Requested");
        await expect(card.getByTestId("buyer-order-eft-instructions")).toHaveCount(0);
      });

      await test.step("provider accepts the order at the fee quoted at checkout", async () => {
        await signOut(page);
        await signInAs(page, testUsers.provider, "page-provider-status");
        await page.getByTestId("provider-open-dashboard-link").click();
        await expect(page.getByTestId("page-provider-dashboard")).toBeVisible();

        const card = page
          .getByTestId("provider-order-card")
          .filter({ hasText: orderId.slice(0, 8) })
          .first();
        await expect(card).toContainText("Order Requested");
        await card.click();

        // Fee was locked at checkout, so the drawer shows no distance input.
        const drawer = page.getByTestId("provider-order-drawer");
        await expect(drawer).toBeVisible();
        await expect(drawer.getByTestId("provider-order-distance-input")).toHaveCount(0);
        await Promise.all([
          page.waitForURL(/\/provider\/dashboard\?accepted=/),
          drawer.getByTestId("provider-order-accept-button").click()
        ]);
        await expect(page.getByTestId("provider-order-accepted-message")).toBeVisible();
        await expect(
          page
            .getByTestId("provider-order-card")
            .filter({ hasText: orderId.slice(0, 8) })
            .first()
        ).toContainText("Awaiting Buyer Eft");

        const order = await flow.getOrder(orderId);

        expect(order.status).toBe("awaiting_buyer_eft");
        expect(order.payment_status).toBe("awaiting_buyer_eft");
        expect(Number(order.delivery_fee)).toBe(70);
        expect(Number(order.buyer_total)).toBe(320);
      });

      await test.step("buyer sees EFT instructions", async () => {
        await signOut(page);
        await signInAs(page, testUsers.buyer, "page-buyer-orders");

        const card = buyerOrderCard(page, orderId);
        await expect(card).toContainText("Awaiting Buyer Eft");
        await expect(card.getByTestId("buyer-order-eft-instructions")).toContainText(
          productDeliveryE2ESettings.eft_payment_instructions
        );
      });

      await test.step("admin confirms EFT and transaction records are created", async () => {
        await signOut(page);
        await signInAs(page, testUsers.admin, "page-admin-dashboard");
        // Operational orders live on the Operations tab.
        await page.goto("/admin/dashboard?tab=operations");

        const adminOrder = page
          .getByTestId("admin-order-card")
          .filter({ hasText: orderId.slice(0, 8) })
          .first();
        await expect(adminOrder).toContainText("Awaiting Buyer Eft");
        await adminOrder
          .getByTestId("admin-payment-reference-input")
          .fill("E2E-EFT-001");
        await Promise.all([
          page.waitForURL(/\/admin\/dashboard\?eft_confirmed=/),
          adminOrder.getByTestId("admin-confirm-eft-button").click()
        ]);
        await expect(page.getByTestId("admin-eft-confirmed-message")).toBeVisible();

        const order = await flow.getOrder(orderId);
        const transactions = await flow.getTransactions(orderId);

        expect(order.status).toBe("payment_confirmed");
        expect(order.payment_status).toBe("confirmed");
        expect(transactions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              transaction_type: "buyer_eft_confirmed"
            }),
            expect.objectContaining({
              transaction_type: "platform_commission"
            }),
            expect.objectContaining({
              transaction_type: "provider_earning"
            }),
            expect.objectContaining({
              transaction_type: "driver_earning"
            })
          ])
        );
        expect(
          transactions.map((transaction) => Number(transaction.amount))
        ).toEqual(expect.arrayContaining([320, 30, 220, 70]));
      });

      await test.step("admin assigns driver", async () => {
        // The previous step's redirect dropped us back on Approvals.
        await page.goto("/admin/dashboard?tab=operations");
        const adminOrder = page
          .getByTestId("admin-order-card")
          .filter({ hasText: orderId.slice(0, 8) })
          .first();
        await adminOrder
          .getByTestId("admin-assign-driver-select")
          .selectOption(seed.driverProfile.id);
        await Promise.all([
          page.waitForURL(/\/admin\/dashboard\?driver_assigned=/),
          adminOrder.getByTestId("admin-assign-driver-button").click()
        ]);
        await expect(page.getByTestId("admin-driver-assigned-message")).toBeVisible();
        await expect(adminOrder).toContainText("Driver Assigned");

        const order = await flow.getOrder(orderId);

        expect(order.status).toBe("driver_assigned");
        expect(order.driver_id).toBe(seed.driverProfile.id);
      });

      await test.step("driver marks picked up", async () => {
        await signOut(page);
        await signInAs(page, testUsers.driver, "page-driver-status");
        await page.getByTestId("driver-open-dashboard-link").click();
        await expect(page.getByTestId("page-driver-dashboard")).toBeVisible();
        await expect(page.getByTestId("driver-deliveries-count-card")).toContainText("1");

        const delivery = page
          .getByTestId("driver-delivery-card")
          .filter({ hasText: orderId.slice(0, 8) })
          .first();
        await Promise.all([
          page.waitForURL(/\/driver\/dashboard\?delivery_updated=.*status=picked_up/),
          delivery.getByTestId("driver-mark-picked-up-button").click()
        ]);
        await expect(page.getByTestId("driver-delivery-updated-message")).toBeVisible();
        await expect(delivery).toContainText("Picked Up");

        const order = await flow.getOrder(orderId);
        expect(order.status).toBe("picked_up");
      });

      await test.step("driver marks out for delivery", async () => {
        const delivery = page
          .getByTestId("driver-delivery-card")
          .filter({ hasText: orderId.slice(0, 8) })
          .first();
        await Promise.all([
          page.waitForURL(/\/driver\/dashboard\?delivery_updated=.*status=out_for_delivery/),
          delivery.getByTestId("driver-mark-out-for-delivery-button").click()
        ]);
        await expect(page.getByTestId("driver-delivery-updated-message")).toBeVisible();
        await expect(delivery).toContainText("Out For Delivery");

        const order = await flow.getOrder(orderId);

        expect(order.status).toBe("out_for_delivery");
        expect(await flow.isOrderPayoutEligible(orderId)).toBe(false);
      });

      await test.step("driver completes delivery and order becomes completed", async () => {
        const delivery = page
          .getByTestId("driver-delivery-card")
          .filter({ hasText: orderId.slice(0, 8) })
          .first();
        await Promise.all([
          page.waitForURL(/\/driver\/dashboard\?delivery_updated=.*status=completed/),
          delivery.getByTestId("driver-complete-delivery-button").click()
        ]);
        await expect(page.getByTestId("driver-delivery-updated-message")).toBeVisible();
        await expect(delivery).toContainText("Completed");

        const order = await flow.getOrder(orderId);

        expect(order.status).toBe("completed");
        expect(order.completed_at).toBeTruthy();
      });

      await test.step("provider and driver earnings are created", async () => {
        const transactions = await flow.getTransactions(orderId);

        expect(transactions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              transaction_type: "provider_earning"
            }),
            expect.objectContaining({
              transaction_type: "driver_earning"
            })
          ])
        );
        expect(
          transactions.map((transaction) => Number(transaction.amount))
        ).toEqual(expect.arrayContaining([220, 70]));
      });

      await test.step("payout eligibility is correct", async () => {
        expect(await flow.isOrderPayoutEligible(orderId)).toBe(true);

        await signOut(page);
        await signInAs(page, testUsers.admin, "page-admin-dashboard");
        // Payout cards live on the Operations tab.
        await page.goto("/admin/dashboard?tab=operations");

        const payout = page
          .getByTestId("admin-payout-card")
          .filter({ hasText: orderId.slice(0, 8) })
          .first();
        await expect(payout).toContainText("Provider earning ready for payout");
        await Promise.all([
          page.waitForURL(/\/admin\/dashboard\?payout_created=/),
          payout.getByTestId("admin-create-payout-button").click()
        ]);
        await expect(page.getByTestId("admin-payout-created-message")).toBeVisible();
        expect(await flow.isOrderPayoutEligible(orderId)).toBe(false);
      });

      await test.step("order status notification timeline is complete", async () => {
        const statusEvents = await flow.getOrderStatusEvents(orderId);

        expect(statusEvents).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              new_status: "order_requested",
              note: "Buyer submitted order request"
            }),
            expect.objectContaining({
              old_status: "order_requested",
              new_status: "awaiting_buyer_eft",
              note: "Provider accepted order"
            }),
            expect.objectContaining({
              old_status: "awaiting_buyer_eft",
              new_status: "payment_confirmed",
              note: "Admin confirmed EFT"
            }),
            expect.objectContaining({
              old_status: "payment_confirmed",
              new_status: "driver_assigned",
              note: "Admin assigned driver"
            }),
            expect.objectContaining({
              old_status: "driver_assigned",
              new_status: "picked_up",
              note: "Driver marked order picked up"
            }),
            expect.objectContaining({
              old_status: "picked_up",
              new_status: "out_for_delivery",
              note: "Driver marked order out for delivery"
            }),
            expect.objectContaining({
              old_status: "out_for_delivery",
              new_status: "completed",
              note: "Driver marked order completed"
            })
          ])
        );
      });

      await test.step("audit logs exist for admin actions", async () => {
        const auditActions = await flow.getAuditActions(orderId);

        expect(auditActions).toEqual(
          expect.arrayContaining([
            "provider_approved",
            "driver_approved",
            "eft_payment_confirmed",
            "driver_assigned",
            "provider_payout_created"
          ])
        );
      });

      await test.step("buyer sees completed order", async () => {
        await signOut(page);
        await signInAs(page, testUsers.buyer, "page-buyer-orders");

        await expect(buyerOrderCard(page, orderId)).toContainText("Completed");
      });
    } finally {
      await resetLocalSupabaseSeed();
    }
  });
});
