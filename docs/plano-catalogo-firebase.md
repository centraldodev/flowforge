# Plano: catálogo de blocos e futura integração Firebase

## Objetivo e decisão de arquitetura

O catálogo descreve blocos, opções, portas e propriedades como dados versionados. O motor e os exportadores implementam operações conhecidas; dados recebidos do catálogo nunca são executados como código. O banco do catálogo do FlowForge e os bancos dos aplicativos criados são recursos independentes: usar Firestore em um aplicativo não obriga o editor a depender do Firestore.

Um projeto exportado deve incluir suas definições e código gerado. Uma atualização do catálogo do editor não pode alterar silenciosamente o comportamento de um aplicativo já exportado. O número de versão permite identificar a definição utilizada; mudanças incompatíveis precisam de validação e migração explícitas, mesmo sem necessidade de preservar os projetos antigos de teste.

## Fase 1 — base declarativa de lógica e validação

- Manter definições de condição e validação em dados JSON com versão de esquema, identificadores estáveis, opções e operação interna.
- Usar as mesmas opções no inspetor e no compilador; rejeitar definições ou operações que o motor não conhece.
- Exportar um retrato das definições aplicáveis em `flowforge/catalog/` junto com o projeto visual. O aplicativo gerado usa código compilado e não consulta o catálogo em tempo de execução.
- Testar catálogo inválido, operações desconhecidas, compilação, exportação e comportamento dos fluxos.

Nesta fase o catálogo continua empacotado com o editor. A importação dinâmica de um banco, a criação de blocos arbitrários, a edição administrativa e a troca de versões ainda não estão implementadas. Alterar o arquivo do catálogo exige reconstruir o editor. Uma opção nova só funciona quando usa uma operação já suportada e a fonte do catálogo é validada antes de ser disponibilizada.

## Fase 2 — repositório e publicação do catálogo

Implementado nesta etapa: contrato de leitura/publicação, repositório local no navegador, validação, versões imutáveis, histórico local de publicações e escolha explícita de versão para condições e validações. No painel expandido é possível criar uma opção baseada em uma operação existente; uma nova versão é publicada e selecionada no bloco. A exportação inclui as versões usadas, inclusive em subfluxos. Versão ausente ou incompatível impede a compilação.

O repositório local usa `localStorage` e é específico do navegador e da origem; limpar os dados do navegador o apaga. O histórico e a identificação do autor são apenas locais, não constituem auditoria confiável nem controle de acesso. A importação automática do snapshot para outro editor, garantias de concorrência entre abas, publicação remota, cache remoto e permissões no servidor ainda não foram implementados. Aplicativos exportados executam o código gerado sem depender do catálogo local. Ao reabrir o projeto visual em outro navegador, versões personalizadas não disponíveis geram diagnóstico em vez de substituição silenciosa.

Próximos trabalhos para concluir a publicação compartilhada:

1. Definir um contrato de repositório independente do armazenamento: listar versões publicadas e buscar definições por ID e versão; começar com implementação local e testes de contrato.
2. Modelar tabelas ou documentos separados para definição, versão imutável, status de publicação e auditoria. Definições incluem esquema das propriedades, portas tipadas, vínculo à operação permitida e suporte por alvo de exportação.
3. Validar esquema, tamanho, IDs únicos, referências de operações, compatibilidade de portas e dependências antes de publicar. Alterações administrativas exigem controle de acesso; clientes comuns só leem versões publicadas.
4. Fixar no projeto as versões escolhidas e guardar um snapshot verificável. Ao abrir um projeto, detectar ausência ou incompatibilidade sem substituição silenciosa. Sincronização, cache e indisponibilidade precisam de comportamento explícito.
5. Decidir PostgreSQL ou Firestore para o catálogo somente ao implementar o repositório remoto, conforme implantação e necessidades de consulta. Testar publicação, recusa, leitura, atualização controlada e exportação offline.

Uma nova opção que reutiliza uma operação existente pode ser publicada como dado. Um novo tipo de operação exige implementação, validação e testes no interpretador e em cada exportador que o declara suportado. Não aceitar funções, expressões JavaScript ou templates de código vindos de usuários ou do banco.

## Fase 3 — Firebase Authentication

1. Criar um bloco de conexão Firebase com configuração pública do aplicativo web, identificador do projeto e configurações separadas para desenvolvimento e produção. Tratar essas informações separadamente das credenciais privilegiadas do servidor; nunca colocar uma credencial de serviço no navegador ou no projeto visual.
2. Criar um provedor de identidade Firebase e operações visuais de cadastro, entrada com e-mail e senha, entrada Google, observação de sessão e saída. Acrescentar recuperação de senha e confirmação de e-mail como operações distintas.
3. Determinar política de persistência de sessão, navegação por autenticação e mensagens de erro. Assegurar que o backend valide tokens quando ele precisar reconhecer um usuário, sem confiar em IDs ou papéis enviados pelo cliente.
4. Implementar adaptadores e exportação independentes dos adaptadores PostgreSQL atuais. Testar primeiro com Firebase Authentication Emulator, incluindo credenciais inválidas, expiração, saída e falhas de rede. Testar Google conforme as capacidades do emulador e fazer uma homologação específica com projeto de teste quando necessário.
5. Documentar configuração do projeto Firebase, provedores autorizados, domínios e variáveis por ambiente. Não ativar provedores nem publicar configurações na conta do usuário automaticamente.

Referências: [login Google na Web](https://firebase.google.com/docs/auth/web/google-signin), [autenticação por senha](https://firebase.google.com/docs/auth/web/password-auth), [verificação de tokens no servidor](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [emulador de autenticação](https://firebase.google.com/docs/emulator-suite/connect_auth).

## Fase 4 — Firestore e regras visuais

1. Modelar conexão, coleção, documento, campos e operações (criação, leitura, atualização, exclusão e consulta), incluindo caminhos e índices. Identificar dados do usuário autenticado sem permitir que o cliente escolha outro proprietário.
2. Criar um modelo de política estruturado com negação por padrão: autenticação, proprietário, organização, papéis confiáveis, campos permitidos e validações de escrita. Gerar `firestore.rules` e índices versionados junto ao código exportado.
3. Escolher explicitamente o caminho de acesso: o SDK cliente é governado por Security Rules; o SDK de servidor/Admin ignora essas regras e exige IAM e autorização própria no backend. Nunca presumir que uma regra protege uma operação administrativa.
4. Garantir que consultas incluam restrições compatíveis com as regras: Security Rules não filtram resultados, e uma consulta potencialmente não autorizada é recusada.
5. Testar regras no Emulator Suite: sem sessão, proprietário correto e incorreto, alteração de proprietário, regras por organização, consulta compatível e incompatível, campos indevidos, índices e acesso administrativo. Fazer deploy somente com ação explícita do usuário e configuração do ambiente alvo.

Referências: [condições de regras](https://firebase.google.com/docs/firestore/security/rules-conditions), [consultas e regras](https://firebase.google.com/docs/firestore/security/rules-query), [teste de regras no emulador](https://firebase.google.com/docs/firestore/security/test-rules-emulator).

## Fase 5 — aceite integrado

Criar no editor um aplicativo de exemplo com blocos e conexões para cadastro, login Google, coleção de dados e regras de acesso; exportar para diretório limpo; instalar e executar com os emuladores; comprovar operações permitidas e negadas e verificar os arquivos gerados. Homologar os fluxos externos em projeto Firebase de teste antes de afirmar suporte a produção. Documentar limites de custo, disponibilidade e permissões sem armazenar segredos no código exportado.
