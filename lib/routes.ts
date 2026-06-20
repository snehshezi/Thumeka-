import type { AppRole } from "@/lib/constants";

function matchesRouteSegment(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function roleHomePath(role: AppRole) {
  switch (role) {
    case "admin":
      return "/admin/dashboard";
    case "provider":
      // Approved providers land here on sign-in; the dashboard itself
      // renders an "Approval required" gate for pending/rejected
      // providers that links them back to /provider/status.
      return "/provider/dashboard";
    case "driver":
      return "/driver/status";
    case "buyer":
    default:
      return "/buyer/orders";
  }
}

export function isProtectedPath(pathname: string) {
  return [
    "/admin",
    "/buyer",
    "/checkout",
    "/dashboard",
    "/driver",
    "/provider"
  ].some((prefix) => matchesRouteSegment(pathname, prefix));
}

export function isAuthPath(pathname: string) {
  return (
    matchesRouteSegment(pathname, "/auth/sign-in") ||
    matchesRouteSegment(pathname, "/auth/register")
  );
}
