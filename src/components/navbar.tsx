import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { CreditCard, LogOut, User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import CommandPalette from "@/components/command-palette";
import NotificationBell from "@/components/notification-bell";
import ThemeToggle from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { displayPhone, getActiveOrganizationId, getUser, isOrganizationOwner } from "@/lib/session";
import { signOut } from "@/lib/api";
import { useLocation } from "react-router";

const NavBar: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [user, setUser] = useState(getUser);
  useEffect(() => {
    const sync = () => setUser(getUser());
    window.addEventListener("user-updated", sync);
    return () => window.removeEventListener("user-updated", sync);
  }, []);
  const fullName = user ? `${user.fname} ${user.lname}`.trim() : "User";
  const initials = user
    ? `${user.fname.charAt(0)}${user.lname.charAt(0)}`.toUpperCase()
    : "U";
  const pageTitle = pathname === "/"
    ? "Dashboard"
    : pathname.split("/").filter(Boolean).at(-1)?.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? "HRMS";

  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur md:px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{pageTitle}</p>
      </div>
      <div className="flex w-full max-w-sm justify-center">
        <CommandPalette />
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account menu"
            className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
              {initials}
            </span>
            <span className="hidden max-w-36 text-left sm:block">
              <span className="block truncate text-xs font-semibold">{fullName}</span>
              <span className="block text-[11px] text-muted-foreground">Account</span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{fullName}</span>
                {user && <span className="text-xs font-normal">{displayPhone(user) ?? user.email}</span>}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")}>
              <UserIcon /> View profile
            </DropdownMenuItem>
            {isOrganizationOwner(getActiveOrganizationId()) && (
              <DropdownMenuItem onClick={() => navigate("/billing")}>
                <CreditCard /> Billing &amp; plan
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onClick={logout}>
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default NavBar;
