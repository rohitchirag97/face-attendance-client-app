import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Spinner } from "@/components/form-kit";
import {
  billingStatusQuery,
  formatDay,
  formatMoney,
  useRequestUpgrade,
  useStartTrial,
  type BillingPlan,
  type BillingStatus,
} from "@/hooks/use-billing";
import { getActiveOrganizationId } from "@/lib/session";

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

const STATE_TEXT: Record<BillingStatus["state"], { label: string; className: string }> = {
  inactive: { label: "Not started", className: "bg-muted text-muted-foreground" },
  trial: { label: "Free trial", className: "bg-primary/10 text-primary" },
  paid: { label: "Active", className: "bg-green-500/10 text-green-700 dark:text-green-400" },
  grace: { label: "Grace period", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  read_only: { label: "Read-only", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

const statusLine = (status: BillingStatus) => {
  switch (status.state) {
    case "inactive":
      return "Your free trial has not started yet.";
    case "trial":
      return `Your free trial ends on ${formatDay(status.trialEndsAt)} (${status.daysLeft === 0 ? "today" : `${days(status.daysLeft)} left`}). Everything is unlocked until then.`;
    case "paid":
      return `Paid until ${formatDay(status.accessEndsAt)}${status.planName ? ` on the ${status.planName} plan` : ""}.`;
    case "grace":
      return `Your ${status.paidUntil ? "plan" : "trial"} ended on ${formatDay(status.accessEndsAt)}. Everything still works ${status.daysLeft === 0 ? "until later today" : `for ${days(status.daysLeft)}`}; after that the workspace becomes read-only.`;
    case "read_only":
      return "Your workspace is read-only. You can view everything and attendance is still recorded, but payroll, new employees and sending documents are paused.";
  }
};

const priceLine = (plan: BillingPlan) => {
  const period = plan.billingPeriod === "annual" ? "year" : "month";
  const base = Number(plan.priceAmount);
  const perEmployee = Number(plan.overagePrice);
  if (base === 0 && plan.includedEmployees === 0) {
    return `${formatMoney(perEmployee, plan.currencyCode)} per employee per ${period}`;
  }
  const extra = perEmployee > 0 ? `, then ${formatMoney(perEmployee, plan.currencyCode)} per extra employee` : "";
  return `${formatMoney(base, plan.currencyCode)} per ${period} for up to ${plan.includedEmployees} employees${extra}`;
};

const BillingPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const { data, isLoading, error } = useQuery(billingStatusQuery(organizationId));
  const upgrade = useRequestUpgrade(organizationId);
  const startTrial = useStartTrial(organizationId);
  const queryClient = useQueryClient();

  if (isLoading) return <Spinner />;
  if (!data) return <ErrorText message={error?.message ?? "Could not load billing."} />;
  if (!data.owner) return <ErrorText message="Only the organization owner can manage billing." />;

  const { owner } = data;
  const state = STATE_TEXT[data.state];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">One simple price for each active employee. Prices exclude 18% GST.</p>
      </div>

      <section className="rounded-xl border p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${state.className}`}>{state.label}</span>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" /> {owner.billableEmployees} active employee{owner.billableEmployees === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-3 text-sm">{statusLine(data)}</p>
        {data.state === "inactive" && (
          <div className="mt-4">
            <Button
              disabled={startTrial.isPending}
              onClick={() => startTrial.mutate(undefined, { onSuccess: () => void queryClient.invalidateQueries() })}
            >
              {startTrial.isPending && <Loader2 className="animate-spin" />}
              Start 14-day free trial
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">Everything is unlocked for 14 days. No card or payment needed.</p>
            <ErrorText message={startTrial.error?.message ?? null} />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Plans</h2>
        {owner.plans.length === 0 ? (
          <p className="rounded-xl border p-5 text-sm text-muted-foreground">
            Pricing for your workspace will be shared with you directly. Request an upgrade and we will contact you.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {owner.plans.map((plan) => (
              <div key={plan.id} className="rounded-xl border p-5">
                <p className="font-semibold">{plan.name}</p>
                {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}
                <p className="mt-3 text-sm">{priceLine(plan)}</p>
                <p className="mt-3 text-2xl font-semibold">
                  {formatMoney(plan.estimatedAmount, plan.currencyCode)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}/ {plan.billingPeriod === "annual" ? "year" : "month"} + GST
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">For your {owner.billableEmployees} active employees today</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="size-4" /> How upgrading works
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Request an upgrade below.</li>
          <li>We send you a GST invoice for your employee count.</li>
          <li>Pay by UPI or bank transfer. Your plan is active as soon as we confirm the payment.</li>
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => upgrade.mutate(undefined)} disabled={upgrade.isPending}>
            {upgrade.isPending && <Loader2 className="animate-spin" />}
            {owner.upgradeRequestedAt ? "Request again" : "Request upgrade"}
          </Button>
          {owner.upgradeRequestedAt && (
            <span className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="size-4" /> Requested on {formatDay(owner.upgradeRequestedAt)}. We will send your invoice shortly.
            </span>
          )}
        </div>
        <ErrorText message={upgrade.error?.message ?? null} />
      </section>
    </div>
  );
};

export default BillingPage;
