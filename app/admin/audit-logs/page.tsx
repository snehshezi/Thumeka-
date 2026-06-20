import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, FileClock } from "lucide-react";

import { AdminPager } from "@/components/admin-pager";
import { requireRole } from "@/lib/auth";
import type { AuditLogRow } from "@/lib/database.types";
import { formatWaitingSince, titleCase } from "@/lib/format";
import {
  AUDIT_LOGS_PAGE_SIZE,
  pageCount,
  pageRange,
  readPageParam
} from "@/lib/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Audit logs"
};

export const dynamic = "force-dynamic";

type AuditLogsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

type AuditLogWithActor = AuditLogRow & {
  actor: { full_name: string | null; email: string } | null;
};

export default async function AuditLogsPage({
  searchParams
}: AuditLogsPageProps) {
  await requireRole(["admin"]);

  const params = await searchParams;
  const page = readPageParam(params.page);
  const [from, to] = pageRange(page, AUDIT_LOGS_PAGE_SIZE);

  const supabase = await createSupabaseServerClient();
  const { data, count } = await supabase
    .from("audit_logs")
    .select("*, actor:profiles!audit_logs_actor_user_id_fkey ( full_name, email )", {
      count: "exact"
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  const logs = (data ?? []) as AuditLogWithActor[];
  const totalPages = pageCount(count, AUDIT_LOGS_PAGE_SIZE);

  return (
    <div className="bg-mist" data-testid="page-admin-audit-logs">
      <section className="section-band">
        <div className="page-shell gap-3 py-8">
          <Link
            className="inline-flex items-center gap-1 text-body-sm font-semibold text-leaf hover:underline"
            data-testid="audit-logs-back-link"
            href="/admin/dashboard"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-mint text-leaf">
              <FileClock aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-display-md text-ink">Audit logs</h1>
              <p className="text-body-sm text-black/55">
                {count ?? 0} total
                {count != null && count > 0
                  ? ` · showing ${from + 1}–${Math.min(to + 1, count)}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-8">
        {logs.length ? (
          <>
            {/* Desktop table */}
            <div
              className="hidden overflow-hidden rounded-lg border border-black/10 bg-white md:block"
              data-testid="audit-logs-table"
            >
              <table className="w-full text-body-sm">
                <thead className="bg-mist text-caption uppercase tracking-widest text-black/45">
                  <tr>
                    <th className="px-4 py-2 text-left">When</th>
                    <th className="px-4 py-2 text-left">Actor</th>
                    <th className="px-4 py-2 text-left">Action</th>
                    <th className="px-4 py-2 text-left">Entity</th>
                    <th className="px-4 py-2 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      className="border-t border-black/5 align-top"
                      data-testid="audit-logs-row"
                      key={log.id}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-black/70">
                        <span title={log.created_at}>
                          {formatWaitingSince(log.created_at)} ago
                        </span>
                      </td>
                      <td className="px-4 py-3 text-black/70">
                        {log.actor?.full_name ?? log.actor?.email ?? "—"}
                        {log.actor_role ? (
                          <span className="ml-1 text-caption text-black/45">
                            ({log.actor_role})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {titleCase(log.action)}
                      </td>
                      <td className="px-4 py-3 text-black/70">
                        <span className="font-medium">
                          {titleCase(log.entity_type)}
                        </span>
                        {log.entity_id ? (
                          <span className="ml-1 font-mono text-caption text-black/45">
                            {log.entity_id.slice(0, 8)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-black/60">
                        {log.note ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <ul className="space-y-3 md:hidden" data-testid="audit-logs-list">
              {logs.map((log) => (
                <li
                  className="rounded-lg border border-black/10 bg-white p-4"
                  data-testid="audit-logs-card"
                  key={log.id}
                >
                  <div className="flex items-center justify-between text-caption text-black/45">
                    <span title={log.created_at}>
                      {formatWaitingSince(log.created_at)} ago
                    </span>
                    {log.actor_role ? <span>{log.actor_role}</span> : null}
                  </div>
                  <p className="mt-1 font-semibold text-ink">
                    {titleCase(log.action)}
                  </p>
                  <p className="mt-1 text-body-sm text-black/70">
                    {titleCase(log.entity_type)}
                    {log.entity_id ? (
                      <span className="ml-1 font-mono text-caption text-black/45">
                        {log.entity_id.slice(0, 8)}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-body-sm text-black/60">
                    by {log.actor?.full_name ?? log.actor?.email ?? "—"}
                  </p>
                  {log.note ? (
                    <p className="mt-2 text-body-sm text-black/60">{log.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>

            <AdminPager
              basePath="/admin/audit-logs"
              currentPage={page}
              pageCount={totalPages}
              pageParam="page"
              testIdPrefix="audit-logs-pager"
            />
          </>
        ) : (
          <div
            className="rounded-lg border border-dashed border-black/15 bg-white p-8 text-center"
            data-testid="audit-logs-empty"
          >
            <p className="text-body text-black/55">
              No audit log entries yet.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
