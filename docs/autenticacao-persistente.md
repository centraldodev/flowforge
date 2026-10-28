# Autenticação persistente no projeto exportado

Para usar autenticação real por e-mail e senha:

1. Adicione e configure um bloco de conexão PostgreSQL, incluindo a referência à variável que contém a senha ou URL do banco.
2. No bloco de autenticação, escolha **Autenticação pelo servidor** e selecione essa conexão em **Banco PostgreSQL para usuários e sessões**. Os blocos reais de cadastro, login, consulta de sessão e logout devem usar a mesma conexão.
3. Conecte os blocos aos campos e botões da tela. O cadastro e o login recebem e-mail e senha; a sessão é compartilhada com as operações de banco no aplicativo exportado.
4. Exporte o projeto, copie `.env.development.example` para `.env` e preencha a variável configurada na conexão PostgreSQL. Instale as dependências e execute `npm run dev`.

O backend cria as tabelas `flowforge_auth_users` e `flowforge_auth_sessions` no primeiro uso; a conta do banco precisa ter permissão para criá-las. As sessões são guardadas com o hash do token e podem ser verificadas após reiniciar o processo. O logout revoga a sessão no banco. O token no navegador fica apenas em memória: ao recarregar a página, é necessário autenticar novamente.

O modo de demonstração continua isolado. Na prévia do editor, a autenticação usa o gateway local de simulação e não comprova a persistência do aplicativo exportado. Google/OIDC e outros provedores reais não estão implementados; para uso em produção ainda são necessárias avaliações adicionais de segurança, operação e recuperação de conta.
