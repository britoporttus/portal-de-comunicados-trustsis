// Peças reutilizáveis para CRUD do admin: diálogo de formulário, campo rotulado e confirmação de exclusão.
import { useState, type ReactNode, type ReactElement, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export function Field({ label, htmlFor, children, hint }: {
  label: string; htmlFor?: string; children: ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FormDialog({
  open, onOpenChange, title, description, children, onSubmit, submitLabel = "Salvar", submitting,
  className,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: () => void | Promise<void>;
  submitLabel?: string;
  submitting?: boolean;
  /** Largura do diálogo (ex.: "sm:max-w-3xl") para formulários mais densos. */
  className?: string;
}) {
  const handle = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* O diálogo NÃO rola como um bloco só: as linhas do grid são [cabeçalho, corpo] e o
          corpo recebe minmax(0,1fr), então só ELE rola — e apenas quando o conteúdo não
          couber. Antes o `overflow-y-auto` estava no container inteiro, o que levava título
          e botões embora no scroll e deixava a barra sempre visível. */}
      <DialogContent
        className={cn("max-h-[90vh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-lg", className)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handle} className="flex min-h-0 flex-col gap-4">
          {/* `-mx-1 px-1` evita que o anel de foco dos campos seja cortado na área de scroll. */}
          <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">{children}</div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Salvando…" : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDelete({ onConfirm, label = "Excluir item", trigger }: {
  onConfirm: () => void | Promise<void>;
  label?: string;
  trigger?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          (trigger as ReactElement) ?? (
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="size-4" />
            </Button>
          )
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
