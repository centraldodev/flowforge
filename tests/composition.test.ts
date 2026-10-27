import test from 'node:test';
import assert from 'node:assert/strict';
import type { Block, Graph } from '../src/engine/types';
import {
  createPresetFromBlock,
  applyPresetToBlock,
  detectSubflowCycles,
  evaluateRuleCollection,
  type SubflowDefinition,
  type BlockPreset,
  type RuleCollection,
} from '../src/engine/composition';
import { ModularSubflowAdapter } from '../src/compiler/interpreter/subflowAdapter';
import { createExecutionContext } from '../src/compiler/interpreter/adapters';
import { createTypeScriptPlan } from '../src/export/typescript';

test('Fase 5: Execução de subfluxo com argumentos e retorno', async () => {
  // Define nós internos do subfluxo: entrada -> math (multiplica por 2) -> saída
  const internalMathBlock: Block = {
    id: 'sub_math_1',
    position: { x: 100, y: 100 },
    data: {
      kind: 'math',
      contractVersion: 1,
      label: 'Dobrar Valor',
      config: {
        operation: 'mul',
        b: '2',
      },
      ports: [
        {
          id: 'a',
          name: 'A',
          mode: 'data',
          direction: 'input',
          cardinality: 'one',
          valueType: { kind: 'number' },
        },
        {
          id: 'result',
          name: 'Resultado',
          mode: 'data',
          direction: 'output',
          cardinality: 'many',
          valueType: { kind: 'number' },
        },
      ],
    },
  };

  const subflowDef: SubflowDefinition = {
    id: 'dobrar_numero',
    name: 'Dobrar Número',
    description: 'Multiplica o número de entrada por 2',
    parameters: [
      {
        id: 'input',
        name: 'Número',
        direction: 'input',
        valueType: { kind: 'number' },
        required: true,
      },
    ],
    returns: [
      { id: 'result', name: 'Resultado', direction: 'output', valueType: { kind: 'number' } },
    ],
    nodes: [internalMathBlock],
    edges: [],
  };

  const adapter = new ModularSubflowAdapter([subflowDef]);
  const context = createExecutionContext({
    adapters: {
      ...createExecutionContext().adapters,
      subflow: adapter,
    },
  });

  const res = await adapter.execute('dobrar_numero', { input: 21 }, context, subflowDef);
  assert.equal(res, 42, 'Subfluxo deve calcular e retornar o dobro da entrada (21 * 2 = 42)');
});

test('Fase 5: Detecção de ciclos recursivos entre subfluxos', async () => {
  // Subfluxo A chama B e Subfluxo B chama A
  const subflowA: SubflowDefinition = {
    id: 'subflow_a',
    name: 'Subfluxo A',
    parameters: [],
    returns: [],
    nodes: [
      {
        id: 'call_b',
        position: { x: 0, y: 0 },
        data: {
          kind: 'subflow',
          contractVersion: 1,
          label: 'Chamar B',
          config: { subflowId: 'subflow_b' },
        },
      },
    ],
    edges: [],
  };

  const subflowB: SubflowDefinition = {
    id: 'subflow_b',
    name: 'Subfluxo B',
    parameters: [],
    returns: [],
    nodes: [
      {
        id: 'call_a',
        position: { x: 0, y: 0 },
        data: {
          kind: 'subflow',
          contractVersion: 1,
          label: 'Chamar A',
          config: { subflowId: 'subflow_a' },
        },
      },
    ],
    edges: [],
  };

  const cycleCheck = detectSubflowCycles([subflowA, subflowB]);
  assert.equal(cycleCheck.hasCycle, true, 'Deve identificar ciclo estático entre subfluxos');
  assert.ok(
    cycleCheck.cyclePath?.includes('subflow_a') && cycleCheck.cyclePath?.includes('subflow_b'),
    'O caminho do ciclo deve indicar a rota cíclica entre subflow_a e subflow_b',
  );

  // Tentativa de execução com ciclo estático deve lançar erro explícito
  const adapter = new ModularSubflowAdapter([subflowA, subflowB]);
  const context = createExecutionContext({
    adapters: {
      ...createExecutionContext().adapters,
      subflow: adapter,
    },
  });

  await assert.rejects(
    async () => {
      await adapter.execute('subflow_a', {}, context);
    },
    (err: Error) => {
      return err.message.includes('Ciclo recursivo detectado');
    },
    'Deve barrar a execução e lançar mensagem diagnóstica acionável',
  );
});

test('Fase 5: Criação de preset com higienização estrita de segredos', () => {
  const sensitiveBlock: Block = {
    id: 'api_node',
    position: { x: 0, y: 0 },
    data: {
      kind: 'api',
      contractVersion: 1,
      label: 'API Externa',
      config: {
        url: 'https://api.exemplo.com/v1',
        method: 'POST',
        userPassword: 'senha_plain_text_insegura_123',
        apiToken: 'TOKEN_EM_TEXTO_PURO',
        authSecret: 'FLOWFORGE_SECRET_API_KEY', // Referência segura autorizada
      },
    },
  };

  const preset = createPresetFromBlock(
    sensitiveBlock,
    'Preset API Segura',
    'user',
    'Preset para testes',
  );

  assert.equal(preset.name, 'Preset API Segura');
  assert.equal(preset.kind, 'api');
  assert.equal(preset.author, 'user');
  assert.equal(preset.config.url, 'https://api.exemplo.com/v1');
  assert.equal(preset.config.method, 'POST');
  assert.equal(preset.config.userPassword, undefined, 'Senhas em plain text devem ser removidas');
  assert.equal(preset.config.apiToken, undefined, 'Tokens em plain text devem ser removidos');
  assert.equal(
    preset.config.authSecret,
    'FLOWFORGE_SECRET_API_KEY',
    'Referências de segredos FLOWFORGE_SECRET_* devem ser preservadas',
  );
});

