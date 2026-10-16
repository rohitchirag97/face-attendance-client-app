import { queryOptions } from "@tanstack/react-query";
import { request, useOrgMutation } from "@/hooks/use-payroll-api";

export type AssetCategory = "laptop" | "desktop" | "mobile" | "sim" | "id_card" | "access_card" | "vehicle" | "furniture" | "tool" | "other";
export type AssetStatus = "available" | "assigned" | "in_repair" | "retired";
export type AssetCondition = "new" | "good" | "fair" | "damaged";

export type Asset = {
  id: string;
  assetTag: string;
  name: string;
  category: AssetCategory;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  purchaseDate: string | null;
  purchaseCost: string | null;
  warrantyUntil: string | null;
  branchId: string | null;
  branchName: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  notes: string | null;
  retiredReason: string | null;
  holder: { employeeId: string; name: string } | null;
};

export type AssetInput = {
  assetTag: string;
  name: string;
  category: AssetCategory;
  serialNumber?: string | null;
  brand?: string | null;
  model?: string | null;
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  warrantyUntil?: string | null;
  branchId?: string | null;
  condition: AssetCondition;
  notes?: string | null;
};

export type AssetHolding = {
  assignmentId: string;
  assetId: string;
  assetTag: string;
  name: string;
  category: AssetCategory;
  serialNumber: string | null;
  purchaseCost: string | null;
  assignedOn: string;
  conditionOut: AssetCondition;
  notesOut: string | null;
  acknowledgedAt: string | null;
  returnedOn: string | null;
  conditionIn: AssetCondition | null;
  lost: boolean;
};

export type AssetHistoryEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  assignedOn: string;
  conditionOut: AssetCondition;
  notesOut: string | null;
  acknowledgedAt: string | null;
  returnedOn: string | null;
  conditionIn: AssetCondition | null;
  notesIn: string | null;
  lost: boolean;
};

const key = (organizationId: string) => ["assets", organizationId] as const;

export const assetsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "list"] as const,
    queryFn: () => request<Asset[]>("/assets", organizationId),
    enabled: !!organizationId,
  });

export const assetHistoryQuery = (organizationId: string, assetId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "history", assetId] as const,
    queryFn: () => request<{ asset: Asset; history: AssetHistoryEntry[] }>(`/assets/${assetId}/history`, organizationId),
    enabled: !!organizationId && !!assetId,
  });

export const assignableEmployeesQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "employees"] as const,
    queryFn: () => request<{ employeeId: string; name: string; code: string | null }[]>("/assets/employees", organizationId),
    enabled: !!organizationId,
  });

export const myAssetsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "mine"] as const,
    queryFn: () => request<{ current: AssetHolding[]; past: AssetHolding[] }>("/assets/mine", organizationId),
    enabled: !!organizationId,
  });

export const employeeAssetsQuery = (organizationId: string, employeeId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "employee", employeeId] as const,
    queryFn: () => request<{ current: AssetHolding[]; past: AssetHolding[] }>(`/assets/employee/${employeeId}`, organizationId),
    enabled: !!organizationId && !!employeeId,
  });

const invalidate = (organizationId: string) => [key(organizationId), ["settlements", organizationId]];

export const useSaveAsset = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), ({ id, ...input }: AssetInput & { id?: string }) =>
    id ? request<Asset>(`/assets/${id}`, organizationId, "PUT", input) : request<Asset>("/assets", organizationId, "POST", input),
  );

export const useDeleteAsset = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (id: string) => request<null>(`/assets/${id}`, organizationId, "DELETE"));

export const useAssignAsset = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), ({ id, ...body }: { id: string; employeeId: string; assignedOn: string; condition: AssetCondition; notes?: string }) =>
    request<Asset>(`/assets/${id}/assign`, organizationId, "POST", body),
  );

export const useReturnAsset = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), ({ id, ...body }: { id: string; returnedOn: string; condition: AssetCondition; notes?: string; lost: boolean }) =>
    request<Asset>(`/assets/${id}/return`, organizationId, "POST", body),
  );

export const useSetAssetStatus = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), ({ id, ...body }: { id: string; status: "available" | "in_repair" | "retired"; reason?: string }) =>
    request<Asset>(`/assets/${id}/status`, organizationId, "POST", body),
  );

export const useAcknowledgeAsset = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (assignmentId: string) =>
    request(`/assets/assignments/${assignmentId}/acknowledge`, organizationId, "POST"),
  );

export const CATEGORY_LABEL: Record<AssetCategory, string> = {
  laptop: "Laptop",
  desktop: "Desktop",
  mobile: "Mobile phone",
  sim: "SIM card",
  id_card: "ID card",
  access_card: "Access card",
  vehicle: "Vehicle",
  furniture: "Furniture",
  tool: "Tool / equipment",
  other: "Other",
};

export const STATUS_STYLE: Record<AssetStatus, { label: string; className: string }> = {
  available: { label: "Available", className: "bg-green-100 text-green-800" },
  assigned: { label: "Assigned", className: "bg-sky-100 text-sky-800" },
  in_repair: { label: "In repair", className: "bg-amber-100 text-amber-800" },
  retired: { label: "Retired", className: "bg-muted text-muted-foreground" },
};

export const CONDITION_LABEL: Record<AssetCondition, string> = { new: "New", good: "Good", fair: "Fair", damaged: "Damaged" };

/** The register as an Excel sheet. */
export const downloadAssetsExcel = async (assets: Asset[]) => {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Assets");
  const header = sheet.addRow(["Tag", "Name", "Category", "Brand", "Model", "Serial no.", "Branch", "Status", "Held by", "Condition", "Purchased", "Cost", "Warranty until", "Notes"]);
  header.font = { bold: true };
  for (const a of assets) {
    sheet.addRow([
      a.assetTag,
      a.name,
      CATEGORY_LABEL[a.category],
      a.brand ?? "",
      a.model ?? "",
      a.serialNumber ?? "",
      a.branchName ?? "",
      STATUS_STYLE[a.status].label + (a.retiredReason ? ` (${a.retiredReason})` : ""),
      a.holder?.name ?? "",
      CONDITION_LABEL[a.condition],
      a.purchaseDate ?? "",
      a.purchaseCost === null ? null : Number(a.purchaseCost),
      a.warrantyUntil ?? "",
      a.notes ?? "",
    ]);
  }
  sheet.columns.forEach((column, index) => (column.width = [12, 26, 14, 12, 14, 18, 14, 14, 20, 10, 12, 12, 13, 30][index]));
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `assets-${new Date().toLocaleDateString("en-CA")}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
};
