# Plano de evolução: apps reais com blocos, conexões e propriedades

Status: proposta de arquitetura e implementação. Os recursos descritos abaixo não estão implementados, salvo quando identificados como existentes.

Requisito transversal: [arquitetura do projeto exportado](arquitetura-projeto-exportado.md). Essa especificação define diretórios, divisão de arquivos, responsabilidades por bloco/regra, dependências e critérios de manutenção. A entrega 1.1 deve ser feita antes da fase 2.

Diretriz atual: não preservar formatos antigos por compatibilidade. O produto ainda não está em produção e não há projetos de usuários a migrar. As estruturas podem ser substituídas para atender à arquitetura final.

## 1. Objetivo e limites

Permitir que uma pessoa monte telas, comportamento, dados, integrações e políticas usando blocos, cabos e formulários. Exportar um projeto independente do editor, com frontend, backend quando necessário, configuração de ambiente, modelos de dados e instruções de execução.

Mais blocos ampliam os casos de uso, mas só são úteis quando possuem contrato, validação, execução real e geração de código. O compromisso inicial será com aplicações web de gestão, portais, catálogos, agendamentos e fluxos de negócio. Apps nativos, processamento especializado e infraestrutura de rede ficam fora da primeira entrega.

Não exigir JavaScript, SQL, JSON, expressões regulares ou comandos de terminal na montagem do app. Instalação e hospedagem do projeto exportado são uma etapa distinta; execução local deve ter um assistente ou comando documentado. Implantação automática será uma fase posterior.

## 2. Modelo mental do editor

O projeto terá áreas: Telas, Fluxos, Dados, Integrações, Segurança e Ambientes. São visões do mesmo projeto, com navegação entre referências, sem obrigar o usuário a manter um canvas gigante.

Três categorias visuais:

- Componentes de interface: formulário, botão, tabela, modal.
- Operações: validar, autenticar, consultar, enviar mensagem.
- Recursos: conexão de banco, provedor de identidade, armazenamento, política.

Cabos possuem significado explícito:

| Cabo | Significado | Exemplo |
|---|---|---|
| Execução | Ordem das operações | Clique → Validar → Salvar |
| Dados | Valor tipado | Campo E-mail → Login.email |
| Erro | Tratamento de falha | Salvar.erro → Notificação |
| Recurso | Dependência de uma integração | Consultar.conexão → Banco |
| Política | Regra aplicada a um alvo | Rota.política → Permissões |

Portas de recurso e política exigem novos contratos; não devem ser tratadas como valores comuns. Uma referência escolhida no painel e o cabo correspondente representam o mesmo vínculo, sem configurações divergentes.

## 3. Contrato obrigatório de todo bloco

Cada definição terá identificador e versão, descrição, categoria, local de execução (cliente/servidor/ambos), propriedades estruturadas, portas tipadas, regras de preenchimento, presets, recursos necessários, efeitos colaterais, suporte por plataforma e implementação no compilador/runtime/exportador.

Também deve declarar os artefatos que gera, sua unidade proprietária, dependências, escopo cliente/servidor, possibilidade de reutilização e mapeamento de origem. Cada novo bloco e regra deve nascer com um destino definido na estrutura exportada; não concentrar toda a geração em um arquivo global.

Os resultados terão dados e erros tipados. Operações de rede terão estado de carregamento, cancelamento quando suportado, timeout e política de tentativa. Repetir automaticamente uma escrita exige estratégia de idempotência ou confirmação explícita de que a operação admite repetição.

Um bloco sem implementação para o destino selecionado não pode ser exportado como se estivesse funcional. Diagnósticos devem indicar bloco, campo, motivo e como corrigir.

## 4. Painel direito

Seções: Geral, Entradas, Conexão, Regras, Resultados e Avançado. Mostrar somente seções e campos aplicáveis. Campos obrigatórios têm indicação e ajuda com exemplos.

Cada entrada aceita uma origem explícita: valor fixo, campo de tela, saída de outro bloco, variável, usuário atual ou parâmetro de rota. Exibir um seletor de dados com busca; nunca exigir que a pessoa digite caminhos de propriedades.

Conexões exibem: Não configurada, Configurada, Testada ou Falha, com data e ambiente do último teste. Configurada não significa validada. O teste de conexão deve explicar que acesso será feito; testes de escrita usam recurso isolado ou confirmação específica.

