# Fase 13 — Cenários de Teste Visuais Sem Código e Exportação de Testes E2E/Integração

## Objetivo
Permitir que usuários e desenvolvedores criem, executem e verifiquem cenários de teste diretamente no editor visual FlowForge sem precisar escrever código, e exportem esses mesmos cenários como testes automatizados nativos (`node:test` / Vitest) no monorepo de código gerado.

---

## 1. Modelo Declarativo de Cenários de Teste (`TestScenario`)

A definição dos testes é armazenada na árvore do projeto (`Graph.tests`), mantendo idempotência, portabilidade e versionamento semântico:

```typescript
export interface TestAssertion {
  id: string;
  kind: AssertionKind;
  target?: string;
  expectedValue: unknown;
  description?: string;
}

export interface TestScenario {
  id: string;
  name: string;
  description?: string;
  initialInputs?: Record<string, unknown>;
  initialStore?: Record<string, unknown>;
  assertions: TestAssertion[];
}
```

### Tipos de Asserção Suportados (`AssertionKind`):
1. **`screen_equals`**: Valida se a tela final resultante corresponde à tela esperada.
2. **`store_equals`**: Valida a igualdade estrita do estado da entidade/tabela no store (`deepStrictEqual`).
3. **`store_contains`**: Valida se um objeto parcial ou registro específico está presente no array ou tabela do store.
4. **`notification_emitted`**: Valida se uma notificação (toast/alerta) foi disparada com o título ou mensagem esperada.
5. **`trace_contains`**: Valida se nós ou blocos operacionais específicos foram percorridos durante o fluxo.
6. **`output_equals`**: Valida os valores finais retornados nos nós de saída.

---

## 2. Motor de Avaliação Sem Código (`src/engine/testScenarios.ts`)

O motor de testes compila o grafo para `ProgramIR` e executa no interpretador em ambiente isolado:

- **Isolamento Total**: Cada cenário é executado em um `ExecutionContext` limpo, com inputs e store clonados.
- **Relatório de Resultados**:
  - `status`: `'passed' | 'failed' | 'error'`
  - `durationMs`: Medição de tempo de execução por asserção e por cenário.
  - `actualValue` vs `expectedValue` com descrições contextuais em caso de falha.
- **Transpilação para Código Real**:
  A função `generateTestCode(scenarios)` emite código JavaScript/TypeScript usando o executor nativo do Node.js (`node:test` e `node:assert/strict`), sem demandar dependências extras no monorepo exportado.

---

## 3. Interface Visual no Editor (`TestRunnerModal.tsx`)

A interface visual no FlowForge permite:
- **Botão com Indicador no Header**: Mostra a contagem de cenários existentes (`🧪 Testes (N)`).
- **Execução em Lote e Individual**: Botão "Executar Todos" e botão individual "▶" em cada cenário.
- **Feedback Visual de Status**: Badges coloridos de "Passou", "Falhou" ou "Não executado", com tempo em milissegundos.
- **Inspetor de Falhas**: Detalhe comparativo mostrando valor esperado vs valor obtido em cada asserção com falha.
- **Criação de Novos Cenários**: Formulário visual para adicionar novos cenários e asserções sem digitar código.

---

## 4. Exportação Automatizada para o Monorepo (`src/export/modular/tests.ts`)

Ao exportar o projeto, o pipeline gera automaticamente dois artefatos:

1. **`packages/contracts/src/testScenarios.ts`**:
   Exporta a definição dos cenários tipados e prontos para reuso em suítes de teste de backend ou frontend.

2. **`tests/scenarios.test.mjs`**:
   Suite de teste autônoma pronta para execução imediata no monorepo com:
   ```bash
   node --test tests/scenarios.test.mjs
   ```

---

## 5. Cenários Canônicos nos Projetos de Referência

Cada projeto de exemplo inclui cenários declarativos demonstrando a validação de regras de negócio reais:

- **Customer Orders**: Valida inserção do pedido no store de `pedidos` e navegação para tela de sucesso.
- **Scheduling Conflict**: Valida detecção de conflito de horário e emissão de notificação de alerta.
- **Role Approval Portal**: Valida permissão de acesso baseado em papel de usuário (`role`) e aprovação de requisição.

---

## 6. Cobertura de Testes

A suíte `tests/visual-test-runner.test.ts` valida:
- Execução com sucesso de cenários com asserções válidas.
- Detecção e relatório detalhado de falhas quando uma asserção não confere.
- Execução de todos os cenários canônicos dos 3 projetos de referência.
- Geração correta dos artefatos de exportação modular de testes.
