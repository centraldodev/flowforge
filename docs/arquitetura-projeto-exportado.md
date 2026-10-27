# Arquitetura do projeto exportado

Status: especificação aprovada como requisito do plano; implementação ainda pendente. A exportação da fase 1 funciona, mas ainda concentra o programa em `src/program.ts`, a renderização em `src/ScreenFields.tsx` e o gateway em `server/httpGateway.mjs`.

## 1. Objetivo

Exportar um projeto independente, legível e organizado para manutenção por desenvolvedores. A divisão dos arquivos deve ser consequência dos blocos, telas, fluxos, entidades, conexões e políticas configurados no editor. O usuário não precisa criar diretórios nem informar caminhos de arquivos.

A organização começa no planejamento da geração, antes de escrever qualquer arquivo no ZIP. Não se deve gerar um arquivo gigante e depois cortá-lo por quantidade de linhas.

Não há obrigação de preservar os formatos antigos do FlowForge neste estágio: o produto ainda não está em produção e não possui projetos de usuários a migrar. A refatoração poderá substituir os formatos internos e de exportação existentes.

## 2. Estrutura de referência — React/TypeScript e servidor Node

Um repositório com workspaces, instalação e comandos centralizados na raiz. Os diretórios são gerados conforme as capacidades utilizadas; não criar dezenas de pastas vazias ou módulos de serviços que o app não usa.

```text
app-exportado/
├── README.md
├── package.json                    # Comandos e workspaces
├── tsconfig.base.json
├── .gitignore
├── .env.development.example        # Referências vazias de configuração
├── .env.production.example
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   ├── public/assets/
│   │   └── src/
│   │       ├── main.tsx             # Inicialização
│   │       ├── app/
│   │       │   ├── App.tsx
│   │       │   ├── routes.tsx
│   │       │   └── providers.tsx
│   │       ├── pages/
│   │       │   └── clientes--<id>/
│   │       │       ├── Page.tsx
│   │       │       ├── components/
│   │       │       │   └── CustomerForm.tsx
│   │       │       ├── workflows/
│   │       │       │   └── salvar-cliente--<id>.ts
│   │       │       ├── state.ts
│   │       │       └── page.css
│   │       ├── components/ui/      # Componentes reutilizados
│   │       ├── workflows/          # Subfluxos compartilhados no cliente
│   │       ├── services/
│   │       │   └── customers.client.ts
│   │       ├── runtime/
│   │       │   ├── context.ts
│   │       │   ├── dispatch.ts
│   │       │   ├── errors.ts
│   │       │   ├── operations/
│   │       │   │   ├── text.ts
│   │       │   │   └── math.ts
│   │       │   └── rendering/      # Renderizadores por família, quando necessários
│   │       └── styles/
│   │           ├── tokens.css
│   │           └── global.css
│   └── api/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── main.ts             # Inicializa e escuta
│       │   ├── app.ts              # Monta rotas e dependências
│       │   ├── config/
│       │   │   ├── environment.ts
│       │   │   └── secrets.ts
│       │   ├── http/
│       │   │   ├── router.ts
│       │   │   ├── request.ts
│       │   │   ├── response.ts
│       │   │   └── errors.ts
│       │   ├── modules/
│       │   │   └── customers--<id>/
│       │   │       ├── routes.ts
│       │   │       ├── service.ts
│       │   │       ├── repository.ts
│       │   │       ├── validators.ts
│       │   │       ├── policies.ts
│       │   │       └── workflows/
│       │   ├── integrations/
│       │   │   └── crm--<id>/
│       │   │       ├── connection.ts
│       │   │       └── requests/
│       │   │           └── listar-clientes--<id>.ts
│       │   ├── policies/           # Políticas compartilhadas de servidor
│       │   ├── jobs/               # Somente quando houver tarefas
│       │   └── runtime/
│       │       ├── context.ts
│       │       └── workflows.ts
│       └── database/
│           ├── schema/
│           │   └── customers--<id>.ts
│           └── migrations/
├── packages/
│   └── contracts/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── entities/
│           │   └── customer--<id>.ts
│           ├── requests/
│           │   └── create-customer--<id>.ts
│           ├── validation/         # Apenas validações puras compartilháveis
│           └── errors.ts
├── tests/
│   ├── workflows/
│   ├── integrations/
│   └── acceptance/
└── flowforge/
    ├── project.flow.json           # Origem visual, sem valores secretos
    ├── export-manifest.json        # Inventário de arquivos gerados
    ├── source-map.json             # Blocos/regras → arquivos/símbolos
    └── diagnostics.json
```

