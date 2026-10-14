import React from "react";

export type TabItem = { id: string; label: string };

export const TabLayout: React.FC<{
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  children: React.ReactNode;
}> = ({ tabs, active, onChange, children }) => (
  <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:items-start">
    <div
      role="tablist"
      aria-orientation="vertical"
      className="flex flex-row flex-wrap gap-1 rounded-xl border bg-muted/40 p-1.5 md:flex-col md:flex-nowrap"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
            active === tab.id
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
    <div className="min-w-0 space-y-4">{children}</div>
  </div>
);

// Inactive panels stay mounted (hidden) so unsaved input survives tab switches.
export const TabPanel: React.FC<{ id: string; active: string; children: React.ReactNode }> = ({
  id,
  active,
  children,
}) => (
  <div role="tabpanel" hidden={active !== id} className={active === id ? "space-y-4" : "hidden"}>
    {children}
  </div>
);
