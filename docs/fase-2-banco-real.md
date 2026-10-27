# Fase 2 — Dados persistentes e PostgreSQL

Implementado: recurso Conexão PostgreSQL, modelagem visual de Entidades/Tabelas com campos tipados, operações CRUD seguras e parametrizadas (`query`, `get`, `insert`, `update`, `delete`), geração de DDL e migrações SQL, repositórios de domínio e exportação modular completa sem vazamento de segredos.

## Montagem no editor

1. Adicione **Conexão PostgreSQL** na biblioteca de blocos. Configure host, porta (`5432`), banco de dados, esquema (`public`), usuário e o nome da referência do segredo de senha (ex.: `FLOWFORGE_SECRET_DB_PASSWORD`). A conexão também aceita configuração de ambiente para produção (`productionHost`, `productionSecretEnv`, `productionSsl`).
2. Adicione **Entidade / Tabela** para modelar dados estruturados. Defina o nome da tabela (ex.: `clientes`) e seus campos com tipos suportados (`string`, `number`, `boolean`, `date`, `json`), restrições de obrigatoriedade (`required`), chave primária (`primaryKey`) e unicidade (`unique`).
3. Adicione o bloco **Banco de dados**. Selecione o modo **PostgreSQL Real (Servidor)**. Conecte o cabo da porta `connection` do recurso PostgreSQL à entrada correspondente do bloco, ou selecione a conexão no painel.
4. Escolha a operação desejada:
   - **Consultar (Query)**: permite configurar nome da tabela, filtros parametrizados (`filterField` e `filterValue` ou porta `filter`), ordenação (`orderBy` e `orderDirection`) e paginação (`limit` e `offset`). Retorna a lista de registros na porta `data` e o número de itens na porta `total`.
   - **Buscar por ID (Get)**: busca o registro único com o ID fornecido no painel ou na porta `id`. Retorna o item encontrado em `data` ou ramifica para `onError` caso não exista.
   - **Inserir registro (Insert)**: insere o payload recebido na porta `data` ou `value` e retorna o registro criado na porta `data`.
   - **Atualizar registro (Update)**: atualiza os campos do registro correspondente ao ID informado.
   - **Excluir registro (Delete)**: exclui o registro indicado e emite `deletedCount: 1`.
5. As saídas de fluxo `onSuccess`, `then` e `next` continuam o encadeamento de ações; `onError` captura falhas de validação, registros inexistentes ou indisponibilidade de banco sem interromper a aplicação.

## Projeto exportado

A exportação modular TypeScript + React agora gera no backend Node:

- `packages/contracts/src/entities/<entidade>.ts`: contratos de tipos TypeScript gerados a partir das entidades visuais do projeto.
- `apps/api/src/database/schema/<entidade>.sql` e `apps/api/src/database/migrations/001_init.sql`: migrações DDL `CREATE TABLE IF NOT EXISTS` com colunas e tipos PostgreSQL (`TEXT`, `NUMERIC`, `BOOLEAN`, `TIMESTAMPTZ`, `JSONB`).
- `apps/api/src/modules/<tabela>/repository.mjs`: repositório de domínio com queries preparadas e parametrizadas (`$1, $2, ...`) evitando injeção de SQL por construção.
- `apps/api/src/database/gateway.mjs`: gateway de persistência para atendimento seguro das operações pelo backend exportado.
- `.env.development.example` e `.env.production.example`: exemplos de variáveis de ambiente com todas as referências de segredos declaradas (ex.: `FLOWFORGE_SECRET_DB_PASSWORD=`), mantendo valores sensíveis fora do ZIP e do grafo.

Python bloqueia explicitamente a exportação quando há conexões ou operações reais de PostgreSQL configuradas.

## Execução, persistência e limites

1. O cliente nunca executa SQL livre ou envia strings de consulta arbitrárias. O backend aceita somente os identificadores das operações registradas no manifesto do projeto.
2. Identificadores de colunas e tabelas são estritamente validados contra a expressão regular `/^[a-zA-Z_][a-zA-Z0-9_]*$/` e escapados com aspas duplas.
3. Valores de entrada em filtros, inserções e atualizações são passados exclusivamente como parâmetros preparados (`$1, $2, ...`).
4. Erros internos de infraestrutura e credenciais de banco são sanitizados para evitar exposição de senhas no cliente ou nas respostas da API.
5. Em desenvolvimento local com o editor, o gateway do FlowForge armazena dados em memória/processo no servidor local (`/__flowforge/db`), simulando o PostgreSQL fielmente até a conexão com o banco definitivo.

## Verificação

- Suíte `tests/database-integrations.test.ts` valida:
  - Detecção de conexões ausentes, segredos malformatados e nomes de tabela inseguros.
  - Geração de migrações DDL estruturadas com chave primária e restrições.
  - CRUD completo com parâmetros preparados (insert, query com filtro, get por ID, update, delete).
  - Execução pelo interpretador via `GatewayDatabaseAdapter` preenchendo as variáveis e saídas contextuais.
  - Isolamento de falhas no ramo `onError`.
  - Verificação de arquivos gerados no ZIP modular, exclusão de segredos e bloqueio em Python.
- `npm run check` (181 testes, lint, types e formatação) e `npm run build` passaram com 100% de sucesso.
