# Plano de Implementação — Evolução do Portal para Intranet

> Documento para **validação** antes da implementação. Baseado nas anotações da reunião
> (Claudio, Gustavo, João, Danyele) e no estado atual do portal.
> Nada aqui foi implementado ainda — é o roteiro proposto.
>
> **Revisão 3 (2026-08-07) — STATUS DE IMPLEMENTAÇÃO:**
> • **Fase 0 IMPLEMENTADA:** perfis de acesso com CRUD (`/admin`, aba "Perfis de acesso"),
>   grupos do Entra via `memberOf`/`listGroups`, middleware `requerPerm()` no backend e
>   `pode(recurso, acao)` no front (o `isAdmin` binário saiu do caminho).
> • **Fase 1 IMPLEMENTADA:** `perfis[]` em comunicados/eventos/links/social, filtro no backend,
>   multi-select nos formulários e selo "Restrito" nas listagens. Coexiste com
>   `departamentos[]`/`publico` (filtro em E) — nada precisou migrar.
> • **NOVO (fora do plano original, pedido em reunião):** a configuração de **SSO/Entra ID,
>   Graph, políticas e ITSM saiu do `.env`** e virou a aba **Administração › Integração**.
>   O `.env` continua apenas como *bootstrap* (valor inicial); o que é salvo na tela tem
>   precedência. Isso antecipa parte da Fase 6 (admin central).
> • **Pendente de decisão sua:** as 6 perguntas da §7 continuam abertas.
>
> **Revisão 2 (2026-08-07):**
> • Incorporado o requisito de **Perfis de acesso (CRUD no portal)** — antes o plano só previa
>   grupos do Entra "crus"; agora há uma camada RBAC própria do portal (§3 e Fase 0).
> • **Dashboards/indicadores nativos saíram do escopo** — o portal terá apenas **links** para
>   dashboards externos (a antiga Fase 2 foi eliminada e absorvida pela fase de Links/Bibliotecas).

---

## 1. Objetivo

Evoluir o **Portal de Comunicados** para uma **Intranet corporativa**, com: segregação de
conteúdo por **perfis de acesso** (ancorados nos grupos do Entra), repositórios de
documentos/templates (OneDrive/SharePoint), links para sistemas e dashboards externos,
integração de agenda e redes sociais, e uma **interface administrativa** que permita configurar
tudo isso **sem mexer no código**.

---

## 2. O que JÁ existe hoje (base para reaproveitar)

| Recurso | Estado atual |
|---|---|
| **Comunicados** | CRUD + prioridade/categoria + **segmentação por `publico` (CLT/PJ) e `departamentos[]`** + **confirmação de leitura obrigatória** (`obrigatorio`/`leituras[]`) + até 3 imagens + pontos por leitura |
| **Eventos** | CRUD + foto opcional + página de detalhe. Agenda do Outlook já é **lida** (`getAgenda`, `NextMeetingCard`) |
| **Políticas** | Read-only do **SharePoint/OneDrive** via Graph `/shares` (`getPoliticas`, env `POLITICAS_SHARE_URL`); subpasta = categoria |
| **Links úteis** | Padrão + **personalizados por usuário** (`linksByUser[chave]`) |
| **Redes sociais** | Lista de publicações (`PublicacaoSocial`), abrir post pontua |
| **Gamificação** | Ledger de pontos + ranking + feedback entre colegas |
| **Tickets** | Balcão de chamados integrado ao trustsis-itsm (app-only) |
| **Feedback do portal** | Bug/melhoria com status (admin gerencia) |
| **Controle de acesso** | ⚠️ **Binário**: `me.isAdmin` (derivado de `ENTRA_ADMIN_GROUP_ID`) → é admin ou é usuário comum. Não há perfis, nem permissão por página, nem por ação |
| **Auth** | MSAL SPA single-tenant + validação de token no backend; identidade resolvida via `resolveDirectoryKey` |

**Conclusão:** o conteúdo já tem esqueleto. O que **falta de fundação** é o **modelo de acesso**:
hoje só existe admin/não-admin e segmentação por strings de departamento. É a espinha dorsal de
quase tudo que a reunião pediu.

---

## 3. Princípio de arquitetura — Perfis de acesso (RBAC do portal)

A gestão de acesso passa a ter **três camadas**, e a camada do meio (Perfil) é o que o admin
manipula no dia a dia — por **CRUD dentro do portal**, sem tocar em código nem em env:

