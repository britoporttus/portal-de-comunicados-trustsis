// Organograma interativo (árvore) com reactflow, montado a partir do campo `manager`
// (managerId) do Entra ID: Empresa → líderes de topo → seus liderados, recursivamente.
// Cada pessoa com liderados é expansível/recolhível; o canvas é pan/zoom (fitView).
import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Background, Controls, Handle, Position,
  type Node, type Edge, type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { ChevronDown, ChevronRight, Building2, Users } from "lucide-react";
import type { Pessoa } from "@/lib/types";
import { iniciais } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NODE_W = 220;
const H_GAP = 26; // espaço horizontal entre nós irmãos
const V_GAP = 76; // espaço vertical entre níveis
const ROW = NODE_W + H_GAP;

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
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
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
  return (
    <div
      className="group flex w-[220px] items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 shadow-sm"
      style={area ? { borderLeftColor: `hsl(${hue(area)} 60% 55%)`, borderLeftWidth: 3 } : undefined}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <Avatar className="size-10 shrink-0">
        {p.fotoUrl && <AvatarImage src={p.fotoUrl} alt={p.nome} />}
        <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
          {iniciais(p.nome)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-foreground">{p.nome}</div>
        {p.cargo && <div className="truncate text-[11px] text-muted-foreground">{p.cargo}</div>}
        {area && <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground/80">{area}</div>}
      </div>
      {temTime && (
        <button
          onClick={() => data.onToggle(p.id)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={data.expanded ? "Recolher time" : "Expandir time"}
          className="nodrag nopan flex shrink-0 cursor-pointer items-center gap-0.5 rounded-md border border-border bg-secondary px-1.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {data.expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          <Users className="size-3" /> {data.count}
        </button>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
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

  // Raízes começam expandidas (mostra o primeiro nível do time); os demais sob demanda.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(roots.map((r) => r.id)));

  const onToggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];
    const pos = new Map<string, { x: number; y: number }>();
    let leafCursor = 0;

    // Layout "tidy tree": DFS que posiciona folhas em colunas e centraliza pais sobre filhos.
    const place = (p: Pessoa, depth: number): number => {
      const filhos = expanded.has(p.id) ? childrenOf.get(p.id) ?? [] : [];
      const y = depth * (V_GAP + 56); // 56 ≈ altura do card
      if (filhos.length === 0) {
        const x = leafCursor * ROW;
        leafCursor += 1;
        pos.set(p.id, { x, y });
        return x;
      }
      const xs = filhos.map((f) => place(f, depth + 1));
      const x = (xs[0] + xs[xs.length - 1]) / 2;
      pos.set(p.id, { x, y });
      return x;
    };

    // Empresa é a raiz (depth 0); as pessoas-raiz começam no depth 1.
    const rootXs = roots.map((r) => place(r, 1));
    const empresaX = roots.length ? (rootXs[0] + rootXs[rootXs.length - 1]) / 2 : 0;

    ns.push({
      id: EMPRESA_ID,
      type: "company",
      position: { x: empresaX, y: 0 },
      data: { nome: empresa },
      draggable: false,
      selectable: false,
    });

    // Emite nós de pessoa + arestas (empresa→raiz e gestor→liderado quando expandido).
    const emit = (p: Pessoa, parentId: string) => {
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
      es.push({ id: `e:${parentId}-${p.id}`, source: parentId, target: p.id, type: "smoothstep" });
      if (expanded.has(p.id)) for (const f of filhos) emit(f, p.id);
    };
    for (const r of roots) emit(r, EMPRESA_ID);

    return { nodes: ns, edges: es };
  }, [roots, childrenOf, expanded, empresa, onToggle]);

  const totalPessoas = byId.size;

  return (
    <div className="h-[70vh] max-h-[680px] min-h-[440px] w-full overflow-hidden rounded-2xl border border-border bg-secondary/30">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.15}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
      >
        <Background gap={20} className="!bg-transparent" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <span className="sr-only">{totalPessoas} pessoas no organograma</span>
    </div>
  );
}
