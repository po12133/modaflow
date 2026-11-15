import type { CSSProperties, ReactNode } from "react";
import { readableText } from "@/lib/catalog";
import type { PublicStore } from "@/types/catalog";

export function StoreTheme({ store, children }: { store: Pick<PublicStore, "primaryColor" | "secondaryColor">; children: ReactNode }) {
  const style = {
    "--brand": store.primaryColor,
    "--brand-ink": readableText(store.primaryColor),
    "--brand-2": store.secondaryColor,
    "--brand-soft": `color-mix(in srgb, ${store.primaryColor} 12%, white)`,
  } as CSSProperties;
  return (
    <div style={style} className="flex min-h-dvh flex-col bg-[#fbf8f6] text-foreground">
      {children}
    </div>
  );
}
