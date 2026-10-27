# Fase 5 — Composição (Subfluxos, Coleções e Presets Pessoais)

Este documento registra a arquitetura, implementação e critérios de aceite entregues na **Fase 5** do FlowForge, atendendo aos requisitos de fluxos de negócio reutilizáveis, modulares, com proteção contra ciclos recursivos e gestão segura de predefinições.

---

## 1. Objetivos da Fase 5

1. **Subfluxos Reutilizáveis sem Código (`subflow`)**:
   - Criação de grafos de operações independentes e contextualizadas com definição explícita de parâmetros de entrada (`parameters`) e valores de retorno (`returns`).
   - Execução isolada em escopo filho protegendo variáveis locais sem poluir o contexto da aplicação pai, enquanto compartilha o estado da store/banco.
2. **Prevenção Estática e Dinâmica de Recursão Cíclica**:
   - Diagnóstico estático via algoritmo DFS em grafo de dependências (`detectSubflowCycles`).
   - Bloqueio em tempo de execução via rastreamento da pilha de chamadas (`__subflowStack`) evitando estouro de pilha (*stack overflow*).
3. **Predefinições Oficiais e Pessoais (Presets)**:
   - Criação de presets a partir de blocos existentes (`createPresetFromBlock`) e aplicação direta (`applyPresetToBlock`).
   - Higienização estrita de segredos: remoção de tokens e senhas em plain text e preservação obrigatória de referências seguras `FLOWFORGE_SECRET_*`.
4. **Coleções de Regras Reutilizáveis (`RuleCollection`)**:
   - Definição estruturada de regras declarativas (`required`, `email`, `minLength`, `maxLength`, `numeric`, `regex`).
   - Avaliação nativa sem código (`evaluateRuleCollection`) com relatório de erros por campo.
5. **Exportação Modular**:
   - Módulos de subfluxo gerados de forma desacoplada em `apps/web/src/workflows/`.
   - Contratos de tipos gerados em `packages/contracts/src/composition.ts`.
   - Manifesto de composição exportado em `apps/web/src/workflows/composition.manifest.json`.

---

## 2. Modelagem Estrutural (`src/engine/composition.ts`)

A camada de composição define os contratos centrais:

- **`SubflowPort`**: Definição tipada de portas de entrada/saída de um subfluxo (`direction: 'input' | 'output'`).
- **`SubflowDefinition`**: Grafo encapsulado (`nodes`, `edges`, `parameters`, `returns`).
- **`BlockPreset`**: Predefinição versionada com autor (`'official' | 'user'`), configuração higienizada e portas customizadas.
- **`RuleCollection`**: Conjunto reutilizável de regras com alvo em entidade ou tela.
- **`CompositionManifest`**: Inventário do projeto com todos os subfluxos, presets e coleções cadastradas.

---

## 3. Adaptador e Interpretador de Subfluxos (`ModularSubflowAdapter`)

Localizado em [src/compiler/interpreter/subflowAdapter.ts](file:///Users/macbookpro/Dev/flowforge/src/compiler/interpreter/subflowAdapter.ts):

- **Isolamento de Escopo**:
  - `childContext.inputs` recebe os argumentos avaliados na chamada.
  - `childContext.variables` inicia isolado contendo os valores mapeados.
  - `childContext.store` é compartilhado para leitura e persistência de dados.
- **Rastreabilidade e Proteção**:
  - Contadores de passos (`stepCount`) e sinais de aborto (`AbortSignal`) são propagados para respeitar limites de segurança.
  - O retorno do subfluxo é resolvido automaticamente a partir da saída declarada em `def.returns` ou das portas padrão de resultado (`output`, `result`, `value`).

---

## 4. Lowering e Codegen da ProgramIR

1. **Instrução `call_subflow`**:
   - Adicionada ao tipo `InstructionIR` em [src/compiler/ir.ts](file:///Users/macbookpro/Dev/flowforge/src/compiler/ir.ts).
2. **Lowering**:
   - O compilador em [src/compiler/lower.ts](file:///Users/macbookpro/Dev/flowforge/src/compiler/lower.ts) mapeia blocos do tipo `'subflow'` para instruções `call_subflow`, conectando portas de sucesso (`then`, `onSuccess`, `output`) e falha (`onError`).
3. **Codegen JavaScript e Python**:
   - Em [src/compiler/backends/javascript/codegen.ts](file:///Users/macbookpro/Dev/flowforge/src/compiler/backends/javascript/codegen.ts) e [src/compiler/backends/python/codegen.ts](file:///Users/macbookpro/Dev/flowforge/src/compiler/backends/python/codegen.ts), a chamada ao subfluxo é gerada como operação assíncrona desacoplada do cliente com resolução de promessas e rastreabilidade visual.

---

## 5. Exportação Modular em TypeScript

Na exportação do projeto:
- Módulos de subfluxo individuais residem em `apps/web/src/workflows/shared/` ou no escopo de páginas proprietárias.
- O manifesto de composição `apps/web/src/workflows/composition.manifest.json` cataloga os subfluxos e presets.
- Os contratos compartilhados ficam disponíveis para todas as workspaces em `packages/contracts/src/composition.ts`.

---

## 6. Cobertura de Testes e Validação

A suíte [tests/composition.test.ts](file:///Users/macbookpro/Dev/flowforge/tests/composition.test.ts) valida:
1. Execução de subfluxos com passagem de argumentos e retorno de dados.
2. Detecção de ciclos recursivos estáticos e dinâmicos (A -> B -> A) impedindo travamento.
3. Criação de preset com higienização estrita de segredos (remoção de senhas em plain text e preservação de `FLOWFORGE_SECRET_*`).
4. Aplicação de presets com garantia de imutabilidade do ID e integridade do nó.
5. Validação de dados contra coleções de regras reutilizáveis (`RuleCollection`).
6. Exportação modular e validação formal do grafo de artefatos (`plan.validate()`).

Total de testes da suíte do FlowForge: **200 testes passando com 100% de sucesso**.
