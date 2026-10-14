import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import {
  addDays,
  dayLabel,
  isoDate,
  myScheduleQuery,
  shiftHours,
  SWAP_STATUS,
  swapOptionsQuery,
  useCancelSwap,
  useRequestSwap,
  useRespondSwap,
} from "@/hooks/use-roster";
import { inputClass } from "@/lib/form-utils";
import { getActiveOrganizationId, getUser } from "@/lib/session";

const SwapForm: React.FC<{ organizationId: string; onDone: () => void }> = ({ organizationId, onDone }) => {
  const today = isoDate(new Date());
  const [date, setDate] = useState(addDays(today, 1));
  const [colleagueId, setColleagueId] = useState("");
  const [reason, setReason] = useState("");
  const { data: options, isLoading } = useQuery(swapOptionsQuery(organizationId, date));
  const request = useRequestSwap(organizationId);

  return (
    <div className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-semibold"><ArrowLeftRight className="size-4 text-primary" /> Ask to swap a shift</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date">
          {(id) => <input id={id} type="date" min={today} value={date} onChange={(e) => { setDate(e.target.value); setColleagueId(""); }} className={inputClass} />}
        </Field>
        <Field label="Swap with" hint={options ? `You work ${options.myShift ? `${options.myShift.name} (${shiftHours(options.myShift)})` : "no shift (day off)"} that day` : undefined}>
          {(id) => (
            <select id={id} value={colleagueId} onChange={(e) => setColleagueId(e.target.value)} disabled={isLoading} className={inputClass}>
              <option value="">{isLoading ? "Loading…" : options?.colleagues.length ? "Choose a colleague" : "Nobody works a different shift that day"}</option>
              {options?.colleagues.map((colleague) => (
                <option key={colleague.employeeId} value={colleague.employeeId}>
                  {colleague.employeeName} · {colleague.shift ? `${colleague.shift.name} (${shiftHours(colleague.shift)})` : "Day off"}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label="Reason (optional)">
        {(id) => <input id={id} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="e.g. Family function in the evening" />}
      </Field>
      <p className="text-xs text-muted-foreground">Your colleague accepts first, then a manager approves. Your roster changes only after approval.</p>
      <ErrorText message={request.error?.message ?? null} />
      <div className="flex gap-2">
        <Button disabled={!colleagueId || request.isPending} onClick={() => request.mutate({ colleagueId, date, reason: reason.trim() || undefined }, { onSuccess: onDone })}>
          {request.isPending && <Loader2 className="animate-spin" />} Send request
        </Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
};

/** Every employee's upcoming shifts, plus shift swaps with colleagues. */
const MySchedulePage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const from = isoDate(new Date());
  const to = addDays(from, 13);
  const { data, isLoading, error } = useQuery(myScheduleQuery(organizationId, from, to));
  const respond = useRespondSwap(organizationId);
  const cancel = useCancelSwap(organizationId);
  const [asking, setAsking] = useState(false);
  const me = getUser()?.id;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="My schedule"
        description="Your shifts for the next two weeks."
        action={!asking && <Button variant="outline" onClick={() => setAsking(true)}><ArrowLeftRight /> Swap a shift</Button>}
      />
      {asking && <SwapForm organizationId={organizationId} onDone={() => setAsking(false)} />}
      {isLoading ? (
        <Spinner />
      ) : !data ? (
        <ErrorText message={error?.message ?? "Could not load your schedule."} />
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.days.map((day) => (
              <li key={day.date} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${day.date === from ? "border-primary bg-primary/5" : "bg-card"}`}>
                <span className="text-sm font-medium">{day.date === from ? "Today" : dayLabel(day.date)}</span>
                <span className="text-right text-sm">
                  {day.shift ? (
                    <>
                      <span className="font-medium">{day.shift.name}</span>{" "}
                      <span className="text-muted-foreground">{shiftHours(day.shift)}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{day.source === "default" ? "No shift" : "Day off"}</span>
                  )}
                  {day.source === "override" && <span className="block text-xs text-muted-foreground">Changed for this day</span>}
                </span>
              </li>
            ))}
          </ul>

          <section className="space-y-3">
            <h2 className="font-semibold">Shift swaps</h2>
            {data.swaps.length === 0 ? (
              <EmptyState text="No swap requests yet." />
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {data.swaps.map((swap) => {
                  const incoming = swap.colleagueId === me;
                  const status = SWAP_STATUS[swap.status];
                  return (
                    <li key={swap.id} className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1 basis-60">
                        <p className="text-sm font-medium">{dayLabel(swap.date)}</p>
                        <p className="text-sm text-muted-foreground">
                          {incoming
                            ? `${swap.requesterName} wants your ${swap.colleagueShift} for their ${swap.requesterShift}`
                            : `You asked ${swap.colleagueName}: your ${swap.requesterShift} for their ${swap.colleagueShift}`}
                        </p>
                        {swap.reason && <p className="text-xs text-muted-foreground">Reason: {swap.reason}</p>}
                        {swap.reviewNote && <p className="text-xs text-muted-foreground">Manager: {swap.reviewNote}</p>}
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
                      {incoming && swap.status === "awaiting_colleague" && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" disabled={respond.isPending} onClick={() => respond.mutate({ swapId: swap.id, accept: false })}><X /> Decline</Button>
                          <Button size="sm" disabled={respond.isPending} onClick={() => respond.mutate({ swapId: swap.id, accept: true })}><Check /> Accept</Button>
                        </div>
                      )}
                      {!incoming && (swap.status === "awaiting_colleague" || swap.status === "awaiting_manager") && (
                        <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(swap.id)}>Cancel request</Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <ErrorText message={respond.error?.message ?? cancel.error?.message ?? null} />
          </section>
        </>
      )}
    </div>
  );
};

export default MySchedulePage;
