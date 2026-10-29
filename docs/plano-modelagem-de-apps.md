# Plano da área de Modelagem de Apps

Data: 29 de outubro de 2026. Status: proposta para implementação.

## 1. Objetivo e resultado esperado

Evoluir o FlowForge para permitir especificar, modelar, construir e validar uma aplicação no mesmo projeto. A área **Modelagem** terá uma barra de ferramentas e um dropdown de etapas. Cada etapa oferece formulários estruturados, validação, salvamento de rascunho, conclusão e edição posterior.

Ao concluir uma etapa executável, o editor gera ou atualiza automaticamente seus blocos, conexões e contratos. A geração ocorre no projeto; não executa alterações no banco nem publica o backend. Etapas descritivas geram documentação e referências, sem criar blocos artificiais.

O usuário deve conseguir acompanhar uma relação completa:

`Requisito → caso de uso → regra/permissão → operação/processo → blocos → backend → teste`.

## 2. Base existente e pontos de integração

Constatações da leitura do código, sem auditoria funcional de todos os recursos:

- `src/app/App.tsx` possui modos `flow`, `frontend` e `datamodel`, histórico e persistência do grafo.
- `src/engine/types.ts` concentra `Graph`, blocos e conexões. O grafo já contém `dataModel`, entidades, autenticação e cenários de teste.
- `src/engine/dataModeling.ts` contém conversão conceitual/lógica e `applyDataModelToGraph`, que cria/atualiza entidades, conexão e, opcionalmente, blocos CRUD. A identificação atual também utiliza nomes; a sincronização nova precisa de identidade estável.
- `src/engine/composition.ts` possui definições de subfluxos e coleções de validações. Essas validações de campos não cobrem, sozinhas, regras gerais de negócio.
- `src/compiler/index.ts` já normaliza, analisa e reduz o grafo para `ProgramIR`.
- `src/export/modular` contém pontos de integração para banco, autenticação, workflows, OpenAPI e testes.
- `src/engine/parse.ts` aceita projetos versão 1 e limita importação a 500 nós e 2.000 conexões. A geração deverá respeitar esses limites até uma revisão baseada em medição.

Diretriz: ampliar o pipeline existente. Não criar um segundo runtime independente para executar a modelagem.

## 3. Experiência da área de edição

### 3.1 Navegação

Navegação principal proposta: **Modelagem | Fluxos | Interface**. O editor atual de dados passa a integrar a etapa Dados, preservando um atalho para acesso direto.

Barra da Modelagem:

`[Etapas: 4/9 concluídas ▾] [Validar] [Ver alterações] [Ver blocos] [Simular cenário] [Documentação] [⋯]`

Desfazer/refazer permanecem disponíveis. Ações sem contexto ficam desabilitadas com explicação acessível. O menu adicional inclui exportar especificação, visualizar arquitetura e registros de decisões.

O dropdown mostra número, nome, estado textual e quantidade de pendências de cada etapa. Selecionar uma etapa concluída abre seu conteúdo para consulta e edição. Não usar apenas cor para indicar estado. Suportar teclado, foco visível e anúncios de validação para tecnologias assistivas.

### 3.2 Organização do editor

- Área central: formulário, tabela ou diagrama específico da etapa.
- Painel contextual: ajuda, dependências, referências e pendências.
- Rodapé: **Salvar rascunho**, **Concluir etapa** e **Próxima etapa**.
- Ao consultar uma etapa concluída: **Editar etapa** e **Ver blocos gerados**.
- Após alteração: **Aplicar alterações** mostra o impacto e reconcilia os artefatos.

Campos simples utilizam formulários; decisões utilizam tabelas; processos e estados utilizam diagramas. Não obrigar o usuário a desenhar informações que são mais fáceis de preencher em uma tabela.

### 3.3 Estados e conclusão

Separar duas dimensões:

| Dimensão | Estados |
|---|---|
| Preenchimento | Não iniciada, Em edição, Concluída, Não se aplica |
| Consistência com dependências e geração | Pendente, Atualizada, Requer revisão, Bloqueada |

Exemplo no dropdown: **✓ Regras de negócio — requer revisão**. A conclusão anterior permanece registrada, mas a etapa deixa de contar como pronta na revisão geral enquanto houver impedimentos.

Uma etapa fica concluída quando os campos obrigatórios estão válidos, as referências existem e sua geração foi aplicada com sucesso. Avisos não impeditivos podem permanecer visíveis. Etapas opcionais podem ser marcadas como Não se aplica com justificativa; uma referência ativa a seus elementos impede essa dispensa.

