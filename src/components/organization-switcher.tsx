import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, LogOut, Pencil, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  organizationsQuery,
  useRemoveEmployee,
} from "@/hooks/use-api";
import {
  canUpdateOrganization,
  getActiveOrganizationId,
  getUser,
  getOrganizations,
  setActiveOrganizationId,
  setOrganizations as storeOrganizations,
} from "@/lib/session";

const OrganizationSwitcher: React.FC = () => {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const leaveOrganization = useRemoveEmployee();
  const [organizations, setOrganizationList] = useState(getOrganizations);
  const [activeId, setActiveId] = useState(getActiveOrganizationId);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  useEffect(() => {
    const syncOrganizations = () => {
      setOrganizationList(getOrganizations());
      setActiveId(getActiveOrganizationId());
    };
    window.addEventListener("active-organization-updated", syncOrganizations);
    return () =>
      window.removeEventListener("active-organization-updated", syncOrganizations);
  }, []);

  const isSelectable = (organization: (typeof organizations)[number]) =>
    organization.isActive &&
    organization.membershipActive &&
    (organization.status ?? "active") === "active";

  // The owner can bring back an organization they paused or scheduled for deletion.
  const ownerCanRestore = (organization: (typeof organizations)[number]) =>
    organization.membershipActive &&
    organization.role === "super_admin" &&
    (organization.status === "pending_deletion" || (organization.status === "active" && !organization.isActive));

  const unavailableReason = (organization: (typeof organizations)[number]) => {
    if (!organization.membershipActive) return "Contact Admin to reactivate the account";
    if (organization.status === "suspended") return "Suspended · contact support";
    if (organization.status === "pending_deletion") {
      return ownerCanRestore(organization) ? "Scheduled for deletion · manage" : "Scheduled for deletion";
    }
    return ownerCanRestore(organization) ? "Paused · reactivate" : "Paused by the owner";
  };

  const active =
    organizations.find((o) => o.id === activeId && isSelectable(o)) ??
    organizations.find(isSelectable) ??
    organizations[0];

  const select = (id: string) => {
    const organization = organizations.find((item) => item.id === id);
    if (!organization || !isSelectable(organization)) return;
    setActiveOrganizationId(id);
  };

  const leaveActiveOrganization = () => {
    const user = getUser();
    if (!active || !user) {
      setLeaveError("Could not identify your account. Please sign in again.");
      return;
    }
    setLeaveError(null);
    leaveOrganization.mutate(
      { employeeId: user.id, organizationId: active.id },
      {
        onSuccess: async () => {
          setConfirmLeave(false);
          const updatedOrganizations = await queryClient.fetchQuery({
            ...organizationsQuery,
            staleTime: 0,
          });
          storeOrganizations(updatedOrganizations);
          navigate(
            updatedOrganizations.length > 0 ? "/" : "/create-organization",
            { replace: true },
          );
        },
        onError: (error) => setLeaveError(error.message),
      },
    );
  };

  if (!active) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <span className={`flex aspect-square size-8 items-center justify-center rounded-lg text-sm font-bold ${
              isSelectable(active)
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}>
              {active.name.charAt(0).toUpperCase()}
            </span>
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{active.name}</span>
              <span className="truncate text-xs text-muted-foreground">Organization</span>
            </span>
            <ChevronsUpDown className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>Organizations</DropdownMenuLabel>
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  disabled={!isSelectable(org) && !ownerCanRestore(org)}
                  onClick={() => (isSelectable(org) ? select(org.id) : navigate("/organization-suspended"))}
                  className={`gap-2 ${
                    !isSelectable(org)
                      ? "text-muted-foreground opacity-60"
                      : ""
                  }`}
                >
                  <span className="flex size-6 items-center justify-center rounded-md border text-xs font-semibold">
                    {org.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 truncate">
                    <span className="block">{org.name}</span>
                    {!isSelectable(org) && (
                      <span className="block text-[0.65rem]">
                        {unavailableReason(org)}
                      </span>
                    )}
                  </span>
                  {org.id === active.id && <Check className="size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {canUpdateOrganization(active.id) && (
              <DropdownMenuItem
                onClick={() => navigate(`/organizations/${active.id}/edit`)}
                className="gap-2"
              >
                <Pencil className="size-4" />
                Update organization
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => navigate("/create-organization")} className="gap-2">
              <Plus className="size-4" />
              Create organization
            </DropdownMenuItem>
            {active.membershipActive && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setLeaveError(null);
                  setConfirmLeave(true);
                }}
                className="gap-2"
              >
                <LogOut className="size-4" />
                Leave organization
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {confirmLeave && (
          <div className="mt-2 space-y-2 rounded-md border p-3">
            <p className="text-xs">
              Leave {active.name}? You will lose access to this organization.
            </p>
            {leaveError && (
              <p role="alert" className="text-xs text-destructive">
                {leaveError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md border px-2 py-1 text-xs"
                onClick={() => {
                  setConfirmLeave(false);
                  setLeaveError(null);
                }}
                disabled={leaveOrganization.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-md bg-destructive px-2 py-1 text-xs text-white disabled:opacity-50"
                onClick={leaveActiveOrganization}
                disabled={leaveOrganization.isPending}
              >
                {leaveOrganization.isPending ? "Leaving..." : "Confirm"}
              </button>
            </div>
          </div>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

export default OrganizationSwitcher;