```
Grupo do Entra ID          Perfil de acesso (portal)              Artefato / Página
(fonte de identidade)      (CRUD no portal — o "papel")           (o que é protegido)
─────────────────────      ────────────────────────────           ──────────────────────
GRP-Comercial        ──┐
GRP-Vendas-SP        ──┼──►  Perfil "Comercial"          ──┬──►  páginas: /comunicados, /links, /paineis…
                       │      • páginas visíveis          │      ações: ver | criar | editar | excluir
GRP-RH               ──┼──►  Perfil "RH"                  ├──►  Comunicado #12 (perfis: [Comercial, RH])
GRP-TI-Admins        ──┴──►  Perfil "Administrador"       └──►  Biblioteca "Marketing" (perfis: [Todos])
```

- **Grupo do Entra** = de onde vem a associação do usuário (via Graph `memberOf`). Ninguém é
  "adicionado à mão" no portal — a fonte da verdade da pessoa continua sendo o Entra.
- **Perfil de acesso** = entidade **do portal**, criada/editada por CRUD na UI. Define
  **o que o papel pode ver e fazer** e é **associado a 1..N grupos do Entra**.
- **Artefato/Página** = comunicado, evento, link, política, biblioteca, rota do menu. Cada um
  pode declarar `perfis[]` (quem enxerga). Sem `perfis[]` = visível a todos.

**Resolução em runtime:** `usuário → grupos do Entra (memberOf) → perfis → união das permissões`.
As permissões são **cumulativas** (quem tem 2 perfis vê a união). Sem perfil correspondente, o
usuário cai no perfil padrão **"Colaborador"** (acesso básico, configurável).

> **Coexistência com o que já existe:** a segmentação atual por `departamentos[]` e `publico`
> (CLT/PJ), que vem do Entra, **continua funcionando** — o filtro final é
> `(passa no departamento/público) E (passa no perfil)`. Assim nada quebra e o admin ganha o
> eixo novo de segregação sem precisar migrar tudo de uma vez.

### Modelo de dados proposto

```ts
// Catálogo de grupos do Entra registrados no portal (sincronizado do Entra)
GrupoEntra { id, nome, entraGroupId, sincronizadoEm }

// A entidade nova — CRUD completo na UI de admin
Perfil {
  id, nome, descricao,
  gruposEntra: string[],        // 1..N grupos que concedem este perfil
  paginas: string[],            // rotas do NAV liberadas (ex.: ["/", "/comunicados", "/links"])
  permissoes: {                 // por recurso, o que pode fazer
    comunicados: Acao[],        // Acao = 'ver' | 'criar' | 'editar' | 'excluir'
    eventos: Acao[], links: Acao[], politicas: Acao[],
    social: Acao[], tickets: Acao[], bibliotecas: Acao[], /* … */
  },
  admin?: boolean,              // super-perfil (enxerga /admin e tudo mais)
  padrao?: boolean              // perfil-fallback de quem não casa com nenhum grupo
}

// Nos artefatos (aditivo, tudo opcional → retrocompatível)
Comunicado  { …, perfis?: string[] }
Evento      { …, perfis?: string[] }
LinkUtil    { …, perfis?: string[] }
Biblioteca  { …, perfis?: string[] }
Politica    (a confirmação/visibilidade herda os perfis da biblioteca de origem)
```

**Onde a regra é aplicada (os dois lados, sempre):**
- **Backend (autoridade):** middleware `requerPerm('comunicados','criar')` nas rotas + filtro de
  listagem por `perfis[]` do usuário. Nada é confiado ao front.
- **Front (usabilidade):** `NAV` filtrado pelas `paginas` do perfil, rotas bloqueadas redirecionam,
  botões de criar/editar escondidos conforme `me.permissoes`.

**Bootstrap / trava de segurança:** o `ENTRA_ADMIN_GROUP_ID` do env **continua valendo** como
super-admin de emergência (senão um admin pode se trancar fora ao editar o próprio perfil).
O perfil "Administrador" nasce pré-criado, apontando para esse grupo.

---

## 4. Fases propostas

### Fase 0 — Fundação: Grupos do Entra + **Perfis de acesso (CRUD)** `[base de tudo]`

**O que:** criar o modelo RBAC descrito no §3 e a tela que o administra.

- Backend: `getUserGroups(identity)` via Graph `memberOf` (cache curto por usuário) e
  `listarGruposEntra()` para o admin escolher grupos numa combobox (não digitar GUID à mão).
- Store: entidades `GrupoEntra` e `Perfil` (com seed do perfil "Administrador" e "Colaborador").
- Endpoints: `GET/POST/PUT/DELETE /api/perfis`, `GET /api/grupos-entra`,
  e `/api/me` passa a devolver `me.perfis[]` + `me.paginas[]` + `me.permissoes{}`.