O painel mostra se a configuração pertence ao projeto ou à instância do bloco. Credenciais usam referências a segredos e não campos de texto comuns.

## 5. Catálogo: interface e navegação

| Bloco | Informações configuráveis | Portas/resultados e presets |
|---|---|---|
| Página/Rota | Nome, caminho, parâmetros tipados, layout, política de acesso | Ao abrir, parâmetros; pública ou protegida |
| Layout/Container | Direção, espaçamento, alinhamento, largura, comportamento por tamanho de tela | Conteúdo filho; coluna, grade, cabeçalho com conteúdo |
| Texto/Imagem | Conteúdo fixo ou vinculado, formato, descrição acessível, visibilidade | Dados; título, descrição, moeda, imagem de catálogo |
| Campo | Nome, tipo, rótulo, valor inicial, máscara disponível, regras | Valor, alteração; e-mail, senha, telefone, data |
| Seleção | Opções fixas ou fonte de dados, campo de valor/rótulo, seleção múltipla | Valor, alteração; status, categorias |
| Formulário | Campos, conjunto de regras, comportamento no envio, erros | Enviar, dados tipados, válido/inválido |
| Botão | Rótulo, aparência, desabilitação, confirmação opcional | Clique; salvar, cancelar, excluir |
| Lista/Tabela | Fonte, colunas, formatação, ações por linha, paginação, ordenação | Item selecionado, página, filtros; listagem CRUD |
| Modal/Notificação | Mensagem, tipo, duração ou confirmação, acessibilidade | Abrir/fechar, confirmar/cancelar |
| Navegação | Página de destino, parâmetros, histórico | Executar; ir, voltar, substituir |
| Upload visual | Tipos de arquivo, tamanho máximo, quantidade, destino | Arquivos, progresso, sucesso/erro |

## 6. Catálogo: lógica e transformação

| Bloco | Informações configuráveis | Portas/resultados e presets |
|---|---|---|
| Validação | Campo, operador, parâmetro, mensagem, momento da validação | Dados, válido/inválido, erros por campo |
| Condição | Grupos de regras E/OU com operandos selecionáveis | Verdadeiro/falso |
| Escolha | Valor de entrada, casos e caminho padrão | Um caminho por caso |
| Estado | Nome, tipo, escopo e valor inicial | Ler/escrever/limpar; temporário ou persistente quando permitido |
| Cálculo/Texto/Data | Operação predefinida, operandos, fuso/locale para datas | Resultado tipado; soma, desconto, prazo, formatação |
| Montar objeto | Campos e origem de cada valor | Objeto tipado; payload de cadastro |
| Coleção | Operação, condição, ordenação ou transformação por item | Filtrar, mapear, encontrar, contar, somar |
| Repetir | Coleção, fluxo por item, limite, execução sequencial inicial | Item, índice, finalização/erro |
| Subfluxo | Entradas, saídas, bloco reutilizável e versão | Chamar/retornar; normalizar cadastro |
| Tratar erro | Tipos de erro, mensagem pública e destino | Erro tratado ou propagado |
| Aguardar/Tentar novamente | Duração, limite, intervalo, estratégia permitida | Concluído, esgotado, cancelado |

Escopo de estado deve distinguir tela, sessão e servidor. Segredos e dados de sessão sensíveis não podem usar persistência pública por conveniência.

## 7. Catálogo: dados e integrações reais

