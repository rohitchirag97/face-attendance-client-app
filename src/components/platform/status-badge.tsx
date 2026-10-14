import type { PlatformOrganizationStatus } from "@/lib/platform";

const label: Record<PlatformOrganizationStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  pending_deletion: "Pending deletion",
};

const styles: Record<PlatformOrganizationStatus, string> = {
  active: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  suspended: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  pending_deletion: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export function StatusBadge({ status }: { status: PlatformOrganizationStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      <span className="mr-1.5 size-1.5 rounded-full bg-current" />
      {label[status]}
    </span>
  );
}
