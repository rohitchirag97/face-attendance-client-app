import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
}> = ({ label, hint, children }) => {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};

export const PageHeader: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
    {action}
  </div>
);

export const Spinner: React.FC = () => (
  <div className="space-y-3 py-2" role="status" aria-label="Loading">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-3/4" />
  </div>
);

export const PageSkeleton: React.FC = () => (
  <div className="space-y-6" role="status" aria-label="Loading page">
    <div className="space-y-2">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  </div>
);

export const ErrorText: React.FC<{ message?: string | null }> = ({ message }) =>
  message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;

export const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <p className="rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground">{text}</p>
);