| Bloco/recurso | Informações necessárias | Comportamento e presets |
|---|---|---|
| Conexão PostgreSQL | Host, porta, banco, esquema, usuário, referência de senha, TLS, timeout e ambiente | Executa no servidor; testar conexão e listar esquemas autorizados |
| Conexão de serviço de dados | Provedor suportado, URL do projeto, referências às credenciais e ambiente | Adaptador específico; diferenciar chave pública de chave privilegiada |
| Entidade/Tabela | Nome, campos e tipos, obrigatoriedade, valor padrão, chave primária, unicidade, relações e índices | Modelo visual; usuários, produtos, pedidos; migração revisável |
| Consultar | Conexão, entidade, campos retornados, filtros E/OU, relações permitidas, ordenação, paginação | Lista, total, vazio/erro; meus registros, registros ativos |
| Buscar registro | Conexão, entidade, chave e valor | Registro, não encontrado, erro |
| Inserir/Atualizar/Excluir | Entidade, mapeamento de campos, alvo, política, comportamento para conflito | Registro/quantidade, sucesso/erro; exclusão exige alvo definido |
| Transação | Conexão, operações participantes, condições de sucesso | Confirmação/rollback; mesmo banco no primeiro suporte |
| Conexão HTTP | URL base, autenticação, segredo por referência, cabeçalhos, timeout, ambientes | Sem autenticação, API key, Bearer; OAuth requer conector implementado |
| Requisição HTTP | Conexão, método, caminho, parâmetros, cabeçalhos permitidos, corpo visual, formato de resposta e códigos de sucesso | Dados/status/erro; listar, criar, atualizar |
| Endpoint próprio | Método, rota, parâmetros, entrada tipada, política, resposta e status | Gera rota no backend; REST CRUD |
| Webhook | Rota, provedor, segredo de assinatura, eventos aceitos, deduplicação | Evento validado/erro; confirmação rápida e processamento posterior |
| Armazenamento | Provedor, endpoint/região/bucket quando aplicáveis, credenciais, visibilidade e limites | Upload/download/exclusão; URLs temporárias quando suportadas |
| E-mail | Provedor, credenciais, remetente autorizado, destinatário, assunto, modelo e variáveis | Enviado/erro; boas-vindas, confirmação |
| Agendamento/Fila | Agenda/fuso ou evento, backend executor, payload, limite, repetição e deduplicação | Execução persistente no servidor; tarefa diária |
| Tempo real | Provedor suportado, canal, eventos, autorização e reconexão | Conectado/mensagem/erro; atualização de listagem |
| Pagamento | Provedor suportado, ambiente, referências às chaves, valor/moeda, referência do pedido, URLs de retorno e webhook | Criar checkout; confirmar pagamento por evento validado no servidor |

Cada provedor terá formulário próprio: não existe uma lista universal de chaves que sirva para qualquer serviço. Confirmar requisitos na documentação oficial na implementação de cada conector.

Banco SQL não é apenas uma URL de rota. Uma URL de API representa outro tipo de recurso. A interface deve orientar a escolha sem misturar essas modalidades.

## 8. Autenticação e autorização

| Bloco/recurso | Propriedades | Resultado |
|---|---|---|
| Provedor de identidade | Provedor implementado, domínio/URL ou projeto, identificadores públicos, segredos quando exigidos, ambientes e URLs de retorno | Conexão de identidade reutilizável |
| Login por e-mail | Provedor, campo e-mail, campo senha, destino e mensagens | Usuário/sessão ou erro tipado |
| Login Google | Provedor, Client ID quando aplicável, callback/origens conforme integração, escopos e segredo somente se exigido pelo fluxo de servidor | Autenticação real pelo provedor; sem token fictício |
| Cadastro/Recuperar acesso | Provedor, campos, regras, confirmação de e-mail e URLs | Criado/pendente/erro; solicitado/erro |
| Sessão/Sair | Estratégia de sessão, duração, renovação e revogação conforme provedor | Usuário atual, autenticado/expirado; sessão encerrada |
| Papel/Permissão | Papéis, ações, recursos, escopo por organização e propriedade do registro | Permissão concedida/negada |
| Política de acesso | Sujeito, recurso, ação e regras | Aplicada no servidor antes da operação |

Escolher primeiro um provedor de identidade real. Não implementar armazenamento próprio de senhas como atalho para substituir a demonstração. Validação visual de senha e e-mail melhora a experiência, mas não substitui a verificação do provedor nem a autorização no servidor.

Exemplo de painel para Login: provedor “Identidade principal”; E-mail “Campo E-mail”; Senha “Campo Senha”; regras “obrigatório” e “e-mail válido”; sucesso “Dashboard”; erro “Mensagem no formulário”. Conexões de dados continuam visíveis como cabos.

## 9. Regras visuais no estilo de um console de administração

Uma regra terá nome, estado ativo, alvo, condições, efeito e mensagem. O usuário escolhe campos e operadores; não escreve expressões.

Editor: “Quando [Usuário → Papel] [é igual a] [Administrador] E [Registro → Organização] [é igual a] [Usuário → Organização], permitir [Atualizar]”.

