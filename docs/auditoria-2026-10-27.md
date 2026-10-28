# Auditoria funcional e da exportação — 27/10/2026

Estado auditado: commit `8eb1a55`. A árvore de trabalho estava limpa ao iniciar. Nenhum código de aplicação foi alterado nesta auditoria.

## Resultado

O editor compila e os 243 testes existentes passam. Isso ainda não demonstra que os aplicativos exportados estão funcionais: os três projetos de referência instalaram dependências, mas nenhum passou no build independente. Também foram reproduzidas falhas de autorização, persistência e confirmação de pagamentos nos módulos exportados.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| `npm run check` no FlowForge | Passou; 243 testes, com um aviso de dependência do hook em `Sidebar.tsx:57` |
| `npm run build` no FlowForge | Passou; aviso de tamanho de bundle |
| Instalação em diretórios temporários independentes | Passou nos três apps, sem usar o `node_modules` do editor |
| Build exportado de Clientes e Pedidos | Falhou |
| Build exportado de Agendamento | Falhou |
| Build exportado de Portal de Aprovação | Falhou |
| `npm test` nos três apps exportados | Passou, apesar dos builds falharem |
| Cadastro no gateway exportado com papel `admin` escolhido pelo cliente | Aceito, HTTP 200 |
| Escrita no gateway exportado com política de negar tudo e sem sessão | Aceita, HTTP 200 |
| Dados após criar nova instância do gateway de banco | Registro desapareceu |
| Verificação de pagamento com ID inexistente, sem provedor/chave | Retornou `status: paid`, HTTP 200 |
| Webhook sem assinatura | Aceito, HTTP 200 |
| GET `/` no app de backend sem requisição HTTP externa configurada | Retornou HTTP 404 |

Os testes de comportamento foram locais, com dados sintéticos e módulos emitidos pelo exportador. Não foram feitas cobranças nem chamadas a provedores externos. PostgreSQL real e Docker não foram executados nesta auditoria; observações sobre esses pontos distinguem inspeção de código de reprodução.

## 1. Crítico — cadastro pode atribuir administrador ao próprio usuário

Origem: `src/export/modular/auth.ts:235`, especialmente `role: payload.role || 'user'` e `orgId: payload.orgId`.

Reprodução: uma chamada não autenticada a `/api/auth/register`, com `payload.role = "admin"` e uma organização escolhida no corpo, retornou HTTP 200 e um usuário com esse papel e organização na sessão.

Impacto: quando essas sessões forem usadas para autorização, um visitante pode obter privilégios que deveriam ser concedidos pelo servidor. Corrigir apenas a interface não resolve: a API recebe o corpo diretamente.

Correção: papéis e vínculos de organização devem ser determinados por cadastro público restrito, convite ou operação administrativa autorizada. Ignorar/rejeitar campos privilegiados enviados pelo cliente e testar tentativa explícita de promoção de privilégio.

## 2. Crítico — políticas exportadas não protegem as operações de banco

Origens: `src/export/modular/server.ts:107`, `src/export/modular/database.ts:267` e `src/export/modular/auth.ts:153`.

A API despacha diretamente para `createDatabaseGateway`. O gateway de banco não autentica a sessão nem chama o autorizador antes das operações. A avaliação de política fica em um endpoint separado de verificação, cuja chamada pode ser omitida por quem acessa a API.

Reprodução: exportei um grafo com política `target: "*"`, `effect: "deny"`, operação de banco em modo real e conexão PostgreSQL. Um POST direto a `/api/db` sem sessão inseriu um registro e retornou HTTP 200.

Impacto: esconder botões ou conectar um bloco de política antes da escrita não protege o endpoint. Além disso, o gateway aceita identidade de tenant pelo cabeçalho/corpo da própria requisição, sem vinculá-la à sessão verificada.

Correção: obter usuário/tenant de sessão validada no servidor; aplicar a política dentro do caminho obrigatório de cada operação protegida; negar por padrão. Testar API diretamente, sem passar pelo fluxo visual.

## 3. Alto — todos os apps de referência exportados falham na compilação

