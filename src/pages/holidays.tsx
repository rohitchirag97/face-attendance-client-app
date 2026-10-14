import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import { inputClass } from "@/lib/form-utils";
import { holidaysQuery, useAddHoliday, useDeleteHoliday } from "@/hooks/use-payroll-api";
import { canManagePeople, getActiveOrganizationId } from "@/lib/session";

const formatDay = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const Holidays: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const isManager = canManagePeople(organizationId);
  const { data: holidays, isLoading, error: loadError } = useQuery(holidaysQuery(organizationId));
  const add = useAddHoliday(organizationId);
  const remove = useDeleteHoliday(organizationId);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const byYear = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof holidays>>();
    for (const holiday of holidays ?? []) {
      const year = holiday.date.slice(0, 4);
      groups.set(year, [...(groups.get(year) ?? []), holiday]);
    }
    return [...groups.entries()];
  }, [holidays]);

  const handleAdd = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Holiday name is required.");
    if (!date) return setError("Pick a date.");
    if (endDate && endDate < date) return setError("End date cannot be before the start date.");
    add.mutate(
      { name: name.trim(), date, ...(endDate ? { endDate } : {}) },
      {
        onSuccess: () => {
          setName("");
          setDate("");
          setEndDate("");
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Holidays"
        description="Company holidays are not working days: payroll does not count them, so nobody is marked absent or loses pay for them."
      />

      {isManager && (
        <form onSubmit={handleAdd} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3" noValidate>
          <div className="sm:col-span-3">
            <Field label="Holiday name">
              {(id) => (
                <input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Diwali" className={inputClass} />
              )}
            </Field>
          </div>
          <Field label="Date">
            {(id) => <input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Until (optional, for several days)">
            {(id) => (
              <input id={id} type="date" value={endDate} min={date || undefined} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
            )}
          </Field>
          <div className="flex items-end sm:justify-end">
            <Button type="submit" className="h-10" disabled={add.isPending}>
              {add.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Add holiday
            </Button>
          </div>
        </form>
      )}
      <ErrorText message={error ?? loadError?.message} />

      {isLoading ? (
        <Spinner />
      ) : !byYear.length ? (
        <EmptyState text="No holidays added yet." />
      ) : (
        byYear.map(([year, items]) => (
          <section key={year} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">{year}</h2>
            <ul className="divide-y rounded-xl border">
              {items.map((holiday) => (
                <li key={holiday.id} className="flex items-center gap-3 p-3">
                  <span className="w-28 shrink-0 text-sm text-muted-foreground">{formatDay(holiday.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{holiday.name}</span>
                  {isManager && (
                    <Button
                      variant="destructive"
                      size="icon"
                      aria-label={`Delete ${holiday.name} on ${holiday.date}`}
                      disabled={remove.isPending}
                      onClick={() => {
                        setError(null);
                        remove.mutate(holiday.id, { onError: (e) => setError(e.message) });
                      }}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
};

export default Holidays;
