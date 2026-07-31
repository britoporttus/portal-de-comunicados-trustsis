// Organograma interativo (árvore) com reactflow, montado a partir do campo `manager`
// (managerId) do Entra ID: Empresa → líderes de topo → seus liderados, recursivamente.
// Cada pessoa com liderados é expansível/recolhível; o canvas é pan/zoom (fitView).
// Gestores (têm liderados) ganham card tintado de primária; subordinados ficam neutros.
// LAYOUT POR CONTAGEM: por PADRÃO todo gestor abre seus liderados em LEQUE HORIZONTAL (o
// visual "massa" da 1ª versão, em TODOS os níveis). SÓ quando um gestor tem MUITOS liderados
// (> MANY) o time empilha NA VERTICAL (lista indentada, cresce para baixo) — assim os poucos
// gestores enormes (Vinicius Rocha, Marcus Vinicius, Claudio Bassa) não quebram o fluxo.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background, Controls, Handle, Position,
  getRectOfNodes,
  type Node, type Edge, type NodeProps, type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { toPng } from "html-to-image";
import { ChevronDown, ChevronRight, Building2, Users, Download, Loader2 } from "lucide-react";
import type { Pessoa } from "@/lib/types";
import { iniciais } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const NODE_W = 220;
const NODE_H = 56; // altura aproximada do card (usada no cálculo do layout)
const H_GAP = 26; // espaço horizontal entre subárvores irmãs
const V_GAP = 76; // espaço vertical entre níveis (modo horizontal)
const V_INDENT = 30; // distância da espinha central até a coluna de liderados (modo vertical)
const V_HEAD = 40; // folga vertical entre o gestor e o 1º liderado empilhado
const V_STACK = 14; // espaço vertical entre liderados empilhados

// Handles do React Flow ficam INVISÍVEIS (servem só de âncora pras arestas) — sem eles
// apareciam "potinhos" coloridos nos cards. Mantemos pointer-events off pra não roubar clique.
const HANDLE_HIDDEN = {
  opacity: 0,
  width: 6,
  height: 6,
  minWidth: 0,
  minHeight: 0,
  border: "none",
  background: "transparent",
  pointerEvents: "none" as const,
};
// Acima deste nº de liderados diretos, o time empilha NA VERTICAL (em vez do leque horizontal).
// Regra ALTA de propósito: só os gestores enormes entram nela — o resto fica horizontal ("massa").
const MANY = 11;

const EMPRESA_ID = "__empresa__";

// Cor estável por departamento (borda esquerda do card) — ajuda a "ler" a separação por área.
function hue(area: string): number {
  let h = 0;
  for (let i = 0; i < area.length; i++) h = (h * 31 + area.charCodeAt(i)) % 360;
  return h;
}

// ---- Nós customizados (respeitam o tema via classes de token) ----
function CompanyNode({ data }: NodeProps<{ nome: string }>) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 shadow-sm">
      <Building2 className="size-5 text-primary" />
      <span className="text-sm font-semibold text-foreground">{data.nome}</span>
      <Handle type="source" position={Position.Bottom} id="bottom" style={HANDLE_HIDDEN} />
    </div>
  );
}

