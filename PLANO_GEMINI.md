# Plano de evolução do FlowForge para um compilador visual multi-linguagem

Este documento deve ser executado por fases. Não entregue todas as fases ao Gemini de uma vez. Copie primeiro o **Prompt-base**, depois somente o prompt da fase atual. Revise o relatório e o diff antes de autorizar a fase seguinte.

## Objetivo do produto

Transformar o FlowForge em uma plataforma visual na qual blocos e conexões descrevem uma aplicação de forma independente de linguagem. A mesma definição deve:

1. ser validada estrutural e semanticamente;
2. funcionar na simulação do editor;
3. gerar uma aplicação JavaScript/TypeScript funcional;
4. posteriormente gerar Python e outras linguagens com comportamento equivalente;
5. continuar usando adaptadores fictícios para banco, OAuth e APIs enquanto preservar o comportamento esperado de integrações reais.

O objetivo imediato não é suportar literalmente qualquer software. O objetivo é construir uma arquitetura extensível, testável e independente de linguagem para ampliar progressivamente os tipos de aplicação suportados.

---

## Prompt-base para todas as fases

Cole este texto no início de cada nova conversa com o Gemini:

```text
Você está trabalhando no repositório FlowForge. Antes de editar qualquer arquivo:

1. Leia README.md, package.json e todos os arquivos relevantes em src/engine, src/state, src/export e tests.
2. Execute git status --short e preserve integralmente alterações preexistentes do usuário.
3. Execute npm run check para registrar a linha de base.
4. Não reescreva o projeto inteiro, não troque React Flow, React, Vite ou o sistema de testes.
5. Não remova funcionalidades, blocos, portas ou formatos exportados para fazer testes passarem.
6. Não altere APIs públicas sem criar migração ou compatibilidade com Graph version 1.
7. Não use any para contornar o TypeScript e não desative regras de lint.
8. Não afirme que algo funciona apenas porque o código compila. Crie testes comportamentais.
9. Mantenha simulação e geradores separados da interface React.
10. Todo texto proveniente da configuração do usuário deve ser serializado de forma segura; nunca o concatene diretamente como literal de código.
11. Ao terminar, execute npm run check e apresente: arquivos alterados, decisões, testes adicionados, comandos executados, resultado e limitações restantes.
12. Pare se descobrir que a fase exige uma mudança arquitetural fora do escopo. Explique antes de implementá-la.

Trabalhe somente na fase fornecida depois deste prompt. Não antecipe fases futuras.
```

## Regra de aprovação entre fases

Uma fase somente está concluída quando:

- `npm run check` termina com código zero;
- os testes antigos continuam passando;
- existem testes novos para o comportamento alterado;
- o diff não contém refatorações alheias à fase;
- o Gemini demonstra o critério de aceite com saída de teste, e não apenas com explicação.

Se algum item falhar, solicite correção na mesma fase.

---

# Fase 0 — Linha de base e testes de caracterização

## Finalidade

Congelar o comportamento atual antes da mudança arquitetural e expor divergências conhecidas.

## Prompt da fase

```text
FASE 0: crie testes de caracterização, sem alterar o comportamento de produção.

Adicione uma matriz de testes cobrindo todos os Kind atuais: screen, button, input, function, condition, auth, database, api, error, navigate, notify, state, validator, switch e delay.

Para cada bloco aplicável, registre:
- comportamento do interpretador run();
- comportamento do JavaScript de generateProjectCode()/executeProjectCode();
- portas padrão e conexões aceitas;
- caminhos de sucesso e erro;
- dados transmitidos ao próximo bloco.

Adicione casos específicos para:
- aspas simples, aspas duplas, barra invertida, quebra de linha, Unicode e template literal em labels/configurações;
- ciclos;
- conexão de dados incompatíveis;
- porta personalizada;
- cadeia contendo bloco assíncrono;
- onError de API e banco;
- mais de uma conexão tentando usar a mesma porta.

Testes que documentam bugs conhecidos podem usar test.todo com uma descrição precisa. Não altere run.ts, codeGen.ts ou exportadores nesta fase, salvo ajuste estritamente necessário para tornar o código testável e previamente explicado.

Crie também uma tabela Markdown em docs/compatibility-baseline.md com linhas por bloco e colunas: simulação, JavaScript, TypeScript/React exportado e Python exportado. Use os estados completo, parcial, ausente e divergente, sempre com referência ao teste correspondente.
```

