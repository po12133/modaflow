import { redirect } from "next/navigation";

/** Old Stage 1 placeholder: the point of sale now lives at /dashboard/ventas/nueva. */
export default function SellRedirect() {
  redirect("/dashboard/ventas/nueva");
}
