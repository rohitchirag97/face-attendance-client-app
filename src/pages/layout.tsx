import NavBar from "@/components/navbar";
import AppSidebar from "@/components/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, useNavigation } from "react-router";
import { PageSkeleton } from "@/components/form-kit";
import { api } from "@/lib/api";
import {
  canManageEmployees,
  canManagePeople,
  canUpdateOrganization,
  getActiveOrganizationId,
  getViewMode,
} from "@/lib/session";

const PEOPLE_MANAGER_PATHS = ["/employees", "/departments", "/shifts", "/statutory", "/attendance/overtime"];
const ADMIN_MANAGER_PATHS = ["/installments", "/installment-log", "/kiosks", "/payroll", "/loans/all"];

const Layout: React.FC = () => {
  const [organizationId, setOrganizationId] = useState(getActiveOrganizationId);
  const [viewMode, setViewModeState] = useState(getViewMode);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  useEffect(() => {
    const sync = () => setOrganizationId(getActiveOrganizationId());
    const syncMode = () => setViewModeState(getViewMode());
    window.addEventListener("active-organization-updated", sync);
    window.addEventListener("view-mode-updated", syncMode);
    return () => {
      window.removeEventListener("active-organization-updated", sync);
      window.removeEventListener("view-mode-updated", syncMode);
    };
  }, []);

  // Detects a sign-in on another device within a minute, or when the tab regains focus.
  useEffect(() => {
    const check = () => void api("/auth/me", { auth: true }).catch(() => undefined);
    const timer = window.setInterval(check, 60_000);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, []);

  // The new organization may grant a lower role than the page the user is on.
  useEffect(() => {
    const isPeopleManagerPage = PEOPLE_MANAGER_PATHS.some((path) => pathname.startsWith(path));
    const isAdminManagerPage = ADMIN_MANAGER_PATHS.some((path) => pathname.startsWith(path));
    const isOwnerPage = pathname.startsWith("/payroll-settings");
    if (
      (isPeopleManagerPage && !canManagePeople(organizationId)) ||
      (isAdminManagerPage && !canManageEmployees(organizationId)) ||
      (isOwnerPage && !canUpdateOrganization(organizationId))
    ) {
      navigate("/", { replace: true });
    }
  }, [organizationId, viewMode, pathname, navigate]);

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Skip to main content
      </a>
      <AppSidebar />
      <SidebarInset>
        <NavBar />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 bg-background p-4 outline-none md:p-6">
          <div key={`${organizationId ?? "none"}:${viewMode}`} className="mx-auto w-full max-w-[1600px]">
            {navigation.state === "loading" ? <PageSkeleton /> : <Outlet />}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Layout;
