import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorText,
  Field,
  PageHeader,
  Spinner,
} from "@/components/form-kit";
import { inputClass, toTextOrNull } from "@/lib/form-utils";
import {
  departmentsQuery,
  useDeleteDepartment,
  useSaveDepartment,
} from "@/hooks/use-payroll-api";
import { getActiveOrganizationId } from "@/lib/session";

const Departments: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const { data: departments, isLoading, error: loadError } = useQuery(
    departmentsQuery(organizationId),
  );
  const save = useSaveDepartment(organizationId);
  const remove = useDeleteDepartment(organizationId);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Department name is required.");
    save.mutate(
      { name: name.trim(), code: toTextOrNull(code) },
      {
        onSuccess: () => {
          setName("");
          setCode("");
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Departments"
        description="Create departments and assign employees to them from the employee edit screen."
      />

      <form
        onSubmit={handleAdd}
        className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
        noValidate
      >
        <Field label="Name">
          {(id) => (
            <input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} />
          )}
        </Field>
        <Field label="Code (optional)">
          {(id) => (
            <input id={id} value={code} onChange={(e) => setCode(e.target.value)} maxLength={32} className={inputClass} />
          )}
        </Field>
        <Button type="submit" className="h-10" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </form>
      <ErrorText message={error ?? loadError?.message} />

      {isLoading ? (
        <Spinner />
      ) : !departments?.length ? (
        <EmptyState text="No departments yet." />
      ) : (
        <ul className="divide-y rounded-xl border">
          {departments.map((department) => (
            <li key={department.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {department.name}
                  {department.code && (
                    <span className="ml-2 text-xs text-muted-foreground">{department.code}</span>
                  )}
                </p>
                {!department.isActive && <p className="text-xs text-muted-foreground">Inactive</p>}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={save.isPending}
                onClick={() => {
                  setError(null);
                  save.mutate(
                    { id: department.id, isActive: !department.isActive },
                    { onError: (e) => setError(e.message) },
                  );
                }}
              >
                {department.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                aria-label={`Delete ${department.name}`}
                disabled={remove.isPending}
                onClick={() => {
                  setError(null);
                  remove.mutate(department.id, { onError: (e) => setError(e.message) });
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Departments;
