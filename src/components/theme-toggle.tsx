import React, { useEffect, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getTheme, setTheme, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Light / dark / follow-device switch for the top bar. */
const ThemeToggle: React.FC = () => {
  const [theme, setThemeState] = useState<Theme>(getTheme);

  useEffect(() => {
    const sync = () => setThemeState(getTheme());
    window.addEventListener("theme-updated", sync);
    return () => window.removeEventListener("theme-updated", sync);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Change theme"
        className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {/* The icon follows what is on screen, so "System" shows the sun or moon it resolved to. */}
        <Sun className="size-[18px] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-[18px] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
            <Icon /> {label}
            {theme === value && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;
