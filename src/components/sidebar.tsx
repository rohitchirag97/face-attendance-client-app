import React, { useEffect, useState } from "react";
import OrganizationSwitcher from "@/components/organization-switcher";
import {
  canUpdateOrganization,
  getActiveOrganizationId,
  getUser,
  getViewMode,
  canManagePeople,
  hasManagerRole,
  hasPeopleManagerRole,
  isOrganizationOwner,
  setViewMode,
} from "@/lib/session";
import { signOut } from "@/lib/api";
import { NavLink, useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartNoAxesCombined,
  ChevronDown,
  Clock,
  ContactRound,
  CreditCard,
  FileCheck2,
  Gift,
  HandCoins,
  History,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Megaphone,
  MessageCircle,
  MonitorSmartphone,
  Package,
  Plane,
  Receipt,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Timer,
  Upload,
  UserPlus,
  Users,
  Wallet,
  FileDown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

type NavItem = { label: string; icon: React.ElementType; to: string };
type NavEntry =
  | { kind: "link"; item: NavItem }
  | { kind: "group"; key: string; label: string; icon: React.ElementType; items: NavItem[] };
type NavSection = { label: string | null; entries: NavEntry[] };

const link = (label: string, icon: React.ElementType, to: string): NavEntry => ({ kind: "link", item: { label, icon, to } });

/** A group with one visible item is shown as a plain link, and an empty one not at all. */
const group = (key: string, label: string, icon: React.ElementType, items: (NavItem | false)[]): NavEntry | null => {
  const visible = items.filter((item): item is NavItem => Boolean(item));
  if (visible.length === 0) return null;
  if (visible.length === 1) return { kind: "link", item: visible[0]! };
  return { kind: "group", key, label, icon, items: visible };
};

const item = (label: string, icon: React.ElementType, to: string): NavItem => ({ label, icon, to });

const pathOf = (to: string) => to.split("?")[0]!;

/** The item for the current page: an exact match (including ?tab=), else the longest parent path. */
const activeItemTo = (items: NavItem[], pathname: string, search: string) => {
  const exact = items.find(({ to }) => {
    const [path, query] = to.split("?");
    if (pathname !== path) return false;
    if (!query) return true;
    return new URLSearchParams(query).get("tab") === (new URLSearchParams(search).get("tab") ?? "leave");
  });
  if (exact) return exact.to;
  const parents = items.filter(({ to }) => pathOf(to) !== "/" && pathname.startsWith(`${pathOf(to)}/`));
  return parents.sort((a, b) => pathOf(b.to).length - pathOf(a.to).length)[0]?.to ?? null;
};

const AppSidebar: React.FC = () => {
  const { pathname, search } = useLocation();
  // Only one group is open at a time. A toggle applies to the page it was made on;
  // after any navigation the open group follows the current page.
  const [toggled, setToggled] = useState<{ key: string | null; at: string } | null>(null);
  const navigate = useNavigate();
  const [activeOrganizationId, setActiveOrganizationId] = useState(getActiveOrganizationId);
  const [mode, setMode] = useState(getViewMode);

  useEffect(() => {
    const syncActiveOrganization = () => setActiveOrganizationId(getActiveOrganizationId());
    const syncMode = () => setMode(getViewMode());
    window.addEventListener("active-organization-updated", syncActiveOrganization);
    window.addEventListener("view-mode-updated", syncMode);
    return () => {
      window.removeEventListener("active-organization-updated", syncActiveOrganization);
      window.removeEventListener("view-mode-updated", syncMode);
    };
  }, []);

  const showModeSwitch = hasPeopleManagerRole(activeOrganizationId);
  const switchMode = (next: "admin" | "me") => {
    if (next === mode) return;
    setViewMode(next);
    navigate("/");
  };

  // Owners and organization-wide admins manage payroll and settings; HR and branch managers manage people.
  const canManage = mode === "admin" && hasManagerRole(activeOrganizationId);
  const people = mode === "admin" && canManagePeople(activeOrganizationId);
  // HR's management view is a workspace of HR tools; their own things live in My view.
  const isHrManagementView = people && !canManage;
  const self = !isHrManagementView;
  const isOwner = mode === "admin" && canUpdateOrganization(activeOrganizationId);

  const sections: NavSection[] = [
    {
      label: null,
      entries: [
        link("Dashboard", LayoutDashboard, "/"),
        link("Announcements", Megaphone, "/announcements"),
        group("reports", "Reports & insights", BarChart3, [
          item("Reports", BarChart3, "/reports"),
          // Muster roll, wage register, bank transfer file and statutory exports.
          people && item("Export reports", FileDown, "/reports#export"),
          people && item("HR insights", ChartNoAxesCombined, "/insights"),
        ]),
        ...(self ? [link("My assets", Package, "/my-assets")] : []),
      ].filter((entry): entry is NavEntry => entry !== null),
    },
    {
      label: "People",
      entries: [
        group("employees", "Employees", Users, [
          people && item("All employees", ContactRound, "/employees"),
          people && item("Add employee", UserPlus, "/employees/new"),
          people && item("Bulk upload", Upload, "/employees/bulk"),
          people && item("Branches", MapPin, "/branches"),
          people && item("Departments", Building2, "/departments"),
          people && item("Shifts", Clock, "/shifts"),
          people && item("Shift roster", CalendarRange, "/shifts/roster"),
        ]),
        people ? link("Assets", Package, "/assets") : null,
      ].filter((entry): entry is NavEntry => entry !== null),
    },
    {
      label: "Time",
      entries: [
        group("attendance", "Attendance", CalendarClock, [
          item("Attendance", CalendarClock, "/attendance"),
          self && item("My attendance", CalendarDays, "/attendance/my"),
          item("Corrections", ListChecks, "/attendance/corrections"),
          self && item("My schedule", CalendarDays, "/my-schedule"),
          people && item("Overtime", Timer, "/attendance/overtime"),
          canManage && item("Kiosks", MonitorSmartphone, "/kiosks"),
        ]),
        group("leave", "Leave", Plane, [
          self && item("Apply for leave", Plane, "/leave"),
          item("Leave applications", ListChecks, "/leave/applications"),
          self && item("Leave log", History, "/history?tab=leave"),
          item("Holidays", CalendarDays, "/holidays"),
        ]),
      ].filter((entry): entry is NavEntry => entry !== null),
    },
    {
      label: "Money",
      entries: [
        group("payroll", "Payroll", Wallet, [
          canManage && item("Payroll runs", Wallet, "/payroll"),
          canManage && item("Full & final", FileCheck2, "/settlements"),
          canManage && item("Bonus & gratuity", Gift, "/bonus"),
          people && item("Statutory", Landmark, "/statutory"),
          canManage && item("Accounting export", BookOpenCheck, "/accounting"),
          isOwner && item("Payroll settings", Settings2, "/payroll-settings"),
          !canManage && self && item("Salary slips", Wallet, "/salary-slips"),
        ]),
        self
          ? group("loans", "Loans", HandCoins, [
              item("Loans & advances", HandCoins, "/loans"),
              canManage && item("All loans", ListChecks, "/loans/all"),
              canManage && item("Installments", Receipt, "/installments"),
              canManage && item("Installment log", History, "/installment-log"),
              item("Loan log", History, "/history?tab=loans"),
              !canManage && item("My installments", Receipt, "/history?tab=installments"),
            ])
          : null,
        group("expenses", "Expenses", ReceiptText, [
          self && item("My expenses", ReceiptText, "/expenses"),
          people && item("Review claims", ListChecks, "/expenses/review"),
        ]),
        group("tax", "Income tax", Landmark, [
          self && item("My tax declaration", Landmark, "/tax-declaration"),
          people && item("Tax declarations", ListChecks, "/tax-declarations/review"),
        ]),
      ].filter((entry): entry is NavEntry => entry !== null),
    },
    {
      label: "Organization",
      entries: [
        group("settings", "Settings & billing", Settings2, [
          canManage && item("Messaging", MessageCircle, "/messaging"),
          isOrganizationOwner(activeOrganizationId) && item("Billing", CreditCard, "/billing"),
          isOwner && item("Audit log", ShieldCheck, "/audit-log"),
        ]),
        getUser()?.isPlatformAdmin ? link("Platform console", ShieldCheck, "/platform") : null,
      ].filter((entry): entry is NavEntry => entry !== null),
    },
  ].filter((section) => section.entries.length > 0);

  const allItems = sections.flatMap((section) => section.entries.flatMap((entry) => (entry.kind === "link" ? [entry.item] : entry.items)));
  const activeTo = activeItemTo(allItems, pathname, search);
  const groups = sections.flatMap((section) => section.entries).filter((entry): entry is Extract<NavEntry, { kind: "group" }> => entry.kind === "group");
  const currentGroupKey = groups.find((g) => g.items.some((i) => i.to === activeTo))?.key ?? null;
  const location = `${pathname}${search}`;
  const openKey = toggled?.at === location ? toggled.key : currentGroupKey;
  const toggleGroup = (key: string) => setToggled({ key: openKey === key ? null : key, at: location });

  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 border-b border-sidebar-border px-4 py-4">
        <OrganizationSwitcher />
        {showModeSwitch && (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-sidebar-accent p-1 text-xs group-data-[collapsible=icon]:hidden">
            {(["admin", "me"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => switchMode(value)}
                className={`rounded-md px-2 py-1.5 font-medium transition-colors ${
                  mode === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === "admin" ? (isHrManagementView ? "HR tools" : "Manage") : "My view"}
              </button>
            ))}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {sections.map((section, index) => (
          <SidebarGroup key={section.label ?? `section-${index}`} className={index > 0 ? "pt-0" : undefined}>
            {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.entries.map((entry) => {
                  if (entry.kind === "link") {
                    const { label, icon: Icon, to } = entry.item;
                    return (
                      <SidebarMenuItem key={to}>
                        <SidebarMenuButton tooltip={label} isActive={activeTo === to} render={<NavLink to={to} end={to === "/"} />}>
                          <Icon />
                          <span>{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }
                  const { key, label, icon: GroupIcon, items } = entry;
                  const open = openKey === key;
                  const hasActive = items.some((i) => i.to === activeTo);
                  return (
                    <SidebarMenuItem key={key}>
                      <SidebarMenuButton
                        tooltip={label}
                        isActive={false}
                        className={hasActive ? "text-sidebar-accent-foreground" : undefined}
                        aria-expanded={open}
                        onClick={() => toggleGroup(key)}
                      >
                        <GroupIcon />
                        <span>{label}</span>
                        <ChevronDown className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
                      </SidebarMenuButton>
                      {open && (
                        <SidebarMenuSub>
                          {items.map(({ label: itemLabel, icon: Icon, to }) => (
                            <SidebarMenuSubItem key={to}>
                              <SidebarMenuSubButton isActive={activeTo === to} render={<NavLink to={to} />}>
                                <Icon />
                                <span>{itemLabel}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Logout" onClick={logout}>
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
