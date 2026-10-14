import { queryOptions } from "@tanstack/react-query";
import { request, useOrgMutation } from "@/hooks/use-payroll-api";

export type RosterSource = "override" | "rotation" | "default";
export type RotationStep = { shiftId: string | null; days: number };
export type ShiftInfo = { id: string; name: string; startTime: string; endTime: string; breakMinutes: number; gracePeriodMinutes: number };

export type Rotation = {
  id: string;
  name: string;
  pattern: RotationStep[];
  isActive: boolean;
  cycleDays: number;
  activeEmployees: number;
};

export type RosterGrid = {
  days: string[];
  shifts: ShiftInfo[];
  employees: {
    membershipId: string;
    employeeId: string;
    employeeName: string;
    employeeCode: string | null;
    rotation: string | null;
    days: { date: string; shiftId: string | null; source: RosterSource }[];
  }[];
};

export type SwapStatus = "awaiting_colleague" | "awaiting_manager" | "approved" | "rejected" | "cancelled";
export type Swap = {
  id: string;
  date: string;
  status: SwapStatus;
  reason: string | null;
  reviewNote: string | null;
  requesterId: string | null;
  colleagueId: string | null;
  requesterName: string;
  colleagueName: string;
  requesterShift: string;
  colleagueShift: string;
  createdAt: string;
};

export type MySchedule = {
  days: { date: string; source: RosterSource; shift: ShiftInfo | null }[];
  swaps: Swap[];
};

const key = (organizationId: string) => ["roster", organizationId] as const;
const range = (from: string, to: string, extra = "") => `&from=${from}&to=${to}${extra}`;

export const rotationsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "rotations"] as const,
    queryFn: () => request<Rotation[]>("/roster/rotations", organizationId),
    enabled: !!organizationId,
  });

export const rosterGridQuery = (organizationId: string, from: string, to: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "grid", from, to] as const,
    queryFn: () => request<RosterGrid>("/roster/grid", organizationId, undefined, undefined, range(from, to)),
    enabled: !!organizationId,
  });

export const myScheduleQuery = (organizationId: string, from: string, to: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "mine", from, to] as const,
    queryFn: () => request<MySchedule>("/roster/mine", organizationId, undefined, undefined, range(from, to)),
    enabled: !!organizationId,
  });

export const swapOptionsQuery = (organizationId: string, date: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "swap-options", date] as const,
    queryFn: () =>
      request<{ myShift: ShiftInfo | null; colleagues: { employeeId: string; employeeName: string; shift: ShiftInfo | null }[] }>(
        "/roster/swap-options",
        organizationId,
        undefined,
        undefined,
        `&date=${date}`,
      ),
    enabled: !!organizationId && !!date,
  });

export const swapsQuery = (organizationId: string, status?: SwapStatus) =>
  queryOptions({
    queryKey: [...key(organizationId), "swaps", status ?? "any"] as const,
    queryFn: () => request<Swap[]>("/roster/swaps", organizationId, undefined, undefined, status ? `&status=${status}` : ""),
    enabled: !!organizationId,
  });

const invalidate = (organizationId: string) => [key(organizationId)];

export const useSaveRotation = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (vars: { id?: string; name: string; pattern: RotationStep[]; isActive: boolean }) =>
    vars.id
      ? request(`/roster/rotations/${vars.id}`, organizationId, "PUT", { name: vars.name, pattern: vars.pattern, isActive: vars.isActive })
      : request("/roster/rotations", organizationId, "POST", { name: vars.name, pattern: vars.pattern, isActive: vars.isActive }),
  );

export const useDeleteRotation = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (id: string) => request(`/roster/rotations/${id}`, organizationId, "DELETE"));

export const useAssignRotation = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (body: { rotationId: string; employeeIds: string[]; startsOn: string; cycleOffset: number }) =>
    request("/roster/assign", organizationId, "POST", body),
  );

export const useEndRotation = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (body: { employeeIds: string[]; fromDate: string }) =>
    request("/roster/end", organizationId, "POST", body),
  );

export const useSetOverride = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (body: { employeeId: string; date: string; shiftId?: string | null; clear?: boolean }) =>
    request("/roster/override", organizationId, "PUT", body),
  );

export const useRequestSwap = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (body: { colleagueId: string; date: string; reason?: string }) =>
    request("/roster/swaps", organizationId, "POST", body),
  );

export const useRespondSwap = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (vars: { swapId: string; accept: boolean }) =>
    request(`/roster/swaps/${vars.swapId}/respond`, organizationId, "PATCH", { accept: vars.accept }),
  );

export const useCancelSwap = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (swapId: string) =>
    request(`/roster/swaps/${swapId}/cancel`, organizationId, "POST"),
  );

export const useReviewSwap = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (vars: { swapId: string; approve: boolean; note?: string }) =>
    request(`/roster/swaps/${vars.swapId}/review`, organizationId, "PATCH", { approve: vars.approve, note: vars.note || undefined }),
  );

// ---------- Display helpers ----------

// A stable colour per shift, by its position in the organization's shift list.
const PALETTE = [
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-800",
  "bg-emerald-100 text-emerald-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
  "bg-orange-100 text-orange-800",
  "bg-indigo-100 text-indigo-800",
];
export const shiftColor = (shifts: { id: string }[], shiftId: string | null) => {
  if (!shiftId) return "bg-muted text-muted-foreground";
  const index = shifts.findIndex((shift) => shift.id === shiftId);
  return PALETTE[(index < 0 ? 0 : index) % PALETTE.length];
};

/** "Morning" -> "MOR", for compact roster cells. */
export const shiftCode = (name: string) => name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "SH";
export const shiftHours = (shift: ShiftInfo) => `${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}`;

export const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
};
/** Monday of the week containing the date. */
export const weekStart = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  return addDays(iso, -((date.getDay() + 6) % 7));
};
export const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export const SWAP_STATUS: Record<SwapStatus, { label: string; className: string }> = {
  awaiting_colleague: { label: "Waiting for colleague", className: "bg-amber-100 text-amber-800" },
  awaiting_manager: { label: "Waiting for approval", className: "bg-sky-100 text-sky-800" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800" },
  rejected: { label: "Not approved", className: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};
