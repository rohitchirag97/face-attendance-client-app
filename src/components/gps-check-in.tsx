import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LogIn, LogOut, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentPosition, gpsStatusQuery, useGpsPunch } from "@/hooks/use-branches";

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** Check in or out from the phone, inside the branch's geofence. Hidden unless the branch allows it. */
const GpsCheckIn: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { data } = useQuery(gpsStatusQuery(organizationId));
  const punch = useGpsPunch(organizationId);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  if (!data?.enabled || !data.branch) return null;

  // After checking out, a later check-out replaces it (the last one counts), so it stays a check-out.
  const eventType = data.checkedInAt ? "check_out" : "check_in";
  const finished = !!data.checkedInAt && !!data.checkedOutAt;
  const busy = locating || punch.isPending;

  const go = async () => {
    setError(null);
    setDone(null);
    setLocating(true);
    let position: GeolocationPosition;
    try {
      position = await currentPosition();
    } catch (e) {
      setError((e as Error).message);
      return;
    } finally {
      setLocating(false);
    }
    punch.mutate(
      { eventType, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy },
      {
        onSuccess: (result) => setDone(`${eventType === "check_in" ? "Checked in" : "Checked out"} at ${time(result.occurredAt)}, ${result.distanceMeters} m from ${result.branchName}.`),
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"><MapPin className="size-5" /></span>
        <div>
          <p className="font-medium">GPS check-in · {data.branch.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.checkedInAt ? `In at ${time(data.checkedInAt)}` : "Not checked in today"}
            {data.checkedOutAt ? ` · out at ${time(data.checkedOutAt)}` : ""}
            {` · works within ${data.branch.radiusMeters} m of the branch`}
          </p>
          {done && <p className="mt-1 text-sm text-green-700 dark:text-green-400">{done}</p>}
          {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
      <Button onClick={go} disabled={busy} variant={eventType === "check_out" ? "outline" : "default"}>
        {busy ? <Loader2 className="animate-spin" /> : eventType === "check_in" ? <LogIn /> : <LogOut />}
        {locating ? "Finding you…" : eventType === "check_in" ? "Check in" : finished ? "Check out again" : "Check out"}
      </Button>
    </div>
  );
};

export default GpsCheckIn;