Os nomes são ilustrativos; `<id>` representa um identificador estável, não texto literal no nome final. `repository.ts` e `database/` surgem com persistência; `policies.ts` com políticas; tarefas com `jobs/`. Tipos de entrada e saída pertencem a contratos, e a implementação de validação/autorização continua sendo aplicada no servidor.

Para aplicações somente de interface, omitir `apps/api` e seus comandos. Se houver uma única página ou fluxo, a estrutura será pequena, mantendo a mesma regra de responsabilidades. A estrutura Python deverá respeitar as mesmas fronteiras sem copiar nomes e ferramentas específicos de TypeScript; seu detalhamento precederá a ampliação de capacidades desse destino.

## 3. Como os elementos visuais definem os arquivos

| Elemento do editor | Responsabilidade gerada | Destino principal |
|---|---|---|
| Tela | Página, composição e estado local | `apps/web/src/pages/<tela>/` |
| Layout, campo e botão | Elemento na composição da página | `Page.tsx` ou componente local |
| Formulário ou conjunto reutilizado | Componente com entradas e eventos tipados | `pages/<tela>/components/` ou `components/ui/` |
| Cabo de execução | Chamada explícita da próxima operação | Fluxo do evento correspondente |
| Cabo de dados | Argumento/resultado tipado, sem variável global implícita | Função do fluxo e contratos |
| Condição/regra de negócio | Desvio ou função de regra | Fluxo/módulo responsável |
| Evento de botão | Ponto de entrada do fluxo | `pages/<tela>/workflows/<evento>.ts` |
| Subfluxo | Função reutilizável gerada uma vez por contexto | `web/src/workflows/` ou fluxo do módulo do servidor |
| Requisição API | Cliente no frontend e operação permitida no servidor | `services/` e `integrations/<conexao>/requests/` |
| Conexão HTTP | Configuração pública da conexão e resolução privada de credencial | `api/src/integrations/<conexao>/connection.ts` |
| Entidade | Contrato de dados, esquema e repositório quando necessários | `contracts/entities/`, `database/schema/`, módulo de servidor |
| CRUD | Rota fina, operação de serviço e acesso a dados | `api/src/modules/<dominio>/` |
| Validação de formulário | Verificação pura e mensagem de interface; repetida no servidor quando exigida | Componente e contrato de validação |
| Política de acesso | Função aplicada antes de executar a operação | `modules/<dominio>/policies.ts` ou `api/src/policies/` |
| Política HTTP | Proteção do servidor/rota correspondente | `api/src/http/` ou política especializada |
| Ambiente/segredo | Esquema de configuração e referência, nunca o valor privado | `api/src/config/` e exemplos de ambiente |
| Agendamento/webhook | Entrada independente e fluxo de servidor | `api/src/jobs/` ou rota/módulo correspondente |

Um campo ou uma soma simples não precisa de arquivo próprio. A unidade de divisão é uma responsabilidade coerente: página, componente composto, evento, subfluxo, integração, entidade ou política. Muitos blocos podem compor um módulo; um único bloco complexo pode exigir mais de um artefato.

## 4. Formação dos módulos e fronteiras de execução

O gerador deve usar referências explícitas do grafo, sem deduzir domínios pelo texto do nome de um bloco:

1. Telas definem agrupamentos de interface. Entidades e recursos definem agrupamentos de servidor.
2. Eventos definem pontos de entrada; subfluxos definem unidades de reutilização.
3. Fluxos puramente locais permanecem no cliente. Uma transição para operação de servidor gera contrato, chamada cliente e entrada permitida no servidor.
4. A partir de uma entrada de servidor, operações privilegiadas e suas regras são executadas no servidor. Não aceitar do cliente uma indicação de que a política já foi aprovada.
5. Uma operação sem domínio próprio fica no módulo do recurso correspondente ou em um fluxo independente com ID estável. Não exigir organização manual para que o app funcione.
6. Organizações visuais por cor/posição não determinam permissão, ordem de execução ou domínio. Cabos e referências semânticas são a fonte dessas decisões.

Chamadas compartilhadas devem gerar referência à mesma função. A IR precisa preservar subfluxos e chamadas, em vez de expandir repetidamente toda a cadeia em cada evento. Ciclos devem usar controle explícito e limites; não duplicar código até atingir limite de arquivo.

## 5. Contrato de emissão por tipo de bloco

