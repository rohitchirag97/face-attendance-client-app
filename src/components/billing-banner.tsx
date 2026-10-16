import React, { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Sparkles, X } from "lucide-react";
import { billingStatusQuery, formatDay } from "@/hooks/use-billing";
import { isOrganizationOwner } from "@/lib/session";

const dismissKey = (organizationId: string) => `billing-banner-dismissed:${organizationId}`;

const readDismissed = (organizationId: string) => {
  try {
    return sessionStorage.getItem(dismissKey(organizationId)) === "1";
  } catch {
    return false;
  }
};

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

type Tone = "info" | "warning" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  info: "border-primary/20 bg-primary/5 text-foreground",
  warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
  danger: "border-red-300 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200",
};

/**
 * Trial and plan status for the organization owner only; other members never see it.
 * Only the early-trial and renewal notices can be closed, and only for this browser session.
 */
const BillingBanner: React.FC<{ organizationId: string | null }> = ({ organizationId }) => {
  const isOwner = isOrganizationOwner(organizationId);
  const { data } = useQuery({ ...billingStatusQuery(organizationId ?? ""), enabled: Boolean(organizationId && isOwner) });
  const [dismissed, setDismissed] = useState(() => (organizationId ? readDismissed(organizationId) : false));

  // Before the trial starts the whole workspace shows the activation screen instead (TrialGate).
  if (!organizationId || !isOwner || !data || data.state === "inactive") return null;

  let tone: Tone;
  let message: string;
  let action: string;
  let canDismiss = false;
  if (data.state === "trial") {
    tone = data.daysLeft > 3 ? "info" : "warning";
    canDismiss = data.daysLeft > 3;
    message = data.daysLeft === 0 ? "Your free trial ends today." : `${days(data.daysLeft)} left in your free trial.`;
    action = "Upgrade";
  } else if (data.state === "paid") {
    if (data.daysLeft > 5) return null;
    tone = "info";
    canDismiss = true;
    message = `Your plan is paid until ${formatDay(data.accessEndsAt)}. Renew to keep full access.`;
    action = "Renew";
  } else if (data.state === "grace") {
    tone = "danger";
    message = `Your ${data.paidUntil ? "plan" : "free trial"} has ended. Upgrade to keep running payroll. Your workspace becomes read-only ${data.daysLeft === 0 ? "later today" : `in ${days(data.daysLeft)}`}.`;
    action = "Upgrade now";
  } else {
    tone = "danger";
    message = "Your workspace is read-only. Payroll and new employees are paused until you upgrade. Attendance is still being recorded.";
    action = "Upgrade now";
  }
  if (canDismiss && dismissed) return null;

  const Icon = tone === "danger" ? AlertTriangle : tone === "warning" ? Clock : Sparkles;
  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(dismissKey(organizationId), "1");
    } catch {
      // The banner simply returns on the next page load.
    }
  };

  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex items-center gap-3 border-b px-4 py-2.5 text-sm md:px-6 ${TONE_CLASS[tone]}`}>
      <Icon className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">{message}</p>
      <Link
        to="/billing"
        className="shrink-0 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
      >
        {action}
      </Link>
      {canDismiss && (
        <button type="button" aria-label="Dismiss" onClick={dismiss} className="shrink-0 rounded p-1 opacity-70 hover:opacity-100">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
};

export default BillingBanner;
