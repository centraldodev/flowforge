# Linha de Base de Compatibilidade (Fase 0)

Este documento registra a linha de base e a matriz de compatibilidade do **FlowForge**, congelada na **Fase 0** do plano de evolução técnica.

A finalidade deste levantamento é caracterizar o comportamento existente do sistema antes de qualquer refatoração estrutural ou introdução da Representação Intermediária (IR), mapeando com precisão o suporte de cada bloco em todos os ambientes de execução e exportação.

---

## Legenda dos Estados

| Estado | Definição |
| :--- | :--- |
| **completo** | O bloco é suportado integralmente, executando sua semântica pretendida de portas, dados e fluxo. |
| **parcial** | O bloco funciona com limitações conhecidas de escopo, transmissão de parâmetros ou resolução de contexto. |
| **ausente** | O bloco não é gerado ou não possui implementação executável no alvo correspondente. |
| **divergente** | O comportamento no alvo difere da simulação em memória (ex.: chamadas de rede vs. mock, ausência de tratamento de exceções). |

---

## Matriz de Compatibilidade dos Blocos (15 Kinds)

| Kind | Simulação (`run`) | JavaScript (`codeGen`) | TypeScript / React Export | Python Export | Testes de Referência / Notas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`screen`** | completo | completo | completo | ausente | `tests/characterization.test.ts` ("caracterização: screen"); atualiza `result.screen` e rastreia transições. Em Python, apenas Tkinter estático sem fluxo. |
| **`button`** | completo | completo | completo | ausente | `tests/characterization.test.ts` ("caracterização: button"); aciona evento `onClick` e inicia cadeia de execução. |
| **`input`** | completo | completo | completo | ausente | `tests/characterization.test.ts` ("caracterização: input"); resolve valores padrão ou dados fornecidos pelo usuário via `inputValue()`. |
| **`function`** | completo | parcial | parcial | ausente | `tests/characterization.test.ts` ("caracterização: function"); no JS gerado, variáveis de inputs conectados são extraídas como constantes locais no corpo, enquanto o parâmetro default é `value = ""`. |
| **`condition`** | completo | completo | completo | ausente | `tests/characterization.test.ts` ("caracterização: condition"); bifurca para a porta `true` ou `false` conforme a expressão avaliada. |
| **`auth`** | completo | completo | completo | ausente | `tests/characterization.test.ts` ("caracterização: auth"); simula login com consulta a `store.usuarios` e Google OAuth mock com token fictício. |
| **`database`** | completo | completo | divergente | ausente | `tests/characterization.test.ts` ("caracterização: database" e testes da Fase 1); opera sobre `store[table]` em memória com `try/catch` direcionando falhas para `onError` quando conectada e relançando se desconectada. |
| **`api`** | completo | completo | divergente | ausente | `tests/characterization.test.ts` ("caracterização: api" e testes da Fase 1); utiliza `config.mock` por padrão (modo seguro offline) ou fetch real se configurado, com tratamento via `try/catch` para `onError`. |
| **`error`** | completo | completo | completo | ausente | `tests/characterization.test.ts` ("caracterização: error"); captura exceções, gerencia contadores de re-tentativa (`retry`) e emite alertas `toast`. |
| **`navigate`** | completo | completo | completo | ausente | `tests/characterization.test.ts` ("caracterização: navigate"); realiza transição da tela ativa para o identificador configurado. |
| **`notify`** | completo | completo | completo | ausente | `tests/characterization.test.ts` ("caracterização: notify"); emite notificações visuais (`success`, `error`, `info`, `warning`) com payload e duração. |
| **`state`** | completo | completo | completo | ausente | `tests/characterization.test.ts` ("caracterização: state"); suporta operações `set`, `get`, `toggle`, `increment` e `clear` sobre variáveis do `store`. |
| **`validator`** | completo | completo | completo | ausente | `tests/characterization.test.ts` ("caracterização: validator"); valida formatos (`required`, `email`, `minLength`, `maxLength`, `numeric`, `cpf`, `regex`) e ramifica para `valid` ou `invalid`. |
| **`switch`** | completo | completo | completo | ausente | `tests/characterization.test.ts` ("caracterização: switch"); roteia o fluxo para `case1..N` ou `default` com base na correspondência de valor. |
| **`delay`** | completo | completo | completo | ausente | `tests/characterization.test.ts` ("caracterização: delay"); simula atraso temporal de forma síncrona na simulação e com `await new Promise(...)` no JS gerado. |

