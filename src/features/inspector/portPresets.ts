// Portas sugeridas por tipo de bloco, exibidas como atalhos no inspetor.
import type { Kind } from '../../engine';

export type PortPreset = {
  name: string;
  direction: 'input' | 'output';
  type?: string;
  title: string;
};

const exec = (title: string): PortPreset => ({
  name: 'execute',
  direction: 'input',
  type: 'Event',
  title,
});

export const portPresets: Partial<Record<Kind, PortPreset[]>> = {
  button: [
    {
      name: 'onClick',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Evento de clique do botão',
    },
    {
      name: 'disabled',
      direction: 'input',
      type: 'boolean',
      title: 'Desativa o botão quando verdadeiro',
    },
    {
      name: 'value',
      direction: 'output',
      type: 'string',
      title: 'Texto ou valor associado ao botão',
    },
  ],
  input: [
    {
      name: 'value',
      direction: 'output',
      type: 'string',
      title: 'Valor de texto digitado no campo',
    },
    {
      name: 'onChange',
      direction: 'output',
      type: 'Event',
      title: 'Evento disparado quando o valor muda',
    },
    {
      name: 'disabled',
      direction: 'input',
      type: 'boolean',
      title: 'Desativa o campo quando verdadeiro',
    },
  ],
  function: [
    exec('Lado B: Executar a função'),
    {
      name: 'message',
      direction: 'input',
      type: 'string',
      title: 'Dado: mensagem recebida pela função',
    },
    {
      name: 'value',
      direction: 'input',
      type: 'string',
      title: 'Dados / argumentos passados para a função',
    },
    {
      name: 'onDismiss',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Evento de dispensa ou finalização',
    },
    {
      name: 'then',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Continuação após execução (promise then)',
    },
    {
      name: 'result',
      direction: 'output',
      type: 'any',
      title: 'Resultado / retorno retornado pela função',
    },
  ],
  condition: [
    exec('Lado B: Disparar avaliação da condição'),
    {
      name: 'value',
      direction: 'input',
      type: 'string',
      title: 'Valor de entrada a ser comparado',
    },
    {
      name: 'true',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Ramo executado quando a condição for verdadeira',
    },
    {
      name: 'false',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Ramo executado quando a condição for falsa',
    },
  ],
  error: [
    exec('Lado B: Disparar tratamento de erro (ex: via onError)'),
    {
      name: 'retry',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Tentar executar novamente a função que falhou',
    },
    {
      name: 'msg',
      direction: 'output',
      type: 'string',
      title: 'Lado A: Retorna a mensagem de erro tratada',
    },
  ],
  notify: [
    exec('Lado B: Disparar a notificação'),
    {
      name: 'message',
      direction: 'input',
      type: 'string',
      title: 'Dado: Mensagem personalizada dinâmica',
    },
    {
      name: 'next',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Prossegue para a próxima ação após exibir a notificação',
    },
    {
      name: 'onDismiss',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Disparado quando o usuário fecha ou a notificação expira',
    },
  ],
  state: [
    exec('Lado B: Executa operação de estado'),
    {
      name: 'value',
      direction: 'input',
      type: 'any',
      title: 'Dado: Valor a ser salvo ou atualizado',
    },
    {
      name: 'key',
      direction: 'input',
      type: 'string',
      title: 'Dado: Nome da variável/chave',
    },
    {
      name: 'next',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Prossegue após atualizar ou ler o estado',
    },
    {
      name: 'value',
      direction: 'output',
      type: 'any',
      title: 'Dado: Valor atual da variável no estado',
    },
  ],
  validator: [
    exec('Lado B: Executa validação dos dados'),
    {
      name: 'value',
      direction: 'input',
      type: 'string',
      title: 'Dado: Valor ou texto a ser validado',
    },
    {
      name: 'valid',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Valor válido de acordo com a regra',
    },
    {
      name: 'invalid',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Falha na validação',
    },
    {
      name: 'error',
      direction: 'output',
      type: 'string',
      title: 'Dado: Mensagem de erro de validação',
    },
  ],
  switch: [
    exec('Lado B: Avalia o valor e ramifica o fluxo'),
    {
      name: 'value',
      direction: 'input',
      type: 'string',
      title: 'Dado: Valor a ser comparado com os casos',
    },
    {
      name: 'case1',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Ramificação correspondente ao Caso 1',
    },
    {
      name: 'case2',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Ramificação correspondente ao Caso 2',
    },
    {
      name: 'default',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Ramificação padrão se nenhum caso coincidir',
    },
  ],
  delay: [
    exec('Lado B: Dispara a contagem do timer'),
    {
      name: 'duration',
      direction: 'input',
      type: 'number',
      title: 'Dado: Duração em milissegundos',
    },
    {
      name: 'next',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Prossegue após o tempo configurado',
    },
  ],
  auth: [
    {
      name: 'trigger',
      direction: 'input',
      type: 'Event',
      title: 'Lado B: Dispara o fluxo de autenticação (ex: via onClick)',
    },
    { name: 'email', direction: 'input', type: 'string', title: 'Dado: e-mail do usuário' },
    { name: 'password', direction: 'input', type: 'string', title: 'Dado: senha do usuário' },
    {
      name: 'onSuccess',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Sucesso na autenticação',
    },
    { name: 'onError', direction: 'output', type: 'Error', title: 'Lado A: Falha na autenticação' },
    {
      name: 'user',
      direction: 'output',
      type: 'User',
      title: 'Dado: sessão ou dados do usuário autenticado',
    },
  ],
  api: [
    exec('Lado B: Disparador da requisição HTTP'),
    {
      name: 'body',
      direction: 'input',
      type: 'object',
      title: 'Dado: corpo ou parâmetros da requisição',
    },
    {
      name: 'onSuccess',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Resposta HTTP 2xx de sucesso',
    },
    {
      name: 'onError',
      direction: 'output',
      type: 'Error',
      title: 'Lado A: Erro HTTP ou falha de rede',
    },
    {
      name: 'response',
      direction: 'output',
      type: 'object',
      title: 'Dado: dados JSON retornados pela API',
    },
  ],
  database: [
    exec('Lado B: Executa query ou insert'),
    {
      name: 'value',
      direction: 'input',
      type: 'object',
      title: 'Dado: registro a ser inserido ou filtrado',
    },
    {
      name: 'onSuccess',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Operação no banco concluída com sucesso',
    },
    {
      name: 'onError',
      direction: 'output',
      type: 'Error',
      title: 'Lado A: Erro na operação do banco',
    },
    {
      name: 'data',
      direction: 'output',
      type: 'object',
      title: 'Dado: registros retornados pelo banco',
    },
  ],
  navigate: [
    exec('Lado B: Acionar navegação'),
    { name: 'route', direction: 'input', type: 'string', title: 'Dado: rota de destino' },
    {
      name: 'onComplete',
      direction: 'output',
      type: 'Event',
      title: 'Lado A: Navegação concluída',
    },
  ],
  screen: [
    {
      name: 'onEnter',
      direction: 'input',
      type: 'Event',
      title: 'Lado B: Ouvinte disparado ao carregar/abrir a tela',
    },
    {
      name: 'user',
      direction: 'input',
      type: 'User',
      title: 'Dado: dados do usuário recebidos pela tela',
    },
    { name: 'routes', direction: 'output', title: 'Lado A: Rotas e transições da tela' },
  ],
};

/** Gera um id de porta único no bloco a partir de uma base (`value`, `value_2`, …). */
export function uniquePortId(base: string, existingIds: string[]): string {
  const taken = new Set(existingIds);
  let id = base;
  let counter = 2;
  while (taken.has(id)) id = `${base}_${counter++}`;
  return id;
}
