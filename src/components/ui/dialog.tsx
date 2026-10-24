"use client";
import { createContext, useState, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./button";
export const CloseDialog = createContext<(() => void) | null>(null);
export function Modal({ title, description, trigger, children }: { title: string; description?: string; trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("common");
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs" />
      <Dialog.Content className="fixed inset-x-3 top-1/2 z-50 mx-auto max-h-[90dvh] max-w-lg -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl outline-none sm:p-7">
        <Dialog.Title className="pr-10 text-xl font-semibold tracking-tight">{title}</Dialog.Title>
        {description ? <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
        <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label={t("close")} className="absolute right-3 top-3"><X /></Button></Dialog.Close>
        <CloseDialog.Provider value={() => setOpen(false)}><div className="mt-6">{children}</div></CloseDialog.Provider>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
