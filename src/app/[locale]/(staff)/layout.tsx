import { getWorkspace } from "@/lib/permissions/context";
import { Shell } from "@/components/layout/shell";
export default async function StaffLayout({children}:{children:React.ReactNode}) { const context=await getWorkspace();return <Shell units={context.units} unit={context.unit} events={context.events} event={context.event} email={context.user.email??""}>{children}</Shell>; }
