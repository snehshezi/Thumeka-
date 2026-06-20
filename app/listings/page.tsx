import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type ListingsRedirectProps = {
  searchParams: Promise<{ category?: string; q?: string }>;
};

export default async function ListingsRedirect({
  searchParams
}: ListingsRedirectProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.q) qs.set("q", params.q);
  const tail = qs.toString();
  redirect(tail ? `/?${tail}` : "/");
}
