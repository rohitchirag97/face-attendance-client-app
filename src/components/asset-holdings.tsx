import React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABEL, CONDITION_LABEL, type AssetHolding } from "@/hooks/use-assets";

/** Assets someone holds and held. With onAcknowledge, the holder can confirm receipt. */
const AssetHoldings: React.FC<{
  data: { current: AssetHolding[]; past: AssetHolding[] };
  onAcknowledge?: (assignmentId: string) => void;
  acknowledging?: boolean;
}> = ({ data, onAcknowledge, acknowledging }) => (
  <div className="space-y-5">
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Currently held ({data.current.length})</h2>
      {data.current.length === 0 ? (
        <p className="text-sm text-muted-foreground">No company assets.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.current.map((a) => (
            <li key={a.assignmentId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{a.name} <span className="text-muted-foreground">({a.assetTag})</span></p>
                <p className="text-xs text-muted-foreground">
                  {[CATEGORY_LABEL[a.category], a.serialNumber && `S/N ${a.serialNumber}`, `since ${a.assignedOn}`, `${CONDITION_LABEL[a.conditionOut]} condition`].filter(Boolean).join(" · ")}
                </p>
                {a.notesOut && <p className="text-xs text-muted-foreground">{a.notesOut}</p>}
              </div>
              {a.acknowledgedAt ? (
                <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400"><CheckCircle2 className="size-4" /> Receipt confirmed</span>
              ) : onAcknowledge ? (
                <Button size="sm" disabled={acknowledging} onClick={() => onAcknowledge(a.assignmentId)}>
                  {acknowledging ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} I received this
                </Button>
              ) : (
                <span className="text-xs text-amber-700 dark:text-amber-400">Receipt not confirmed yet</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
    {data.past.length > 0 && (
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Returned</h2>
        <ul className="divide-y rounded-xl border text-sm">
          {data.past.map((a) => (
            <li key={a.assignmentId} className="px-4 py-2">
              {a.name} ({a.assetTag}) · {a.assignedOn} to {a.lost ? <span className="text-red-600">not returned (lost)</span> : `${a.returnedOn}, ${CONDITION_LABEL[a.conditionIn ?? "good"]}`}
            </li>
          ))}
        </ul>
      </section>
    )}
  </div>
);

export default AssetHoldings;