- Helper compartilhado `podeVer(artefato, perfisDoUsuario)` + middleware `requerPerm(...)`.
- **UI (admin):** página `/admin/perfis` — lista de perfis, formulário com nome, grupos do Entra
  (multi-select), **matriz de permissões** (páginas × ações) e toggle de perfil padrão.
- Front: `PortalProvider` deixa de expor só `isAdmin` e passa a expor `pode(recurso, acao)`;
  `NAV` e as rotas passam a respeitar `me.paginas`.
- **Permissões Graph novas:** `GroupMember.Read.All` e `Group.Read.All` (Application) —
  precisam de **consentimento do admin**.

**Arquivos:** `server/src/graph.ts`, `config.ts`, `types.ts`, `store.ts`, `index.ts`,
`src/context/PortalProvider.tsx`, `src/components/portal/nav.ts`, `src/App.tsx`, nova page admin.
**Esforço:** médio/alto (é a fase mais estrutural). **Bloqueia:** todas as demais.

---

### Fase 1 — Segregação de conteúdo por perfil

**O que:** aplicar `perfis[]` aos artefatos, combinando com a segmentação atual.

- Adicionar `perfis?: string[]` em `Comunicado`, `Evento`, `LinkUtil`, `Biblioteca`.
- Filtrar no backend as listas por perfil do usuário (comunicados/eventos/links/social/políticas).
- Formulários de criação (admin): multi-select de perfis + badge "restrito" na listagem.
- Comunicados: `departamentos[]`/`publico` **coexistem** com `perfis[]` (filtro em E).
- **"Não lidos e recentes":** destacar na home comunicados ainda não lidos (cruzando `leituras[]`)
  e aba/filtro "não lidos".

**Arquivos:** `server/src/types.ts`, `index.ts`, `src/pages/*`, `crud.tsx`.
**Esforço:** médio.

---

### Fase 2 — Links, bibliotecas de documentos e atalhos para dashboards externos

> Substitui a antiga "Fase 2 — Dashboards": **não haverá indicadores/KPIs dentro do portal**.
> Dashboards ficam nas ferramentas externas e o portal só oferece **links** para eles.

**O que:** área de links úteis + bibliotecas de documentos (Marketing, Templates, Institucional)
+ atalhos para sistemas e dashboards externos, tudo segregado por perfil.

- **Links úteis por perfil** (além do "por usuário" que já existe): `linksByPerfil`, com
  categoria/ícone — é aqui que entram os atalhos para **Power BI/dashboards externos**, o
  **registro de projetos do comercial** e demais sistemas citados na reunião.
- **Bibliotecas de documentos:** reaproveitar 100% o padrão de Políticas (`getPoliticas` via Graph
  `/shares`) generalizando para `getBiblioteca(shareUrl)` com **N bibliotecas** — cada uma é uma
  pasta compartilhada do OneDrive/SharePoint (subpasta = categoria), com seus `perfis[]`.
- Inclui a **pasta de Marketing** (templates de documento, assinaturas de e-mail, modelos de
  apresentação).
- Admin cadastra nome + URL de compartilhamento de cada biblioteca **pela UI** (não por env).

**Arquivos:** `server/src/graph.ts` (generalizar), tipos/store, nova page `/biblioteca`,
`LinksPage`.
**Esforço:** médio (padrão já dominado). **Depende:** `Sites.Read.All` (já em uso nas políticas).

---

### Fase 3 — Eventos: integração de escrita com a agenda (Outlook)

**O que:** além de **ler** a agenda (já feito), **criar** eventos no calendário.

- `Evento.perfis[]` (Fase 1) para eventos restritos.
- Botão "Adicionar à minha agenda" → Graph `POST /users/{id}/events`.
- Opcional: ao publicar evento para um perfil, criar automaticamente no calendário dos membros
  (avaliar custo/permissão — ver Perguntas).
- **Permissão Graph nova:** `Calendars.ReadWrite` (Application) — **consentimento do admin**.

**Arquivos:** `server/src/graph.ts`, `index.ts`, `EventosPage.tsx`.
**Esforço:** médio/alto. **Sensível:** escrever no calendário de terceiros exige cuidado de escopo.

---

### Fase 4 — Políticas: leitura via pop-up + confirmação

**O que:** políticas com **leitura obrigatória** por pop-up e **confirmação**, mantendo a fonte
no SharePoint (read-only, msg 112).

- Modal que abre o documento (preview/iframe do SharePoint) + botão "Li e concordo".
- Registro de confirmação por usuário (`politicasLidas[upn][docId]`) + pontos.
- Segregação por perfil (Fase 1) e indicador de "pendente de leitura".

**Arquivos:** `PoliticasPage`, store/tipos, `server/src/index.ts`.
**Esforço:** médio.

---

### Fase 5 — Redes sociais: curtir/comentar + API LinkedIn

