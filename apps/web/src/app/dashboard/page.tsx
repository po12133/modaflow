import type { Metadata } from "next";
import { LowStockCard } from "@/components/dashboard/home/low-stock-card";
import { Notices } from "@/components/dashboard/home/notices";
import { QuickActions } from "@/components/dashboard/home/quick-actions";
import { SubscriptionSummary } from "@/components/dashboard/home/subscription-summary";
import { TodaySales } from "@/components/dashboard/home/today-sales";
import { WelcomeBanner } from "@/components/dashboard/home/welcome-banner";
import { getDashboardContext, getPlanChangeRequests } from "@/lib/dal";
import { getDashboardSummary } from "@/services/reports";

export const metadata: Metadata = { title: "Inicio" };

export const instant = false;

export default async function DashboardHome({ searchParams }: PageProps<"/dashboard">) {
  const [{ me, store, subscription }, requests, params, sales] = await Promise.all([
    getDashboardContext(),
    getPlanChangeRequests(),
    searchParams,
    getDashboardSummary(),
  ]);
  const pending = requests.find((r) => r.status === "PENDING");

  return (
    <div className="grid gap-5">
      {params.bienvenida === "1" && subscription.status === "TRIALING" && <WelcomeBanner storeName={store.name} expiresAt={subscription.expiresAt} />}
      <header>
        <p className="text-sm text-muted-foreground">{store.name}</p>
        <h1 className="text-2xl font-extrabold tracking-tight">Hola, {me.user.name.split(" ")[0]}</h1>
      </header>
      <QuickActions productCount={subscription.limits.products.used} />
      <TodaySales sales={sales} />
      {sales.lowStock.total > 0 && <LowStockCard lowStock={sales.lowStock} />}
      <SubscriptionSummary subscription={subscription} />
      <Notices subscription={subscription} pending={pending} />
    </div>
  );
}
