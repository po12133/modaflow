"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { chip, useUrlUpdate } from "@/hooks/use-url-update";

const selectClass = "h-11 w-full min-w-0 rounded-xl border border-input bg-card px-2.5 text-base md:h-10 md:text-sm";

export function UrlSelect({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
  const { update, pending } = useUrlUpdate();
  return (
    <label className="grid min-w-0 gap-1 text-xs font-semibold text-ink-2">
      {label}
      <select aria-busy={pending} value={value} onChange={(e) => update({ [name]: e.target.value || undefined })} className={selectClass}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function UrlChips({ name, value, options, label }: { name: string; value: string; options: [string, string][]; label: string }) {
  const { update, pending } = useUrlUpdate();
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" role="group" aria-label={label} aria-busy={pending}>
      {options.map(([v, l], i) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => update({ [name]: i === 0 ? undefined : v })} className={chip(value === v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function UrlSearch({ name, label, placeholder, value }: { name: string; label: string; placeholder: string; value: string }) {
  const { update } = useUrlUpdate();
  const [text, setText] = useState(value);
  return (
    <form
      className="relative min-w-0"
      onSubmit={(e) => {
        e.preventDefault();
        update({ [name]: text.trim() || undefined });
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() !== value && update({ [name]: text.trim() || undefined })}
        placeholder={placeholder}
        aria-label={label}
        className="h-11 bg-card pl-9 text-base md:h-10 md:text-sm"
      />
    </form>
  );
}

export function UrlToggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  const { update } = useUrlUpdate();
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-ink-2">
      <input type="checkbox" checked={checked} onChange={(e) => update({ [name]: e.target.checked ? "true" : undefined })} className="size-5 accent-[#6c4cf5]" />
      {label}
    </label>
  );
}
