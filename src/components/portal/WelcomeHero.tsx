// Banner de boas-vindas da home: saudação personalizada sobre um painel navy da marca,
// com o motivo dos 4 quadrados (marca TrustSis) como decoração sutil. Segue a identidade
// "console navy + 1 acento ciano" (design/language.json) e a checklist anti-slop:
// navy monocromático (sem flood ciano), ciano só como sinal, hairline, sem bounce.
import * as React from "react";
import { saudacao, iniciais } from "@/lib/format";
import { usePortal } from "@/context/PortalProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/** Data por extenso, ex.: "Segunda-feira, 18 de agosto". Capitaliza o dia da semana. */
function dataDeHoje(): string {
  const s = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Motivo decorativo dos 4 quadrados da marca TrustSis (topo-dir do banner).
 *  Baixo contraste — decoração, não conteúdo; o quadrado ciano é o único sinal de cor. */
function MarcaMotivo() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -right-6 -top-8 hidden opacity-90 sm:block"
    >
      <div className="grid grid-cols-2 gap-3">
        <span className="size-10 rounded-xl bg-white/10" />
        <span className="size-16 rounded-2xl bg-white/[0.07]" />
        <span className="size-12 rounded-xl bg-[var(--primary-500)]/70" />
        <span className="size-20 rounded-2xl bg-white/[0.05]" />
      </div>
    </div>
  );
}

export function WelcomeHero() {
  const { me } = usePortal();
  const primeiro = me?.nome?.split(" ")[0] ?? "colaborador";

  return (
    <section
      className="relative mb-6 overflow-hidden rounded-2xl border border-white/10 px-5 py-6 sm:px-7 sm:py-7"
      style={{
        backgroundImage:
          "linear-gradient(120deg, var(--brand-navy) 0%, var(--brand-navy-2) 100%)",
      }}
    >
      {/* filete ciano no topo — único acento de cor, à esquerda */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[var(--primary-500)] via-[var(--primary-500)]/40 to-transparent"
      />
      <MarcaMotivo />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/55">
            {dataDeHoje()}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {saudacao()}, {primeiro}
          </h1>
          <p className="mt-1.5 max-w-[60ch] text-sm text-white/70">
            Tudo o que você precisa da TrustSis, em um só lugar.
          </p>
        </div>

        {me?.nome && (
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 backdrop-blur-sm">
            <Avatar className="size-10 shrink-0">
              {me.fotoUrl && <AvatarImage src={me.fotoUrl} alt={me.nome} />}
              <AvatarFallback className="bg-[var(--primary-500)]/25 text-xs font-semibold text-white">
                {iniciais(me.nome)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-white">{me.nome}</p>
              {(me.cargo || me.area) && (
                <p className="truncate text-xs text-white/60">
                  {[me.cargo, me.area].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
