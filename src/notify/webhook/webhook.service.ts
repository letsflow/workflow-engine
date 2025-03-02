import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@/common/config/config.service';
import { createMessage, etag, Notify, Process } from '@letsflow/core/process';
import { NotifyProvider } from '@/notify/notify-provider.interface';

interface WebhookSettings extends RequestInit {
  url: string;
  timeout?: number;
  headers?: Record<string, string>;
}

type FetchFunction = typeof fetch;

@Injectable()
export class WebhookService implements NotifyProvider {
  constructor(
    private readonly config: ConfigService,
    @Inject('FETCH') private readonly fetch: FetchFunction,
  ) {}

  async notify(process: Process, args: Notify): Promise<any> {
    const settings = this.config.get('services')[args.service] as WebhookSettings;
    if (!settings) {
      throw new Error(`Service '${args.service}' not configured for Webhook`);
    }

    if (!settings.url) {
      throw new Error(`Service '${args.service}' is missing url setting`);
    }

    const message = args.message ?? createMessage(process, args.service);
    const headers = {
      ...settings.headers,
      'Content-Type': typeof message === 'string' ? 'text/plain' : 'application/json',
      'Letsflow-Process': process.id,
      'Letsflow-Service': args.service,
      Etag: etag(process),
    };

    const response = await this.fetch(settings.url, {
      method: 'POST',
      headers,
      body: typeof message === 'string' ? message : JSON.stringify(message),
      signal: AbortSignal.timeout(settings.timeout ?? 30000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Webhook failed with status ${response.status} ${response.statusText}: ${body}`);
    }

    if (response.status === 202) {
      return;
    }

    return response.headers.get('Content-Type')?.startsWith('application/json')
      ? await response.json()
      : await response.text();
  }
}
