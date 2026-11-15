"use client";

import { Archive, ArchiveRestore, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { archiveProductAction, restoreProductAction } from "@/actions/products";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Archive (with confirmation) or restore a product. Archiving never deletes history. */
export function ArchiveButton({ productId, archived }: { productId: string; archived: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const result = archived ? await restoreProductAction(productId) : await archiveProductAction(productId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
    });
  }

  if (archived) {
    return (
      <div className="grid gap-1">
        <Button variant="outline" size="lg" className="h-11" onClick={run} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ArchiveRestore aria-hidden="true" />}
          Restaurar producto
        </Button>
        {error && <p role="alert" className="text-xs font-semibold text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-11 text-destructive">
          <Archive aria-hidden="true" /> Archivar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Archivar este producto?</DialogTitle>
          <DialogDescription>
            Dejará de aparecer en tu inventario y no contará para el límite de tu plan. Su historial de movimientos se conserva y
            puedes restaurarlo cuando quieras.
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="lg" className="h-11">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" size="lg" className="h-11 bg-destructive text-white hover:bg-destructive/90" onClick={run} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Archivar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
