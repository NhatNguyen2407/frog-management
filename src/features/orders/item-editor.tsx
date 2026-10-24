"use client";
import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { LoaderCircle } from "lucide-react";
import type { OrderItem } from "@/lib/supabase/types";
import { formatVnd } from "@/lib/formatting";
import { mutate } from "@/features/actions";
import { OptionsEditor } from "@/features/counter/options-editor";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Notice } from "@/components/shared";
export function ItemEditor({item}:{item:OrderItem}) {
  const t=useTranslations();const [options,setOptions]=useState<Record<string,string>>(()=>item.options&&typeof item.options==="object"&&!Array.isArray(item.options)?Object.fromEntries(Object.entries(item.options).map(([key,value])=>[key,typeof value==="string"?value:JSON.stringify(value)])):{});
  return <ActionForm action="orderItem" label={t("common.save")} hidden={{id:item.id,options:JSON.stringify(options)}}><Field label={t("common.quantity")}><Input name="quantity" type="number" required min={1} max={999} defaultValue={item.quantity}/></Field><OptionsEditor value={options} onChange={setOptions}/></ActionForm>;
}
export function CheckoutTotal({orderId}:{orderId:string}) {
  const t=useTranslations();const locale=useLocale();const [pending,startTransition]=useTransition();const [total,setTotal]=useState<number|null>(null);const [error,setError]=useState<string|null>(null);
  return <div>{total===null?<Button variant="secondary" disabled={pending} onClick={()=>{const form=new FormData();form.set("id",orderId);startTransition(async()=>{const result=await mutate("checkout",form);if(result.ok&&result.checkout?.total_vnd!==undefined){setTotal(result.checkout.total_vnd);setError(null);}else setError(result.error??"generic");});}}>{pending?<LoaderCircle className="animate-spin" aria-hidden/>:null}{t(pending?"common.loading":"orders.checkout")}</Button>:<p className="text-sm">{t("orders.checkoutTotal")}: <strong className="number">{formatVnd(total,locale)}</strong></p>}{error?<Notice variant="error">{t.has(`errors.${error}`)?t(`errors.${error}`):t("errors.generic")}</Notice>:null}</div>;
}
