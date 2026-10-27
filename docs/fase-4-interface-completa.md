# Fase 4 — Interface Completa (Tabelas, Formulários e Estados)

Este documento registra a implementação, arquitetura e especificações de interface entregues na **Fase 4** do FlowForge, atendendo aos requisitos de interfaces CRUD ricas, sem código, responsivas e exportáveis.

---

## 1. Objetivos da Fase 4

1. **Montagem de Telas CRUD sem JSON ou Código**:
   - Oferecer aos usuários componentes declarativos para listagem de dados (`table`) e entrada/edição de dados (`form`).
   - Permitir ordenação por coluna, paginação visual e botões de ação configuráveis por linha (ex.: Editar, Excluir).
2. **Estados de Carregamento e Feedback (*States & Bindings*)**:
   - Suporte a estados nativos de tela: `loading`, `empty` e `error`, desacoplados da lógica de layout padrão.
   - Indicação de carregamento visual durante execução de operações assíncronas no servidor (banco de dados, autenticação ou APIs).
3. **Paridade 100% entre Preview e Projeto Exportado**:
   - A árvore de componentes (`ScreenUI`) é renderizada fielmente no modal de Preview interno e nos módulos React exportados (`apps/web/src/pages/`).

---

## 2. Novos Componentes Declarativos de UI

### 2.1. Tabela de Dados (`table`)
- **Propriedades**:
  - `itemsPath`: Caminho de resolução para o array de dados no escopo (ex.: `store.clientes`, `store.pedidos`, `value`).
  - `columns`: Matriz de colunas `{ key: string; label: string; width?: string; sortable?: boolean }`.
  - `actions`: Botões de ação aplicados a cada linha `{ label: string; actionEvent: string; variant?: string }`.
    - Ao clicar em uma ação, os dados da linha são gravados em `__selectedRow` e `__selectedId`, disparando o fluxo associado ao evento.
  - `pageSize`: Quantidade máxima de itens por página na visualização.
  - `emptyState`: Componente renderizado quando a consulta não retornar registros.
  - `accessibility`: Papéis ARIA (`role="table"`, etc.).

### 2.2. Formulário (`form`)
- **Propriedades**:
  - `children`: Componentes filhos (`input`, `textarea`, `select`, `checkbox`, `radio`).
  - `submitLabel`: Texto do botão de submissão integrado.
  - `submitEvent`: Identificador do evento/fluxo disparado no submit com `preventDefault`.
  - `accessibility`: Suporte a formulários acessíveis.

### 2.3. Estados de Tela (`states` e `stateBinding`)
- **Estados Suportados**:
  - `loading`: Ativado quando `stateBinding.loading` for verdadeiro (ex.: enquanto aguarda retorno da API ou banco).
  - `empty`: Ativado quando a coleção de registros estiver vazia.
  - `error`: Ativado quando uma falha for registrada em `store.hasError` ou no contexto.
  - `ready`: Exibe a árvore raiz padrão da tela.

---

## 3. Renderização no Preview (`ScreenFields.tsx`)

O motor de renderização visual em [src/features/preview/ScreenFields.tsx](file:///Users/macbookpro/Dev/flowforge/src/features/preview/ScreenFields.tsx) foi atualizado para:
- Processar tabelas com cabeçalhos estilizados, linhas com hover suave, paginação com contagem de registros e disparos de ação por linha.
- Processar formulários com validação nativa de campos obrigatórios e submissão limpa.
- Alternar automaticamente para a visualização dos estados `loading`, `empty` ou `error` conforme o binding correspondente.

---

## 4. Exportação Modular em React (`src/export/modular/pages.ts`)

A exportação modular das telas em `apps/web/src/` inclui:
1. **`packages/contracts/src/ui.ts`**:
   - Contratos TypeScript de `UIComponent` incluindo `table` e `form`.
2. **`apps/web/src/runtime/rendering/layout.tsx`**:
   - Renderização modular de tabelas e formulários no ecossistema React do app exportado.
3. **`apps/web/src/runtime/rendering/bindings.ts`**:
   - Resolução reativa dos caminhos de propriedades e estados de tela.
4. **`apps/web/src/pages/<id>/Page.tsx`**:
   - Páginas React desacopladas prontas para roteamento e carregamento dinâmico via `lazy()`.

---

## 5. Verificação e Testes

A integridade da Fase 4 é coberta pela suíte [tests/ui-complete.test.ts](file:///Users/macbookpro/Dev/flowforge/tests/ui-complete.test.ts):
- `evaluateTableItems`: Extração correta de coleções no store.
- Renderização de tabela completa: colunas, paginação e botões de ação por linha.
- Renderização de estado `emptyState` customizado em tabela sem itens.
- Renderização de formulário com campos vinculados e botão de submit.
- Renderização dos estados `loading`, `error` e `ready` na tela.
- Exportação modular do projeto com contratos e templates de UI atualizados.
