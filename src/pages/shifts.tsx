import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorText,
  Field,
  PageHeader,
  Spinner,
} from "@/components/form-kit";
import { TimeInput } from "@/components/time-input";
import { formatTime12Hour, inputClass } from "@/lib/form-utils";
import { shiftsQuery, useDeleteShift, useSaveShift } from "@/hooks/use-payroll-api";
import { getActiveOrganizationId } from "@/lib/session";

const Shifts: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const { data: shifts, isLoading, error: loadError } = useQuery(shiftsQuery(organizationId));
  const save = useSaveShift(organizationId);
  const remove = useDeleteShift(organizationId);
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState("60");
  const [grace, setGrace] = useState("10");
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setEditingShiftId(null);
    setName("");
    setStartTime("09:00");
    setEndTime("18:00");
    setBreakMinutes("60");
    setGrace("10");
  };

  const handleAdd = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Shift name is required.");
    if (startTime === endTime) return setError("Start and end times must be different.");
    save.mutate(
      {
        id: editingShiftId ?? undefined,
        name: name.trim(),
        startTime,
        endTime,
        breakMinutes: Number(breakMinutes) || 0,
        gracePeriodMinutes: Number(grace) || 0,
      },
      { onSuccess: resetForm, onError: (e) => setError(e.message) },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Shifts"
        description="Define work shifts with AM/PM times. Overnight shifts are supported."
      />

      <form onSubmit={handleAdd} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <Field label="Name">
            {(id) => (
              <input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} />
            )}
          </Field>
        </div>
        <TimeInput label="Start time" value={startTime} onChange={setStartTime} />
        <TimeInput label="End time" value={endTime} onChange={setEndTime} />
        <Field label="Break (minutes)">
          {(id) => (
            <input id={id} type="number" min={0} max={600} value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} className={inputClass} />
          )}
        </Field>
        <Field label="Late grace period (minutes)">
          {(id) => (
            <input id={id} type="number" min={0} max={240} value={grace} onChange={(e) => setGrace(e.target.value)} className={inputClass} />
          )}
        </Field>
        <div className="sm:col-span-2 sm:text-right">
          <Button type="submit" className="h-10" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            {editingShiftId ? "Save changes" : "Add shift"}
          </Button>
          {editingShiftId && (
            <Button type="button" variant="outline" className="ml-2 h-10" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </form>
      <ErrorText message={error ?? loadError?.message} />

      {isLoading ? (
        <Spinner />
      ) : !shifts?.length ? (
        <EmptyState text="No shifts yet." />
      ) : (
        <ul className="divide-y rounded-xl border">
          {shifts.map((shift) => (
            <li key={shift.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{shift.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTime12Hour(shift.startTime)} – {formatTime12Hour(shift.endTime)} · break {shift.breakMinutes}m · grace{" "}
                  {shift.gracePeriodMinutes}m{!shift.isActive && " · Inactive"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={save.isPending}
                onClick={() => {
                  setError(null);
                  setEditingShiftId(shift.id);
                  setName(shift.name);
                  setStartTime(shift.startTime.slice(0, 5));
                  setEndTime(shift.endTime.slice(0, 5));
                  setBreakMinutes(String(shift.breakMinutes));
                  setGrace(String(shift.gracePeriodMinutes));
                }}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={save.isPending}
                onClick={() => {
                  setError(null);
                  save.mutate(
                    { id: shift.id, isActive: !shift.isActive },
                    { onError: (e) => setError(e.message) },
                  );
                }}
              >
                {shift.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                aria-label={`Delete ${shift.name}`}
                disabled={remove.isPending}
                onClick={() => {
                  setError(null);
                  remove.mutate(shift.id, { onError: (e) => setError(e.message) });
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Shifts;
