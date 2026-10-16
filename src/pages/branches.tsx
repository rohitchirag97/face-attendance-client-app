import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { Building2, Crosshair, ExternalLink, Loader2, MapPin, Plus, Save, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import { employeesQuery } from "@/hooks/use-api";
import {
  branchesQuery,
  currentPosition,
  useCreateBranch,
  useSetBranchManagers,
  useSetBranchStatus,
  useUpdateBranch,
  type Branch,
  type BranchInput,
} from "@/hooks/use-branches";
import { PT_STATE_OPTIONS } from "@/hooks/use-statutory";
import { inputClass } from "@/lib/form-utils";
import { getActiveOrganizationId } from "@/lib/session";

type FormValues = {
  name: string;
  code: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  ptState: string;
  ptFlatAmount: string;
  location: string;
  geofenceRadiusMeters: string;
  gpsCheckIn: boolean;
};

const toForm = (branch?: Branch): FormValues => ({
  name: branch?.name ?? "",
  code: branch?.code ?? "",
  addressLine1: branch?.addressLine1 ?? "",
  addressLine2: branch?.addressLine2 ?? "",
  city: branch?.city ?? "",
  state: branch?.state ?? "",
  postalCode: branch?.postalCode ?? "",
  ptState: branch?.ptState ?? "",
  ptFlatAmount: branch?.ptFlatAmount == null ? "" : String(branch.ptFlatAmount),
  location: branch?.latitude != null && branch.longitude != null ? `${branch.latitude}, ${branch.longitude}` : "",
  geofenceRadiusMeters: String(branch?.geofenceRadiusMeters ?? 200),
  gpsCheckIn: branch?.gpsCheckIn ?? false,
});

/** "18.92, 72.83" as copied from Google Maps; null for blank, undefined when it cannot be read. */
const parseLocation = (text: string): { latitude: number; longitude: number } | null | undefined => {
  if (!text.trim()) return null;
  const match = text.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!match) return undefined;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : undefined;
};

