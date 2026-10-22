# Flowforge

Editor de programação visual em React + TypeScript. Requer Node.js 20.19+ e npm.

## Executar

```sh
npm install
npm run dev
```

Abra o endereço informado pelo Vite. `npm run build` gera `dist/`. `npm test` verifica o interpretador.

## Usar

1. Use **Novo projeto** na lateral esquerda para um canvas vazio; informe o nome e clique em **Criar projeto**. **Abrir projeto** carrega um arquivo JSON. **Configurações** abre o modal reservado, ainda vazio. Você pode desfazer a criação de projeto para recuperar o anterior.
2. Clique nos blocos da biblioteca para adicionar. Arraste para posicionar.
3. Configure o bloco no painel direito. Campos e botões pertencem a uma tela, selecionada nesse painel.
4. Arraste da porta de saída à porta de entrada. **próximo / sim / não → executar** define o caminho; **valor → email / password / value / a / b / body** fornece dados.
5. Cada saída de execução aceita um destino; cada entrada de dados aceita uma origem. Nova conexão substitui a anterior. Dados de ações devem ser produzidos antes de serem consumidos.
6. Use **Simular** e escolha **Mobile**, **Web** ou **Desktop** para testar a mesma interface em formatos diferentes. A mudança de plataforma preserva os valores e a execução atual. Login de exemplo: `demo@exemplo.com` / `123456`. Cadastro exige e-mail novo e senha com ao menos 6 caracteres. Google/Facebook/Firebase simulam sucesso.
7. **Exportar projeto** baixa um ZIP React/TypeScript ou Python/Tkinter. O JSON pode ser baixado e reimportado pela barra lateral.

## Arquitetura

- `src/engine.ts`: representação intermediária (IR), catálogo, portas, validação e interpretador.
- `src/main.tsx`: canvas React Flow, propriedades, simulação e persistência local.
- `src/exporter.ts`: geradores de projetos TypeScript/React e Python/Tkinter.
- `src/style.css`: interface.

O grafo não depende da linguagem de destino. Para adicionar uma linguagem, implemente outro exportador que interprete os tipos de bloco, propriedades e conexões, e adicione a opção no modal. Não existe tradução automática confiável para qualquer linguagem sem esse adaptador.

## Escopo desta primeira versão

Telas são contêineres de campos e botões; a simulação e as exportações usam um layout simples em coluna. O canvas representa estrutura, dados e execução; não é ainda um editor de posicionamento visual de cada elemento da tela. Classes exportam modelos com atributos genéricos, sem editor de métodos, herança ou tipagem de atributos. A prévia TypeScript e a exportação usam o mesmo interpretador; Python tem interpretador próprio com operações equivalentes para os blocos suportados. Tipos e conversões mais complexos precisam de evolução.

APIs retornam o JSON configurado e não enviam requisições. A entrada `body` é reservada para implementar o adaptador real. Banco suporta consulta de todos os registros e inserção em memória; não há filtros ou SQL. Auth, OAuth e recuperação são mocks. Senhas do protótipo ficam apenas na memória e não são um modelo de autenticação para produção. Integre um provedor real antes de publicar. Nenhum e-mail/SMS é enviado. Não insira dados sensíveis.

O fluxo segue as conexões de execução; um campo de entrada fornece seu valor atual. Telas iniciais são escolhidas pela ordem de criação. Condições têm ramos sim/não. Há limite de 100 passos por execução para conter ciclos. O editor permite excluir conexões pelo painel e blocos pelo botão de exclusão ou Backspace; desfazer/refazer cobre edições do grafo. O projeto é salvo no localStorage; exporte JSON para backup. Executar novamente o playground reinicia o banco simulado.

TypeScript exporta app web React/Vite. Python exporta app desktop Tkinter (requer distribuição Python com Tkinter). Nenhum gerador produz ainda app nativo Android/iOS.

## Biblioteca ampliada

22 tipos de bloco: tela, texto/título/legenda, campo de entrada, área de texto, lista de seleção, checkbox, botão, separador, autenticação, condição, matemática, navegação, recuperação de senha, variável em memória (ler/definir), validação (obrigatório/e-mail/tamanho/número), transformação de texto (limpar/maiúsculas/minúsculas/concatenar), mensagem, encerrar sessão, constante tipada (texto/número/booleano/JSON), API, banco e classe.

Campos, áreas de texto, listas e checkboxes alimentam dados diretamente. Constantes fornecem valores tipados. Variáveis, transformações e mensagens executam pelo caminho de ações. Validação tem saídas sim/não e valor booleano. Mensagens aparecem na prévia React e no registro da execução Python. Logout limpa a sessão simulada; a navegação para uma tela pública deve ser conectada explicitamente.

As prévias Mobile, Web e Desktop representam janelas e layouts diferentes para testar o protótipo; não são emuladores nativos. Exportação TypeScript continua sendo web React; Python continua sendo desktop Tkinter. A exportação suporta os 22 tipos de bloco. A interface ainda usa disposição vertical, com largura adaptável, sem posicionamento livre de elementos.

## Menu lateral

O primeiro botão alterna entre o menu expandido e o modo somente ícones. Expandido mostra Projeto e a biblioteca de Blocos, sem a barra de ícones duplicada. Recolhido mantém os atalhos de novo, abrir, salvar e configurações. Passe o mouse sobre Blocos para abrir a biblioteca ao lado; ela tem busca e rolagem. Também é possível clicar no ícone ou usar Enter / seta para a direita pelo teclado. Escape fecha a biblioteca e devolve o foco ao ícone. Clicar em um bloco adiciona ao canvas e fecha a biblioteca flutuante.

## Painel direito e exportação

O painel direito também alterna entre propriedades completas e uma barra de ícones. No modo recolhido, cada propriedade abre uma janela ao lado; seletores como Provedor e Operação mostram as opções diretamente. No modo expandido, esses seletores também usam listas flutuantes, com navegação por setas e confirmação por Enter. Conexões abre ao passar o mouse ou clicar no ícone e permite remover vínculos. Escape ou clique fora fecha as janelas. Exportar projeto está somente no menu esquerdo, tanto no modo expandido quanto no modo de ícones.

O exemplo de login fica no menu esquerdo, incluindo um atalho no modo de ícones. O painel direito contém apenas propriedades e conexões do bloco selecionado; a tela Projeto foi removida.

## Telas e navegação por resultado

O botão **Adicionar tela** da barra do canvas cria uma tela no projeto atual. O título decorativo do canvas foi removido.

Selecione uma tela e abra **Conexões → Navegação entre telas** nas propriedades (ou no ícone Conexões, com o inspetor recolhido). Adicione uma transição e escolha o bloco executado, o resultado **true**, **false** ou **sempre**, e a tela de destino. A lista de eventos mostra os botões daquela tela e as ações alcançáveis por suas conexões de execução. Uma regra atendida abre a tela de destino e encerra a execução atual; ela tem prioridade sobre o próximo fio desse bloco. Regras sobrepostas são sinalizadas na validação.

As transições aparecem como linhas verdes tracejadas entre as telas e são editadas no painel de propriedades. O JSON guarda as regras em `config.routes`; projetos anteriores continuam compatíveis. Simulador React e exportadores TypeScript/Python executam as mesmas transições.

O exemplo atualizado do menu esquerdo inclui Login → autenticação/condição true → Página inicial e Página inicial → Sair da conta → Encerrar sessão → Login. É possível configurar auth true diretamente como evento. Para logout, use o bloco Encerrar sessão antes da transição, para limpar a sessão em memória. Carregue o exemplo atualizado para ver o botão de saída; fluxos existentes não são substituídos automaticamente.
