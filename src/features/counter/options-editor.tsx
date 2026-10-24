"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/shared";
const standardKeys=["font","fabric_colour","thread_colour","size","file_link","note"];
export function OptionsEditor({value,onChange}:{value:Record<string,string>;onChange:(value:Record<string,string>)=>void}) {
  const t=useTranslations();const [key,setKey]=useState("");const [detail,setDetail]=useState("");
  function change(name:string,text:string){const next={...value};if(text)next[name]=text;else delete next[name];onChange(next);}
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{standardKeys.map(name=><Field key={name} label={t(`options.${name}`)}><Input type={name==="file_link"?"url":"text"} value={value[name]??""} onChange={event=>change(name,event.target.value)} maxLength={name==="file_link"?2000:300}/></Field>)}</div>
    {Object.entries(value).filter(([name])=>!standardKeys.includes(name)).map(([name,text])=><div key={name} className="flex items-end gap-2"><div className="flex-1"><Field label={name}><Input value={text} maxLength={1000} onChange={event=>change(name,event.target.value)}/></Field></div><Button type="button" variant="ghost" size="icon" aria-label={t("common.remove")} onClick={()=>change(name,"")}><X/></Button></div>)}
    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"><Field label={t("options.key")}><Input value={key} maxLength={60} onChange={e=>setKey(e.target.value)}/></Field><Field label={t("options.value")}><Input value={detail} maxLength={1000} onChange={e=>setDetail(e.target.value)}/></Field><Button type="button" variant="secondary" size="icon" aria-label={t("options.add")} disabled={!key.trim()||!detail.trim()||key.trim()==="__proto__"} onClick={()=>{onChange({...value,[key.trim()]:detail.trim()});setKey("");setDetail("");}}><Plus/></Button></div>
  </div>;
}
