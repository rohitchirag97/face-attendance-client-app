import React, { useState } from "react";
import { Loader2, PauseCircle, PlayCircle, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/form-kit";
import { useOrganizationLifecycle, type OrganizationLifecycleAction } from "@/hooks/use-api";
import type { Organization } from "@/lib/session";

const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";

const inputClass =
  "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20";

/**
 * Owner controls to pause, reactivate, delete or un-delete an organization. Deleting locks the
 * workspace at once and erases it permanently after 30 days; the owner can cancel until then.
 */
const OrganizationDangerZone: React.FC<{ organization: Organization; onChanged?: () => void }> = ({
  organization,
  onChanged,
}) => {
  const lifecycle = useOrganizationLifecycle();
  const [confirming, setConfirming] = useState<"deactivate" | "delete" | null>(null);
  const [typedName, setTypedName] = useState("");

  const run = (action: OrganizationLifecycleAction, confirmName?: string) =>
    lifecycle.mutate(
      { organizationId: organization.id, action, confirmName },
      {
        onSuccess: () => {
          setConfirming(null);
          setTypedName("");
          onChanged?.();
        },
      },
    );
  const busy = lifecycle.isPending;
  const pendingDeletion = organization.status === "pending_deletion";
  const paused = !organization.isActive;

  if (pendingDeletion) {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          <strong>{organization.name}</strong> will be permanently deleted on{" "}
          <strong>{formatDate(organization.deletionScheduledAt)}</strong>. Until then nobody can use it, and you can still
          cancel.
        </p>
        <Button variant="outline" disabled={busy} onClick={() => run("cancel-deletion")}>
          {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />} Cancel deletion
        </Button>
        <ErrorText message={lifecycle.error?.message ?? null} />
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border border-destructive/30">
      <div className="flex flex-wrap items-start gap-3 p-4">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-sm font-medium">{paused ? "Reactivate organization" : "Deactivate organization"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {paused
              ? `Paused since ${formatDate(organization.deactivatedAt)}. Reactivating restores access for everyone.`
              : "Pause the workspace: members lose access and kiosks stop recording attendance. Nothing is deleted, and you can reactivate it at any time."}
          </p>
        </div>
        {paused ? (
          <Button variant="outline" disabled={busy} onClick={() => run("reactivate")}>
            {busy ? <Loader2 className="animate-spin" /> : <PlayCircle />} Reactivate
          </Button>
        ) : confirming === "deactivate" ? (
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(null)}>Keep active</Button>
            <Button variant="destructive" disabled={busy} onClick={() => run("deactivate")}>
              {busy ? <Loader2 className="animate-spin" /> : <PauseCircle />} Yes, deactivate
            </Button>
          </div>
        ) : (
          <Button variant="outline" disabled={busy} onClick={() => setConfirming("deactivate")}>
            <PauseCircle /> Deactivate
          </Button>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-sm font-medium text-destructive">Delete organization</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Locks the workspace now and permanently erases all employees, attendance, payroll, documents and history
              after 30 days. You can cancel within those 30 days. Download any reports you need to keep first.
            </p>
          </div>
          {confirming !== "delete" && (
            <Button variant="destructive" disabled={busy} onClick={() => setConfirming("delete")}>
              <Trash2 /> Delete
            </Button>
          )}
        </div>
        {confirming === "delete" && (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              run("schedule-deletion", typedName);
            }}
          >
            <label htmlFor="confirm-organization-name" className="text-sm">
              Type <strong>{organization.name}</strong> to confirm
            </label>
            <input
              id="confirm-organization-name"
              autoComplete="off"
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              className={inputClass}
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => { setConfirming(null); setTypedName(""); }}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={busy || typedName.trim() !== organization.name.trim()}>
                {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete in 30 days
              </Button>
            </div>
          </form>
        )}
      </div>
      <ErrorText message={lifecycle.error?.message ?? null} />
    </div>
  );
};

export default OrganizationDangerZone;