O progresso considera etapas aplicáveis, distinguindo concluídas válidas de concluídas que precisam de revisão. **Modelagem concluída**, **grafo válido** e **aplicação apta à exportação** são indicadores diferentes.

Rascunhos são persistidos sem modificar o grafo executável. Editar uma etapa já aplicada cria uma revisão de trabalho; a última versão aplicada continua disponível para simulação e exportação, explicitamente identificada. A publicação não pode aparentar incluir alterações ainda em rascunho.

## 4. Etapas guiadas

O dropdown apresenta uma ordem recomendada. É permitido antecipar etapas e usar referências provisórias, mas sua conclusão exige resolver as dependências necessárias. Não é um assistente linear que bloqueia a navegação.

| Etapa | Informações principais | Saída e critério de conclusão |
|---|---|---|
| 1. Visão e escopo | Problema, público, objetivos, limites do MVP, requisitos e critérios de aceitação | Especificação com IDs e critérios verificáveis; nenhuma operação gerada |
| 2. Domínios e casos de uso | Glossário, módulos, atores, ações, entradas, resultados e exceções | Catálogo de casos de uso vinculado aos requisitos; contratos preliminares, ainda sem endpoints ativos |
| 3. Dados | Entidades, campos, tipos, relações, obrigatoriedade, unicidade, propriedade e isolamento por organização | Modelo conceitual/lógico válido, blocos de entidade/conexão e proposta de migração |
| 4. Identidade e permissões | Identidade, papéis, recursos, ações e escopo: próprio, equipe, organização ou global | Políticas válidas e blocos de autorização; operações protegidas só ficam prontas com vínculo de política |
| 5. Regras e decisões | Entradas tipadas, condições, resultado, prioridade, exceções e exemplos | Regras reutilizáveis executáveis; decisões sem cobertura ou com conflito impedem conclusão conforme estratégia escolhida |
| 6. Estados e ciclo de vida | Estado inicial/finais, transições, ator, condições e efeitos | Contratos de transição e blocos de validação; estados e transições referenciados devem existir |
| 7. Operações e processos | Gatilhos, ordem das atividades, chamadas, responsáveis, transações, erros, prazos e esperas | Fluxos backend e conexões explícitas; entradas, saídas e caminhos de erro resolvidos |
| 8. APIs, eventos e integrações | Rotas, métodos, schemas, autenticação, eventos, webhooks, timeout, repetição e idempotência | Adaptadores e contratos; nenhuma URL, permissão ou credencial presumida |
| 9. Cenários e revisão | Exemplos positivos, negativos, acesso negado, estados inválidos e requisitos de qualidade | Testes vinculados e relatório de cobertura; nenhuma referência ou geração impeditiva pendente |

### 4.1 Regras de negócio

Suportar inicialmente validações e decisões puras: comparação, combinação booleana, cálculos tipados e consulta a dados explicitamente fornecidos pelo processo. Regras não enviam e-mail nem alteram o banco; produzem uma decisão que o processo utiliza.

Cada regra possui ID, nome, domínio, requisitos associados, parâmetros, expressão estruturada, saída/erro e exemplos. O editor visual gera uma árvore de expressão tipada; texto livre é explicação, não código executável.

Tabelas de decisão devem declarar estratégia: resultado único, primeira correspondência ou múltiplos resultados. Detectar sobreposição e ausência de caso padrão quando exigido. Não anunciar compatibilidade DMN completa no primeiro recorte.

### 4.2 Permissões e segurança

Toda operação declara acesso público ou uma política explícita. A ausência de política não libera acesso. O servidor obtém identidade, papel e organização da sessão validada, sem confiar em campos enviados pelo frontend.

O filtro por proprietário/organização deve alcançar leituras, escritas, relações e operações em lote. Condições por registro exigem suporte no gateway, não apenas um bloco que verifica papel. Esconder um botão melhora a interface, mas a autorização permanece obrigatória no backend.

### 4.3 Estados e processos

Transições verificam estado atual e condições no servidor. Atualização de estado e efeitos locais de banco devem ser atômicos; concorrência utiliza versão ou condição de atualização para impedir duas aprovações incompatíveis.

Começar por processos síncronos: entrada → autorização → validação → decisão → operação → resultado/erro. Esperas humanas, temporizadores duráveis e compensações entram depois, com persistência da instância, retomada, correlação e política de repetição. Não simular durabilidade com um `delay` em memória nem chamar um subconjunto de BPMN completo.

## 5. Ferramentas complementares

Disponíveis pela barra e por referências das etapas, sem aumentar artificialmente os passos obrigatórios:

