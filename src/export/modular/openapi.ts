import type { Graph } from '../../engine/types';
import { buildHttpManifest } from '../../engine/http';
import { ArtifactPlan, json } from './artifacts';

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description: string }>;
  paths: Record<string, unknown>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
}

export function generateOpenApiSpec(graph: Graph): OpenApiSpec {
  const title = graph.name || 'FlowForge Application';
  const manifest = buildHttpManifest(graph);
  const hasDb =
    (graph.entities?.length ?? 0) > 0 || graph.nodes.some((n) => n.data.kind === 'database');
  const hasAuth = graph.auth !== undefined || graph.nodes.some((n) => n.data.kind === 'auth');
  const hasPayments = graph.nodes.some((n) => n.data.kind === 'payment');
  const hasRealtime = graph.nodes.some((n) => n.data.kind === 'realtime');
  const hasStorage = graph.nodes.some((n) => n.data.kind === 'storage');
  const hasEmail = graph.nodes.some((n) => n.data.kind === 'notify');

  const tags: Array<{ name: string; description: string }> = [
    {
      name: 'Observabilidade',
      description: 'Monitoramento de integridade e diagnósticos de ambiente',
    },
  ];
  if (hasAuth)
    tags.push({ name: 'Autenticação', description: 'Sessão, login e gerenciamento de identidade' });
  if (hasDb)
    tags.push({
      name: 'Banco de Dados',
      description: 'Operações relacionais persistentes CRUD e consultas',
    });
  if (manifest.requests.length > 0)
    tags.push({ name: 'Integrações HTTP', description: 'Chamadas seguras a APIs externas' });
  if (hasPayments)
    tags.push({ name: 'Pagamentos', description: 'Checkouts Stripe e cobranças dinâmicas PIX' });
  if (hasRealtime)
    tags.push({ name: 'Tempo Real', description: 'Subscrições SSE e canais de eventos reativos' });
  if (hasStorage)
    tags.push({ name: 'Armazenamento', description: 'Upload e gestão de arquivos em nuvem' });
  if (hasEmail)
    tags.push({ name: 'Comunicação', description: 'Disparo de e-mails transacionais e alertas' });

  const paths: Record<string, unknown> = {
    '/api/health': {
      get: {
        tags: ['Observabilidade'],
        summary: 'Healthcheck de Serviço',
        description: 'Retorna o status operacional, uptime e timestamp atual do backend.',
        responses: {
          '200': {
            description: 'Serviço operacional',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    uptimeSeconds: { type: 'number', example: 124.5 },
                    timestamp: { type: 'string', example: '2026-10-27T04:20:00.000Z' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/diagnostics': {
      get: {
        tags: ['Observabilidade'],
        summary: 'Diagnóstico de Configuração e Ambiente',
        description: 'Valida a presença de segredos e prontidão operacional dos adaptadores.',
        responses: {
          '200': {
            description: 'Diagnóstico emitido com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    environment: { type: 'string' },
                    checkedAt: { type: 'string' },
                    adapters: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  if (hasAuth) {
    paths['/api/auth/login'] = {
      post: {
        tags: ['Autenticação'],
        summary: 'Autenticar com Credenciais',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@empresa.com' },
                  password: { type: 'string', format: 'password', example: 'SenhaSegura123!' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Autenticado com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Credenciais inválidas' },
        },
      },
    };

    paths['/api/auth/session'] = {
      get: {
        tags: ['Autenticação'],
        summary: 'Verificar Sessão Atual',
        security: [{ BearerAuth: [] }, { SessionToken: [] }],
        responses: {
          '200': { description: 'Sessão válida' },
          '401': { description: 'Não autenticado' },
        },
      },
    };

    paths['/api/auth/logout'] = {
      post: {
        tags: ['Autenticação'],
        summary: 'Encerrar Sessão',
        security: [{ BearerAuth: [] }, { SessionToken: [] }],
        responses: {
          '200': { description: 'Sessão finalizada' },
        },
      },
    };
  }

  const schemas: Record<string, unknown> = {};

  if (hasDb) {
    // Endpoints genéricos e de entidades
    paths['/api/db'] = {
      get: {
        tags: ['Banco de Dados'],
        summary: 'Consultar Registros de Entidade',
        parameters: [
          {
            name: 'entity',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Nome da tabela/entidade',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
            description: 'Limite de registros',
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 },
            description: 'Deslocamento de paginação',
          },
          {
            name: 'orderBy',
            in: 'query',
            schema: { type: 'string' },
            description: 'Coluna de ordenação',
          },
        ],
        responses: {
          '200': {
            description: 'Lista de registros encontrados',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    rows: { type: 'array', items: { type: 'object' } },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Banco de Dados'],
        summary: 'Inserir Registro',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['entity', 'data'],
                properties: {
                  entity: { type: 'string' },
                  data: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Registro criado com sucesso' },
        },
      },
    };

    // Montar schemas para cada entidade do grafo
    for (const entity of graph.entities || []) {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const field of entity.fields) {
        let fieldType = 'string';
        if (field.type === 'number') fieldType = 'number';
        else if (field.type === 'boolean') fieldType = 'boolean';
        else if (field.type === 'date') fieldType = 'string';

        properties[field.name] = {
          type: fieldType,
          description: field.primaryKey ? 'Chave primária' : undefined,
        };

        if (field.required || field.primaryKey) {
          required.push(field.name);
        }
      }

      schemas[entity.name] = {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    for (const node of graph.nodes) {
      if (node.data.kind === 'database' && node.data.config?.table) {
        const tbl = String(node.data.config.table);
        if (!schemas[tbl]) {
          schemas[tbl] = {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Identificador único' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
            required: ['id'],
          };
        }
      }
    }
  }

  if (hasPayments) {
    paths['/api/payments/checkout'] = {
      post: {
        tags: ['Pagamentos'],
        summary: 'Criar Sessão de Checkout (Stripe)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amount', 'currency'],
                properties: {
                  amount: { type: 'number', example: 199.9 },
                  currency: { type: 'string', example: 'BRL' },
                  customerEmail: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Sessão criada com sessionId e checkoutUrl' },
        },
      },
    };

    paths['/api/payments/pix'] = {
      post: {
        tags: ['Pagamentos'],
        summary: 'Gerar Cobrança Dinâmica PIX com QR Code',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amount'],
                properties: {
                  amount: { type: 'number', example: 89.5 },
                  description: { type: 'string', example: 'Pedido #1042' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Cobrança gerada com qrCode e copiaECola' },
        },
      },
    };
  }

  if (hasRealtime) {
    paths['/api/realtime/events'] = {
      get: {
        tags: ['Tempo Real'],
        summary: 'Conectar ao Canal de Eventos (SSE)',
        description: 'Canal Server-Sent Events para notificações e sincronização reativa.',
        responses: {
          '200': {
            description: 'Fluxo contínuo de eventos text/event-stream',
          },
        },
      },
      post: {
        tags: ['Tempo Real'],
        summary: 'Publicar Evento em Canal',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['channel', 'event', 'data'],
                properties: {
                  channel: { type: 'string', example: 'pedidos' },
                  event: { type: 'string', example: 'novo_pedido' },
                  data: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Evento distribuído aos assinantes conectados' },
        },
      },
    };
  }

  // Requisições HTTP configuradas no catálogo
  for (const req of manifest.requests) {
    const route = `/api/http/${req.id}`;
    paths[route] = {
      post: {
        tags: ['Integrações HTTP'],
        summary: `Executar Conector ${req.id}`,
        description: `Encaminha chamada segura para o conector '${req.id}' com timeout e segredos resolvidos no backend.`,
        responses: {
          '200': { description: 'Resposta da API externa' },
          '502': { description: 'Falha ou indisponibilidade na API externa' },
        },
      },
    };
  }

  // Contratos de API e Operações da Modelagem Aplicada (Seção 8 do plano)
  const appliedSpec = graph.appModeling?.applied;
  if (appliedSpec && appliedSpec.apiContracts.length > 0) {
    tags.push({
      name: 'Operações Modeladas',
      description: 'Endpoints derivados de contratos de operações e regras de negócio aplicadas',
    });

    for (const contract of appliedSpec.apiContracts) {
      const op = appliedSpec.operations.find((o) => o.id === contract.operationId);
      if (!op) continue; // Não publica contratos ainda não implementados

      const methodKey = contract.method.toLowerCase();
      const responses: Record<string, unknown> = {
        [op.entityAction === 'create' ? '201' : '200']: {
          description: op.outputSummary || 'Operação executada com sucesso',
        },
      };
      for (const errCase of op.errorCases) {
        responses[String(errCase.status)] = {
          description: `${errCase.code}: ${errCase.message}`,
        };
      }

      paths[contract.path] = {
        ...(paths[contract.path] as Record<string, unknown> | undefined),
        [methodKey]: {
          tags: ['Operações Modeladas'],
          summary: `${op.code} — ${contract.name}`,
          description: `Operação vinculada: ${op.name} | Entidade: ${op.targetEntity} | Transacional: ${op.transactional ? 'Sim' : 'Não'}`,
          ...(contract.authRequired
            ? { security: [{ BearerAuth: [] }, { SessionToken: [] }] }
            : {}),
          ...(contract.idempotencyKeyHeader
            ? {
                parameters: [
                  {
                    name: contract.idempotencyKeyHeader,
                    in: 'header',
                    required: false,
                    schema: { type: 'string' },
                    description:
                      'Chave de idempotência para evitar duplicidade de efeito em retentativas',
                  },
                ],
              }
            : {}),
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: op.inputs.filter((i) => i.required).map((i) => i.name),
                  properties: Object.fromEntries(
                    op.inputs.map((i) => [
                      i.name,
                      {
                        type:
                          i.type === 'number' || i.type === 'decimal_cents'
                            ? 'number'
                            : i.type === 'boolean'
                              ? 'boolean'
                              : 'string',
                      },
                    ]),
                  ),
                },
              },
            },
          },
          responses,
        },
      };
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title,
      version: '1.0.0',
      description: `Documentação oficial da API para a aplicação '${title}', gerada automaticamente pela plataforma FlowForge.`,
    },
    servers: [
      { url: 'http://localhost:8787', description: 'Servidor Local de Desenvolvimento' },
      { url: '/', description: 'Servidor Atual (Host Relativo)' },
    ],
    tags,
    paths,
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token de autenticação no cabeçalho Authorization: Bearer <token>',
        },
        SessionToken: {
          type: 'apiKey',
          in: 'header',
          name: 'x-session-token',
          description: 'Token de sessão persistente FlowForge',
        },
      },
      schemas,
    },
  };
}

export function generateSwaggerHtml(spec: OpenApiSpec): string {
  const jsonSpec = JSON.stringify(spec);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${spec.info.title} — Documentação da API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .topbar { display: none; }
    .swagger-ui { color: #f1f5f9; }
    .swagger-ui .info .title { color: #38bdf8; }
    .swagger-ui .scheme-container { background: #0f172a; box-shadow: none; border-bottom: 1px solid #1e293b; }
    .swagger-ui .opblock { border-radius: 8px; border: 1px solid #334155; }
    .swagger-ui .opblock .opblock-summary { border-bottom: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        spec: ${jsonSpec},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
`;
}

export function emitOpenApi(plan: ArtifactPlan, graph: Graph): boolean {
  const spec = generateOpenApiSpec(graph);
  const swaggerHtml = generateSwaggerHtml(spec);

  // 1. Contratos públicos TypeScript
  plan.text(
    'packages/contracts/src/openapi.ts',
    `export const openApiSpec = ${json(spec)};\nexport type OpenApiSpecification = typeof openApiSpec;\n`,
    'contract',
  );

  // 2. Gateway e arquivos da API
  const root = 'apps/api/src/openapi/';
  plan.text(root + 'spec.mjs', `export default ${json(spec)};\n`, 'openapi-spec');

  const gatewayCode = `import spec from './spec.mjs';
const swaggerHtml = ${JSON.stringify(swaggerHtml)};

export function createOpenApiGateway() {
  return async (req, res) => {
    const url = req.url || '';
    const p = url.split('?')[0];

    if (p === '/api/openapi.json') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(spec, null, 2));
      return true;
    }

    if (p === '/api/docs' || p === '/api/swagger') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(swaggerHtml);
      return true;
    }

    return false;
  };
}
`;

  plan.text(root + 'gateway.mjs', gatewayCode, 'openapi-gateway', [], [root + 'spec.mjs']);
  return true;
}
