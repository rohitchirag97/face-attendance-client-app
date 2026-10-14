import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Loader2, Plus, RotateCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import { shiftsQuery } from "@/hooks/use-payroll-api";
import {
  addDays,
  dayLabel,
  isoDate,
  rosterGridQuery,
  rotationsQuery,
  shiftCode,
  shiftColor,
  shiftHours,
  SWAP_STATUS,
  swapsQuery,
  useAssignRotation,
  useDeleteRotation,
  useEndRotation,
  useReviewSwap,
  useSaveRotation,
  useSetOverride,
  weekStart,
  type Rotation,
  type RotationStep,
  type ShiftInfo,
  type SwapStatus,
} from "@/hooks/use-roster";
import { inputClass } from "@/lib/form-utils";
import { getActiveOrganizationId, getUser, isOrganizationOwner } from "@/lib/session";

type Tab = "roster" | "rotations" | "swaps";

// ---------- Roster grid ----------

const CellEditor: React.FC<{
  organizationId: string;
  employeeId: string;
  date: string;
  shifts: ShiftInfo[];
  current: string | null;
  isOverride: boolean;
  onClose: () => void;
}> = ({ organizationId, employeeId, date, shifts, current, isOverride, onClose }) => {
  const save = useSetOverride(organizationId);
  const apply = (body: { shiftId?: string | null; clear?: boolean }) =>
    save.mutate({ employeeId, date, ...body }, { onSuccess: onClose });
  return (
    <div className="absolute left-0 top-full z-20 mt-1 w-48 space-y-1 rounded-lg border bg-popover p-2 text-left shadow-lg">
      <p className="px-1 text-xs font-medium text-muted-foreground">{dayLabel(date)}</p>
      {shifts.map((shift) => (
        <button key={shift.id} type="button" disabled={save.isPending} onClick={() => apply({ shiftId: shift.id })}
          className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted ${current === shift.id ? "font-semibold" : ""}`}>
          {shift.name} <span className="text-muted-foreground">{shiftHours(shift)}</span>
        </button>
      ))}
      <button type="button" disabled={save.isPending} onClick={() => apply({ shiftId: null })}
        className={`w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${current === null ? "font-semibold" : ""}`}>
        Day off
      </button>
      {isOverride && (
        <button type="button" disabled={save.isPending} onClick={() => apply({ clear: true })}
          className="w-full rounded px-2 py-1.5 text-left text-xs text-primary hover:bg-muted">
          Undo change (use rotation)
        </button>
      )}
      <button type="button" onClick={onClose} className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted">Close</button>
      <ErrorText message={save.error?.message ?? null} />
    </div>
  );
};

const AssignPanel: React.FC<{ organizationId: string; employeeIds: string[]; onDone: () => void }> = ({ organizationId, employeeIds, onDone }) => {
  const { data: rotations } = useQuery(rotationsQuery(organizationId));
  const assign = useAssignRotation(organizationId);
  const end = useEndRotation(organizationId);
  const active = (rotations ?? []).filter((rotation) => rotation.isActive);
  const [rotationId, setRotationId] = useState("");
  const [startsOn, setStartsOn] = useState(isoDate(new Date()));
  const [cycleDay, setCycleDay] = useState("1");
  const chosen = active.find((rotation) => rotation.id === (rotationId || active[0]?.id));
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <p className="basis-full text-sm font-medium">{employeeIds.length} selected</p>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">Create a rotation in the Rotations tab first.</p>
      ) : (
        <>
          <Field label="Rotation">
            {(id) => (
              <select id={id} value={chosen?.id ?? ""} onChange={(e) => setRotationId(e.target.value)} className={`${inputClass} w-48`}>
                {active.map((rotation) => <option key={rotation.id} value={rotation.id}>{rotation.name} ({rotation.cycleDays}-day cycle)</option>)}
              </select>
            )}
          </Field>
          <Field label="Starting">
            {(id) => <input id={id} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={`${inputClass} w-40`} />}
          </Field>
          <Field label="On cycle day" hint="Stagger crews: crew A on day 1, crew B on day 8, and so on">
            {(id) => <input id={id} type="number" min={1} max={chosen?.cycleDays ?? 1} value={cycleDay} onChange={(e) => setCycleDay(e.target.value)} className={`${inputClass} w-24`} />}
          </Field>
          <Button disabled={assign.isPending || !chosen}
            onClick={() => assign.mutate({ rotationId: chosen!.id, employeeIds, startsOn, cycleOffset: Math.max(0, Number(cycleDay || 1) - 1) }, { onSuccess: onDone })}>
            {assign.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />} Put on rotation
          </Button>
        </>
      )}
      <Button variant="outline" disabled={end.isPending} onClick={() => end.mutate({ employeeIds, fromDate: startsOn }, { onSuccess: onDone })}>
        Take off rotation from this date
      </Button>
      <div className="basis-full"><ErrorText message={assign.error?.message ?? end.error?.message ?? null} /></div>
    </div>
  );
};

const RosterTab: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [from, setFrom] = useState(weekStart(isoDate(new Date())));
  const [span, setSpan] = useState<7 | 14>(14);
  const to = addDays(from, span - 1);
  const { data, isLoading, error } = useQuery(rosterGridQuery(organizationId, from, to));
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const today = isoDate(new Date());
  const toggle = (employeeId: string) =>
    setSelected((current) => (current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Earlier" onClick={() => setFrom(addDays(from, -span))}><ChevronLeft /></Button>
        <Button variant="outline" onClick={() => setFrom(weekStart(today))}>This week</Button>
        <Button variant="outline" size="icon" aria-label="Later" onClick={() => setFrom(addDays(from, span))}><ChevronRight /></Button>
        <span className="text-sm text-muted-foreground">{dayLabel(from)} – {dayLabel(to)}</span>
        <select aria-label="Days shown" value={span} onChange={(e) => setSpan(Number(e.target.value) as 7 | 14)} className={`${inputClass} ml-auto w-auto`}>
          <option value={7}>1 week</option>
          <option value={14}>2 weeks</option>
        </select>
      </div>
      {selected.length > 0 && <AssignPanel organizationId={organizationId} employeeIds={selected} onDone={() => setSelected([])} />}
      {isLoading ? (
        <Spinner />
      ) : !data ? (
        <ErrorText message={error?.message ?? "Could not load the roster."} />
      ) : data.employees.length === 0 ? (
        <EmptyState text="No active employees yet." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            {data.shifts.map((shift) => (
              <span key={shift.id} className={`rounded px-2 py-0.5 ${shiftColor(data.shifts, shift.id)}`}>{shiftCode(shift.name)} {shift.name} {shiftHours(shift)}</span>
            ))}
            <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">OFF Day off</span>
            <span className="rounded border border-dashed px-2 py-0.5 text-muted-foreground">• changed for that day</span>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">Employee</th>
                  {data.days.map((date) => (
                    <th key={date} className={`px-1 py-2 text-center font-medium ${date === today ? "text-primary" : "text-muted-foreground"}`}>{dayLabel(date)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.employees.map((employee) => (
                  <tr key={employee.membershipId} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 min-w-48 bg-card px-3 py-2">
                      <label className="flex items-start gap-2">
                        <input type="checkbox" className="mt-0.5 accent-primary" checked={selected.includes(employee.employeeId)} onChange={() => toggle(employee.employeeId)} />
                        <span>
                          <span className="block text-sm font-medium">{employee.employeeName}</span>
                          <span className="block text-muted-foreground">{employee.rotation ?? "Default shift"}</span>
                        </span>
                      </label>
                    </td>
                    {employee.days.map((day) => {
                      const shift = data.shifts.find((item) => item.id === day.shiftId);
                      const cellKey = `${employee.employeeId}|${day.date}`;
                      return (
                        <td key={day.date} className="relative px-0.5 py-1 text-center">
                          <button type="button" onClick={() => setEditing(editing === cellKey ? null : cellKey)}
                            title={shift ? `${shift.name} ${shiftHours(shift)}` : "Day off"}
                            className={`relative w-full min-w-11 rounded px-1 py-1.5 font-semibold ${shiftColor(data.shifts, day.shiftId)}`}>
                            {shift ? shiftCode(shift.name) : "OFF"}
                            {day.source === "override" && <span className="absolute right-0.5 top-0 text-[10px]">•</span>}
                          </button>
                          {editing === cellKey && (
                            <CellEditor organizationId={organizationId} employeeId={employee.employeeId} date={day.date} shifts={data.shifts}
                              current={day.shiftId} isOverride={day.source === "override"} onClose={() => setEditing(null)} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Click a cell to change that one day. Tick employees to put them on a rotation.</p>
        </>
      )}
    </div>
  );
};

// ---------- Rotation patterns ----------

const RotationEditor: React.FC<{ organizationId: string; shifts: ShiftInfo[]; rotation: Rotation | null; onDone: () => void }> = ({
  organizationId,
  shifts,
  rotation,
  onDone,
}) => {
  const save = useSaveRotation(organizationId);
  const [name, setName] = useState(rotation?.name ?? "");
  const [isActive, setIsActive] = useState(rotation?.isActive ?? true);
  const [steps, setSteps] = useState<RotationStep[]>(rotation?.pattern ?? [{ shiftId: shifts[0]?.id ?? null, days: 6 }, { shiftId: null, days: 1 }]);
  const update = (index: number, patch: Partial<RotationStep>) => setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  const move = (index: number, by: number) =>
    setSteps((current) => {
      const next = [...current];
      const [step] = next.splice(index, 1);
      next.splice(index + by, 0, step);
      return next;
    });
  const preview = steps.flatMap((step) => Array.from({ length: Math.min(step.days, 31) }, () => step.shiftId));

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{rotation ? `Edit ${rotation.name}` : "New rotation"}</h2>
      <Field label="Name">{(id) => <input id={id} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. 3-shift weekly rotation" />}</Field>
      <div className="space-y-2">
        <span className="text-sm font-medium">Steps, in order (the cycle repeats)</span>
        {steps.map((step, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <span className="w-6 text-xs text-muted-foreground">{index + 1}.</span>
            <select aria-label="Shift" value={step.shiftId ?? ""} onChange={(e) => update(index, { shiftId: e.target.value || null })} className={`${inputClass} w-52`}>
              {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} ({shiftHours(shift)})</option>)}
              <option value="">Day off</option>
            </select>
            <span className="text-sm">for</span>
            <input aria-label="Days" type="number" min={1} max={31} value={step.days} onChange={(e) => update(index, { days: Math.max(1, Number(e.target.value || 1)) })} className={`${inputClass} w-20`} />
            <span className="text-sm">day{step.days === 1 ? "" : "s"}</span>
            <Button variant="ghost" size="icon" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button>
            <Button variant="ghost" size="icon" aria-label="Move down" disabled={index === steps.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
            <Button variant="ghost" size="icon" aria-label="Remove step" disabled={steps.length === 1} onClick={() => setSteps(steps.filter((_, i) => i !== index))}><Trash2 /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setSteps([...steps, { shiftId: shifts[0]?.id ?? null, days: 1 }])}><Plus /> Add step</Button>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">One cycle, {preview.length} days:</p>
        <div className="mt-1 flex flex-wrap gap-0.5">
          {preview.map((shiftId, index) => (
            <span key={index} className={`rounded px-1 py-0.5 text-[10px] font-semibold ${shiftColor(shifts, shiftId)}`}>
              {shiftId ? shiftCode(shifts.find((shift) => shift.id === shiftId)?.name ?? "") : "OFF"}
            </span>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-primary" /> Active</label>
      <ErrorText message={save.error?.message ?? null} />
      <div className="flex gap-2">
        <Button disabled={save.isPending || !name.trim()} onClick={() => save.mutate({ id: rotation?.id, name: name.trim(), pattern: steps, isActive }, { onSuccess: onDone })}>
          {save.isPending && <Loader2 className="animate-spin" />} Save rotation
        </Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
};

const RotationsTab: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { data: rotations, isLoading } = useQuery(rotationsQuery(organizationId));
  const { data: shifts } = useQuery(shiftsQuery(organizationId));
  const remove = useDeleteRotation(organizationId);
  const [editing, setEditing] = useState<Rotation | "new" | null>(null);
  const activeShifts: ShiftInfo[] = (shifts ?? []).filter((shift) => shift.isActive);

  if (isLoading) return <Spinner />;
  if (activeShifts.length === 0) return <EmptyState text="Create your shifts first (Shifts page), then build rotations from them." />;
  return (
    <div className="space-y-4">
      {editing ? (
        <RotationEditor key={editing === "new" ? "new" : editing.id} organizationId={organizationId} shifts={activeShifts}
          rotation={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <Button onClick={() => setEditing("new")}><Plus /> New rotation</Button>
      )}
      {(rotations ?? []).length === 0 ? (
        <EmptyState text="No rotations yet. A rotation repeats a pattern of shifts and days off, for example Morning 6 days, Off 1, Night 6, Off 1." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rotations!.map((rotation) => (
            <li key={rotation.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1 basis-60">
                <p className="font-medium">{rotation.name} {!rotation.isActive && <span className="text-xs font-normal text-muted-foreground">(inactive)</span>}</p>
                <p className="text-xs text-muted-foreground">
                  {rotation.pattern.map((step) => `${step.shiftId ? (activeShifts.find((shift) => shift.id === step.shiftId)?.name ?? "Shift") : "Off"} ×${step.days}`).join(" → ")}
                  {" · "}{rotation.cycleDays}-day cycle · {rotation.activeEmployees} on it
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(rotation)}>Edit</Button>
              <Button variant="ghost" size="icon" aria-label="Delete" disabled={remove.isPending} onClick={() => remove.mutate(rotation.id)}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      <ErrorText message={remove.error?.message ?? null} />
    </div>
  );
};

// ---------- Swap approvals ----------

const SwapsTab: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [status, setStatus] = useState<SwapStatus | undefined>("awaiting_manager");
  const { data, isLoading } = useQuery(swapsQuery(organizationId, status));
  const review = useReviewSwap(organizationId);
  const me = getUser()?.id;
  const owner = isOrganizationOwner(organizationId);
  return (
    <div className="space-y-4">
      <select aria-label="Status" value={status ?? ""} onChange={(e) => setStatus((e.target.value || undefined) as SwapStatus | undefined)} className={`${inputClass} w-auto`}>
        <option value="awaiting_manager">Waiting for approval</option>
        <option value="awaiting_colleague">Waiting for colleague</option>
        <option value="approved">Approved</option>
        <option value="rejected">Not approved</option>
        <option value="">All</option>
      </select>
      {isLoading ? <Spinner /> : !data?.length ? <EmptyState text="No swap requests here." /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.map((swap) => {
            const involved = swap.requesterId === me || swap.colleagueId === me;
            return (
              <li key={swap.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-sm font-medium">{dayLabel(swap.date)}</p>
                  <p className="text-sm">{swap.requesterName} ({swap.requesterShift}) ⇄ {swap.colleagueName} ({swap.colleagueShift})</p>
                  {swap.reason && <p className="text-xs text-muted-foreground">Reason: {swap.reason}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SWAP_STATUS[swap.status].className}`}>{SWAP_STATUS[swap.status].label}</span>
                {swap.status === "awaiting_manager" && (!involved || owner) && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ swapId: swap.id, approve: false })}><X /> Reject</Button>
                    <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ swapId: swap.id, approve: true })}><Check /> Approve</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ErrorText message={review.error?.message ?? null} />
    </div>
  );
};

/** Rotations, the roster grid and swap approvals for HR, admins and the owner. */
const ShiftRosterPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const [tab, setTab] = useState<Tab>("roster");
  const tabs: { value: Tab; label: string }[] = [
    { value: "roster", label: "Roster" },
    { value: "rotations", label: "Rotations" },
    { value: "swaps", label: "Swap requests" },
  ];
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <PageHeader
        title="Shift roster"
        description="Plan who works which shift each day. Attendance and payroll follow the roster: lateness is measured against that day's shift, and rostered days off are not absences."
      />
      <div className="flex gap-1 rounded-lg bg-muted p-1 sm:w-fit">
        {tabs.map((item) => (
          <button key={item.value} type="button" onClick={() => setTab(item.value)} aria-pressed={tab === item.value}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === item.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === "roster" && <RosterTab organizationId={organizationId} />}
      {tab === "rotations" && <RotationsTab organizationId={organizationId} />}
      {tab === "swaps" && <SwapsTab organizationId={organizationId} />}
    </div>
  );
};

export default ShiftRosterPage;