- **Arquitetura C4:** contexto e aplicações/serviços/bancos; dependências locais derivadas dos contratos e elementos externos declarados pelo usuário.
- **UML:** sequência derivada de processos e estados derivada do ciclo de vida. Diagramas derivados apontam aos elementos de origem para edição. Visões conceituais devem ser distinguidas de uma representação exata da implementação.
- **Jornadas e telas:** vincular caso de uso, tela, ação e operação. Gerar formulários ou botões só quando solicitado e com destino explícito.
- **Decisões arquiteturais:** contexto, decisão, alternativas, consequências, responsável e estado de substituição.
- **Qualidade:** metas de latência/disponibilidade, auditoria, recuperação e retenção. Uma meta cadastrada não equivale a uma garantia implementada; registrar evidência e medição separadamente.
- **Rastreabilidade:** navegar em ambas as direções entre modelo, bloco, contrato e teste; identificar requisitos sem implementação ou cobertura.

## 6. Modelo de projeto e arquitetura de geração

### 6.1 Fonte de verdade

Adicionar um agregado versionado de modelagem ao projeto. Separar modelo de trabalho, modelo aplicado e manifesto de geração. Esboço conceitual, a detalhar na fase de contratos:

```ts
type AppModeling = {
  schemaVersion: number;
  draft: AppSpecification;
  applied: AppSpecification | null;
  steps: ModelingStepRecord[];
  generation: GenerationManifest;
};
```

`AppSpecification` contém requisitos, domínios, casos de uso, referências ao modelo de dados, políticas, regras, ciclos de vida, operações, processos, contratos e cenários, todos com IDs estáveis. Não duplicar o conteúdo de dados em dois locais editáveis: definir o adaptador do `dataModel` atual e uma única autoridade por elemento durante a migração.

O manifesto registra versão do gerador, revisão aplicada, hashes semânticos, IDs de artefatos gerados, origem e última base gerada. Status de validade é recalculado por validadores; um `completed: true` importado não comprova consistência.

### 6.2 Pipeline

`Rascunho → validação estrutural/semântica → especificação resolvida → plano de artefatos → comparação/reconciliação → commit do grafo → compilador existente → backend/exportação`.

A especificação resolvida funciona como contrato entre modelagem e geração. Não precisa substituir a `ProgramIR`: esta continua descrevendo a execução compilada do grafo. Cada novo recurso executável precisa de suporte no catálogo, portas, análise, IR quando necessário, interpretador e exportadores.

O planejamento da geração é puro e determinístico: mesma entrada e mesma versão produzem os mesmos IDs, configurações e conexões. Horários e posição visual não entram no hash semântico.

### 6.3 Como surgem os blocos e conexões

| Elemento modelado | Representação prevista |
|---|---|
| Requisito, glossário, decisão arquitetural | Metadados, documentação e referências |
| Entidade/relação | `entity`, conexão de banco e contratos de dados |
| Permissão | `policy` e guard obrigatório na operação do servidor |
| Regra | Subfluxo reutilizável de validação/decisão, ou novo tipo registrado quando a semântica exigir |
| Transição de estado | Operação parametrizada com validação e persistência condicional |
| Caso de uso implementado | Subfluxo de operação com entradas e saídas tipadas |
| Processo | Composição de operações, decisões, resultados e tratamento de erros |
| API/webhook/tarefa | Gatilho e binding explícito a uma operação, conforme suporte implementado |
| Cenário de aceitação | Definição de teste e referências aos artefatos exercitados |

Concluir Dados disponibiliza recursos; não cria automaticamente todas as operações CRUD nem as expõe como rotas públicas. Concluir Regras cria componentes reutilizáveis. Concluir Operações/Processos conecta esses componentes conforme os vínculos preenchidos pelo usuário.

Autoconexão exige IDs de origem/destino, operação, campo, direção e tipos compatíveis. Não inferir pelo nome ou pela proximidade visual. Dependência ausente gera pendência, nunca uma conexão plausível inventada.

### 6.4 Organização visual

Separar **Recursos**, **Regras**, **Operações** e **Processos** em visões/subfluxos filtráveis, evitando um único canvas com centenas de nós. Mostrar blocos gerados com selo de origem e ação **Editar na modelagem**.

Preservar posições, agrupamentos e conexões manuais compatíveis nas atualizações. Reaplicar layout somente aos elementos novos ou mediante ação explícita. Subfluxos internos precisam participar da contagem de limites e da análise de desempenho.

## 7. Atualização, conflitos e exclusões

