import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import {
  accountingSettingsQuery,
  FORMAT_LABEL,
  journalQuery,
  useExportJournal,
  useSaveAccountingSettings,
  VOUCHER_KIND,
  type AccountingSplit,
  type ExportFormat,
  type JournalVoucher,
} from "@/hooks/use-accounting";
import { inputClass } from "@/lib/form-utils";
import { formatMoney } from "@/lib/payroll-format";
import { getActiveOrganizationId } from "@/lib/session";

const iso = (date: Date) => date.toLocaleDateString("en-CA");
const lastMonth = () => {
  const now = new Date();
  return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
};
const thisMonth = () => {
  const now = new Date();
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
};
const inr = (value: number) => formatMoney(value, "INR");

const VoucherRow: React.FC<{ voucher: JournalVoucher; checked: boolean; onToggle: () => void }> = ({ voucher, checked, onToggle }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-b">
        <td className="px-3 py-2"><input type="checkbox" aria-label={`Include ${voucher.number}`} className="accent-primary" checked={checked} onChange={onToggle} /></td>
        <td className="px-3 py-2 whitespace-nowrap">{voucher.date}</td>
        <td className="px-3 py-2">
          <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 text-left font-medium hover:underline">
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />} {voucher.number}
          </button>
          <span className="block pl-5 text-xs text-muted-foreground">{VOUCHER_KIND[voucher.kind]} · {voucher.narration}</span>
        </td>
        <td className="px-3 py-2 text-right">{inr(voucher.total)}</td>
        <td className="px-3 py-2 text-xs">
          {!voucher.balanced ? (
            <span className="text-red-600">Does not balance</span>
          ) : voucher.lastExport ? (
            <span className="text-amber-700 dark:text-amber-400">Exported {voucher.lastExport.at.slice(0, 10)} ({FORMAT_LABEL[voucher.lastExport.format] ?? voucher.lastExport.format})</span>
          ) : (
            <span className="text-green-700 dark:text-green-400">New</span>
          )}
        </td>
      </tr>
      {open && (
        <tr className="border-b bg-muted/30">
          <td />
          <td colSpan={4} className="px-3 py-2">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-1">Ledger</th><th className="py-1 text-right">Debit</th><th className="py-1 text-right">Credit</th></tr>
              </thead>
              <tbody>
                {voucher.lines.map((line, index) => (
                  <tr key={index}>
                    <td className="py-0.5">{line.credit ? <span className="pl-4">To {line.ledger}</span> : line.ledger}{line.costCentre ? <span className="text-muted-foreground"> · {line.costCentre}</span> : null}</td>
                    <td className="py-0.5 text-right">{line.debit ? inr(line.debit) : ""}</td>
                    <td className="py-0.5 text-right">{line.credit ? inr(line.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
};

const ExportTab: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [range, setRange] = useState(lastMonth);
  const { data, isLoading, error } = useQuery(journalQuery(organizationId, range.from, range.to));
  const exportJournal = useExportJournal(organizationId);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [includeLedgers, setIncludeLedgers] = useState(true);
  const vouchers = data?.vouchers ?? [];
  const selected = vouchers.filter((v) => !excluded.has(v.key));
  const again = selected.filter((v) => v.lastExport);
  // A new period starts with every voucher selected.
  const changeRange = (next: { from: string; to: string }) => {
    setRange(next);
    setExcluded(new Set());
  };


  const download = (format: ExportFormat) => {
    if (again.length && !window.confirm(`${again.length} of these vouchers were exported before. Importing them again would book them twice. Download anyway?`)) return;
    exportJournal.mutate({ from: range.from, to: range.to, format, keys: selected.map((v) => v.key), includeLedgers: format === "tally" && includeLedgers });
  };
  const toggle = (key: string) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From">{(id) => <input id={id} type="date" value={range.from} max={range.to} onChange={(e) => changeRange({ ...range, from: e.target.value })} className={inputClass} />}</Field>
        <Field label="To">{(id) => <input id={id} type="date" value={range.to} min={range.from} onChange={(e) => changeRange({ ...range, to: e.target.value })} className={inputClass} />}</Field>
        <Button variant="outline" onClick={() => changeRange(lastMonth())}>Last month</Button>
        <Button variant="outline" onClick={() => changeRange(thisMonth())}>This month</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Finalized payroll (dated the last day of its period), full &amp; final settlements (dated when finalized) and bonuses paid outside payroll.
        Salary is booked as owed; book the actual bank payment in your accounting software as usual.
      </p>
      <ErrorText message={error?.message ?? null} />

      {isLoading ? (
        <Spinner />
      ) : vouchers.length === 0 ? (
        <EmptyState text="Nothing to export in this period. Payroll appears here once it is finalized." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">
                    <input type="checkbox" aria-label="Include all" className="accent-primary" checked={excluded.size === 0}
                      onChange={(e) => setExcluded(e.target.checked ? new Set() : new Set(vouchers.map((v) => v.key)))} />
                  </th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Voucher</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher) => (
                  <VoucherRow key={voucher.key} voucher={voucher} checked={!excluded.has(voucher.key)} onToggle={() => toggle(voucher.key)} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 rounded-xl border bg-card p-4">
            <p className="text-sm font-medium">Download {selected.length} voucher(s)</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={!selected.length || exportJournal.isPending} onClick={() => download("tally")}>
                {exportJournal.isPending ? <Loader2 className="animate-spin" /> : <Download />} Tally (XML)
              </Button>
              <Button variant="outline" disabled={!selected.length || exportJournal.isPending} onClick={() => download("csv")}>
                <FileText /> CSV (Zoho Books, QuickBooks, others)
              </Button>
              <Button variant="outline" disabled={!selected.length || exportJournal.isPending} onClick={() => download("xlsx")}>
                <FileSpreadsheet /> Excel
              </Button>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 accent-primary" checked={includeLedgers} onChange={(e) => setIncludeLedgers(e.target.checked)} />
              <span>
                Tally: create any missing ledgers
                <span className="block text-xs text-muted-foreground">Under the groups shown on the Ledger mapping tab. Ledgers that already exist are left as they are.</span>
              </span>
            </label>
            <ErrorText message={exportJournal.error?.message ?? null} />
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer">How to import</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><b>Tally Prime:</b> open the company, then Import → Transactions, and choose the XML file. (Tally ERP 9: Gateway of Tally → Import Data → Vouchers.) With cost centres, turn on cost centres for the company first.</li>
                <li><b>Zoho Books:</b> Accountant → Manual Journals → Import, upload the CSV and map Journal Date, Journal Number, Account, Debit, Credit.</li>
                <li><b>QuickBooks Online:</b> Settings → Import data → Journal entries (or a journal import app), and map the same columns.</li>
                <li>Ledger names must match your chart of accounts; set them once on the Ledger mapping tab.</li>
              </ul>
            </details>
          </div>
        </>
      )}
    </div>
  );
};

const LedgerTab: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { data, isLoading, error } = useQuery(accountingSettingsQuery(organizationId));
  const save = useSaveAccountingSettings(organizationId);
  const [ledgers, setLedgers] = useState<Record<string, string> | null>(null);
  const [splitBy, setSplitBy] = useState<AccountingSplit | null>(null);
  if (isLoading) return <Spinner />;
  if (!data) return <ErrorText message={error?.message ?? "Could not load the ledger mapping."} />;
  const values = ledgers ?? data.ledgers;
  const split = splitBy ?? data.splitBy;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Use the exact ledger (account) names from your accounting software. Two lines can share one ledger, for example bonus booked to Salaries &amp; Wages.
      </p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">What is booked</th><th className="px-3 py-2">Ledger name</th><th className="px-3 py-2">Tally group</th></tr>
          </thead>
          <tbody className="divide-y">
            {data.definitions.map((definition) => (
              <tr key={definition.key}>
                <td className="px-3 py-2">{definition.label}</td>
                <td className="px-3 py-2">
                  <input
                    aria-label={definition.label}
                    value={values[definition.key] ?? ""}
                    placeholder={definition.defaultName}
                    maxLength={100}
                    onChange={(e) => setLedgers({ ...values, [definition.key]: e.target.value })}
                    className={`${inputClass} h-9`}
                  />
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{definition.group}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Field label="Cost centres" hint="Splits each voucher by branch or department, as Tally cost centres (CSV: the Location column)">
        {(id) => (
          <select id={id} value={split} onChange={(e) => setSplitBy(e.target.value as AccountingSplit)} className={`${inputClass} max-w-xs`}>
            <option value="none">None: one voucher per payroll</option>
            <option value="branch">By branch</option>
            <option value="department">By department</option>
          </select>
        )}
      </Field>
      <ErrorText message={save.error?.message ?? null} />
      <div className="flex items-center gap-3">
        <Button disabled={save.isPending} onClick={() => save.mutate({ ledgers: values, splitBy: split }, { onSuccess: () => { setLedgers(null); setSplitBy(null); } })}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save mapping
        </Button>
        {save.isSuccess && <span className="text-sm text-green-700 dark:text-green-400">Saved.</span>}
      </div>
    </div>
  );
};

/** Journal vouchers for Tally, Zoho Books, QuickBooks and others. Owners and admins. */
const AccountingPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "ledgers" ? "ledgers" : "export";
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Accounting export"
        description="Payroll, full & final settlements and bonuses as journal vouchers for Tally, Zoho Books, QuickBooks or any accounting software."
      />
      <div className="flex gap-1 border-b">
        {(["export", "ledgers"] as const).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setParams({ tab: name })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === name ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {name === "export" ? "Export" : "Ledger mapping"}
          </button>
        ))}
      </div>
      {tab === "export" ? <ExportTab organizationId={organizationId} /> : <LedgerTab organizationId={organizationId} />}
    </div>
  );
};

export default AccountingPage;
