// Peças reutilizáveis para CRUD do admin: diálogo de formulário, campo rotulado, seções,
// alternador em cartão e confirmação de exclusão.
import { useState, type ReactNode, type ReactElement, type FormEvent, type ComponentType } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export function Field({ label, htmlFor, children, hint, required, className }: {
  label: string; htmlFor?: string; children: ReactNode; hint?: string;
  /** Marca o campo como obrigatório (asterisco discreto ao lado do rótulo). */
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}
        {required && <span aria-hidden className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Bloco de um formulário: um rótulo curto (caixa alta) com filete, agrupando campos afins.
 *
 * PADRÃO: formulários com mais de ~5 campos devem ser divididos em seções — assim o diálogo
 * deixa de ser uma pilha de campos soltos e passa a ter hierarquia legível.
 */
export function FormSection({ title, description, icon: Icon, children, className }: {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  /** Classe do CORPO da seção (ex.: "grid gap-4 sm:grid-cols-2"). */
  className?: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-3.5 shrink-0 text-primary" />}
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
      {description && <p className="-mt-1 text-[11px] text-muted-foreground">{description}</p>}
      <div className={cn("space-y-4", className)}>{children}</div>
    </section>
  );
}

/** Alternador em cartão: caixa de seleção + título + explicação, com estado visível. */
export function ToggleCard({ checked, onChange, label, hint, icon: Icon }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors",
        checked
          ? "border-primary/50 bg-primary/10"
          : "border-border bg-background hover:border-primary/30 hover:bg-secondary/40",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className="mt-0.5"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {Icon && <Icon className="size-3.5 text-muted-foreground" />}
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{hint}</span>}
      </span>
    </label>
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
          <div className="-mx-1 min-h-0 flex-1 space-y-6 overflow-y-auto px-1">{children}</div>
          <DialogFooter className="border-t border-border pt-4">
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
