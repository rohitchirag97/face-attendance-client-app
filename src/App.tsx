import { createBrowserRouter, redirect, RouterProvider } from "react-router";
import { PageSkeleton } from "@/components/form-kit";
import Layout from "./pages/layout";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Reports from "./pages/reports";
import BillingPage from "./pages/billing";
import ExpensesPage from "./pages/expenses";
import ExpenseReviewPage from "./pages/expense-review";
import TaxDeclarationPage from "./pages/tax-declaration";
import TaxDeclarationReviewPage from "./pages/tax-declaration-review";
import ShiftRosterPage from "./pages/shift-roster";
import MySchedulePage from "./pages/my-schedule";
import SettlementsPage from "./pages/settlements";
import BonusPage from "./pages/bonus";
import BranchesPage from "./pages/branches";
import AccountingPage from "./pages/accounting";
import AssetsPage from "./pages/assets";
import MyAssetsPage from "./pages/my-assets";
import InsightsPage from "./pages/insights";
import MessagingPage from "./pages/messaging";
import Profile from "./pages/profile";
import VerifyOTP from "./pages/verify-otp";
import CreateOrganization from "./pages/create-organization";
import UpdateOrganization from "./pages/update-organization";
import CreateEmployee from "./pages/create-employee";
import BulkEmployees from "./pages/bulk-employees";
import EmployeeList from "./pages/employees";
import SelectEmployeeToUpdate from "./pages/select-employee-to-update";
import UpdateEmployee from "./pages/update-employee";
import AccessDenied from "./pages/access-denied";
import Departments from "./pages/departments";
import Shifts from "./pages/shifts";
import Holidays from "./pages/holidays";
import Installments from "./pages/installments";
import InstallmentLog from "./pages/installment-log";
import Kiosks from "./pages/kiosks";
import PayrollSettingsPage from "./pages/payroll-settings";
import PayrollPage from "./pages/payroll";
import SalarySlip from "./pages/salary-slip";
import MySalarySlips from "./pages/my-salary-slips";
import MyAttendance from "./pages/my-attendance";
import AttendanceCorrections from "./pages/attendance-corrections";
import OvertimePage from "./pages/overtime";
import AnnouncementsPage from "./pages/announcements";
import Statutory from "./pages/statutory";
import Attendance from "./pages/attendance";
import Loans, { LoanListPage } from "./pages/loans";
import Leave, { LeaveApplicationsPage } from "./pages/leave";
import AuditLog from "./pages/audit-log";
import History from "./pages/history";
import { ApiError, api } from "./lib/api";
import PlatformOverviewPage from "./pages/platform/platform-overview";
import PlatformOrganizationsPage from "./pages/platform/platform-organizations";
import PlatformOrganizationCreatePage from "./pages/platform/platform-organization-create";
import PlatformOrganizationDetailPage from "./pages/platform/platform-organization-detail";
import PlatformAuditPage from "./pages/platform/platform-audit";
import PlatformPlansPage from "./pages/platform/platform-plans";
import PlatformInvoicesPage from "./pages/platform/platform-invoices";
import { PlatformMessagingPage } from "./pages/platform/platform-messaging";
import PlatformInvoiceDetailPage from "./pages/platform/platform-invoice-detail";
import { PlatformLayout, PlatformReauthPage, platformLoader } from "./pages/platform/platform-layout";
import OrganizationSuspendedPage from "./pages/organization-suspended";

import {
  canManageEmployees,
  canManagePeople,
  canUpdateOrganization,
  isOrganizationOwner,
  getActiveOrganizationId,
  hasSelectableOrganization,
  setOrganizations,
  type Organization,
} from "./lib/session";

const isLoggedIn = () => !!localStorage.getItem("accessToken");

const refreshOrganizations = async () => {
  const response = await api<{ data: Organization[] }>("/organization", {
    auth: true,
  });
  const organizations = response.data;
  const activeId = getActiveOrganizationId();
  const nextActiveId = activeId && organizations.some(
    (organization) => organization.id === activeId && organization.status === "active" && organization.isActive && organization.membershipActive,
  )
    ? activeId
    : organizations.find((organization) => organization.status === "active" && organization.isActive && organization.membershipActive)?.id;
  setOrganizations(organizations, nextActiveId);
  return organizations;
};

