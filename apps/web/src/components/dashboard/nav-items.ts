import { ChartLine, CreditCard, House, Menu, Package, Settings, ShoppingCart, UserRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Feature not built yet: shows an "En desarrollo" tag. */
  soon?: boolean;
}

/** Main sections, shared by the desktop sidebar and the mobile bottom bar. */
export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: House },
  { href: "/dashboard/inventario", label: "Inventario", icon: Package, soon: true },
  { href: "/dashboard/vender", label: "Vender", icon: ShoppingCart, soon: true },
  { href: "/dashboard/reportes", label: "Reportes", icon: ChartLine, soon: true },
];

export const ACCOUNT_NAV: NavItem[] = [
  { href: "/dashboard/suscripcion", label: "Suscripción", icon: CreditCard },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
  { href: "/dashboard/cuenta", label: "Mi cuenta", icon: UserRound },
];

export const MORE_ITEM: NavItem = { href: "/dashboard/mas", label: "Más", icon: Menu };

export function isActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