Operadores fornecidos pela equipe: obrigatório, vazio, igual, diferente, maior/menor, entre, contém, começa com, pertence à lista, e-mail válido, tamanho mínimo/máximo, data antes/depois, usuário autenticado, possui papel e é proprietário. CPF completo exige validação dos dígitos verificadores; o validador atual verifica apenas formato básico.

Tipos de políticas:

- Formulário: validação de dados e mensagens por campo.
- Negócio: saldo suficiente, intervalo de agendamento, transição de status permitida.
- Acesso: papéis, ações, organização e propriedade do registro.
- Proteção HTTP: origens permitidas, métodos, limites de tamanho, frequência e regras de IP quando suportadas pelo ambiente.
- Arquivos: tamanho, formatos, visibilidade e acesso.
- Integrações: hosts de destino autorizados e credenciais permitidas por ambiente.

Políticas de acesso usam negação por padrão e negação explícita prevalece. Grupos de condições suportam E/OU; regras sobrepostas devem ter diagnóstico. Limitação de frequência em múltiplas instâncias exige estado compartilhado.

“Firewall” no produto inicialmente significa políticas da aplicação/API. Firewall real de rede, portas e sub-redes exige provisionamento e suporte específico do provedor; não pode ser prometido por um bloco que apenas filtra requisições no backend.

## 10. Predefinições e opções manuais

Três mecanismos distintos:

1. Preset oficial: configuração pronta criada pela equipe, com versão, descrição e campos ainda obrigatórios destacados.
2. Preset do usuário: salvar configuração de bloco ou subfluxo, com parâmetros; nunca copiar valores secretos.
3. Opção manual: adicionar valor a uma lista configurável, campo de entidade, cabeçalho permitido, condição ou endpoint compatível com o conector HTTP.

Exemplos: adicionar um novo status “Aguardando aprovação”; cadastrar outra URL de API; salvar uma regra “Somente dono do registro”; reutilizar um formulário “Cadastro de cliente”.

Uma opção manual não implementa um novo protocolo ou provedor. Um novo operador executável ou autenticação específica depende de implementação pela equipe. O usuário pode compor operações existentes em subfluxos sem código.

Toda alteração em preset compartilhado deve ser versionada. Instâncias existentes só atualizam mediante ação explícita, com visualização das diferenças.

## 11. Arquitetura necessária

Evoluir a base atual em vez de criar um segundo motor:

- `engine/types.ts`: configurações estruturadas, entidades, recursos, políticas, ambientes e referências a segredos. Substituir o atual `Record<string, string>` conforme necessário, sem obrigação de preservar formatos antigos.
- Registro central de blocos: uma definição alimenta biblioteca, portas, painel, presets, validação e capacidades por destino. Eliminar divergência entre campos exibidos e campos usados na execução.
- `compiler/ir.ts`: representar recursos, políticas, endpoints, contexto de execução, modelos e subfluxos; adicionar laços e instruções conforme necessários. Validar suporte por backend.
- `compiler/lower.ts`: bindings de entrada explícitos; eliminar dependência de adivinhar campos pelo nome. Encaminhar integralmente configurações validadas.
- Adaptadores: modos demonstração e real explícitos; contratos comuns para simulação, integração e exportação. Não converter falha real em sucesso simulado.
- Backend gerado: receber chamadas do frontend, resolver segredos no ambiente do servidor, aplicar validações/autorização e executar integrações.
- Exportação: gerar frontend, servidor, contratos, migrações, manifesto de recursos, `.env.example` sem valores, instruções e verificações. Não colocar segredos no grafo ou ZIP.
- Planejamento da exportação: produzir um conjunto de artefatos por tela, evento, entidade, integração e política, com runtime compartilhado, caminhos estáveis, imports resolvidos, limites de tamanho e inventário. Seguir a [estrutura detalhada](arquitetura-projeto-exportado.md).
- Rastreamento: associar erro em execução ao bloco e porta de origem, com dados sensíveis ocultados.

Foco inicial: React/TypeScript com backend TypeScript para apps web. Python continua disponível com suas capacidades atuais; novas funções só serão anunciadas quando houver suporte e testes equivalentes. Compatibilidade é uma matriz explícita, não uma promessa automática entre plataformas.

## 12. Sequência de implementação e aceite

