import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth";
import { roleHomePath } from "@/lib/routes";

export default async function DashboardRedirectPage() {
  const { profile } = await requireProfile();
  redirect(roleHomePath(profile.role));
}
