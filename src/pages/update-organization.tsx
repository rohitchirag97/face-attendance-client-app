import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdateOrganization } from "@/hooks/use-api";
import OrganizationDangerZone from "@/components/organization-danger-zone";
import { getOrganizations } from "@/lib/session";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const inputClass =
  "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

const UpdateOrganization: React.FC = () => {
  const navigate = useNavigate();
  const { organizationId } = useParams();
  const organization = getOrganizations().find(
    (item) => item.id === organizationId,
  );
  const [name, setName] = useState(organization?.name ?? "");
  const [slug, setSlug] = useState(organization?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateOrganization();
  const loading = update.isPending;

  if (!organization || !organizationId) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <h1 className="font-semibold">Organization not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Return to the dashboard and select an organization to edit.
        </p>
        <Button className="mt-4" render={<Link to="/" />}>
          <ArrowLeft />
          Back to dashboard
        </Button>
      </div>
    );
  }

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const normalizedName = name.trim();
    const normalizedSlug = slugify(slug);
    if (!normalizedName || !normalizedSlug) {
      setError("Organization name and slug are required.");
      return;
    }

    update.mutate(
      { organizationId, name: normalizedName, slug: normalizedSlug },
      {
        onSuccess: () => navigate("/", { replace: true }),
        onError: (requestError) => setError(requestError.message),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <Button
          variant="ghost"
          className="mb-3"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft />
          Back
        </Button>
        <p className="text-sm text-muted-foreground">Super admin settings</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Update organization
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Change the organization name and URL slug.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border bg-background p-5 shadow-sm sm:p-6"
        noValidate
      >
        <div className="space-y-1.5">
          <label htmlFor="organization-name" className="text-sm font-medium">
            Organization name
          </label>
          <input
            id="organization-name"
            autoFocus
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugEdited) setSlug(slugify(event.target.value));
            }}
            disabled={loading}
            maxLength={52}
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="organization-slug" className="text-sm font-medium">
            URL slug
          </label>
          <input
            id="organization-slug"
            value={slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(slugify(event.target.value));
            }}
            disabled={loading}
            maxLength={52}
            className={inputClass}
            required
          />
          <p className="text-xs text-muted-foreground">
            Use lowercase letters, numbers, and hyphens.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" size="lg" className="h-10" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Save />}
            Save changes
          </Button>
        </div>
      </form>

      <section aria-labelledby="danger-zone-title" className="space-y-3">
        <div>
          <h2 id="danger-zone-title" className="text-sm font-semibold text-destructive">Danger zone</h2>
          <p className="mt-1 text-sm text-muted-foreground">Only you, as the owner, can see these controls.</p>
        </div>
        <OrganizationDangerZone organization={organization} onChanged={() => navigate("/", { replace: true })} />
      </section>
    </div>
  );
};

export default UpdateOrganization;
