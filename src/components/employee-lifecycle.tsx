import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { hasManagerRole } from "@/lib/session";
import { ListPlus, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Spinner } from "@/components/form-kit";
import { inputClass, toNumberOrNull } from "@/lib/form-utils";
import {
  employeeExitQuery,
  lifecycleTasksQuery,
  useExitActions,
  useLifecycleActions,
  type ExitType,
  type LifecycleKind,
} from "@/hooks/use-employee-records";

const today = () => new Date().toISOString().slice(0, 10);

const Checklist: React.FC<{
  organizationId: string;
  employeeId: string;
  kind: LifecycleKind;
  title: string;
  intro: string;
}> = ({ organizationId, employeeId, kind, title, intro }) => {
  const { data: tasks, isLoading, error: loadError } = useQuery(
    lifecycleTasksQuery(organizationId, employeeId, kind),
  );
  const actions = useLifecycleActions(organizationId, employeeId);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const onError = (e: Error) => setError(e.message);
  const done = tasks?.filter((task) => task.isDone).length ?? 0;

  return (
    <section className="space-y-3 rounded-xl border bg-background p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
      </div>
      <ErrorText message={error ?? loadError?.message} />
      {isLoading ? (
        <Spinner />
      ) : !tasks?.length ? (
        <Button
          type="button"
          variant="outline"
          disabled={actions.start.isPending}
          onClick={() => {
            setError(null);
            actions.start.mutate(kind, { onError });
          }}
        >
          {actions.start.isPending ? <Loader2 className="animate-spin" /> : <ListPlus />}
          Start {kind} checklist
        </Button>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {done} of {tasks.length} done
          </p>
          <ul className="divide-y rounded-lg border">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  checked={task.isDone}
                  aria-label={task.title}
                  disabled={actions.toggle.isPending}
                  onChange={(e) => {
                    setError(null);
                    actions.toggle.mutate({ id: task.id, isDone: e.target.checked }, { onError });
                  }}
                />
                <span className={`flex-1 text-sm ${task.isDone ? "text-muted-foreground line-through" : ""}`}>
                  {task.title}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${task.title}`}
                  disabled={actions.remove.isPending}
                  onClick={() => {
                    setError(null);
                    actions.remove.mutate(task.id, { onError });
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!newTitle.trim()) return;
              setError(null);
              actions.add.mutate(
                { kind, title: newTitle.trim() },
                { onSuccess: () => setNewTitle(""), onError },
              );
            }}
          >
            <input
              value={newTitle}
              maxLength={150}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add a task"
              aria-label="New task"
              className={inputClass}
            />
            <Button type="submit" className="h-10" disabled={actions.add.isPending}>
              <Plus /> Add
            </Button>
          </form>
        </>
      )}
    </section>
  );
};

const STATUS_TEXT = {
  notice: "Serving notice",
  completed: "Exit completed",
  cancelled: "Exit cancelled",
} as const;

const ExitCard: React.FC<{ organizationId: string; employeeId: string; isSelf: boolean }> = ({
  organizationId,
  employeeId,
  isSelf,
}) => {
  const { data: exit, isLoading, error: loadError } = useQuery(
    employeeExitQuery(organizationId, employeeId),
  );
  const actions = useExitActions(organizationId, employeeId);
  const [exitType, setExitType] = useState<ExitType>("resignation");
  const [resignationDate, setResignationDate] = useState(today());
  const [noticeDays, setNoticeDays] = useState("30");
  const [lastDay, setLastDay] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = actions.save.isPending || actions.complete.isPending || actions.cancel.isPending;
  const onError = (e: Error) => setError(e.message);
  const inProgress = exit?.status === "notice";

  const handleSave = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const days = toNumberOrNull(noticeDays);
    if (days === null || !Number.isInteger(days) || days < 0 || days > 365) {
      return setError("Notice period must be a whole number of days between 0 and 365.");
    }
    if (lastDay && lastDay < resignationDate) {
      return setError("Last working day cannot be before the resignation date.");
    }
    actions.save.mutate(
      {
        exitType,
        resignationDate,
        noticeDays: days,
        ...(lastDay ? { lastWorkingDay: lastDay } : {}),
        reason: reason.trim() || null,
        notes: notes.trim() || null,
      },
      { onSuccess: () => setLastDay(""), onError },
    );
  };

  if (isLoading) return <Spinner />;

  return (
    <section className="space-y-4 rounded-xl border bg-background p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="font-semibold">Exit &amp; notice period</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Record a resignation or termination. Completing the exit deactivates the employee in this
          organization. Run their final payroll before completing it.
        </p>
      </div>
      <ErrorText message={error ?? loadError?.message} />

      {exit && exit.status !== "cancelled" && (
        <div className="space-y-1 rounded-lg border p-4 text-sm">
          <p className="font-medium">{STATUS_TEXT[exit.status]}</p>
          <p className="text-muted-foreground">
            {exit.exitType[0].toUpperCase() + exit.exitType.slice(1)} on {exit.resignationDate} ·{" "}
            {exit.noticeDays} days notice · last working day {exit.lastWorkingDay}
          </p>
          {exit.reason && <p className="text-muted-foreground">Reason: {exit.reason}</p>}
          {hasManagerRole(organizationId) && !isSelf && (
            <Link to={`/settlements?employee=${employeeId}`} className="inline-block pt-1 font-medium text-primary hover:underline">
              Open full &amp; final settlement →
            </Link>
          )}
        </div>
      )}

      {isSelf ? (
        <p className="text-sm text-muted-foreground">Ask another admin to manage your own exit.</p>
      ) : (
        <>
          {inProgress && (
            <div className="flex flex-wrap gap-2">
              {confirmComplete ? (
                <>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmComplete(false)}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => {
                      setError(null);
                      actions.complete.mutate(undefined, { onError });
                    }}
                  >
                    {actions.complete.isPending && <Loader2 className="animate-spin" />}
                    Confirm: complete exit and deactivate
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" disabled={busy} onClick={() => setConfirmComplete(true)}>
                    Complete exit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setError(null);
                      actions.cancel.mutate(undefined, { onError });
                    }}
                  >
                    Cancel exit
                  </Button>
                </>
              )}
            </div>
          )}

          {exit?.status !== "completed" && (
            <form onSubmit={handleSave} className="grid gap-4 border-t pt-4 sm:grid-cols-2" noValidate>
              <p className="text-sm font-medium sm:col-span-2">
                {inProgress ? "Update exit details" : "Start an exit"}
              </p>
              <Field label="Type">
                {(id) => (
                  <select id={id} value={exitType} onChange={(e) => setExitType(e.target.value as ExitType)} className={inputClass}>
                    <option value="resignation">Resignation</option>
                    <option value="termination">Termination</option>
                    <option value="retirement">Retirement</option>
                    <option value="other">Other</option>
                  </select>
                )}
              </Field>
              <Field label="Resignation / notice date">
                {(id) => (
                  <input id={id} type="date" value={resignationDate} onChange={(e) => setResignationDate(e.target.value)} className={inputClass} />
                )}
              </Field>
              <Field label="Notice period (days)">
                {(id) => (
                  <input id={id} type="number" min="0" max="365" value={noticeDays} onChange={(e) => setNoticeDays(e.target.value)} className={inputClass} />
                )}
              </Field>
              <Field label="Last working day (optional)" hint="Leave empty to use notice date + notice period.">
                {(id) => (
                  <input id={id} type="date" value={lastDay} min={resignationDate} onChange={(e) => setLastDay(e.target.value)} className={inputClass} />
                )}
              </Field>
              <div className="sm:col-span-2">
                <Field label="Reason (optional)">
                  {(id) => (
                    <input id={id} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className={inputClass} />
                  )}
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Internal notes (optional)">
                  {(id) => (
                    <textarea id={id} value={notes} maxLength={1000} rows={3} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} h-auto py-2`} />
                  )}
                </Field>
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" className="h-10" disabled={busy}>
                  {actions.save.isPending && <Loader2 className="animate-spin" />}
                  {inProgress ? "Update exit" : "Start exit"}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
};

const EmployeeLifecycle: React.FC<{
  organizationId: string;
  employeeId: string;
  isSelf: boolean;
}> = ({ organizationId, employeeId, isSelf }) => (
  <div className="space-y-4">
    <Checklist
      organizationId={organizationId}
      employeeId={employeeId}
      kind="onboarding"
      title="Onboarding"
      intro="Steps to get this employee set up. Tick them off as they are completed."
    />
    <ExitCard organizationId={organizationId} employeeId={employeeId} isSelf={isSelf} />
    <Checklist
      organizationId={organizationId}
      employeeId={employeeId}
      kind="offboarding"
      title="Offboarding checklist"
      intro="Created automatically when an exit is started."
    />
  </div>
);

export default EmployeeLifecycle;
