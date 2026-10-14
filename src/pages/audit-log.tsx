import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, PageHeader, Spinner } from "@/components/form-kit";
import { formatDateTime, inputClass } from "@/lib/form-utils";
import { auditLogQuery, auditVerifyQuery } from "@/hooks/use-payroll-api";
import { canUpdateOrganization, getActiveOrganizationId } from "@/lib/session";

const Integrity: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { data, isFetching, refetch } = useQuery({ ...auditVerifyQuery(organizationId), enabled: false });
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Button type="button" size="sm" variant="outline" disabled={isFetching} onClick={() => refetch()}>
        Verify log integrity
      </Button>
      {data &&
        (data.valid ? (
          <span className="flex items-center gap-1 text-green-600">
            <ShieldCheck className="size-4" /> Intact · {data.checked} entries verified
          </span>
        ) : (
          <span className="flex items-center gap-1 text-red-600">
            <ShieldX className="size-4" /> Tampering detected at entry #{data.brokenAtSeq}
          </span>
        ))}
    </div>
  );
};

const AuditLog: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const allowed = canUpdateOrganization(organizationId);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  // Cursor stack: each entry is the `before` value used to load that page.
  const [cursors, setCursors] = useState<number[]>([]);
  const before = cursors[cursors.length - 1];

  const { data, isLoading, error } = useQuery({
    ...auditLogQuery(organizationId, { search: search.trim(), method, before }),
    enabled: allowed,
  });

  if (!allowed) return <EmptyState text="Only the super admin can view the audit log." />;

  const reset = () => setCursors([]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Audit log"
        description="A permanent, read-only record of every change made in this organization."
      />
      <Integrity organizationId={organizationId} />
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          aria-label="Search audit log"
          placeholder="Search by user, action, path or IP"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            reset();
          }}
          className={`${inputClass} min-w-56 flex-1`}
        />
        <select
          aria-label="Filter by method"
          value={method}
          onChange={(e) => {
            setMethod(e.target.value);
            reset();
          }}
          className={`${inputClass} w-40`}
        >
          <option value="">All actions</option>
          <option value="POST">Create (POST)</option>
          <option value="PATCH">Update (PATCH)</option>
          <option value="PUT">Replace (PUT)</option>
          <option value="DELETE">Delete</option>
        </select>
      </div>
      <ErrorText message={error?.message} />
      {isLoading ? (
        <Spinner />
      ) : !data?.items.length ? (
        <EmptyState text="No audit entries found." />
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-background shadow-sm">
            {data.items.map((item) => (
              <li key={item.id} className="space-y-1 p-3 text-sm">
                <p className="flex flex-wrap items-start gap-2 font-medium">
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      item.statusCode < 400 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {item.statusCode < 400 ? "Success" : "Failed"}
                  </span>
                  <span className="min-w-0 flex-1">
                    {item.summary ?? `${item.userName ?? "Unknown"} · ${item.action}`}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  #{item.seq} · {formatDateTime(item.createdAt)} · {item.userName ?? "Unknown"} ({item.role?.replace("_", " ")})
                  {item.ipAddress && ` · IP ${item.ipAddress}`}
                </p>
                <p className="break-all font-mono text-[11px] text-muted-foreground/80">
                  {item.action} · HTTP {item.statusCode}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className="mr-auto text-muted-foreground">Page {cursors.length + 1} · 5 per page</span>
            <Button
              size="sm"
              variant="outline"
              disabled={!cursors.length}
              onClick={() => setCursors((c) => c.slice(0, -1))}
            >
              Newer
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!data.nextBefore}
              onClick={() => data.nextBefore && setCursors((c) => [...c, data.nextBefore as number])}
            >
              Older
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLog;