## Critérios de aceite

- Todos os 15 tipos atuais aparecem na matriz.
- Bugs conhecidos estão representados por testes falhando de forma controlada ou `test.todo`.
- Nenhuma lógica de produção foi silenciosamente modificada.

---

# Fase 1 — Correções urgentes do gerador JavaScript

## Finalidade

Fazer o gerador emitir JavaScript sintaticamente seguro e previsível antes da introdução da IR.

## Prompt da fase

```text
FASE 1: corrija somente segurança de emissão, ciclos e erros assíncronos do JavaScript gerado.

Requisitos:
1. Crie uma função central para emitir literais JavaScript a partir de dados, baseada em JSON.stringify ou equivalente seguro.
2. Substitua interpolações inseguras de label, message, URL, table, target, compare, value, rule, param e demais configurações.
3. Garanta sintaxe válida para aspas, quebras de linha, barras, Unicode, ${...} e sequências maliciosas.
4. Adicione um contexto de execução compartilhado ao código gerado com limite configurável de passos. Ciclos devem produzir erro descritivo, sem RangeError por estouro de pilha.
5. Preserve corretamente Promises ao atravessar function, condition, validator, switch, database, api e delay. Não avalie Promise como booleano.
6. Gere try/catch real para API e banco, encaminhando falhas pela saída onError quando conectada e relançando quando não estiver conectada.
7. Não transforme a API fictícia em chamada real nesta fase. O modo padrão deve usar config.mock, igual à simulação. Se existir modo real, ele deve ser explícito na configuração.
8. Não esconda erros do bloco function. Retorne/encaminhe erro de maneira observável.

Converta os test.todo correspondentes da fase 0 em testes normais. Adicione teste que compile todo código gerado usando new Function e execute os caminhos relevantes.
```

## Critérios de aceite

- `d'água`, quebras de linha e `${process.exit()}` não quebram nem injetam código.
- Um ciclo produz erro controlado.
- API simulada não faz acesso de rede.
- Falhas assíncronas chegam a `onError`.

---

# Fase 2 — Definição formal de portas e conexões

## Finalidade

Substituir heurísticas baseadas em nomes de handles por metadados semânticos.

## Modelo desejado

Cada porta precisa declarar, no mínimo:

```ts
type PortMode = 'control' | 'data' | 'error';
type PortCardinality = 'one' | 'many';

type ValueType =
  | { kind: 'any' }
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'null' }
  | { kind: 'error' }
  | { kind: 'object'; name?: string }
  | { kind: 'array'; item: ValueType }
  | { kind: 'union'; members: ValueType[] };

type PortDefinition = {
  id: string;
  name: string;
  direction: 'input' | 'output';
  mode: PortMode;
  valueType?: ValueType;
  cardinality: PortCardinality;
  required?: boolean;
};
```

## Prompt da fase

