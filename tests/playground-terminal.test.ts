import test from 'node:test';
import assert from 'node:assert/strict';
import { appTemplates } from '../src/engine/appTemplates';
import { PLAYGROUND_ACCOUNT } from '../src/engine/playgroundCredentials';
import { playgroundLoginFields, sanitizeTerminalText } from '../src/features/preview/terminal';
import { clearDevAuth, createAuthGateway, executeAuthAction } from '../src/server/authGateway';
import {
  compile,
  createExecutionContext,
  createDefaultAdapters,
  interpret,
  type ExecutionEvent,
} from '../src/compiler';

test('credenciais aparecem apenas na tela de login suportada e identificam os campos conectados', () => {
  const graph = appTemplates.tasks;
  assert.deepEqual(playgroundLoginFields(graph, 'login'), {
    emailId: 'email',
    passwordId: 'senha',
  });
  assert.equal(playgroundLoginFields(graph, 'home'), null);
  const withoutLogin = { ...graph, nodes: graph.nodes.filter((node) => node.data.kind !== 'auth') };
  assert.equal(playgroundLoginFields(withoutLogin, 'login'), null);
});

test('conta de teste existe apenas quando o gateway de prévia a habilita', async () => {
  clearDevAuth();
  createAuthGateway();
  assert.equal((await executeAuthAction('login', PLAYGROUND_ACCOUNT)).ok, false);
  createAuthGateway({ seedPlaygroundAccount: true });
  assert.equal((await executeAuthAction('login', PLAYGROUND_ACCOUNT)).ok, true);
  clearDevAuth();
});

test('terminal recebe eventos de blocos e erros tratados durante a execução', async () => {
  const graph = appTemplates.tasks;
  const compiled = compile(graph, { references: true });
  assert.equal(compiled.ok, true);
  if (!compiled.ok) return;
  const events: ExecutionEvent[] = [];
  const adapters = createDefaultAdapters();
  adapters.auth = {
    async execute() {
      throw Object.assign(new Error('Falha de autenticação'), {
        code: 'INVALID_CREDENTIALS',
        status: 401,
      });
    },
  };
  const context = createExecutionContext({
    inputs: { email: 'pessoa@example.test', senha: 'senha-secreta' },
    adapters,
    onEvent: (event) => events.push(event),
  });
  const result = await interpret(compiled.value, 'entrar', context);
  assert.equal(result.success, false);
  assert.ok(events.some((item) => item.message.includes('Integração auth: iniciando')));
  assert.ok(events.some((item) => item.level === 'error' && item.message.includes('HTTP 401')));
  assert.ok(events.every((item) => !item.message.includes('senha-secreta')));
});

test('terminal oculta credenciais e tokens presentes em mensagens', () => {
  const safe = sanitizeTerminalText(
    'senha=senha-secreta bearer ff_sess_abcdef url=https://user:pass@host teste pessoa@example.test',
    { senha: 'senha-secreta', email: 'pessoa@example.test' },
  );
  for (const secret of ['senha-secreta', 'ff_sess_abcdef', 'user:pass', 'pessoa@example.test'])
    assert.ok(!safe.includes(secret));
});

test('eventos de integração chegam antes de uma operação assíncrona terminar', async () => {
  const compiled = compile(appTemplates.tasks, { references: true });
  assert.equal(compiled.ok, true);
  if (!compiled.ok) return;
  const events: ExecutionEvent[] = [];
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const adapters = createDefaultAdapters();
  adapters.auth = {
    async execute() {
      await pending;
      return { id: 'user' };
    },
  };
  const result = interpret(
    compiled.value,
    'entrar',
    createExecutionContext({ adapters, onEvent: (entry) => events.push(entry) }),
  );
  for (
    let i = 0;
    i < 20 && !events.some((entry) => entry.message.includes('Integração auth: iniciando'));
    i++
  )
    await Promise.resolve();
  assert.ok(events.some((entry) => entry.message.includes('Integração auth: iniciando')));
  assert.ok(!events.some((entry) => entry.message === 'Execução concluída.'));
  finish();
  assert.equal((await result).success, true);
  assert.ok(events.some((entry) => entry.message === 'Execução concluída.'));
});
