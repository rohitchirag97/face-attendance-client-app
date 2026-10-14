import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  notificationsQuery,
  unreadCountQuery,
  useMarkNotificationsRead,
  type AppNotification,
} from "@/hooks/use-notifications";
import { getActiveOrganizationId } from "@/lib/session";

const PAGE = 10;

const timeAgo = (iso: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [organizationId, setOrganizationId] = useState(getActiveOrganizationId);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    const sync = () => setOrganizationId(getActiveOrganizationId());
    window.addEventListener("active-organization-updated", sync);
    return () => window.removeEventListener("active-organization-updated", sync);
  }, []);

  const orgId = organizationId ?? "";
  const { data: unread } = useQuery({ ...unreadCountQuery(orgId), enabled: Boolean(organizationId) });
  const { data, isPending } = useQuery({
    ...notificationsQuery(orgId, limit),
    enabled: Boolean(organizationId) && open,
  });
  const markRead = useMarkNotificationsRead(orgId);

  if (!organizationId) return null;
  const count = unread?.count ?? 0;

  const openItem = (item: AppNotification) => {
    if (!item.readAt) markRead.mutate([item.id]);
    if (item.link) navigate(item.link);
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setLimit(PAGE);
      }}
    >
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" />}
        aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      >
        <Bell />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={count === 0 || markRead.isPending}
            onClick={() => markRead.mutate("all")}
          >
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-96 overflow-y-auto p-1">
          {isPending ? (
            <div className="space-y-2 p-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              {data.items.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => openItem(item)}
                  className="flex-col items-start gap-0.5 py-2"
                >
                  <span className="flex w-full items-start gap-2">
                    {!item.readAt && (
                      <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <span className={item.readAt ? "text-sm" : "text-sm font-semibold"}>{item.title}</span>
                  </span>
                  {item.body && (
                    <span className="line-clamp-2 pl-4 text-xs text-muted-foreground">{item.body}</span>
                  )}
                  <span className="pl-4 text-[11px] text-muted-foreground">{timeAgo(item.createdAt)}</span>
                </DropdownMenuItem>
              ))}
              {data.nextCursor && limit < 50 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setLimit((current) => current + PAGE)}
                >
                  Show more
                </Button>
              )}
            </>
          ) : (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