Além das propriedades e portas, cada tipo passa a declarar:

- Em quais contextos pode executar e quais destinos suporta.
- Quais artefatos fornece: componente, fluxo, contrato, cliente, adaptador, política, esquema ou recurso estático.
- A unidade semântica proprietária e as dependências por identificador, sem escolher caminhos livres.
- Quais definições são reutilizáveis e como são identificadas para emitir apenas uma cópia.
- Quais configurações são públicas e quais são referências exclusivas do servidor.
- Quais validações, dependências de pacote e recursos de runtime são necessários.
- Como associar símbolos/arquivos gerados aos IDs dos blocos e regras.

Um emissor devolve artefatos estruturados com caminho lógico, responsabilidade, contexto, conteúdo, dependências, proprietários e referências de origem. O planejador central resolve caminhos físicos e imports. Dois emissores não podem sobrescrever o mesmo caminho silenciosamente.

Não criar uma configuração de caminho no painel do usuário. A estrutura de diretórios é responsabilidade do exportador e deve funcionar para qualquer combinação suportada de blocos.

## 6. Pipeline de exportação

1. Validar grafo, configurações, regras, recursos e suporte do destino.
2. Construir uma IR que preserve entradas, módulos, chamadas e fronteiras cliente/servidor.
3. Planejar o conjunto de artefatos e suas dependências antes de renderizar arquivos.
4. Atribuir caminhos e nomes seguros e estáveis; detectar colisões.
5. Selecionar apenas os módulos de runtime e dependências necessários, incluindo dependências transitivas.
6. Gerar arquivos por responsabilidade, resolver imports e aplicar formatação.
7. Verificar arquivos ausentes, imports não resolvidos, ciclos proibidos, limites de tamanho e referências privadas no cliente.
8. Gerar inventário e mapa de origem, exemplos de ambiente e comandos de execução.
9. Produzir o ZIP a partir desse conjunto fechado de arquivos, sem resíduos de exportações anteriores.

No editor, as verificações estáticas são executadas antes do download. Build, testes executáveis e inicialização do projeto extraído são realizados na suíte de aceitação do gerador. Um assistente local de exportação poderá executar esses checks futuramente; não afirmar que o navegador executou um build quando isso não ocorreu.

## 7. Limites de tamanho e qualidade

- Arquivos de lógica devem ter uma responsabilidade principal e, em geral, até 300 linhas úteis.
- Acima de 350 linhas úteis, o planejador deve apontar a necessidade de divisão por componentes, operações, regras ou subfluxos.
- Acima de 600 linhas úteis de código, a exportação deve falhar com diagnóstico de geração até que exista uma divisão semântica. Não truncar conteúdo, criar arquivos numerados sem significado ou desativar o diagnóstico por bloco.
- Arquivos de dados, mapas, assets e dependências de terceiros têm critérios próprios. Configurações e mapas serão particionados por tela, módulo ou recurso quando crescerem; não converter lógica em JSON gigante para contornar o limite.
- `main`, composição da aplicação e índices só inicializam/registram módulos; não acumulam regras de negócio.
- Um registro de rotas ou eventos grande deve ser composto a partir de registros dos módulos, sem importar toda a aplicação para executar uma única operação.
- Não usar `@ts-nocheck` como solução definitiva para código TypeScript gerado. Tipos e imports devem ser verificados; bibliotecas JavaScript intencionais devem ter contratos de tipos explícitos.

Os números são limites de engenharia propostos, não indicadores suficientes de qualidade. Também verificar complexidade dos fluxos, duplicação, dependências circulares e separação de responsabilidades.

## 8. Dependências e segurança dos diretórios

Fluxo permitido: web → contratos; API → contratos; módulos da API → integrações/runtime de servidor. O cliente chama a API pela rede. Contratos não importam implementações da API nem do frontend.

Regras obrigatórias:

- Cliente não importa `secrets`, banco, provedores privilegiados ou código de infraestrutura do servidor.
- A API não depende de componentes React ou do estado interno do editor.
- O projeto exportado não importa arquivos do repositório FlowForge.
- O diretório servido publicamente contém somente o build web e assets permitidos. `flowforge/`, `.env`, fontes privadas do servidor e seus manifestos não são publicados como arquivos estáticos.
- Metadados do grafo usados para rastreamento ficam fora do build do cliente, salvo um subconjunto público e necessário à execução.
- Módulos opcionais não adicionam dependências a serviços não utilizados. Versões de pacotes devem ser explícitas e a geração deve verificar a consistência dos workspaces.

