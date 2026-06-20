import {
  acceptProviderOrder,
  assignDriver,
  completeDriverDelivery,
  confirmEftPayment
} from "@/lib/order-rules";
import {
  createCriticalOrderFixture,
  criticalDriver
} from "@/tests/fixtures/critical-order-flow";
import { testUsers } from "@/tests/fixtures/users";

export function createAcceptedCriticalOrder() {
  return acceptProviderOrder(
    createCriticalOrderFixture(),
    "2026-05-25T08:00:00.000Z"
  );
}

export function createPaidCriticalOrder() {
  return confirmEftPayment({
    order: createAcceptedCriticalOrder(),
    adminProfileId: testUsers.admin.profileId,
    paymentReference: "EFT-TEST-001"
  });
}

export function createAssignedCriticalOrder() {
  const { order, transactions } = createPaidCriticalOrder();

  return {
    order: assignDriver(order, criticalDriver),
    transactions
  };
}

export function createCompletedCriticalOrder() {
  const { order, transactions } = createAssignedCriticalOrder();

  return {
    order: completeDriverDelivery(order, "2026-05-25T10:30:00.000Z"),
    transactions
  };
}
