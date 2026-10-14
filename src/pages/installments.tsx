import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import { formatDateTime, inputClass, toNumberOrNull, toTextOrNull } from "@/lib/form-utils";
import {
  recoverablesQuery,
  repaymentsQuery,
  useCreateRepayment,
  useReviewRepayment,
  type PaymentMethod,
  type Recoverable,
} from "@/hooks/use-payroll-api";
import { getActiveOrganizationId } from "@/lib/session";

const todayInput = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const label = (item: Recoverable) =>
  `${item.employeeName} · ${item.type === "loan" ? "Loan" : "Advance"} ${item.principalAmount} ${item.currencyCode} · due ${item.outstanding}`;

const ManualEntry: React.FC<{ organizationId: string; item: Recoverable }> = ({
  organizationId,
  item,
}) => {
  const add = useCreateRepayment(organizationId, item.id);
  const [amount, setAmount] = useState(item.installmentAmount ?? "");
  const [paidOn, setPaidOn] = useState(todayInput);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const value = toNumberOrNull(amount);
    if (!value || value <= 0) return setError("Enter a valid amount.");
    if (value > Number(item.outstanding)) {
      return setError(`Amount exceeds the outstanding balance of ${item.outstanding}.`);
    }
    add.mutate(
      {
        amount: value,
        paymentMethod: method,
        paidAt: new Date(`${paidOn}T12:00:00`).toISOString(),
        reference: toTextOrNull(reference) ?? undefined,
        notes: toTextOrNull(notes) ?? undefined,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setReference("");
          setNotes("");
          setAmount(item.installmentAmount ?? "");
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2" noValidate>
      <Field label="Amount" hint={item.installmentAmount ? `Installment: ${item.installmentAmount}` : undefined}>
        {(id) => <input id={id} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />}
      </Field>
      <Field label="Payment date">
        {(id) => <input id={id} type="date" max={todayInput()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClass} />}
      </Field>
      <Field label="Payment method">
        {(id) => (
          <select id={id} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={inputClass}>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>
        )}
      </Field>
      <Field label="Reference (optional)">
        {(id) => <input id={id} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} className={inputClass} />}
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes (optional)">
          {(id) => <input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className={inputClass} />}
        </Field>
      </div>
      <div className="space-y-2 sm:col-span-2 sm:text-right">
        <ErrorText message={error} />
        {saved && <p className="text-sm text-green-700">Installment recorded.</p>}
        <Button type="submit" className="h-10" disabled={add.isPending}>
          {add.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Record installment
        </Button>
      </div>
    </form>
  );
};

const PendingForLoan: React.FC<{ organizationId: string; item: Recoverable }> = ({
  organizationId,
  item,
}) => {
  const { data } = useQuery(repaymentsQuery(organizationId, item.id));
  const review = useReviewRepayment(organizationId, item.id);
  const [error, setError] = useState<string | null>(null);
  const pending = (data ?? []).filter((payment) => payment.status === "pending");
  if (!pending.length) return null;

  const decide = (id: string, status: "confirmed" | "rejected") => {
    setError(null);
    review.mutate({ id, status }, { onError: (e) => setError(e.message) });
  };

  return (
    <>
      {pending.map((payment) => (
        <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <span>
            <span className="block font-medium">
              {item.employeeName} · {payment.amount} {payment.currencyCode}
            </span>
            <span className="block text-xs text-muted-foreground">
              {formatDateTime(payment.paidAt)}
              {payment.paymentMethod && ` · ${payment.paymentMethod.replace("_", " ")}`}
              {payment.reference && ` · ${payment.reference}`}
            </span>
            <ErrorText message={error} />
          </span>
          <span className="flex gap-2">
            <Button size="sm" disabled={review.isPending} onClick={() => decide(payment.id, "confirmed")}>
              Confirm
            </Button>
            <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => decide(payment.id, "rejected")}>
              Reject
            </Button>
          </span>
        </li>
      ))}
    </>
  );
};

const HistoryForLoan: React.FC<{ organizationId: string; item: Recoverable }> = ({
  organizationId,
  item,
}) => {
  const { data, isLoading } = useQuery(repaymentsQuery(organizationId, item.id));
  if (isLoading) return <Spinner />;
  if (!data?.length) return <p className="text-sm text-muted-foreground">No installments recorded yet.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {data.map((payment) => (
        <li key={payment.id} className="flex justify-between gap-3">
          <span>
            {formatDateTime(payment.paidAt)} · {payment.source}
            {payment.paymentMethod && ` · ${payment.paymentMethod.replace("_", " ")}`}
            {payment.reference && ` · ${payment.reference}`}
            {payment.status !== "confirmed" && ` · ${payment.status}`}
          </span>
          <span className="font-medium">
            {payment.amount} {payment.currencyCode}
          </span>
        </li>
      ))}
    </ul>
  );
};

const Installments: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const { data, isLoading, error } = useQuery(recoverablesQuery(organizationId));
  const [selectedId, setSelectedId] = useState("");

  const open = (data ?? []).filter((item) => item.status === "disbursed" || item.status === "active");
  const selected = open.find((item) => item.id === selectedId) ?? open[0];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Installments"
        description="Record installments manually and confirm payments submitted by employees."
      />
      <ErrorText message={error?.message} />
      {isLoading ? (
        <Spinner />
      ) : !open.length ? (
        <EmptyState text="No disbursed loans or advances awaiting repayment." />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-semibold">Awaiting confirmation</h2>
            <ul className="divide-y rounded-xl border empty:hidden">
              {open.map((item) => (
                <PendingForLoan key={item.id} organizationId={organizationId} item={item} />
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Payments submitted by employees appear here until you confirm or reject them.
            </p>
          </section>

          <section className="space-y-4 rounded-xl border p-4">
            <h2 className="font-semibold">Manual installment entry</h2>
            <Field label="Loan or advance">
              {(id) => (
                <select
                  id={id}
                  value={selected?.id ?? ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className={inputClass}
                >
                  {open.map((item) => (
                    <option key={item.id} value={item.id}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {selected && (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <p>Principal: <b>{selected.principalAmount}</b></p>
                  <p>Interest: <b>{Number(selected.annualInterestRate)}%</b></p>
                  <p>Repaid: <b>{selected.totalRepaid}</b></p>
                  <p>Remaining: <b>{selected.outstanding}</b></p>
                </div>
                <ManualEntry key={selected.id} organizationId={organizationId} item={selected} />
                <div className="space-y-2 border-t pt-3">
                  <h3 className="text-sm font-semibold">Installment history</h3>
                  <HistoryForLoan organizationId={organizationId} item={selected} />
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default Installments;