---

## Casos de Borda e Bugs Documentados e Resolvidos na Fase 1

Os seguintes comportamentos foram caracterizados na Fase 0 e corrigidos/validados com testes comportamentais na Fase 1:

1. **Interpolação Segura de Literais via `jsLiteral` (Resolvido na Fase 1)**:
   - *Correção*: Criada a função `jsLiteral(value, quote)` centralizada em `src/engine/codeGen.ts`, serializando com escape estrito caracteres como `'`, `"`, `\n`, `\`, Unicode e evitando injeção arbitrária via `${...}`.
   - *Status*: Validado e coberto por `test('Fase 1: interpolação segura de literais em codeGen compila e executa sem quebra de sintaxe ou injeção de código')`.

2. **Detecção e Interrupção Controlada de Ciclos (Resolvido na Fase 1)**:
   - *Correção*: Adicionada função de rastreamento de passos `__step(blockId)` no escopo de execução com limite configurável (`maxSteps: 100`). Ciclos no JavaScript gerado interrompem com erro amigável (`Fluxo interrompido: limite de 100 passos (possível ciclo).`), prevenindo estouro de pilha (`RangeError`).
   - *Status*: Validado e coberto por `test('Fase 1: código JS gerado por generateProjectCode() detecta ciclos e interrompe em 100 passos sem RangeError')`.

3. **API Mock sem Acesso de Rede Inesperado (Resolvido na Fase 1)**:
   - *Correção*: No JavaScript gerado por padrão o bloco `api` utiliza os dados simulados de `config.mock`. Chamadas de rede reais só são executadas se `config.mode === 'real'` ou `config.useRealApi === 'true'`.
   - *Status*: Validado e coberto por `test('Fase 1: bloco api no JavaScript gerado utiliza config.mock por padrão sem realizar acesso à rede')`.

4. **Tratamento de Exceções e Roteamento via `onError` (Resolvido na Fase 1)**:
   - *Correção*: Adicionado bloco `try/catch` com tratamento real para os blocos `api`, `database` e observabilidade para `function`. Quando a porta `onError` está conectada, a exceção é encaminhada para o bloco de tratamento; quando não conectada, o erro é relançado (`throw error;`).
   - *Status*: Validado e coberto por `test('Fase 1: blocos api e database encaminham falhas para a porta onError quando conectada e relançam quando desconectada')`.

5. **Portas Personalizadas (`customPort`)**:
   - *Comportamento*: O catálogo e a função `getBlockPorts()` preservam e priorizam portas personalizadas declaradas no bloco (`data.ports`), permitindo entradas e saídas configuráveis além do preset padrão.
   - *Status*: Testado e coberto em `test('caracterização de portas personalizadas: getBlockPorts respeita customPort')`.

6. **Múltiplas Conexões na Mesma Porta de Saída**:
   - *Comportamento*: Quando múltiplas arestas partem da mesma porta (ex.: `onClick` conectado a duas telas), a simulação seleciona deterministicamente a primeira aresta encontrada no array de conexões do grafo.
   - *Status*: Testado e coberto em `test('caracterização de múltiplas conexões saindo da mesma porta: primeiro destino tem precedência no grafo atual')`.

7. **Cadeias Assíncronas**:
   - *Comportamento*: Fluxos contendo `delay -> function -> database` preservam a sequência assíncrona com `await` no JavaScript executável e mantêm rastreabilidade linear de passos no interpretador.
   - *Status*: Testado e coberto em `test('caracterização de cadeia assíncrona: delay -> function -> database')`.

8. **Exportador Python**:
   - *Comportamento*: O exportador Python (`src/export/python.ts`) apenas emite um arquivo esqueleto `app.py` com interface Tkinter estática e `models.py` (caso existam blocos do tipo `class`). Nenhum dos 15 blocos funcionais do catálogo é convertido para código Python executável.
   - *Status*: Documentado como `ausente` para todos os 15 `Kind`s na matriz.
