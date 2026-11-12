import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">{children}</div>;
}

export function Panel({ title, description, actions, children, className }: { title?: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("panel p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-bold">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function BigStat({ label, value, tone }: { label: string; value: number | string; tone?: "danger" | "success" | "default" }) {
  return (
    <div className="panel p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-5xl font-bold tabular-nums", tone === "danger" && "text-danger", tone === "success" && "text-success")}>{value}</p>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: any) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={cn("rounded px-4 py-2 text-sm font-semibold transition-colors", value === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          {t.label}{t.count !== undefined && <span className="ml-2 tabular-nums opacity-80">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

const pillTone: Record<string, string> = {
  Filled: "bg-success/15 text-success",
  Missing: "bg-danger/15 text-danger",
  Upcoming: "bg-secondary text-muted-foreground",
  Completed: "bg-secondary text-muted-foreground",
  Unallocated: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  declined: "bg-danger/15 text-danger",
  returned: "bg-warning/15 text-warning",
  awaiting_ack: "bg-warning/15 text-warning",
  awaiting_approval: "bg-primary/15 text-primary",
  not_sent: "bg-secondary text-muted-foreground",
  pending: "bg-secondary text-muted-foreground",
  sending: "bg-primary/15 text-primary",
  submitted: "bg-primary/15 text-primary",
  queued: "bg-primary/15 text-primary",
  sent: "bg-primary/15 text-primary",
  delivered: "bg-success/15 text-success",
  failed: "bg-danger/15 text-danger",
  partly_failed: "bg-warning/15 text-warning",
  skipped: "bg-secondary text-muted-foreground",
  connected: "bg-success/15 text-success",
  untested: "bg-warning/15 text-warning",
  not_configured: "bg-secondary text-muted-foreground",
};

export const statusLabel: Record<string, string> = {
  awaiting_ack: "Awaiting contractor acknowledgement",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  declined: "Declined",
  returned: "Returned for clarification",
  requested: "Requested",
  not_sent: "Not sent",
  pending: "Pending",
  sending: "Sending",
  submitted: "Submitted",
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
  partly_failed: "Partly failed",
  skipped: "Skipped (duplicate)",
  connected: "Connected",
  untested: "Not tested",
  not_configured: "Not set up",
};

export function Pill({ status, label }: { status: string; label?: string }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold", pillTone[status] ?? "bg-secondary text-muted-foreground")}>{label ?? statusLabel[status] ?? status}</span>;
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
      {empty && <p className="p-6 text-center text-sm text-muted-foreground">Nothing to show.</p>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><span className="max-w-[62%] text-right font-semibold">{value}</span></div>;
}

export function useFlash() {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const node = msg ? <p className={cn("rounded-md p-3 text-sm", msg.error ? "bg-danger/15 text-danger" : "bg-success/15 text-success")}>{msg.text}</p> : null;
  return { show: (text: string, error = false) => setMsg({ text, error }), clear: () => setMsg(null), node };
}

/** A dollar amount that stays blurred until hovered or focused (tap on touch screens). */
export function BlurredAmount({ value, className }: { value: string; className?: string }) {
  return <span tabIndex={0} aria-label={value} className={cn("inline-block w-fit cursor-default select-none rounded tabular-nums outline-none blur-md transition-[filter] duration-150 hover:blur-none focus:blur-none", className)}>{value}</span>;
}

/** Collapsible "Roster costs" bar, closed by default. */
export function CostsToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold">
      <span>Roster costs</span>
      <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">{open ? "Hide" : "Show"}<ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} /></span>
    </button>
  );
}
