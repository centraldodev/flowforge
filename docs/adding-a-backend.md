# Guia para Adicionar um Novo Backend no FlowForge

Este documento descreve o contrato formal para criação e registro de novos backends do compilador FlowForge (Fase 10).

Com a arquitetura da Fase 10, qualquer linguagem de destino (como Kotlin, Swift, Dart, Go, C# ou Rust) pode ser adicionada sem modificar o compilador central (`src/compiler/index.ts`, `lower.ts`, `analyze.ts`) ou a interface do editor.

---

## 1. O Contrato `CompilerBackend`

Todo backend deve implementar a interface `CompilerBackend` definida em `src/compiler/backends/types.ts`:

```typescript
export interface CompilerBackend {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly targetLanguage: string;
  readonly capabilities: ReadonlySet<BackendCapability>;

  /** Valida se a ProgramIR contém recursos não suportados pelo backend */
  validateCompatibility(program: ProgramIR): Diagnostic[];

  /** Emite os artefatos de código para o backend a partir da ProgramIR */
  emit(program: ProgramIR, options?: Record<string, unknown>): BackendEmitResult;

  /** Retorna os arquivos de runtime estáticos ou dinâmicos necessários */
  getRuntimeFiles(): GeneratedArtifact[];

  /** Formata o artefato gerado segundo as regras da linguagem */
  format(artifact: GeneratedArtifact): GeneratedArtifact;

  /** Retorna comandos padronizados de build e teste para o backend */
  getBuildCommands(): BackendBuildCommands;
}
```

---

## 2. Capacidades Suportadas (`BackendCapability`)

Cada backend declara explicitamente suas capacidades no conjunto `capabilities`:

- `control_flow`: Suporte a ramificações, sequências e loops.
- `state`: Leitura e escrita de estado (`store`).
- `async`: Execução assíncrona com `await` e Promises/Coroutines.
- `adapters`: Chamadas a adaptadores de banco, auth e API.
- `delay`: Atrasos e timers temporais.
- `notifications`: Emissão de mensagens/notificações.
- `ui_tree`: Renderização de árvores de UI declarativas (`ScreenUI`).
- `portable_operations`: Suporte a blocos visuais sem código textual (math, text, compare, boolean, etc.).
- `legacy_js_eval`: Execução de código textual legado em JavaScript (suportado por padrão apenas no backend JavaScript).

---

## 3. Passo a Passo para Criar um Novo Backend

### Passo 1: Criar o diretório do backend
Crie uma pasta em `src/compiler/backends/<nome-da-linguagem>/` com:
- `ast.ts`: Tipos da AST e emissão segura de literais/expressões.
- `codegen.ts`: Lowering de `ProgramIR` para a AST da linguagem de destino.
- `runtimeTemplate.ts`: Código fonte do runtime autocontido da linguagem.
- `backend.ts`: Classe que implementa `CompilerBackend`.
- `index.ts`: Re-exportação do módulo.

### Passo 2: Emissão Segura de Literais
Todo valor string, número, booleano, array ou dicionário deve passar por uma função `safeLiteral` que evite qualquer injeção de código ou erros de escape (aspas, quebras de linha, Unicode).

### Passo 3: Implementar o Runtime Autocontido
O runtime da linguagem de destino deve fornecer:
1. `RuntimeContext`: Armazena `inputs`, `store`, `screen`, `outputs`, `trace`, `notifications`, `logs` e `stepCount`.
2. `FlowForgeProgram`: Classe com método `dispatch(eventId, inputs)` que roteia para o handler correto.
3. Adaptadores mock determinísticos para `auth`, `database`, `api` e `delay`.

### Passo 4: Registrar no `BackendRegistry`
Adicione o backend ao registro padrão:

```typescript
import { defaultBackendRegistry } from './registry';
import { meuNovoBackend } from './meu-backend';

defaultBackendRegistry.register(meuNovoBackend);
```

---

## 4. Obrigações de Paridade e Conformidade

Para que um novo backend seja considerado aceito e de produção:

1. **Paridade Comportamental Completa**: Deve executar os mesmos fluxos da suíte de conformidade de grafos dourados (`tests/compliance.test.ts`), produzindo saídas equivalentes ao interpretador da IR.
2. **Sem Acesso Externo em Testes**: Mocks de rede e banco devem ser estritamente locais e determinísticos.
3. **Diagnósticos Sem Silenciamento**: Caso a `ProgramIR` utilize recursos não suportados pela linguagem alvo, o método `validateCompatibility` deve emitir `Diagnostic` estruturado com severidade `error` ou `warning`, nunca ignorar silenciosamente.
4. **Comandos de Verificação**: `getBuildCommands()` deve fornecer comandos reais que funcionem na esteira de CI (`test`, `build`).
