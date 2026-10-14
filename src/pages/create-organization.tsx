import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateOrganization } from "@/hooks/use-api";
import { getOrganizations } from "@/lib/session";
import { signOut } from "@/lib/api";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const CreateOrganization: React.FC = () => {
  const navigate = useNavigate();
  const hasOrganizations = getOrganizations().length > 0;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const create = useCreateOrganization();
  const loading = create.isPending;
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !slug) {
      setError("Organization name and slug are required.");
      return;
    }
    create.mutate(
      { name: name.trim(), slug },
      {
        onSuccess: () => navigate("/", { replace: true }),
        onError: (err) => setError(err.message),
      },
    );
  };

  const inputClass =
    "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-sm sm:p-8">
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Create organization</h1>
          <p className="text-sm text-muted-foreground">
            {hasOrganizations
              ? "Add another organization to your account."
              : "Create your first organization to get started."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Organization name
            </label>
            <input
              id="name"
              value={name}
              autoFocus
              disabled={loading}
              placeholder="Acme Corporation"
              onChange={(e) => {
                setName(e.target.value);
                if (!slugEdited) setSlug(slugify(e.target.value));
              }}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="slug" className="text-sm font-medium">
              Slug
            </label>
            <input
              id="slug"
              value={slug}
              disabled={loading}
              placeholder="acme-corporation"
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(slugify(e.target.value));
              }}
              className={inputClass}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="h-10 w-full text-sm" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Create organization
          </Button>
          {hasOrganizations ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                void signOut().then(() => navigate("/login", { replace: true }));
              }}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Log out
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default CreateOrganization;