const BranchForm: React.FC<{ organizationId: string; branch?: Branch; onSaved: (id: string) => void }> = ({ organizationId, branch, onSaved }) => {
  const create = useCreateBranch(organizationId);
  const update = useUpdateBranch(organizationId);
  const [values, setValues] = useState<FormValues>(() => toForm(branch));
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const text = (key: keyof FormValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(key, event.target.value as never);
  const location = parseLocation(values.location);
  const saving = create.isPending || update.isPending;

  const useMyLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const position = await currentPosition();
      set("location", `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
      if (position.coords.accuracy > 100) setError(`Your device located you within ±${Math.round(position.coords.accuracy)} m only. Check the point on the map.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLocating(false);
    }
  };

  const save = () => {
    setError(null);
    if (!values.name.trim()) return setError("Enter the branch name.");
    if (location === undefined) return setError("Enter the location as latitude, longitude (for example 18.921984, 72.834654).");
    if (values.gpsCheckIn && !location) return setError("Set the branch location before turning on GPS check-in.");
    if (values.ptState === "FLAT" && !values.ptFlatAmount) return setError("Enter the monthly professional tax amount.");
    const input: BranchInput = {
      name: values.name.trim(),
      code: values.code.trim() || null,
      addressLine1: values.addressLine1.trim() || null,
      addressLine2: values.addressLine2.trim() || null,
      city: values.city.trim() || null,
      state: values.state.trim() || null,
      postalCode: values.postalCode.trim() || null,
      ptState: values.ptState || null,
      ptFlatAmount: values.ptState === "FLAT" ? Number(values.ptFlatAmount) : null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      geofenceRadiusMeters: Number(values.geofenceRadiusMeters) || 200,
      gpsCheckIn: values.gpsCheckIn,
    };
    const done = { onSuccess: (result: { id: string }) => onSaved(result.id), onError: (e: Error) => setError(e.message) };
    if (branch) update.mutate({ id: branch.id, ...input }, done);
    else create.mutate(input, done);
  };

  return (
    <div className="space-y-5 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{branch ? `Edit ${branch.name}` : "New branch"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">{(id) => <input id={id} value={values.name} onChange={text("name")} maxLength={100} placeholder="e.g. Andheri office" className={inputClass} />}</Field>
        <Field label="Code" hint="Optional short code, e.g. MUM-01">{(id) => <input id={id} value={values.code} onChange={text("code")} maxLength={32} className={inputClass} />}</Field>
        <Field label="Address">{(id) => <input id={id} value={values.addressLine1} onChange={text("addressLine1")} maxLength={200} className={inputClass} />}</Field>
        <Field label="Address line 2">{(id) => <input id={id} value={values.addressLine2} onChange={text("addressLine2")} maxLength={200} className={inputClass} />}</Field>
        <Field label="City">{(id) => <input id={id} value={values.city} onChange={text("city")} maxLength={100} className={inputClass} />}</Field>
        <Field label="State">{(id) => <input id={id} value={values.state} onChange={text("state")} maxLength={100} className={inputClass} />}</Field>
        <Field label="PIN code">{(id) => <input id={id} value={values.postalCode} onChange={text("postalCode")} maxLength={20} className={inputClass} />}</Field>
        <Field label="Professional tax" hint="When PT is on in statutory settings, this branch's employees use this state's slabs">
          {(id) => (
            <select id={id} value={values.ptState} onChange={text("ptState")} className={inputClass}>
              <option value="">Same as the organization</option>
              {PT_STATE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
        </Field>
        {values.ptState === "FLAT" && (
          <Field label="Monthly PT amount">{(id) => <input id={id} type="number" min={0} max={2500} value={values.ptFlatAmount} onChange={text("ptFlatAmount")} className={inputClass} />}</Field>
        )}
      </div>

      <div className="space-y-3 border-t pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4" /> Location and GPS check-in</h3>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field label="Latitude, longitude" hint="In Google Maps, right-click the entrance and click the numbers to copy them, or stand there and use your location.">
            {(id) => <input id={id} value={values.location} onChange={text("location")} placeholder="18.921984, 72.834654" className={inputClass} />}
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={locating} onClick={useMyLocation}>
              {locating ? <Loader2 className="animate-spin" /> : <Crosshair />} Use my location
            </Button>
            {location && (
              <a href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border px-3 text-sm hover:bg-muted">
                <ExternalLink className="size-4" /> Map
              </a>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Check-in radius (metres)" hint="Phone GPS is usually accurate to 10–50 m; 150–300 m suits most offices">
            {(id) => <input id={id} type="number" min={50} max={5000} step={10} value={values.geofenceRadiusMeters} onChange={text("geofenceRadiusMeters")} className={inputClass} />}
          </Field>
          <label className="flex items-start gap-2 self-center text-sm">
            <input type="checkbox" className="mt-0.5 accent-primary" checked={values.gpsCheckIn} onChange={(e) => set("gpsCheckIn", e.target.checked)} />
            <span>
              Let this branch's employees check in from their phone
              <span className="block text-xs text-muted-foreground">Only inside the radius. Kiosk face check-in keeps working too.</span>
            </span>
          </label>
        </div>
      </div>

      <ErrorText message={error} />
      <Button disabled={saving} onClick={save}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Save branch</Button>
    </div>
  );
};

const ManagersEditor: React.FC<{ organizationId: string; branch: Branch }> = ({ organizationId, branch }) => {
  const { data: people = [] } = useQuery(employeesQuery(organizationId));
  const save = useSetBranchManagers(organizationId);
  const [chosen, setChosen] = useState<string[]>(branch.managers.map((m) => m.employeeId));
  const candidates = people.filter((p) => p.isActive && (p.role === "admin" || p.role === "hr"));
  const toggle = (id: string) => setChosen((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  return (
    <div className="space-y-3 rounded-xl border bg-card p-5">
      <h3 className="flex items-center gap-2 font-semibold"><Users className="size-4" /> Branch managers</h3>
      <p className="text-sm text-muted-foreground">
        Admins and HR chosen here are limited to the branches they manage: they see and manage only those branches' employees,
        attendance, leave and expenses, and lose access to payroll and organization settings. Admins and HR not managing any
        branch keep the whole organization.
      </p>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No admins or HR yet. Give someone the admin or HR role first.</p>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2">
          {candidates.map((person) => (
            <li key={person.id}>
              <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                <input type="checkbox" className="accent-primary" checked={chosen.includes(person.id)} onChange={() => toggle(person.id)} />
                <span>{person.fname} {person.lname}</span>
                <span className="text-xs uppercase text-muted-foreground">{person.role}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <ErrorText message={save.error?.message ?? null} />
      <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate({ id: branch.id, employeeIds: chosen })}>
        {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save managers
      </Button>
      {save.isSuccess && <p className="text-xs text-green-700 dark:text-green-400">Saved. Managers see the change the next time they sign in or switch organization.</p>}
    </div>
  );
};

const BranchSummary: React.FC<{ branch: Branch }> = ({ branch }) => {
  const pt = PT_STATE_OPTIONS.find((s) => s.value === branch.ptState)?.label;
  return (
    <div className="space-y-1 text-sm">
      {(branch.addressLine1 || branch.city) && (
        <p className="text-muted-foreground">{[branch.addressLine1, branch.addressLine2, branch.city, branch.state, branch.postalCode].filter(Boolean).join(", ")}</p>
      )}
      <p>{branch.employeeCount} employee(s) · {branch.kioskCount} kiosk(s){pt ? ` · PT: ${pt}` : ""}</p>
      <p>
        {branch.gpsCheckIn ? (
          <span className="text-green-700 dark:text-green-400">GPS check-in within {branch.geofenceRadiusMeters} m</span>
        ) : branch.latitude != null ? (
          <span className="text-muted-foreground">Location set; GPS check-in off</span>
        ) : (
          <span className="text-muted-foreground">No location set</span>
        )}
      </p>
      {branch.managers.length > 0 && <p className="text-muted-foreground">Managed by {branch.managers.map((m) => m.name).join(", ")}</p>}
    </div>
  );
};

/** Branches and locations: offices or sites with their own holidays, PT state, managers and GPS check-in. */
const BranchesPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const [params, setParams] = useSearchParams();
  const selected = params.get("branch");
  const { data, isLoading, error } = useQuery(branchesQuery(organizationId));
  const status = useSetBranchStatus(organizationId);
  const canEdit = !!data && !data.limitedTo;
  const branch = data?.branches.find((b) => b.id === selected);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Branches & locations"
        description="Offices, sites and stores. Each can have its own holidays, professional tax state, managers and GPS check-in area."
      />
      {isLoading ? (
        <Spinner />
      ) : !data ? (
        <ErrorText message={error?.message ?? "Could not load branches."} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="h-fit space-y-2">
            {canEdit && (
              <Button className="w-full" variant={selected === "new" ? "default" : "outline"} onClick={() => setParams({ branch: "new" })}>
                <Plus /> Add branch
              </Button>
            )}
            {data.branches.length > 0 && (
              <ul className="divide-y rounded-xl border bg-card">
                {data.branches.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => setParams({ branch: b.id })}
                      className={`w-full px-4 py-3 text-left hover:bg-muted/50 ${selected === b.id ? "bg-primary/5" : ""} ${b.isActive ? "" : "opacity-60"}`}>
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {b.name}
                        {b.code && <span className="text-xs text-muted-foreground">{b.code}</span>}
                        {!b.isActive && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Closed</span>}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {[b.city, `${b.employeeCount} employee(s)`, b.gpsCheckIn ? "GPS on" : null].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {data.unassignedCount > 0 && data.branches.length > 0 && canEdit && (
              <p className="px-1 text-xs text-amber-700 dark:text-amber-400">
                {data.unassignedCount} active employee(s) have no branch. Set it on each employee's Employment details.
              </p>
            )}
          </div>

          {selected === "new" && canEdit ? (
            <BranchForm key="new" organizationId={organizationId} onSaved={(id) => setParams({ branch: id })} />
          ) : branch ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-5">
                <div className="space-y-2">
                  <h2 className="flex items-center gap-2 text-lg font-semibold"><Building2 className="size-5" /> {branch.name}</h2>
                  <BranchSummary branch={branch} />
                </div>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={status.isPending}
                    onClick={() => {
                      if (branch.isActive && !window.confirm(`Close ${branch.name}? GPS check-in stops and its managers return to the whole organization.`)) return;
                      status.mutate({ id: branch.id, isActive: !branch.isActive });
                    }}
                  >
                    {branch.isActive ? "Close branch" : "Reopen branch"}
                  </Button>
                )}
              </div>
              <ErrorText message={status.error?.message ?? null} />
              {canEdit && branch.isActive && (
                <>
                  <BranchForm key={branch.id} organizationId={organizationId} branch={branch} onSaved={() => undefined} />
                  <ManagersEditor key={`m-${branch.id}`} organizationId={organizationId} branch={branch} />
                </>
              )}
            </section>
          ) : data.branches.length === 0 ? (
            <EmptyState text={canEdit ? "No branches yet. A single-location company doesn't need any; add branches when you have more than one office or site, or to use GPS check-in." : "No branches yet."} />
          ) : (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Choose a branch to see or edit it.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default BranchesPage;
