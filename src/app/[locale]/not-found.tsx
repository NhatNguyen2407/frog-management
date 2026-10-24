import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared";
export default async function NotFound() { const [t,e] = await Promise.all([getTranslations("common"),getTranslations("errors")]); return <main className="mx-auto max-w-xl p-6"><EmptyState title={e("not_found")} action={<Button asChild><Link href="/">{t("back")}</Link></Button>} /></main>; }