Ao concluir uma etapa válida, aplicar automaticamente gerações sem conflito ou destruição. Mostrar um resumo com criados, atualizados e referências afetadas. Concluir e gerar constituem uma única transação de histórico.

Regras de reconciliação:

1. IDs são derivados da identidade do modelo e da função do artefato; renomear não cria outra entidade.
2. Repetir a geração não duplica nós ou conexões.
3. Configurações geradas pertencem ao modelo. Layout e propriedades visuais continuam editáveis no canvas.
4. A edição semântica de um bloco gerado abre o modelo correspondente. Para personalização avançada, oferecer **Desvincular da geração**, mostrando dependências e passando o componente ao controle manual.
5. Usar comparação de três versões: última base gerada, grafo atual e nova geração. Divergência semântica inesperada vira conflito com opções de resolução; nenhuma sobrescrita silenciosa.
6. Apagar um elemento referenciado abre análise de impacto. Permitir cancelar, substituir referências ou remover os dependentes listados; não deixar conexões quebradas.
7. Alterar tipo, remover campo ou restringir permissão marca os consumidores efetivamente afetados como Requer revisão. Propagação usa dependências semânticas; mudar uma descrição não invalida o backend.
8. Desfazer restaura modelo aplicado, grafo e manifesto juntos. Desfazer no editor não reverte migrações já executadas em um banco externo.

Migrações destrutivas são propostas para revisão e execução separada, com orientação de preservação de dados. Concluir modelagem nunca apaga tabelas reais.

## 8. Backend, exportação e simulação

Cada operação gerada declara parâmetros, saída, erros, política, regras, entidades, transação e possíveis efeitos externos. O fluxo backend aplica autenticação/autorização, validação e regras antes de executar efeitos, com ordenação específica por operação e sem expor dados protegidos nas verificações.

- Gateway deve validar chamadas diretas, inclusive quando não vêm das telas geradas.
- Escritas relacionadas usam transação. Efeitos externos exigem estratégia explícita de idempotência e recuperação; quando necessário, outbox e processamento posterior, sem prometer atomicidade entre banco e provedor externo.
- Credenciais continuam sendo referências de ambiente. A modelagem armazena configuração pública e referências, nunca segredos.
- OpenAPI deve refletir rotas efetivamente disponíveis, schemas, autenticação e erros, sem publicar contratos ainda não implementados.
- Simulação e aplicação exportada usam a mesma semântica de regras. Dados simulados e efeitos externos fictícios precisam estar identificados.
- Revisões aplicadas e versão do gerador acompanham a exportação para permitir rastreamento.
- Suporte por destino deve ser explícito: estabelecer TypeScript/backend modular como primeiro alvo; recursos ainda indisponíveis em Python geram diagnóstico impeditivo para esse destino, sem degradação silenciosa.

## 9. Compatibilidade e persistência

Projetos antigos continuam abrindo e executando. Ausência de modelagem significa projeto manual, sem alteração automática dos blocos existentes.

A migração deve importar dados já estruturados como proposta e permitir adoção seletiva dos artefatos. Blocos manuais não passam a ser gerenciados só porque possuem nomes parecidos. Usar IDs, referências e revisão das ambiguidades.

Definir versão própria de modelagem e migrações explícitas. Manter `Graph.version = 1` somente enquanto o contrato continuar retrocompatível; mudanças incompatíveis exigem nova versão e importador de migração. Validar formato, referências, limites e expressões também na importação JSON.

Salvar rascunho, aplicado e manifesto em conjunto. Exibir erros de quota/serialização sem descartar o trabalho e manter download de recuperação. Se o tamanho superar a capacidade prática de localStorage, migrar o documento para IndexedDB com estratégia de recuperação; não incluir colaboração em tempo real como dependência desta entrega.

## 10. Plano de implementação e critérios de aceite

### Fase 0 — Contratos e desenho da experiência

Entregas: schemas, mapa de dependências, estados das etapas, wireframes, matriz de suporte por runtime e decisões arquiteturais. Definir formas de subfluxos, gatilhos e políticas após validar sua compatibilidade real com interpretador e exportação.

Aceite: um exemplo de ponta a ponta representável sem nomes mágicos; critérios de geração, atualização e erro documentados; nenhum requisito de backend tratado apenas como interface.

### Fase 1 — Estrutura da área e persistência

Entregas: modo Modelagem, barra, dropdown, formulários de Visão/Domínios, rascunho/aplicado, status, validação, histórico e importação/exportação.

Aceite: fechar e reabrir preserva o preenchimento; editar uma etapa concluída mantém a revisão aplicada até nova aplicação; projetos antigos continuam abrindo.

