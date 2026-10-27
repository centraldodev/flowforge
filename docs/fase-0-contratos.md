# Fase 0 — Base de contratos

Implementado:

- Registro `engine/blockRegistry.ts`: metadados, versão, propriedades, portas existentes, integração simulada e matriz inicial de destinos.
- Definições de campos movidas do inspetor para o núcleo, sem dependência de React. O inspetor usa o registro comum.
- Cada propriedade é classificada como configuração de execução, editor, código legado ou propriedade sem implementação no compilador semântico. A classificação se refere ao caminho novo de compilação; o gerador legado tem comportamento próprio.
- Campos sem implementação recebem indicação no painel e diagnóstico com bloco/campo. Valores não são removidos dos projetos.
- Opções fixas inválidas impedem compilação. Predefinições continuam nos defaults do catálogo.
- Blocos recebem `contractVersion: 1` ao carregar/normalizar projetos antigos, sem alterar valores ou portas. Versões futuras são preservadas e rejeitadas na compilação.
- Exportação ZIP valida o grafo antes de gerar arquivos, em vez de entregar um programa com erro embutido.

Compatibilidade: `Graph.version` continua 1 e o formato dos valores em `config` continua textual. O esquema de propriedades agora é estruturado no registro; configurações complexas de recursos, políticas e credenciais serão introduzidas com migrações próprias nas fases correspondentes. Não foi criado um segundo formato vazio sem consumidor.

Limites: a matriz indica o suporte dos blocos atuais, não garante todas as capacidades de interface de cada plataforma. Integrações continuam simuladas e o bloco de função permanece legado. As propriedades identificadas como sem efeito foram sinalizadas, não implementadas nesta fase. Biblioteca e defaults usam o catálogo existente, referenciado pelo registro; portas continuam no módulo semântico existente.

Próxima fase: conexão HTTP real, ambiente, referências a segredos e backend exportado. Esse trabalho não faz parte desta entrega.

Validação: `npm run check` (lint, formatação, tipos e testes) e `npm run build`. Novos testes cobrem migração idempotente, preservação do grafo, completude do registro, versões futuras, indicação de propriedades sem efeito e opções inválidas.
