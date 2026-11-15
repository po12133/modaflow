import { PartyPopper } from "lucide-react";
import { formatDate } from "@/lib/format";

export function WelcomeBanner({ storeName, expiresAt }: { storeName: string; expiresAt: string }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl bg-brand-gradient p-4 text-white shadow-lg">
          <PartyPopper className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="text-sm">
            <strong className="block text-base">¡{storeName} ya está en ModaFlow!</strong>
            Tu prueba gratuita de 14 días comenzó hoy y termina el {formatDate(expiresAt)}.
          </p>
        </div>
  );
}