Origem principal: `src/export/modular/workflows.ts:106`.

Os emissores declaram funções `Promise<unknown>` sem retorno obrigatório em seu corpo. Nos três projetos, `npm run build` produziu erros TS2355. O build do editor não verifica as strings de TypeScript que ele gera; por isso o problema não aparece no check principal.

O projeto Clientes e Pedidos também produziu erros TS7053/TS7006 por usar um adaptador de e-mail ausente do contrato de runtime.

Correção: alinhar a assinatura ao retorno real de cada fluxo, por exemplo `Promise<void>` quando aplicável, ou emitir retorno explícito coerente. Corrigir também os contratos/adaptadores descritos no item 4. Não usar `@ts-nocheck` para esconder os erros.

Aceite: extrair, instalar e compilar todos os projetos de referência em ambiente limpo, na CI.

## 4. Alto — novos adaptadores não estão registrados no runtime exportado

Origens: `src/export/modular/runtime.ts:43`, `src/export/templates/modular/runtimeTypes.ts:6` e emissão de chamadas em `src/compiler/backends/javascript/codegen.ts`.

O editor ganhou e-mail, armazenamento, tarefas, pagamentos, tempo real e subfluxos, mas os adaptadores padrão emitidos continuam limitados a autenticação, API, banco e delay. Os contratos públicos também só declaram esses quatro.

Impacto: corrigir apenas a tipagem do build não é suficiente. Chamadas de novos blocos podem encontrar `context.adapters.<tipo>` indefinido. No caso de subfluxos, o código gerado possui fallback que devolve as entradas quando o adaptador está ausente, sem executar a transformação esperada.

Correção: uma declaração central de capacidades deve alimentar contratos, seleção de runtime e emissores. Um bloco sem adaptador para o destino precisa bloquear a exportação, em vez de simular sucesso ou devolver a entrada silenciosamente.

## 5. Alto — banco exportado não implementa persistência real

Origens: `src/export/modular/database.ts:267`, `src/export/modular/runtime.ts:46` e `src/export/templates/modular/databaseAdapter.ts`.

O gateway gerado usa `new Map()` como armazenamento e não inicializa conexão PostgreSQL, pool ou execução de migrações. Repositórios e migrações são emitidos como arquivos, mas não são usados por esse gateway. No cliente, o emissor ainda seleciona `MockDatabaseAdapter`, que opera no contexto em memória.

Reprodução: o gateway de uma operação configurada como real aceitou inserção sem qualquer banco ou credencial configurados. A consulta encontrou o registro; uma nova instância do gateway retornou lista vazia.

Impacto: a aplicação pode aparentar salvar dados e perdê-los no reinício. A existência dos arquivos SQL e do serviço PostgreSQL no Compose não muda o caminho de execução.

Correção: emitir cliente de banco real, dependência declarada, inicialização de pool e migrações; conectar operações ao repositório; falhar quando faltar configuração. O frontend precisa usar o gateway real, com isolamento e autorização. O teste de aceite deve gravar, reiniciar o backend e consultar o mesmo registro.

## 6. Alto — confirmação de pagamento é fictícia

Origem: `src/export/modular/paymentsRealtime.ts:122` e `:137`.

O checkout fabrica identificadores aleatórios e URLs. A rota de verificação retorna `paid` independentemente do ID, sem consultar um provedor ou validar uma confirmação recebida dele.

Reprodução: GET `/api/payments/verify?id=does-not-exist-audit` retornou HTTP 200 com `status: "paid"`, sem chave ou serviço de pagamento configurado.

Impacto: se o app usar esse resultado para liberar pedido ou serviço, pode liberar algo que nunca foi pago.

Correção: até existir integração efetiva, identificar o recurso como demonstração e impedir sua exportação como pagamento real. A implementação real deve confirmar valor, moeda, pedido e status pelo provedor no servidor, com tratamento de eventos e duplicatas.

## 7. Alto — webhook aceita eventos sem verificar assinatura

Origem: `src/export/modular/integrations.ts:88`.

