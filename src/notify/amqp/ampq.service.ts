import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { etag, Notify, Process } from '@letsflow/core/process';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfigService } from '@/common/config/config.service';
import { createMessage } from '../utils/message';
import { NotifyProvider } from '../notify-provider.interface';

const DEFAULT_APPID = 'letsflow';

export interface AmqpOptions {
  url: string;
  exchange?: string;
  routingKey?: string;
  timeout?: number;
  appId?: string;
  reply?: boolean;
  replyTo?: string;
  responseTimeout?: number; // in seconds

  [_: string]: any;
}

@Injectable()
export class AmqpService implements NotifyProvider, OnModuleDestroy {
  private logger = new Logger(AmqpService.name);
  private readonly defaultReplyQueue: string;

  private connections: Map<string, AmqpConnectionManager> = new Map();
  private channels: Map<string, ChannelWrapper> = new Map();
  private consuming: Record<string, boolean> = {};
  private awaiting: Map<string, (response: any) => void> = new Map();

  constructor(
    private readonly config: ConfigService,
    @Inject('AMQP_CONNECT') private readonly connect: (url: string) => AmqpConnectionManager,
  ) {
    const random = (Math.random() + 1).toString(36).substring(6);
    this.defaultReplyQueue = `reply-${random}`;
  }

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

    const { url: _, exchange, routingKey, responseTimeout, reply, ...options } = settings;

    const channel = await this.getChannel(args.service);
    const message = args.message ?? createMessage(process, args.trigger);

    options.appId ??= DEFAULT_APPID;
    options.messageId = etag(process);
    if (typeof message !== 'string') {
      options.contentType = 'application/json';
    }
    options.timestamp = Math.floor(Date.now() / 1000);
    options.persistent ??= true;
    options.timeout ??= 10000;

    if (!(reply ?? options.replyTo)) {
      await this.publish(channel, message, exchange, routingKey, options);
      return;
    }

    options.replyTo ??= this.defaultReplyQueue;

    this.consume(args.service, channel, options.replyTo).then(); // Don't await, this will not resolve

    return await this.sendReceive(channel, message, exchange, routingKey, options, responseTimeout);
  }

  private async publish(
    channel: ChannelWrapper,
    message: any,
    exchange?: string,
    routingKey?: string,
    options?: Record<string, any>,
  ) {
    await channel.publish(
      exchange || '',
      routingKey || '',
      typeof message === 'string' ? message : JSON.stringify(message),
      options,
    );
  }

  private async consume(service: string, channel: ChannelWrapper, queue: string) {
    if (this.consuming[service]) return; // Create a single consumer per channel

    try {
      if (queue === this.defaultReplyQueue) {
        await channel.assertQueue(queue, { exclusive: true, autoDelete: true, messageTtl: 3600 });
      }

      await channel.consume(
        queue,
        (msg) => {
          const id = msg?.properties.correlationId;
          if (!id || !this.awaiting.has(id)) {
            channel.nack(msg, false, false);
            return;
          }

          const resolve = this.awaiting.get(id);
          const content = msg.content.toString();
          const response = msg.properties.contentType === 'application/json' ? JSON.parse(content) : content;

          channel.ack(msg);
          this.awaiting.delete(id);

          resolve(response);
        },
        { noAck: false } as any,
      );
    } catch (error) {
      this.logger.error(`Error setting up consumer for service ${service}: ${error.message}`);
    }
  }

  private async sendReceive(
    channel: ChannelWrapper,
    message: any,
    exchange?: string,
    routingKey?: string,
    options?: Record<string, any>,
    receiveTimeout?: number,
  ): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;

      // Set awaiting response before publishing message to avoid race conditions
      this.awaiting.set(options.messageId, (result) => {
        if (timer) clearTimeout(timer);
        return resolve(result);
      });

      this.publish(channel, message, exchange, routingKey, options)
        .then(() => {
          timer = setTimeout(() => reject(new Error('Response timeout exceeded')), (receiveTimeout ?? 30) * 1000);
        })
        .catch(reject);
    });
  }
}
