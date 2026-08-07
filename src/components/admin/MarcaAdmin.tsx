// MARCA DO PORTAL — o admin carrega o logo exibido na navbar, em quatro variações:
//  · menu ABERTO (horizontal, com o nome da empresa) × tema CLARO e tema ESCURO
//  · menu RECOLHIDO (quadrado / só o símbolo) × tema CLARO e tema ESCURO
// Só o "aberto / tema claro" é essencial: qualquer slot vazio cai na variante mais próxima
// (recolhido → aberto; escuro → claro), então quem tem um logo único segue com ele nos dois
// temas. A pré-visualização mostra cada logo sobre o fundo REAL do tema correspondente, para
// o admin flagrar logo escuro sumindo no tema escuro (foi exatamente o pedido do usuário).
//
// O arquivo escolhido NÃO vai para o disco do servidor: é reduzido no navegador e guardado
// como data URL PNG (ou SVG, que passa direto) no store, junto do resto da configuração —
// mesma abordagem das imagens de comunicados. Assim o logo sobrevive a deploys sem depender
// de pasta de uploads, e a leitura (`GET /api/marca`) é pública, para o logo aparecer também
// antes do login.
import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Upload, Trash2, Check, Sun, Moon } from "lucide-react";
import { api } from "@/lib/api";
import { prepararLogo } from "@/lib/image";
import { tempoRelativo } from "@/lib/format";
import { usePortal } from "@/context/PortalProvider";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function MarcaAdmin() {
  const { marca, setMarca, me } = usePortal();
  // Rascunho local: o admin troca/remove os quatro logos e confirma com "Salvar".
  const [expandido, setExpandido] = useState("");
  const [colapsado, setColapsado] = useState("");
  const [expandidoEscuro, setExpandidoEscuro] = useState("");
  const [colapsadoEscuro, setColapsadoEscuro] = useState("");
  const [pronto, setPronto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Semeia o rascunho com o que já está salvo (a marca chega assíncrona do backend).
  useEffect(() => {
    if (pronto || !marca) return;
    setExpandido(marca.logoExpandido ?? "");
    setColapsado(marca.logoColapsado ?? "");
    setExpandidoEscuro(marca.logoExpandidoEscuro ?? "");
    setColapsadoEscuro(marca.logoColapsadoEscuro ?? "");
    setPronto(true);
  }, [marca, pronto]);

  const alterado =
    expandido !== (marca?.logoExpandido ?? "") ||
    colapsado !== (marca?.logoColapsado ?? "") ||
    expandidoEscuro !== (marca?.logoExpandidoEscuro ?? "") ||
    colapsadoEscuro !== (marca?.logoColapsadoEscuro ?? "");

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    setOk(false);
    try {
      // Envia os quatro campos sempre: string vazia = remover aquele logo no backend.
      const salvo = await api.marca.save(
        {
          logoExpandido: expandido,
          logoColapsado: colapsado,
          logoExpandidoEscuro: expandidoEscuro,
          logoColapsadoEscuro: colapsadoEscuro,
        },
        me?.email,
      );
      setMarca(salvo); // navbar atualiza na hora, sem F5
      setOk(true);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Logo exibido no topo do menu. Envie PNG com fundo transparente (ou SVG). Você pode enviar
        uma versão específica para o <strong>tema escuro</strong> — deixe em branco para reusar a do
        tema claro. Sem nenhum logo carregado, o portal usa a marca padrão.
      </p>

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <SecaoTema
        icone={<Sun className="size-4" />}
        titulo="Tema claro"
        tema="claro"
        expandido={expandido}
        colapsado={colapsado}
        setExpandido={(v) => {
          setExpandido(v);
          setOk(false);
        }}
        setColapsado={(v) => {
          setColapsado(v);
          setOk(false);
        }}
        onErro={setErro}
      />

      <SecaoTema
        icone={<Moon className="size-4" />}
        titulo="Tema escuro"
        tema="escuro"
        opcional
        expandido={expandidoEscuro}
        colapsado={colapsadoEscuro}
        setExpandido={(v) => {
          setExpandidoEscuro(v);
          setOk(false);
        }}
        setColapsado={(v) => {
          setColapsadoEscuro(v);
          setOk(false);
        }}
        onErro={setErro}
      />

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

/** Bloco de um tema: o par aberto + recolhido, com o cabeçalho (Sol/Lua) do tema. */
function SecaoTema({
  icone,
  titulo,
  tema,
  opcional,
  expandido,
  colapsado,
  setExpandido,
  setColapsado,
  onErro,
}: {
  icone: React.ReactNode;
  titulo: string;
  tema: "claro" | "escuro";
  opcional?: boolean;
  expandido: string;
  colapsado: string;
  setExpandido: (v: string) => void;
  setColapsado: (v: string) => void;
  onErro: (e: string | null) => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icone} {titulo}
        {opcional && (
          <span className="text-xs font-normal text-muted-foreground">
            (opcional — reusa o tema claro se vazio)
          </span>
        )}
      </h3>
      <div className="grid gap-3 lg:grid-cols-2">
        <CampoLogo
          titulo="Menu aberto"
          descricao="Versão horizontal, com o nome da empresa. Exibida com 36px de altura."
          valor={expandido}
          onChange={setExpandido}
          onErro={onErro}
          quadrado={false}
          tema={tema}
        />
        <CampoLogo
          titulo="Menu recolhido"
          descricao="Versão quadrada (só o símbolo). Opcional — sem ela reusamos a de cima."
          valor={colapsado}
          onChange={setColapsado}
          onErro={onErro}
          quadrado
          tema={tema}
        />
      </div>
    </section>
  );
}

/** Um slot de logo: pré-visualização sobre o fundo REAL do tema + enviar/remover. */
function CampoLogo({
  titulo,
  descricao,
  valor,
  onChange,
  onErro,
  quadrado,
  tema,
}: {
  titulo: string;
  descricao: string;
  valor: string;
  onChange: (v: string) => void;
  onErro: (e: string | null) => void;
  quadrado: boolean;
  tema: "claro" | "escuro";
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

  // Fundo REAL de cada tema (a navbar usa a superfície do sidebar). Assim o admin vê o logo
  // exatamente como aparecerá — e um logo escuro sumindo no tema escuro fica óbvio aqui.
  const fundo = tema === "escuro" ? "#0b1220" : "#ffffff";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ImageIcon className="size-4 text-primary" /> {titulo}
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>

      <div
        className="mt-3 flex items-center justify-center rounded-xl border border-dashed border-border p-4"
        // Fundo do tema + xadrez discreto por cima: mostra o logo no contexto real e ainda
        // revela se o PNG tem fundo transparente.
        style={{
          backgroundColor: fundo,
          backgroundImage:
            "linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.18) 75%), linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.18) 75%)",
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
          <span
            className="py-2 text-xs"
            style={{ color: tema === "escuro" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }}
          >
            Usando o logo padrão
          </span>
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
