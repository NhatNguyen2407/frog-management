import { getTranslations } from "next-intl/server";
import { Plus, ShieldCheck } from "lucide-react";
import { getWorkspace } from "@/lib/permissions/context";
import { requireData } from "@/lib/supabase/query";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ActionForm } from "@/components/action-form";
import { EmptyState, Field, Notice, PageTitle } from "@/components/shared";
export async function SettingsView() {
  const [w,t]=await Promise.all([getWorkspace(),getTranslations()]);
  if(!w.owner)return <EmptyState title={t("common.permissionTitle")} description={t("common.permissionBody")}/>;
  const rows=await requireData(w.client.from("staff_allowlist").select("*").eq("business_unit_id",w.unit.id).order("created_at"));
  return <><PageTitle title={t("settings.title")} description={t("settings.description")} action={<Modal title={t("settings.add")} trigger={<Button><Plus aria-hidden/>{t("settings.add")}</Button>}><ActionForm action="allowlistSave" label={t("common.save")} hidden={{active:"on"}}><Field label={t("settings.email")}><Input name="email" required type="email" maxLength={254}/></Field><Field label={t("settings.role")}><Select name="role"><option value="staff">{t("common.staff")}</option><option value="owner">{t("common.owner")}</option></Select></Field></ActionForm></Modal>}/><Notice variant="info">{t("settings.scope")} {t("settings.initialOwner")}</Notice><div className="space-y-3">{rows.map(row=><Card key={row.id}><CardContent className="flex flex-wrap items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><ShieldCheck aria-hidden className="size-5 shrink-0 text-primary"/><div className="min-w-0"><p className="break-all text-sm font-medium">{row.email}</p><p className="mt-1 text-xs text-muted-foreground">{t(`common.${row.role}`)}</p></div></div><div className="flex flex-wrap items-center gap-2"><Badge tone={row.active?"green":"neutral"}>{t(row.active?"common.active":"common.inactive")}</Badge><Modal title={t("common.edit")} trigger={<Button variant="ghost">{t("common.edit")}</Button>}><ActionForm action="allowlistSave" label={t("common.save")} hidden={{email:row.email,...(row.active?{active:"on"}:{})}}><Field label={t("settings.role")}><Select name="role" defaultValue={row.role}><option value="staff">{t("common.staff")}</option><option value="owner">{t("common.owner")}</option></Select></Field></ActionForm></Modal><ActionForm action="allowlistSave" variant="secondary" label={t(row.active?"common.inactive":"common.active")} hidden={{email:row.email,role:row.role,...(!row.active?{active:"on"}:{})}} confirm={row.active?t("settings.disableConfirm"):undefined} className="grid"/></div></CardContent></Card>)}</div></>;
}
