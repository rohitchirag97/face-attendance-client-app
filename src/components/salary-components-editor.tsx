import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/lib/form-utils";
import type { ComponentFormValue } from "@/lib/employment-form";

const PRESETS: { label: string; component: ComponentFormValue }[] = [
  { label: "HRA", component: { name: "HRA", kind: "earning", calc: "percent_basic", value: "40" } },
  { label: "DA", component: { name: "DA", kind: "earning", calc: "percent_basic", value: "10" } },
  { label: "TA", component: { name: "TA", kind: "earning", calc: "fixed", value: "" } },
  { label: "Medical", component: { name: "Medical allowance", kind: "earning", calc: "fixed", value: "" } },
];

// PF, ESI, professional tax and TDS belong to the Statutory tab; the same names here would deduct them twice.
// Mirrors the duplicate patterns payroll-calc.ts skips on the server.
const STATUTORY_NAME = /\b(pf|provident)|\besi\b|professional\s*tax|^pt$|\btds\b|income\s*tax/i;

export const SalaryComponentsEditor: React.FC<{
  value: ComponentFormValue[];
  onChange: (value: ComponentFormValue[]) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const update = (index: number, patch: Partial<ComponentFormValue>) =>
    onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const add = (component: ComponentFormValue) => onChange([...value, component]);
  const unused = PRESETS.filter((p) => !value.some((c) => c.name.toLowerCase() === p.component.name.toLowerCase()));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Allowances & deductions</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Earnings (HRA, DA, TA…) are added to pay; fixed earnings are prorated by attendance. Other deductions
          (canteen, uniform…) are taken from pay. "% of basic" is calculated on the basic pay earned. PF, ESI,
          professional tax and income tax are set in the Statutory tab, not here.
        </p>
      </div>

      {value.length === 0 && <p className="text-sm text-muted-foreground">None added yet.</p>}

      {value.map((c, index) => (
        <div key={index} className="space-y-1.5">
        <div className="grid grid-cols-2 items-center gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_7rem_8rem_6rem_auto]">
          <input
            aria-label="Component name"
            placeholder="Name"
            value={c.name}
            maxLength={50}
            disabled={disabled}
            onChange={(e) => update(index, { name: e.target.value })}
            className={`${inputClass} col-span-2 sm:col-span-1`}
          />
          <select
            aria-label="Type"
            value={c.kind}
            disabled={disabled}
            onChange={(e) => update(index, { kind: e.target.value as ComponentFormValue["kind"] })}
            className={inputClass}
          >
            <option value="earning">Earning</option>
            <option value="deduction">Deduction</option>
          </select>
          <select
            aria-label="Calculation"
            value={c.calc}
            disabled={disabled}
            onChange={(e) => update(index, { calc: e.target.value as ComponentFormValue["calc"] })}
            className={inputClass}
          >
            <option value="fixed">Fixed amount</option>
            <option value="percent_basic">% of basic</option>
          </select>
          <input
            aria-label="Value"
            type="number"
            min="0"
            step="0.01"
            placeholder={c.calc === "percent_basic" ? "%" : "Amount"}
            value={c.value}
            disabled={disabled}
            onChange={(e) => update(index, { value: e.target.value })}
            className={inputClass}
          />
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${c.name || "component"}`} disabled={disabled} onClick={() => remove(index)}>
            <Trash2 />
          </Button>
        </div>
        {c.kind === "deduction" && STATUTORY_NAME.test(c.name.trim()) && (
          <p role="alert" className="px-1 text-xs text-amber-700 dark:text-amber-400">
            "{c.name.trim()}" is a statutory deduction. Set it in the Statutory tab and remove this row, or it may be
            deducted twice.
          </p>
        )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {unused.map((p) => (
          <Button key={p.label} type="button" variant="outline" size="sm" disabled={disabled} onClick={() => add(p.component)}>
            <Plus /> {p.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => add({ name: "", kind: "earning", calc: "fixed", value: "" })}
        >
          <Plus /> Custom
        </Button>
      </div>
    </div>
  );
};
