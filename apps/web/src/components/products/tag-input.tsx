"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

const key = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toLowerCase();

/** Chip-style tag editor: Enter or comma adds, duplicates are ignored (case/accents). */
export function TagInput({
  id,
  value,
  onChange,
  max = 20,
}: {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const parts = raw.split(",").map((p) => p.trim().replace(/\s+/g, " ").toLowerCase()).filter(Boolean);
    const next = [...value];
    for (const p of parts) {
      if (next.length >= max) break;
      if (!next.some((t) => key(t) === key(p))) next.push(p.slice(0, 40));
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Etiquetas">
          {value.map((tag) => (
            <li key={tag} className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-2.5 text-sm font-semibold text-violet-strong">
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`Quitar etiqueta ${tag}`}
                className="grid size-6 place-items-center rounded-full hover:bg-white"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (draft.trim()) add(draft);
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={value.length >= max ? "Máximo de etiquetas alcanzado" : "Ej. casual, manga larga…"}
        disabled={value.length >= max}
        maxLength={40}
        enterKeyHint="done"
        className="h-11 text-base md:h-10 md:text-sm"
      />
    </div>
  );
}
