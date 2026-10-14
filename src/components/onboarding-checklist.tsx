import React, { useState } from "react";
import { Link } from "react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Landmark,
  MonitorSmartphone,
  Rocket,
  Settings2,
  Upload,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { request } from "@/hooks/use-payroll-api";
import { canUpdateOrganization } from "@/lib/session";

type OnboardingStatus = {
  payrollSettings: boolean;
  statutorySettings: boolean;
  departments: number;
  shifts: number;
  holidays: number;
  employees: number;
  kiosks: number;
  payrollRuns: number;
};

const onboardingQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["onboarding-status", organizationId] as const,
    queryFn: () => request<OnboardingStatus>("/onboarding/status", organizationId),
    enabled: !!organizationId,
  });

type Step = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  done: boolean;
  optional?: boolean;
  ownerOnly?: boolean;
  actions: { label: string; to: string; icon?: React.ElementType }[];
};

// In the order a new organization needs them: payroll depends on employees, employees on departments and shifts.
const buildSteps = (s: OnboardingStatus): Step[] => [
  {
    id: "payroll-settings",
    title: "Set your payroll rules",
    description: "Currency, weekly offs, full and half-day thresholds, overtime and late fines.",
    icon: Settings2,
    done: s.payrollSettings,
    ownerOnly: true,
    actions: [{ label: "Open payroll settings", to: "/payroll-settings" }],
  },
  {
    id: "departments",
    title: "Create departments",
    description: "Group people the way your business runs, such as Sales, Production or Accounts.",
    icon: Building2,
    done: s.departments > 0,
    actions: [{ label: "Add departments", to: "/departments" }],
  },
  {
    id: "shifts",
    title: "Create shifts",
    description: "Start and end times, breaks and grace periods. Attendance and overtime are measured against them.",
    icon: Clock,
    done: s.shifts > 0,
    actions: [{ label: "Add shifts", to: "/shifts" }],
  },
  {
    id: "holidays",
    title: "Add company holidays",
    description: "Holidays are skipped as working days, or paid if your payroll rules say so.",
    icon: CalendarDays,
    done: s.holidays > 0,
    optional: true,
    actions: [{ label: "Add holidays", to: "/holidays" }],
  },
  {
    id: "statutory",
    title: "Set up PF, ESI, PT and TDS",
    description: "Turn on the statutory deductions that apply to you and enter your registration numbers.",
    icon: Landmark,
    done: s.statutorySettings,
    optional: true,
    actions: [{ label: "Open statutory settings", to: "/statutory" }],
  },
  {
    id: "employees",
    title: "Add your employees",
    description: "Add them one at a time, or fill in the Excel template to upload everyone at once.",
    icon: UserPlus,
    done: s.employees > 0,
    actions: [
      { label: "Add employee", to: "/employees/new", icon: UserPlus },
      { label: "Bulk upload", to: "/employees/bulk", icon: Upload },
    ],
  },
  {
    id: "kiosk",
    title: "Set up an attendance kiosk",
    description: "Register a tablet so staff can check in and out with their face.",
    icon: MonitorSmartphone,
    done: s.kiosks > 0,
    optional: true,
    actions: [{ label: "Add a kiosk", to: "/kiosks" }],
  },
  {
    id: "payroll",
    title: "Run your first payroll",
    description: "Generate a pay period, review it, then finalize to publish salary slips.",
    icon: Wallet,
    done: s.payrollRuns > 0,
    actions: [{ label: "Go to payroll", to: "/payroll" }],
  },
];

const dismissKey = (organizationId: string) => `onboarding-dismissed:${organizationId}`;
const readDismissed = (organizationId: string) => {
  try {
    return localStorage.getItem(dismissKey(organizationId)) === "1";
  } catch {
    return false;
  }
};

/**
 * Setup guide for a new organization, shown to owners and admins on the dashboard. Steps tick
 * themselves off from real data and the guide hides once every required step is done.
 */
const OnboardingChecklist: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { data } = useQuery(onboardingQuery(organizationId));
  const [dismissed, setDismissed] = useState(() => readDismissed(organizationId));
  const isOwner = canUpdateOrganization(organizationId);

  if (!data || dismissed) return null;
  const steps = buildSteps(data);
  const required = steps.filter((step) => !step.optional);
  if (required.every((step) => step.done)) return null;

  const doneCount = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done && !step.optional && (isOwner || !step.ownerOnly));

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey(organizationId), "1");
    } catch {
      // The checklist simply returns on the next visit.
    }
  };

  return (
    <section aria-labelledby="onboarding-title" className="rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-start gap-3 border-b p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Rocket className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="onboarding-title" className="font-semibold">Set up your workspace</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Follow these steps in order and you will be ready to run payroll. Each step ticks itself off when it is done.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {doneCount} of {steps.length} done
            </span>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Hide setup guide" className="rounded p-1 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <ol className="divide-y">
        {steps.map((step, index) => {
          const isNext = step.id === next?.id;
          const locked = step.ownerOnly && !isOwner;
          const Icon = step.icon;
          return (
            <li key={step.id} className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${isNext ? "bg-primary/5" : ""}`}>
              {step.done ? (
                <CheckCircle2 className="size-5 shrink-0 text-green-600" aria-label="Done" />
              ) : (
                <Circle className={`size-5 shrink-0 ${isNext ? "text-primary" : "text-muted-foreground/50"}`} aria-label="Not done" />
              )}
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 basis-60">
                <p className={`text-sm font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}>
                  {index + 1}. {step.title}
                  {step.optional && <span className="ml-2 text-xs font-normal text-muted-foreground no-underline">Optional</span>}
                </p>
                {!step.done && <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>}
              </div>
              {!step.done &&
                (locked ? (
                  <span className="text-xs text-muted-foreground">The owner sets this up</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {step.actions.map(({ label, to, icon: ActionIcon }) => (
                      <Button
                        key={to}
                        size="sm"
                        variant={isNext ? "default" : "outline"}
                        render={<Link to={to} />}
                      >
                        {ActionIcon && <ActionIcon />}
                        {label}
                      </Button>
                    ))}
                  </div>
                ))}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default OnboardingChecklist;
