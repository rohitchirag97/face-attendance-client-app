import React from "react";
import { ShieldX } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

const AccessDenied: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldX className="size-7" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-destructive">403 · Unauthorized</p>
        <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
        <p className="text-sm text-muted-foreground">
          You don’t have permission to add employees to this organization.
        </p>
      </div>
      <Button onClick={() => navigate("/", { replace: true })}>
        Return to dashboard
      </Button>
    </div>
  );
};

export default AccessDenied;
