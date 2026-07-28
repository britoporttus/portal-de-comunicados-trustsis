// Organograma interativo (árvore) com reactflow: Empresa → Departamentos → Pessoas.
// Cada departamento é expansível/recolhível; o canvas é pan/zoom (fitView automático).
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

const COL_W = 240;
const PERSON_STEP = 84;
const DEPTS_POR_LINHA = 6; // departamentos por linha na grade (colapsados)
const LINHA_H = 150; // altura de cada linha de departamentos quando nada expandido

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

function DeptNode({
  data,
}: NodeProps<{ area: string; count: number; expanded: boolean; onToggle: (a: string) => void }>) {
  return (
    <button
      onClick={() => data.onToggle(data.area)}
      className="flex w-[210px] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-colors hover:border-primary/40"
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      {data.expanded ? (
        <ChevronDown className="size-4 shrink-0 text-primary" />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{data.area}</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="size-3" /> {data.count}
        </span>
      </span>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </button>
  );
}

function PersonNode({ data }: NodeProps<{ pessoa: Pessoa }>) {
  const p = data.pessoa;
  return (
    <div className="flex w-[210px] items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <Avatar className="size-9 shrink-0">
        {p.fotoUrl && <AvatarImage src={p.fotoUrl} alt={p.nome} />}
        <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
          {iniciais(p.nome)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-foreground">{p.nome}</div>
        {p.cargo && <div className="truncate text-[11px] text-muted-foreground">{p.cargo}</div>}
      </div>
    </div>
  );
}

const nodeTypes = { company: CompanyNode, dept: DeptNode, person: PersonNode };

export function OrgFlow({ empresa, diretorio }: { empresa: string; diretorio: Pessoa[] }) {
  // Um departamento expandido por vez (acordeão) — mantém o layout legível.
  const [aberto, setAberto] = useState<string | null>(null);

  const onToggle = useCallback((area: string) => {
    setAberto((prev) => (prev === area ? null : area));
  }, []);

  // Agrupa por departamento (só por departamento, conforme solicitado).
  const grupos = useMemo(() => {
    const mapa = new Map<string, Pessoa[]>();
    for (const p of diretorio) {
      const area = p.area?.trim() || "Sem área";
      if (!mapa.has(area)) mapa.set(area, []);
      mapa.get(area)!.push(p);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [diretorio]);

  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];
    const nDepts = grupos.length;
    const colsPorLinha = Math.min(DEPTS_POR_LINHA, Math.max(1, nDepts));
    const gridW = colsPorLinha * COL_W;

    // Raiz centralizada acima da grade de departamentos.
    ns.push({
      id: "empresa",
      type: "company",
      position: { x: (gridW - 210) / 2, y: 0 },
      data: { nome: empresa },
      draggable: false,
      selectable: false,
    });

    // Y acumulado por linha: a linha que contém o departamento aberto ganha altura extra.
    const nLinhas = Math.ceil(nDepts / colsPorLinha);
    const alturaLinha: number[] = [];
    for (let r = 0; r < nLinhas; r++) {
      const inicio = r * colsPorLinha;
      const fim = Math.min(inicio + colsPorLinha, nDepts);
      let extra = 0;
      for (let i = inicio; i < fim; i++) {
        if (grupos[i][0] === aberto) extra = grupos[i][1].length * PERSON_STEP + 40;
      }
      alturaLinha[r] = LINHA_H + extra;
    }
    const yLinha = (r: number) => 150 + alturaLinha.slice(0, r).reduce((a, b) => a + b, 0);

    grupos.forEach(([area, pessoas], i) => {
      const row = Math.floor(i / colsPorLinha);
      const col = i % colsPorLinha;
      const x = col * COL_W;
      const y = yLinha(row);
      const deptId = `dept:${area}`;
      const estaAberto = aberto === area;
      ns.push({
        id: deptId,
        type: "dept",
        position: { x, y },
        data: { area, count: pessoas.length, expanded: estaAberto, onToggle },
        draggable: false,
        selectable: false,
      });
      es.push({ id: `e:empresa-${deptId}`, source: "empresa", target: deptId, type: "smoothstep" });

      if (estaAberto) {
        pessoas.forEach((p, j) => {
          const pid = `p:${p.id}:${j}`;
          ns.push({
            id: pid,
            type: "person",
            position: { x, y: y + 100 + j * PERSON_STEP },
            data: { pessoa: p },
            draggable: false,
            selectable: false,
          });
          es.push({ id: `e:${deptId}-${pid}`, source: deptId, target: pid, type: "smoothstep" });
        });
      }
    });

    return { nodes: ns, edges: es };
  }, [grupos, aberto, empresa, onToggle]);

  return (
    <div className="h-[600px] w-full overflow-hidden rounded-2xl border border-border bg-secondary/30">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
      >
        <Background gap={20} className="!bg-transparent" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
