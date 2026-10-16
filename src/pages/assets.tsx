import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { ArrowLeftRight, Download, Loader2, PackagePlus, Save, Search, Trash2, UserPlus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import {
  assetHistoryQuery,
  assetsQuery,
  assignableEmployeesQuery,
  CATEGORY_LABEL,
  CONDITION_LABEL,
  downloadAssetsExcel,
  STATUS_STYLE,
  useAssignAsset,
  useDeleteAsset,
  useReturnAsset,
  useSaveAsset,
  useSetAssetStatus,
  type Asset,
  type AssetCategory,
  type AssetCondition,
  type AssetStatus,
} from "@/hooks/use-assets";
import { branchesQuery } from "@/hooks/use-branches";
import { inputClass } from "@/lib/form-utils";
import { formatMoney } from "@/lib/payroll-format";
import { getActiveOrganizationId } from "@/lib/session";

const today = () => new Date().toLocaleDateString("en-CA");
const CONDITIONS = Object.keys(CONDITION_LABEL) as AssetCondition[];

const ConditionSelect: React.FC<{ value: AssetCondition; onChange: (value: AssetCondition) => void; label?: string }> = ({ value, onChange, label = "Condition" }) => (
  <Field label={label}>
    {(id) => (
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as AssetCondition)} className={inputClass}>
        {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
      </select>
    )}
  </Field>
);

