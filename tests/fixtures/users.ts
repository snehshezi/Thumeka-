import type { AppRole } from "@/lib/constants";

export type TestUser = {
  authUserId: string;
  profileId: string;
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: AppRole;
};

export const testUsers = {
  buyer: {
    authUserId: "10000000-0000-4000-8000-000000000001",
    profileId: "20000000-0000-4000-8000-000000000001",
    email: "buyer.test@thumeka.local",
    password: "Thumeka-test-123",
    fullName: "Buyer Test",
    phone: "+27810000001",
    role: "buyer"
  },
  otherBuyer: {
    authUserId: "10000000-0000-4000-8000-000000000005",
    profileId: "20000000-0000-4000-8000-000000000005",
    email: "other-buyer.test@thumeka.local",
    password: "Thumeka-test-123",
    fullName: "Other Buyer Test",
    phone: "+27810000005",
    role: "buyer"
  },
  provider: {
    authUserId: "10000000-0000-4000-8000-000000000002",
    profileId: "20000000-0000-4000-8000-000000000002",
    email: "provider.test@thumeka.local",
    password: "Thumeka-test-123",
    fullName: "Provider Test",
    phone: "+27810000002",
    role: "provider"
  },
  pendingProvider: {
    authUserId: "10000000-0000-4000-8000-000000000006",
    profileId: "20000000-0000-4000-8000-000000000006",
    email: "pending-provider.test@thumeka.local",
    password: "Thumeka-test-123",
    fullName: "Pending Provider Test",
    phone: "+27810000006",
    role: "provider"
  },
  driver: {
    authUserId: "10000000-0000-4000-8000-000000000003",
    profileId: "20000000-0000-4000-8000-000000000003",
    email: "driver.test@thumeka.local",
    password: "Thumeka-test-123",
    fullName: "Driver Test",
    phone: "+27810000003",
    role: "driver"
  },
  admin: {
    authUserId: "10000000-0000-4000-8000-000000000004",
    profileId: "20000000-0000-4000-8000-000000000004",
    email: "admin@thumeka.co.za",
    password: "Thumeka-test-123",
    fullName: "Admin Test",
    phone: "+27810000004",
    role: "admin"
  }
} satisfies Record<string, TestUser>;
