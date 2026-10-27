import type {
  EmailAdapter,
  ExecutionContext,
  StorageAdapter,
  TaskAdapter,
  WebhookAdapter,
} from './types';

/** Adaptador seguro de armazenamento (Storage) */
export class GatewayStorageAdapter implements StorageAdapter {
  async execute(
    action: string,
    payload: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const maxSizeBytes = Number(payload.maxSizeBytes || 5242880);
    const size = Number(payload.size || 1024);

    if (action === 'upload') {
      if (size > maxSizeBytes) {
        throw new Error(`Arquivo excede o limite permitido de ${maxSizeBytes} bytes.`);
      }

      const allowedTypes = String(payload.allowedTypes || '');
      let mimeType = String(payload.mimeType || '');
      if (!mimeType) {
        const pathStr = String(payload.path || '').toLowerCase();
        if (pathStr.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (pathStr.endsWith('.png')) mimeType = 'image/png';
        else if (pathStr.endsWith('.jpg') || pathStr.endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (pathStr.endsWith('.json')) mimeType = 'application/json';
        else mimeType = 'application/octet-stream';
      }
      if (allowedTypes) {
        const typesList = allowedTypes.split(',').map((t) => t.trim().toLowerCase());
        const isMatch = typesList.some((t) => {
          if (t === '*/*' || t === '*') return true;
          if (t.endsWith('/*')) {
            const prefix = t.slice(0, -1);
            return mimeType.toLowerCase().startsWith(prefix);
          }
          return mimeType.toLowerCase() === t;
        });
        if (!isMatch) {
          throw new Error(`Tipo de arquivo não permitido: ${mimeType}.`);
        }
      }

      const filePath = String(payload.path || `uploads/file_${Date.now()}.bin`);
      const fileUrl = `https://storage.flowforge.dev/${filePath}`;

      const storageBucket = (context.store.__storage ??= {}) as Record<string, unknown>;
      storageBucket[filePath] = {
        url: fileUrl,
        size,
        mimeType,
        uploadedAt: new Date().toISOString(),
      };

      return {
        success: true,
        fileUrl,
        size,
        path: filePath,
        result: fileUrl,
      };
    }

    if (action === 'delete') {
      const filePath = String(payload.path || '');
      const storageBucket = (context.store.__storage ??= {}) as Record<string, unknown>;
      delete storageBucket[filePath];
      return { success: true, deleted: filePath };
    }

    return { success: true, action };
  }
}

/** Adaptador seguro de envio de e-mail */
export class GatewayEmailAdapter implements EmailAdapter {
  async execute(
    action: string,
    payload: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const to = String(payload.to || '');
    if (!to) {
      throw new Error('Destinatário de e-mail (to) é obrigatório.');
    }

    const from = String(payload.from || 'contato@exemplo.com');
    const subject = String(payload.subject || 'Sem assunto');
    const body = String(payload.body || '');
    const messageId = `<msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@flowforge.dev>`;

    const sentEmails = (context.store.__sentEmails ??= []) as Array<Record<string, unknown>>;
    const record = {
      messageId,
      from,
      to,
      subject,
      body,
      sentAt: new Date().toISOString(),
    };
    sentEmails.push(record);

    return {
      success: true,
      messageId,
      to,
      from,
      result: messageId,
    };
  }
}

/** Adaptador seguro de recepção e validação de Webhooks */
export class GatewayWebhookAdapter implements WebhookAdapter {
  async execute(
    action: string,
    payload: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const signature = String(payload.signature || '');
    const expectedSignature = String(payload.expectedSignature || '');

    // Se houver verificação de assinatura exigida e não coincidir
    if (expectedSignature && signature !== expectedSignature) {
      throw new Error('Assinatura do webhook inválida. Acesso não autorizado.');
    }

    const event = payload.event ?? 'webhook.received';
    const data = payload.data ?? payload;

    return {
      success: true,
      action: action || 'receive',
      event,
      payload: data,
      result: data,
    };
  }
}

/** Adaptador seguro de tarefas agendadas e periódicas */
export class GatewayTaskAdapter implements TaskAdapter {
  async execute(
    action: string,
    payload: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const taskName = String(payload.taskName || 'tarefa_agendada');
    const schedule = String(payload.schedule || '0 * * * *');

    const tasksList = (context.store.__scheduledTasks ??= []) as Array<Record<string, unknown>>;
    const entry = {
      taskName,
      schedule,
      triggeredAt: new Date().toISOString(),
      action: action || 'trigger',
    };
    tasksList.push(entry);

    return {
      success: true,
      taskName,
      schedule,
      result: entry,
    };
  }
}
