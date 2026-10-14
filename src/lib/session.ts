export type Organization = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  membershipActive: boolean;
  status?: "active" | "suspended" | "pending_deletion";
  role?: "super_admin" | "admin" | "hr" | "employee";
};

const isSelectableOrganization = (organization: Organization) =>
  organization.isActive && organization.membershipActive && (organization.status ?? "active") === "active";

export type User = {
  id: string;
  fname: string;
  lname: string;
  phone: string;
  email?: string | null;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  isPlatformAdmin?: boolean;
};

// Accounts created through Google hold a "g…" placeholder until a real phone is linked.
export const displayPhone = (user: Pick<User, "phone">) =>
  user.phone.startsWith("g") ? null : `+${user.phone}`;

export const hasSelectableOrganization = (organizations = getOrganizations()) =>
  organizations.some(isSelectableOrganization);

const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const saveSession = (data: {
  user: User;
  userOrganizations: Organization[];
  accessToken: string;
  refreshToken: string;
}) => {
  localStorage.setItem("accessToken", data.accessToken);
  localStorage.setItem("refreshToken", data.refreshToken);
  localStorage.setItem("user", JSON.stringify(data.user));
  localStorage.setItem("organizations", JSON.stringify(data.userOrganizations));
  const first = data.userOrganizations.find(isSelectableOrganization);
  if (first) localStorage.setItem("activeOrganizationId", first.id);
  else localStorage.removeItem("activeOrganizationId");
};

export const clearSession = () => {
  ["accessToken", "refreshToken", "user", "organizations", "activeOrganizationId"].forEach((k) =>
    localStorage.removeItem(k),
  );
};

export const getUser = () => read<User>("user");
export const getOrganizations = () => read<Organization[]>("organizations") ?? [];
export const getActiveOrganizationId = () => localStorage.getItem("activeOrganizationId");
export const getActiveOrganization = () => {
  const organizations = getOrganizations();
  const activeId = getActiveOrganizationId();
  return (
    organizations.find(
      (organization) =>
        organization.id === activeId && isSelectableOrganization(organization),
    ) ?? organizations.find(isSelectableOrganization)
  );
};
const hasRole = (organizationId: string | null | undefined, roles: string[]) => {
  const organization = organizationId
    ? getOrganizations().find((item) => item.id === organizationId)
    : getActiveOrganization();
  return Boolean(
    organization &&
      isSelectableOrganization(organization) &&
      organization.role &&
      roles.includes(organization.role),
  );
};

export type ViewMode = "admin" | "me";
export const getViewMode = (): ViewMode =>
  localStorage.getItem("viewMode") === "me" ? "me" : "admin";
export const setViewMode = (mode: ViewMode) => {
  localStorage.setItem("viewMode", mode);
  window.dispatchEvent(new Event("view-mode-updated"));
};

// Admin and HR users can switch between their management tools and self-service view.
export const hasManagerRole = (organizationId?: string | null) =>
  hasRole(organizationId, ["super_admin", "admin"]);
export const hasPeopleManagerRole = (organizationId?: string | null) =>
  hasRole(organizationId, ["super_admin", "admin", "hr"]);
export const canManageEmployees = (organizationId?: string | null) =>
  getViewMode() === "admin" && hasManagerRole(organizationId);
export const canManagePeople = (organizationId?: string | null) =>
  getViewMode() === "admin" && hasPeopleManagerRole(organizationId);
export const canUpdateOrganization = (organizationId?: string | null) =>
  getViewMode() === "admin" && hasRole(organizationId, ["super_admin"]);
export const setActiveOrganizationId = (id: string) => {
  const organization = getOrganizations().find((item) => item.id === id);
  if (!organization || !isSelectableOrganization(organization)) return;
  localStorage.setItem("activeOrganizationId", id);
  window.dispatchEvent(new Event("active-organization-updated"));
};

export const setOrganizations = (orgs: Organization[], activeId?: string) => {
  localStorage.setItem("organizations", JSON.stringify(orgs));
  const selected =
    orgs.find(
      (organization) =>
        organization.id === activeId && isSelectableOrganization(organization),
    ) ?? orgs.find(isSelectableOrganization);
  if (selected) localStorage.setItem("activeOrganizationId", selected.id);
  else localStorage.removeItem("activeOrganizationId");
  window.dispatchEvent(new Event("active-organization-updated"));
};

export const setUser = (user: User) => {
  localStorage.setItem("user", JSON.stringify(user));
  window.dispatchEvent(new Event("user-updated"));
};
