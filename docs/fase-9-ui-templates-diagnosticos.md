# Fase 9: Templates de Apps Reais, Diagnóstico de Ambiente na UI e Refinamento do Editor

## Objetivo

Conectar as capacidades desenvolvidas nas Fases 1 a 8 diretamente à interface do usuário do editor FlowForge:
1. **Templates e Apps de Referência Canônicos na Criação**:
   - Disponibilização dos 3 apps de referência da Seção 13 do plano mestre no modal de criação (`NewProjectModal.tsx`), permitindo ao usuário iniciar tanto um canvas em branco quanto um aplicativo completo com 1 clique.
2. **Diagnóstico de Ambiente e Infraestrutura no Modal de Exportação (`ExportModal.tsx`)**:
   - Inspeção de variáveis de ambiente (`FLOWFORGE_DATABASE_URL`, `FLOWFORGE_AUTH_SECRET`, chaves Stripe/PIX), Docker multi-stage e script `check-env` antes do download do ZIP.
3. **Estilos e Design System Harmonioso (`src/styles/modals.css`)**:
   - Componentes visuais com paleta de cores consistente, badges de status, micro-animações, tags explicativas e layout responsivo.

---

## 1. Seleção de Modelos (`src/features/project/NewProjectModal.tsx`)

O modal de novo projeto agora disponibiliza quatro opções:

| Modelo | Identificador | Ícone / Cor | Recursos Inclusos |
|---|---|---|---|
| **Projeto em Branco** | `empty` | ✨ `#818cf8` | Canvas livre para modelagem do zero. |
| **Gestor de Clientes e Pedidos** | `customerOrders` | 🛍️ `#10b981` | PostgreSQL real, autenticação de sessão, CRUD persistente, cálculo de itens de pedidos e consumo de API externa com fallback. |
| **Agendamento sem Conflito** | `scheduling` | 📅 `#f59e0b` | Regras visuais de negócios, detecção e prevenção de sobreposição de horários e alertas automáticos. |
| **Portal de Aprovação por Papéis** | `roleApproval` | 🛡️ `#ec4899` | Controle de acesso baseado em funções (RBAC: Admin, Manager, User), telas protegidas e políticas de segurança. |

---

## 2. Diagnóstico de Ambiente Integrado (`src/features/project/ExportModal.tsx`)

Antes de gerar e baixar o pacote ZIP, o usuário pode inspecionar:
- **Painel de Recursos Detectados**:
  - Banco de dados PostgreSQL 16 com `docker-compose.yml`.
  - Identidade e Autenticação (RBAC, PBKDF2 e JWT).
  - Pagamentos e Cobranças (Stripe e PIX).
  - Comunicação em Tempo Real (Server-Sent Events).
- **Lista de Variáveis de Ambiente Esperadas**:
  - Nomes, categorias e descrições das variáveis de produção.
- **Dica de CLI**:
  - Orientação sobre a execução do script `node scripts/check-env.mjs` após descompactar o projeto.

---

## 3. Ações do Editor (`src/app/useEditorActions.ts`)

A função `createProject` foi expandida para aceitar `templateId?: ProjectTemplateId`:
- Clona estruturadamente o grafo do modelo selecionado sem mutação dos originais.
- Ajusta o nome do projeto conforme especificado pelo usuário.
- Seleciona automaticamente a primeira tela ativa (`screensOf(targetGraph)[0]?.id`) e centraliza a visualização no canvas.

---

## 4. Testes Automatizados (`tests/ui-templates-diagnostics.test.ts`)

- **Instanciação de Templates**: Valida que cada template canônico e projeto vazio geram grafos íntegros com seus nós característicos (PostgreSQL, Auth, API, Validadores).
- **Diagnóstico de Ambiente**: Valida que o relatório identifica corretamente dependências de banco e variáveis de ambiente obrigatórias.
- **Artefatos de Exportação**: Valida que o plano de exportação modular contém `docker-compose.yml`, `Dockerfile` e `scripts/check-env.mjs`.
- **Suíte Completa**: Total de 220 testes passando com 100% de sucesso.
