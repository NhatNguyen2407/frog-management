import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Badge({ className, tone = "neutral", ...props }: ComponentProps<"span"> & { tone?: "neutral" | "green" | "amber" | "red" | "blue" }) {
  return <span data-slot="badge" className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", {
    "bg-muted text-muted-foreground": tone === "neutral", "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200": tone === "green",
    "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200": tone === "amber", "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200": tone === "red",
    "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200": tone === "blue",
  }, className)} {...props} />;
}