O gateway lê uma referência de segredo, mas não usa esse segredo para autenticar o conteúdo. Só compara assinaturas quando o próprio corpo da requisição informa `expectedSignature`. Sem esse campo, retorna sucesso mesmo sem assinatura.

Reprodução: POST de um evento sintético a `/api/webhooks/audit`, sem cabeçalhos de assinatura e sem credencial configurada, foi aceito com HTTP 200.

Correção: selecionar a configuração pelo endpoint/evento cadastrado, exigir a assinatura apropriada e verificá-la sobre o corpo original usando o segredo do servidor. O remetente não pode definir o valor esperado nem a referência de segredo usada para validar seu próprio evento. Incluir testes de ausência, alteração do corpo e repetição de evento.

## 8. Alto — backend sem integração HTTP externa não serve o frontend

Origem: `src/export/modular/server.ts:95` e `:172`.

O serviço de arquivos estáticos só é montado no ramo `hasHttp`. Um app com banco, autenticação ou outras integrações, mas sem requisição HTTP externa em modo real, monta backend e termina as demais rotas com 404.

Reprodução: um app com banco e política, sem nó HTTP real, retornou HTTP 404 para GET `/`.

Correção: servir o frontend compilado independentemente do conector HTTP externo. Separar roteamento de API, arquivos públicos e respostas de rota não encontrada.

## 9. Alto — Dockerfile não copia um script necessário ao build

Origens: `src/export/modular/deployment.ts:30` e script de build de API em `src/export/modular/project.ts`.

O estágio builder copia `packages/` e `apps/`, mas não `scripts/`. Em seguida executa o build dos workspaces; o workspace da API tenta executar `../../scripts/check-api.mjs`, ausente nessa imagem. `scripts/` só é copiado no estágio runner, depois do build.

Evidência por inspeção do Dockerfile gerado; não executei Docker. Essa falha é adicional aos erros TypeScript do item 3.

Correção: incluir os arquivos de build necessários antes do comando de build e acrescentar teste de construção real da imagem. Separar configuração local de Compose de implantação; o Compose atual também inclui senha PostgreSQL fixa e publica a porta do banco.

## 10. Médio — outras integrações ainda devolvem sucesso de demonstração

Origem: `src/export/modular/integrations.ts:34`.

Storage cria URL fictícia e guarda metadados em Map, sem enviar arquivo; e-mail adiciona um item a array, sem envio a provedor; tarefas adicionam registros em array, sem executor persistente. Esses comportamentos não comprovam as integrações anunciadas.

Correção: explicitar modo de demonstração e capacidade por destino. Só marcar como real/testado depois de executar o serviço correspondente e verificar o efeito. O mesmo cuidado vale para autenticação: o gateway exportado mantém usuários/sessões em memória e usa hash SHA-256 simples, embora o relatório de prontidão fale em PBKDF2.

## Lacuna dos testes atuais

Os testes denominados E2E em `tests/monorepo-e2e-audit.test.ts` verificam principalmente presença de arquivos e trechos de conteúdo. Eles não substituem instalação, compilação, inicialização e verificação do comportamento do pacote exportado.

Nesta auditoria, `npm test` passou nos três ZIPs mesmo quando o build falhou. Portanto, o pipeline atual permite falso positivo de conclusão de fase.

## Ordem de correção sugerida

1. Corrigir os builds exportados e registrar adaptadores/contratos completos. Adicionar build independente obrigatório dos três apps à CI.
2. Fechar os caminhos de autorização e impedir atribuição pública de privilégios antes de usar dados reais.
3. Conectar persistência PostgreSQL e identidade de verdade ao caminho exportado; verificar após reinício.
4. Bloquear confirmação fictícia de pagamento e webhooks não autenticados. Sinalizar claramente as demais integrações de demonstração.
5. Corrigir serviço estático e Docker; testar inicialização, GET da página inicial e endpoints no projeto extraído.
6. Fazer a indicação de prontidão depender dessas evidências, sem declarar um recurso concluído apenas porque o bloco, propriedade ou arquivo foi gerado.

As reproduções e logs foram mantidos em diretórios temporários separados do projeto. Não foram feitas correções de código como parte desta auditoria.
