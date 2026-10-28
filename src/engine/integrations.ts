import type { Graph } from './types';

export type StorageConfig = {
  id: string;
  provider: 'local' | 's3';
  bucket: string;
  maxSizeBytes: number;
  allowedTypes: string[];
  secretEnv: string;
  execution: 'real' | 'demo';
};

export type EmailConfig = {
  id: string;
  provider: 'smtp' | 'resend';
  from: string;
  to?: string;
  subject?: string;
  body?: string;
  secretEnv: string;
  execution: 'real' | 'demo';
};

export type WebhookConfig = {
  id: string;
  path: string;
  secretEnv: string;
  eventType: string;
};

export type TaskConfig = {
  id: string;
  taskName: string;
  schedule: string;
  execution: 'real' | 'demo';
};

export type IntegrationsManifest = {
  storage: StorageConfig[];
  email: EmailConfig[];
  webhooks: WebhookConfig[];
  tasks: TaskConfig[];
};

export function buildIntegrationsManifest(graph: Graph): IntegrationsManifest {
  const storage: StorageConfig[] = [];
  const email: EmailConfig[] = [];
  const webhooks: WebhookConfig[] = [];
  const tasks: TaskConfig[] = [];

  for (const node of graph.nodes) {
    const { kind, config } = node.data;
    if (kind === 'storage') {
      storage.push({
        id: node.id,
        provider: (config.provider as 'local' | 's3') || 'local',
        bucket: config.bucket || 'uploads',
        maxSizeBytes: parseInt(config.maxSizeBytes || '5242880', 10),
        allowedTypes: (config.allowedTypes || 'image/*,application/pdf')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        secretEnv: config.secretEnv || 'FLOWFORGE_SECRET_STORAGE_KEY',
        execution: config.execution === 'demo' ? 'demo' : 'real',
      });
    } else if (kind === 'email') {
      email.push({
        id: node.id,
        provider: (config.provider as 'smtp' | 'resend') || 'smtp',
        from: config.from || 'contato@exemplo.com',
        to: config.to,
        subject: config.subject,
        body: config.body,
        secretEnv: config.secretEnv || 'FLOWFORGE_SECRET_EMAIL_API_KEY',
        execution: config.execution === 'demo' ? 'demo' : 'real',
      });
    } else if (kind === 'webhook') {
      webhooks.push({
        id: node.id,
        path: config.path || `/api/webhooks/${node.id}`,
        secretEnv: config.secretEnv || 'FLOWFORGE_SECRET_WEBHOOK_SECRET',
        eventType: config.eventType || '*',
      });
    } else if (kind === 'task') {
      tasks.push({
        id: node.id,
        taskName: config.taskName || 'Tarefa Agendada',
        schedule: config.schedule || '0 * * * *',
        execution: config.execution === 'demo' ? 'demo' : 'real',
      });
    }
  }

  return { storage, email, webhooks, tasks };
}
