import { CircleCheck } from "lucide-react";

export function DeletedNotice() {
  return (
    <p role="status" className="mb-3 flex items-center gap-2 rounded-2xl bg-mint/10 px-4 py-3 text-sm font-semibold text-[#0b7a66]">
      <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
      Producto eliminado. Ya no aparece en tu inventario ni cuenta para tu plan.
    </p>
  );
}
