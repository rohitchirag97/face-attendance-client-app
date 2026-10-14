import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, Search, Upload, UserPlus, Users, UserRoundPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { employeesQuery } from "@/hooks/use-api";
import {
  getActiveOrganization,
  getActiveOrganizationId,
  getOrganizations,
  hasManagerRole,
} from "@/lib/session";

const Employees: React.FC = () => {
  const [organizationId, setOrganizationId] = useState(
    getActiveOrganizationId() ?? getOrganizations()[0]?.id ?? "",
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    const syncOrganization = () =>
      setOrganizationId(
        getActiveOrganizationId() ?? getOrganizations()[0]?.id ?? "",
      );
    window.addEventListener("active-organization-updated", syncOrganization);
    return () =>
      window.removeEventListener("active-organization-updated", syncOrganization);
  }, []);

  const {
    data: employees = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    ...employeesQuery(organizationId),
    enabled: Boolean(organizationId),
  });

  const organization = getActiveOrganization();
  const canAssignElevatedRoles = hasManagerRole(organizationId);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredEmployees = employees.filter((employee) =>
    `${employee.fname} ${employee.lname} ${employee.phone} ${employee.role}`
      .toLowerCase()
      .includes(normalizedSearch),
  );
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleEmployees = filteredEmployees.slice(pageStart, pageStart + pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {organization?.name ?? "Organization"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and search members of this organization.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link to="/employees/bulk" />}>
            <Upload />
            Bulk upload
          </Button>
          <Button render={<Link to="/employees/new" />}>
            <UserPlus />
            Add employee
          </Button>
        </div>
      </div>

      <div className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 focus-within:ring-2 focus-within:ring-ring/30">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          aria-label="Search employees"
          placeholder="Search by name, phone, or role"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {isPending ? (
        <div role="status" className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Loading employees...
        </div>
      ) : isError ? (
        <div className="rounded-lg border p-8 text-center">
          <p role="alert" className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load employees."}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Users className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 font-medium">
            {employees.length === 0 ? "No employees yet" : "No matching employees"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {employees.length === 0
              ? "Add an employee to get started."
              : "Try a different name, phone number, or role."}
          </p>
          {employees.length === 0 && (
            <Button className="mt-4" render={<Link to="/employees/new" />}>
              <UserPlus />
              Add employee
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="border-b px-4 py-3 text-sm text-muted-foreground">
            {filteredEmployees.length}{" "}
            {filteredEmployees.length === 1 ? "employee" : "employees"}
          </div>
          <ul className="divide-y">
            {visibleEmployees.map((employee) => (
              <li
                key={employee.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {`${employee.fname.charAt(0)}${employee.lname.charAt(0)}`.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {employee.fname} {employee.lname}
                  </p>
                  <p className="text-sm text-muted-foreground">+{employee.phone}</p>
                </div>
                <span className="w-fit rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize text-secondary-foreground">
                  {employee.role === "hr" ? "HR" : employee.role.replace("_", " ")}
                </span>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
                    employee.isActive
                      ? "bg-green-500/10 text-green-700 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {employee.isActive ? "Active" : "Deactivated"}
                </span>
                {employee.role !== "super_admin" && (canAssignElevatedRoles || employee.role === "employee") && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link to={`/employees/${employee.id}/edit`} />}
                  >
                    <UserRoundPen />
                    Edit
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {pageStart + 1}–{pageStart + visibleEmployees.length} of {filteredEmployees.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft /> Prev
              </Button>
              <span className="text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
