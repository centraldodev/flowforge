# Reauditoria funcional — 27/10/2026

Escopo: árvore de trabalho atual sobre `8eb1a55`, incluindo as alterações ainda não commitadas. Comparação com a auditoria anterior. Não alterei código de aplicação.

## Resultado geral

As correções resolveram os builds dos aplicativos de referência e alguns problemas importantes. Ainda existem falhas de autorização, execução real de banco, login e propagação de erros. O sistema ainda não pode ser considerado completamente validado para gerar os apps sólidos previstos no plano.

## Verificações e correções confirmadas

| Caso | Resultado atual |
|---|---|
| `npm run check` do editor | Passou: 244 testes; permanece um aviso de hook em Sidebar |
| `npm run build` do editor | Passou; aviso de tamanho do bundle |
| Clientes e Pedidos: instalação independente, build e testes | Passaram |
| Agendamento: instalação independente, build e testes | Passaram |
| Portal de Aprovação: instalação independente, build e testes | Passaram |
| Página inicial dos três projetos compilados | HTTP 200; backend nos apps completos e servidor estático no app de Agendamento |
| Cadastro público com `role: admin` | HTTP 400, `PRIVILEGE_ESCALATION_DENIED` |
| Cadastro com organização definida pelo cliente | A organização não é atribuída pelo cadastro público |
| Escrita sem sessão sob política que exige autenticação | HTTP 403 |
| Consulta de pagamento inexistente | HTTP 404, `PAYMENT_NOT_FOUND` |
| Webhook sem assinatura | HTTP 401, `MISSING_SIGNATURE` |
| Dockerfile: cópia de scripts antes do build | Corrigida por inspeção; imagem não foi construída nesta reauditoria |

Os ZIPs foram extraídos em novos diretórios temporários, com instalação própria de dependências, sem reutilizar o `node_modules` do editor. As reproduções de comportamento foram locais e usaram usuários, dados e chaves sintéticas. Não consultei provedores de pagamento nem conectei um PostgreSQL real.

## 1. Crítico — proprietário do registro pode ser falsificado no corpo da atualização

Origem: `src/export/modular/database.ts:346` e `src/export/modular/auth.ts:64`.

A política agora é chamada obrigatoriamente quando existe autenticação, mas recebe `body.payload.data` como se fosse o registro confiável. `isOwner` compara o proprietário desse objeto enviado pelo cliente com o usuário autenticado. O código não carrega o registro atual para avaliar quem realmente é o dono.

Reprodução:

1. Configurei uma política de autenticação e uma política `isOwner` para atualizar `items`.
2. Cadastrei Alice e Bob pelo gateway, obtendo sessões legítimas distintas.
3. Alice inseriu um registro com `ownerId` de Alice.
4. Bob atualizou o mesmo ID enviando `data.ownerId` de Bob.
5. O gateway retornou HTTP 200, alterando o conteúdo e o proprietário para Bob.

Correção: para ler/atualizar/excluir, carregar o registro persistido e avaliar acesso sobre dados confiáveis. Campos de proprietário/organização precisam de regras próprias de atribuição e mudança. Revalidar a condição na escrita para evitar inconsistência entre verificação e alteração. O corpo da nova versão não prova a propriedade da versão existente.

## 2. Alto — ramo PostgreSQL continua sem ser executado

Origens: `src/engine/database.ts:171` e `src/export/modular/database.ts:370`.

O gateway seleciona banco real por `spec.mode === 'real' || Boolean(spec.connectionId)`. Entretanto, o manifesto não emite `mode` nem `connectionId`: emite a conexão em `spec.connection`. As operações do manifesto já são filtradas pelo modo real, mas a condição do gateway ainda é falsa.

Reprodução: uma operação configurada como real retornou HTTP 200 e salvou em memória sem PostgreSQL. Passei também um pool de teste instrumentado: ele não foi acessado nenhuma vez. No manifesto emitido, `mode` e `connectionId` estavam ausentes e `connection` estava presente.

Correção: alinhar manifesto e executor, remover o fallback de memória de operações reais e resolver a conexão/ambiente configurados para aquela operação. A ausência de banco/credencial deve gerar erro, não sucesso em memória. Depois comprovar gravação e leitura após reiniciar o backend usando PostgreSQL real.

Há ainda um problema no caminho hoje inacessível: `runMigrations(pool).catch(() => {})` descarta erros de migração e marca as migrações como executadas. Esse erro precisa interromper a inicialização/operação e ser apresentado de forma adequada, quando o ramo real for conectado.

## 3. Alto — banco sem autenticação gera módulo que falha na importação

Origem: `src/export/modular/database.ts:282`.

Quando `hasAuth` é falso, são emitidas declarações no escopo do módulo que acessam `options?.authorizeRequest` e `options?.verifySession`. `options` só existe como parâmetro de `createDatabaseGateway`, definido depois.

Reprodução: gerar um projeto com banco e sem blocos de identidade/política e importar seu gateway resultou em `ReferenceError: options is not defined`.

Correção: resolver essas opções dentro da factory, com uma política explícita para operações públicas. Checagem de sintaxe não detecta esse erro de inicialização; o teste precisa importar/iniciar o módulo gerado.

## 4. Alto — login gerado ainda usa a simulação do navegador

Origens: `src/export/templates/modular/authAdapter.ts:4` e seleção do adaptador em `src/export/modular/runtime.ts`.

O backend agora cadastra usuários, verifica senha com PBKDF2 e cria sessões, mas o frontend continua recebendo `MockAuthAdapter`. Esse adaptador lê usuários de `context.store` e não autentica no gateway. O adaptador real de banco procura um token em `localStorage.flowforge_token`; o login gerado não estabelece essa sessão do servidor.

