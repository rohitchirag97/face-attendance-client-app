import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Search, UserRoundPen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { employeesQuery } from "@/hooks/use-api";
import {
  getActiveOrganizationId,
  getOrganizations,
} from "@/lib/session";

const SelectEmployeeToUpdate: React.FC = () => {
  const [organizationId, setOrganizationId] = useState(
    getActiveOrganizationId() ?? getOrganizations()[0]?.id ?? "",
  );
  const [search, setSearch] = useState("");

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

  const normalizedSearch = search.trim().toLowerCase();
  const filteredEmployees = employees.filter(
    (employee) =>
      employee.role !== "super_admin" &&
      `${employee.fname} ${employee.lname} ${employee.phone} ${employee.role}`
        .toLowerCase()
        .includes(normalizedSearch),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Employee management</p>
        <h1 className="text-2xl font-semibold tracking-tight">Update employee</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select an employee to edit their details or organization role.
        </p>
      </div>

      <div className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 focus-within:ring-2 focus-within:ring-ring/30">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          aria-label="Search employees"
          placeholder="Search by name, phone, or role"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
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
            {employees.length === 0 ? "No employees to update" : "No matching employees"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {employees.length === 0
              ? "Add employees to this organization before updating them."
              : "Try a different name, phone number, or role."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <ul className="divide-y">
            {filteredEmployees.map((employee) => (
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
                  {employee.role.replace("_", " ")}
                </span>
                {!employee.isActive && (
                  <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    Deactivated
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link to={`/employees/${employee.id}/edit`} />}
                >
                  <UserRoundPen />
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SelectEmployeeToUpdate;
