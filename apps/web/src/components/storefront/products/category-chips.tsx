import Link from "next/link";
import { catalogQuery } from "@/lib/catalog";
import { cn } from "@modaflow/ui/lib/utils";
import type { PublicCategory } from "@/types/catalog";

export function CategoryChips({ base, categories, active }: { base: string; categories: PublicCategory[]; active?: string }) {
  if (categories.length === 0) return null;
  const chip = (on: boolean) => cn("h-9 shrink-0 rounded-full border px-3.5 text-sm leading-9 font-semibold whitespace-nowrap", on ? "border-transparent bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white text-ink-2");
  return (
    <nav aria-label="Categorías" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      <Link href={base} className={chip(!active)} aria-current={!active ? "page" : undefined}>
        Todo
      </Link>
      {categories.map((c) => (
        <Link key={c.slug} href={`${base}${catalogQuery({ category: c.slug })}`} className={chip(active === c.slug)} aria-current={active === c.slug ? "page" : undefined}>
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
