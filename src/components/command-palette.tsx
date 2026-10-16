import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  ContactRound,
  CornerDownLeft,
  HandCoins,
  History,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Timer,
  LogOut,
  MonitorSmartphone,
  Plane,
  Receipt,
  Search,
  Settings2,
  ShieldCheck,
  User,
  UserPlus,
  Wallet,
  CreditCard,
  Clock,
  Repeat,
  Gift,
  MapPin,
  BookOpenCheck,
  Package,
  ChartNoAxesCombined,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  canUpdateOrganization,
  isOrganizationOwner,
  canManagePeople,
  getActiveOrganizationId,
  getViewMode,
  hasManagerRole,
  hasPeopleManagerRole,
  setViewMode,
} from "@/lib/session";
import { signOut } from "@/lib/api";

type Command = {
  id: string;
  label: string;
  group: "Go to" | "Actions";
  icon: React.ElementType;
  keywords?: string;
  run: () => void;
};

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const combo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !event.ctrlKey && !event.metaKey && !isTypingTarget(event.target);
      if (combo || slash) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  const commands = useMemo<Command[]>(() => {
    if (!open) return [];
    const orgId = getActiveOrganizationId();
    const mode = getViewMode();
    const canManage = mode === "admin" && hasManagerRole(orgId);
    const canManagePeopleView = mode === "admin" && canManagePeople(orgId);
    const isHrManagementView = canManagePeopleView && !canManage;
    const isOwner = mode === "admin" && canUpdateOrganization(orgId);
    const go = (id: string, label: string, to: string, icon: React.ElementType, keywords = ""): Command => ({
      id,
      label,
      group: "Go to",
      icon,
      keywords,
      run: () => navigate(to),
    });

    const list: Command[] = [
      go("dashboard", "Dashboard", "/", LayoutDashboard, "home overview"),
      go("reports", "Reports", "/reports", BarChart3),
      go("profile", "My profile", "/profile", User, "account name phone"),
      go("attendance", "Attendance", "/attendance", CalendarClock, "check in punch"),
      ...(!isHrManagementView
        ? [go("attendance-my", "My attendance", "/attendance/my", CalendarDays, "calendar present absent late")]
        : []),
      go("announcements", "Announcements", "/announcements", Megaphone, "announcement broadcast message notice news"),
      go("attendance-corrections", "Attendance corrections", "/attendance/corrections", ListChecks, "regularize regularisation missed punch fix"),
      go("holidays", "Holidays", "/holidays", CalendarDays),
      go("my-assets", "My assets", "/my-assets", Package, "laptop phone sim id card company property acknowledge"),
      ...(!isHrManagementView
        ? [
            go("loans", "Loans & advances", "/loans", HandCoins, "apply loan advance"),
            go("expenses", "My expenses", "/expenses", HandCoins, "expense claim reimbursement receipt bill"),
            go("tax-declaration", "My tax declaration", "/tax-declaration", HandCoins, "income tax tds 80c hra regime investment proof 12bb"),
            go("my-schedule", "My schedule", "/my-schedule", HandCoins, "shift roster rotation swap timetable"),
            go("loan-log", "Loan log", "/history?tab=loans", History),
            go("leave", "Apply for leave", "/leave", Plane, "vacation time off balance"),
            go("leave-log", "Leave log", "/history?tab=leave", History),
          ]
        : []),
      go("leave-apps", "Leave applications", "/leave/applications", ListChecks, "approve reject"),
    ];

    if (canManagePeopleView) {
      list.push(
        go("emp-new", "Add employee", "/employees/new", UserPlus, "create new staff"),
        go("emp-all", "View all employees", "/employees", ContactRound, "staff list deactivate"),
        go("overtime", "Overtime approvals", "/attendance/overtime", Timer, "overtime approve extra hours"),
        go("branches", "Branches & locations", "/branches", MapPin, "office site store location geofence gps check-in branch manager"),
        go("assets", "Assets", "/assets", Package, "laptop phone sim id card vehicle inventory handover return asset register"),
        go("insights", "HR insights", "/insights", ChartNoAxesCombined, "analytics headcount attrition turnover attendance rate birthday anniversary payroll cost report dashboard"),
        go("departments", "Departments", "/departments", Building2),
        go("shifts", "Shifts", "/shifts", Clock, "timing"),
        go("statutory", "Statutory compliance", "/statutory", Landmark, "pf esi tds professional tax uan pan india"),
      );
    }
    if (canManage) {
      list.push(
        go("payroll", "Payroll", "/payroll", Wallet, "salary generate"),
        go("installments", "Installments", "/installments", Receipt, "emi repayment"),
        go("installment-log", "Installment log", "/installment-log", History),
        go("kiosks", "Kiosks", "/kiosks", MonitorSmartphone, "face attendance device"),
        go("loans-all", "All loans", "/loans/all", ListChecks, "active loans noc"),
        go("expenses-review", "Review expense claims", "/expenses/review", ListChecks, "approve reimbursement claims"),
        go("tax-review", "Review tax declarations", "/tax-declarations/review", ListChecks, "verify tds proofs 80c investment"),
        go("shift-roster", "Shift roster", "/shifts/roster", ListChecks, "rotation rota schedule swap night shift"),
        go("settlements", "Full & final settlements", "/settlements", ListChecks, "fnf exit leaver gratuity leave encashment resignation"),
        go("bonus", "Bonus & gratuity", "/bonus", Gift, "statutory bonus payment of bonus act diwali gratuity liability provision"),
        go("accounting", "Accounting export", "/accounting", BookOpenCheck, "tally zoho books quickbooks journal voucher ledger export accountant"),
        go("messaging", "Messaging", "/messaging", MessageCircle, "whatsapp email send salary slip balance top up wallet provider aisensy template delivery log"),
      );
    } else if (!isHrManagementView) {
      list.push(
        go("slips", "Salary slips", "/salary-slips", Wallet, "payslip"),
        go("my-installments", "My installments", "/history?tab=installments", Receipt),
      );
    }
    if (isOwner) {
      list.push(
        go("payroll-settings", "Payroll settings", "/payroll-settings", Settings2, "organization"),
        go("audit", "Audit log", "/audit-log", ShieldCheck, "history actions security"),
      );
    }

    if (isOrganizationOwner(orgId)) {
      list.push(go("billing", "Billing & plan", "/billing", CreditCard, "subscription trial upgrade pricing invoice payment"));
    }

    if (hasPeopleManagerRole(orgId)) {
      const next = mode === "admin" ? "me" : "admin";
      list.push({
        id: "switch-mode",
        label: next === "me" ? "Switch to my employee view" : "Switch to manage view",
        group: "Actions",
        icon: Repeat,
        keywords: "mode toggle",
        run: () => {
          setViewMode(next);
          navigate("/");
        },
      });
    }
    list.push({
      id: "logout",
      label: "Log out",
      group: "Actions",
      icon: LogOut,
      keywords: "sign out exit",
      run: () => {
        void signOut().then(() => navigate("/login", { replace: true }));
      },
    });
    return list;
    // pathname is a dependency so the list is rebuilt after navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, navigate, pathname]);

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return commands;
    return commands.filter((cmd) => {
      const haystack = `${cmd.label} ${cmd.keywords ?? ""}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [commands, query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const execute = (cmd?: Command) => {
    if (!cmd) return;
    close();
    cmd.run();
  };

  const onInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      execute(results[active]);
    } else if (event.key === "Home") {
      setActive(0);
    } else if (event.key === "End") {
      setActive(Math.max(results.length - 1, 0));
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="Search pages and actions"
        aria-keyshortcuts="Control+K Meta+K /"
        className="mx-auto h-9 w-full max-w-md justify-start gap-2 text-muted-foreground"
      >
        <Search aria-hidden />
        <span className="flex-1 truncate text-left">Search or jump to…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </Button>

      <Dialog.Root
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-[15vh] z-50 w-[92vw] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl outline-none">
            <Dialog.Title className="sr-only">Search pages and actions</Dialog.Title>
            <Dialog.Description className="sr-only">
              Type to filter. Use the up and down arrow keys to choose and Enter to open. Escape closes.
            </Dialog.Description>
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKeyDown}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
                aria-autocomplete="list"
                aria-label="Search pages and actions"
                placeholder="Type a page or action, then press Enter"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul
              id={listId}
              ref={listRef}
              role="listbox"
              aria-label="Results"
              className="max-h-80 overflow-y-auto p-2"
            >
              {results.map((cmd, index) => {
                const Icon = cmd.icon;
                const showGroup = index === 0 || results[index - 1].group !== cmd.group;
                return (
                  <React.Fragment key={cmd.id}>
                    {showGroup && (
                      <li role="presentation" className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                        {cmd.group}
                      </li>
                    )}
                    <li
                      id={`${listId}-${cmd.id}`}
                      role="option"
                      aria-selected={index === active}
                      data-index={index}
                      onMouseMove={() => setActive(index)}
                      onClick={() => execute(cmd)}
                      className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm ${
                        index === active ? "bg-accent text-accent-foreground" : ""
                      }`}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{cmd.label}</span>
                      {index === active && <CornerDownLeft className="size-3.5 text-muted-foreground" aria-hidden />}
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
            <div aria-live="polite" className={results.length ? "sr-only" : "p-6 text-center text-sm text-muted-foreground"}>
              {results.length ? `${results.length} results` : "No matching pages or actions"}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
};

export default CommandPalette;
