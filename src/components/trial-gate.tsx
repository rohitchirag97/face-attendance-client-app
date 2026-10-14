import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router";
import { CalendarClock, CheckCircle2, Hourglass, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, PageSkeleton } from "@/components/form-kit";
import { billingStatusQuery, useStartTrial } from "@/hooks/use-billing";
import { getActiveOrganization } from "@/lib/session";

const INCLUDED = [
  "Attendance with face kiosks, corrections and overtime",
  "Leave, holidays and announcements",
  "Payroll with PF, ESI, professional tax and TDS",
  "Salary slips, loans and reports",
];

/**
 * Until the owner starts the free trial the server refuses the workspace's data, so this
 * shows an activation screen in place of every page. Errors fall through to the page,
 * because the server still enforces the rule on its own.
 */
const TrialGate: React.FC<{ organizationId: string | null; children: React.ReactNode }> = ({
  organizationId,
  children,
}) => {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    ...billingStatusQuery(organizationId ?? ""),
    enabled: Boolean(organizationId),
  });
  const start = useStartTrial(organizationId ?? "");
  const { pathname } = useLocation();

  if (!organizationId) return children;
  if (isPending) return <PageSkeleton />;
  // The Billing page stays open so the owner can compare plans before starting.
  if (data?.state !== "inactive" || pathname === "/billing") return children;

  const organizationName = getActiveOrganization()?.name ?? "Your workspace";

  if (!data.isOwner) {
    return (
      <div className="mx-auto mt-12 max-w-lg rounded-2xl border p-8 text-center">
        <Hourglass className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">{organizationName} is not active yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The organization owner needs to start the free trial before anyone can use this workspace. Please check
          back once they have.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 max-w-xl rounded-2xl border p-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Sparkles className="size-6" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Start your 14-day free trial</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {organizationName} is ready. Start the trial to unlock the whole workspace. No card or payment is needed.
      </p>
      <ul className="mt-5 space-y-2">
        {INCLUDED.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-5 flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
        <CalendarClock className="mt-0.5 size-4 shrink-0" />
        The trial runs for 14 days from today and can be started only once. Choose a plan from Billing any time to
        keep going after it ends.
      </p>
      <Button
        className="mt-6 h-11 w-full"
        disabled={start.isPending}
        onClick={() =>
          start.mutate(undefined, {
            // Anything that was refused while the workspace was locked is fetched again.
            onSuccess: () => void queryClient.invalidateQueries(),
          })
        }
      >
        {start.isPending && <Loader2 className="animate-spin" />}
        Start 14-day free trial
      </Button>
      <ErrorText message={start.error?.message ?? null} />
      <Link to="/billing" className="mt-4 block text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        See plans and pricing
      </Link>
    </div>
  );
};

export default TrialGate;