### Fase 2 — Geração incremental e adoção do modelo de dados

Entregas: especificação resolvida, manifesto, plano de alterações, reconciliação, navegação modelo↔bloco e adaptação de `applyDataModelToGraph` ao mecanismo comum.

Aceite: repetir aplicação não duplica; renomear preserva IDs e relações; mover nós não causa conflito; excluir campo referenciado exige resolução; uma aplicação pode ser desfeita integralmente.

### Fase 3 — Permissões, regras e operações síncronas

Entregas: matriz de acesso, expressões tipadas, decisões, contratos de operação e composição backend. Implementar os vínculos mínimos da etapa Processos para exercitar regras no servidor.

Aceite: dois usuários de organizações diferentes não acessam dados um do outro; chamada direta sem permissão falha; regras aceitas e rejeitadas apresentam o mesmo resultado em simulação e exportação.

### Fase 4 — Estados e processos

Entregas: editor de ciclo de vida, transições concorrentes seguras, processos síncronos completos e caminhos de erro. Processos duráveis ficam em subfase própria, com armazenamento e retomada antes de liberar esperas humanas.

Aceite: transição inválida falha; duas tentativas concorrentes não aprovam duas vezes; falha intermediária não deixa gravação parcial. Na subfase durável, reiniciar o servidor não perde a instância.

### Fase 5 — Integrações, contratos e cenários

Entregas: bindings de API/eventos, configuração explícita de repetição/idempotência, OpenAPI derivado e geração de testes baseada em cenários.

Aceite: endpoint exportado aplica políticas e regras; reenvio de requisição idempotente não duplica efeito; teste altera o resultado quando uma regra é violada. Comparar implementação exportada aos exemplos esperados, sem limitar testes a snapshots dos nós gerados.

### Fase 6 — Arquitetura e revisão profissional

Entregas: C4, sequência, jornadas vinculadas, ADRs, matriz de rastreabilidade, revisão de qualidade e filtros para projetos maiores.

Aceite: alteração relevante aponta consumidores e cenários afetados; diagramas derivados acompanham a revisão aplicada; requisitos sem implementação aparecem na revisão final.

### Fase 7 — Consolidação e lançamento

Entregas: migrações de projetos reais, acessibilidade, documentação e exemplos guiados. Medir desempenho com grafos próximos aos limites atuais antes de ampliá-los.

Aceite: fluxo completo funciona no editor e no projeto exportado com banco real; persistência e recuperação verificadas; verificações de lint, formatação, tipos, testes pertinentes e build aprovadas.

## 11. Cenário de referência obrigatório

Usar **aprovação de pedidos por organização** como exemplo integrado:

1. Requisito: vendedor solicita aprovação e gerente da mesma organização decide.
2. Dados: Pedido, Item, Usuário e Organização; valor monetário com representação exata definida, sem cálculo financeiro em ponto flutuante genérico.
3. Permissões: vendedor consulta seus pedidos; gerente aprova os da organização; nenhuma aprovação pelo próprio solicitante quando a regra exigir segregação.
4. Regra: pedidos de até R$ 5.000 seguem o caminho normal; acima disso exigem aprovação gerencial.
5. Estados: Rascunho → Em análise → Aprovado/Rejeitado; submissão e aprovação são operações distintas.
6. Backend: autenticar → verificar escopo e política → validar dados/estado → avaliar regras → persistir atomicamente → retornar resultado.
7. Contrato: endpoint de submissão e endpoint de aprovação vinculados às respectivas operações.
8. Testes: limites de R$ 5.000, acesso de outra organização, autoaprovação proibida, aprovação concorrente, entrada inválida e erro de persistência.
9. Edição: mudar limite para R$ 10.000 atualiza a regra existente e sinaliza cenários afetados, preservando identidade e layout dos blocos.

## 12. Recorte da primeira versão utilizável

Entregar fases 0–3 com processos síncronos mínimos e os testes necessários: dropdown, conclusão/edição, dados existentes integrados, permissões, regras e operações geradas de forma incremental. Esse recorte já deve exportar um backend que execute o cenário suportado com segurança.

Estados avançados, processos duráveis, C4/UML completos e colaboração multiusuário entram nas fases posteriores. IA pode auxiliar no preenchimento no futuro, sempre apresentando propostas revisáveis; não é dependência da geração determinística.

O sucesso da entrega se mede por: modelar uma operação uma vez, produzir blocos utilizáveis, executar o comportamento no servidor e conseguir editar a especificação sem perder trabalho manual ou divergir silenciosamente do backend.
