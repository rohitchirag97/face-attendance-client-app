import { queryOptions } from "@tanstack/react-query";
import { request, useOrgMutation } from "@/hooks/use-payroll-api";

export type Branch = {
  id: string;
  name: string;
  code: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  ptState: string | null;
  ptFlatAmount: number | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
  gpsCheckIn: boolean;
  isActive: boolean;
  employeeCount: number;
  kioskCount: number;
  managers: { employeeId: string; name: string; role: string }[];
  /** False for branches outside a branch manager's own. */
  manageable: boolean;
};

export type BranchInput = {
  name: string;
  code?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  ptState?: string | null;
  ptFlatAmount?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadiusMeters: number;
  gpsCheckIn: boolean;
};

export type BranchList = { branches: Branch[]; unassignedCount: number; limitedTo: string[] | null };

const key = (organizationId: string) => ["branches", organizationId] as const;

export const branchesQuery = (organizationId: string, enabled = true) =>
  queryOptions({
    queryKey: key(organizationId),
    queryFn: () => request<BranchList>("/branches", organizationId),
    enabled: !!organizationId && enabled,
    staleTime: 60_000,
  });

const invalidate = (organizationId: string) => [key(organizationId), ["employees", organizationId]];

export const useCreateBranch = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (input: BranchInput) =>
    request<{ id: string }>("/branches", organizationId, "POST", input),
  );

export const useUpdateBranch = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), ({ id, ...input }: BranchInput & { id: string }) =>
    request<{ id: string }>(`/branches/${id}`, organizationId, "PUT", input),
  );

export const useSetBranchStatus = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), ({ id, isActive }: { id: string; isActive: boolean }) =>
    request<{ id: string }>(`/branches/${id}/status`, organizationId, "PATCH", { isActive }),
  );

export const useSetBranchManagers = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), ({ id, employeeIds }: { id: string; employeeIds: string[] }) =>
    request<{ branchId: string }>(`/branches/${id}/managers`, organizationId, "PUT", { employeeIds }),
  );

// ---------- GPS check-in ----------

export type GpsStatus = {
  enabled: boolean;
  branch: { name: string; latitude: number; longitude: number; radiusMeters: number } | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

const utcOffset = () => -new Date().getTimezoneOffset();

export const gpsStatusQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["gps-status", organizationId] as const,
    queryFn: () => request<GpsStatus>("/attendance/gps", organizationId, undefined, undefined, `&utcOffsetMinutes=${utcOffset()}`),
    enabled: !!organizationId,
  });

export const useGpsPunch = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["gps-status", organizationId], ["attendance", organizationId]],
    (input: { eventType: "check_in" | "check_out"; latitude: number; longitude: number; accuracyMeters: number }) =>
      request<{ occurredAt: string; distanceMeters: number; branchName: string }>("/attendance/gps", organizationId, "POST", {
        ...input,
        utcOffsetMinutes: utcOffset(),
      }),
  );

/** The phone's current position, asking for the most precise fix it can give. */
export const currentPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This browser cannot share your location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      reject(
        new Error(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Allow location for this site in your browser settings."
            : error.code === error.TIMEOUT
              ? "Getting your location took too long. Try again."
              : "Your location is unavailable right now.",
        ),
      );
    }, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
  });