Reprodução: cadastrei um usuário pelo backend do app Clientes e Pedidos e recebi HTTP 200. Ao tentar entrar com as mesmas credenciais usando o adaptador de autenticação emitido no ZIP, recebi `E-mail ou senha incorretos`.

Correção: ligar o login/cadastro/sessão/logout do frontend ao backend/provedor configurado, usando um único contrato de sessão. Testar a sequência pela aplicação exportada: cadastrar → entrar → operação protegida → sair → operação rejeitada.

## 5. Alto — erros de integração são convertidos silenciosamente em sucesso

Origem: `src/export/modular/runtime.ts:38`; o padrão se repete em storage, tarefas, pagamentos e tempo real.

Os novos adaptadores tentam fazer a requisição, mas ignoram respostas de erro e exceções. Em seguida fabricam uma resposta de sucesso. Isso também captura cancelamentos e falhas de autenticação/rede.

Reprodução: forcei uma resposta HTTP 401 no backend de e-mail. O `MockEmailAdapter` do ZIP devolveu `{ ok: true, success: true, messageId: ... }`.

Correção: demonstração deve ser um modo explícito. Em modo real, propagar código/status/erro e seguir `onError`; nunca produzir sucesso fictício após 401, 500, timeout ou cancelamento. Mesmo quando a operação não é suportada, retornar diagnóstico claro de recurso indisponível.

## 6. Alto — subfluxo do projeto de referência não executa

Origem: `src/export/modular/runtime.ts:127`, registro emitido em `src/export/modular/workflows.ts` e referência em `src/engine/referenceProjects.ts`.

O adaptador invoca o ID da definição de subfluxo no registro de blocos do grafo principal, sem compilar/executar o corpo da definição nem vincular suas entradas. Esse registro não contém necessariamente a definição referenciada. Também falta bloquear referências inexistentes na compilação.

Reprodução: após instalar e compilar o ZIP de Clientes e Pedidos, executei `createProgram().dispatch('calc_total_pedido')`. O resultado foi `success: false` com `Fluxo não encontrado: sub_calcular_pedido`.

Correção: registrar e emitir as definições de subfluxos com bindings de entrada/saída e contexto de execução; validar referências antes de exportar. Para um app de referência, fornecer uma definição válida e testar o resultado calculado, não somente a presença do arquivo de adaptador.

## 7. Alto — presença de chave transforma checkout fictício em supostamente real

Origem: `src/export/modular/paymentsRealtime.ts:109`.

O problema de pagamento inexistente marcado como pago foi corrigido. Porém, o checkout ainda gera IDs, QR codes e URLs localmente. O campo `demo` passa a ser falso apenas porque uma variável de chave está preenchida; não há chamada ao provedor nesse caminho.

Reprodução: com uma chave sintética fornecida ao gateway local, o checkout retornou HTTP 200, um ID fabricado e `demo: false`, sem consultar serviço externo.

Correção: manter o recurso como demonstração até que o conector real crie e consulte o pagamento. Uma variável preenchida não é evidência de integração. Confirmar pagamento pelo contrato real do provedor no servidor, sem confundir estado local com confirmação externa.

## 8. Médio — webhook ignora a referência de segredo configurada

Origem: `src/export/modular/integrations.ts:98`.

A verificação HMAC agora existe, mas usa somente `FLOWFORGE_SECRET_WEBHOOK_SECRET` ou `WEBHOOK_SECRET`. O segredo escolhido na configuração do bloco/manifesto não é resolvido pelo endpoint correspondente.

Reprodução: configurei `FLOWFORGE_SECRET_AUDIT_WEBHOOK` no bloco e no ambiente e enviei uma assinatura HMAC correta para essa chave. O gateway retornou HTTP 503, `WEBHOOK_SECRET_NOT_CONFIGURED`.

Correção: localizar o webhook pelo caminho/identidade cadastrados e resolver sua referência de segredo no servidor. Testar dois webhooks com chaves distintas. Não tratar todos os endpoints/provedores como uma única configuração global.

## 9. Médio — deduplicação de webhook pode ser contornada alterando cabeçalho

Origem: `src/export/modular/integrations.ts:121`.

O ID usado para deduplicar prioriza `x-webhook-id` e `x-request-id`, que não fazem parte do corpo autenticado por esse HMAC. Isso permite reenviar o mesmo evento assinado, alterando somente um desses cabeçalhos.

Reprodução: o mesmo corpo com `id: event-one` e a mesma assinatura foi aceito duas vezes com HTTP 200, ao variar apenas `x-request-id` entre `delivery-1` e `delivery-2`.

Correção: definir a identidade do evento conforme o protocolo autenticado do provedor e manter deduplicação persistente, com política de expiração. Testar reentrega com cabeçalhos de transporte diferentes e após reinício.

## Próximos critérios de aceite

1. Corrigir autorização sobre o registro persistido e a seleção de execução real do banco.
2. Testar banco sem auth, com auth, com políticas e após reinício, usando PostgreSQL real.
3. Unificar sessão frontend/backend; verificar um fluxo autenticado completo no app exportado.
4. Garantir que respostas de erro e cancelamentos nunca sejam convertidos em sucesso simulado.
5. Fazer os subfluxos calcularem resultados verificáveis e bloquear referências ausentes.
6. Testar conectores e webhooks pelos contratos efetivos dos serviços; manter demonstrações explicitamente identificadas.

Os novos testes adicionados ao repositório ainda verificam principalmente a presença de trechos de código. Nesta reauditoria, os 244 testes passaram mesmo com os comportamentos reproduzidos acima. É necessário acrescentar testes de execução dos módulos exportados, além dos testes de estrutura e build.

Não fiz correções de código nesta etapa. Os logs e pacotes extraídos foram mantidos em diretórios temporários separados do projeto.
