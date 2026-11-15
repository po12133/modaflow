import { ChartLine, CreditCard, House, Menu, Package, ReceiptText, Settings, ShoppingCart, UserRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Feature not built yet: shows an "En desarrollo" tag. */
  soon?: boolean;
  /** Other route prefixes that belong to this section. */
  also?: string[];
  /** Route prefixes that look like this section but belong to another one. */
  except?: string[];
}

/** Main sections, shared by the desktop sidebar and the mobile bottom bar. */
export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: House },
  { href: "/dashboard/productos", label: "Inventario", icon: Package, also: ["/dashboard/inventario"] },
  { href: "/dashboard/ventas/nueva", label: "Vender", icon: ShoppingCart, also: ["/dashboard/vender"] },
  { href: "/dashboard/ventas", label: "Ventas", icon: ReceiptText, except: ["/dashboard/ventas/nueva"] },
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

export function itemActive(pathname: string, item: NavItem): boolean {
  if ((item.except ?? []).some((p) => isActive(pathname, p))) return false;
  return isActive(pathname, item.href) || (item.also ?? []).some((p) => isActive(pathname, p));
}

export const navItem = (href: string): NavItem => MAIN_NAV.find((i) => i.href === href)!;