```text
FASE 2: implemente definição formal de portas e validação de conexões.

Não use nomes como onClick, listener, then ou prefixo on para inferir a categoria de uma porta. O catálogo deve declarar explicitamente mode, direction, cardinality e valueType.

Requisitos:
1. Introduza os novos tipos de porta de maneira compatível com grafos version 1.
2. Implemente normalização/migração de portas antigas ao carregar o grafo.
3. Valide direção, modo, tipo e cardinalidade.
4. Tipos idênticos conectam; any conecta explicitamente; arrays verificam item; unions verificam membros; object nominal deve respeitar name quando fornecido.
5. Uma porta control/many pode ter vários consumidores. Uma porta data/one aceita um consumidor ou origem conforme a semântica declarada. Não substitua conexões silenciosamente: retorne erro claro quando a cardinalidade for excedida.
6. Portas personalizadas devem exigir mode, cardinality e tipo quando forem de dados.
7. Atualize canvas, inspetor, persistência, validação e testes.
8. Mantenha leitura de projetos antigos.

Adicione testes unitários de compatibilidade de tipos, fan-out, limite de cardinalidade e migração de grafo antigo.
```

## Critérios de aceite

- A validação não depende de substrings do ID da porta.
- `User -> number` é rejeitado com mensagem localizada nos dois blocos/portas.
- Fan-out funciona apenas onde declarado.
- Projetos antigos continuam abrindo.

---

# Fase 3 — IR semântica independente de linguagem

## Finalidade

Criar uma representação intermediária que seja a fonte comum para simulação e geração de código.

## Prompt da fase

```text
FASE 3: introduza uma IR semântica, preservando a UI e o formato Graph existente como formato de autoria.

Crie uma pasta src/compiler com camadas distintas:
- normalize: migra e normaliza Graph;
- analyze: resolve símbolos, tipos, escopos, cardinalidade e alcançabilidade;
- ir: tipos da representação intermediária;
- lower: converte blocos/conexões para IR;
- diagnostics: erros e avisos estruturados.

A IR não pode conter JSX, código JavaScript textual nem nomes específicos como onClick. Ela deve representar conceitos como:
- literal e leitura de entrada;
- atribuição/leitura de estado;
- chamada de operação;
- sequência;
- branch condicional;
- switch;
- retorno;
- navegação;
- notificação;
- delay;
- try/catch;
- chamada de adaptador para auth, api e database.

O resultado da compilação deve ser Result<ProgramIR, Diagnostic[]>; não lance exceção para erro normal de autoria.

Implemente lowering para todos os Kind atuais. Portas personalizadas somente podem alterar o fluxo quando possuírem semântica declarada; não invente comportamento a partir do nome.

Ainda não remova run.ts nem codeGen.ts. Adicione testes snapshot estruturais da IR e testes de diagnóstico para grafos inválidos.
```

## Critérios de aceite

- Todos os tipos atuais geram IR ou diagnóstico explícito.
- A IR não inclui JavaScript arbitrário.
- Um grafo inválido nunca chega ao gerador.
- Diagnósticos contêm código, severidade, nodeId, portId e mensagem.

---

# Fase 4 — Interpretador único da IR

## Finalidade

Fazer a prévia executar exatamente a mesma semântica usada pelos geradores.

## Prompt da fase

```text
FASE 4: implemente um interpretador da ProgramIR e migre a simulação para ele.

Requisitos:
1. O interpretador deve ser assíncrono.
2. Deve possuir ExecutionContext com inputs, store, screen, outputs, notifications, logs, stepCount, maxSteps, abort signal e adaptadores.
3. Auth, API e database devem ser interfaces injetáveis. Forneça adaptadores mock determinísticos como padrão.
4. Delay deve ser injetável/testável sem tornar a suíte lenta.
5. Erros devem seguir a semântica try/catch/onError da IR.
6. Remova do caminho de execução normal o new Function. Para compatibilidade, bloco function com JavaScript legado deve ser marcado unsafe/legacy e isolado, com diagnóstico.
7. Migre useSimulation e a prévia para compile Graph -> IR -> interpret IR.
8. Mantenha run() temporariamente como adaptador deprecated se os testes/API ainda dependerem dele.

Crie testes de equivalência entre run legado e IR para os cenários suportados. Qualquer diferença intencional deve ser documentada e testada.
```

## Critérios de aceite

