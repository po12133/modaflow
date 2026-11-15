import type { Metadata } from "next";
import { ChangePasswordForm, ProfileForm } from "@/components/account/account-forms";
import { LogoutButton, PageHeader } from "@/components/dashboard/common";
import { getDashboardContext } from "@/lib/dal";
import { formatDate, ROLE_LABELS } from "@modaflow/ui/lib/format";

export const metadata: Metadata = { title: "Mi cuenta" };

// Per-request page (reads the session through the API).
export const instant = false;

export default async function AccountPage() {
  const { me } = await getDashboardContext();

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Mi cuenta"
        description={`${ROLE_LABELS[me.membership.role]} de ${me.membership.tenantName} · desde el ${formatDate(me.user.createdAt)}`}
      />
      <section aria-labelledby="profile" className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
        <h2 id="profile" className="mb-4 text-lg font-extrabold">
          Perfil
        </h2>
        <ProfileForm name={me.user.name} email={me.user.email} />
      </section>
      <section aria-labelledby="password" className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
        <h2 id="password" className="mb-1 text-lg font-extrabold">
          Contraseña
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">Al cambiarla cerraremos tus sesiones en otros dispositivos.</p>
        <ChangePasswordForm />
      </section>
      <section className="rounded-2xl border bg-card p-2 shadow-sm lg:hidden">
        <LogoutButton />
      </section>
    </div>
  );
}
