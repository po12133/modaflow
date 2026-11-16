"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteProductAction } from "@/actions/products";
import { Button } from "@modaflow/ui/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@modaflow/ui/components/ui/dialog";

export function DeleteProductButton({ productId, name }: { productId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await deleteProductAction(productId);
      if (result && !result.ok) setError(result.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-11 text-destructive">
          <Trash2 aria-hidden="true" /> Eliminar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Eliminar «{name}»?</DialogTitle>
          <DialogDescription>
            Desaparece de tu inventario, del punto de venta y del catálogo online, y deja libre su lugar en tu plan. Las ventas que ya
            hiciste con este producto se mantienen en tus reportes. No se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="lg" className="h-11">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" size="lg" className="h-11 bg-destructive text-white hover:bg-destructive/90" onClick={run} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
