import { getTranslations } from "next-intl/server";
export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <div role="status" className="mx-auto max-w-7xl animate-pulse space-y-6 p-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="h-10 w-64 rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="h-32 rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-80 rounded-2xl bg-muted" />
    </div>
  );
}
