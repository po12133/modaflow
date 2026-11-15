import type { ReactNode } from "react";

export function AuthHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 text-sm text-muted-foreground sm:text-base">{description}</p>}
    </header>
  );
}
