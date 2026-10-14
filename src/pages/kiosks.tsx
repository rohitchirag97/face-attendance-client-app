import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, KeyRound, Loader2, Plus } from "lucide-react";
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
  useRotateKioskKey,
  useUpdateKiosk,
} from "@/hooks/use-payroll-api";
import { getActiveOrganizationId } from "@/lib/session";

type Credentials = { id: string; deviceName: string; apiKey: string };

const Kiosks: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const { data: kiosks, isLoading, error: loadError } = useQuery(kiosksQuery(organizationId));
  const create = useCreateKiosk(organizationId);
  const update = useUpdateKiosk(organizationId);
  const rotate = useRotateKioskKey(organizationId);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const handleCreate = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !identifier.trim()) return setError("Name and device identifier are required.");
    create.mutate(
      { name: name.trim(), deviceIdentifier: identifier.trim(), locationName: toTextOrNull(location) },
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
                  {!kiosk.isActive && <span className="ml-2 text-xs text-muted-foreground">Inactive</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {kiosk.deviceIdentifier}
                  {kiosk.locationName && ` · ${kiosk.locationName}`} · last seen{" "}
                  {kiosk.lastSeenAt ? formatDateTime(kiosk.lastSeenAt) : "never"}
                </p>
              </div>
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
