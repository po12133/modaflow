import type { Metadata } from "next";
import Link from "next/link";
import { SettingsPanel } from "@/components/admin/settings-panels";
import { getMe } from "@/lib/dal";
import { searchParam as one } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { getPlatformSettings } from "@/services/admin";

export const metadata: Metadata = { title: "Configuración" };

export const instant = false;

const TABS: [string, string][] = [["general", "General"], ["suscripciones", "Suscripciones"], ["pagos", "Pagos"], ["notificaciones", "Notificaciones"]];

export default async function SettingsPage({ searchParams }: PageProps<"/admin/configuracion">) {
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === one(sp.tab)) ? one(sp.tab)! : "general";
  const [settings, me] = await Promise.all([getPlatformSettings(), getMe()]);
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Configuración</h1>
      <nav aria-label="Secciones" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex min-w-max gap-1 rounded-xl bg-muted p-1">
          {TABS.map(([k, l]) => (
            <li key={k}>
              <Link href={`?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={cn("block rounded-lg px-3.5 py-2 text-sm font-bold", tab === k ? "bg-white text-violet-strong shadow-sm" : "text-ink-2")}>
                {l}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <SettingsPanel key={tab} tab={tab} s={settings} canEdit={me?.user.globalRole === "SUPERADMIN"} />
    </div>
  );
}
