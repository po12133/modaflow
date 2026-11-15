import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-ink-2 hover:bg-muted hover:text-destructive">
        <LogOut className="size-[18px] text-[#8f8aa8]" aria-hidden="true" />
        Cerrar sesión
      </button>
    </form>
  );
}
