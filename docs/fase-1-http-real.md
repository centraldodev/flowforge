# Fase 1 — Integrações HTTP reais

Implementado: recurso Conexão HTTP, requisições pelo backend, ambientes, credenciais por referência, pares de nome/valor no painel, presets, teste manual e exportação React + Node independente do editor.

## Montagem no editor

1. Adicione Conexão HTTP na biblioteca. Preencha URL base de desenvolvimento e, se usar esse ambiente, URL de produção. A conexão é um recurso compartilhado, visível nas telas.
2. Escolha Sem autenticação, Bearer ou API key em cabeçalho. Para credenciais, informe uma referência com prefixo `FLOWFORGE_SECRET_`, como `FLOWFORGE_SECRET_CRM_TOKEN`.
3. No editor local, o campo de senha em “Testar e configurar HTTP” permite enviar o valor ao servidor, onde fica somente em memória até reiniciar. O valor não é armazenado no grafo ou no navegador. Também é possível fornecê-lo no ambiente do processo ou `.env.local` antes de iniciar o editor.
4. Adicione Requisição API. Escolha HTTP real ou uma predefinição: listar registros, criar registro ou personalizada. Demonstração continua sendo um modo explícito para os exemplos existentes; nenhuma falha de HTTP real é convertida em simulação.
5. Selecione Conexão HTTP no painel ou arraste o cabo da saída Conexão HTTP do recurso para a entrada correspondente da requisição. Ambas as ações criam o mesmo vínculo; a configuração não é duplicada.
6. Configure método, caminho como `/clientes`, parâmetros, corpo fixo e formato de resposta. Parâmetros/cabeçalhos/corpo usam listas de nome e valor, sem JSON obrigatório. Valores fixos do formulário de corpo são textos; corpos tipados/compostos podem vir da porta `body`.
7. Conecte um botão à entrada `execute`. As saídas `onSuccess`/`then`/`next` continuam o fluxo; `onError` trata erros. A saída `response` contém `{ ok, status, data }`, o envelope completo retornado pelo backend. Ligue-a à entrada do próximo bloco e execute esse bloco pelo cabo de execução.
8. Escolha desenvolvimento ou produção nas configurações do projeto. Testar requisição usa valores fixos; Simular executa o fluxo com as entradas conectadas. Testes de métodos que podem alterar dados pedem confirmação dentro do produto.

O editor precisa estar rodando com `npm run dev` para disponibilizar o backend local. Um site estático do editor, sem esse servidor, apresenta erro explícito de backend indisponível.

## Projeto exportado

O ZIP TypeScript contém frontend React, programa compilado, backend Node, manifesto de requisições, proxy de desenvolvimento, exemplos de ambiente e README.

- `npm install` instala dependências.
- Copie `.env.development.example` para `.env`; preencha os valores secretos no ambiente do servidor.
- `npm run dev:server` inicia o backend em `127.0.0.1:8787`.
- `npm run dev`, em outro terminal, inicia o frontend com proxy para o backend.
- `npm run build` e `npm start` executam o app compilado no próprio backend, sem Vite ou editor.
- `FLOWFORGE_ENV` seleciona o ambiente do servidor; a configuração de produção precisa possuir URL própria.

O ZIP inclui referências vazias; credenciais locais não são copiadas. Alterar a porta exige ajustar o proxy de desenvolvimento. A rota de configuração temporária de segredos só existe no editor local, não no backend exportado.

Python não suporta HTTP real nesta entrega: a exportação é bloqueada explicitamente. O script JavaScript legado isolado também não substitui o ZIP completo.

## Execução e limites

O backend aceita somente IDs das requisições do manifesto exportado. Cliente não escolhe URL, método, cabeçalhos ou referências de segredo. Corpo dinâmico é permitido; parâmetros dinâmicos precisam estar declarados por nome. URLs base não aceitam credenciais, query string ou fragmentos; os caminhos não podem trocar a origem ou escapar do prefixo da base.

Chamadas têm timeout configurável de 100 a 120000 ms. Redirecionamentos são recusados para impedir encaminhamento imprevisto de credenciais. Não há tentativas automáticas, OAuth HTTP genérico, importação OpenAPI, streaming, multipart, upload binário ou formato de corpo arbitrário nesta fase. Corpo fixo é JSON; GET e DELETE não enviam corpo.

Erros retornam código e mensagem sem corpo/diagnóstico privado do serviço externo. O status HTTP externo, quando disponível, é preservado no erro. Valores da credencial usada são removidos se refletidos na resposta. Segredos só são lidos de referências `FLOWFORGE_SECRET_*`.

Há verificação de origem, limite de entrada de 1 MB e resposta de 2 MB. O backend exportado não aceita manifestos enviados pelo cliente e não oferece proxy de URL livre. O editor local aceita o manifesto em edição, por ser uma ferramenta local de desenvolvimento, com acesso restrito à mesma origem.

Autenticação do usuário e autorização de operações são fases posteriores. As operações cadastradas ainda não têm políticas por usuário; o servidor escuta em loopback por padrão. Auth e banco continuam simulados. Não confundir credencial de acesso ao serviço externo com identidade do usuário do app.

## Verificação

Testes de integração usam um servidor HTTP real local para verificar GET/POST, parâmetros, corpo, Bearer/API key, ambientes, respostas, erros, timeout, redirecionamento, credenciais temporárias, rejeição de manifestos arbitrários e paridade entre interpretador e programa JavaScript compilado.

Também foi extraído um ZIP para um diretório temporário e executado o build real do projeto exportado com as dependências locais. O backend exportado foi iniciado fora do editor: serviu o frontend compilado e executou POST real com corpo configurado e credencial resolvida no servidor. A biblioteca e o carregamento do editor foram conferidos no navegador, e as rotas do backend de desenvolvimento foram verificadas com requisições locais.

Referências técnicas usadas: [Node — fetch e AbortController](https://nodejs.org/api/globals.html) e [Node — suporte a arquivos de ambiente](https://nodejs.org/en/blog/release/v20.19.0).
