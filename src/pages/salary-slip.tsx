import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Mail, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Spinner } from "@/components/form-kit";
import { formatHours, formatMoney, formatPeriod } from "@/lib/payroll-format";
import { payrollSlipQuery, useSendSlipEmail, useSendSlipWhatsApp } from "@/hooks/use-payroll-api";
import { getActiveOrganizationId } from "@/lib/session";

const Row: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className={`flex justify-between py-1.5 text-sm ${strong ? "font-semibold" : ""}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const SalarySlip: React.FC = () => {
  const { itemId = "" } = useParams();
  const navigate = useNavigate();
  const organizationId = getActiveOrganizationId() ?? "";
  const { data, isLoading, error } = useQuery(payrollSlipQuery(organizationId, itemId));
  const whatsapp = useSendSlipWhatsApp(organizationId);
  const email = useSendSlipEmail(organizationId);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const sending = whatsapp.isPending || email.isPending;

  const send = (channel: typeof whatsapp, success: string) => {
    setNotice(null);
    setSendError(null);
    channel.mutate(itemId, {
      onSuccess: () => setNotice(success),
      onError: (e) => setSendError(e.message),
    });
  };

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorText message={error?.message ?? "Salary slip not found"} />;

  const { item: i, run, organizationName } = data;
  const m = (v: string | number) => formatMoney(v, i.currencyCode);
  const isDraft = run.status === "draft";
  const { delivery } = data;
  const canSend = delivery.whatsapp || delivery.email;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft /> Back
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          {delivery.whatsapp && (
            <Button
              variant="outline"
              disabled={isDraft || sending}
              onClick={() => send(whatsapp, "Salary slip queued. It will be sent to the registered WhatsApp number.")}
            >
              {whatsapp.isPending ? <Loader2 className="animate-spin" /> : <MessageCircle />}
              Send on WhatsApp
            </Button>
          )}
          {delivery.email && (
            <Button
              variant="outline"
              disabled={isDraft || sending}
              onClick={() => send(email, "Salary slip queued. It will be emailed to the linked Google address.")}
            >
              {email.isPending ? <Loader2 className="animate-spin" /> : <Mail />}
              Send via email
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer /> Print / Save as PDF
          </Button>
        </div>
      </div>
      {isDraft && canSend && (
        <p className="text-xs text-muted-foreground print:hidden">Sending is available once the payroll is finalized.</p>
      )}
      {notice && <p role="status" className="text-sm text-green-600 print:hidden">{notice}</p>}
      <ErrorText message={sendError} />

      <article className="salary-slip space-y-5 border border-gray-300 bg-white p-6 text-black sm:p-8">
        <header className="border-b pb-4 text-center">
          <h1 className="text-xl font-bold">{organizationName}</h1>
          <p className="text-sm">Salary slip · {formatPeriod(run.periodStart, run.periodEnd)}</p>
          {isDraft && <p className="mt-1 text-xs font-semibold uppercase text-amber-600">Draft – not finalized</p>}
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div><span className="text-gray-500">Employee: </span>{i.employeeName}</div>
          <div><span className="text-gray-500">Code: </span>{i.employeeCode ?? "—"}</div>
          <div><span className="text-gray-500">Designation: </span>{i.jobTitle ?? "—"}</div>
          <div><span className="text-gray-500">Department: </span>{i.departmentName ?? "—"}</div>
          <div className="col-span-2">
            <span className="text-gray-500">Pay basis: </span>
            {m(i.compensationAmount)} {i.compensationType === "fixed_salary" ? "per pay period" : i.compensationType === "daily" ? "per day" : "per hour"}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-x-6 gap-y-1 border-t pt-4 text-sm">
          <div>Working days: <b>{i.workingDays}</b></div>
          <div>Present: <b>{i.presentDays}</b></div>
          <div>Half days: <b>{i.halfDays}</b></div>
          <div>Paid leave: <b>{i.paidLeaveDays}</b></div>
          <div>Unpaid leave: <b>{i.unpaidLeaveDays}</b></div>
          <div>Absent: <b>{i.absentDays}</b></div>
          <div>Hours worked: <b>{formatHours(i.workedMinutes)}</b></div>
          <div>Overtime: <b>{formatHours(i.overtimeMinutes)}</b></div>
        </section>

        <div className="grid gap-6 border-t pt-4 sm:grid-cols-2">
          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase text-gray-500">Earnings</h2>
            <Row label="Basic pay" value={m(i.basePay)} />
            <Row label="Overtime" value={m(i.overtimePay)} />
            {i.componentLines.filter((l) => l.kind === "earning").map((l) => (
              <Row key={`e-${l.name}`} label={l.name} value={m(l.amount)} />
            ))}
            <div className="border-t"><Row label="Gross pay" value={m(i.grossPay)} strong /></div>
          </section>
          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase text-gray-500">Deductions</h2>
            <Row label={`Late fine (${i.lateCount} late)`} value={m(i.lateFine)} />
            {i.componentLines.filter((l) => l.kind === "deduction").map((l) => (
              <Row key={`d-${l.name}`} label={l.name} value={m(l.amount)} />
            ))}
            {i.loanLines.map((l) => (
              <Row key={l.recoverableId} label={l.label} value={m(l.amount)} />
            ))}
            <div className="border-t"><Row label="Total deductions" value={m(i.totalDeductions)} strong /></div>
          </section>
        </div>

        <div className="flex justify-between rounded-md bg-gray-100 px-4 py-3 text-lg font-bold">
          <span>Net pay</span>
          <span>{m(i.netPay)}</span>
        </div>
        <p className="text-center text-xs text-gray-500">This is a system-generated salary slip.</p>
      </article>
      <Link to="/salary-slips" className="block text-center text-sm underline print:hidden">
        All my salary slips
      </Link>
    </div>
  );
};

export default SalarySlip;