## 9. Nomes estáveis, remoção e rastreabilidade

Cada tela, entidade, fluxo, regra e recurso recebe uma identidade estável independente do rótulo exibido. Pastas e símbolos usam um nome sanitizado associado a essa identidade. Renomear um rótulo não deve mover arquivos automaticamente; o nome técnico é fixado na criação e pode ser reorganizado por ação explícita no futuro.

Sanitizar separadores, caracteres inválidos, nomes reservados e diferenças entre maiúsculas/minúsculas. IDs não são caminhos. Testar colisões e tentativas de escapar da raiz de exportação.

`export-manifest.json` registra destino, versão do gerador, caminho, responsabilidade, hash de conteúdo e IDs proprietários. `source-map.json` associa blocos, portas, regras e símbolos aos arquivos gerados. Os hashes representam conteúdo; diferenças de data não devem alterar todos os arquivos.

Exportações equivalentes devem produzir os mesmos caminhos e conteúdos, com ordenação estável; não depender da posição dos blocos no canvas. Remover um bloco elimina seus artefatos exclusivos na próxima exportação, preservando recursos que ainda possuem referências. Migrações de banco seguem histórico próprio: não apagar uma migração aplicada apenas porque uma entidade foi removida.

## 10. Manutenção após exportar

O projeto funciona e pode ser editado sem o FlowForge. O README explica responsabilidades, comandos, configuração e origem dos arquivos. Não colocar rótulos de blocos ou IDs técnicos na interface final sem necessidade de produto.

A primeira implementação gera um ZIP completo novo a cada exportação. Reexportar não mescla automaticamente alterações manuais realizadas em uma cópia anterior; essa limitação deve ser explícita.

Se forem adicionados pontos de extensão em código, eles terão contratos e arquivos separados dos gerados. Esses pontos são opcionais para quem mantém o código exportado e não exigem programação de quem usa o editor visual. Uma futura atualização sobre diretório existente precisará de inventário e tratamento explícito de conflitos; não sobrescrever arquivos desconhecidos.

## 11. Entrega 1.1 — antes de iniciar persistência

1. Criar o modelo de plano de artefatos e o resolvedor de caminhos/imports/dependências.
2. Extrair o runtime compartilhado de `program.ts`; emitir fluxos por evento/tela e chamadas reutilizáveis.
3. Dividir renderização e composição de páginas em módulos com responsabilidade definida.
4. Dividir o gateway HTTP existente em configuração, leitura/validação da requisição, transporte externo, tratamento de resposta/erros e registro de operações por conexão.
5. Emitir a estrutura de workspaces, scripts e contratos. Remover templates antigos substituídos, sem manter exportadores paralelos por compatibilidade.
6. Gerar manifesto de arquivos e mapa de origem. Aplicar validações de fronteiras, colisões e tamanho.
7. Extrair o ZIP em ambiente limpo, instalar as dependências declaradas, executar build/testes e iniciar frontend/backend para repetir os testes HTTP da fase 1.

Somente depois desse percurso aprovado, a fase 2 deverá adicionar entidades, repositórios e migrações aos diretórios previstos.

## 12. Critérios de aceite contínuos

- Criar várias telas gera páginas e eventos separados; o crescimento de uma tela não faz crescer um arquivo global com todas as outras telas.
- Reutilizar um fluxo ou conexão em várias telas mantém uma única implementação compartilhada por contexto.
- Os mesmos blocos e regras geram resultado equivalente ao interpretador; a divisão em arquivos não altera a semântica.
- Cada novo tipo de bloco informa seus artefatos e dependências e possui teste de exportação apropriado.
- Build do frontend não contém segredos nem implementações privadas. Políticas obrigatórias continuam executadas no servidor.
- Grafo maior que os exemplos de demonstração não produz arquivos acima do limite, imports quebrados ou expansão repetitiva das mesmas cadeias.
- Criar, renomear e remover elementos não produz colisões ou arquivos órfãos no novo ZIP.
- O projeto extraído instala, compila e executa sem dependências do diretório do editor ou de sua instalação local de pacotes.
- Comandos da raiz inicializam os componentes necessários sem o usuário precisar descobrir a ordem de execução em cada diretório.

As fases 2 a 7 só ficam prontas quando seus recursos também cumprem estes critérios. Organização da exportação é parte da implementação de cada capacidade, não uma limpeza adiada para a última etapa.