- A prévia usa a IR.
- Toda execução assíncrona é aguardada.
- Adaptadores mock não acessam rede ou serviços externos.
- Cancelamento e limite de passos possuem testes.

---

# Fase 5 — Gerador JavaScript/TypeScript a partir da IR

## Finalidade

Eliminar a geração baseada diretamente nos nomes dos blocos e conexões.

## Prompt da fase

```text
FASE 5: substitua o gerador JavaScript baseado em Graph por um backend baseado exclusivamente em ProgramIR.

Requisitos:
1. Crie src/compiler/backends/javascript.
2. Separe emissão de AST/documento da formatação final. Não monte programas usando substituição frágil em templates.
3. Todos os identificadores devem passar por uma tabela de símbolos que resolva colisões e palavras reservadas.
4. Todos os valores devem usar emissão segura de literais.
5. Gere runtime pequeno para contexto, adaptadores, limite de passos, logs e erros.
6. O resultado deve oferecer uma API estável para iniciar eventos e consultar estado/tela/notificações.
7. Atualize o app React exportado para executar o módulo gerado, e não run(graph).
8. graph.json pode permanecer no ZIP como fonte/metadado, mas não deve ser o motor de execução do app exportado.
9. Remova workflow/screen files redundantes ou explique e teste a finalidade de cada um. Não exporte artefatos mortos.

Adicione um teste end-to-end que crie o ZIP TypeScript, extraia em diretório temporário, execute npm install de maneira controlada se dependências estiverem disponíveis, rode npm run build e execute fluxos do runtime gerado. Se a instalação não for adequada no CI, pelo menos compile o projeto exportado contra dependências locais e documente a estratégia.
```

## Critérios de aceite

- O React exportado importa e usa o programa compilado.
- Não importa o interpretador do editor para executar o fluxo.
- Projeto exportado passa no próprio typecheck/build.
- Resultado do JS coincide com o interpretador da IR nos testes dourados.

---

# Fase 6 — Python com paridade real

## Finalidade

Trocar o interpretador Python desatualizado por um backend da mesma IR.

## Prompt da fase

```text
FASE 6: reimplemente a exportação Python a partir da ProgramIR.

Não traduza JavaScript para Python. Traduza a mesma IR usada pelo backend JavaScript.

Requisitos:
1. Crie src/compiler/backends/python.
2. Suporte todos os Kind atuais por meio das operações correspondentes da IR.
3. Remova do template referências mortas a textarea, select, checkbox, constant, validation, transform, math, reset e class, salvo se esses blocos forem formalmente reintroduzidos no catálogo em fase posterior.
4. Use async/await quando necessário ou gere um runtime coerente e documentado.
5. Emita literais e identificadores Python de forma segura.
6. Forneça os mesmos adaptadores mock de auth, API e banco, com os mesmos fixtures e resultados observáveis.
7. Separe runtime/lógica da camada Tkinter. A interface deve chamar o programa compilado.
8. Gere requirements somente se houver dependências externas.

Crie testes dourados que executem o JavaScript e o Python gerados para o mesmo conjunto de grafos e comparem: resultado, tela, store normalizado, notificações e classe/código de erro. Use child_process para executar Python em diretório temporário.
```

## Critérios de aceite

- Python não contém cases para blocos inexistentes.
- Todos os blocos atuais têm paridade comprovada.
- O app Python exportado inicia sem erro e executa os fluxos dourados.

---

# Fase 7 — Linguagem visual sem JavaScript manual

## Finalidade

Reduzir a dependência do bloco `function` e tornar projetos portáveis entre linguagens.

## Novos blocos prioritários

1. literal/constant;
2. object e array;
3. get-property e set-property imutável;
4. math;
5. text operations;
6. date/time;
7. compare;
8. boolean operations;
9. map, filter, reduce e find;
10. loop/for-each;
11. subflow/function visual;
12. return;
13. parallel e join;
14. try/catch/finally.

