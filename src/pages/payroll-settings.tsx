import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ErrorText,
  Field,
  PageHeader,
  Spinner,
} from "@/components/form-kit";
import { inputClass, toNumberOrNull } from "@/lib/form-utils";
import {
  payrollSettingsQuery,
  useSavePayrollSettings,
  type PayrollSettings,
} from "@/hooks/use-payroll-api";
import { getActiveOrganizationId } from "@/lib/session";
import { TabPanel, TabLayout } from "@/components/tabs";

const text = (value: string | null | undefined, fallback = "") => value ?? fallback;

const TABS = [
  { id: "general", label: "General" },
  { id: "pay", label: "Overtime & fines" },
  { id: "days", label: "Days & holidays" },
];

const SettingsForm: React.FC<{
  organizationId: string;
  settings: PayrollSettings | null;
}> = ({ organizationId, settings }) => {
  const save = useSavePayrollSettings(organizationId);
  const [currency, setCurrency] = useState(text(settings?.currencyCode, "INR"));
  const [otMethod, setOtMethod] = useState<PayrollSettings["overtimeCalculationMethod"]>(
    settings?.overtimeCalculationMethod ?? "hourly_rate_multiplier",
  );
  const [otFixed, setOtFixed] = useState(text(settings?.overtimeFixedAmountPerHour));
  const [otMultiplier, setOtMultiplier] = useState(
    text(settings?.overtimeHourlyRateMultiplier, "1.5"),
  );
  const [hoursPerDay, setHoursPerDay] = useState(text(settings?.overtimeHoursPerWorkday, "8"));
  const [fineMethod, setFineMethod] = useState<PayrollSettings["lateFineMethod"]>(
    settings?.lateFineMethod ?? "none",
  );
  const [fineAmount, setFineAmount] = useState(text(settings?.lateFineAmount));
  const [fineCap, setFineCap] = useState(text(settings?.lateFineCapPerPayPeriod));
  const [fullPercent, setFullPercent] = useState(text(settings?.fullDayThresholdPercent, "90"));
  const [halfPercent, setHalfPercent] = useState(text(settings?.halfDayThresholdPercent, "50"));
  const [weeklyOff, setWeeklyOff] = useState<number[]>(settings?.weeklyOffDays ?? [0]);
  const [autoLoans, setAutoLoans] = useState(settings?.autoDeductLoans ?? false);
  const [paidHolidays, setPaidHolidays] = useState(settings?.paidHolidays ?? false);
  const [otApproval, setOtApproval] = useState(settings?.overtimeApprovalRequired ?? false);
  const [offDayPolicy, setOffDayPolicy] = useState<PayrollSettings["offDayWorkPolicy"]>(settings?.offDayWorkPolicy ?? "manager");
  const [weeklyOffRate, setWeeklyOffRate] = useState(text(settings?.weeklyOffWorkMultiplier, "1"));
  const [holidayRate, setHolidayRate] = useState(text(settings?.holidayWorkMultiplier, "2"));
  const [tab, setTab] = useState("general");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const fixed = toNumberOrNull(otFixed);
    const hours = toNumberOrNull(hoursPerDay);
    const fine = toNumberOrNull(fineAmount);
    const multiplier = toNumberOrNull(otMultiplier);

    if (!/^[A-Za-z]{3}$/.test(currency.trim())) return setError("Currency must be a 3-letter code.");
    if (otMethod === "fixed_per_hour" && fixed === null) return setError("Enter the fixed overtime amount per hour.");
    if (otMethod === "hourly_rate_multiplier" && !multiplier) return setError("Enter the overtime multiplier.");
    if (otMethod === "equivalent_days" && !hours) return setError("Enter hours per workday.");
    if (fineMethod !== "none" && fine === null) return setError("Enter the late fine amount.");
    const full = toNumberOrNull(fullPercent);
    const half = toNumberOrNull(halfPercent);
    const weeklyRate = toNumberOrNull(weeklyOffRate);
    const holidayRateValue = toNumberOrNull(holidayRate);
    if (weeklyRate === null || holidayRateValue === null || weeklyRate > 5 || holidayRateValue > 5) {
      return setError("Off-day pay rates must be between 0 and 5 times a day's pay.");
    }
    if (!full || !half || full > 100 || half >= full) {
      return setError("Half-day % must be lower than full-day %, and full-day % at most 100.");
    }

    save.mutate(
      {
        currencyCode: currency.trim().toUpperCase(),
        overtimeCalculationMethod: otMethod,
        overtimeFixedAmountPerHour: otMethod === "fixed_per_hour" ? fixed : null,
        overtimeHourlyRateMultiplier: multiplier ?? 1.5,
        overtimeHoursPerWorkday: otMethod === "equivalent_days" ? hours : null,
        lateFineMethod: fineMethod,
        lateFineAmount: fineMethod === "none" ? null : fine,
        lateFineCapPerPayPeriod: fineMethod === "none" ? null : toNumberOrNull(fineCap),
        fullDayThresholdPercent: full,
        halfDayThresholdPercent: half,
        weeklyOffDays: weeklyOff,
        autoDeductLoans: autoLoans,
        paidHolidays,
        overtimeApprovalRequired: otApproval,
        offDayWorkPolicy: offDayPolicy,
        weeklyOffWorkMultiplier: weeklyRate,
        holidayWorkMultiplier: holidayRateValue,
      },
      { onSuccess: () => setSaved(true), onError: (e) => setError(e.message) },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border bg-background p-5 shadow-sm sm:p-6" noValidate>
      <TabLayout tabs={TABS} active={tab} onChange={setTab}>

      <TabPanel id="general" active={tab}>
      <Field label="Currency" hint="3-letter code, e.g. INR, USD.">
        {(id) => (
          <input id={id} value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} className={`${inputClass} uppercase sm:w-32`} />
        )}
      </Field>

      <fieldset className="space-y-3 border-t pt-4">
        <legend className="text-sm font-semibold">Loans &amp; salary advances</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={autoLoans} onChange={(e) => setAutoLoans(e.target.checked)} className="mt-1" />
          <span>
            Deduct monthly installments from salary automatically
            <span className="block text-xs text-muted-foreground">
              When on, each payroll deducts the installment of every active loan or advance (never more
              than the balance or the net pay). When off, payroll deducts nothing and the amount can be
              collected separately later through the Installments screen.
            </span>
          </span>
        </label>
      </fieldset>
      </TabPanel>

      <TabPanel id="pay" active={tab}>
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Overtime</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={otApproval} onChange={(e) => setOtApproval(e.target.checked)} className="mt-1" />
          <span>
            Require admin approval for overtime
            <span className="block text-xs text-muted-foreground">
          When on, overtime is paid only after HR or an admin approves it on the Overtime screen; days still
              pending are not paid. When off, all overtime from attendance is approved automatically.
            </span>
          </span>
        </label>
        <Field label="Calculation method">
          {(id) => (
            <select id={id} value={otMethod} onChange={(e) => setOtMethod(e.target.value as typeof otMethod)} className={inputClass}>
              <option value="hourly_rate_multiplier">Multiple of hourly rate (e.g. 1.5×)</option>
              <option value="fixed_per_hour">Fixed amount per overtime hour</option>
              <option value="equivalent_days">Convert overtime hours into extra days</option>
            </select>
          )}
        </Field>
        {otMethod === "hourly_rate_multiplier" && (
          <Field label="Multiplier">
            {(id) => (
              <input id={id} type="number" step="0.01" min="0" value={otMultiplier} onChange={(e) => setOtMultiplier(e.target.value)} className={inputClass} />
            )}
          </Field>
        )}
        {otMethod === "fixed_per_hour" && (
          <Field label="Amount per overtime hour">
            {(id) => (
              <input id={id} type="number" step="0.01" min="0" value={otFixed} onChange={(e) => setOtFixed(e.target.value)} className={inputClass} />
            )}
          </Field>
        )}
        {otMethod === "equivalent_days" && (
          <Field label="Working hours per day" hint="Overtime hours ÷ this = extra days, paid at the per-day rate for the pay period.">
            {(id) => (
              <input id={id} type="number" step="0.5" min="0" max="24" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} className={inputClass} />
            )}
          </Field>
        )}
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-semibold">Late arrival fine</legend>
        <Field label="Fine method">
          {(id) => (
            <select id={id} value={fineMethod} onChange={(e) => setFineMethod(e.target.value as typeof fineMethod)} className={inputClass}>
              <option value="none">No fine</option>
              <option value="fixed_per_occurrence">Fixed amount per late arrival</option>
              <option value="per_minute">Amount per minute late</option>
            </select>
          )}
        </Field>
        {fineMethod !== "none" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fineMethod === "per_minute" ? "Fine per minute" : "Fine per late arrival"}>
              {(id) => (
                <input id={id} type="number" step="0.01" min="0" value={fineAmount} onChange={(e) => setFineAmount(e.target.value)} className={inputClass} />
              )}
            </Field>
            <Field label="Maximum fine per pay period (optional)" hint="Upper limit on the total late fines deducted from one employee in a pay period. E.g. with 50 per late arrival and a cap of 500, fines stop at 500 even after 12 late days. Leave empty for no limit.">
              {(id) => (
                <input id={id} type="number" step="0.01" min="0" value={fineCap} onChange={(e) => setFineCap(e.target.value)} className={inputClass} />
              )}
            </Field>
          </div>
        )}
      </fieldset>
      </TabPanel>

      <TabPanel id="days" active={tab}>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Holidays</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={paidHolidays} onChange={(e) => setPaidHolidays(e.target.checked)} className="mt-1" />
          <span>
            Pay public holidays
            <span className="block text-xs text-muted-foreground">
              When on, each holiday counts as a paid day, so daily-wage and hourly staff are paid for it.
              When off, holidays are simply not working days: nobody is marked absent, and daily-wage and
              hourly staff are paid only if they work. Fixed-salary staff are not affected either way.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="space-y-3 border-t pt-4">
        <legend className="text-sm font-semibold">Weekly off days</legend>
        <p className="text-xs text-muted-foreground">
          These days are not working days, so they are neither paid as attendance nor counted as absent.
        </p>
        <div className="flex flex-wrap gap-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, day) => {
            const active = weeklyOff.includes(day);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setWeeklyOff((prev) =>
                    active ? prev.filter((d) => d !== day) : [...prev, day],
                  )
                }
                className={`rounded-md border px-3 py-1.5 text-sm ${active ? "bg-primary text-primary-foreground" : "bg-background"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-semibold">Work on off days</legend>
        <p className="text-xs text-muted-foreground">
          When someone works on their weekly off or a holiday, they can be given a comp-off (a day of leave) or extra pay.
          Employees can ask for either from the Leave page.
        </p>
        <Field label="Default">
          {(id) => (
            <select id={id} value={offDayPolicy} onChange={(e) => setOffDayPolicy(e.target.value as typeof offDayPolicy)} className={inputClass}>
              <option value="manager">Manager decides each day (undecided days are not paid)</option>
              <option value="pay">Always pay</option>
              <option value="comp_off">Always give comp-off</option>
            </select>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Weekly off pay (× a day's pay)" hint="1 pays one normal day; 2 pays double.">
            {(id) => (
              <input id={id} type="number" step="0.25" min="0" max="5" value={weeklyOffRate} onChange={(e) => setWeeklyOffRate(e.target.value)} className={inputClass} />
            )}
          </Field>
          <Field label="Holiday pay (× a day's pay)" hint="Includes any holiday pay already given: 2 with paid holidays on adds one extra day.">
            {(id) => (
              <input id={id} type="number" step="0.25" min="0" max="5" value={holidayRate} onChange={(e) => setHolidayRate(e.target.value)} className={inputClass} />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-semibold">Day status</legend>
        <p className="text-xs text-muted-foreground">
          Worked time (check-in to check-out, minus the shift break, or a share of it for partial days) is compared with the shift's
          working hours to decide whether a day counts as full, half, or absent.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full day at or above (%)" hint="Of the shift's working hours.">
            {(id) => (
              <input id={id} type="number" step="1" min="1" max="100" value={fullPercent} onChange={(e) => setFullPercent(e.target.value)} className={inputClass} />
            )}
          </Field>
          <Field label="Half day at or above (%)" hint="Below this the day counts as absent.">
            {(id) => (
              <input id={id} type="number" step="1" min="1" max="99" value={halfPercent} onChange={(e) => setHalfPercent(e.target.value)} className={inputClass} />
            )}
          </Field>
        </div>
      </fieldset>
      </TabPanel>
      </TabLayout>

      <ErrorText message={error} />
      {saved && (
        <p role="status" className="text-sm text-green-600">
          Payroll settings saved.
        </p>
      )}
      <div className="flex justify-end border-t pt-4">
        <Button type="submit" size="lg" className="h-10" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Save settings
        </Button>
      </div>
    </form>
  );
};

const PayrollSettingsPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const { data, isLoading, error } = useQuery(payrollSettingsQuery(organizationId));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Payroll settings"
        description="Overtime and late-fine rules applied to every employee in this organization."
      />
      <ErrorText message={error?.message} />
      {isLoading ? (
        <Spinner />
      ) : (
        !error && <SettingsForm organizationId={organizationId} settings={data ?? null} />
      )}
    </div>
  );
};

export default PayrollSettingsPage;
