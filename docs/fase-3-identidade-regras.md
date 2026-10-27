# Fase 3 — Identidade e Regras de Acesso

Este documento registra a especificação, arquitetura e garantias de segurança implementadas na **Fase 3** do FlowForge, permitindo que aplicativos no-code integrem provedores reais de identidade e executem políticas de segurança estritas no servidor antes de qualquer operação sensível.

---

## 1. Princípios Arquiteturais e Segurança

1. **Separação Rígida entre Cliente e Servidor**:
   - Decisões de autenticação e autorização **nunca** são tomadas no navegador.
   - O cliente apenas transporta credenciais de forma segura e anexa o token de sessão ativo (`Bearer <token>`).
   - O servidor avalia as políticas declaradas antes de executar consultas, gravações no banco ou chamadas HTTP protegidas.

2. **Negação por Padrão (*Deny by Default*)**:
   - Qualquer tentativa de acesso a recursos protegidos sem uma política explícita de concessão (`effect: 'allow'`) é recusada imediatamente com status **403 FORBIDDEN**.
   - Se houver regras explícitas de negação (`effect: 'deny'`), elas possuem precedência absoluta sobre concessões.

3. **Proteção de Segredos**:
   - `clientSecretEnv` dos provedores de identidade usa estritamente o padrão `FLOWFORGE_SECRET_*`.
   - Nenhuma chave secreta, client secret ou hash de senha é exposto no grafo, no editor visual ou no pacote web exportado.

---

## 2. Novos Blocos e Tipos no Catálogo

### 2.1. Provedor de Identidade (`identityProvider`)
- **Natureza**: Recurso de Infraestrutura (Execução no Servidor).
- **Tipos de Provedor**:
  - `email`: Autenticação nativa por e-mail e senha com hash SHA-256 e salting.
  - `google`: Google OAuth 2.0 / OpenID Connect.
  - `oidc`: Qualquer provedor corporativo compatível com o padrão OIDC.
- **Configurações**:
  - `clientId`: Identificador público da aplicação no provedor.
  - `clientSecretEnv`: Nome da variável de ambiente com o segredo (`FLOWFORGE_SECRET_AUTH_SECRET`).
  - `domain`: Domínio ou URL base do provedor OIDC.
  - `redirectUri`: URL de retorno autorizada.
  - `sessionDurationSec`: Tempo de vida da sessão em segundos (padrão: 86400s / 24 horas).

### 2.2. Política de Acesso (`policy`)
- **Natureza**: Regra de Segurança Declarativa (Execução no Servidor).
- **Configurações**:
  - `target`: Recurso ou tabela visada (ex.: `pedidos.delete`, `usuarios.update` ou `*`).
  - `action`: Operação (`create`, `read`, `update`, `delete` ou `*`).
  - `effect`: Efeito da regra (`allow` para permitir, `deny` para bloquear).
  - `conditions`: Expressão condicional avaliada contra a sessão e o registro.
  - `errorMessage`: Mensagem personalizada exibida quando a política barrar o acesso.

### 2.3. Operadores de Condição Suportados
| Operador | Alvo Avaliado | Comportamento |
| :--- | :--- | :--- |
| `authenticated` | `user.authenticated` | Exige sessão válida e ativa no servidor. |
| `hasRole` | `user.role` | Exige papel específico (ex.: `'admin'`, `'manager'`) ou lista de papéis. |
| `isOwner` | `user.id === record[campo]` | Permite ação apenas se o usuário for o dono do registro. |
| `sameOrg` | `user.orgId === record[campo]` | Permite ação apenas se pertencer à mesma organização (multi-tenant). |
| `equals` / `notEquals` | Atributo arbitrário | Compara atributos do usuário ou do recurso. |

---

## 3. Runtime e Interpretador do FlowForge

- **Gateway de Desenvolvimento (`/__flowforge/auth`)**:
  - Embutido no servidor de desenvolvimento Vite (`vite.config.ts`).
  - Gerencia criação de contas, login, tokens de sessão e revogação imediata no logout.
- **Adaptador de Autenticação (`GatewayAuthAdapter`)**:
  - Conectado em `createDefaultAdapters()` em `src/compiler/interpreter/adapters.ts`.
  - Modo `demo`: delega para simulação rápida em memória com usuário padrão (`demo@exemplo.com`).
  - Modo `real`: envia comandos parametrizados para `/__flowforge/auth`, gravando a sessão em `context.store.__session` e disponibilizando `user` e `session` nas variáveis de saída.
  - Falhas de credenciais (401) ou violações de regras (403) direcionam o fluxo automaticamente para a porta de saída de erro (`onError`).

---

## 4. Exportação Modular (`src/export/modular/auth.ts`)

Ao exportar o projeto, a arquitetura gera artefatos dedicados e desacoplados:

1. **`packages/contracts/src/auth.ts`**:
   - Contratos TypeScript de `AuthenticatedUser`, `AuthSession`, `UserRole` e `PolicyEvaluationResult`.
2. **`apps/api/src/policies/index.mjs`**:
   - Definição estática das políticas cadastradas no editor visual.
   - Motor `authorizeRequest({ user, target, action, record })` com validação de negação por padrão.
3. **`apps/api/src/auth/gateway.mjs`**:
   - Gateway de produção independente para gerenciamento de credenciais e tokens.
   - Resolução de segredos via `process.env.FLOWFORGE_SECRET_*`.
4. **`apps/api/src/app.mjs`**:
   - Roteamento nativo integrando endpoints `/__flowforge/auth` e `/api/auth` junto aos serviços de banco e requisições HTTP.

---

## 5. Verificação e Testes

A integridade da Fase 3 é assegurada pela suíte `tests/auth-policies.test.ts`, validando:
1. Extração estrita de manifesto e diagnósticos de configuração.
2. Avaliação de regras RBAC e ownership com negação por padrão.
3. Fluxo de ponta a ponta: registro, login, expiração de sessão e revogação via logout.
4. Interceptação de tentativas de acesso não autorizado com código HTTP 403 `FORBIDDEN`.
5. Paridade entre o adaptador interpretado e a exportação modular.
