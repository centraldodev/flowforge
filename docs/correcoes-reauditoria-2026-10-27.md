# Correções da reauditoria — 27/10/2026

Este registro complementa a reauditoria anterior, que permanece como histórico das falhas encontradas.

## Correções realizadas

1. O gateway de banco carrega e bloqueia o registro existente antes de avaliar a política. Campos usados para proprietário, organização e tenant não podem ser alterados pela operação comum; o tenant também é verificado contra a sessão.
2. Operações reais usam a conexão PostgreSQL configurada, aplicam migrações e propagam falhas. A falta de credencial ou banco não produz sucesso em memória.
3. O gateway de banco sem autenticação pode ser importado e criado corretamente.
4. O adaptador exportado de autenticação real chama o backend e compartilha o token com o adaptador de banco. A prévia também guarda e encaminha o token. O modo demonstração permanece explícito.
5. Adaptadores de integração propagam erros HTTP, de rede e cancelamentos. Implementações de serviços ainda indisponíveis retornam erro em modo real, sem fabricar sucesso.
6. Definições de subfluxo são emitidas e executadas com entradas e saídas próprias; referências ausentes e ciclos são diagnosticados.
7. A presença de uma chave não ativa pagamento fictício como se fosse real. A demonstração é identificada, e operações reais não implementadas retornam erro.
8. O webhook usa o segredo configurado para a rota correspondente.
9. A deduplicação usa dados do corpo autenticado e persiste marcadores no disco; alterar cabeçalhos de transporte ou recriar o gateway não aceita novamente o mesmo evento.

Os repositórios gerados também verificam nomes de campos antes de inseri-los em SQL. Testes de regressão executam os módulos gerados e cobrem autorização, ausência de credenciais, webhook, erro de integração e cálculo em subfluxo.

## Validação e limites

Uma exportação foi instalada e compilada separadamente e exercitada contra PostgreSQL 16 local: gravação e leitura após reinício do backend, rejeição de alteração por outro usuário, sessão de autenticação, webhook repetido, erros de serviços indisponíveis e execução de subfluxo.

A autenticação do backend exportado ainda mantém usuários e sessões em memória; não oferece persistência após reiniciar o processo. Google/OIDC e integrações reais de pagamento, e-mail, armazenamento e tarefas ainda precisam de conectores próprios. Não há confirmação de pagamentos em provedor externo. O webhook implementa HMAC genérico, não o protocolo específico de assinatura de cada provedor. Seus marcadores precisam de armazenamento durável compartilhado em implantação com várias instâncias; ainda não há política de expiração. Essas limitações impedem considerar o sistema pronto para qualquer tipo de aplicativo ou uso em produção.
