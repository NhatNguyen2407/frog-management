import { getTranslations } from "next-intl/server";
import { Monitor } from "lucide-react";
import { getWorkspace } from "@/lib/permissions/context";
import { loadQueue } from "@/lib/supabase/query";
import { EmptyState, PageTitle } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { QueueBoard } from "./board";
export async function QueueView({display=false}:{display?:boolean}) {
  const [w,t]=await Promise.all([getWorkspace(),getTranslations()]);
  if(!w.event)return <div className={display?"p-6":""}><EmptyState title={t("common.noEvent")} description={t("queue.noEvent")} action={<Button asChild><Link href="/">{t("common.back")}</Link></Button>}/></div>;
  const rows=await loadQueue(w.client,w.event.id);
  return <>{!display?<PageTitle title={t("queue.title")} description={t("queue.description")} action={<Button asChild variant="secondary"><Link href="/display" target="_blank" rel="noopener"><Monitor aria-hidden/>{t("nav.display")}</Link></Button>}/>:null}<QueueBoard initial={rows} unitId={w.unit.id} eventId={w.event.id} eventName={w.event.name} display={display}/></>;
}