| Etapa | Entrega | Critério de aceite |
|---|---|---|
| 0 — Contratos | Registro de blocos, modelo estruturado e matriz de capacidades | Cada campo configurável tem consumo definido; opção sem implementação gera diagnóstico; sem obrigação de compatibilidade com projetos antigos |
| 1 — Conexões reais | Recursos, ambientes, segredos e conector HTTP com backend exportado | App exportado chama uma API real; timeout/erro funcionam; segredo não aparece no frontend nem no grafo |
| 1.1 — Exportação modular | Plano de artefatos, workspaces web/API/contratos, fluxos e runtime divididos, mapa de origem | ZIP independente instala, compila e executa; sem arquivos gigantes, dependências privadas no cliente, colisões ou implementações duplicadas |
| 2 — Dados persistentes | Um conector PostgreSQL, entidades e CRUD visual | Cadastro sobrevive a reinício; filtros usam parâmetros; permissões impedem acesso indevido |
| 3 — Identidade e regras | Um provedor real, Google quando suportado, sessão, regras e políticas | Login/logout/expiração reais; chamada direta à API sem permissão também é negada |
| 4 — Interface completa | Formulários, tabelas, seleções, estados de carregamento, rotas e layouts responsivos | Usuário monta telas CRUD sem JSON/código; parâmetros e validações funcionam no projeto exportado |
| 5 — Composição | Subfluxos, coleções, regras reutilizáveis e presets pessoais | Criar e reutilizar fluxo de negócio sem código; versões não alteram projetos silenciosamente |
| 6 — Integrações adicionais | Arquivos, e-mail, webhooks, tarefas e depois pagamentos/tempo real | Cada conector passa testes reais isolados, exportação e diagnóstico de configuração |
| 7 — Entrega operacional | Assistente de ambiente, logs, diagnóstico e destinos de implantação definidos | Projeto exportado executa sem o editor; ausência de configuração é apresentada de forma acionável |

As etapas são dependências técnicas, não estimativas de prazo. Regras mínimas de autorização entram junto com os primeiros endpoints/dados; a etapa 3 amplia o editor e a identidade, sem deixar as etapas anteriores desprotegidas.

Nas fases seguintes, entidades geram contratos/esquemas/repositórios; regras geram validadores/políticas; telas geram páginas/componentes; integrações geram conexões e operações próprias. Cada entrega deve respeitar a estrutura modular. Não adiar a organização para a fase 7.

## 13. Primeiro app de referência

Construir um gestor de clientes e pedidos inteiramente pelo editor:

1. Login real e página protegida.
2. Cadastro de cliente com validação visual.
3. Listagem persistente com filtro, ordenação e paginação.
4. Alteração e exclusão com autorização por organização/proprietário.
5. Pedido com itens, cálculo de total e transação.
6. Chamada a uma API externa e tratamento de indisponibilidade.
7. Exportação e execução independente com ambientes separados.

Adicionar dois projetos de verificação com regras diferentes: agendamento com prevenção de conflito e portal com aprovação por papéis. Isso evita validar a plataforma apenas contra uma demonstração específica.

## 14. Qualidade e definição de pronto

Um bloco só está pronto quando possui formulário sem código, portas corretas, configuração validada, caminho de sucesso e falha, implementação real quando aplicável, exportação funcional, documentação e testes proporcionais ao risco.

Exportação funcional inclui organização: responsabilidades separadas, módulos compartilhados sem duplicação, nomes estáveis, imports válidos, fronteiras cliente/servidor e limites de tamanho conforme a [arquitetura de exportação](arquitetura-projeto-exportado.md).

Verificação deve incluir: execução equivalente entre interpretador e programa gerado; instalação e build do ZIP em ambiente independente; estrutura e tamanho dos arquivos; referências de origem e ausência de duplicação; CRUD em banco de teste; autorização por acesso direto à API; vazamento de segredos; timeout e falhas; persistência após reinício; isolamento entre usuários/organizações; confirmação de webhook; acessibilidade básica da interface.

Os 155 testes e o build existentes passaram na análise inicial. Eles são a base de regressão; não são evidência de integração real já implementada.

O objetivo comercial deve ser expresso como famílias de apps e capacidades verificadas. Expandir o catálogo depois que o primeiro percurso completo estiver comprovado.