## Prompt da fase

```text
FASE 7: implemente linguagem visual portável, sem adicionar mais JavaScript textual.

Primeiro escreva uma proposta curta de extensão da IR e do sistema de tipos. Depois implemente os blocos em pequenos lotes, começando por constant, object, array, math, text, compare e boolean.

Para cada novo bloco:
- defina portas tipadas e cardinalidade;
- defina lowering para IR;
- implemente no interpretador;
- implemente nos backends JavaScript e Python;
- exponha no catálogo e inspetor;
- adicione testes unitários e dourados cross-language;
- documente exemplos.

Não implemente map/filter/reduce/loop/subflow/parallel até o primeiro lote estar aprovado. Não use eval/new Function para implementar expressões.

Mantenha o bloco function legado, mas marque-o como incompatível com exportação multi-linguagem quando contiver código textual. O compilador deve emitir diagnóstico claro antes da exportação Python.
```

## Critérios de aceite

- Um fluxo de transformação comum pode ser criado sem escrever código.
- O mesmo grafo roda em JS e Python.
- Bloco legado incompatível bloqueia exportação com diagnóstico, em vez de gerar programa incorreto.

---

# Fase 8 — Catálogo de UI e layout

## Finalidade

Permitir aplicações além de formulários lineares.

## Prompt da fase

```text
FASE 8: introduza uma árvore declarativa de interface separada do grafo de comportamento.

Não represente layout apenas pela posição dos blocos no canvas. Defina ScreenUI/ComponentTree com filhos, propriedades, bindings, eventos e estilos responsivos.

Implemente primeiro:
- container com flex/grid;
- text;
- image;
- input e textarea;
- select, checkbox e radio;
- button;
- list/repeater com item binding;
- conditional visibility;
- loading, empty e error states;
- modal;
- propriedades básicas de acessibilidade.

Eventos da árvore de UI devem apontar para entry points do programa de comportamento. Bindings devem referenciar valores tipados, nunca strings JavaScript.

Mantenha migração automática das telas atuais para uma coluna simples. Atualize preview, exportador React e Tkinter de acordo com a capacidade de cada plataforma. Quando Tkinter não suportar fielmente uma propriedade, emita diagnóstico/aviso, não ignore silenciosamente.
```

## Critérios de aceite

- Telas antigas continuam renderizando.
- Layout da aplicação não depende das coordenadas do canvas de lógica.
- Repeater e visibilidade condicional possuem testes de binding.

---

# Fase 9 — Capacidades de aplicações reais

Execute esta fase em vários lotes, nunca em uma única alteração.

## Ordem sugerida

1. CRUD completo: query, insert, update, delete, filtros e paginação.
2. Modelos e schemas tipados.
3. Rotas com parâmetros e guards.
4. Formulários com validação composta.
5. Secrets e variáveis de ambiente.
6. Upload/download e armazenamento de arquivos.
7. Webhooks e jobs.
8. Cache.
9. Roles/permissões.
10. Testes gerados e observabilidade.

## Prompt reutilizável por lote

```text
FASE 9, LOTE [NOME]: implemente somente [CAPACIDADE].

Antes de codificar, descreva:
- casos de uso suportados e não suportados;
- extensão necessária na IR;
- tipos e portas;
- interface do adaptador;
- comportamento mock;
- comportamento esperado dos backends JavaScript e Python;
- riscos de migração.

Depois implemente verticalmente: catálogo -> validação -> lowering -> interpretador -> JavaScript -> Python -> UI -> testes cross-language -> documentação.

Não misture outra capacidade neste lote. Integrações reais devem ser adaptadores opcionais; testes usam mocks determinísticos e nunca dependem de credenciais ou rede.
```

---

# Fase 10 — Contrato para novos backends

## Finalidade

Facilitar Kotlin, Swift, Dart, Java, C# ou outra linguagem sem duplicar semântica.

