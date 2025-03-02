import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { createMessage, etag, hash, hmac, Notify, Process } from '@letsflow/core/process';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfigService } from '@/common/config/config.service';
import { NotifyProvider } from '../notify-provider.interface';
import { clean } from '@/common/utils/clean';

const DEFAULT_APPID = 'letsflow';

export interface AmqpOptions {
  url: string;
  exchange?: string;
  routingKey?: string;
  timeout?: number;
  appId?: string;
  replyTo?: string;
  replySecret?: string;
  headers?: Record<string, any>;

  [_: string]: any;
}

@Injectable()
export class AmqpService implements NotifyProvider, OnModuleDestroy {
  private connections: Map<string, AmqpConnectionManager> = new Map();
  private channels: Map<string, ChannelWrapper> = new Map();

  constructor(
    private readonly config: ConfigService,
    @Inject('AMQP_CONNECT') private readonly connect: (url: string) => AmqpConnectionManager,
  ) {}

  onModuleDestroy() {
    this.channels.forEach((channel) => channel.close());
    this.connections.forEach((connection) => connection.close());
  }

  private getConnection(url: string): AmqpConnectionManager {
    if (this.connections.has(url)) {
      return this.connections.get(url);
    }

    const connection = this.connect(url);
    this.connections.set(url, connection);
    return connection;
  }

  private async getChannel(service: string): Promise<ChannelWrapper> {
    if (this.channels.has(service)) {
      return this.channels.get(service);
    }

    const settings = this.config.get('services')[service] as AmqpOptions | undefined;
    if (!settings) {
      throw new Error(`Service '${service}' not configured for AMQP`);
    }

    const connection = this.getConnection(settings.url);
    const exchange = settings.exchange || '';

    const channel = connection.createChannel({
      json: true,
      setup: async (channel: ChannelWrapper) => {
        if (exchange) {
          await channel.assertExchange(exchange, 'direct', { durable: true });
        }
      },
    });

    this.channels.set(service, channel);
    return channel;
  }

  async notify(process: Process, args: Notify): Promise<any> {
    const settings = this.config.get('services')[args.service] as AmqpOptions | undefined;
    if (!settings) {
      throw new Error(`Service '${args.service}' not configured for AMQP`);
    }

    const { url: _, exchange, routingKey, replySecret, headers, ...options } = settings;

    const channel = await this.getChannel(args.service);
    const message = args.message ?? createMessage(process, args.service);
    const messageId = hash({ process: process.id, etag: etag(process), service: args.service });
    const replyToken = replySecret
      ? hmac({ process: process.id, etag: etag(process), service: args.service }, replySecret)
      : undefined;

    options.appId ??= DEFAULT_APPID;
    options.messageId = messageId;
    if (typeof message !== 'string') {
      options.contentType = 'application/json';
    }
    options.timestamp = Math.floor(Date.now() / 1000);
    options.persistent ??= true;
    options.timeout ??= 10000;
    options.headers = clean({
      processId: process.id,
      service: args.service,
      etag: etag(process),
      replyToken: replyToken,
      ...headers,
    });

    await channel.publish(
      exchange || '',
      routingKey || '',
      typeof message === 'string' ? message : JSON.stringify(message),
      options,
    );
  }
}
