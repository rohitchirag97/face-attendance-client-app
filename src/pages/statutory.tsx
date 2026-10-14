import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import { inputClass } from "@/lib/form-utils";
import {
  PT_STATE_OPTIONS,
  statutorySettingsQuery,
  useSaveStatutorySettings,
  type PtState,
  type StatutorySettings,
} from "@/hooks/use-statutory";
import { canUpdateOrganization, getActiveOrganizationId } from "@/lib/session";

const upper = (value: string) => value.toUpperCase().trim();

const Toggle: React.FC<{
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, hint, checked, disabled, onChange }) => (
  <label className="flex items-start gap-3 text-sm">
    <input type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <span>
      {label}
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </span>
  </label>
);

const SettingsForm: React.FC<{ organizationId: string; settings: StatutorySettings; canEdit: boolean }> = ({
  organizationId,
  settings,
  canEdit,
}) => {
  const save = useSaveStatutorySettings(organizationId);
  const [form, setForm] = useState(settings);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof StatutorySettings>(key: K, value: StatutorySettings[K]) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const text = (key: "pfEstablishmentCode" | "esiEstablishmentCode" | "tan" | "employerPan" | "employerAddress") =>
    form[key] ?? "";

  const submit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (form.ptEnabled && !form.ptState) return setError("Choose the state for professional tax.");
    if (form.ptEnabled && form.ptState === "FLAT" && !form.ptFlatAmount) return setError("Enter the monthly professional tax amount.");
    save.mutate(
      {
        ...form,
        tan: form.tan ? upper(form.tan) : null,
        employerPan: form.employerPan ? upper(form.employerPan) : null,
      },
      { onSuccess: () => setSaved(true), onError: (e) => setError(e.message) },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6 rounded-xl border bg-background p-5 shadow-sm">
      {!canEdit && <p className="text-sm text-muted-foreground">Only the owner can change these settings.</p>}
      <fieldset disabled={!canEdit} className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Provident fund (PF)</h2>
          <Toggle label="Deduct PF" hint="12% of basic pay from the employee, plus employer EPS, EPF, admin and EDLI amounts for the challan." checked={form.pfEnabled} disabled={!canEdit} onChange={(v) => set("pfEnabled", v)} />
          {form.pfEnabled && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Wage ceiling">
                {(id) => <input id={id} type="number" min="1" value={form.pfWageCeiling} onChange={(e) => set("pfWageCeiling", Number(e.target.value))} className={inputClass} />}
              </Field>
              <Field label="Establishment code">
                {(id) => <input id={id} value={text("pfEstablishmentCode")} onChange={(e) => set("pfEstablishmentCode", e.target.value)} className={inputClass} />}
              </Field>
              <div className="self-end pb-2">
                <Toggle label="Cap wages at the ceiling" hint="Turn off to contribute on full basic pay." checked={form.pfCapWages} disabled={!canEdit} onChange={(v) => set("pfCapWages", v)} />
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3 border-t pt-4">
          <h2 className="text-sm font-semibold">ESI</h2>
          <Toggle label="Deduct ESI" hint="0.75% employee and 3.25% employer, only while full-month pay is within the ceiling." checked={form.esiEnabled} disabled={!canEdit} onChange={(v) => set("esiEnabled", v)} />
          {form.esiEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Wage ceiling">
                {(id) => <input id={id} type="number" min="1" value={form.esiWageCeiling} onChange={(e) => set("esiWageCeiling", Number(e.target.value))} className={inputClass} />}
              </Field>
              <Field label="Employer code">
                {(id) => <input id={id} value={text("esiEstablishmentCode")} onChange={(e) => set("esiEstablishmentCode", e.target.value)} className={inputClass} />}
              </Field>
            </div>
          )}
        </section>

        <section className="space-y-3 border-t pt-4">
          <h2 className="text-sm font-semibold">Professional tax</h2>
          <Toggle label="Deduct professional tax" hint="Monthly slab for the state. Check the slab with your accountant." checked={form.ptEnabled} disabled={!canEdit} onChange={(v) => set("ptEnabled", v)} />
          {form.ptEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="State">
                {(id) => (
                  <select id={id} value={form.ptState ?? ""} onChange={(e) => set("ptState", (e.target.value || null) as PtState | null)} className={inputClass}>
                    <option value="">Select a state…</option>
                    {PT_STATE_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                )}
              </Field>
              {form.ptState === "FLAT" && (
                <Field label="Monthly amount">
                  {(id) => <input id={id} type="number" min="0" max="2500" value={form.ptFlatAmount ?? ""} onChange={(e) => set("ptFlatAmount", e.target.value ? Number(e.target.value) : null)} className={inputClass} />}
                </Field>
              )}
            </div>
          )}
        </section>

        <section className="space-y-3 border-t pt-4">
          <h2 className="text-sm font-semibold">Income tax (TDS on salary)</h2>
          <Toggle label="Deduct TDS" hint="Projects the year's tax from pay so far and spreads it over the remaining months." checked={form.tdsEnabled} disabled={!canEdit} onChange={(v) => set("tdsEnabled", v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employer TAN">
              {(id) => <input id={id} maxLength={10} value={text("tan")} onChange={(e) => set("tan", e.target.value)} className={inputClass} placeholder="ABCD12345E" />}
            </Field>
            <Field label="Employer PAN">
              {(id) => <input id={id} maxLength={10} value={text("employerPan")} onChange={(e) => set("employerPan", e.target.value)} className={inputClass} placeholder="ABCDE1234F" />}
            </Field>
            <div className="sm:col-span-2">
              <Field label="Employer address">
                {(id) => <input id={id} maxLength={300} value={text("employerAddress")} onChange={(e) => set("employerAddress", e.target.value)} className={inputClass} />}
              </Field>
            </div>
          </div>
        </section>
      </fieldset>

      <ErrorText message={error} />
      {saved && <p role="status" className="text-sm text-green-600">Statutory settings saved.</p>}
      {canEdit && (
        <div className="flex justify-end border-t pt-4">
          <Button type="submit" className="h-10" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save settings
          </Button>
        </div>
      )}
    </form>
  );
};

const StatutoryPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const canEdit = canUpdateOrganization(organizationId);
  const settings = useQuery(statutorySettingsQuery(organizationId));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Statutory compliance"
        description="PF, ESI, professional tax and TDS for India. Applies to payroll generated after you enable it; regenerate draft runs to apply."
      />
      <ErrorText message={settings.error?.message} />
      {settings.isLoading ? <Spinner /> : settings.data && <SettingsForm organizationId={organizationId} settings={settings.data} canEdit={canEdit} />}
    </div>
  );
};

export default StatutoryPage;
