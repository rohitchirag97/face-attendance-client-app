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
  setViewMode,
} from "@/lib/session";
import { signOut } from "@/lib/api";
import { NavLink, useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Clock,
  ContactRound,
  HandCoins,
  History,
  Landmark,
  ListChecks,
  Megaphone,
  Timer,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  MonitorSmartphone,
  Plane,
  Receipt,
  Settings2,
  UserPlus,
  Users,
  Wallet,
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

const employeeActions = [
  { label: "Add employee", icon: UserPlus, to: "/employees/new" },
  { label: "View all employees", icon: ContactRound, to: "/employees" },
];

const peopleManagerLinks = [
  { label: "Departments", icon: Building2, to: "/departments" },
  { label: "Shifts", icon: Clock, to: "/shifts" },
  { label: "Statutory", icon: Landmark, to: "/statutory" },
];
const adminLinks = [{ label: "Kiosks", icon: MonitorSmartphone, to: "/kiosks" }];

type NavItem = { label: string; icon: React.ElementType; to: string };
type NavGroup = { key: string; label: string; icon: React.ElementType; items: NavItem[] };

const isItemActive = (to: string, pathname: string, search: string) => {
  const [path, query] = to.split("?");
  if (pathname !== path) return false;
  if (!query) return true;
  const wanted = new URLSearchParams(query).get("tab");
  const current = new URLSearchParams(search).get("tab") ?? "leave";
  return wanted === current;
};

const AppSidebar: React.FC = () => {
  const { pathname, search } = useLocation();
  // Only one submenu is open at a time. A toggle applies to the page it was made on;
  // after any navigation the open submenu follows the current page, so plain links close them all.
  const [toggled, setToggled] = useState<{ key: string | null; at: string } | null>(null);
  const navigate = useNavigate();
  const [activeOrganizationId, setActiveOrganizationId] = useState(
    getActiveOrganizationId,
  );
  const [mode, setMode] = useState(getViewMode);

  useEffect(() => {
    const syncActiveOrganization = () =>
      setActiveOrganizationId(getActiveOrganizationId());
    const syncMode = () => setMode(getViewMode());
    window.addEventListener("active-organization-updated", syncActiveOrganization);
    window.addEventListener("view-mode-updated", syncMode);
    return () => {
      window.removeEventListener(
        "active-organization-updated",
        syncActiveOrganization,
      );
      window.removeEventListener("view-mode-updated", syncMode);
    };
  }, []);

  const showModeSwitch = hasPeopleManagerRole(activeOrganizationId);
  const switchMode = (next: "admin" | "me") => {
    if (next === mode) return;
    setViewMode(next);
    navigate("/");
  };

  const canManage = mode === "admin" && hasManagerRole(activeOrganizationId);
  const canManagePeopleView = mode === "admin" && canManagePeople(activeOrganizationId);
  // HR has a dedicated management workspace. Keep personal finance and
  // self-service links in My view so they do not look like HR admin tools.
  const isHrManagementView = canManagePeopleView && !canManage;
  const isOwner = mode === "admin" && canUpdateOrganization(activeOrganizationId);
  const groups: NavGroup[] = [
    {
      key: "attendance",
      label: "Attendance",
      icon: CalendarClock,
      items: [
        { label: "Attendance", icon: CalendarClock, to: "/attendance" },
        ...(!isHrManagementView
          ? [{ label: "My attendance", icon: CalendarDays, to: "/attendance/my" }]
          : []),
        { label: "Corrections", icon: ListChecks, to: "/attendance/corrections" },
        ...(canManagePeopleView ? [{ label: "Overtime", icon: Timer, to: "/attendance/overtime" }] : []),
      ],
    },
    {
      key: "leave",
      label: "Leave",
      icon: Plane,
      items: [
        ...(!isHrManagementView
          ? [{ label: "Apply for leave", icon: Plane, to: "/leave" }]
          : []),
        { label: "Leave applications", icon: ListChecks, to: "/leave/applications" },
        ...(!isHrManagementView
          ? [{ label: "Leave log", icon: History, to: "/history?tab=leave" }]
          : []),
      ],
    },
    ...(!isHrManagementView
      ? [{
          key: "loans",
          label: "Loans",
          icon: HandCoins,
          items: [
            { label: "Loans & advances", icon: HandCoins, to: "/loans" },
            ...(canManage
              ? [
                  { label: "All loans", icon: ListChecks, to: "/loans/all" },
                  { label: "Installments", icon: Receipt, to: "/installments" },
                  { label: "Installment log", icon: History, to: "/installment-log" },
                ]
              : []),
            { label: "Loan log", icon: History, to: "/history?tab=loans" },
            ...(canManage ? [] : [{ label: "My installments", icon: Receipt, to: "/history?tab=installments" }]),
          ],
        }]
      : []),
  ];
  const links = [
    ...(getUser()?.isPlatformAdmin
      ? [{ label: "Platform console", icon: ShieldCheck, to: "/platform" }]
      : []),
    { label: "Announcements", icon: Megaphone, to: "/announcements" },
    { label: "Holidays", icon: CalendarDays, to: "/holidays" },
    ...(canManage
      ? [{ label: "Payroll", icon: Wallet, to: "/payroll" }]
      : !isHrManagementView
        ? [{ label: "Salary slips", icon: Wallet, to: "/salary-slips" }]
        : []),
    ...(canManagePeopleView ? peopleManagerLinks : []),
    ...(canManage ? adminLinks : []),
    ...(isOwner
      ? [
          { label: "Payroll settings", icon: Settings2, to: "/payroll-settings" },
          { label: "Audit log", icon: ShieldCheck, to: "/audit-log" },
        ]
      : []),
  ];

  const location = `${pathname}${search}`;
  const currentGroupKey = pathname.startsWith("/employees")
    ? "employees"
    : (groups.find(({ items }) => items.some((item) => isItemActive(item.to, pathname, search)))?.key ?? null);
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
                  mode === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                  {value === "admin"
                    ? isHrManagementView ? "HR tools" : "Manage"
                    : "My view"}
              </button>
            ))}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Dashboard"
                  isActive={pathname === "/"}
                  render={<NavLink to="/" end />}
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {groups.filter(({ key }) => key !== "loans").map(({ key, label, icon: GroupIcon, items }) => {
                const hasActive = items.some((item) => isItemActive(item.to, pathname, search));
                const open = openKey === key;
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
                      <ChevronDown
                        className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    </SidebarMenuButton>
                    {open && (
                      <SidebarMenuSub>
                        {items.map(({ label: itemLabel, icon: Icon, to }) => (
                          <SidebarMenuSubItem key={to}>
                            <SidebarMenuSubButton
                              isActive={isItemActive(to, pathname, search)}
                              render={<NavLink to={to} />}
                            >
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

              {canManagePeopleView && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Employee"
                    isActive={false}
                    className={pathname.startsWith("/employees") ? "text-sidebar-accent-foreground" : undefined}
                    aria-expanded={openKey === "employees"}
                    onClick={() => toggleGroup("employees")}
                  >
                    <Users />
                    <span>Employee</span>
                    <ChevronDown
                      className={`ml-auto transition-transform ${openKey === "employees" ? "rotate-180" : ""}`}
                    />
                  </SidebarMenuButton>
                  {openKey === "employees" && (
                    <SidebarMenuSub>
                      {employeeActions.map(({ label, icon: Icon, to }) => (
                        <SidebarMenuSubItem key={label}>
                          <SidebarMenuSubButton
                            isActive={pathname === to}
                            render={<NavLink to={to} />}
                          >
                            <Icon />
                            <span>{label}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              )}

              {links.map(({ label, icon: Icon, to }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    tooltip={label}
                    isActive={pathname === to || pathname.startsWith(`${to}/`)}
                    render={<NavLink to={to} />}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {groups.filter(({ key }) => key === "loans").map(({ key, label, icon: GroupIcon, items }) => {
                const hasActive = items.some((item) => isItemActive(item.to, pathname, search));
                const open = openKey === key;
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
                      <ChevronDown
                        className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    </SidebarMenuButton>
                    {open && (
                      <SidebarMenuSub>
                        {items.map(({ label: itemLabel, icon: Icon, to }) => (
                          <SidebarMenuSubItem key={to}>
                            <SidebarMenuSubButton
                              isActive={isItemActive(to, pathname, search)}
                              render={<NavLink to={to} />}
                            >
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

              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Reports"
                  isActive={pathname.startsWith("/reports")}
                  render={<NavLink to="/reports" />}
                >
                  <BarChart3 />
                  <span>Reports</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
