"use client";
import { useContext, useState, useTransition, type ReactNode, type FormEvent } from "react";
import { AlertDialog } from "radix-ui";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { mutate, type ActionName } from "@/features/actions";
import { Button } from "./ui/button";
import { CloseDialog } from "./ui/dialog";
import { Notice } from "./shared";

export function ActionForm({
  action,
  children,
  label,
  confirm,
  variant,
  className = "grid gap-4",
  hidden = {},
}: {
  action: ActionName;
  children?: ReactNode;
  label: string;
  confirm?: string;
  variant?: "default" | "secondary" | "ghost" | "destructive";
  className?: string;
  hidden?: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmation, setConfirmation] = useState<FormData | null>(null);
  const close = useContext(CloseDialog);
  const router = useRouter();
  const t = useTranslations();
  function submit(data: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await mutate(action, data);
      if (result.ok) {
        setSaved(true);
        close?.();
        router.refresh();
      } else setError(result.error ?? "generic");
    });
  }
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (confirm) setConfirmation(data);
    else submit(data);
  }
  return (
    <>
      <form onSubmit={onSubmit} className={className}>
        {Object.entries(hidden).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <fieldset disabled={pending} className="contents">
          {children}
          <Button type="submit" variant={variant} disabled={pending}>
            {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
            {pending ? t("common.saving") : label}
          </Button>
        </fieldset>
        {error ? (
          <Notice variant="error">
            {t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.generic")}
          </Notice>
        ) : null}
        {saved && !close ? (
          <p className="text-xs text-primary" role="status">
            {t("common.saved")}
          </p>
        ) : null}
      </form>
      <AlertDialog.Root
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/45" />
          <AlertDialog.Content className="fixed inset-x-4 top-1/2 z-[71] mx-auto max-w-md -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl">
            <AlertDialog.Title className="text-lg font-semibold">
              {t("common.confirm")}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {confirm}
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">{t("common.cancel")}</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirmation) submit(confirmation);
                    setConfirmation(null);
                  }}
                >
                  {t("common.confirm")}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