const AssetForm: React.FC<{ organizationId: string; asset?: Asset; onSaved: (asset: Asset) => void }> = ({ organizationId, asset, onSaved }) => {
  const save = useSaveAsset(organizationId);
  const { data: branchData } = useQuery(branchesQuery(organizationId));
  const branches = (branchData?.branches ?? []).filter((b) => b.manageable && (b.isActive || b.id === asset?.branchId));
  const [v, setV] = useState({
    assetTag: asset?.assetTag ?? "",
    name: asset?.name ?? "",
    category: asset?.category ?? ("laptop" as AssetCategory),
    serialNumber: asset?.serialNumber ?? "",
    brand: asset?.brand ?? "",
    model: asset?.model ?? "",
    purchaseDate: asset?.purchaseDate ?? "",
    purchaseCost: asset?.purchaseCost ?? "",
    warrantyUntil: asset?.warrantyUntil ?? "",
    branchId: asset?.branchId ?? (branchData?.limitedTo?.[0] ?? ""),
    condition: asset?.condition ?? ("new" as AssetCondition),
    notes: asset?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((current) => ({ ...current, [k]: value }));
  const text = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(k, e.target.value as never);

  const submit = () => {
    setError(null);
    if (!v.assetTag.trim() || !v.name.trim()) return setError("Enter the asset tag and name.");
    save.mutate(
      {
        id: asset?.id,
        assetTag: v.assetTag.trim(),
        name: v.name.trim(),
        category: v.category,
        serialNumber: v.serialNumber.trim() || null,
        brand: v.brand.trim() || null,
        model: v.model.trim() || null,
        purchaseDate: v.purchaseDate || null,
        purchaseCost: v.purchaseCost === "" ? null : Number(v.purchaseCost),
        warrantyUntil: v.warrantyUntil || null,
        branchId: v.branchId || null,
        condition: v.condition,
        notes: v.notes.trim() || null,
      },
      { onSuccess: onSaved, onError: (e) => setError(e.message) },
    );
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{asset ? `Edit ${asset.assetTag}` : "Add asset"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Asset tag" hint="The label on the item, e.g. LAP-014">{(id) => <input id={id} value={v.assetTag} onChange={text("assetTag")} maxLength={40} className={inputClass} />}</Field>
        <Field label="Name">{(id) => <input id={id} value={v.name} onChange={text("name")} maxLength={120} placeholder="Dell Latitude 5440" className={inputClass} />}</Field>
        <Field label="Category">
          {(id) => (
            <select id={id} value={v.category} onChange={text("category")} className={inputClass}>
              {(Object.keys(CATEGORY_LABEL) as AssetCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          )}
        </Field>
        <Field label="Serial / IMEI / registration no.">{(id) => <input id={id} value={v.serialNumber} onChange={text("serialNumber")} maxLength={80} className={inputClass} />}</Field>
        <Field label="Brand">{(id) => <input id={id} value={v.brand} onChange={text("brand")} maxLength={60} className={inputClass} />}</Field>
        <Field label="Model">{(id) => <input id={id} value={v.model} onChange={text("model")} maxLength={80} className={inputClass} />}</Field>
        <Field label="Purchase date">{(id) => <input id={id} type="date" value={v.purchaseDate} onChange={text("purchaseDate")} className={inputClass} />}</Field>
        <Field label="Purchase cost (₹)">{(id) => <input id={id} type="number" min={0} step="0.01" value={v.purchaseCost} onChange={text("purchaseCost")} className={inputClass} />}</Field>
        <Field label="Warranty until">{(id) => <input id={id} type="date" value={v.warrantyUntil} onChange={text("warrantyUntil")} className={inputClass} />}</Field>
        {branches.length > 0 && (
          <Field label="Branch">
            {(id) => (
              <select id={id} value={v.branchId} onChange={text("branchId")} className={inputClass}>
                {!branchData?.limitedTo && <option value="">None</option>}
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </Field>
        )}
        {(!asset || asset.status !== "assigned") && <ConditionSelect value={v.condition} onChange={(c) => set("condition", c)} />}
        <div className="sm:col-span-2">
          <Field label="Notes">{(id) => <input id={id} value={v.notes} onChange={text("notes")} maxLength={500} placeholder="Accessories, charger, PO number…" className={inputClass} />}</Field>
        </div>
      </div>
      <ErrorText message={error} />
      <Button disabled={save.isPending} onClick={submit}>{save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save asset</Button>
    </div>
  );
};

/** Hand over, take back, repair and retire: whichever applies to the asset's status. */
const AssetActions: React.FC<{ organizationId: string; asset: Asset }> = ({ organizationId, asset }) => {
  const { data: people = [] } = useQuery({ ...assignableEmployeesQuery(organizationId), enabled: asset.status === "available" });
  const assign = useAssignAsset(organizationId);
  const giveBack = useReturnAsset(organizationId);
  const status = useSetAssetStatus(organizationId);
  const remove = useDeleteAsset(organizationId);
  const [, setParams] = useSearchParams();
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(today());
  const [condition, setCondition] = useState<AssetCondition>(asset.condition);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const onError = (e: Error) => setError(e.message);
  const busy = assign.isPending || giveBack.isPending || status.isPending || remove.isPending;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      {asset.status === "available" && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold"><UserPlus className="size-4" /> Hand over</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Employee">
              {(id) => (
                <select id={id} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
                  <option value="">Choose…</option>
                  {people.map((p) => <option key={p.employeeId} value={p.employeeId}>{p.name}{p.code ? ` (${p.code})` : ""}</option>)}
                </select>
              )}
            </Field>
            <Field label="Handed over on">{(id) => <input id={id} type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={inputClass} />}</Field>
            <ConditionSelect value={condition} onChange={setCondition} />
          </div>
          <Field label="Notes (optional)">{(id) => <input id={id} value={notes} maxLength={300} placeholder="With charger and bag" onChange={(e) => setNotes(e.target.value)} className={inputClass} />}</Field>
          <Button disabled={busy || !employeeId} onClick={() => { setError(null); assign.mutate({ id: asset.id, employeeId, assignedOn: date, condition, notes: notes || undefined }, { onError }); }}>
            <UserPlus /> Hand over
          </Button>
        </div>
      )}

      {asset.status === "assigned" && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold"><ArrowLeftRight className="size-4" /> Take back from {asset.holder?.name}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Returned on">{(id) => <input id={id} type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={inputClass} />}</Field>
            <ConditionSelect value={condition} onChange={setCondition} label="Condition on return" />
          </div>
          <Field label="Notes (optional)">{(id) => <input id={id} value={notes} maxLength={300} placeholder="Screen scratched, charger missing…" onChange={(e) => setNotes(e.target.value)} className={inputClass} />}</Field>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => { setError(null); giveBack.mutate({ id: asset.id, returnedOn: date, condition, notes: notes || undefined, lost: false }, { onError }); }}>
              <ArrowLeftRight /> Record return
            </Button>
            <Button variant="outline" disabled={busy}
              onClick={() => {
                if (!window.confirm(`Record ${asset.name} as lost by ${asset.holder?.name}? It will be retired. Recover its cost in their salary or settlement if you need to.`)) return;
                setError(null);
                giveBack.mutate({ id: asset.id, returnedOn: date, condition: "damaged", notes: notes || "Not returned", lost: true }, { onError });
              }}>
              Not returned / lost
            </Button>
          </div>
        </div>
      )}

      {asset.status !== "assigned" && (
        <div className="space-y-3 border-t pt-4 first:border-0 first:pt-0">
          <h3 className="flex items-center gap-2 font-semibold"><Wrench className="size-4" /> Status</h3>
          <div className="flex flex-wrap items-end gap-2">
            {asset.status !== "in_repair" && asset.status !== "retired" && (
              <Button variant="outline" disabled={busy} onClick={() => status.mutate({ id: asset.id, status: "in_repair" }, { onError })}>Send for repair</Button>
            )}
            {asset.status !== "available" && (
              <Button variant="outline" disabled={busy} onClick={() => status.mutate({ id: asset.id, status: "available" }, { onError })}>
                {asset.status === "retired" ? "Bring back into use" : "Back from repair"}
              </Button>
            )}
            {asset.status !== "retired" && (
              <>
                <Field label="Retire because">{(id) => <input id={id} value={reason} maxLength={200} placeholder="Sold, scrapped, lost…" onChange={(e) => setReason(e.target.value)} className={`${inputClass} w-56`} />}</Field>
                <Button variant="outline" disabled={busy || !reason.trim()} onClick={() => status.mutate({ id: asset.id, status: "retired", reason }, { onError })}>Retire</Button>
              </>
            )}
            <Button variant="ghost" disabled={busy}
              onClick={() => {
                if (!window.confirm(`Delete ${asset.assetTag}? Only assets never handed to anyone can be deleted.`)) return;
                remove.mutate(asset.id, { onSuccess: () => setParams({}), onError });
              }}>
              <Trash2 /> Delete
            </Button>
          </div>
        </div>
      )}
      <ErrorText message={error} />
    </div>
  );
};

const History: React.FC<{ organizationId: string; assetId: string }> = ({ organizationId, assetId }) => {
  const { data } = useQuery(assetHistoryQuery(organizationId, assetId));
  if (!data?.history.length) return null;
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-2 font-semibold">Handover history</h3>
      <ul className="divide-y text-sm">
        {data.history.map((h) => (
          <li key={h.id} className="py-2">
            <span className="font-medium">{h.employeeName}</span>
            <span className="text-muted-foreground">
              {" "}· {h.assignedOn} ({CONDITION_LABEL[h.conditionOut]}) → {h.lost ? <span className="text-red-600">lost</span> : h.returnedOn ? `${h.returnedOn} (${CONDITION_LABEL[h.conditionIn ?? "good"]})` : "still holds it"}
              {h.acknowledgedAt ? " · receipt confirmed" : !h.returnedOn && !h.lost ? " · receipt not confirmed yet" : ""}
            </span>
            {(h.notesOut || h.notesIn) && <span className="block text-xs text-muted-foreground">{[h.notesOut, h.notesIn].filter(Boolean).join(" · ")}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

const warrantySoon = (date: string | null) => {
  if (!date) return null;
  const days = Math.round((Date.parse(date) - Date.now()) / 86_400_000);
  return days < 0 ? "Warranty expired" : days <= 60 ? `Warranty ends in ${days} day(s)` : null;
};

/** The asset register: what the company owns and who holds it. Owners, admins and HR. */
const AssetsPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const [params, setParams] = useSearchParams();
  const selected = params.get("asset");
  const { data: assets = [], isLoading, error } = useQuery(assetsQuery(organizationId));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AssetStatus | "">("");
  const [exportError, setExportError] = useState<string | null>(null);
  const asset = assets.find((a) => a.id === selected);

  const term = search.trim().toLowerCase();
  const shown = assets.filter(
    (a) =>
      (!status || a.status === status) &&
      (!term || [a.assetTag, a.name, a.serialNumber, a.brand, a.model, a.holder?.name, a.branchName, CATEGORY_LABEL[a.category]].some((x) => x?.toLowerCase().includes(term))),
  );
  const counts = (Object.keys(STATUS_STYLE) as AssetStatus[]).map((s) => ({ s, n: assets.filter((a) => a.status === s).length }));
  const value = assets.filter((a) => a.status !== "retired").reduce((sum, a) => sum + Number(a.purchaseCost ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader title="Assets" description="Laptops, phones, SIM and ID cards, vehicles and tools: who has what, since when, and in what condition." />
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorText message={error.message} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {counts.map(({ s, n }) => (
              <button key={s} type="button" onClick={() => setStatus(status === s ? "" : s)}
                className={`rounded-full px-3 py-1 ${STATUS_STYLE[s].className} ${status === s ? "ring-2 ring-primary" : ""}`}>
                {STATUS_STYLE[s].label}: {n}
              </button>
            ))}
            {value > 0 && <span className="text-muted-foreground">In use or in stock: {formatMoney(value, "INR")} at cost</span>}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="flex h-10 min-w-56 flex-1 items-center gap-2 rounded-md border bg-background px-3">
                  <Search className="size-4 text-muted-foreground" />
                  <input aria-label="Search assets" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tag, name, serial, employee…" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
                </div>
                <Button variant={selected === "new" ? "default" : "outline"} onClick={() => setParams({ asset: "new" })}><PackagePlus /> Add asset</Button>
                <Button variant="outline" disabled={!assets.length} onClick={() => { setExportError(null); downloadAssetsExcel(shown).catch((e: Error) => setExportError(e.message)); }}><Download /> Excel</Button>
              </div>
              <ErrorText message={exportError} />
              {shown.length === 0 ? (
                <EmptyState text={assets.length ? "No assets match." : "No assets yet. Add the laptops, phones and cards you hand out."} />
              ) : (
                <ul className="divide-y rounded-xl border bg-card">
                  {shown.map((a) => {
                    const warranty = warrantySoon(a.warrantyUntil);
                    return (
                      <li key={a.id}>
                        <button type="button" onClick={() => setParams({ asset: a.id })} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 ${selected === a.id ? "bg-primary/5" : ""}`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{a.assetTag} · {a.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[CATEGORY_LABEL[a.category], a.serialNumber, a.branchName].filter(Boolean).join(" · ")}
                              {a.holder ? ` · with ${a.holder.name}` : ""}
                            </p>
                            {warranty && a.status !== "retired" && <p className="text-xs text-amber-700 dark:text-amber-400">{warranty}</p>}
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[a.status].className}`}>{STATUS_STYLE[a.status].label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-4">
              {selected === "new" ? (
                <AssetForm key="new" organizationId={organizationId} onSaved={(saved) => setParams({ asset: saved.id })} />
              ) : asset ? (
                <>
                  <div className="rounded-xl border bg-card p-5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-lg font-semibold">{asset.assetTag} · {asset.name}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[asset.status].className}`}>{STATUS_STYLE[asset.status].label}</span>
                    </div>
                    <p className="text-muted-foreground">
                      {[CATEGORY_LABEL[asset.category], asset.brand, asset.model, asset.serialNumber && `S/N ${asset.serialNumber}`].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1">Condition: {CONDITION_LABEL[asset.condition]}{asset.holder ? ` · held by ${asset.holder.name}` : ""}{asset.retiredReason ? ` · ${asset.retiredReason}` : ""}</p>
                  </div>
                  <AssetActions key={`${asset.id}-${asset.status}`} organizationId={organizationId} asset={asset} />
                  <History organizationId={organizationId} assetId={asset.id} />
                  <AssetForm key={`edit-${asset.id}-${asset.status}`} organizationId={organizationId} asset={asset} onSaved={() => undefined} />
                </>
              ) : (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Choose an asset to hand it over, take it back or edit it.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AssetsPage;
