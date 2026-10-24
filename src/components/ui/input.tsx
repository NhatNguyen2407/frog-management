import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export const inputClass = "min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-60 md:text-sm";
export function Input({ className, ...props }: ComponentProps<"input">) { return <input data-slot="input" className={cn(inputClass, className)} {...props} />; }
export function Textarea({ className, ...props }: ComponentProps<"textarea">) { return <textarea data-slot="textarea" className={cn(inputClass, "min-h-24 resize-y", className)} {...props} />; }
export function Select({ className, ...props }: ComponentProps<"select">) { return <select data-slot="native-select" className={cn(inputClass, "pr-8", className)} {...props} />; }
