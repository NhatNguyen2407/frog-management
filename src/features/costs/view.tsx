import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { getWorkspace } from "@/lib/permissions/context";
import { requireData } from "@/lib/supabase/query";
import { formatDate, formatVnd, todayInVietnam } from "@/lib/formatting";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { ActionForm } from "@/components/action-form";
import { EmptyState, Field, Notice, PageTitle } from "@/components/shared";
export async function CostsView() {
  const [w,t]=await Promise.all([getWorkspace(),getTranslations()]);
  if(!w.owner)return <EmptyState title={t("common.permissionTitle")} description={t("common.permissionBody")}/>;
  if(!w.event)return <EmptyState title={t("common.noEvent")} description={t("common.noEventBody")}/>;
  const rows=await requireData(w.client.from("costs").select("*").eq("event_id",w.event.id).order("cost_date",{ascending:false}).order("created_at",{ascending:false}));
  return <><PageTitle title={t("costs.title")} description={t("costs.description")} action={<Modal title={t("costs.add")} trigger={<Button><Plus aria-hidden/>{t("costs.add")}</Button>}><ActionForm action="costSave" label={t("costs.add")} hidden={{event_id:w.event.id}}><Field label={t("common.category")}><Input name="category" required maxLength={100}/></Field><Field label={t("costs.amount")}><Input name="amount" type="number" required min={0} max={1000000000000} step={1}/></Field><Field label={t("common.date")}><Input name="date" type="date" required defaultValue={todayInVietnam()}/></Field><Field label={t("costs.note")}><Textarea name="note" maxLength={2000}/></Field></ActionForm></Modal>}/><Notice variant="info">{t("costs.accountingHelp")}</Notice>
    {!rows.length?<EmptyState title={t("costs.empty")} description={t("costs.emptyBody")}/>:<Card className="overflow-hidden"><div className="table-wrap"><table className="data-table"><thead><tr><th>{t("common.date")}</th><th>{t("common.category")}</th><th>{t("costs.note")}</th><th>{t("costs.amount")}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{formatDate(row.cost_date)}</td><td className="font-medium">{row.category}</td><td className="max-w-xs whitespace-normal text-muted-foreground">{row.note}</td><td className="number font-semibold">{formatVnd(row.amount_vnd,w.locale)}</td></tr>)}</tbody></table></div></Card>}
  </>;
}