test('Fase 5: Aplicação de preset em bloco preservando identidade e links', () => {
  const targetBlock: Block = {
    id: 'node_target_123',
    position: { x: 50, y: 50 },
    data: {
      kind: 'math',
      contractVersion: 1,
      label: 'Meu Bloco',
      config: {
        operation: 'add',
        b: '10',
      },
    },
  };

  const mathPreset: BlockPreset = {
    id: 'preset_math_div',
    name: 'Preset Divisão',
    kind: 'math',
    version: 1,
    author: 'official',
    config: {
      operation: 'div',
      b: '5',
    },
  };

  const updatedBlock = applyPresetToBlock(targetBlock, mathPreset);
  assert.equal(
    updatedBlock.id,
    'node_target_123',
    'Identidade do nó deve ser estritamente preservada',
  );
  assert.equal(updatedBlock.data.config.operation, 'div');
  assert.equal(updatedBlock.data.config.b, '5');

  // Teste de rejeição para tipos incompatíveis
  const incompatiblePreset: BlockPreset = {
    id: 'preset_api',
    name: 'Preset Incompatível',
    kind: 'api',
    version: 1,
    author: 'official',
    config: { url: 'https://exemplo.com' },
  };

  assert.throws(
    () => applyPresetToBlock(targetBlock, incompatiblePreset),
    /Preset incompatível/,
    'Deve rejeitar aplicação de preset com kind divergente',
  );
});

test('Fase 5: Coleções de regras reutilizáveis (RuleCollection)', () => {
  const userValidationCollection: RuleCollection = {
    id: 'rules_user_registration',
    name: 'Regras de Cadastro de Usuário',
    rules: [
      {
        id: 'r1',
        name: 'Nome Obrigatório',
        field: 'nome',
        rule: 'required',
        message: 'O nome é obrigatório',
      },
      { id: 'r2', name: 'Email Válido', field: 'email', rule: 'email', message: 'E-mail inválido' },
      {
        id: 'r3',
        name: 'Senha Mínima',
        field: 'senha',
        rule: 'minLength',
        param: '6',
        message: 'Senha curta',
      },
      {
        id: 'r4',
        name: 'Idade Numérica',
        field: 'idade',
        rule: 'numeric',
        message: 'Idade deve ser número',
      },
    ],
  };

  // 1. Dados válidos
  const validData = {
    nome: 'Maria Silva',
    email: 'maria@exemplo.com',
    senha: 'senhaforte123',
    idade: '28',
  };
  const validResult = evaluateRuleCollection(validData, userValidationCollection);
  assert.equal(validResult.valid, true);
  assert.deepEqual(validResult.errors, {});

  // 2. Dados com violações múltiplas
  const invalidData = {
    nome: '',
    email: 'nao-e-um-email',
    senha: '123',
    idade: 'vinte',
  };
  const invalidResult = evaluateRuleCollection(invalidData, userValidationCollection);
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.errors.nome?.includes('O nome é obrigatório'));
  assert.ok(invalidResult.errors.email?.includes('E-mail inválido'));
  assert.ok(invalidResult.errors.senha?.includes('Senha curta'));
  assert.ok(invalidResult.errors.idade?.includes('Idade deve ser número'));
});

test('Fase 5: Exportação modular com subfluxos e manifesto de composição', () => {
  const subflowBlock: Block = {
    id: 'subflow_node_1',
    position: { x: 200, y: 200 },
    data: {
      kind: 'subflow',
      contractVersion: 1,
      label: 'Processar Pedido',
      config: {
        subflowId: 'processar_pedido',
        subflowName: 'Processar Pedido',
        subflowDefinition: JSON.stringify({
          id: 'processar_pedido',
          name: 'Processar Pedido',
          parameters: [{ id: 'input', name: 'Entrada', direction: 'input' }],
          returns: [{ id: 'result', name: 'Resultado', direction: 'output' }],
          nodes: [],
          edges: [],
        }),
      },
    },
  };

  const graph: Graph = {
    version: 1,
    name: 'App Com Subfluxos',
    nodes: [subflowBlock],
    edges: [],
  };

  const plan = createTypeScriptPlan(graph);

  // Verifica contratos de composição e manifesto gerado
  assert.ok(
    plan.files.has('packages/contracts/src/composition.ts'),
    'Deve gerar contratos de composição em packages/contracts/src/composition.ts',
  );
  assert.ok(
    plan.files.has('apps/web/src/workflows/composition.manifest.json'),
    'Deve gerar manifesto em apps/web/src/workflows/composition.manifest.json',
  );

  // Verifica que o subfluxo foi incluído em workflows
  const hasWorkflowModule = [...plan.files.keys()].some(
    (k) => k.startsWith('apps/web/src/workflows/') && k.includes('subflow'),
  );
  assert.ok(
    hasWorkflowModule,
    'Deve exportar o módulo de subfluxo desacoplado em apps/web/src/workflows/',
  );

  // Validação do plano deve passar 100%
  plan.validate();
});