function PersonNode({
  data,
}: NodeProps<{
  pessoa: Pessoa;
  count: number;
  expanded: boolean;
  onToggle: (id: string) => void;
}>) {
  const p = data.pessoa;
  const temTime = data.count > 0;
  const area = p.area?.trim();
  // Card inteiro é o alvo de toque quando a pessoa tem liderados. O nó do React Flow
  // fica com `pointer-events: none` (nós não-selecionáveis/arrastáveis) — por isso o card
  // clicável PRECISA de `pointer-events-auto`, senão o clique cai no canvas e nada expande.
  // Nós-folha ficam sem pointer-events (deixa o pan do canvas começar em cima deles).
  const toggle = temTime ? () => data.onToggle(p.id) : undefined;
  return (
    <div
      role={temTime ? "button" : undefined}
      tabIndex={temTime ? 0 : undefined}
      onClick={toggle}
      onKeyDown={
        temTime
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                data.onToggle(p.id);
              }
            }
          : undefined
      }
      aria-expanded={temTime ? data.expanded : undefined}
      aria-label={temTime ? `${p.nome}, ${data.count} liderados — ${data.expanded ? "recolher" : "expandir"} time` : undefined}
      title={temTime ? (data.expanded ? "Recolher time" : "Expandir time") : undefined}
      className={
        "nodrag group flex w-[220px] items-center gap-2.5 rounded-xl border px-3 py-2 shadow-sm transition-shadow " +
        // Gestor (tem liderados) = card com TINTA primária; subordinado = card branco neutro.
        (temTime
          ? "border-primary/40 bg-primary/[0.07] pointer-events-auto cursor-pointer hover:shadow-md hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary "
          : "border-border bg-card ")
      }
      style={area ? { borderLeftColor: `hsl(${hue(area)} 60% 55%)`, borderLeftWidth: 3 } : undefined}
    >
      {/* Entrada de cima (modo leque horizontal) e entrada pela ESQUERDA (modo lista vertical,
          onde a aresta desce pela espinha do gestor e entra pela lateral do card). */}
      <Handle type="target" position={Position.Top} id="top" style={HANDLE_HIDDEN} />
      <Handle type="target" position={Position.Left} id="left" style={HANDLE_HIDDEN} />
      <Avatar className={"size-10 shrink-0 " + (temTime ? "ring-2 ring-primary/30" : "")}>
        {p.fotoUrl && <AvatarImage src={p.fotoUrl} alt={p.nome} />}
        <AvatarFallback className={temTime ? "bg-primary/20 text-xs font-semibold text-primary" : "bg-secondary text-xs font-semibold text-muted-foreground"}>
          {iniciais(p.nome)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-foreground">{p.nome}</div>
        {p.cargo && <div className="truncate text-[11px] text-muted-foreground">{p.cargo}</div>}
        {area && <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground/80">{area}</div>}
      </div>
      {temTime && (
        <span
          aria-hidden
          className={
            "flex shrink-0 items-center gap-0.5 rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors " +
            (data.expanded
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-secondary text-muted-foreground group-hover:border-primary/40 group-hover:text-foreground")
          }
        >
          {data.expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          <Users className="size-3" /> {data.count}
        </span>
      )}
      {/* Saída ÚNICA no meio da base: no leque horizontal ramifica para os topos dos filhos;
          no modo lista vertical TODAS as arestas partem daqui e descem por UMA espinha central
          que ramifica para a direita em cada liderado (arestas bem distribuídas, sem emaranhado). */}
      <Handle type="source" position={Position.Bottom} id="bottom" style={HANDLE_HIDDEN} />
    </div>
  );
}

const nodeTypes = { company: CompanyNode, person: PersonNode };

export function OrgFlow({ empresa, diretorio }: { empresa: string; diretorio: Pessoa[] }) {
  // Índice por id + mapa gestor → liderados.
  const { childrenOf, roots, byId } = useMemo(() => {
    const byId = new Map<string, Pessoa>();
    for (const p of diretorio) byId.set(p.id, p);
    const childrenOf = new Map<string, Pessoa[]>();
    const roots: Pessoa[] = [];
    for (const p of diretorio) {
      const mgr = p.managerId && byId.has(p.managerId) ? p.managerId : null;
      if (mgr && mgr !== p.id) {
        if (!childrenOf.has(mgr)) childrenOf.set(mgr, []);
        childrenOf.get(mgr)!.push(p);
      } else {
        roots.push(p);
      }
    }
    // Ordena liderados e raízes por área e depois nome (agrupa mesmo departamento).
    const ord = (a: Pessoa, b: Pessoa) =>
      (a.area ?? "").localeCompare(b.area ?? "", "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR");
    for (const arr of childrenOf.values()) arr.sort(ord);
    roots.sort(ord);
    return { childrenOf, roots, byId };
  }, [diretorio]);

  const isMobile = useIsMobile();

  // Default de expansão SENSÍVEL À TELA (responsividade): no desktop as raízes começam
  // expandidas (mostra o 1º nível do time); no MOBILE começam RECOLHIDAS — só empresa +
  // líderes de topo — pra os nós ficarem grandes e legíveis num canvas estreito; o usuário
  // expande sob demanda tocando no contador de time. Reaplica ao cruzar o breakpoint.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(roots.map((r) => r.id)));
  useEffect(() => {
    setExpanded(new Set(isMobile ? [] : roots.map((r) => r.id)));
  }, [isMobile, roots]);

  const onToggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ---- Exportar organograma COMPLETO e ABERTO como imagem (PNG) ----
  // Todo gestor (qualquer id com liderados) fica expandido; capturamos a árvore inteira,
  // mesmo a parte fora do quadro, e devolvemos o estado de expansão anterior no fim.
  const containerRef = useRef<HTMLDivElement>(null);
  const [exportando, setExportando] = useState(false);
  const restaurarRef = useRef<Set<string> | null>(null);
  const allManagerIds = useMemo(() => new Set(childrenOf.keys()), [childrenOf]);

  const exportarImagem = useCallback(() => {
    if (exportando) return;
    restaurarRef.current = expanded;
    setExpanded(new Set(allManagerIds)); // abre tudo
    setExportando(true);
  }, [exportando, expanded, allManagerIds]);

  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];
    const pos = new Map<string, { x: number; y: number }>();

    const COMPANY_H = 48;

    // Layout por CAIXAS DELIMITADORAS: cada subárvore devolve sua largura/altura e o centro
    // (cx) do próprio nó, então empacotamos irmãos sem sobreposição. O MODO é decidido pela
    // CONTAGEM de liderados diretos do gestor (não pela profundidade):
    //  • até MANY liderados → leque HORIZONTAL (tidy tree), pai centralizado sobre os filhos —
    //                         o visual "massa" da 1ª versão, aplicado em TODOS os níveis;
    //  • acima de MANY      → LISTA VERTICAL empilhada e indentada abaixo do gestor (o fluxo
    //                         cresce para baixo) — só os gestores enormes entram aqui.
    type Box = { width: number; height: number; cx: number };
    const layout = (p: Pessoa, x: number, y: number, depth: number): Box => {
      const filhos = expanded.has(p.id) ? childrenOf.get(p.id) ?? [] : [];
      if (filhos.length === 0) {
        pos.set(p.id, { x, y });
        return { width: NODE_W, height: NODE_H, cx: x + NODE_W / 2 };
      }
      if (filhos.length > MANY) {
        // Gestor enorme: os liderados descem numa COLUNA à direita de uma espinha vertical que
        // sai do MEIO da base do gestor (handle central). Assim a espinha fica alinhada ao centro
        // do card e cada liderado ramifica com um cotovelo curto e uniforme (setas bem distribuídas).
        const spineX = x + NODE_W / 2; // a espinha desce pelo centro do gestor
        const colX = spineX + V_INDENT; // coluna de liderados logo à direita da espinha
        let cy = y + NODE_H + V_HEAD;
        let maxChildW = 0;
        for (const f of filhos) {
          const b = layout(f, colX, cy, depth + 1);
          maxChildW = Math.max(maxChildW, b.width);
          cy += b.height + V_STACK;
        }
        pos.set(p.id, { x, y });
        return {
          width: Math.max(NODE_W, colX + maxChildW - x),
          height: cy - V_STACK - y,
          cx: spineX,
        };
      }
      // Leque horizontal — dispõe as subárvores lado a lado e centraliza o pai sobre elas.
      const childY = y + NODE_H + V_GAP;
      let cursor = x;
      let maxChildH = 0;
      const centers: number[] = [];
      for (const f of filhos) {
        const b = layout(f, cursor, childY, depth + 1);
        centers.push(b.cx);
        maxChildH = Math.max(maxChildH, b.height);
        cursor += b.width + H_GAP;
      }
      const childrenRight = cursor - H_GAP;
      const cx = (centers[0] + centers[centers.length - 1]) / 2;
      const nodeX = Math.max(x, cx - NODE_W / 2);
      pos.set(p.id, { x: nodeX, y });
      const right = Math.max(childrenRight, nodeX + NODE_W);
      return { width: right - x, height: NODE_H + V_GAP + maxChildH, cx: nodeX + NODE_W / 2 };
    };

    // Posiciona as raízes lado a lado; a Empresa fica centralizada acima delas.
    const rootTopY = COMPANY_H + V_GAP;
    let cursorX = 0;
    const rootCx: number[] = [];
    for (const r of roots) {
      const b = layout(r, cursorX, rootTopY, 0);
      rootCx.push(b.cx);
      cursorX += b.width + H_GAP;
    }
    const empresaCx = rootCx.length ? (rootCx[0] + rootCx[rootCx.length - 1]) / 2 : 0;

    ns.push({
      id: EMPRESA_ID,
      type: "company",
      position: { x: empresaCx - 90, y: 0 },
      data: { nome: empresa },
      draggable: false,
      selectable: false,
    });

    // Emite nós de pessoa + arestas (empresa→raiz e gestor→liderado quando expandido).
    // `viaSpine` = este nó é um liderado empilhado NA VERTICAL (o pai tem > MANY liderados):
    // a aresta sai da "espinha" do pai (bottom-left) e entra pela ESQUERDA deste card, para
    // todas compartilharem a mesma linha vertical e ramificarem limpo — sem o emaranhado de
    // curvas que aparecia ligando bottom-center → top-center.
    const emit = (p: Pessoa, parentId: string, viaSpine: boolean) => {
      const xy = pos.get(p.id)!;
      const filhos = childrenOf.get(p.id) ?? [];
      ns.push({
        id: p.id,
        type: "person",
        position: xy,
        data: { pessoa: p, count: filhos.length, expanded: expanded.has(p.id), onToggle },
        draggable: false,
        selectable: false,
      });
      es.push({
        id: `e:${parentId}-${p.id}`,
        source: parentId,
        target: p.id,
        type: "smoothstep",
        sourceHandle: "bottom",
        targetHandle: viaSpine ? "left" : "top",
      });
      // Os liderados DESTE nó empilham na vertical quando ele passa do teto MANY.
      const childrenVertical = expanded.has(p.id) && filhos.length > MANY;
      if (expanded.has(p.id)) for (const f of filhos) emit(f, p.id, childrenVertical);
    };
    for (const r of roots) emit(r, EMPRESA_ID, false);

    return { nodes: ns, edges: es };
  }, [roots, childrenOf, expanded, empresa, onToggle]);

  const totalPessoas = byId.size;

  // Re-enquadra o canvas ao expandir/recolher APENAS no mobile (que começa recolhido e a árvore
  // "escaparia" do quadro estreito). No desktop NÃO reenquadramos: expandir preserva o pan/zoom
  // atual — sem o "zoom out pro meio da tela" que incomodava a cada clique.
  const rfRef = useRef<ReactFlowInstance | null>(null);
  useEffect(() => {
    if (!isMobile || !rfRef.current) return;
    const t = setTimeout(() => rfRef.current?.fitView({ padding: 0.15, duration: 250 }), 60);
    return () => clearTimeout(t);
  }, [nodes.length, isMobile]);

  // Dispara a captura quando o estado "exportando" está ativo e a árvore já re-renderizou aberta.
  useEffect(() => {
    if (!exportando) return;
    let cancelado = false;
    const finalizar = () => {
      if (restaurarRef.current) setExpanded(restaurarRef.current);
      restaurarRef.current = null;
      setExportando(false);
    };
    const run = async () => {
      // Espera o layout assentar (nós medidos, arestas desenhadas, fotos carregadas).
      await new Promise((r) => setTimeout(r, 450));
      if (cancelado) return;
      const viewport = containerRef.current?.querySelector<HTMLElement>(".react-flow__viewport");
      if (!viewport || nodes.length === 0) return finalizar();
      try {
        const bounds = getRectOfNodes(nodes);
        const PAD = 56;
        const MAXDIM = 8000; // teto de segurança pro canvas do navegador
        const rawW = bounds.width + PAD * 2;
        const rawH = bounds.height + PAD * 2;
        const zoom = Math.min(1, MAXDIM / rawW, MAXDIM / rawH);
        const w = Math.ceil(rawW * zoom);
        const h = Math.ceil(rawH * zoom);
        const tx = (PAD - bounds.x) * zoom;
        const ty = (PAD - bounds.y) * zoom;
        const dataUrl = await toPng(viewport, {
          backgroundColor: "#ffffff",
          width: w,
          height: h,
          pixelRatio: 1,
          cacheBust: true,
          style: {
            width: `${w}px`,
            height: `${h}px`,
            transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
          },
        });
        if (cancelado) return;
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "organograma-trustsis.png";
        a.click();
      } catch (err) {
        console.error("Falha ao exportar organograma", err);
        alert("Não foi possível exportar o organograma. Tente novamente.");
      } finally {
        finalizar();
      }
    };
    void run();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportando, nodes]);

  return (
    <div
      ref={containerRef}
      className="relative h-[68vh] max-h-[680px] min-h-[420px] w-full touch-pan-y overflow-hidden rounded-2xl border border-border bg-secondary/30"
    >
      <div className="absolute right-3 top-3 z-10">
        <Button
          size="sm"
          variant="outline"
          onClick={exportarImagem}
          disabled={exportando}
          className="bg-card/90 shadow-sm backdrop-blur"
          title="Baixar o organograma completo e aberto como imagem PNG"
        >
          {exportando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {exportando ? "Gerando…" : "Exportar imagem"}
        </Button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(inst) => {
          rfRef.current = inst;
        }}
        fitView
        fitViewOptions={{ padding: isMobile ? 0.12 : 0.2 }}
        minZoom={0.15}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        zoomOnScroll={!isMobile}
        panOnScroll={false}
        preventScrolling={!isMobile}
      >
        <Background gap={20} className="!bg-transparent" />
        <Controls showInteractive={false} position={isMobile ? "top-left" : "bottom-left"} />
      </ReactFlow>
      <span className="sr-only">{totalPessoas} pessoas no organograma</span>
    </div>
  );
}
