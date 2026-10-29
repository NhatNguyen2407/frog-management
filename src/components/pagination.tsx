import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "./ui/button";
export async function Pagination({
  page,
  total,
  pageSize,
  path,
  query = {},
}: {
  page: number;
  total: number;
  pageSize: number;
  path: string;
  query?: Record<string, string>;
}) {
  const t = await getTranslations("common");
  if (total <= pageSize && page === 1) return null;
  return (
    <nav aria-label={t("page", { page })} className="mt-6 flex items-center justify-between gap-3">
      <Button asChild variant="secondary" disabled={page <= 1}>
        <Link
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={page <= 1 ? "pointer-events-none opacity-50" : ""}
          href={{ pathname: path, query: { ...query, page: Math.max(1, page - 1) } }}
        >
          {t("previous")}
        </Link>
      </Button>
      <span className="text-xs text-muted-foreground">{t("page", { page })}</span>
      <Button asChild variant="secondary" disabled={page * pageSize >= total}>
        <Link
          aria-disabled={page * pageSize >= total}
          tabIndex={page * pageSize >= total ? -1 : undefined}
          className={page * pageSize >= total ? "pointer-events-none opacity-50" : ""}
          href={{ pathname: path, query: { ...query, page: page + 1 } }}
        >
          {t("next")}
        </Link>
      </Button>
    </nav>
  );
}
