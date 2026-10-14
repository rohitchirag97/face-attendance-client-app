import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import { inputClass } from "@/lib/form-utils";
import {
  announcementsQuery,
  useDeleteAnnouncement,
  usePublishAnnouncement,
} from "@/hooks/use-announcements";
import { canManagePeople, getActiveOrganizationId } from "@/lib/session";

const AnnouncementsPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const canPost = canManagePeople(organizationId);
  const list = useQuery(announcementsQuery(organizationId));
  const publish = usePublishAnnouncement(organizationId);
  const remove = useDeleteAnnouncement(organizationId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError("Enter a title and a message.");
      return;
    }
    publish.mutate(
      { title: title.trim(), body: body.trim() },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Announcements"
        description={
          canPost
            ? "Publish a message for everyone in the organization. Active members are notified."
            : "Messages from your organization."
        }
      />
      {canPost && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-background p-5 shadow-sm" noValidate>
          <Field label="Title">
            {(id) => (
              <input id={id} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            )}
          </Field>
          <Field label="Message" hint={`${body.length}/2000`}>
            {(id) => (
              <textarea
                id={id}
                value={body}
                maxLength={2000}
                rows={4}
                onChange={(e) => setBody(e.target.value)}
                className={`${inputClass} h-auto py-2`}
              />
            )}
          </Field>
          <ErrorText message={error} />
          <Button type="submit" disabled={publish.isPending}>
            {publish.isPending ? "Publishing…" : "Publish & notify"}
          </Button>
        </form>
      )}
      <ErrorText message={list.error?.message ?? remove.error?.message} />
      {list.isLoading ? (
        <Spinner />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState text="No announcements yet." />
      ) : (
        <ul className="space-y-3">
          {list.data!.map((item) => (
            <li key={item.id} className="rounded-xl border bg-background p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">{item.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                    {item.author ? ` · ${item.author}` : ""}
                  </p>
                </div>
                {canPost && (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Delete ${item.title}`}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm("Delete this announcement?")) remove.mutate(item.id);
                    }}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AnnouncementsPage;
