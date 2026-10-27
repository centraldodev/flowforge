# Fase 12: Depurador Visual, Breakpoints e Inspeção de Payloads no Canvas (Time-Travel Trace)

## 1. Visão Geral

A **Fase 12** eleva o FlowForge a um novo patamar de capacidade de desenvolvimento visual, introduzindo um **Depurador Visual Completo (Visual Debugger)** com suporte a:
- **Pontos de Parada Interativos (Breakpoints)** configuráveis diretamente nos blocos do canvas com um clique (indicador de bolinha vermelha no estilo IDEs profissionais).
- **Controle de Execução Passo a Passo (Step Over)**, permitindo avançar bloco a bloco ou continuar normalmente até o próximo breakpoint.
- **Time-Travel Trace (Viagem no Tempo)**: cada passo da execução é gravado como um snapshot imutável (`DebugFrame`), capturando as entradas (`inputs`), saídas acumuladas (`outputs`), memória global compartilhada (`store`) e variáveis de escopo local.
- **Painel de Inspeção e Timeline Interativa**: gaveta retrátil inferior com chips de cada passo gravado, permitindo que o desenvolvedor clique em qualquer momento do passado para inspecionar os payloads que transitaram por portas e variáveis.
- **Feedback Visual no Canvas**: realce de glow âmbar pulsante no bloco pausado, realce ciano no bloco em execução, e badges de dados exibindo os valores nas portas do bloco em tempo real.

---

## 2. Arquitetura do Depurador

### 2.1 Tipagem e Frames Imutáveis (`debuggerTypes.ts`)

```typescript
export type DebuggerStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'completed'
  | 'error';

export type DebugFrame = {
  stepIndex: number;
  blockId: string;
  blockKind?: string;
  blockLabel?: string;
  phase: 'before' | 'after';
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  variables: Record<string, unknown>;
  store: Record<string, unknown>;
  screen?: string;
  timestamp: number;
  message?: string;
};
```

### 2.2 Controlador Central (`VisualDebugger`)

O controlador [VisualDebugger](file:///Users/macbookpro/Dev/flowforge/src/compiler/interpreter/debugger.ts) gerencia:
- O ciclo assíncrono de pausa via `Promise` controlada (`pausedResolver`), congelando a execução do interpretador de forma transparente até o usuário clicar em `Passo` ou `Continuar`.
- O registro de breakpoints (`Set<string>`) com `toggleBreakpoint(blockId)`.
- O modo passo a passo (`stepOverMode`).
- A navegação na linha do tempo com `seekFrame(index)`.
- O suporte a subscrição reativa (`subscribe(listener)`), integrando-se nativamente com o ecossistema React do FlowForge.

---

## 3. Integração com a IR e Interpretador Semântico

### 3.1 Geração Modular com Referências
Quando o grafo é compilado para simulação ou depuração, o compilador utiliza `{ references: true }`. Isso desacopla o fluxo em nós com chamadas `invoke`, permitindo que o interpretador intercepte o início e o fim de cada bloco individual:

```typescript
case 'invoke': {
  const step = program.steps.find((candidate) => candidate.blockId === inst.blockId);
  if (!step) throw new Error(`Fluxo não encontrado: ${inst.blockId}`);
  if (context.debugger) {
    await context.debugger.beforeStep({
      blockId: step.blockId,
      blockKind: step.kind,
      blockLabel: step.label,
      message: `Executando ${step.label} (#${step.blockId})`,
    }, context);
  }
  await executeInstructions(step.instructions, context, program);
  if (context.debugger) {
    await context.debugger.afterStep({
      blockId: step.blockId,
      blockKind: step.kind,
      blockLabel: step.label,
      message: `Concluído ${step.label} (#${step.blockId})`,
    }, context);
  }
  break;
}
```

---

## 4. Componentes de Interface

1. **Toolbar Suspensa do Depurador ([DebuggerToolbar.tsx](file:///Users/macbookpro/Dev/flowforge/src/features/canvas/DebuggerToolbar.tsx))**:
   - Botão **Depurar** / **Continuar** (Play/F5).
   - Botão **Pausar** (Pause).
   - Botão **Passo** (Step Over).
   - Botão **Parar** (Stop/Abort imediato).
   - Botão **Reiniciar** (Reset de memória e execução).
   - Seletor e contador para **Time-Travel**.
   - Badge de status indicando o bloco exato em pausa.

2. **Painel de Time-Travel e Inspeção ([TimeTravelPanel.tsx](file:///Users/macbookpro/Dev/flowforge/src/features/canvas/TimeTravelPanel.tsx))**:
   - Timeline horizontal scrollável com chips numerados de cada passo (`#1 btn_login (IN)`, `#2 auth_block (IN)`, `#3 auth_block (OUT)`...).
   - Aba **Payloads do Bloco**: visualização formatada em JSON das entradas e saídas naquele instante.
   - Aba **Estado Global (Store)**: memória compartilhada da sessão naquele instante.
   - Aba **Variáveis de Escopo**: variáveis locais da execução naquele instante.
   - Botão **Ir para o presente**: restaura a visualização para o último estado em tempo real.

3. **Interação nos Blocos do Canvas ([BlockNode.tsx](file:///Users/macbookpro/Dev/flowforge/src/features/canvas/BlockNode.tsx))**:
   - Botão de Breakpoint no cabeçalho do bloco (visível ao hover ou fixo quando ativo com `.has-breakpoint`).
   - Efeito visual de pulso e glow âmbar (`.is-debug-paused`) com anel luminoso no bloco pausado.
   - Badges de dados (`.port-val.debug-val-badge`) mostrando os valores transmitidos pelas portas diretamente no canvas durante o Time-Travel.

---

## 5. Garantia de Qualidade e Testes

A suíte automatizada em [tests/debugger-time-travel.test.ts](file:///Users/macbookpro/Dev/flowforge/tests/debugger-time-travel.test.ts) valida:
1. Pausa automática e precisa em blocos configurados com Breakpoint.
2. Execução passo a passo controlada via `step()`.
3. Imutabilidade dos snapshots e consistência retroativa de Store e Payloads no Time-Travel.
4. Interrupção graciosa do fluxo em execução com `stop()`.

**Status:** 231 testes passando (`npm test`), compilação TypeScript estrita (`tsc -b`), linting sem avisos e build Vite 100% aprovado.
