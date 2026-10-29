"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations("common");
  return (
    <main className="mx-auto max-w-2xl p-6">
      <EmptyState
        title={t("errorTitle")}
        description={t("errorBody")}
        action={<Button onClick={reset}>{t("retry")}</Button>}
      />
    </main>
  );
}