## Prompt da fase

```text
FASE 10: formalize o contrato de backend do compilador.

Extraia uma interface de backend que receba ProgramIR validada e produza um conjunto de artefatos e diagnósticos. Inclua:
- identificação e versão do backend;
- capacidades suportadas;
- validação de compatibilidade;
- emissão de arquivos;
- runtime necessário;
- formatação;
- comando de build/teste;
- diagnósticos para recursos não suportados.

Converta JavaScript e Python para essa interface sem mudar comportamento. Crie um backend de teste mínimo usado apenas pela suíte para comprovar que um novo backend pode ser registrado sem alterar o compilador central ou a UI.

Documente em docs/adding-a-backend.md o processo completo e as obrigações de paridade.
```

---

# Suíte obrigatória ao final

Quando as fases 1–6 estiverem concluídas, solicite ao Gemini a seguinte suíte:

```text
Crie uma suíte de conformidade do FlowForge baseada em grafos dourados.

Inclua, no mínimo:
1. login válido e inválido;
2. cadastro e duplicidade;
3. OAuth mock;
4. CRUD mock;
5. validação com caminho valid/invalid;
6. switch com todos os casos e default;
7. estado set/get/toggle/remove;
8. delay e cancelamento;
9. API sucesso/erro/timeout;
10. banco sucesso/erro;
11. navegação entre três telas;
12. fan-out e join quando suportados;
13. ciclo controlado;
14. Unicode e strings hostis;
15. IDs com colisão após sanitização;
16. grafo inválido com diagnósticos determinísticos.

Cada fixture deve ser executada pelo interpretador da IR, pelo JavaScript gerado e pelo Python gerado. Normalize timestamps e IDs antes da comparação. Compare resultado, store, tela, logs relevantes, notificações e erros.
```

---

# Checklist de revisão do trabalho do Gemini

Use esta lista ao final de cada fase:

- [ ] Leu os arquivos antes de editar.
- [ ] Preservou alterações preexistentes.
- [ ] Alterou somente o escopo da fase.
- [ ] Não removeu teste ou funcionalidade para obter verde.
- [ ] Não adicionou `any`, `@ts-ignore` ou desativação de lint injustificada.
- [ ] Criou testes comportamentais, inclusive de falha.
- [ ] Testou valores controlados pelo usuário.
- [ ] Testou comportamento assíncrono.
- [ ] Testou migração/compatibilidade.
- [ ] Executou `npm run check`.
- [ ] Apresentou o resultado real dos comandos.
- [ ] Documentou limitações restantes.

## Sinais de alerta para rejeitar a entrega

Rejeite e solicite correção se o Gemini:

- declarar que portas personalizadas funcionam apenas porque aparecem no canvas;
- usar regex/nome da porta como substituto de semântica formal;
- duplicar novamente a regra de negócio em cada linguagem;
- manter o preview em um motor e os exportadores em outro sem teste de conformidade;
- usar `eval` ou `new Function` na nova linguagem visual;
- concatenar configurações em código gerado;
- afirmar suporte Python sem executar o Python gerado;
- capturar exceções e retornar valores padrão silenciosamente;
- fazer chamadas externas em testes;
- tentar implementar todas as fases numa única entrega.

---

# Ordem resumida de execução

1. Caracterizar o comportamento atual.
2. Corrigir o gerador JavaScript atual.
3. Formalizar portas e tipos.
4. Criar a IR.
5. Migrar a simulação para a IR.
6. Gerar JavaScript/TypeScript pela IR.
7. Gerar Python pela IR.
8. Criar linguagem visual portável.
9. Ampliar interface e layout.
10. Adicionar capacidades reais em lotes.
11. Formalizar plugins/backends para novas linguagens.

Não inverta as fases 2–6: aumentar o catálogo antes de estabilizar tipos, IR e conformidade multiplicará a quantidade de implementações divergentes.
