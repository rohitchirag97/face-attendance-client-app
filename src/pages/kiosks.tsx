import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, KeyRound, Link2, Loader2, Plus, ScanFace, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorText,
  Field,
  PageHeader,
  Spinner,
} from "@/components/form-kit";
import { formatDateTime, inputClass, toTextOrNull } from "@/lib/form-utils";
import {
  kiosksQuery,
  useCreateKiosk,
  useKioskCode,
  type KioskCodeKind,
  useRotateKioskKey,
  useUnpairKiosk,
  useUpdateKiosk,
} from "@/hooks/use-payroll-api";
import { getActiveOrganizationId } from "@/lib/session";
import { branchesQuery } from "@/hooks/use-branches";

type Credentials = { id: string; deviceName: string; apiKey: string };

// The kiosk app heartbeats every 60s; allow a couple of missed beats before calling it offline.
const ONLINE_WINDOW_MS = 3 * 60_000;

const CONNECTION = {
  online: { label: "Online", className: "bg-green-500/10 text-green-700 dark:text-green-400" },
  offline: { label: "Offline", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
  never: { label: "Not connected", className: "bg-muted text-muted-foreground" },
};

const connectionOf = (lastSeenAt: string | null) =>
  !lastSeenAt ? CONNECTION.never : Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS ? CONNECTION.online : CONNECTION.offline;

const Kiosks: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const { data: kiosks, isLoading, error: loadError } = useQuery({ ...kiosksQuery(organizationId), refetchInterval: 30_000 });
  const create = useCreateKiosk(organizationId);
  const update = useUpdateKiosk(organizationId);
  const rotate = useRotateKioskKey(organizationId);
  const kioskCode = useKioskCode(organizationId);
  const unpair = useUnpairKiosk(organizationId);
  const [issuedCode, setIssuedCode] = useState<{ deviceName: string; code: string; minutes: number; kind: KioskCodeKind } | null>(null);
  const requestCode = (kiosk: { id: string; name: string }, kind: KioskCodeKind) => {
    setError(null);
    kioskCode.mutate(
      { id: kiosk.id, kind },
      {
        onSuccess: (result) =>
          setIssuedCode({ deviceName: kiosk.name, code: result.code, minutes: Math.round(result.expiresInSeconds / 60), kind }),
        onError: (e) => setError(e.message),
      },
    );
  };
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [location, setLocation] = useState("");
  const [branchId, setBranchId] = useState("");
  const { data: branchData } = useQuery(branchesQuery(organizationId));
  const branches = (branchData?.branches ?? []).filter((b) => b.isActive);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const handleCreate = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !identifier.trim()) return setError("Name and device identifier are required.");
    create.mutate(
      { name: name.trim(), deviceIdentifier: identifier.trim(), locationName: toTextOrNull(location), branchId: branchId || null },
      {
        onSuccess: (kiosk) => {
          setCredentials({ id: kiosk.id, deviceName: kiosk.name, apiKey: kiosk.apiKey });
          setName("");
          setIdentifier("");
          setLocation("");
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Kiosk devices"
        description="Register the devices that perform face recognition and send attendance to the server."
      />

      {credentials && (
        <div role="status" className="space-y-2 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Credentials for {credentials.deviceName}</p>
          <p className="text-muted-foreground">Copy the API key now. It cannot be shown again.</p>
          <p>
            <span className="text-muted-foreground">Kiosk ID: </span>
            <code className="break-all">{credentials.id}</code>
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-background p-2">{credentials.apiKey}</code>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy API key"
              onClick={() => navigator.clipboard.writeText(credentials.apiKey)}
            >
              <Copy />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCredentials(null)}>
            I've saved it
          </Button>
        </div>
      )}

      {issuedCode && (
        <div role="status" className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">
          <p className="font-medium">
            {issuedCode.kind === "pairing-code" ? "Pair" : "Manager code for"} {issuedCode.deviceName}
          </p>
          <p className="text-muted-foreground">
            {issuedCode.kind === "pairing-code"
              ? `Enter this code in the kiosk app within ${issuedCode.minutes} minutes. Pairing replaces the device's current key.`
              : `On the kiosk, tap "Enroll" or "Settings" and enter this code within ${issuedCode.minutes} minutes. Both then stay open for about 15 minutes.`}
          </p>
          <p className="font-mono text-3xl font-semibold tracking-[0.3em]">{issuedCode.code}</p>
          <Button variant="ghost" size="sm" onClick={() => setIssuedCode(null)}>
            Done
          </Button>
        </div>
      )}

      <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3" noValidate>
        <Field label="Name">
          {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} />}
        </Field>
        <Field label="Device identifier" hint="Unique hardware or serial ID.">
          {(id) => <input id={id} value={identifier} onChange={(e) => setIdentifier(e.target.value)} maxLength={100} className={inputClass} />}
        </Field>
        <Field label="Location (optional)">
          {(id) => <input id={id} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} className={inputClass} />}
        </Field>
        {branches.length > 0 && (
          <Field label="Branch">
            {(id) => (
              <select id={id} value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
                <option value="">None</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </Field>
        )}
        <div className="sm:col-span-3 sm:text-right">
          <Button type="submit" className="h-10" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Register kiosk
          </Button>
        </div>
      </form>
      <ErrorText message={error ?? loadError?.message} />

      {isLoading ? (
        <Spinner />
      ) : !kiosks?.length ? (
        <EmptyState text="No kiosks registered yet." />
      ) : (
        <ul className="divide-y rounded-xl border">
          {kiosks.map((kiosk) => (
            <li key={kiosk.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {kiosk.name}
                  {kiosk.isActive && !kiosk.paired ? (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Not paired</span>
                  ) : kiosk.isActive ? (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${connectionOf(kiosk.lastSeenAt).className}`}>
                      {connectionOf(kiosk.lastSeenAt).label}
                    </span>
                  ) : (
                    <span className="ml-2 text-xs text-muted-foreground">Inactive</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {kiosk.deviceIdentifier}
                  {kiosk.locationName && ` · ${kiosk.locationName}`} · last seen{" "}
                  {kiosk.lastSeenAt ? formatDateTime(kiosk.lastSeenAt) : "never"}
                </p>
              </div>
              {branches.length > 0 && (
                <select
                  aria-label={`Branch of ${kiosk.name}`}
                  value={kiosk.branchId ?? ""}
                  disabled={update.isPending}
                  onChange={(e) => update.mutate({ id: kiosk.id, branchId: e.target.value || null }, { onError: (err) => setError(err.message) })}
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">No branch</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={rotate.isPending}
                onClick={() => {
                  setError(null);
                  rotate.mutate(kiosk.id, {
                    onSuccess: (result) =>
                      setCredentials({ id: result.id, deviceName: kiosk.name, apiKey: result.apiKey }),
                    onError: (e) => setError(e.message),
                  });
                }}
              >
                <KeyRound />
                Rotate key
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={kioskCode.isPending || !kiosk.isActive}
                onClick={() => requestCode(kiosk, "pairing-code")}
              >
                <Link2 />
                {kiosk.paired ? "Re-pair" : "Pair device"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={kioskCode.isPending || !kiosk.isActive || !kiosk.paired}
                onClick={() => requestCode(kiosk, "enrollment-code")}
              >
                <ScanFace />
                Manager code
              </Button>
              {kiosk.paired && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={unpair.isPending}
                  onClick={() => {
                    if (!window.confirm(`Unpair ${kiosk.name}? The device signs out within a minute and needs a new pairing code to be used again.`)) return;
                    setError(null);
                    unpair.mutate(kiosk.id, { onError: (e) => setError(e.message) });
                  }}
                >
                  <Unlink />
                  Unpair
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={update.isPending}
                onClick={() => {
                  setError(null);
                  update.mutate(
                    { id: kiosk.id, isActive: !kiosk.isActive },
                    { onError: (e) => setError(e.message) },
                  );
                }}
              >
                {kiosk.isActive ? "Deactivate" : "Activate"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Kiosks;