const guardedLoader =
  (isAllowed: (organizationId?: string) => boolean) => async () => {
    if (!isLoggedIn()) return redirect("/login");
    const organizations = await refreshOrganizations();
    if (organizations.length === 0) return redirect("/create-organization");
    return isAllowed(getActiveOrganizationId() ?? undefined) ? null : redirect("/403");
  };

const router = createBrowserRouter([
  {
    path: "/platform",
    Component: PlatformLayout,
    loader: platformLoader,
    children: [
      { index: true, Component: PlatformOverviewPage },
      { path: "verify", Component: PlatformReauthPage },
      { path: "organizations", Component: PlatformOrganizationsPage },
      { path: "organizations/new", Component: PlatformOrganizationCreatePage },
      { path: "organizations/:organizationId", Component: PlatformOrganizationDetailPage },
      { path: "plans", Component: PlatformPlansPage },
      { path: "invoices", Component: PlatformInvoicesPage },
      { path: "messaging", Component: PlatformMessagingPage },
      { path: "invoices/:invoiceId", Component: PlatformInvoiceDetailPage },
      { path: "audit", Component: PlatformAuditPage },
    ],
  },
  {
    path: "/organization-suspended",
    Component: OrganizationSuspendedPage,
    loader: async () => {
      if (!isLoggedIn()) return redirect("/login");
      const organizations = await refreshOrganizations();
      // Open whenever one of the user's organizations is paused, suspended or being deleted, even if
      // another one works: owners reach the reactivate and cancel-deletion controls from here.
      const hasUnavailable = organizations.some((organization) =>
        organization.membershipActive && (!organization.isActive || organization.status !== "active"),
      );
      return hasUnavailable ? null : redirect("/");
    },
  },
  {
    path: "/login",
    Component: Login,
    loader: () => (isLoggedIn() ? redirect("/") : null),
  },
  {
    path: "/verify-otp",
    Component: VerifyOTP,
    loader: () => (isLoggedIn() ? redirect("/") : null),
  },
  {
    path: "/",
    Component: Layout,
    HydrateFallback: () => (
      <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
        <PageSkeleton />
      </div>
    ),
    loader: async () => {
      if (!isLoggedIn()) return redirect("/login");
      const organizations = await refreshOrganizations();
      if (organizations.length === 0) {
        try {
          await api("/platform/me", { auth: true });
          return redirect("/platform");
        } catch (error) {
          if (error instanceof ApiError && error.status === 428) return redirect("/platform/verify");
          if (error instanceof ApiError && error.status === 404) return redirect("/create-organization");
          throw error;
        }
      }
      if (!hasSelectableOrganization(organizations)) {
        return organizations.some((organization) => organization.membershipActive && (!organization.isActive || organization.status !== "active"))
          ? redirect("/organization-suspended")
          : redirect("/create-organization");
      }
      return null;
    },
    children: [
      { index: true, Component: Dashboard },
      { path: "reports", Component: Reports },
      { path: "billing", Component: BillingPage, loader: guardedLoader(isOrganizationOwner) },
      { path: "profile", Component: Profile },
      {
        path: "employees/bulk",
        Component: BulkEmployees,
        loader: async () => {
          if (!isLoggedIn()) return redirect("/login");
          const organizations = await refreshOrganizations();
          if (organizations.length === 0) return redirect("/create-organization");
          return canManagePeople(getActiveOrganizationId() ?? undefined)
            ? null
            : redirect("/403");
        },
      },
      {
        path: "employees/new",
        Component: CreateEmployee,
        loader: async () => {
          if (!isLoggedIn()) return redirect("/login");
          const organizations = await refreshOrganizations();
          if (organizations.length === 0) return redirect("/create-organization");
          return canManagePeople(getActiveOrganizationId() ?? undefined)
            ? null
            : redirect("/403");
        },
      },
      {
        path: "employees",
        Component: EmployeeList,
        loader: async () => {
          if (!isLoggedIn()) return redirect("/login");
          const organizations = await refreshOrganizations();
          if (organizations.length === 0) return redirect("/create-organization");
          return canManagePeople(getActiveOrganizationId() ?? undefined)
            ? null
            : redirect("/403");
        },
      },
      {
        path: "employees/update",
        Component: SelectEmployeeToUpdate,
        loader: async () => {
          if (!isLoggedIn()) return redirect("/login");
          const organizations = await refreshOrganizations();
          if (organizations.length === 0) return redirect("/create-organization");
          return canManagePeople(getActiveOrganizationId() ?? undefined)
            ? null
            : redirect("/403");
        },
      },
      {
        path: "employees/:employeeId/edit",
        Component: UpdateEmployee,
        loader: async () => {
          if (!isLoggedIn()) return redirect("/login");
          const organizations = await refreshOrganizations();
          if (organizations.length === 0) return redirect("/create-organization");
          return canManagePeople(getActiveOrganizationId() ?? undefined)
            ? null
            : redirect("/403");
        },
      },
      { path: "403", Component: AccessDenied },
      { path: "attendance", Component: Attendance },
      { path: "attendance/my", Component: MyAttendance },
      { path: "announcements", Component: AnnouncementsPage },
      { path: "attendance/corrections", Component: AttendanceCorrections },
      { path: "attendance/regularization", loader: () => redirect("/attendance/corrections") },
      { path: "attendance/overtime", Component: OvertimePage, loader: guardedLoader(canManagePeople) },
      { path: "loans", Component: Loans },
      { path: "expenses", Component: ExpensesPage },
      { path: "expenses/review", Component: ExpenseReviewPage, loader: guardedLoader(canManagePeople) },
      { path: "tax-declaration", Component: TaxDeclarationPage },
      { path: "my-schedule", Component: MySchedulePage },
      { path: "shifts/roster", Component: ShiftRosterPage, loader: guardedLoader(canManagePeople) },
      { path: "branches", Component: BranchesPage, loader: guardedLoader(canManagePeople) },
      { path: "assets", Component: AssetsPage, loader: guardedLoader(canManagePeople) },
      { path: "my-assets", Component: MyAssetsPage },
      { path: "insights", Component: InsightsPage, loader: guardedLoader(canManagePeople) },
      { path: "messaging", Component: MessagingPage, loader: guardedLoader(canManageEmployees) },
      { path: "settlements", Component: SettlementsPage, loader: guardedLoader(canManageEmployees) },
      { path: "bonus", Component: BonusPage, loader: guardedLoader(canManageEmployees) },
      { path: "accounting", Component: AccountingPage, loader: guardedLoader(canManageEmployees) },
      { path: "tax-declarations/review", Component: TaxDeclarationReviewPage, loader: guardedLoader(canManagePeople) },
      { path: "loans/all", Component: LoanListPage, loader: guardedLoader(canManageEmployees) },
      { path: "leave", Component: Leave },
      { path: "leave/applications", Component: LeaveApplicationsPage },
      { path: "audit-log", Component: AuditLog, loader: guardedLoader(canUpdateOrganization) },
      { path: "history", Component: History },
      {
        path: "installments",
        Component: Installments,
        loader: guardedLoader(canManageEmployees),
      },
      {
        path: "installment-log",
        Component: InstallmentLog,
        loader: guardedLoader(canManageEmployees),
      },
      {
        path: "departments",
        Component: Departments,
        loader: guardedLoader(canManagePeople),
      },
      {
        path: "statutory",
        Component: Statutory,
        loader: guardedLoader(canManagePeople),
      },
      {
        path: "shifts",
        Component: Shifts,
        loader: guardedLoader(canManagePeople),
      },
      {
        path: "holidays",
        Component: Holidays,
      },
      {
        path: "kiosks",
        Component: Kiosks,
        loader: guardedLoader(canManageEmployees),
      },
      {
        path: "payroll",
        Component: PayrollPage,
        loader: guardedLoader(canManageEmployees),
      },
      { path: "salary-slips", Component: MySalarySlips },
      { path: "salary-slip/:itemId", Component: SalarySlip },
      {
        path: "payroll-settings",
        Component: PayrollSettingsPage,
        loader: guardedLoader(canUpdateOrganization),
      },
      {
        path: "organizations/:organizationId/edit",
        Component: UpdateOrganization,
        loader: async ({ params }) => {
          if (!isLoggedIn()) return redirect("/login");
          const organizations = await refreshOrganizations();
          if (organizations.length === 0) return redirect("/create-organization");
          return canUpdateOrganization(params.organizationId)
            ? null
            : redirect("/403");
        },
      },
    ],
  },
  {
    path: "/create-organization",
    Component: CreateOrganization,
    loader: () => (isLoggedIn() ? null : redirect("/login")),
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