**O que:** engajamento nas publicações e importação automática do LinkedIn.

- **Curtir/comentar** internamente no portal (store: `curtidas`/`comentarios` por post) — pontua.
- **Importação via API do LinkedIn:** depende de app aprovado no LinkedIn Developer + credenciais
  da página da empresa (**maior incerteza externa**).
- Fallback: publicação manual (como hoje) enquanto a API não estiver liberada.

**Esforço:** curtir/comentar = médio; API LinkedIn = alto + dependência externa.

---

### Fase 6 — Interface administrativa central

**O que:** consolidar num painel único tudo que hoje ficaria espalhado.

- Página `/admin` com abas: **Perfis de acesso** (da Fase 0) • **Bibliotecas** (URLs do OneDrive) •
  **Links por perfil** • **Auditoria** (quem alterou perfil/permissão e quando) • integrações.
- Reaproveita `crud.tsx` (FormDialog/ConfirmDelete) e os componentes shadcn.

**Esforço:** alto (é o guarda-chuva das fases anteriores; entregue incrementalmente).

---

## 5. Dependências de infraestrutura (Entra / Graph)

| Recurso | Permissão Graph (Application) | Consentimento admin | Já temos? |
|---|---|---|---|
| Grupos do usuário (Fase 0/1) | `GroupMember.Read.All` | ✅ sim | ❌ novo |
| Listar grupos p/ o admin escolher (Fase 0) | `Group.Read.All` | ✅ sim | ❌ novo |
| Bibliotecas OneDrive/SharePoint (Fase 2) | `Sites.Read.All` | ✅ sim | ✅ (políticas) |
| Criar eventos no calendário (Fase 3) | `Calendars.ReadWrite` | ✅ sim | ❌ novo |
| Ler agenda (já em uso) | `Calendars.Read` | — | ✅ |
| API LinkedIn (Fase 5) | App LinkedIn + credenciais da página | — | ❌ externo |

**Envs novas:** nenhuma prevista para perfis/bibliotecas — tudo é cadastrado **pela UI** (store).
O `ENTRA_ADMIN_GROUP_ID` permanece como bootstrap de super-admin.

---

## 6. Ordem de execução recomendada

```
Fase 0 (grupos + PERFIS/CRUD)  ──►  Fase 1 (segregação dos artefatos)  ──►  Fase 6 (admin central)
        │                                   │
        │                                   ├──► Fase 2 (links + bibliotecas + atalhos p/ dashboards)
        │                                   ├──► Fase 4 (políticas c/ confirmação)
        │                                   └──► Fase 3 (eventos → calendário)
        │
        └──► Fase 5 (social) — menos acoplada, paralelizável
```

**Primeiro entregável validável:** **Fase 0 + Fase 1** — perfis de acesso com CRUD, permissões por
página/ação e segregação de comunicados/eventos/links por perfil. É o pedido central da reunião.

---

## 7. Perguntas em aberto (preciso da sua validação)

1. **Granularidade das permissões:** a matriz por **recurso × ação** (ver/criar/editar/excluir)
   está no nível certo, ou basta **ver / gerenciar** (2 níveis) para simplificar a tela?
2. **Perfis iniciais:** quais perfis já nascem cadastrados? Sugestão: `Administrador`,
   `Colaborador` (padrão), `RH`, `Comercial`, `Marketing`, `TI`. Confirma a lista e quais grupos
   do Entra cada um usa?
3. **`departamentos[]` vs perfis:** confirmo a **coexistência** (filtro em E) proposta no §3, ou
   você prefere migrar tudo para perfis e aposentar `departamentos[]` mais adiante?
4. **Usuário sem perfil:** cai no perfil padrão "Colaborador" (vê o básico) — ou deve ser
   **bloqueado** até um admin atribuir?
5. **Eventos no calendário (Fase 3):** "adicionar à minha agenda" basta, ou querem **criação
   automática** no calendário de todos os membros do perfil? *(A automática é mais intrusiva.)*
6. **Bibliotecas (Fase 2):** quais pastas do OneDrive/SharePoint entram (Marketing, Templates,
   Institucional…)? Você tem as URLs de compartilhamento?
7. **Dashboards externos:** quais links entram de cara (Power BI? registro de projetos do
   comercial?) e para quais perfis?
8. **LinkedIn (Fase 5):** existe app aprovado no LinkedIn Developer + acesso à página da empresa?
   Se não, seguimos com curtir/comentar interno + publicação manual.

---

*Fases 0 e 1 implementadas (ver Revisão 3 no topo). Aguardo sua validação das perguntas da §7
para seguir para a Fase 2 (links, bibliotecas e atalhos para dashboards externos).*
