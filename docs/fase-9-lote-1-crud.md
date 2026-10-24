# Fase 9 — Lote 1: CRUD Completo

## 1. Casos de Uso Suportados e Não Suportados

### Suportados
- **Query (Consulta com filtros e paginação)**:
  - Filtrar registros por campo/valor exato (`field == value`) ou operadores (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`).
  - Paginação determinística com `limit` (tamanho da página) e `offset` (deslocamento).
  - Ordenação por campo (`orderBy`) ascendente ou descendente (`orderDirection`).
  - Retorno de lista de registros com metadados opcionais (`total`, `limit`, `offset`).
- **Get (Busca por ID)**:
  - Localizar registro único pela chave primária `id`.
  - Retorna o registro encontrado ou aciona o ramo `onError` caso não exista.
- **Insert (Criação de registro)**:
  - Inserção de novos registros com autoincremento seguro de `id` numérico quando não fornecido.
  - Persistência na tabela especificada dentro da memória da sessão (`store[table]`).
- **Update (Atualização de registro)**:
  - Atualização por `id` com mesclagem atômica de campos (`patch`/`merge`).
  - Lança erro rastreável quando o registro alvo não existe.
- **Delete (Remoção de registro)**:
  - Remoção por `id` do store determinístico.
  - Retorna confirmação de exclusão e quantidade de registros afetados.

### Não Suportados neste lote
- Junções relacionais complexas (JOINs) entre múltiplas tabelas (planejadas para o Lote 2 - Modelos e schemas tipados).
- Transações ACID distribuídas (2-phase commit).
- Acesso direto a conexões SQL/NoSQL remotas via rede nos testes e no runtime padrão (bancos reais serão adaptadores opcionais desacoplados).

---

## 2. Extensão na IR (ProgramIR)

O nó de instrução `InstructionIR` já possui suporte ao formato `adapter_call`:
```ts
{
  kind: 'adapter_call',
  adapter: 'database',
  action: 'query' | 'insert' | 'get' | 'update' | 'delete',
  payload: {
    table: ExprIR,
    id?: ExprIR,
    data?: ExprIR,
    filter?: ExprIR,
    limit?: ExprIR,
    offset?: ExprIR,
    orderBy?: ExprIR,
    orderDirection?: ExprIR,
  },
  targetVar: string
}
```
Não é necessário alterar a definição de tipos da `InstructionIR`, apenas enriquecer o payload montado na fase de lowering.

---

## 3. Tipos e Portas do Bloco `database`

- **Portas de Entrada (Controle)**:
  - `execute`, `exec`, `listener`, `listenerClick` (`mode: 'control'`, `cardinality: 'many'`)
- **Portas de Entrada (Dados)**:
  - `data` / `value`: dados para inserção ou atualização (`mode: 'data'`, `cardinality: 'one'`, `valueType: { kind: 'any' }`)
  - `id`: identificador do registro para get/update/delete (`mode: 'data'`, `cardinality: 'one'`, `valueType: { kind: 'any' }`)
  - `filter`: critérios de busca para query (`mode: 'data'`, `cardinality: 'one'`, `valueType: { kind: 'any' }`)
  - `limit`: limite de registros para paginação (`mode: 'data'`, `cardinality: 'one'`, `valueType: { kind: 'number' }`)
  - `offset`: deslocamento da página (`mode: 'data'`, `cardinality: 'one'`, `valueType: { kind: 'number' }`)
- **Portas de Saída (Controle)**:
  - `onSuccess`, `then`, `next` (`mode: 'control'`, `cardinality: 'many'`)
  - `onError` (`mode: 'error'`, `cardinality: 'many'`, `valueType: { kind: 'error' }`)
- **Portas de Saída (Dados)**:
  - `data` / `value`: registro retornado ou lista de itens (`mode: 'data'`, `cardinality: 'many'`, `valueType: { kind: 'any' }`)
  - `total`: contagem total de itens na tabela/query (`mode: 'data'`, `cardinality: 'many'`, `valueType: { kind: 'number' }`)
  - `error`: objeto/mensagem de erro capturada (`mode: 'data'`, `cardinality: 'many'`, `valueType: { kind: 'error' }`)

---

## 4. Interface do Adaptador (`DatabaseAdapter`)

```ts
export interface DatabaseAdapter {
  execute(
    action: string,
    payload: {
      table: string;
      id?: unknown;
      data?: Record<string, unknown>;
      filter?: Record<string, unknown> | Array<{ field: string; op?: string; value: unknown }>;
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
      [key: string]: unknown;
    },
    context: ExecutionContext,
  ): Promise<unknown>;
}
```

---

## 5. Comportamento Mock Determinístico

- **Tabela**: Armazenada em `context.store[table]`. Se vazia e houver mock configurado, popula com semente determinística.
- **Insert**: Gera `id` incremental (`Math.max(...ids) + 1`), faz append no array e retorna o novo registro.
- **Get**: Localiza por `id`. Lança `Error('Registro com ID ... não encontrado')` se ausente.
- **Update**: Localiza por `id`, mescla os campos de `data` e retorna o registro atualizado. Lança erro se ausente.
- **Delete**: Remove o item por `id`, retorna `{ success: true, id, deletedCount: 1 }`. Lança erro se ausente.
- **Query**:
  - Filtra por correspondência exata ou operadores.
  - Ordena de acordo com `orderBy`.
  - Aplica fatia `[offset, offset + limit]`.
  - Retorna a lista de itens e atribui o total em `context.outputs.total`.

---

## 6. Comportamento Esperado nos Backends JS e Python

- Ambos os backends possuem implementações idênticas de `MockDatabaseAdapter`.
- `insert`, `get`, `update`, `delete`, `query` produzem exatamente os mesmos resultados JSON, as mesmas mutações no store e os mesmos erros para paridade cross-language.

---

## 7. Riscos de Migração

- **Zero regressão**: Operações legadas de banco que chamavam `insert` ou `query` sem parâmetros avançados continuam funcionando identicamente.
- O store `context.store` continua compatível com a interface declarativa e a simulação.
