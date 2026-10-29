import type { ReactNode } from "react";
import { Inbox, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-60 flex-col items-center justify-center text-center">
        <div className="mb-4 rounded-2xl bg-muted p-3">
          <Inbox className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

export function Notice({
  children,
  variant = "warning",
}: {
  children: ReactNode;
  variant?: "warning" | "error" | "info";
}) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed ${variant === "error" ? "border-destructive/25 bg-destructive/5 text-destructive" : variant === "warning" ? "border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100" : "border-border bg-muted text-muted-foreground"}`}
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
      {help ? (
        <span className="text-xs font-normal leading-relaxed text-muted-foreground">{help}</span>
      ) : null}
    </label>
  );
}

export function StatusBadge({ label, status }: { label: string; status: string }) {
  const tone = ["paid", "completed", "ok", "active"].includes(status)
    ? "green"
    : ["waiting", "unpaid", "low", "registered", "not_entered"].includes(status)
      ? "amber"
      : ["cancelled", "out", "refunded"].includes(status)
        ? "red"
        : status === "in_progress"
          ? "blue"
          : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}
