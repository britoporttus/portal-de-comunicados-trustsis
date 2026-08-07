// MARCA DO PORTAL — o admin carrega o logo exibido na navbar, em duas versões:
//  · menu ABERTO (horizontal, com o nome da empresa)
//  · menu RECOLHIDO (quadrado / só o símbolo) — opcional: sem ele o portal reusa o expandido
//
// O arquivo escolhido NÃO vai para o disco do servidor: é reduzido no navegador e guardado
// como data URL PNG (ou SVG, que passa direto) no store, junto do resto da configuração —
// mesma abordagem das imagens de comunicados. Assim o logo sobrevive a deploys sem depender
// de pasta de uploads, e a leitura (`GET /api/marca`) é pública, para o logo aparecer também
// antes do login.
import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Upload, Trash2, Check } from "lucide-react";
import { api } from "@/lib/api";
import { prepararLogo } from "@/lib/image";
import { tempoRelativo } from "@/lib/format";
import { usePortal } from "@/context/PortalProvider";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function MarcaAdmin() {
  const { marca, setMarca } = usePortal();
  // Rascunho local: o admin troca/remove os dois logos e confirma com "Salvar".
  const [expandido, setExpandido] = useState("");
  const [colapsado, setColapsado] = useState("");
  const [pronto, setPronto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Semeia o rascunho com o que já está salvo (a marca chega assíncrona do backend).
  useEffect(() => {
    if (pronto || !marca) return;
    setExpandido(marca.logoExpandido ?? "");
    setColapsado(marca.logoColapsado ?? "");
    setPronto(true);
  }, [marca, pronto]);

  const alterado =
    expandido !== (marca?.logoExpandido ?? "") || colapsado !== (marca?.logoColapsado ?? "");

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    setOk(false);
    try {
      // Envia os dois campos sempre: string vazia = remover aquele logo no backend.
      const salvo = await api.marca.save({ logoExpandido: expandido, logoColapsado: colapsado });
      setMarca(salvo); // navbar atualiza na hora, sem F5
      setOk(true);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Logo exibido no topo do menu. Envie PNG com fundo transparente (ou SVG) para ficar bem
        nos temas claro e escuro. Sem logo carregado, o portal usa a marca padrão.
      </p>

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <CampoLogo
          titulo="Menu aberto"
          descricao="Versão horizontal, com o nome da empresa. Exibida com 36px de altura."
          valor={expandido}
          onChange={(v) => {
            setExpandido(v);
            setOk(false);
          }}
          onErro={setErro}
          quadrado={false}
        />
        <CampoLogo
          titulo="Menu recolhido"
          descricao="Versão quadrada (só o símbolo). Opcional — sem ela reusamos a de cima."
          valor={colapsado}
          onChange={(v) => {
            setColapsado(v);
            setOk(false);
          }}
          onErro={setErro}
          quadrado
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={salvar} disabled={salvando || !alterado}>
          {salvando ? "Salvando…" : "Salvar logo"}
        </Button>
        {ok && !alterado && (
          <span className="flex items-center gap-1.5 text-xs text-primary">
            <Check className="size-3.5" /> Logo aplicado na navbar.
          </span>
        )}
        {marca?.atualizadoEm && (
          <span className="text-xs text-muted-foreground">
            Atualizado {tempoRelativo(marca.atualizadoEm)}
            {marca.atualizadoPor ? ` por ${marca.atualizadoPor}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

/** Um slot de logo: pré-visualização (em xadrez, para revelar transparência) + enviar/remover. */
function CampoLogo({
  titulo,
  descricao,
  valor,
  onChange,
  onErro,
  quadrado,
}: {
  titulo: string;
  descricao: string;
  valor: string;
  onChange: (v: string) => void;
  onErro: (e: string | null) => void;
  quadrado: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);

  const escolher = async (file?: File | null) => {
    if (!file) return;
    onErro(null);
    setLendo(true);
    try {
      const dataUrl = await prepararLogo(file);
      // Guarda-corpo: data URL gigante estoura o store JSON (o backend aceita até 16mb no
      // body, mas um logo de 1MB+ é sempre um arquivo errado — foto em vez de logo).
      if (dataUrl.length > 1_200_000) {
        onErro("Imagem muito grande para um logo. Use um arquivo menor (até ~1 MB).");
        return;
      }
      onChange(dataUrl);
    } catch (e) {
      onErro((e as Error).message);
    } finally {
      setLendo(false);
      if (input.current) input.current.value = ""; // permite reenviar o MESMO arquivo
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ImageIcon className="size-4 text-primary" /> {titulo}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>

      <div
        className="mt-3 flex items-center justify-center rounded-xl border border-dashed border-border p-4"
        // Xadrez discreto: mostra se o PNG realmente tem fundo transparente.
        style={{
          backgroundImage:
            "linear-gradient(45deg, var(--muted) 25%, transparent 25%, transparent 75%, var(--muted) 75%), linear-gradient(45deg, var(--muted) 25%, transparent 25%, transparent 75%, var(--muted) 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 8px 8px",
        }}
      >
        {valor ? (
          <img
            src={valor}
            alt={`Pré-visualização — ${titulo}`}
            className={quadrado ? "size-10 object-contain" : "h-10 w-auto max-w-[220px] object-contain"}
          />
        ) : (
          <span className="py-2 text-xs text-muted-foreground">Usando o logo padrão</span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => escolher(e.target.files?.[0])}
        />
        <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={lendo}>
          <Upload className="size-4" /> {lendo ? "Lendo…" : valor ? "Trocar" : "Enviar imagem"}
        </Button>
        {valor && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onChange("")}>
            <Trash2 className="size-4" /> Remover
          </Button>
        )}
      </div>
    </div>
  );
}
