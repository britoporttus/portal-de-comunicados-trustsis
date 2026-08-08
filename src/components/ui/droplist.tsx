"use client"

import * as React from "react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Droplist — o componente PADRÃO de lista de seleção do portal.
 *
 * Por que existe: o portal usava `<select>` NATIVO (NativeSelect) em ~24 lugares, e o
 * navegador desenha o popup nativo com a aparência do SISTEMA — ignorando os tokens do
 * projeto (fundo branco no tema escuro, fonte do SO, check do SO). Este wrapper renderiza
 * a lista em React (via Base UI + portal), então ela obedece os tokens e o tema.
 *
 * Ergonomia inspirada no `CustomSelect` do gds4u — API por `options` em vez de composição
 * manual, com `description` opcional por item — mas implementada sobre as primitivas Base UI
 * que este projeto já usa, herdando teclado/ARIA/posicionamento de graça.
 *
 * PADRÃO: use este componente para qualquer lista de seleção nova. Só use `NativeSelect`
 * quando o popup nativo do SO for de fato desejável (ex.: campo pesado em mobile).
 */

export type DroplistValue = string | number

export type DroplistOption<T extends DroplistValue = string> = {
  value: T
  label: React.ReactNode
  /** Linha secundária, menor e esmaecida — para explicar a opção. */
  description?: React.ReactNode
  /** Ícone à esquerda do label. */
  icon?: React.ReactNode
  disabled?: boolean
  /** Agrupa opções sob um cabeçalho. Opções sem grupo aparecem primeiro. */
  group?: string
}

export type DroplistProps<T extends DroplistValue> = {
  value: T | null | undefined
  onChange: (value: T) => void
  options: DroplistOption<T>[]
  /** Texto mostrado quando não há valor selecionado. */
  placeholder?: string
  disabled?: boolean
  required?: boolean
  size?: "sm" | "default"
  id?: string
  name?: string
  /** Classe do TRIGGER (o campo). Use `w-full` em formulários. */
  className?: string
  /** Classe do POPUP (a lista). */
  contentClassName?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
}

export function Droplist<T extends DroplistValue>({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  disabled,
  required,
  size = "default",
  id,
  name,
  className,
  contentClassName,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: DroplistProps<T>) {
  // Mapa valor -> opção, para o trigger saber renderizar o LABEL (e não o valor cru).
  const porValor = React.useMemo(() => {
    const m = new Map<DroplistValue, DroplistOption<T>>()
    for (const o of options) m.set(o.value, o)
    return m
  }, [options])

  // Preserva a ordem de aparição dos grupos, mantendo os sem-grupo no topo.
  const grupos = React.useMemo(() => {
    const ordem: (string | undefined)[] = []
    const buckets = new Map<string | undefined, DroplistOption<T>[]>()
    for (const o of options) {
      const g = o.group
      if (!buckets.has(g)) {
        buckets.set(g, [])
        ordem.push(g)
      }
      buckets.get(g)!.push(o)
    }
    return ordem.map((g) => ({ nome: g, itens: buckets.get(g)! }))
  }, [options])

  const temGrupos = grupos.some((g) => g.nome != null)

  const renderItem = (o: DroplistOption<T>) => (
    <SelectItem key={String(o.value)} value={o.value} disabled={o.disabled}>
      {o.icon}
      {o.description ? (
        <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
          <span className="truncate">{o.label}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {o.description}
          </span>
        </span>
      ) : (
        <span className="truncate">{o.label}</span>
      )}
    </SelectItem>
  )

  return (
    <Select
      value={value ?? null}
      onValueChange={(v) => onChange(v as T)}
      disabled={disabled}
      required={required}
      name={name}
    >
      <SelectTrigger
        id={id}
        size={size}
        className={className}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
      >
        <SelectValue placeholder={placeholder}>
          {(v: unknown) => {
            const o = porValor.get(v as DroplistValue)
            // Sem opção casada (valor vazio/desconhecido) -> deixa o placeholder aparecer.
            if (!o) return null
            return (
              <span className="flex min-w-0 items-center gap-1.5">
                {o.icon}
                <span className="truncate">{o.label}</span>
              </span>
            )
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {temGrupos
          ? grupos.map((g) => (
              <SelectGroup key={g.nome ?? "__sem_grupo__"} className="p-0">
                {g.nome != null && <SelectLabel>{g.nome}</SelectLabel>}
                {g.itens.map(renderItem)}
              </SelectGroup>
            ))
          : options.map(renderItem)}
      </SelectContent>
    </Select>
  )
}
