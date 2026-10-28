# Modelos de aplicativos

O modal **Novo projeto** oferece três bases construídas com blocos e conexões:

- **Tarefas:** criar, listar, alterar e excluir tarefas.
- **Loja virtual — catálogo:** criar, listar, alterar e excluir produtos. Carrinho, estoque, pedidos e pagamento não estão implementados neste modelo.
- **Rede social — mural:** criar, listar, alterar e excluir publicações. Perfis, comentários, curtidas e seguidores não estão implementados neste modelo.

Todos incluem cadastro e login por e-mail e senha, logout, entidade, conexão PostgreSQL, regra de acesso autenticado, validação de campos, montagem de objetos, operações de banco e tratamento de erro. Os dados da tabela são **compartilhados por todos os usuários autenticados**. Eles não são modelos de isolamento por usuário nem aplicações prontas para produção.

## Configurar e executar um modelo exportado

1. Escolha o modelo em **Novo projeto** e selecione o bloco **Conexão PostgreSQL** para revisar host, porta, banco, usuário, TLS e nome das variáveis de segredo de desenvolvimento e produção. Use um banco dedicado para cada aplicativo: o controle atual de migrações é compartilhado por banco e ainda não separa projetos diferentes.
2. Exporte o projeto TypeScript, extraia o arquivo e execute `npm install` no diretório criado.
3. Copie `.env.development.example` para `.env`. Preencha `FLOWFORGE_SECRET_DB_PASSWORD` com a senha configurada ou com a URL de um PostgreSQL acessível. Se tiver alterado a referência de segredo no bloco, use o nome configurado.
4. Execute `npm run dev`. A conta PostgreSQL precisa ter permissão para criar tabelas e aplicar migrações. Na tela inicial, crie uma conta e depois use a lista do aplicativo.
5. Para criar registros, informe um identificador único e os demais campos. Para atualizar ou excluir, informe o identificador existente e clique no botão correspondente. **Atualizar lista** busca os registros novamente no banco.

Para produção, revise autenticação, autorização por proprietário ou organização, políticas, conexão segura, migrações, implantação e requisitos específicos do aplicativo. A prévia do editor não equivale à execução do projeto exportado com banco real.
