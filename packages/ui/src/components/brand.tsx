import Link from "next/link";
import { cn } from "../lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <defs>
        <linearGradient id="mf-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C5CFF" />
          <stop offset="1" stopColor="#FF5C8A" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#mf-logo-g)" />
      <path
        d="M9 22V11l7 7 7-7v11"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-foreground", className)}
    >
      <LogoMark />
      ModaFlow
    </Link>
  );
}
